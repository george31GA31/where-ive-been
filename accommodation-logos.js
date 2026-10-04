/* Hotel artwork lives on the existing private saved-place catalogue, never on a stay. */
(function (root) {
  'use strict';
  const Hotels = typeof module !== 'undefined' && module.exports ? require('./accommodation-place-model.js') : root.HVAccommodationPlaces;
  const Saved = typeof module !== 'undefined' && module.exports ? require('./saved-places-model.js') : root.HVSavedModel;
  const E = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const valid = src => typeof src === 'string' && src.length <= 100000 && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(src);

  function context(data, recordId) {
    const records = data?.accommodations || [], record = records.find(r => r.id === recordId);
    if (!record) return null;
    // The same all-member matching rule as the map prevents transitive/name-only merges.
    const group = Hotels.groups(records).find(g => g.records.includes(record));
    const rows = (data.savedPlaces || []).filter(row => row.place && group.records.every(r => Hotels.same(row.place, Hotels.place(r))));
    return {record, group, rows};
  }
  function logo(data, recordId) {
    const rows = context(data, recordId)?.rows || [];
    const latest = rows.filter(r => r.accommodationLogo).sort((a,b) => String(b.accommodationLogo.updatedAt || '').localeCompare(String(a.accommodationLogo.updatedAt || '')) || a.id.localeCompare(b.id))[0];
    return valid(latest?.accommodationLogo?.src) ? latest.accommodationLogo.src : null;
  }
  function set(data, recordId, src, updatedAt = new Date().toISOString()) {
    if (src !== null && !valid(src)) throw new Error('Choose a valid hotel logo.');
    const target = context(data, recordId);
    if (!target) throw new Error('This stay is no longer available.');
    data.savedPlaces ||= [];
    if (!target.rows.length) {
      const place = {...target.group.place, type:target.group.place.type || 'Hotel'};
      // Generate a normal saved-place identity, without relaxing the hotel's matching rules.
      const row = Saved.upsert([], place, target.record.profileId ?? null), base = row.id;
      let suffix = 1;
      while (data.savedPlaces.some(r => r.id === row.id)) row.id = base + ':' + suffix++;
      row.sourceIds = [...new Set(target.group.records.map(r => r.place?.id).filter(Boolean))];
      data.savedPlaces.push(row); target.rows.push(row);
    }
    // A removal is retained, so an older logo on a duplicate catalogue entry cannot reappear.
    for (const row of target.rows) row.accommodationLogo = {src, updatedAt};
  }

  async function prepare(file) {
    if (!file || !['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)) throw new Error('Choose a PNG, JPEG, WebP or GIF image.');
    if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.');
    const url = root.URL.createObjectURL(file), image = new root.Image();
    try {
      await new Promise((resolve,reject) => {image.onload = resolve; image.onerror = () => reject(new Error('This image could not be opened. Choose another image.')); image.src = url;});
      const width = image.naturalWidth, height = image.naturalHeight;
      if (!width || !height || width * height > 40000000) throw new Error('Choose a smaller image.');
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('This image could not be prepared.');
      ctx.fillStyle = '#fff'; ctx.fillRect(0,0,128,128);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      const scale = Math.min(112 / width, 112 / height), w = width * scale, h = height * scale;
      ctx.drawImage(image,(128-w)/2,(128-h)/2,w,h);
      const src = canvas.toDataURL('image/png');
      if (!valid(src)) throw new Error('Choose a smaller image.');
      return src;
    } finally {root.URL.revokeObjectURL(url);}
  }

  const housePath = 'm2 7 6-5 6 5M4 6v8h8V6M7 14v-4h2v4';
  const defaultIcon = '<svg class="herald-stay-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="'+housePath+'"/></svg>';
  let openControl;
  const current = () => typeof state === 'undefined' ? null : state;
  function artwork(src) {return src ? `<img class="herald-hotel-logo" src="${E(src)}" alt="" width="18" height="18">` : defaultIcon;}
  function label(record, src) {return (src ? 'Change hotel logo for ' : 'Upload hotel logo for ') + (record?.propertyName || record?.place?.name || 'this accommodation');}
  function icon(record) {
    const src = logo(current(), record.id);
    return `<span class="herald-hotel-logo-control"><button type="button" class="herald-hotel-logo-button" data-hotel-logo="${E(record.id)}" aria-label="${E(label(record,src))}" title="${E(src ? 'Change hotel logo' : 'Upload hotel logo')}"${src ? ' aria-haspopup="menu" aria-expanded="false"' : ''}>${artwork(src)}</button></span>`;
  }
  function closeControl(focus = false) {
    const button = openControl?.querySelector('[data-hotel-logo]');
    openControl?.querySelector('.herald-hotel-logo-menu')?.remove();
    button?.setAttribute('aria-expanded','false'); openControl = null;
    if (focus) button?.focus();
  }
  function refresh() {
    closeControl();
    for (const button of document.querySelectorAll('[data-hotel-logo]')) {
      const id = button.dataset.hotelLogo, src = logo(current(),id), record = current()?.accommodations?.find(r => r.id === id);
      if (src) {
        const img = document.createElement('img'); img.className = 'herald-hotel-logo'; img.src = src;
        img.alt = ''; img.width = img.height = 18; button.replaceChildren(img);
      } else {
        const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'), path = document.createElementNS('http://www.w3.org/2000/svg','path');
        svg.setAttribute('class','herald-stay-icon'); svg.setAttribute('viewBox','0 0 16 16'); svg.setAttribute('aria-hidden','true');
        path.setAttribute('d',housePath); svg.append(path); button.replaceChildren(svg);
      }
      button.setAttribute('aria-label',label(record,src));
      button.title = src ? 'Change hotel logo' : 'Upload hotel logo';
      if (src) {button.setAttribute('aria-haspopup','menu'); button.setAttribute('aria-expanded','false');}
      else {button.removeAttribute('aria-haspopup'); button.removeAttribute('aria-expanded');}
    }
  }
  function message(button, text) {
    closeControl(); openControl = button.parentElement;
    const panel = document.createElement('div'); panel.className = 'herald-hotel-logo-menu'; panel.setAttribute('role','alert'); panel.textContent = text;
    openControl.append(panel);
  }
  function save(button, data, src) {
    if (current() !== data) return; // An upload must never cross an account switch or a replaced snapshot.
    const before = JSON.parse(JSON.stringify(data.savedPlaces || []));
    try {
      set(data,button.dataset.hotelLogo,src);
      if (persist() === false) throw new Error('The logo could not be saved. Device storage may be full.');
      refresh(); button.focus();
    } catch (error) {
      data.savedPlaces = before; persist(); message(button,error.message);
    }
  }
  function choose(button) {
    closeControl(); const data = current(), input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/png,image/jpeg,image/webp,image/gif'; input.hidden = true;
    button.parentElement.append(input);
    input.addEventListener('cancel',() => {input.remove(); button.focus();},{once:true});
    input.addEventListener('change',async () => {
      const file = input.files?.[0]; input.remove(); if (!file) return;
      button.disabled = true; button.setAttribute('aria-busy','true');
      try {const src = await prepare(file); save(button,data,src);}
      catch (error) {if (current() === data) message(button,error.message);}
      finally {button.disabled = false; button.removeAttribute('aria-busy'); button.focus();}
    },{once:true});
    input.click();
  }
  function menu(button) {
    const control = button.parentElement, wasOpen = openControl === control && !!control.querySelector('[role=menu]');
    closeControl(); if (wasOpen) return;
    openControl = control; button.setAttribute('aria-expanded','true');
    const panel = document.createElement('div'); panel.className = 'herald-hotel-logo-menu'; panel.setAttribute('role','menu');
    panel.innerHTML = '<button type="button" role="menuitem" data-hotel-logo-replace>Replace logo</button><button type="button" role="menuitem" data-hotel-logo-remove>Remove logo</button>';
    control.append(panel); panel.querySelector('button').focus();
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('click',event => {
      const button = event.target.closest('[data-hotel-logo]'), action = event.target.closest('[data-hotel-logo-replace],[data-hotel-logo-remove]');
      if (!button && !action) {closeControl(); return;}
      event.preventDefault(); event.stopPropagation();
      if (button) {if (logo(current(),button.dataset.hotelLogo)) menu(button); else choose(button);}
      else {
        const trigger = action.closest('.herald-hotel-logo-control').querySelector('[data-hotel-logo]');
        if (action.hasAttribute('data-hotel-logo-replace')) choose(trigger); else save(trigger,current(),null);
      }
    },true);
    document.addEventListener('keydown',event => {
      if (!openControl) return;
      if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); closeControl(true);}
      else if (['ArrowDown','ArrowUp','Home','End'].includes(event.key) && openControl.contains(event.target)) {
        const buttons = [...openControl.querySelectorAll('[role=menuitem]')]; if (!buttons.length) return;
        event.preventDefault(); const index = buttons.indexOf(document.activeElement);
        buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length-1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length].focus();
      } else if (event.key === 'Tab') closeControl(true);
    });
  }
  const api = {context, logo, set, prepare, icon, refresh};
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HVAccommodationLogos = api;
})(typeof window !== 'undefined' ? window : globalThis);
