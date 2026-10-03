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
  function mappedPath(elements,start,end){
    // Follow connected OSM route geometry; never bridge gaps with invented track.
    const graph=new Map(),coords=new Map(),key=p=>p.map(v=>v.toFixed(6)).join(',');
    for(const element of elements||[])for(const way of element.members||[]){const geometry=(way.geometry||[]).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)).map(p=>[p.lat,p.lon]);for(let i=1;i<geometry.length;i++){
      const a=geometry[i-1],b=geometry[i],ka=key(a),kb=key(b),d=distance(a,b);coords.set(ka,a);coords.set(kb,b);if(!graph.has(ka))graph.set(ka,[]);if(!graph.has(kb))graph.set(kb,[]);graph.get(ka).push([kb,d]);graph.get(kb).push([ka,d]);
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
    const km=distance(a,b)/1000;if(km<.01)return [a,b];if(Math.max(Math.abs(a[0]),Math.abs(b[0]))>80||km>10000)return null;
    const xScale=111.32*Math.cos((a[0]+b[0])*Math.PI/360),yScale=111.32,project=p=>[(p[1]-a[1])*xScale,(p[0]-a[0])*yScale],unproject=p=>[a[0]+p[1]/yScale,a[1]+p[0]/xScale];
    function snap(p){if(!mask.land(...p))return p;for(let radius=.4;radius<=12;radius+=.4){let best=null,cost=Infinity;for(let i=0;i<32;i++){const angle=i*Math.PI/16,c=[p[0]+Math.sin(angle)*radius/yScale,p[1]+Math.cos(angle)*radius/xScale];if(!mask.land(...c)){const d=distance(c,p);if(d<cost){best=c;cost=d;}}}if(best)return best;}return null;}
    const from=snap(a),to=snap(b);if(!from||!to)return null;
    if(waterSegment(from,to,mask))return [a,...(distance(a,from)>.01?[from]:[]),...(distance(b,to)>.01?[to]:[]),b];
    const fromXY=project(from),toXY=project(to),step=Math.max(.6,km/140),clearance=Math.min(1.2,step*.45);let path=null,visited=0;
    for(const multiplier of [1,2,4]){
      if(signal?.aborted||clock()-began>budget||visited>=limit)return null;
      const pad=Math.max(15,km*.3)*multiplier,minX=Math.min(fromXY[0],toXY[0])-pad,minY=Math.min(fromXY[1],toXY[1])-pad,maxX=Math.max(fromXY[0],toXY[0])+pad,maxY=Math.max(fromXY[1],toXY[1])+pad;
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
    return [a,...smooth,b];
  }
  const api={point,distance,flightArc,mappedPath,isWater,landMask,waterSegment,waterPath};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HVRouteGeometry=api;
})(typeof window!=='undefined'?window:globalThis);
