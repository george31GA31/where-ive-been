function populateProfileSelects() {
  let opts = state.profiles
    .map(
      (p) =>
        `<option value="${esc(p.id)}" ${p.id === state.activeProfileId ? 'selected' : ''}>${esc(p.name)}</option>`,
    )
    .join('');
  els.plannerProfile.innerHTML = opts;
  els.stayProfile.innerHTML = '<option value="">All / shared</option>' + opts;
}
function renderProfiles() {
  let p = activeProfile();
  els.profileList.innerHTML = state.profiles
    .map(
      (x) =>
        `<div class="profile-card ${x.id === p.id ? 'active' : ''}"><div><h3>${esc(x.name)} ${x.id === p.id ? '<span class="pill">ACTIVE</span>' : ''}</h3><p>${x.citizenships.length ? x.citizenships.map((c) => flagHtml(c, 'flag-img flag-sm') + ' ' + esc(countryByCode(c)?.name || c)).join(' · ') : 'No citizenship added yet'}</p></div><div class="profile-actions">${x.id !== p.id ? `<button class="tiny-btn" data-action="set-profile" data-id="${x.id}">Use</button>` : ''}<button class="tiny-btn" data-action="edit-profile" data-id="${x.id}">Edit</button></div></div>`,
    )
    .join('');
  populateProfileSelects();
  renderResidences();
}
function openProfileDialog(id = null) {
  let p = id ? state.profiles.find((x) => x.id === id) : null;
  els.profileForm.reset();
  els.profileId.value = id || '';
  els.profileName.value = p?.name || '';
  profileCitizenships = [...(p?.citizenships || [])];
  els.profileDialogTitle.textContent = id ? 'Edit profile' : 'Add profile';
  els.deleteProfileBtn.classList.toggle('hidden', !id || state.profiles.length === 1);
  els.profileError.textContent = '';
  renderCitizenshipChips();
  els.profileDialog.showModal();
}
function addCitizenship() {
  let c = countryByName(els.citizenshipInput.value);
  if (!c || c.code === 'SEA' || c.code === 'BOU') {
    els.profileError.textContent = 'Choose a valid passport/citizenship country.';
    return;
  }
  if (!profileCitizenships.includes(c.code)) profileCitizenships.push(c.code);
  els.citizenshipInput.value = '';
  els.profileError.textContent = '';
  renderCitizenshipChips();
}
function renderCitizenshipChips() {
  els.citizenshipChips.innerHTML = profileCitizenships
    .map(
      (c) =>
        `<span class="chip">${flagHtml(c, 'flag-img flag-sm')} ${esc(countryByCode(c)?.name || c)} <button type="button" data-remove-cit="${c}">×</button></span>`,
    )
    .join('');
  els.citizenshipChips.querySelectorAll('[data-remove-cit]').forEach(
    (b) =>
      (b.onclick = () => {
        profileCitizenships = profileCitizenships.filter((c) => c !== b.dataset.removeCit);
        renderCitizenshipChips();
      }),
  );
}
function saveProfile(e) {
  e.preventDefault();
  let name = els.profileName.value.trim();
  if (!name) {
    els.profileError.textContent = 'Add a name.';
    return;
  }
  let id = els.profileId.value;
  if (id) {
    let p = state.profiles.find((x) => x.id === id);
    p.name = name;
    p.citizenships = [...profileCitizenships];
  } else {
    let p = { id: uid(), name, citizenships: [...profileCitizenships], enabledRules: ['schengen'] };
    state.profiles.push(p);
    state.activeProfileId = p.id;
  }
  persist();
  els.profileDialog.close();
  renderAll();
}
function deleteProfile() {
  let id = els.profileId.value;
  if (state.profiles.length <= 1) return;
  state.profiles = state.profiles.filter((p) => p.id !== id);
  state.stays.forEach((s) => {
    if (s.profileId === id) s.profileId = null;
  });
  state.residences.forEach((r) => {
    if (r.profileId === id) r.profileId = null;
  });
  for (const key of [
    'transports',
    'accommodations',
    'placeVisits',
    'savedPlaces',
    'visaAcknowledgements',
    'roadTrips',
    'currencyRates',
    'currencyPreferences',
    'manualCountryVisits',
    'tccVisits',
  ])
    (state[key] || []).forEach((r) => {
      if (r.profileId === id) r.profileId = null;
    });
  if (state.activeProfileId === id) state.activeProfileId = state.profiles[0].id;
  persist();
  els.profileDialog.close();
  renderAll();
}
function saveResidence(e) {
  e.preventDefault();
  let c = countryByName(els.residenceCountry.value);
  if (!c) {
    els.residenceError.textContent = 'Choose a valid country.';
    return;
  }
  if (c.code === 'SEA') {
    els.residenceError.textContent =
      'At Sea can be recorded as travel, but not as a place you lived.';
    return;
  }
  let start = els.residenceStart.value,
    end = els.residencePresent.checked ? null : els.residenceEnd.value;
  if (!start) {
    els.residenceError.textContent = 'Add the date you started living there.';
    return;
  }
  if (!els.residencePresent.checked && !end) {
    els.residenceError.textContent = 'Add an end date or choose Present.';
    return;
  }
  if (end && end < start) {
    els.residenceError.textContent = 'The end date cannot be before the start date.';
    return;
  }
  state.residences.push({
    id: uid(),
    countryCode: c.code,
    countryName: c.name,
    start,
    end,
    profileId: state.activeProfileId,
  });
  persist();
  els.residenceForm.reset();
  els.residenceEnd.disabled = false;
  els.residenceError.textContent = '';
  renderResidences();
  renderDashboard();
}
function renderResidences() {
  if (!els.residenceList) return;
  let rows = (state.residences || [])
    .filter((r) => !r.profileId || r.profileId === state.activeProfileId)
    .sort((a, b) => b.start.localeCompare(a.start));
  if (!rows.length) {
    els.residenceList.className = 'stay-list empty-state';
    els.residenceList.textContent = "You haven't added anywhere you've lived yet.";
    return;
  }
  els.residenceList.className = 'stay-list';
  els.residenceList.innerHTML = rows
    .map(
      (r) =>
        `<div class="stay-row"><div class="flag-box">${flagHtml(r.countryCode)}</div><div class="stay-main"><strong>${esc(r.countryName)}</strong><span>${fmt(r.start)} – ${r.end ? fmt(r.end) : 'Present'}</span></div><button type="button" class="tiny-btn" data-action="delete-residence" data-id="${r.id}">Remove</button></div>`,
    )
    .join('');
}
function deleteResidence(id) {
  state.residences = (state.residences || []).filter((r) => r.id !== id);
  persist();
  renderResidences();
  renderDashboard();
}
