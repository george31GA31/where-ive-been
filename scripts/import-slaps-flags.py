from pathlib import Path
import re


def replace_once(text, pattern, replacement, label):
    updated, count = re.subn(pattern, lambda _: replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"Could not locate {label}")
    return updated


core_path = Path("app-core.js")
core = core_path.read_text(encoding="utf-8")
core_pattern = (
    r"function flag\(c\)\{.*?\}\n"
    r"function flagUrl\(c,w=80\)\{.*?\}\n"
    r"function flagHtml\(c,cls='flag-img'\)\{.*?\}\n"
    r"function countryByName"
)
core_replacement = '''function flag(c){return c?[...c.toUpperCase()].map(x=>String.fromCodePoint(127397+x.charCodeAt())).join(''):''}
function legacyFlagUrl(c,w=80){if(!c||c==='SEA')return'';if(c==='BOU')return`https://commons.wikimedia.org/wiki/Special:Redirect/file/Flag_of_Bougainville.svg?width=${w*2}`;return`https://flagcdn.com/w${w}/${String(c).toLowerCase()}.png`}
const SLAPS_FLAG_NAME_ALIASES={CV:'Cape Verde',CC:'Cocos Islands',CD:'Democratic Republic of the Congo',CI:'Ivory Coast',FK:'Falkland Islands',VA:'Vatican City',FM:'Micronesia',MO:'Macau',PN:'Pitcairn Islands',ST:'São Tomé and Príncipe',MF:'Saint Martin',SX:'Sint Maarten',US:'United States of America',VG:'British Virgin Islands',VI:'U.S. Virgin Islands'};
function normalizedFlagName(v=''){return String(v).normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')}
function slapsFlagEntry(c){let code=String(c||'').toUpperCase(),country=countryByCode(code);if(!country)return null;let wanted=SLAPS_FLAG_NAME_ALIASES[code]||country.name,key=normalizedFlagName(wanted),list=Array.isArray(window.ISFCountries)?window.ISFCountries:[];return list.find(x=>normalizedFlagName(x?.name)===key)||null}
function slapsFlagUrl(c){let code=String(c||'').toUpperCase();if(!code||code==='SEA')return'';let entry=slapsFlagEntry(code);if(entry?.flag)return entry.flag;let name=countryByCode(code)?.name;if(!name)return'';return`assets/flags/${encodeURIComponent(name)}.png`}
function flagUrl(c,w=80){return slapsFlagUrl(c)||legacyFlagUrl(c,w)}
function flagHtml(c,cls='flag-img'){if(!c)return'';let code=String(c).toUpperCase();if(code==='SEA')return`<span class="${esc(cls)}" style="display:inline-flex;align-items:center;justify-content:center;background:#eaf4f8;border-radius:6px;font-size:18px" title="At Sea">🌊</span>`;let src=slapsFlagUrl(code),fallback=legacyFlagUrl(code);if(!src)src=fallback;return`<img class="${esc(cls)}" src="${src}" data-fallback="${fallback}" alt="${esc(countryByCode(code)?.name||code)} flag" loading="lazy" onerror="if(this.dataset.fallback){const f=this.dataset.fallback;this.dataset.fallback='';this.src=f}else{this.style.display='none'}">`}
function countryByName'''
core = replace_once(core, core_pattern, core_replacement, "the existing flag helpers in app-core.js")
core_path.write_text(core, encoding="utf-8")

css_path = Path("styles.css")
css = css_path.read_text(encoding="utf-8")
css_pattern = r"/\* v3 — reliable image flags \+ visa checker \*/\n\.flag-img\{.*?\}\n\.visa-check-layout"
css_replacement = '''/* v4 — SlapsGame artwork at each flag's natural aspect ratio */
.flag-img{display:inline-block;width:auto;height:auto;max-width:34px;max-height:17px;object-fit:contain;border-radius:2px;vertical-align:-3px;background:transparent}
.flag-img.flag-sm{width:auto;height:auto;max-width:26px;max-height:13px;border-radius:1px;vertical-align:-2px}
.flag-img.flag-lg{width:auto;height:auto;max-width:72px;max-height:30px;border-radius:2px;vertical-align:middle}
.flag-box .flag-img{width:auto;height:auto;max-width:32px;max-height:22px;vertical-align:middle}.country-row .flag .flag-img,.breakdown-row .flag .flag-img{width:auto;height:auto;max-width:38px;max-height:20px}.day-stay .flag-img{width:auto;height:auto;max-width:20px;max-height:11px;margin-right:3px;vertical-align:-2px}.country-flag .flag-img{width:auto;height:auto;max-width:34px;max-height:19px;vertical-align:middle}.chip .flag-img{width:auto;height:auto;max-width:26px;max-height:13px}.tiny-btn .flag-img{width:auto;height:auto;max-width:22px;max-height:11px;margin-right:3px;vertical-align:-1px}.profile-card .flag-img{width:auto;height:auto;max-width:26px;max-height:13px;margin-right:3px}
.visa-check-layout'''
css = replace_once(css, css_pattern, css_replacement, "the existing flag CSS in styles.css")
css_path.write_text(css, encoding="utf-8")

app_path = Path("app.js")
app = app_path.read_text(encoding="utf-8")
if "assets/slaps-countries.js" not in app:
    needle = 'document.write(\'<script src="app-core.js?v=accounts-1"'
    replacement = 'document.write(\'<script src="assets/slaps-countries.js?v=slaps-flags-1"><\\/script><script src="app-core.js?v=slaps-flags-1"'
    if needle not in app:
        raise SystemExit("Could not locate app bootstrap in app.js")
    app = app.replace(needle, replacement, 1)
else:
    app = app.replace("app-core.js?v=accounts-1", "app-core.js?v=slaps-flags-1")
app_path.write_text(app, encoding="utf-8")

index_path = Path("index.html")
index = index_path.read_text(encoding="utf-8")
index = index.replace('href="styles.css"', 'href="styles.css?v=slaps-flags-1"')
index = index.replace('src="app.js?v=accounts-1"', 'src="app.js?v=slaps-flags-1"')
index_path.write_text(index, encoding="utf-8")
