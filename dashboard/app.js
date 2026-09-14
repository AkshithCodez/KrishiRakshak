/**
 * KrishiRakshak — Main Application & Surveillance Engine
 *
 * Coordinates:
 * 1. Leaflet.js Real-Time Geographic Outbreak Map
 * 2. Chart.js Top Crop Diseases Bar Visualization
 * 3. Live Backend Telemetry Polling (/api/stats, /api/outbreaks, /api/scans)
 * 4. Live Farmer Web Diagnosis Modal & 1-Click Outbreak Report Dispatcher
 */

const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:8000' : '';

let map = null;
let markersLayer = null;
let chartInstance = null;

// Current Modal Diagnosis State
let currentSelectedFile = null;
let currentSelectedCrop = '';
let currentDiagnosisResult = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  initChart();
  initCropChips();
  if (document.getElementById('map')) fetchAllData();
  initDiagnosticAccessibility();

  // Refresh Button
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      fetchAllData();
    });
  }

  // Auto-refresh every 30 seconds
  if (document.getElementById('map')) setInterval(() => { if (!document.hidden) fetchAllData(); }, 30000);
});

/** Retrieve or generate persistent device UUID for web client */
function getWebDeviceId() {
  let id = localStorage.getItem('krishi_web_device_id');
  if (!id) {
    id = 'web_farmer_' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem('krishi_web_device_id', id);
  }
  return id;
}

/** Initialize Leaflet Map centered on Indian agricultural belt */
function initMap() {
  const mapEl = document.getElementById('map');
  if (!mapEl) return;
  if (typeof L === 'undefined') { mapEl.textContent = 'Map tiles are unavailable. Field reports remain below.'; return; }

  map = L.map('map', {
    scrollWheelZoom: false
  }).setView([18.5204, 76.8567], 5);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
}

/** Initialize Chart.js Bar Chart */
function initChart() {
  const canvas = document.getElementById('diseaseChart');
  if (!canvas || typeof Chart === 'undefined') return;
  const ctx = canvas.getContext('2d');

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        label: 'Field Reports',
        data: [],
        backgroundColor: 'rgba(16, 185, 129, 0.75)',
        borderColor: '#10b981',
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f1913',
          borderColor: '#1c3327',
          borderWidth: 1,
          titleFont: { family: 'Outfit', size: 13 },
          bodyFont: { family: 'Inter', size: 12 },
          padding: 10
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { color: '#8fa89b', stepSize: 1, font: { family: 'Inter', size: 11 } },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        y: {
          ticks: { color: '#f0fdf4', font: { family: 'Inter', size: 11 } },
          grid: { display: false }
        }
      }
    }
  });
}

/** Fetch All Live Surveillance Data from Backend */
async function fetchAllData() {
  await Promise.all([
    fetchStats(),
    fetchOutbreaks(),
    fetchRecentScans()
  ]);
}

/** Fetch Statistics & Metrics */
async function fetchStats() {
  try {
    const res = await fetch(`${API_BASE}/api/stats`);
    if (!res.ok) return;
    const data = await res.json();

    const totalScansEl = document.getElementById('metricTotalScans');
    const devicesEl = document.getElementById('metricDevices');
    const outbreaksEl = document.getElementById('metricOutbreaks');
    const scans7dEl = document.getElementById('metricScans7d');

    if (totalScansEl) totalScansEl.textContent = data.total_scans;
    if (devicesEl) devicesEl.textContent = data.total_devices;
    if (outbreaksEl) outbreaksEl.textContent = data.total_outbreaks_active;
    if (scans7dEl) scans7dEl.textContent = `${data.scans_last_7_days} in last 7 days`;

    // Update Hero outbreak counter
    const heroCounter = document.getElementById('heroOutbreakCounter');
    if (heroCounter) {
      const count = data.total_outbreaks_active || 0;
      heroCounter.textContent = `${count} Active Outbreak${count === 1 ? '' : 's'} Detected`;
    }

    // Update Chart
    if (chartInstance && data.disease_frequency && data.disease_frequency.length > 0) {
      chartInstance.data.labels = data.disease_frequency.map(d => `${d.crop} - ${d.disease}`);
      chartInstance.data.datasets[0].data = data.disease_frequency.map(d => d.count);
      chartInstance.update();
    }
  } catch (err) {
    console.warn('Stats fetch notice:', err);
  }
}

/** Fetch Active Outbreaks & Render Alerts */
async function fetchOutbreaks() {
  try {
    const res = await fetch(`${API_BASE}/api/outbreaks`);
    if (!res.ok) return;
    const data = await res.json();

    const listEl = document.getElementById('outbreakList');
    const badgeEl = document.getElementById('outbreakCountBadge');
    const navStatus = document.getElementById('navOutbreakStatus');

    if (badgeEl) badgeEl.textContent = `${data.total} Alert${data.total === 1 ? '' : 's'}`;
    if (navStatus) {
      navStatus.textContent = data.total > 0 ? `${data.total} Active Outbreak Alert${data.total === 1 ? '' : 's'}` : 'Surveillance Active';
    }

    if (!listEl) return;

    if (data.total === 0) {
      listEl.innerHTML = '<div class="empty-state">No active regional outbreaks detected.<br><small>Alerts trigger when ≥3 distinct farmers report matching disease in a ~5km cell.</small></div>';
      return;
    }

    listEl.innerHTML = data.alerts.map(a => `
      <div class="outbreak-card">
        <div class="outbreak-title">
          <span>⚠️ ${a.crop} — ${a.disease}</span>
          <span class="outbreak-count-tag">${a.case_count} Reports</span>
        </div>
        <div class="outbreak-meta">
          <span>📍 Cell: <code>${a.geohash}</code> (~5km)</span>
          <span>📅 Last active: ${new Date(a.last_reported).toLocaleDateString()}</span>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.warn('Outbreaks fetch notice:', err);
  }
}

/** Fetch Recent Scans & Render Markers + Table */
async function fetchRecentScans() {
  try {
    const res = await fetch(`${API_BASE}/api/scans?limit=50`);
    if (!res.ok) return;
    const data = await res.json();

    const badgeEl = document.getElementById('scansCountBadge');
    if (badgeEl) badgeEl.textContent = `${data.total} Scans`;

    // Render Table
    const tableBody = document.getElementById('recentScansBody');
    if (tableBody) {
      if (data.scans.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="empty-cell">No scan reports recorded yet. Use "Check My Crop" to submit.</td></tr>';
      } else {
        tableBody.innerHTML = data.scans.slice(0, 10).map(s => {
          const isHealthy = s.disease.toLowerCase().includes('healthy');
          const confPct = Math.round(s.confidence * 100);
          return `
            <tr>
              <td><strong>${s.crop}</strong></td>
              <td style="color: ${isHealthy ? '#10b981' : '#f59e0b'}">${s.disease}</td>
              <td>${confPct}%</td>
              <td><code>${s.geohash ? s.geohash.substring(0, 6) : 'N/A'}</code></td>
              <td>${new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
            </tr>
          `;
        }).join('');
      }
    }

    // Render Map Markers
    if (markersLayer && map) {
      markersLayer.clearLayers();
      data.scans.forEach(s => {
        const isHealthy = s.disease.toLowerCase().includes('healthy');
        const color = isHealthy ? '#10b981' : '#f59e0b';

        const circle = L.circleMarker([s.latitude, s.longitude], {
          radius: 7,
          fillColor: color,
          color: '#ffffff',
          weight: 1.5,
          opacity: 0.9,
          fillOpacity: 0.8
        });

        circle.bindPopup(`
          <div style="font-family: 'Inter', sans-serif; font-size: 12px; color: #111;">
            <strong style="font-size: 13px;">${s.crop} — ${s.disease}</strong><br>
            Match: ${(s.confidence * 100).toFixed(1)}%<br>
            Location: ${s.latitude.toFixed(3)}, ${s.longitude.toFixed(3)}<br>
            <small style="color: #666;">${new Date(s.created_at).toLocaleString()}</small>
          </div>
        `);

        markersLayer.addLayer(circle);
      });

      if (data.scans.length > 0) {
        const group = new L.featureGroup(markersLayer.getLayers());
        map.fitBounds(group.getBounds().pad(0.3));
      }
    }
  } catch (err) {
    console.warn('Scans fetch notice:', err);
  }
}

// ── 5. FARMER WEB DIAGNOSTIC MODAL WORKFLOW ───────────────────────────────

function initCropChips() {
  const chips = document.querySelectorAll('.crop-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentSelectedCrop = chip.getAttribute('data-crop') || '';
      invalidateDiagnosis();
    });
  });
}

window.openDiagnosticModal = function(preselectedCrop = '') {
  const modal = document.getElementById('diagnosticModal');
  if (!modal) return;
  lastModalFocus = document.activeElement;
  modal.classList.add('open');
  [...document.body.children].filter(el => !el.contains(modal)).forEach(el => { if (!el.inert) { el.inert = true; modalInertElements.push(el); } });
  modal.querySelector('.btn-close-modal').focus();
  document.body.style.overflow = 'hidden';

  if (preselectedCrop) {
    currentSelectedCrop = preselectedCrop;
    const chips = document.querySelectorAll('.crop-chip');
    chips.forEach(chip => {
      if (chip.getAttribute('data-crop') === preselectedCrop) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });
  }
};

window.closeDiagnosticModal = function() {
  const modal = document.getElementById('diagnosticModal');
  if (!modal) return;
  modal.classList.remove('open');
  modalInertElements.forEach(el => el.inert = false);
  modalInertElements = [];
  lastModalFocus?.focus();
  document.body.style.overflow = '';
};

let lastModalFocus = null;
let modalInertElements = [];
let diagnosisGeneration = 0;
let reportPending = false;
function diagnosticStatus(message) {
  document.getElementById('diagnosticStatus').textContent = message;
}
function invalidateDiagnosis() {
  diagnosisGeneration++;
  currentDiagnosisResult = null;
  document.getElementById('diagResultBox').style.display = 'none';
}
function initDiagnosticAccessibility() {
  const modal = document.getElementById('diagnosticModal');
  if (!modal) return;
  document.getElementById('dropzoneBox').addEventListener('keydown',event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); document.getElementById('leafFileInput').click(); }
  });
  modal.addEventListener('keydown',event => {
    if(event.key === 'Escape') { closeDiagnosticModal(); return; }
    if(event.key !== 'Tab') return;
    const focusable = [...modal.querySelectorAll('button:not([disabled]), a[href], input:not([hidden]), [tabindex="0"]')].filter(el=>el.getClientRects().length);
    const first=focusable[0], last=focusable[focusable.length-1];
    if(event.shiftKey && document.activeElement===first) { event.preventDefault(); last.focus(); }
    else if(!event.shiftKey && document.activeElement===last) { event.preventDefault(); first.focus(); }
  });
}
window.handleLeafFileSelect = function(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  invalidateDiagnosis();
  currentSelectedFile = null;
  const runBtn = document.getElementById('runDiagBtn');
  runBtn.disabled = true;
  if(!['image/jpeg','image/png','image/bmp','image/webp'].includes(file.type) || file.size>5*1024*1024) {
    diagnosticStatus('Choose a JPG, PNG, BMP or WebP image smaller than 5 MB.');
    document.getElementById('leafPreviewImg').style.display='none';
    document.getElementById('dropzonePrompt').style.display='block';
    return;
  }
  currentSelectedFile = file;
  diagnosticStatus('Photo selected. Choose your crop if known, then run the diagnosis.');
  const reader = new FileReader();
  reader.onload = e => {
    if(currentSelectedFile !== file) return;
    const preview = document.getElementById('leafPreviewImg');
    preview.src = e.target.result;
    preview.style.display = 'block';
    document.getElementById('dropzonePrompt').style.display = 'none';
    runBtn.disabled = false;
  };
  reader.readAsDataURL(file);
};

window.runLeafDiagnosis = async function() {
  if (!currentSelectedFile) return;
  const runBtn = document.getElementById('runDiagBtn');
  invalidateDiagnosis();
  const generation = diagnosisGeneration;
  runBtn.disabled = true;
  runBtn.textContent = 'Analyzing your photo…';
  diagnosticStatus('Analyzing crop symptoms…');
  try {
    const form = new FormData();
    form.append('file',currentSelectedFile);
    const query = currentSelectedCrop ? `?crop=${encodeURIComponent(currentSelectedCrop)}` : '';
    const response = await fetch(`${API_BASE}/api/diagnose${query}`,{method:'POST',body:form,signal:AbortSignal.timeout(60000)});
    const result = await response.json();
    if(generation !== diagnosisGeneration) return;
    if(!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'Diagnosis could not be completed. Try again.');
    if(result.is_supported === false || result.status === 'unsupported' || !result.prediction) {
      diagnosticStatus(result.message || 'This photo could not be classified reliably. Try a clearer photo of a supported crop leaf.');
      return;
    }
    if(result.demo_mode) { diagnosticStatus('The model is in demo mode. A trained checkpoint is needed for a crop diagnosis.'); return; }
    currentDiagnosisResult = {...result.prediction,top_3:result.top_3 || []};
    document.getElementById('diagResultCrop').textContent = currentDiagnosisResult.crop;
    document.getElementById('diagResultConfidence').textContent = Number.isFinite(currentDiagnosisResult.confidence) ? `${Math.round(currentDiagnosisResult.confidence*100)}% model confidence` : '';
    document.getElementById('diagResultDisease').textContent = currentDiagnosisResult.disease;
    document.getElementById('diagResultTreatment').textContent = currentDiagnosisResult.treatment;
    const alternatives = document.getElementById('diagTop3List');
    alternatives.replaceChildren();
    currentDiagnosisResult.top_3.forEach(candidate=>{
      const row=document.createElement('div'); row.className='top3-row';
      const label=document.createElement('span'); label.textContent=`${candidate.crop} — ${candidate.disease}`;
      const score=document.createElement('strong'); score.textContent=Number.isFinite(candidate.confidence) ? `${Math.round(candidate.confidence*100)}%` : '';
      row.append(label,score); alternatives.append(row);
    });
    document.getElementById('diagTop3Box').hidden = !currentDiagnosisResult.top_3.length;
    document.getElementById('diagResultBox').style.display='block';
    const reportBtn=document.getElementById('submitScanReportBtn');
    reportBtn.style.display='block'; reportBtn.disabled=false; reportBtn.textContent='Share location & report';
    document.getElementById('reportSuccessBadge').style.display='none';
    diagnosticStatus('Analysis complete. Review the possible diagnosis below.');
    document.getElementById('diagResultBox').scrollIntoView({block:'nearest',behavior:'instant'});
  } catch(error) {
    if(generation===diagnosisGeneration) diagnosticStatus(error.name==='TimeoutError' ? 'Analysis timed out. Please try again.' : error.message === 'Failed to fetch' ? 'The diagnosis service is unavailable. Please try again when connected.' : error.message);
  } finally {
    runBtn.disabled = !currentSelectedFile;
    runBtn.textContent = 'Run AI diagnosis';
  }
};

window.submitCurrentScanReport = async function() {
  if(!currentDiagnosisResult || reportPending) return;
  const result = currentDiagnosisResult;
  const reportBtn=document.getElementById('submitScanReportBtn');
  const success=document.getElementById('reportSuccessBadge');
  reportPending=true; reportBtn.disabled=true; reportBtn.textContent='Getting your field location…';
  try {
    if(!navigator.geolocation) throw new Error('Location is unavailable on this device. Your diagnosis is still available.');
    const position=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000,maximumAge:60000}));
    if(result!==currentDiagnosisResult) throw new Error('The photo or crop changed. Run the diagnosis again before reporting.');
    reportBtn.textContent='Submitting your report…';
    const response=await fetch(`${API_BASE}/api/scans`,{
      method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(30000),
      body:JSON.stringify({device_id:getWebDeviceId(),crop:result.crop,disease:result.disease,confidence:result.confidence,latitude:position.coords.latitude,longitude:position.coords.longitude,treatment:result.treatment})
    });
    if(!response.ok) throw new Error(`Report was not saved (server ${response.status}). Please try again.`);
    reportBtn.style.display='none';
    success.textContent='Report saved. Your observation is now part of the regional view.';
    success.style.display='block';
    diagnosticStatus('Your report was submitted successfully.');
    if(document.getElementById('map')) fetchAllData();
  } catch(error) {
    diagnosticStatus(error.code===1 ? 'Location permission was declined. No report was submitted. Your diagnosis is still available.' : error.code===2 || error.code===3 ? 'Could not get your location. No report was submitted. Try again from the field.' : error.message);
    reportBtn.disabled=false;
    reportBtn.textContent='Retry location & report';
  } finally { reportPending=false; }
};
