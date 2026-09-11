"""Build flag URLs from real asset filenames, never from guessed display names.

Run after copying SlapsGame assets. Existing internet-sourced extras stay local.
This updates presentation assets only, not application or storage code.
"""
from pathlib import Path
import json
import re
import unicodedata


def normalized(value):
    text = unicodedata.normalize('NFD', value)
    return re.sub('[^a-z0-9]', '', text.encode('ascii', 'ignore').decode().lower())


core = Path('app-core.js').read_text(encoding='utf-8')
countries = json.loads(re.search(r'const COUNTRIES = (.*?);', core).group(1))
aliases = dict(re.findall(r"(\w+):'([^']+)'", re.search(r'const SLAPS_FLAG_NAME_ALIASES=(.*?);', core).group(1)))
aliases['SL'] = 'Sierre Leone'  # Spelling in the source artwork filename.
files = {normalized(p.stem): p.as_posix() for p in Path('assets/flags').glob('*.png')}
manifest = {}
extras = {}
for country in countries:
    code = country['code']
    if code == 'SEA':
        continue
    file = files.get(normalized(aliases.get(code, country['name'])))
    if file:
        manifest[code] = file
    else:
        candidates = list(Path('assets/flags-extra').glob(f'{code}.*'))
        if len(candidates) != 1:
            raise SystemExit(f'Missing flag: {code} {country["name"]}')
        extras[code] = candidates[0].as_posix()
manifest.update(extras)
Path('assets/flag-manifest.js').write_text('// Verified filenames, keyed by stable tracker country codes.\nwindow.HVFlagAssets = ' + json.dumps(manifest, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')

# Fix the source list's four stale filenames too, for compatibility consumers.
source = Path('assets/slaps-countries.js')
text = source.read_text(encoding='utf-8')
for name in ['American Samoa', 'Antigua and Barbuda', 'Bosnia and Herzegovina', 'Burkina Faso']:
    text = text.replace(name.replace(' ', '') + '.png', name + '.png')
source.write_text(text, encoding='utf-8')
print(f'Validated {len(manifest)} flags: {len(manifest)-len(extras)} SlapsGame, {len(extras)} internet-sourced extras.')
