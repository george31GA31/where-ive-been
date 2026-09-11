#!/usr/bin/env python3
"""Validate and upsert a complete dataset from XLSX, CSV or UNESCO XML.
No user/account state is read or modified. Errors abort before writing.
"""
import argparse, csv, json, math, re, unicodedata, xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def norm(s): return ''.join(c for c in unicodedata.normalize('NFKD',str(s).lower()) if c.isalnum())
COUNTRIES=json.loads(re.search(r'const COUNTRIES = (.*?);',(ROOT/'app-core.js').read_text()).group(1))
NAMES={norm(c['name']):c['code'] for c in COUNTRIES}
ALIASES={'British Virgin Islands':'VG','Cape Verde':'CV','Czech Republic':'CZ','Democratic Republic of the Congo':'CD','The Democratic Republic of Congo':'CD','Falkland Islands':'FK','Federated States of Micronesia':'FM','French Southern and Antarctic Lands':'TF','Ivory Coast':'CI','Macau':'MO','Pitcairn Islands':'PN','Saint Martin':'MF','Sint Maarten':'SX','Turkey':'TR','United States Virgin Islands':'VI','Vatican City':'VA','Vetican City':'VA','East Timor':'TL','Fiji Islands':'FJ','Saint Helena':'SH'}
NAMES.update({norm(k):v for k,v in ALIASES.items()})
NAMES.update({norm(c['code']):c['code'] for c in COUNTRIES})
def code(value):
    if norm(value) not in NAMES: raise ValueError('Unknown country: '+str(value))
    return NAMES[norm(value)]
def rows(path):
    if path.suffix.lower()=='.xlsx':
        import openpyxl
        workbook=openpyxl.load_workbook(path,read_only=True,data_only=True)
        data=list(workbook.active.values); workbook.close()
        return [dict(zip(data[0],r)) for r in data[1:] if any(v is not None for v in r)]
    if path.suffix.lower()=='.xml':
        return [{c.tag:c.text for c in row} for row in ET.parse(path).getroot()]
    with path.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def convert(kind,source):
    out=[]
    for index,raw in enumerate(rows(source),2):
        r={norm(k):v for k,v in raw.items() if k is not None}
        def get(*keys):return next((r[norm(k)] for k in keys if r.get(norm(k)) not in (None,'')),None)
        try:
            country_value=str(get('countryCode','iso_country','iso_code','country'))
            codes=[code(country_value)] if norm(country_value) in NAMES else [code(c.strip()) for c in country_value.split(',')]
            name=str(get('name','Tallest Point Name','airport name','site','site_name') or '').strip()
            if not name:raise ValueError('Name is required')
            id=str(get('id','id_no','ident') or (codes[0] if kind in ('buildings','mountains') else ''))
            if not id:raise ValueError('A stable ID is required')
            item={'id':kind+':'+id,'countryCodes':codes,'name':name}
            if kind in ('buildings','mountains'):
                item['heightMeters']=float(get('heightMeters','Height Meters'))
                if not math.isfinite(item['heightMeters']) or item['heightMeters']<0:raise ValueError('Height cannot be negative')
            for field,aliases in {'lat':['latitude','latitude_deg'],'lon':['longitude','longitude_deg'],'iata':['iata_code'],'icao':['icao_code'],'timezone':['time_zone'],'city':['municipality'],'type':[],'url':['http_url']}.items():
                value=get(field,*aliases)
                if value is not None:item[field]=float(value) if field in ('lat','lon') else str(value)
            if ('lat' in item)!=('lon' in item):raise ValueError('Both coordinates are required together')
            if 'lat' in item and (not math.isfinite(item['lat']) or not math.isfinite(item['lon']) or abs(item['lat'])>90 or abs(item['lon'])>180):raise ValueError('Invalid coordinates')
            if kind=='unesco':item['url']='https://whc.unesco.org/en/list/'+id+'/'
            out.append(item)
        except (ValueError,TypeError) as e:raise ValueError(f'Row {index}: {e}') from e
    ids=[r['id'] for r in out]
    if len(ids)!=len(set(ids)):raise ValueError('Duplicate IDs: use one row per item; comma-separated country codes for shared UNESCO sites')
    return out
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('category',choices=['buildings','mountains','unesco','airports']);parser.add_argument('file',type=Path)
    parser.add_argument('--output',type=Path);parser.add_argument('--source',default='User supplied dataset')
    args=parser.parse_args();items=convert(args.category,args.file)
    destination=args.output or ROOT/'data'/f'{args.category}.json'
    destination.write_text(json.dumps({'version':1,'source':args.source,'items':items},ensure_ascii=False,indent=2)+'\n')
    print(f'Validated {len(items)} {args.category} records -> {destination}')
