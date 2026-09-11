/* Accessible, click-to-expand dashboard widgets. Shared native dialog supports touch and keyboard. */
(() => {
'use strict';
  function uniqueLoggedDays() {
    const days = new Set();
    staysForProfile().filter(s=>s.status!=='planned').forEach(stay => datesForStay(stay,null,isoDate(new Date())).forEach(day => days.add(day)));
    return days.size;
  }

  function dashboardDetail(card) {
    const today = isoDate(new Date());
    const label = card.querySelector('.stat-label')?.textContent?.trim() || '';

    if (card.querySelector('#countriesLogged')) {
      const model = window.WIBCountryCount;
      const visited = model?.visitedCodesAsOf
        ? model.visitedCodesAsOf(today)
        : new Set(state.stays.filter(stay => stay.start <= today).map(stay => stay.countryCode).filter(code => code && code !== 'SEA'));
      const counted = [...visited].filter(code => model?.isCounted ? model.isCounted(code) : !(state.countryCountExcludedCodes || []).includes(code));
      const other = [...visited].filter(code => !counted.includes(code));
      return {
        title: 'Your personal country count',
        text: 'This counts only places you have actually entered by today. The 193 UN member states plus Vatican City and Palestine are counted by default; dependent territories and other countries can be included if you choose.',
        pills: [
          `${counted.length} countries`,
          `${other.length} Dependent territory & other countries`,
          `${visited.size} places visited`
        ]
      };
    }

    if (card.querySelector('#daysLogged')) {
      const travel = travelDaySet().size;
      const logged = uniqueLoggedDays();
      const homeOnly = Math.max(0, logged - travel);
      const homes = (state.residences || []).filter(r => !r.profileId || r.profileId === state.activeProfileId).length;
      return {
        title: 'How travel days are calculated',
        text: 'Each calendar date is counted once, even if you cross borders that day. A date is excluded when your only recorded location is a designated home country or somewhere you were living at the time.',
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
      const oldest=[...schengenDaySet(dayKey(rolling.start),today)].sort()[0];
      const release=oldest?fmt(dayKey(addDays(parseDate(oldest),180)),{day:'numeric',month:'short',year:'numeric'}):null;
      return {
        title: 'Your rolling 180-day window',
        text: 'Schengen counts each calendar date once. '+(release?`The oldest counted day leaves the window on ${release}. Any further Schengen travel also uses allowance.`:'No recorded days currently use your allowance.'),
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


function install(){
 const dialog=document.createElement('dialog');dialog.className='dialog atlas-widget-dialog';dialog.id='atlasWidgetDialog';document.body.append(dialog);
 const routes=['countries','stats','schengen','planner'];
 document.querySelectorAll('#dashboardView .stats-grid > .stat-card').forEach((card,index)=>{
   const button=document.createElement('button');button.className='stat-detail-trigger';button.type='button';button.textContent='Explore details +';button.setAttribute('aria-haspopup','dialog');card.append(button);
   button.addEventListener('click',()=>{const detail=dashboardDetail(card);dialog.innerHTML=`<div class="dialog-card"><div class="dialog-head"><p class="eyebrow">YOUR TRAVEL RECORD</p><button type="button" class="icon-btn" data-close aria-label="Close details">×</button></div><h3 id="widgetTitle">${esc(detail.title)}</h3><p>${esc(detail.text)}</p><div class="stat-detail-pills">${detail.pills.map(p=>`<span class="stat-detail-pill">${esc(p)}</span>`).join('')}</div><button class="primary" data-open>Open ${index===0?'countries':index===1?'statistics':index===2?'Schengen':'trip planner'}</button></div>`;dialog.setAttribute('aria-labelledby','widgetTitle');dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.querySelector('[data-open]').onclick=()=>{dialog.close();switchView(routes[index]);};dialog.showModal();});
 });
}
document.addEventListener('DOMContentLoaded',install);
})();
