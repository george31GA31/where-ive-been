function renderCalendar() {
  if (window.HVCalendar?.renderMonth) return window.HVCalendar.renderMonth();
  const previousDate = document.activeElement?.dataset.selectDate;
  const c = calendarCursor;
  const first = (c.getUTCDay() + 6) % 7;
  const start = addDays(c, -first);
  const today = isoDate(new Date());

  els.calendarTitle.textContent = c.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const monthJump = $('calendarMonthJump');
  const yearJump = $('calendarYearJump');
  if (monthJump) monthJump.value = String(c.getUTCMonth());
  if (yearJump) yearJump.value = String(c.getUTCFullYear());

  let html = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    .map((day) => `<div class="calendar-weekday">${day}</div>`)
    .join('');

  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i);
    const key = dayKey(d);
    const on = staysForProfile().filter(
      (stay) => countsForPlanning(stay) && stay.start <= key && stay.end >= key,
    );
    const selectionRange =
      calendarSelectionStart &&
      calendarSelectionEnd &&
      key >= calendarSelectionStart &&
      key <= calendarSelectionEnd;
    const selectionStart = key === calendarSelectionStart;
    const selectionEnd = key === calendarSelectionEnd;

    html += `<div class="calendar-day ${d.getUTCMonth() === c.getUTCMonth() ? '' : 'outside'} ${key === today ? 'today' : ''} ${selectionRange ? 'selection-range' : ''} ${selectionStart ? 'selection-start' : ''} ${selectionEnd ? 'selection-end' : ''}" data-calendar-date="${key}" role="group" aria-label="${fmt(key)}">
        <button type="button" class="day-number" data-select-date="${key}" aria-label="Select ${fmt(key)}" aria-pressed="${!!(selectionRange || selectionStart || selectionEnd)}">${d.getUTCDate()}</button>
        ${on
          .slice(0, 4)
          .map(
            (stay) => `
          <button
            type="button"
            class="day-stay calendar-stay-button ${SCHENGEN.has(stay.countryCode) && !stay.schengenExempt ? 'schengen' : ''} ${stay.status === 'planned' ? 'planned' : ''}"
            data-calendar-stay-id="${esc(stay.id)}"
            aria-label="Edit ${esc(stay.countryName)} stay, ${stay.status === 'actual' ? 'completed' : esc(stay.status)}"
            title="Edit ${esc(stay.countryName)}"
          >
            ${flagHtml(stay.countryCode, 'flag-img flag-sm')}
            <span class="calendar-stay-name">${esc(stay.countryName)}${stay.status === 'planned' ? ' · Planned' : ''}</span>
          </button>
        `,
          )
          .join('')}
        ${on.length > 4 ? `<div class="day-stay calendar-more">+${on.length - 4} more</div>` : ''}
      </div>`;
  }

  els.calendar.innerHTML = html;

  els.calendar.querySelectorAll('[data-calendar-stay-id]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openStayDialog(button.dataset.calendarStayId);
    });
  });

  els.calendar.querySelectorAll('[data-calendar-date]').forEach((day) => {
    day.onkeydown = (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target === day) {
        event.preventDefault();
        handleCalendarDateClick(day.dataset.calendarDate);
      }
    };
  });

  updateCalendarSelectionUI();
  if (previousDate) els.calendar.querySelector(`[data-select-date="${previousDate}"]`)?.focus();
  window.dispatchEvent(new CustomEvent('hv-calendar-rendered'));
}
function updateCalendarSelectionUI() {
  if (!els.calendarSelectionInfo || !els.clearCalendarSelectionBtn) return;
  let info = els.calendarSelectionInfo,
    btn = els.clearCalendarSelectionBtn;
  if (!calendarSelectionStart) {
    info.className = 'calendar-selection-info';
    info.innerHTML =
      '<strong>Select dates to add travel</strong><span>Choose the first date, then the last.</span>';
    btn.disabled = true;
    btn.hidden = false;
    return;
  }
  btn.disabled = false;
  btn.hidden = false;
  if (!calendarSelectionEnd) {
    info.className = 'calendar-selection-info active';
    info.innerHTML = `<strong>${fmt(calendarSelectionStart)} selected</strong><span>Now choose the last day, or select the same date again for one day.</span>`;
    return;
  }
  let days = daysInclusive(calendarSelectionStart, calendarSelectionEnd);
  info.className = 'calendar-selection-info complete';
  info.innerHTML = `<strong>${fmt(calendarSelectionStart)} to ${fmt(calendarSelectionEnd)}</strong><span>${plural(days, 'day')} selected.</span>`;
}
function clearCalendarSelection() {
  calendarSelectionStart = null;
  calendarSelectionEnd = null;
  renderCalendar();
}
function handleCalendarDateClick(k) {
  if (!calendarSelectionStart) {
    calendarSelectionStart = k;
    calendarSelectionEnd = null;
    renderCalendar();
    return;
  }
  if (calendarSelectionEnd) {
    if (k >= calendarSelectionStart && k <= calendarSelectionEnd) {
      clearCalendarSelection();
      return;
    }
    calendarSelectionStart = k;
    calendarSelectionEnd = null;
    renderCalendar();
    return;
  }
  let a = calendarSelectionStart,
    b = k;
  calendarSelectionStart = a <= b ? a : b;
  calendarSelectionEnd = a <= b ? b : a;
  renderCalendar();
  setTimeout(
    () =>
      openStayDialog(null, {
        start: calendarSelectionStart,
        end: calendarSelectionEnd,
        source: 'calendar',
      }),
    0,
  );
}
