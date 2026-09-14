/**
 * KrishiRakshak — Farmer Portal Application
 *
 * Screens:
 *   lang     → Language selection (first-run only)
 *   phone    → Phone number entry
 *   otp      → OTP verification
 *   home     → Farmer home (4 main actions)
 *   diagnose → Crop diagnosis flow
 *   nearby   → Nearby disease alerts
 *   reports  → My submitted reports
 *
 * Auth contract:
 *   POST /api/auth/otp/send   { phone_number }
 *   POST /api/auth/otp/verify { phone_number, otp }
 *
 * Diagnosis contract:
 *   POST /api/diagnose  FormData { file, crop? }
 *   → { disease, crop, confidence, top3, treatment }
 *
 * Reports contract:
 *   POST /api/scans     FormData { file, crop, disease, lat, lng }
 *   GET  /api/scans     → list
 *   GET  /api/outbreaks → list
 */

import { initI18n, setLanguage, t, currentLang, hasLanguageChoice, allLanguages } from './i18n.js';

const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:8000' : '';

// ── State ──────────────────────────────────────────────────────
const state = {
  phone: '',
  sessionToken: null,
  currentScreen: null,
  selectedCrop: '',
  selectedFile: null,
  lastDiagnosis: null,
  resendCooldown: null,
};

// ── Routing ─────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('screen' + id.charAt(0).toUpperCase() + id.slice(1));
  if (target) {
    target.classList.add('active');
    target.scrollTop = 0;
  }
  state.currentScreen = id;
}

// ── i18n helpers ────────────────────────────────────────────────
function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const str = t(key);
    if (str && str !== key) el.textContent = str;
  });
  // Update bottom nav labels across all screens
  document.querySelectorAll('#bnav-home').forEach(el => el.textContent = t('nav.farmerPortal') || 'Home');
}

// ── Language Screen ──────────────────────────────────────────────
async function buildLangGrid() {
  const grid = document.getElementById('langGrid');
  if (!grid) return;
  grid.innerHTML = '<p style="color:#556250;font-size:13px;text-align:center;padding:16px">Loading…</p>';
  try {
    const langs = await allLanguages();
    grid.innerHTML = '';
    langs.forEach(({ code, name, choose }) => {
      const btn = document.createElement('button');
      btn.className = 'lang-option';
      btn.setAttribute('role', 'listitem');
      btn.setAttribute('lang', code);
      btn.setAttribute('aria-label', `${name} — ${choose}`);
      btn.innerHTML = `<span class="lang-option-name">${name}</span><span class="lang-option-en">${choose}</span>`;
      btn.addEventListener('click', async () => {
        await setLanguage(code);
        applyTranslations();
        // Go straight to phone entry (first run picks language then auth)
        showScreen('phone');
      });
      grid.appendChild(btn);
    });
  } catch {
    grid.innerHTML = '<p style="color:#e05252;font-size:13px;text-align:center;padding:16px">Could not load languages.</p>';
  }
}

// ── Phone Screen ─────────────────────────────────────────────────
function setupPhoneScreen() {
  const input = document.getElementById('phoneInput');
  const btn = document.getElementById('sendOtpBtn');
  const err = document.getElementById('phoneError');

  // Only allow digits
  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '').slice(0, 10);
    err.hidden = true;
  });

  btn.addEventListener('click', async () => {
    const phone = input.value.trim();
    if (!/^\d{10}$/.test(phone)) {
      err.textContent = t('farmer.otp.errorPhone');
      err.hidden = false;
      input.focus();
      return;
    }
    state.phone = phone;
    btn.disabled = true;
    const btnText = document.getElementById('sendOtpBtnText');
    btnText.textContent = t('farmer.otp.sending');

    try {
      const res = await fetch(`${API_BASE}/api/auth/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone }),
      });
      if (!res.ok) throw new Error('Send failed');
      // Navigate to OTP screen
      showScreen('otp');
      startOtpBoxes();
      startResendCooldown();
    } catch {
      err.textContent = t('common.error');
      err.hidden = false;
    } finally {
      btn.disabled = false;
      btnText.textContent = t('farmer.otp.sendBtn');
    }
  });

  document.getElementById('phoneBackBtn').addEventListener('click', () => {
    showScreen('lang');
  });
}

// ── OTP Screen ───────────────────────────────────────────────────
function startOtpBoxes() {
  const boxes = [0, 1, 2, 3].map(i => document.getElementById(`otp${i}`));
  boxes.forEach(box => { box.value = ''; box.classList.remove('filled', 'error'); });
  boxes[0].focus();

  boxes.forEach((box, i) => {
    box.addEventListener('input', () => {
      box.value = box.value.replace(/\D/g, '').slice(-1);
      if (box.value) {
        box.classList.add('filled');
        if (i < 3) boxes[i + 1].focus();
        else autoVerifyIfFull(boxes);
      } else {
        box.classList.remove('filled');
      }
    });
    box.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !box.value && i > 0) {
        boxes[i - 1].focus();
        boxes[i - 1].value = '';
        boxes[i - 1].classList.remove('filled');
      }
    });
    box.addEventListener('paste', e => {
      e.preventDefault();
      const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 4);
      pasted.split('').forEach((ch, idx) => {
        if (boxes[idx]) { boxes[idx].value = ch; boxes[idx].classList.add('filled'); }
      });
      if (pasted.length === 4) autoVerifyIfFull(boxes);
      else boxes[Math.min(pasted.length, 3)].focus();
    });
  });
}

function autoVerifyIfFull(boxes) {
  const code = boxes.map(b => b.value).join('');
  if (code.length === 4) submitOtp(code);
}

async function submitOtp(code) {
  const err = document.getElementById('otpError');
  const btn = document.getElementById('verifyOtpBtn');
  const btnText = document.getElementById('verifyOtpBtnText');
  const boxes = [0, 1, 2, 3].map(i => document.getElementById(`otp${i}`));

  btn.disabled = true;
  btnText.textContent = t('farmer.otp.verifying');
  err.hidden = true;
  boxes.forEach(b => b.classList.remove('error'));

  try {
    const res = await fetch(`${API_BASE}/api/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number: state.phone, otp: code }),
    });
    const data = await res.json();
    if (data.authenticated) {
      state.sessionToken = data.phone_number;
      if (state.resendCooldown) clearInterval(state.resendCooldown);
      showScreen('home');
    } else {
      err.textContent = t('farmer.otp.errorInvalid');
      err.hidden = false;
      boxes.forEach(b => b.classList.add('error'));
      boxes[0].focus();
    }
  } catch {
    err.textContent = t('common.error');
    err.hidden = false;
  } finally {
    btn.disabled = false;
    btnText.textContent = t('farmer.otp.verifyBtn');
  }
}

function startResendCooldown() {
  const timer = document.getElementById('resendTimer');
  const resend = document.getElementById('resendBtn');
  resend.disabled = true;
  let s = 30;
  timer.textContent = t('farmer.otp.resendIn').replace('{s}', s);

  state.resendCooldown = setInterval(() => {
    s--;
    if (s <= 0) {
      clearInterval(state.resendCooldown);
      timer.textContent = '';
      resend.disabled = false;
    } else {
      timer.textContent = t('farmer.otp.resendIn').replace('{s}', s);
    }
  }, 1000);
}

function setupOtpScreen() {
  document.getElementById('verifyOtpBtn').addEventListener('click', () => {
    const code = [0, 1, 2, 3].map(i => document.getElementById(`otp${i}`).value).join('');
    if (code.length === 4) submitOtp(code);
  });

  document.getElementById('otpBackBtn').addEventListener('click', () => {
    if (state.resendCooldown) clearInterval(state.resendCooldown);
    showScreen('phone');
  });

  document.getElementById('resendBtn').addEventListener('click', async () => {
    try {
      await fetch(`${API_BASE}/api/auth/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: state.phone }),
      });
      startOtpBoxes();
      startResendCooldown();
    } catch { /* silent */ }
  });
}

// ── Home Screen ──────────────────────────────────────────────────
function setupHomeScreen() {
  document.getElementById('diagnoseCropBtn').addEventListener('click', () => {
    showScreen('diagnose');
    syncBottomNav('diagnose');
  });
  document.getElementById('reportDiseaseBtn').addEventListener('click', () => {
    showScreen('diagnose');
    syncBottomNav('diagnose');
  });
  document.getElementById('nearbyAlertsBtn').addEventListener('click', () => {
    showScreen('nearby');
    loadNearbyAlerts();
    syncBottomNav('nearby');
  });
  document.getElementById('myReportsBtn').addEventListener('click', () => {
    showScreen('reports');
    loadMyReports();
    syncBottomNav('reports');
  });
  document.getElementById('langSwitchBtn').addEventListener('click', () => {
    showScreen('lang');
  });
}

// ── Bottom Nav ───────────────────────────────────────────────────
function setupBottomNavs() {
  document.querySelectorAll('.bnav-item[data-screen]').forEach(btn => {
    btn.addEventListener('click', () => {
      const screen = btn.dataset.screen;
      showScreen(screen);
      syncBottomNav(screen);
      if (screen === 'nearby') loadNearbyAlerts();
      if (screen === 'reports') loadMyReports();
    });
  });
}

function syncBottomNav(activeScreen) {
  document.querySelectorAll('.bnav-item[data-screen]').forEach(btn => {
    const isActive = btn.dataset.screen === activeScreen;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
}

// ── Diagnose Screen ──────────────────────────────────────────────
function setupDiagnoseScreen() {
  const photoZone = document.getElementById('photoZone');
  const leafFile = document.getElementById('leafFile');
  const cameraFile = document.getElementById('cameraFile');
  const photoPreview = document.getElementById('photoPreview');
  const photoZoneInner = document.getElementById('photoZoneInner');
  const runBtn = document.getElementById('runAnalysisBtn');

  // Crop pill selection
  document.getElementById('cropPills').addEventListener('click', e => {
    const pill = e.target.closest('.crop-pill');
    if (!pill) return;
    document.querySelectorAll('.crop-pill').forEach(p => {
      p.classList.remove('active');
      p.setAttribute('aria-pressed', 'false');
    });
    pill.classList.add('active');
    pill.setAttribute('aria-pressed', 'true');
    state.selectedCrop = pill.dataset.crop || '';
  });

  // Photo zone click
  photoZone.addEventListener('click', () => leafFile.click());
  photoZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') leafFile.click(); });

  // File handlers
  function handleFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showDiagnoseError('File too large. Please use an image under 5 MB.');
      return;
    }
    state.selectedFile = file;
    const url = URL.createObjectURL(file);
    photoPreview.src = url;
    photoPreview.hidden = false;
    photoZoneInner.style.display = 'none';
    runBtn.disabled = false;
    hideDiagnoseError();
    // Reset result
    document.getElementById('diagResultSection').hidden = true;
    document.getElementById('reportDone').hidden = true;
  }

  leafFile.addEventListener('change', e => handleFile(e.target.files[0]));
  cameraFile.addEventListener('change', e => handleFile(e.target.files[0]));

  document.getElementById('takePhotoBtn').addEventListener('click', () => cameraFile.click());

  // Run analysis
  runBtn.addEventListener('click', runDiagnosis);

  // Back button
  document.getElementById('diagnoseBackBtn').addEventListener('click', () => {
    showScreen('home');
    syncBottomNav('home');
  });

  // Report button
  document.getElementById('submitReportBtn').addEventListener('click', submitReport);
}

function showDiagnoseError(msg) {
  const el = document.getElementById('diagnoseError');
  el.textContent = msg;
  el.hidden = false;
}
function hideDiagnoseError() {
  document.getElementById('diagnoseError').hidden = true;
}

async function runDiagnosis() {
  if (!state.selectedFile) return;
  const btn = document.getElementById('runAnalysisBtn');
  const btnText = document.getElementById('runAnalysisBtnText');
  btn.disabled = true;
  btnText.textContent = t('farmer.diagnoseFlow.analysing');
  hideDiagnoseError();
  document.getElementById('diagResultSection').hidden = true;

  try {
    const fd = new FormData();
    fd.append('file', state.selectedFile);
    if (state.selectedCrop) fd.append('crop', state.selectedCrop);

    const res = await fetch(`${API_BASE}/api/diagnose`, { method: 'POST', body: fd });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.lastDiagnosis = data;
    renderDiagnosisResult(data);
  } catch (err) {
    showDiagnoseError(`${t('common.error')} (${err.message})`);
  } finally {
    btn.disabled = false;
    btnText.textContent = t('farmer.diagnoseFlow.runBtn');
  }
}

function renderDiagnosisResult(data) {
  const section = document.getElementById('diagResultSection');
  document.getElementById('resultCropBadge').textContent = (data.crop || 'CROP').toUpperCase();
  document.getElementById('resultConfBadge').textContent = data.confidence
    ? `${Math.round(data.confidence * 100)}% match` : '';
  document.getElementById('resultDiseaseName').textContent = data.disease || 'Unknown';
  document.getElementById('resultTreatment').textContent = data.treatment || 'Consult your local agricultural officer.';

  // Top 3 alternatives
  const top3El = document.getElementById('resultTop3');
  if (data.top3 && data.top3.length > 1) {
    top3El.innerHTML = '';
    top3El.hidden = false;
    data.top3.slice(0, 3).forEach(item => {
      const div = document.createElement('div');
      div.className = 'alt-item';
      const pct = Math.round((item.confidence || 0) * 100);
      div.innerHTML = `<span>${item.disease}</span><div class="alt-bar-wrap"><div class="alt-bar" style="width:${pct}px"></div><span>${pct}%</span></div>`;
      top3El.appendChild(div);
    });
  } else {
    top3El.hidden = true;
  }

  section.hidden = false;
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function submitReport() {
  if (!state.lastDiagnosis || !state.selectedFile) return;
  const btn = document.getElementById('submitReportBtn');
  btn.disabled = true;
  btn.textContent = t('common.loading');

  try {
    let lat = null, lng = null;
    if ('geolocation' in navigator) {
      try {
        const pos = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 }));
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch { /* user denied or timeout */ }
    }

    const fd = new FormData();
    fd.append('file', state.selectedFile);
    fd.append('disease', state.lastDiagnosis.disease || '');
    fd.append('crop', state.lastDiagnosis.crop || '');
    fd.append('confidence', state.lastDiagnosis.confidence || 0);
    if (lat !== null) { fd.append('latitude', lat); fd.append('longitude', lng); }
    fd.append('device_id', getDeviceId());

    await fetch(`${API_BASE}/api/scans`, { method: 'POST', body: fd });
    document.getElementById('reportDone').hidden = false;
    btn.hidden = true;
  } catch {
    btn.disabled = false;
    btn.textContent = t('farmer.diagnoseFlow.reportBtn');
    showDiagnoseError(t('common.error'));
  }
}

// ── Nearby Alerts ────────────────────────────────────────────────
async function loadNearbyAlerts() {
  const status = document.getElementById('nearbyStatus');
  const list = document.getElementById('nearbyList');
  status.textContent = t('farmer.nearbyAlerts.loading');
  status.hidden = false;
  list.innerHTML = '';

  try {
    const res = await fetch(`${API_BASE}/api/outbreaks`);
    const data = await res.json();
    const items = Array.isArray(data) ? data : (data.outbreaks || []);

    if (items.length === 0) {
      status.textContent = t('farmer.nearbyAlerts.empty');
    } else {
      status.hidden = true;
      items.slice(0, 10).forEach(item => {
        const el = document.createElement('div');
        el.className = 'report-item';
        const crop = item.crop || '';
        const disease = item.disease || item.top_disease || 'Unknown disease';
        const count = item.farmer_count || item.count || '';
        el.innerHTML = `
          <div class="report-item-crop">${crop}</div>
          <div class="report-item-disease">${disease}</div>
          <div class="report-item-meta">${count ? count + ' reports nearby' : 'Recent activity'} · ${formatDate(item.created_at || item.last_seen)}</div>
        `;
        list.appendChild(el);
      });
    }
  } catch {
    status.textContent = t('common.error');
  }
}

// ── My Reports ───────────────────────────────────────────────────
async function loadMyReports() {
  const status = document.getElementById('reportsStatus');
  const list = document.getElementById('myReportsList');
  status.textContent = t('common.loading');
  status.hidden = false;
  list.innerHTML = '';

  try {
    const res = await fetch(`${API_BASE}/api/scans?device_id=${encodeURIComponent(getDeviceId())}&limit=20`);
    const data = await res.json();
    const items = Array.isArray(data) ? data : (data.scans || data.items || []);

    if (items.length === 0) {
      status.textContent = t('farmer.myReports.empty');
    } else {
      status.hidden = true;
      items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'report-item';
        el.innerHTML = `
          <div class="report-item-crop">${item.crop || ''}</div>
          <div class="report-item-disease">${item.disease || item.diagnosis || 'Unknown'}</div>
          <div class="report-item-meta">${formatDate(item.created_at || item.timestamp)}</div>
        `;
        list.appendChild(el);
      });
    }
  } catch {
    status.textContent = t('common.error');
  }
}

// ── Utils ────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(currentLang(), { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

function getDeviceId() {
  let id = localStorage.getItem('kr_device_id');
  if (!id) {
    id = 'farmer_' + Math.random().toString(36).substring(2, 12);
    localStorage.setItem('kr_device_id', id);
  }
  return id;
}

// ── Boot ─────────────────────────────────────────────────────────
async function boot() {
  // Initialize i18n — load persisted language or English
  const forced = new URLSearchParams(location.search).get('lang') || null;
  await initI18n(forced);
  applyTranslations();

  // Setup all screens
  await buildLangGrid();
  setupPhoneScreen();
  setupOtpScreen();
  setupHomeScreen();
  setupDiagnoseScreen();
  setupBottomNavs();

  // Back buttons for list screens
  document.getElementById('nearbyBackBtn').addEventListener('click', () => { showScreen('home'); syncBottomNav('home'); });
  document.getElementById('reportsBackBtn').addEventListener('click', () => { showScreen('home'); syncBottomNav('home'); });

  // Decide starting screen
  if (!hasLanguageChoice()) {
    showScreen('lang');
  } else if (!state.sessionToken) {
    showScreen('phone');
  } else {
    showScreen('home');
  }
}

boot();
