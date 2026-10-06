/* Route geometry only. No country, stay, residence or statistic mutations. */
(function(root){
  'use strict';
  const point=p=>Number.isFinite(p?.lat)&&Number.isFinite(p?.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;
  const distance=(a,b)=>{const r=Math.PI/180,x=(b[0]-a[0])*r,y=(b[1]-a[1])*r,h=Math.sin(x/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(y/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));};
  function flightArc(a,b){
    let end=b.lon;while(end-a.lon>180)end-=360;while(end-a.lon< -180)end+=360;
    const dx=end-a.lon,dy=b.lat-a.lat,bend=Math.min(8,Math.hypot(dx,dy)*.16),length=Math.hypot(dx,dy)||1;
    return Array.from({length:49},(_,i)=>{const t=i/48,k=4*t*(1-t);return [a.lat+dy*t+dx/length*bend*k,a.lon+dx*t-dy/length*bend*k];});
  }
  function mappedPath(elements,start,end,options={}){
    // Follow connected OSM route geometry; never bridge gaps with invented track.
    const graph=new Map(),coords=new Map(),key=p=>p.map(v=>v.toFixed(6)).join(',');
    for(const element of elements||[])for(const way of element.members||[]){if(options.type==='train'&&/(platform|stop)/.test(way.role||''))continue;const geometry=options.type==='train'?(way.geometry||[]).map(p=>point(p)?[p.lat,p.lon]:null):(way.geometry||[]).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)).map(p=>[p.lat,p.lon]);for(let i=1;i<geometry.length;i++){
      const a=geometry[i-1],b=geometry[i];if(!a||!b)continue;const ka=key(a),kb=key(b),d=distance(a,b);coords.set(ka,a);coords.set(kb,b);if(!graph.has(ka))graph.set(ka,[]);if(!graph.has(kb))graph.set(kb,[]);graph.get(ka).push([kb,d]);graph.get(kb).push([ka,d]);
    }}
    if(!coords.size||coords.size>60000)return null;
    const nearest=p=>[...coords].map(([k,c])=>[k,distance(c,[p.lat,p.lon])]).sort((a,b)=>a[1]-b[1])[0];
    const a=nearest(start),b=nearest(end);if(a[1]>2500||b[1]>2500)return null;
    const costs=new Map([[a[0],0]]),previous=new Map(),queue=[[0,a[0]]];
    // Binary heap for long railway relations.
    const push=v=>{queue.push(v);let i=queue.length-1;while(i){const p=(i-1)>>1;if(queue[p][0]<=v[0])break;queue[i]=queue[p];i=p;}queue[i]=v;};
    const pop=()=>{const out=queue[0],last=queue.pop();if(queue.length){let i=0;while(i*2+1<queue.length){let j=i*2+1;if(j+1<queue.length&&queue[j+1][0]<queue[j][0])j++;if(queue[j][0]>=last[0])break;queue[i]=queue[j];i=j;}queue[i]=last;}return out;};
    while(queue.length){const [cost,k]=pop();if(cost!==costs.get(k))continue;if(k===b[0])break;for(const [next,d] of graph.get(k)||[])if(cost+d<(costs.get(next)??Infinity)){costs.set(next,cost+d);previous.set(next,k);push([cost+d,next]);}}
    if(!costs.has(b[0]))return null;const path=[];let k=b[0];while(k){path.push(coords.get(k));if(k===a[0])break;k=previous.get(k);}return path.reverse();
  }
  // A second pass over the same OSM geometry, used only after exact routing fails.
  // Stops attach to segments, not just vertices. Small gaps are penalised heavily.
  async function networkPath(elements,start,end,options={}){
    const type=options.type,marine=type==='boat',rail=type==='train',road=['car','bus','walk'].includes(type),mask=options.mask,signal=options.signal;
    if(!point(start)||!point(end)||!Array.isArray(elements)||elements.length>(rail?20000:10000)||(!marine&&!rail&&!road)||marine&&!mask?.land)return null;
    const clock=()=>root.performance?.now?.()??Date.now(),began=clock(),budget=options.maxMs??3000,expired=()=>signal?.aborted||clock()-began>=budget;
    const from=[start.lat,start.lon],to=[end.lat,end.lon],direct=distance(from,to);
    if(expired()||direct<100||direct>2500000||Math.max(Math.abs(start.lat),Math.abs(end.lat))>80)return null;
    if(marine&&!options.marinePass){const preferred=await networkPath(elements,start,end,{...options,marinePass:true,ferryOnly:true});return preferred||networkPath(elements,start,end,{...options,marinePass:true,maxMs:budget-(clock()-began)});}
    // Use connected tracks first. Approximate switches/gaps must not shortcut a
    // genuine railway just because neighbouring tracks are physically close.
    if(rail&&!options.railPass){const preferred=await networkPath(elements,start,end,{...options,railPass:true,skipGaps:true});return preferred||networkPath(elements,start,end,{...options,railPass:true,maxMs:budget-(clock()-began)});}
    const snapLimit=marine?Math.min(12000,Math.max(1800,direct*.12)):rail?Math.min(10000,Math.max(1500,direct*.1)):Math.min(3000,Math.max(500,direct*.06));
    const gapLimit=marine?Math.min(8000,Math.max(300,direct*.08)):rail?Math.min(900,Math.max(60,direct*.012)):100;
    const wrapNear=lon=>start.lon+((lon-start.lon+540)%360)-180,xScale=111320*Math.cos((start.lat+end.lat)*Math.PI/360),xy=p=>[(wrapNear(p[1])-start.lon)*xScale,(p[0]-start.lat)*111320];
    const project=(p,s)=>{const [x,y]=xy(p),[a,b]=xy(s.a),[c,d]=xy(s.b),dx=c-a,dy=d-b,t=Math.max(0,Math.min(1,((x-a)*dx+(y-b)*dy)/(dx*dx+dy*dy||1))),q=[s.a[0]+(s.b[0]-s.a[0])*t,wrapNear(s.a[1])+(wrapNear(s.b[1])-wrapNear(s.a[1]))*t];return {s,t,p:q,d:distance(p,q)};};
    const nodes=new Map(),segments=[],ends=new Map(),seen=new Set(),parent=new Map(),nodeLimit=rail?180000:60000;
    const find=k=>{let p=k;while(parent.get(p)!==p)p=parent.get(p);while(k!==p){const next=parent.get(k);parent.set(k,p);k=next;}return p;};
    const union=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent.set(b,a);};
    function mode(tags){
      if(tags.area==='yes'||tags.disused==='yes'||tags.abandoned==='yes')return 0;
      if(rail){
        if(!/^(rail|light_rail|narrow_gauge|subway)$/.test(tags.railway||'')||tags.passenger==='no'||tags['railway:traffic_mode']==='freight'||/^(industrial|military|test)$/.test(tags.usage||''))return 0;
        const passenger=/^(train|subway|light_rail)$/.test(tags.route||'')||tags.passenger==='yes'||/^(passenger|mixed)$/.test(tags['railway:traffic_mode']||'');
        if(['no','private'].includes(tags.access)&&!passenger||/^(yard|spur)$/.test(tags.service||'')&&!passenger)return 0;
        // OSM sidings include passenger passing loops and platform tracks.
        return tags.service==='siding'?1.12:/^(yard|spur)$/.test(tags.service||'')?1.5:1;
      }
      if(['no','private'].includes(tags.access))return 0;
      if(marine)return tags.route==='ferry'?1:options.ferryOnly?0:tags['seamark:type']==='recommended_track'||tags.waterway==='fairway'?1.2:0;
      const allowed=type==='walk'?/^(footway|path|pedestrian|steps|living_street|residential|service|unclassified|tertiary|secondary|primary|track)$/:/^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|road|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$/;
      return allowed.test(tags.highway||'')&&!['no','private'].includes(tags[type==='walk'?'foot':'motor_vehicle'])?1:0;
    }
    const coordinateKey=p=>p.map(v=>v.toFixed(rail?7:6)).join(','),knownNodes=new Map(),passengerWays=new Set();
    if(rail){
      for(const element of elements)if(/^(train|subway|light_rail)$/.test(element?.tags?.route||''))for(const member of element.members||[])if(member?.type==='way'&&!/(platform|stop)/.test(member.role||''))passengerWays.add(member.ref);
      for(const way of elements)if(way?.type==='way'&&mode({...way.tags,...(passengerWays.has(way.id)?{route:'train'}:{})}))for(let i=0;i<(way.geometry?.length||0);i++){
        const p=way.geometry[i],id=way.nodes?.[i];if(!point(p)||id==null)continue;const key=coordinateKey([p.lat,p.lon]);if(!knownNodes.has(key))knownNodes.set(key,new Set());knownNodes.get(key).add('n:'+id);
      }
    }
    function addWay(way,inherited={}){
      if(!way||nodes.size>nodeLimit||segments.length>nodeLimit)return;
      const tags={...inherited,...way.tags},factor=mode(tags),id=way.id??way.ref;
      if(!factor||!Array.isArray(way.geometry)||way.geometry.length<2||way.geometry.length>nodeLimit||id!=null&&seen.has(id))return;
      if(id!=null)seen.add(id);
      const layer=String(tags.layer||'0'),key=(p,i)=>{
        if(way.nodes?.[i]!=null)return 'n:'+way.nodes[i];
        // Relation geom omits node IDs. Alias only unambiguous known vertices;
        // never merge two different OSM nodes at a grade-separated crossing.
        const coordinate=coordinateKey(p),known=rail&&knownNodes.get(coordinate);
        return known?.size===1?[...known][0]:coordinate+':'+layer;
      };
      const direction=road&&type!=='walk'?(tags.oneway==='-1'?-1:/^(yes|1|true)$/.test(tags.oneway||'')||tags.junction==='roundabout'?1:0):0;
      let previous=null,first=null,last=null;
      const finish=()=>{if(first&&last&&first.k!==last.k){ends.set(first.k,{...first,layer,tags});ends.set(last.k,{...last,layer,tags});}first=last=null;};
      for(let i=0;i<way.geometry.length&&nodes.size<=nodeLimit&&segments.length<=nodeLimit;i++){
        const value=way.geometry[i];if(!point(value)){finish();previous=null;continue;}
        const p=[value.lat,value.lon],k=key(p,i);if(!nodes.has(k)){nodes.set(k,p);parent.set(k,k);}
        if(previous&&previous.k!==k){const length=distance(previous.p,p);if(length>.01){const s={a:previous.p,b:p,ka:previous.k,kb:k,length,factor,layer,tags,direction,way:id??way,cuts:[]};segments.push(s);union(previous.k,k);if(!first)first={...previous,tangent:[p[0]-previous.p[0],wrapNear(p[1])-wrapNear(previous.p[1])]};last={k,p,tangent:[previous.p[0]-p[0],wrapNear(previous.p[1])-wrapNear(p[1])]};}}
        previous={k,p};
      }finish();
    }
    // Prefer full ways with node IDs and tags over duplicate relation members.
    for(const element of elements)if(element?.type==='way')addWay(element,rail&&passengerWays.has(element.id)?{route:'train'}:{});
    const fullWays=rail?new Map(elements.filter(e=>e?.type==='way').map(e=>[e.id,e])):null;
    for(const element of elements)if(element?.type==='relation'||element?.members)for(const member of element.members||[])if((member.type==='way'||member.geometry)&&!/(platform|stop)/.test(member.role||'')){
      const known=fullWays?.get(member.ref);addWay(known?{...member,tags:{...known.tags,...member.tags}}:member,{route:element.tags?.route,railway:/^(train|railway)$/.test(element.tags?.route||'')?'rail':undefined});
    }
    if(!segments.length||nodes.size>nodeLimit||segments.length>nodeLimit||expired())return null;
    const graph=new Map(),add=(a,b,coords,kind,factor=1)=>{const length=coords.slice(1).reduce((n,p,i)=>n+distance(coords[i],p),0);if(!graph.has(a))graph.set(a,[]);graph.get(a).push({to:b,coords,length,kind,cost:length*factor});};
    let serial=0;const cut=c=>{if(c.t<1e-7)return c.s.ka;if(c.t>1-1e-7)return c.s.kb;const old=c.s.cuts.find(v=>Math.abs(v.t-c.t)<1e-7);if(old)return old.k;const k='j:'+(serial++);nodes.set(k,c.p);c.s.cuts.push({...c,k});return k;};
    function attachments(p){
      const candidatesByWay=new Map();for(const s of segments){const c=project(p,s);if(c.d>snapLimit)continue;const k=s.way,list=candidatesByWay.get(k)||[];list.push(c);list.sort((a,b)=>a.d-b.d);if(list.length>2)list.pop();candidatesByWay.set(k,list);}
      const candidates=[...candidatesByWay.values()].map(list=>list[0]).sort((a,b)=>a.d-b.d);
      if(!rail)return candidates.slice(0,32);
      // Dense station approaches must not crowd a more distant connected line
      // out of the candidate list with dozens of ways from one isolated yard.
      const counts=new Map();return candidates.filter(c=>{const k=find(c.s.ka),n=counts.get(k)||0;counts.set(k,n+1);return n<8;}).slice(0,96);
    }
    const starts=attachments(from),finishes=attachments(to);if(!starts.length||!finishes.length||expired())return null;
    const joins=[];for(const [kind,p,list]of [['start',from,starts],['end',to,finishes]])for(const c of list)joins.push({kind,p,c,k:cut(c)});
    // Index segment bounds to keep gap matching local even on a large railway graph.
    const grid=new Map(),cell=gapLimit;let entries=0;
    for(const s of (rail&&options.skipGaps?[]:segments)){const a=xy(s.a),b=xy(s.b),lowX=Math.floor(Math.min(a[0],b[0])/cell),highX=Math.floor(Math.max(a[0],b[0])/cell),lowY=Math.floor(Math.min(a[1],b[1])/cell),highY=Math.floor(Math.max(a[1],b[1])/cell);if((highX-lowX+1)*(highY-lowY+1)>2000)continue;
      for(let x=lowX;x<=highX;x++)for(let y=lowY;y<=highY;y++){const k=x+','+y;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(s);if(++entries>200000)return null;}
    }
    const bridges=[],bridgeKeys=new Set();let checked=0;
    const neighbours=new Map();if(rail&&!options.skipGaps)for(const s of segments)for(const [a,b]of [[s.ka,s.kb],[s.kb,s.ka]]){if(!neighbours.has(a))neighbours.set(a,new Set());neighbours.get(a).add(b);}
    const endpoints=rail?[...ends.values()].filter(p=>!options.skipGaps&&neighbours.get(p.k)?.size===1):[...ends.values()];
    for(const endpoint of endpoints.slice(0,rail?6000:2000)){
      if(++checked%50===0){if(expired())return null;await new Promise(r=>setTimeout(r,0));}
      const [x,y]=xy(endpoint.p),near=new Set();for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const s of grid.get((Math.floor(x/cell)+dx)+','+(Math.floor(y/cell)+dy))||[])near.add(s);
      const candidates=[];for(const s of near){if(find(endpoint.k)===find(s.ka)||s.layer!==endpoint.layer)continue;let c=project(endpoint.p,s);if(c.d<.1||c.d>gapLimit)continue;
        if(rail&&c.t>1e-7&&c.t<1-1e-7){
          // A missing switch joins ahead of the truncated track. The nearest
          // perpendicular projection can make that connection turn sideways.
          const p=xy(endpoint.p),a=xy(s.a),b=xy(s.b),v=[-endpoint.tangent[1]*xScale,-endpoint.tangent[0]*111320],w=[b[0]-a[0],b[1]-a[1]],cross=(u,v)=>u[0]*v[1]-u[1]*v[0],den=cross(v,w);
          if(Math.abs(den)>1e-8){const delta=[a[0]-p[0],a[1]-p[1]],forward=cross(delta,w)/den,t=cross(delta,v)/den;if(forward>=0&&t>=0&&t<=1){const q=[s.a[0]+(s.b[0]-s.a[0])*t,wrapNear(s.a[1])+(wrapNear(s.b[1])-wrapNear(s.a[1]))*t],d=distance(endpoint.p,q);if(d<=Math.min(250,gapLimit))c={s,t,p:q,d};}}
        }
        if(!marine){const v=xy(endpoint.p),q=xy(c.p),t=[endpoint.tangent[1]*xScale,endpoint.tangent[0]*111320],alignment=-(t[0]*(q[0]-v[0])+t[1]*(q[1]-v[1]))/(Math.hypot(...t)*Math.hypot(q[0]-v[0],q[1]-v[1])||1),interior=c.t>1e-7&&c.t<1-1e-7;
          if(c.d>25&&alignment<.7||interior&&(!rail||c.d>250))continue;
          if(rail){const a=endpoint.tags,b=s.tags,compatible=a.railway===b.railway&&(!a.gauge||!b.gauge||a.gauge.split(';').some(g=>b.gauge.split(';').includes(g)));if(!compatible)continue;
            const u=xy(s.a),w=xy(s.b),parallel=Math.abs(t[0]*(w[0]-u[0])+t[1]*(w[1]-u[1]))/(Math.hypot(...t)*Math.hypot(w[0]-u[0],w[1]-u[1])||1);if(c.d>25&&parallel<.7)continue;
          }
        }
        candidates.push(c);
      }
      candidates.sort((a,b)=>a.d-b.d);for(const c of candidates.slice(0,3)){const k=cut(c),pair=[endpoint.k,k].sort().join('|');if(bridgeKeys.has(pair))continue;bridgeKeys.add(pair);bridges.push({a:endpoint.k,b:k,coords:[endpoint.p,c.p]});if(bridges.length>=512)break;}if(bridges.length>=512)break;
    }
    for(const s of segments){const cuts=[{t:0,k:s.ka,p:s.a},...s.cuts.sort((a,b)=>a.t-b.t),{t:1,k:s.kb,p:s.b}];for(let i=1;i<cuts.length;i++){const a=cuts[i-1],b=cuts[i];if(s.direction!==-1)add(a.k,b.k,[a.p,b.p],'network',s.factor);if(s.direction!==1)add(b.k,a.k,[b.p,a.p],'network',s.factor);}}
    const connection=async(coords,limit,terminal=false)=>{
      if(!marine||waterSegment(coords[0],coords[1],mask))return coords;
      if(coords.some(p=>mask.land(...p)))return terminal?coords:null;
      if(expired())return null;
      const route=await waterPath({lat:coords[0][0],lon:coords[0][1]},{lat:coords[1][0],lon:coords[1][1]},mask,{signal,maxMs:Math.min(350,budget-(clock()-began)),maxSnapKm:limit/1000});
      if(!route)return null;const length=route.slice(1).reduce((n,p,i)=>n+distance(route[i],p),0);return length<=limit&&length<=distance(...coords)*2+500?route:null;
    };
    for(const bridge of bridges){const coords=await connection(bridge.coords,gapLimit);if(coords){add(bridge.a,bridge.b,coords,'gap',4);add(bridge.b,bridge.a,[...coords].reverse(),'gap',4);}}
    for(const j of joins){const coords=await connection(j.kind==='start'?[j.p,j.c.p]:[j.c.p,j.p],snapLimit,true);if(!coords)continue;if(j.kind==='start')add('start',j.k,coords,'connector',rail?8:4);else add(j.k,'end',coords,'connector',rail?8:4);}
    if(!graph.has('start')||expired())return null;
    const costs=new Map([['start',0]]),previous=new Map(),queue=[[0,'start']];
    const push=v=>{queue.push(v);let i=queue.length-1;while(i){const p=(i-1)>>1;if(queue[p][0]<=v[0])break;queue[i]=queue[p];i=p;}queue[i]=v;};
    const pop=()=>{const v=queue[0],tail=queue.pop();if(queue.length){let i=0;while(i*2+1<queue.length){let j=i*2+1;if(j+1<queue.length&&queue[j+1][0]<queue[j][0])j++;if(queue[j][0]>=tail[0])break;queue[i]=queue[j];i=j;}queue[i]=tail;}return v;};
    let visits=0;while(queue.length){const [cost,k]=pop();if(cost!==costs.get(k))continue;if(k==='end')break;if(++visits%500===0){if(expired())return null;await new Promise(r=>setTimeout(r,0));}for(const edge of graph.get(k)||[])if(cost+edge.cost<(costs.get(edge.to)??Infinity)){costs.set(edge.to,cost+edge.cost);previous.set(edge.to,{from:k,edge});push([cost+edge.cost,edge.to]);}}
    if(!previous.has('end')||expired())return null;
    const edges=[];for(let k='end';k!=='start';){const p=previous.get(k);if(!p)return null;edges.push(p.edge);k=p.from;}edges.reverse();
    const lengths={network:0,gap:0,connector:0},coordinates=[];for(const edge of edges){lengths[edge.kind]+=edge.length;for(const p of edge.coords)if(!coordinates.length||distance(coordinates.at(-1),p)>.01)coordinates.push(p);}
    const total=lengths.network+lengths.gap+lengths.connector,detour=marine?1.7:rail?3.5:2.2;
    if(lengths.network<direct*.45||lengths.network<total*.55||lengths.connector>(rail?Math.min(20000,Math.max(1800,direct*.2+1500)):Math.max(1800,direct*.28))||lengths.gap>Math.max(300,direct*(marine?.2:.06))||total>direct*detour+(rail?3000:1500))return null;
    if(marine){
      // Recorded city stops may sit on shore. Keep their markers, but start/end
      // the fallback line at water rather than drawing an overland boat leg.
      const trim=coords=>{let i=0;while(i<coords.length&&mask.land(...coords[i]))i++;if(i===coords.length)return [];if(i){const a=coords[i-1],b=coords[i],n=Math.max(1,Math.ceil(distance(a,b)/100));let p=b;for(let j=1;j<=n;j++){const q=a.map((v,k)=>v+(b[k]-v)*j/n);if(!mask.land(...q)){p=q;break;}}return [p,...coords.slice(i)];}return coords;};
      let safe=trim(coordinates);safe=trim(safe.reverse()).reverse();if(safe.length<2)return null;
      for(let i=1;i<safe.length;i++)if(!waterSegment(safe[i-1],safe[i],mask))return null;
      return safe;
    }
    return coordinates;
  }
  function networkQuery(type,start,end,options={}){
    if(!point(start)||!point(end)||!['boat','train','car','bus','walk'].includes(type))return null;
    const metres=distance([start.lat,start.lon],[end.lat,end.lon]);if(metres>2500000||Math.abs(start.lon-end.lon)>180)return null;
    if(type==='train'){
      const filter='[railway~"^(rail|light_rail|narrow_gauge|subway)$"][usage!~"^(industrial|military|test)$"]["railway:traffic_mode"!="freight"][passenger!="no"]',radius=Math.round(Math.min(options.expanded?80000:45000,Math.max(options.expanded?12000:5000,metres*(options.expanded?.6:.3)))),area=`(around:${radius},${start.lat},${start.lon},${end.lat},${end.lon})`;
      if(!options.expanded)return `[out:json][timeout:10][maxsize:33554432];way${area}${filter};out body geom;`;
      // The second lookup includes infrastructure/service ways from both ends.
      // They may curve beyond the direct corridor or belong to different services.
      const dy=radius/111320,dx=dy/Math.max(.2,Math.cos((start.lat+end.lat)*Math.PI/360)),bounds=[Math.max(-90,Math.min(start.lat,end.lat)-dy),Math.max(-180,Math.min(start.lon,end.lon)-dx),Math.min(90,Math.max(start.lat,end.lat)+dy),Math.min(180,Math.max(start.lon,end.lon)+dx)].map(v=>v.toFixed(6)).join(','),routes='[route~"^(train|railway|tracks|subway|light_rail)$"]';
      return `[out:json][timeout:12][maxsize:33554432];(rel(around:5000,${start.lat},${start.lon})${routes};rel(around:5000,${end.lat},${end.lon})${routes};)->.lines;(way${area}${filter};way(r.lines)(${bounds})${filter};);out body geom;.lines out body;`;
    }
    const radius=Math.round(Math.min(type==='boat'?35000:25000,Math.max(type==='boat'?6000:3000,metres*.2))),area=`(around:${radius},${start.lat},${start.lon},${end.lat},${end.lon})`;
    const filters=type==='boat'?['[route=ferry]','["seamark:type"=recommended_track]','[waterway=fairway]']:type==='train'?['[railway~"^(rail|light_rail|narrow_gauge|subway)$"]']:['[highway]'];
    return `[out:json][timeout:10][maxsize:16777216];(${filters.map(f=>'way'+area+f+';').join('')});out body geom;`;
  }
  const waterNames=new Set(['boat','ferry','cruise','water','water taxi','watertaxi','speedboat','passenger vessel','vessel','ship','sailboat','yacht','water transport','marine']);
  function isWater(type,record={}){const name=v=>String(v||'').toLowerCase().replace(/[-_]+/g,' ').trim();return record.waterTransport===true||[type,record.transportMode,record.mode,record.transportCategory].some(v=>waterNames.has(name(v)));}
  const wrap=lon=>((lon+180)%360+360)%360-180;
  function landMask(data){
    if(data?.schema!==1||!Array.isArray(data.polygons)||data.polygons.length>10000)throw Error('Invalid coastline data');
    let points=0;const polygons=data.polygons.map(rings=>{
      if(!Array.isArray(rings))throw Error('Invalid polygon');const rows=new Map(),bounds=[Infinity,Infinity,-Infinity,-Infinity];
      for(const ring of rings){if(!Array.isArray(ring)||ring.length<4)throw Error('Invalid coastline ring');points+=ring.length;if(points>200000)throw Error('Coastline limit exceeded');for(let i=1;i<ring.length;i++){
        const a=ring[i-1],b=ring[i];if(!a.every(Number.isFinite)||!b.every(Number.isFinite)||Math.abs(a[0])>180||Math.abs(a[1])>90)throw Error('Invalid coastline point');
        bounds[0]=Math.min(bounds[0],a[0],b[0]);bounds[1]=Math.min(bounds[1],a[1],b[1]);bounds[2]=Math.max(bounds[2],a[0],b[0]);bounds[3]=Math.max(bounds[3],a[1],b[1]);
        const edge=[a,b];for(let row=Math.floor(Math.min(a[1],b[1]));row<=Math.floor(Math.max(a[1],b[1]));row++){if(!rows.has(row))rows.set(row,[]);rows.get(row).push(edge);}
      }}return {bounds,rows};
    });
    const index=new Map();for(const polygon of polygons){const b=polygon.bounds;for(let y=Math.floor(b[1]);y<=Math.floor(b[3]);y++)for(let x=Math.floor(b[0]/4);x<=Math.floor(b[2]/4);x++){const key=x+','+y;if(!index.has(key))index.set(key,[]);index.get(key).push(polygon);}}
    function land(lat,lon){lon=wrap(lon);const candidates=index.get(Math.floor(lon/4)+','+Math.floor(lat))||[];for(const p of candidates){const b=p.bounds;if(lon<b[0]||lon>b[2]||lat<b[1]||lat>b[3])continue;let inside=false;for(const [a,c]of p.rows.get(Math.floor(lat))||[]){if((a[1]>lat)!==(c[1]>lat)&&lon<(c[0]-a[0])*(lat-a[1])/(c[1]-a[1])+a[0])inside=!inside;}if(inside)return true;}return false;}
    function crosses(a,b){
      const x=wrap(a[1]),y=wrap(b[1]);if(Math.abs(x-y)>180){const end=y+(y>x?-360:360),boundary=end>x?180:-180,t=(boundary-x)/(end-x),lat=a[0]+(b[0]-a[0])*t;return crosses([a[0],x],[lat,boundary-Math.sign(boundary)*1e-8])||crosses([lat,-boundary+Math.sign(boundary)*1e-8],[b[0],y]);}
      const lowX=Math.min(x,y),highX=Math.max(x,y),lowY=Math.min(a[0],b[0]),highY=Math.max(a[0],b[0]),candidates=new Set(),p=[x,a[0]],q=[y,b[0]];
      for(let row=Math.floor(lowY);row<=Math.floor(highY);row++)for(let col=Math.floor(lowX/4);col<=Math.floor(highX/4);col++)for(const polygon of index.get(col+','+row)||[])candidates.add(polygon);
      const side=(u,v,w)=>(v[0]-u[0])*(w[1]-u[1])-(v[1]-u[1])*(w[0]-u[0]),on=(u,v,w)=>w[0]>=Math.min(u[0],v[0])-1e-10&&w[0]<=Math.max(u[0],v[0])+1e-10&&w[1]>=Math.min(u[1],v[1])-1e-10&&w[1]<=Math.max(u[1],v[1])+1e-10;
      for(const polygon of candidates){const bounds=polygon.bounds;if(bounds[0]>highX||bounds[2]<lowX||bounds[1]>highY||bounds[3]<lowY)continue;const edges=new Set();for(let row=Math.floor(lowY);row<=Math.floor(highY);row++)for(const edge of polygon.rows.get(row)||[])edges.add(edge);
        for(const [u,v]of edges){if(Math.max(u[0],v[0])<lowX||Math.min(u[0],v[0])>highX||Math.max(u[1],v[1])<lowY||Math.min(u[1],v[1])>highY)continue;const s1=side(p,q,u),s2=side(p,q,v),s3=side(u,v,p),s4=side(u,v,q);if(s1*s2<0&&s3*s4<0||Math.abs(s1)<1e-10&&on(p,q,u)||Math.abs(s2)<1e-10&&on(p,q,v)||Math.abs(s3)<1e-10&&on(u,v,p)||Math.abs(s4)<1e-10&&on(u,v,q))return true;}
      }return false;
    }
    return {land,crosses};
  }
  function waterSegment(a,b,mask,spacing=.4,clearance=0){
    if(mask.crosses?.(a,b))return false;
    const n=Math.max(1,Math.ceil(distance(a,b)/(spacing*1000)));for(let i=0;i<=n;i++){const t=i/n,lat=a[0]+(b[0]-a[0])*t,lon=a[1]+(b[1]-a[1])*t;if(mask.land(lat,lon))return false;if(clearance){const dy=clearance/111.32,dx=dy/Math.cos(lat*Math.PI/180);if([[dy,0],[-dy,0],[0,dx],[0,-dx]].some(p=>mask.land(lat+p[0],lon+p[1])))return false;}}return true;
  }
  async function waterPath(start,end,mask,options={}){
    if(!point(start)||!point(end)||!mask?.land||options.signal?.aborted)return null;
    const clock=()=>root.performance?.now?.()??Date.now(),began=clock(),budget=options.maxMs??2500,limit=options.maxNodes??40000,signal=options.signal;
    const a=[start.lat,start.lon],b=[end.lat,end.lon];while(b[1]-a[1]>180)b[1]-=360;while(b[1]-a[1]<-180)b[1]+=360;
    const km=distance(a,b)/1000;if(km<.01)return options.waterOnly&&!waterSegment(a,b,mask)?null:[a,b];if(Math.max(Math.abs(a[0]),Math.abs(b[0]))>80||km>10000)return null;
    const xScale=111.32*Math.cos((a[0]+b[0])*Math.PI/360),yScale=111.32,project=p=>[(p[1]-a[1])*xScale,(p[0]-a[0])*yScale],unproject=p=>[a[0]+p[1]/yScale,a[1]+p[0]/xScale];
    function snap(p){if(!mask.land(...p))return p;for(let radius=.4;radius<=(options.maxSnapKm??12);radius+=.4){let best=null,cost=Infinity;for(let i=0;i<32;i++){const angle=i*Math.PI/16,c=[p[0]+Math.sin(angle)*radius/yScale,p[1]+Math.cos(angle)*radius/xScale];if(!mask.land(...c)){const d=distance(c,p);if(d<cost){best=c;cost=d;}}}if(best)return best;}return null;}
    const from=snap(a),to=snap(b);if(!from||!to)return null;
    if(waterSegment(from,to,mask))return options.waterOnly?[from,to]:[a,...(distance(a,from)>.01?[from]:[]),...(distance(b,to)>.01?[to]:[]),b];
    const fromXY=project(from),toXY=project(to),step=options.stepKm??Math.max(.6,km/140),clearance=Math.min(1.2,step*.45);let path=null,visited=0;
    for(const multiplier of options.multipliers||[1,2,4]){
      if(signal?.aborted||clock()-began>budget||visited>=limit)return null;
      const pad=(options.paddingKm??Math.max(15,km*.3))*multiplier,minX=Math.min(fromXY[0],toXY[0])-pad,minY=Math.min(fromXY[1],toXY[1])-pad,maxX=Math.max(fromXY[0],toXY[0])+pad,maxY=Math.max(fromXY[1],toXY[1])+pad;
      const cols=Math.ceil((maxX-minX)/step)+1,rows=Math.ceil((maxY-minY)/step)+1;if(cols*rows>300000)continue;
      const xy=id=>[minX+(id%cols)*step,minY+Math.floor(id/cols)*step],coord=id=>unproject(xy(id)),idOf=p=>Math.round((p[1]-minY)/step)*cols+Math.round((p[0]-minX)/step),startId=idOf(fromXY),endId=idOf(toXY),passable=new Map(),edges=new Map();
      const pass=id=>{if(!passable.has(id))passable.set(id,!mask.land(...coord(id)));return passable.get(id);};
      function nearestWater(id,p){const around=[];for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const n=id+dy*cols+dx;if(n<0||n>=cols*rows||!pass(n))continue;const c=coord(n);if(waterSegment(p,c,mask))around.push([n,distance(p,c)]);}return around.sort((x,y)=>x[1]-y[1])[0]?.[0];}
      const first=nearestWater(startId,from),last=nearestWater(endId,to);if(first==null||last==null)continue;
      const costs=new Map([[first,0]]),previous=new Map(),queue=[];
      const heuristic=id=>{const p=xy(id),q=xy(last);return Math.hypot(p[0]-q[0],p[1]-q[1]);};
      function push(v){queue.push(v);let i=queue.length-1;while(i){const parent=(i-1)>>1;if(queue[parent][0]<=v[0])break;queue[i]=queue[parent];i=parent;}queue[i]=v;}
      function pop(){const top=queue[0],tail=queue.pop();if(queue.length){let i=0;while(i*2+1<queue.length){let j=i*2+1;if(j+1<queue.length&&queue[j+1][0]<queue[j][0])j++;if(queue[j][0]>=tail[0])break;queue[i]=queue[j];i=j;}queue[i]=tail;}return top;}
      push([heuristic(first),first,0]);let found=false;
      while(queue.length){const [,id,cost]=pop();if(cost!==costs.get(id))continue;if(id===last){found=true;break;}visited++;
        if(visited%200===0){if(signal?.aborted||clock()-began>budget||visited>=limit)return null;await new Promise(r=>setTimeout(r,0));}
        const col=id%cols,row=Math.floor(id/cols),p=coord(id);
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy||col+dx<0||col+dx>=cols||row+dy<0||row+dy>=rows)continue;const n=id+dy*cols+dx;if(!pass(n))continue;const edgeKey=Math.min(id,n)+','+Math.max(id,n);if(!edges.has(edgeKey))edges.set(edgeKey,waterSegment(p,coord(n),mask,Math.min(.4,step/3)));if(!edges.get(edgeKey))continue;
          const c=coord(n),nearCoast=[[clearance/yScale,0],[-clearance/yScale,0],[0,clearance/xScale],[0,-clearance/xScale]].some(v=>mask.land(c[0]+v[0],c[1]+v[1]));
          const next=cost+step*Math.hypot(dx,dy)*(nearCoast?1.8:1);if(next<(costs.get(n)??Infinity)){costs.set(n,next);previous.set(n,id);push([next+heuristic(n),n,next]);}
        }
      }
      if(found){const result=[];for(let id=last;id!=null;id=previous.get(id))result.push(coord(id));path=[from,...result.reverse(),to];break;}
    }
    if(!path)return null;
    // Remove grid zigzags only where the shortcut is still clear of land.
    const simple=[path[0]];let index=0;while(index<path.length-1){let next=path.length-1;while(next>index+1&&!waterSegment(path[index],path[next],mask,.4,.3))next--;simple.push(path[next]);index=next;}
    // Round corners with quadratic curves, then reject any smoothing that cuts land.
    const smooth=[simple[0]];for(let i=1;i<simple.length-1;i++){const prev=simple[i-1],p=simple[i],next=simple[i+1],left=prev.map((v,j)=>p[j]+(v-p[j])*.18),right=next.map((v,j)=>p[j]+(v-p[j])*.18),curve=Array.from({length:9},(_,j)=>{const t=j/8;return p.map((v,k)=>(1-t)**2*left[k]+2*(1-t)*t*v+t*t*right[k]);});
      const candidate=[smooth.at(-1),...curve,next];if(candidate.slice(1).every((c,j)=>waterSegment(candidate[j],c,mask)))smooth.push(...curve);else smooth.push(p);
    }smooth.push(simple.at(-1));
    if(!smooth.slice(1).every((p,i)=>waterSegment(smooth[i],p,mask)))return null;
    return options.waterOnly?smooth:[a,...smooth,b];
  }
  // Ferry-only recovery. Railway routing and its thresholds remain unchanged.
  function safeMarinePath(coordinates,mask){
    if(!Array.isArray(coordinates)||coordinates.length<2||!mask?.land)return null;
    let coords=coordinates.map(p=>[Number(p[0]),Number(p[1])]);
    if(coords.some(p=>!p.every(Number.isFinite)))return null;
    const trim=path=>{
      let i=0;while(i<path.length&&mask.land(...path[i]))i++;
      if(i===path.length)return [];if(!i)return path;
      // Harbour/city markers may be on shore; the line itself starts in water.
      const a=path[i-1],b=path[i],n=Math.max(1,Math.ceil(distance(a,b)/100));
      for(let j=1;j<=n;j++){const p=a.map((v,k)=>v+(b[k]-v)*j/n);if(!mask.land(...p))return[p,...path.slice(i)];}
      return path.slice(i);
    };
    coords=trim(coords);coords=trim(coords.reverse()).reverse();
    return coords.length>=2&&coords.slice(1).every((p,i)=>waterSegment(coords[i],p,mask))?coords:null;
  }
  async function marineWaterPath(start,end,mask,options={}){
    if(!point(start)||!point(end)||!mask?.land||options.signal?.aborted)return null;
    const clock=()=>root.performance?.now?.()??Date.now(),began=clock(),budget=options.maxMs??10000,km=distance([start.lat,start.lon],[end.lat,end.lon])/1000;
    const passes=[{}, {stepKm:Math.max(.2,km/220),maxNodes:100000}, {stepKm:Math.max(.8,km/100),paddingKm:Math.max(60,km*.7),multipliers:[1,2,4],maxNodes:150000}];
    for(const pass of passes){
      const remaining=budget-(clock()-began);if(remaining<=0||options.signal?.aborted)return null;
      const route=await waterPath(start,end,mask,{...pass,signal:options.signal,waterOnly:true,maxSnapKm:options.maxSnapKm??36,maxMs:Math.min(remaining,pass.maxNodes?5000:2500)});
      if(route?.length>=2)return route;
    }
    return null;
  }
  async function marinePath(elements,start,end,mask,options={}){
    const signal=options.signal,clock=()=>root.performance?.now?.()??Date.now(),began=clock(),budget=options.maxMs??8000;
    const baseline=options.baseline||await marineWaterPath(start,end,mask,{signal,maxMs:budget});
    if(!baseline?.length||signal?.aborted)return null;
    const lengths=[0];for(let i=1;i<baseline.length;i++)lengths.push(lengths[i-1]+distance(baseline[i-1],baseline[i]));
    const total=lengths.at(-1),origin=baseline[0],xScale=111320*Math.max(.15,Math.cos(origin[0]*Math.PI/180));
    const nearLon=lon=>origin[1]+((lon-origin[1]+540)%360)-180,xy=p=>[(nearLon(p[1])-origin[1])*xScale,(p[0]-origin[0])*111320];
    const project=(p,a,b)=>{const q=xy(p),u=xy(a),v=xy(b),dx=v[0]-u[0],dy=v[1]-u[1],t=Math.max(0,Math.min(1,((q[0]-u[0])*dx+(q[1]-u[1])*dy)/(dx*dx+dy*dy||1)));return{t,p:[a[0]+(b[0]-a[0])*t,nearLon(a[1])+(nearLon(b[1])-nearLon(a[1]))*t]};};
    const progress=p=>{let best={d:Infinity,along:0};for(let i=1;i<baseline.length;i++){const c=project(p,baseline[i-1],baseline[i]),d=distance(p,c.p);if(d<best.d)best={d,along:lengths[i-1]+(lengths[i]-lengths[i-1])*c.t};}return best;};
    const corridor=Math.min(40000,Math.max(3000,total*.15)),minimum=Math.max(200,total*.002),candidates=[],seen=new Set();
    const marine=tags=>tags?.route==='ferry'||tags?.['seamark:type']==='recommended_track'||tags?.waterway==='fairway';
    const ways=[];for(const e of elements||[]){if(e?.type==='way')ways.push(e);if(e?.members&&marine(e.tags))for(const m of e.members)if(m.type==='way'||m.geometry)ways.push({...m,tags:{...e.tags,...m.tags}});}
    const addRun=(run,ferry)=>{
      if(run.length<2)return;
      // Clip a long marine segment at the recorded terminal projections.
      const nearest=terminal=>{let best={d:Infinity};for(let i=1;i<run.length;i++){const c=project(terminal,run[i-1],run[i]),d=distance(terminal,c.p);if(d<best.d)best={...c,d,at:i-1+c.t};}return best;};
      let departure=nearest(baseline[0]),arrival=nearest(baseline.at(-1));
      if(departure.at>arrival.at){run.reverse();departure=nearest(baseline[0]);arrival=nearest(baseline.at(-1));}
      run=[departure.p,...run.filter((_,i)=>i>departure.at&&i<arrival.at),arrival.p].filter((p,i,list)=>!i||distance(list[i-1],p)>.01);
      if(run.length<2)return;
      let first=progress(run[0]),last=progress(run.at(-1));if(first.along>last.along){run.reverse();[first,last]=[last,first];}
      const visible=run.map(p=>({p,...progress(p)})).filter(p=>p.d<=corridor&&p.along>=first.along&&p.along<=last.along);
      if(visible.length<2)return;
      const a=visible[0],b=visible.at(-1);if(b.along-a.along<minimum)return;
      const coords=run.slice(run.indexOf(a.p),run.indexOf(b.p)+1),length=coords.slice(1).reduce((n,p,i)=>n+distance(coords[i],p),0);
      if(length>(b.along-a.along)*1.8+1500||!safeMarinePath(coords,mask))return;
      candidates.push({coords,first:a.along,last:b.along,ferry});
    };
    for(const way of ways){
      if(clock()-began>budget||signal?.aborted)break;
      if(!marine(way.tags)||way.tags?.area==='yes'||['no','private'].includes(way.tags?.access)||!Array.isArray(way.geometry))continue;
      const id=way.id??way.ref;if(id!=null&&seen.has(id))continue;if(id!=null)seen.add(id);
      let run=[];for(const p of way.geometry){const value=point(p)?[p.lat,p.lon]:null;if(!value||mask.land(...value)||(run.length&&!waterSegment(run.at(-1),value,mask))){addRun(run,way.tags.route==='ferry');run=[];}if(value&&!mask.land(...value))run.push(value);}addRun(run,way.tags.route==='ferry');
    }
    // Prefer forward, substantial mapped sections. Every connector is itself a
    // water route, so an island cannot be crossed to reach a useful fragment.
    candidates.sort((a,b)=>a.first-b.first||Number(b.ferry)-Number(a.ferry)||b.last-a.last);
    let coords=[baseline[0]],along=0,used=0,exitRoute;
    for(const c of candidates.slice(0,24)){
      if(c.first<along-100||c.last<=along+minimum||signal?.aborted||clock()-began>budget)continue;
      const remaining=budget-(clock()-began),a=coords.at(-1),b=c.coords[0],bridge=distance(a,b)<.01?[a]:await marineWaterPath({lat:a[0],lon:a[1]},{lat:b[0],lon:b[1]},mask,{signal,maxMs:Math.min(2500,remaining)});
      if(!bridge)continue;
      const tail=c.coords.at(-1),finish=baseline.at(-1),exit=distance(tail,finish)<.01?[finish]:await marineWaterPath({lat:tail[0],lon:tail[1]},{lat:finish[0],lon:finish[1]},mask,{signal,maxMs:Math.min(2500,budget-(clock()-began))});
      if(!exit)continue;
      const trial=[...coords,...bridge.slice(1),...c.coords.slice(1),...exit.slice(1)],length=trial.slice(1).reduce((n,p,i)=>n+distance(trial[i],p),0);if(length>total*1.8+1500)continue;
      coords=[...coords,...bridge.slice(1),...c.coords.slice(1)];along=c.last;used++;
      exitRoute=exit;
    }
    if(signal?.aborted)return null;
    const coordinates=used?safeMarinePath([...coords,...exitRoute.slice(1)],mask):baseline;
    return{coordinates:coordinates||baseline,partial:used>0};
  }
  const api={point,distance,flightArc,mappedPath,networkPath,networkQuery,isWater,landMask,waterSegment,waterPath,safeMarinePath,marineWaterPath,marinePath};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HVRouteGeometry=api;
})(typeof window!=='undefined'?window:globalThis);
