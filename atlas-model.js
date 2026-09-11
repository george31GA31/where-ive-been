/* Read-only presentation helpers. No storage, network or account writes.
   Geographic grouping: Russia in Europe; Turkey, Cyprus and the Caucasus in Asia.
   Regional completion follows the user's existing country-count definition. */
(() => {
  const groups={
    Europe:'AL AD AT BY BE BA BG HR CZ DK EE FI FR DE GR HU IS IE IT LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH UA GB VA XK AX FO GG GI IM JE SJ',
    Asia:'AF AM AZ BH BD BT BN KH CN CY GE IN ID IR IQ IL JP JO KZ KW KG LA LB MY MV MN MM NP KP OM PK PS PH QA SA SG KR LK SY TW TJ TH TL TR TM AE UZ VN YE HK MO',
    Africa:'DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG ZM ZW EH YT RE SH',
    'North America':'AG BS BB BZ CA CR CU DM DO SV GD GT HT HN JM MX NI PA KN LC VC TT US AI AW BM BQ VG KY CW GL GP MQ MS PR BL MF SX TC VI',
    'South America':'AR BO BR CL CO EC GY PY PE SR UY VE GF FK',
    Oceania:'AU FJ KI MH FM NR NZ PW PG WS SB TO TV VU AS CK PF GU NC NU NF MP PN TK WF BOU',
    Antarctica:'AQ BV GS HM TF'
  };
  const regionByCode=new Map(Object.entries(groups).flatMap(([region,codes])=>codes.split(' ').map(code=>[code,region])));
  window.HVAtlas={
    region(code){return regionByCode.get(code)||'Other locations';},
    progress(universe,codes){return Object.keys(groups).map(name=>{const all=universe.filter(c=>regionByCode.get(c.code)===name);return {name,total:all.length,visited:all.filter(c=>codes.has(c.code)).length};});}
  };
})();
