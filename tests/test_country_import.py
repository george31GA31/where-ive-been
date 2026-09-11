import unittest,runpy,tempfile,json,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
convert=runpy.run_path(str(ROOT/'scripts/import-country-data.py'))['convert']
class ImportTests(unittest.TestCase):
    def test_small_airport_and_shared_site(self):
        with tempfile.TemporaryDirectory() as d:
            f=Path(d)/'airports.csv';f.write_text('id,countryCode,name,type,latitude,longitude\na,GB,Small airfield,small_airport,51,-1\n')
            self.assertEqual(convert('airports',f)[0]['type'],'small_airport')
            f.write_text('id,countryCode,name\n1,"FR,BE",Shared property\n')
            self.assertEqual(convert('unesco',f)[0]['countryCodes'],['FR','BE'])
    def test_invalid_import_does_not_replace_dataset(self):
        with tempfile.TemporaryDirectory() as d:
            f=Path(d)/'bad.csv';out=Path(d)/'existing.json';out.write_text('preserve')
            f.write_text('id,countryCode,name\na,UNKNOWN,Airport\n')
            result=subprocess.run([sys.executable,str(ROOT/'scripts/import-country-data.py'),'airports',str(f),'--output',str(out)],capture_output=True)
            self.assertNotEqual(result.returncode,0);self.assertEqual(out.read_text(),'preserve')
    def test_reference_ids_unique(self):
        for kind in ['buildings','mountains']:
            items=json.loads((ROOT/'data'/f'{kind}.json').read_text())['items']
            self.assertEqual(len(items),251);self.assertEqual(len({r['id'] for r in items}),251)
if __name__=='__main__':unittest.main()
