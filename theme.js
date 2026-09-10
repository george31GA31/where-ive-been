/* Where I've Been — brand, light/dark theme and logo integration */
(() => {
  'use strict';

  const THEME_KEY = 'whereIveBeen.theme.v1';
  const BRAND_MARK = 'assets/wib-logo-mark.png';

  function getTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    const next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    localStorage.setItem(THEME_KEY, next);

    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = next === 'dark' ? '#0b1018' : '#f4f5f7';

    const button = document.getElementById('themeToggleBtn');
    if (button) {
      const dark = next === 'dark';
      button.setAttribute('aria-pressed', dark ? 'true' : 'false');
      button.setAttribute('title', dark ? 'Switch to light mode' : 'Switch to dark mode');
      button.innerHTML = `<span class="theme-toggle-icon" aria-hidden="true">${dark ? '☀' : '☾'}</span><span class="theme-toggle-label">${dark ? 'Light' : 'Dark'}</span>`;
    }
  }

  function installBrandAssets() {
    let favicon = document.querySelector('link[rel="icon"]');
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }
    favicon.type = 'image/png';
    favicon.href = BRAND_MARK;

    let apple = document.querySelector('link[rel="apple-touch-icon"]');
    if (!apple) {
      apple = document.createElement('link');
      apple.rel = 'apple-touch-icon';
      document.head.appendChild(apple);
    }
    apple.href = BRAND_MARK;


    const mark = document.querySelector('.brand-mark');
    if (mark) {
      mark.innerHTML = `<img src="${BRAND_MARK}" alt="Where I've Been logo" class="brand-logo-mark">`;
      mark.classList.add('has-logo');
    }
  }

  function installThemeToggle() {
    if (document.getElementById('themeToggleBtn')) return;

    const addStay = document.getElementById('addStayBtn');
    const topbar = addStay?.closest('.topbar');
    if (!addStay || !topbar) return;

    let actions = topbar.querySelector('.topbar-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'topbar-actions';
      topbar.appendChild(actions);
      actions.appendChild(addStay);
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'themeToggleBtn';
    button.className = 'secondary theme-toggle-btn';
    button.addEventListener('click', () => {
      applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    });

    actions.insertBefore(button, addStay);
    applyTheme(getTheme());
  }

  function installBrandStyles() {
    if (document.getElementById('wibBrandThemeStyles')) return;
    const style = document.createElement('style');
    style.id = 'wibBrandThemeStyles';
    style.textContent = `
      :root,
      html[data-theme="light"] {
        --brand-navy:#111827;
        --brand-navy-2:#202938;
        --brand-gold:#c9a533;
        --brand-gold-strong:#ad871e;
        --brand-gold-soft:#fbf3d5;
        --brand-gold-pale:#fffaf0;
        --bg:#f4f5f7;
        --panel:#ffffff;
        --text:#111827;
        --muted:#7b8493;
        --line:#e4e7ec;
        --blue:#b38c22;
        --blue-soft:#fff6d9;
        --shadow:0 18px 45px rgba(17,24,39,.065);
      }

      html[data-theme="dark"] {
        --brand-navy:#0b1018;
        --brand-navy-2:#182131;
        --brand-gold:#d2ae3e;
        --brand-gold-strong:#e0bd50;
        --brand-gold-soft:#302814;
        --brand-gold-pale:#211c10;
        --bg:#090d14;
        --panel:#111722;
        --text:#f5f1e8;
        --muted:#9ba5b3;
        --line:#293342;
        --green:#55b989;
        --green-soft:#112a20;
        --amber:#e3b557;
        --amber-soft:#302513;
        --red:#ff8075;
        --red-soft:#351817;
        --blue:#d2ae3e;
        --blue-soft:#302814;
        --shadow:0 18px 50px rgba(0,0,0,.28);
      }

      html,body,.sidebar,.main,.panel,.stat-card,.dialog-card,input,select,button,.calendar-day,.calendar-weekday {
        transition:background-color .18s ease,color .18s ease,border-color .18s ease,box-shadow .18s ease;
      }

      body{background:var(--bg);color:var(--text)}
      .sidebar{background:var(--panel);border-color:var(--line)}
      .brand{gap:13px}
      .brand-mark.has-logo{width:46px;height:46px;border-radius:14px;background:transparent;overflow:visible;display:grid;place-items:center;flex:0 0 46px}
      .brand-logo-mark{display:block;width:46px;height:46px;object-fit:contain;filter:drop-shadow(0 5px 12px rgba(17,24,39,.12))}
      .brand strong{font-size:15px;letter-spacing:-.015em;color:var(--text)}
      .brand span{color:var(--muted)}
      .eyebrow{color:var(--brand-gold-strong)}

      .topbar-actions{display:flex;align-items:center;gap:9px;flex:0 0 auto}
      .theme-toggle-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-width:82px}
      .theme-toggle-icon{font-size:16px;line-height:1}
      .theme-toggle-label{font-size:11px}

      .nav-item{color:#626d7c}
      .nav-item:hover{background:#f7f4e9;color:var(--brand-navy)}
      .nav-item.active{background:var(--brand-navy);color:#fff;box-shadow:inset 3px 0 0 var(--brand-gold)}
      .primary{background:var(--brand-navy);color:#fff}
      .primary:hover{background:var(--brand-navy-2)}
      .primary:focus-visible,.secondary:focus-visible,.icon-btn:focus-visible,.nav-item:focus-visible{outline:2px solid var(--brand-gold);outline-offset:2px}
      .secondary,.icon-btn,.edit-btn,.tiny-btn{background:var(--panel);color:var(--text);border-color:var(--line)}
      .secondary:hover,.icon-btn:hover,.edit-btn:hover,.tiny-btn:hover{background:var(--brand-gold-pale)}
      .text-btn{color:var(--text)}

      .stat-card,.panel{background:var(--panel);border-color:var(--line);box-shadow:var(--shadow)}
      .stat-label,.field>span,.field-heading>span{color:var(--muted)}
      .mini-day.today{outline-color:var(--brand-navy)}
      .mini-day.has-stay{background:var(--brand-gold-soft);color:#705817}
      .progress{background:#eceef1}
      .country-bar{background:#eceef1}
      .country-bar span{background:linear-gradient(90deg,var(--brand-navy) 0%,var(--brand-navy-2) 62%,var(--brand-gold) 100%)}
      .calendar-weekday{background:#faf9f5;color:#817a6b}
      .calendar-day{background:var(--panel);border-color:var(--line)}
      .calendar-day.outside{background:#faf9f5}
      .calendar-day.today .day-number{background:var(--brand-navy);color:#fff;box-shadow:0 0 0 2px var(--brand-gold)}
      .calendar-day.selection-range{background:#fff9e8}
      .calendar-day.selection-start,.calendar-day.selection-end{box-shadow:inset 0 0 0 2px var(--brand-gold)}
      .day-stay{background:#f0f2f5;color:var(--text)}
      .day-stay.planned{border-color:var(--brand-gold);background:var(--brand-gold-pale)}
      .calendar-stay-button:hover{background:#ebeef2!important}
      .calendar-jump-select{background:var(--panel)!important;color:var(--text)!important;border-color:var(--line)!important}

      input[type=text],input[type=date],input[type=email],input[type=password],select{background:var(--panel);color:var(--text);border-color:var(--line)}
      input:focus,select:focus{border-color:var(--brand-gold);box-shadow:0 0 0 3px rgba(201,165,51,.16)}
      .dialog-card{background:var(--panel);color:var(--text)}
      .date-range-row,.check-row,.gap-card,.transfer-card,.privacy-note{background:#faf9f5;border-color:var(--line)}
      .flag-box{background:#f5f3ed}
      .pill{background:#f1efe9}
      .map-wrap{background:#f8f7f2;border-color:var(--line)}
      .map-country{fill:#e5e3dc;stroke:#fff}
      .map-country.visited{fill:var(--brand-navy)}
      .map-country.planned{fill:#e2d29a}
      .map-country.current{fill:var(--brand-gold)}
      .visited-dot{background:var(--brand-navy)}
      .planned-dot{background:#e2d29a}
      .timeline-bar{background:var(--brand-navy)}
      .timeline-bar.planned{background:var(--brand-gold)}
      .country-count-edit-btn{color:var(--brand-gold-strong)!important}
      .country-count-edit-btn:hover{background:var(--brand-gold-pale)!important}
      .country-count-choice:hover{background:var(--brand-gold-pale)!important}

      html[data-theme="dark"] .sidebar{background:#0d131d}
      html[data-theme="dark"] .nav-item{color:#b3bcc9}
      html[data-theme="dark"] .nav-item:hover{background:#171f2c;color:#fff}
      html[data-theme="dark"] .nav-item.active{background:#202938;color:#fff;box-shadow:inset 3px 0 0 var(--brand-gold)}
      html[data-theme="dark"] .primary{background:var(--brand-gold);color:#111827}
      html[data-theme="dark"] .primary:hover{background:#e0bd50}
      html[data-theme="dark"] .secondary,
      html[data-theme="dark"] .icon-btn,
      html[data-theme="dark"] .edit-btn,
      html[data-theme="dark"] .tiny-btn{background:#151d29;color:var(--text);border-color:#303b4b}
      html[data-theme="dark"] .secondary:hover,
      html[data-theme="dark"] .icon-btn:hover,
      html[data-theme="dark"] .edit-btn:hover,
      html[data-theme="dark"] .tiny-btn:hover{background:#202938}
      html[data-theme="dark"] .calendar-weekday,
      html[data-theme="dark"] .calendar-day.outside,
      html[data-theme="dark"] .date-range-row,
      html[data-theme="dark"] .check-row,
      html[data-theme="dark"] .gap-card,
      html[data-theme="dark"] .transfer-card,
      html[data-theme="dark"] .privacy-note{background:#0e141e}
      html[data-theme="dark"] .calendar-day{background:#111722}
      html[data-theme="dark"] .calendar-day.selection-range{background:#262111}
      html[data-theme="dark"] .calendar-day.today .day-number{background:var(--brand-gold);color:#111827;box-shadow:0 0 0 2px #5c4c1d}
      html[data-theme="dark"] .day-stay{background:#202938;color:#edf1f6}
      html[data-theme="dark"] .day-stay.schengen{background:#153225;color:#9de1bd}
      html[data-theme="dark"] .day-stay.planned{background:#2a2413;color:#f1d77d;border-color:#8f7426}
      html[data-theme="dark"] .calendar-stay-button:hover{background:#2a3445!important}
      html[data-theme="dark"] .calendar-jump-select{background:#151d29!important;color:var(--text)!important;border-color:#303b4b!important}
      html[data-theme="dark"] input[type=text],
      html[data-theme="dark"] input[type=date],
      html[data-theme="dark"] input[type=email],
      html[data-theme="dark"] input[type=password],
      html[data-theme="dark"] select{background:#0c121b;color:var(--text);border-color:#303b4b}
      html[data-theme="dark"] input[type=date]{color-scheme:dark}
      html[data-theme="dark"] .flag-box{background:#171f2a}
      html[data-theme="dark"] .pill{background:#202938;color:#b8c1ce!important}
      html[data-theme="light"] .map-wrap{background:#f8f7f2}
     .map-country{fill:#e5e3dc;stroke:#fff}
      .map-country.visited{fill:var(--brand-navy)}
      .map-country.planned{fill:#e2d29a}
      .map-country.current{fill:var(--brand-gold)}
      .visited-dot{background:var(--brand-navy)}
      .planned-dot{background:#e2d29a}
      .timeline-bar{background:var(--brand-navy)}
      .timeline-bar.planned{background:var(--brand-gold)}
      .country-count-edit-btn{color:var(--brand-gold-strong)!important}
      .country-count-edit-btn:hover{background:var(--brand-gold-pale)!important}
      .country-count-choice:hover{background:var(--brand-gold-pale)!important}

      html[data-theme="dark"] .sidebar{background:#0d131d}
      html[data-theme="dark"] .nav-item{color:#b3bcc9}
      html[data-theme="dark"] .nav-item:hover{background:#171f2c;color:#fff}
      htm[data-theme="dark"] .nav-item.active{background:#202938;color:#fff;box-shadow:inset 3px 0 0 var(--brand-gold)}
      htm[data-theme="dark"] .primary{background:var(--brand-gold);color:#111827}
      html[data-theme="dark"] .primary:hover{background:#e0bd50}
      htm[data-theme="dark"] .secondary,
      html[data-theme="dark"] .icon-btn,
      html[data-theme="dark"] .edit-btn,
      htm[data-theme="dark"] .tiny-btn{background:#151d29;color:var(--text);border-color:#303b4b}
      html[data-theme="dark"] .secondary:hover,
      html[data-theme="dark"] .icon-btn:hover,
      html[data-theme="dark"] .edit-btn:hover,
      htm[data-theme="dark"] .tiny-btn:hover{background:#202938}
      html[data-theme="dark"] .calendar-weekday,
      htm[data-theme="dark"] .calendar-day.outside,
      html[data-theme="dark"] .date-range-row,
      htm[data-theme="dark"] .check-row,
      html[data-theme="dark"] .gap-card,
      html[data-theme="dark"] .transfer-card,
      html[data-theme="dark"] .privacy-note{background:#0e141e}
      htm[data-theme="dark"] .calendar-day{background:#111722}
      htm[data-theme="dark"] .calendar-day.selection-range{background:#262111}
      html[data-theme="dark"] .calendar-day.today .day-number{background:var(--brand-gold);color:#111827;box-shadow:0 0 0 2px #5c4c1d}
      html[data-theme="dark"] .day-stay{background:#202938;color:#edf1f6}
      htm[data-theme="dark"] .day-stay.schengen{background:#153225;color:#9de1bd}
      html[data-theme="dark"] .day-stay.planned{background:#2a2413;color:#f1d77d;border-color:#8f7426}
      html[data-theme="dark"] .calendar-stay-button:hover{background:#2a3445!important}
      htm[data-theme="dark"] .calendar-jump-select{background:#151d29!important;color:var(--text)!important;border-color:#303b4b!important}
      html[data-theme="dark"] input[type=text],
      html[data-theme="dark"] input[type=date],
      html[data-theme="dark"] input[type=email],
      htm[data-theme="dark"] input[type=password],
      htm[data-theme="dark"] select{background:#0c121b;color:var(--text);border-color:#303b4b}
      html[data-theme="dark"] input[type=date]{color-scheme:dark}
      html[data-theme="dark"] .flag-box{background:#171f2a}
      html[data-theme="dark"] .pill{background:#202938;color:#b8c1ce!important}
      html[data-theme="dark"] .map-wrap{background:#0b111a}
      html[data-theme="dark"] .map-country{fill:#263141;stroke:#111722}
      html[data-theme="dark"] .map-country.visited{fill:#d6b343}
      htm[data-theme="dark"] .map-country.planned{fill:#65572c}
      html[data-theme="dark"] .map-country.current{fill:#f0cf63}
      htm[data-theme="dark"] .visited-dot{background:#d6b343}
      html[data-theme="dark"] .planned-dot{background:#65572c}
      html[data-theme="dark"] .country-bar{background:#252e3b}
      html[data-theme="dark"] .country-bar span{background:linear-gradient(90deg,#d0aa36 0%,#f0cf63 100%)}
      html[data-theme="dark"] .progress{background:#252e3b}
      html[data-theme="dark"] .legal-note,
      html[data-theme="dark"] .stay-row,
      html[data-theme="dark"] .country-row,
      htm[data-theme="dark"] .breakdown-row{border-color:var(--line)}
      html[data-theme="dark"] .legal-note a{color:#e5c65b}
      htm[data-theme="dark"] .empty-state,
      html[data-theme="dark"] .helper,
      html[data-theme="dark"] .panel-copy,
      html[data-theme="dark"] .map-selection-summary{color:var(--muted)}
      htm[data-theme="dark"] .country-count-choice:hover{background:#1a2230!important}
      html[data-theme="dark"] .country-count-edit-btn:hover{background:#1a2230!important}
      html[data-theme="dark"] .brand-logo-mark{filter:drop-shadow(0 5px 14px rgba(0,0,0,.5))}
      html[data-theme="dark"] ::selection{background:#d2ae3e;color:#111827}

      @media(max-width:700px){
        .topbar-actions{gap:6px}
        .theme-toggle-btn{min-width:42px;width:42px;padding:10px}
        .theme-toggle-label{display:none}
        .brand-logo-mark{width:42px;height:42px}
      }
    `;
    document.head.appendChild(style);
  }

  installBrandStyles();
  applyTheme(getTheme());

  document.addEventListener('DOMContentLoaded', () => {
    installBrandAssets();
    installThemeToggle();
  });
})();
