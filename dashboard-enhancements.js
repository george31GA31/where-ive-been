/* Where I've Been — expanding dashboard stat cards with contextual detail. */
(() => {
  'use strict';

  let activeOverlay = null;
  let activeSource = null;
  let closing = false;

  function installStyles() {
    if (document.getElementById('wibDashboardEnhancementStyles')) return;
    const style = document.createElement('style');
    style.id = 'wibDashboardEnhancementStyles';
    style.textContent = `
      .stats-grid{position:relative}
      .stats-grid>.stat-card{transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
      @media(hover:hover) and (pointer:fine){
        .stats-grid>.stat-card{cursor:default}
        .stats-grid>.stat-card:hover{transform:translateY(-2px);box-shadow:0 22px 48px rgba(17,24,39,.10);border-color:rgba(184,134,11,.35)}
      }

      .stat-expand-overlay{
        position:absolute!important;z-index:50!important;margin:0!important;overflow:hidden!important;
        display:grid!important;grid-template-columns:minmax(190px,.8fr) minmax(0,1.55fr)!important;
        align-items:stretch!important;gap:24px!important;padding:18px!important;
        background:var(--panel)!important;color:var(--text)!important;border:1px solid rgba(184,134,11,.38)!important;
        border-radius:17px!important;box-shadow:0 28px 70px rgba(15,23,42,.18)!important;
        transition:left .26s cubic-bezier(.2,.8,.2,1),top .26s cubic-bezier(.2,.8,.2,1),width .26s cubic-bezier(.2,.8,.2,1),box-shadow .26s ease!important
      }
      .stat-expand-overlay .stat-expanded-summary{min-width:0;display:flex;flex-direction:column;justify-content:space-between;gap:7px}
      .stat-expand-overlay .stat-expanded-summary>.stat-label{display:block}
      .stat-expand-overlay .stat-expanded-summary>strong{font-size:36px;letter-spacing:-.04em}
      .stat-expand-overlay .stat-expanded-summary .stat-row{display:flex;justify-content:space-between;align-items:center}
      .stat-expand-overlay .stat-expanded-summary small{font-size:10px;color:var(--muted)}
      .stat-expand-overlay .stat-expanded-summary .progress{width:100%}
      .stat-expand-overlay .country-count-edit-btn{display:none!important}
      .stat-expanded-detail{
        min-width:0;align-self:center;border-left:1px solid var(--line);padding-left:24px;
        opacity:0;transform:translateX(-8px);transition:opacity .16s ease .08s,transform .18s ease .08s
      }
      .stat-expand-overlay.expanded .stat-expanded-detail{opacity:1;transform:translateX(0)}
      .stat-expanded-detail .eyebrow{margin-bottom:5px}
      .stat-expanded-detail h3{margin:0 0 7px;font-size:15px;letter-spacing:-.02em}
      .stat-expanded-detail p{margin:0;color:var(--muted);font-size:11px;line-height:1.55}
      .stat-expanded-detail .stat-detail-pills{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
      .stat-detail-pill{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border-radius:999px;background:var(--bg);border:1px solid var(--line);font-size:9px;font-weight:800;color:var(--text)}

      [data-theme="dark"] .stat-expand-overlay{box-shadow:0 28px 70px rgba(0,0,0,.40)!important}

      @media(max-width:1050px){
        .stat-expand-overlay{gap:16px!important;grid-template-columns:minmax(165px,.75fr) minmax(0,1.25fr)!important}
        .stat-expanded-detail{padding-left:16px}
      }
    `;
    document.head.appendChild(style);
  }

  function uniqueLoggedDays() {
    const days = new Set();
    state.stays.forEach(stay => datesForStay(stay).forEach(day => days.add(day)));
    return days.size;
  }

  function dashboardDetail(card) {
    const today = isoDate(new Date());
    const label = card.querySelector('.stat-label')?.textContent?.trim() || '';

    if (card.querySelector('#countriesLogged')) {
      const recorded = new Set(state.stays.map(stay => stay.countryCode).filter(code => code && code !== 'SEA'));
      const notCounted = new Set(state.countryCountExcludedCodes || []);
      const plannedOnly = [...recorded].filter(code => {
        const visits = state.stays.filter(stay => stay.countryCode === code);
        return visits.length && visits.every(stay => stay.status === 'planned');
      }).length;
      return {
        title: 'Your personal country count',
        text: 'This headline is deliberately separate from your travel history. Unticking a place changes only this number — its dates, map colour and country history stay intact.',
        pills: [`${recorded.size} recorded`, `${notCounted.size} not counted`, `${plannedOnly} planned-only`]
      };
    }

    if (card.querySelector('#daysLogged')) {
      const travel = travelDaySet().size;
      const logged = uniqueLoggedDays();
      const homeOnly = Math.max(0, logged - travel);
      const homes = (state.residences || []).filter(r => !r.profileId || r.profileId === state.activeProfileId).length;
      return {
        title: 'How travel days are calculated',
        text: 'Each calendar date is counted once, even if you cross borders that day. A date is excluded when your only recorded location is somewhere you were living at the time.',
        pills: [`${travel} travel days`, `${homeOnly} home-only days`, `${homes} home period${homes === 1 ? '' : 's'}`]
      };
    }

    if (card.querySelector('#schengenUsed')) {
      if (isSchengenExemptProfile()) {
        return {
          title: '90/180 is not applied',
          text: 'The active profile has an EU/EEA/Swiss citizenship recorded, so the normal Schengen short-stay calculation is not used for this traveller.',
          pills: ['Profile exempt']
        };
      }
      const rolling = rollingStatus(today);
      return {
        title: 'Your rolling 180-day window',
        text: 'Schengen counts unique calendar days, not border crossings. Visiting two Schengen countries on the same day still uses only one day of the 90-day allowance.',
        pills: [`${rolling.used} used`, `${Math.max(0, rolling.remaining)} remaining`, `${fmtObj(rolling.start, {day:'numeric',month:'short'})} → ${fmtObj(rolling.end, {day:'numeric',month:'short'})}`]
      };
    }

    if (card.querySelector('#schengenRemaining')) {
      if (isSchengenExemptProfile()) {
        return {
          title: 'No short-stay allowance applied',
          text: 'This profile is currently treated as exempt from the Schengen 90/180 short-stay rule based on its recorded citizenship.',
          pills: ['90/180 not applied']
        };
      }
      const rolling = rollingStatus(today);
      const usedPercent = Math.round((rolling.used / 90) * 100);
      return {
        title: 'Allowance available today',
        text: 'This is the number of additional Schengen days available in today’s rolling window. As older travel days fall outside 180 days, allowance can return over time.',
        pills: [`${Math.max(0, rolling.remaining)} days left`, `${usedPercent}% used`, `As of ${fmt(today, {day:'numeric',month:'short',year:'numeric'})}`]
      };
    }

    return {
      title: label,
      text: 'Hover information for this statistic.',
      pills: []
    };
  }

  function stripDuplicateIds(root) {
    if (root.id) root.removeAttribute('id');
    root.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
    root.querySelectorAll('button').forEach(button => {
      button.tabIndex = -1;
      button.setAttribute('aria-hidden', 'true');
    });
  }

  function closeOverlay(immediate = false) {
    if (!activeOverlay || !activeSource) return;
    if (closing) return;
    closing = true;

    const overlay = activeOverlay;
    const source = activeSource;
    const grid = source.closest('.stats-grid');
    if (!grid) {
      overlay.remove();
      activeOverlay = activeSource = null;
      closing = false;
      return;
    }

    const gridRect = grid.getBoundingClientRect();
    const sourceRect = source.getBoundingClientRect();
    const finish = () => {
      overlay.remove();
      source.style.visibility = '';
      activeOverlay = null;
      activeSource = null;
      closing = false;
    };

    overlay.classList.remove('expanded');

    if (immediate) {
      finish();
      return;
    }

    overlay.style.left = `${sourceRect.left - gridRect.left}px`;
    overlay.style.top = `${sourceRect.top - gridRect.top}px`;
    overlay.style.width = `${sourceRect.width}px`;
    overlay.style.boxShadow = '0 18px 45px rgba(17,24,39,.06)';
    window.setTimeout(finish, 275);
  }

  function openOverlay(source) {
    if (!window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    if (activeSource === source || closing) return;
    if (activeOverlay) closeOverlay(true);

    const grid = source.closest('.stats-grid');
    if (!grid) return;

    const gridRect = grid.getBoundingClientRect();
    const sourceRect = source.getBoundingClientRect();
    const detail = dashboardDetail(source);
    const overlay = document.createElement('article');
    overlay.className = 'stat-card stat-expand-overlay';

    const summary = document.createElement('div');
    summary.className = 'stat-expanded-summary';
    summary.innerHTML = source.innerHTML;
    stripDuplicateIds(summary);

    const info = document.createElement('div');
    info.className = 'stat-expanded-detail';
    info.innerHTML = `
      <p class="eyebrow">MORE INFORMATION</p>
      <h3>${esc(detail.title)}</h3>
      <p>${esc(detail.text)}</p>
      ${detail.pills?.length ? `<div class="stat-detail-pills">${detail.pills.map(pill => `<span class="stat-detail-pill">${esc(pill)}</span>`).join('')}</div>` : ''}
    `;

    overlay.append(summary, info);
    overlay.style.left = `${sourceRect.left - gridRect.left}px`;
    overlay.style.top = `${sourceRect.top - gridRect.top}px`;
    overlay.style.width = `${sourceRect.width}px`;
    overlay.style.height = `${sourceRect.height}px`;

    grid.appendChild(overlay);
    source.style.visibility = 'hidden';
    activeOverlay = overlay;
    activeSource = source;

    overlay.addEventListener('mouseleave', () => closeOverlay());

    requestAnimationFrame(() => {
      if (activeOverlay !== overlay) return;
      overlay.classList.add('expanded');
      overlay.style.left = '0px';
      overlay.style.width = `${grid.clientWidth}px`;
    });
  }

  function bindCards() {
    document.querySelectorAll('#dashboardView .stats-grid > .stat-card').forEach(card => {
      if (card.dataset.wibStatHoverBound) return;
      card.dataset.wibStatHoverBound = '1';
      card.addEventListener('mouseenter', () => openOverlay(card));
    });
  }

  const previousRenderDashboard = renderDashboard;
  renderDashboard = function () {
    previousRenderDashboard();
    bindCards();
  };

  installStyles();

  document.addEventListener('DOMContentLoaded', () => {
    installStyles();
    bindCards();
    window.addEventListener('resize', () => closeOverlay(true), { passive: true });
  });
})();
