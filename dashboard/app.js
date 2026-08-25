/**
 * KrishiRakshak — Dashboard Logic
 * Integrates Leaflet.js map, Chart.js statistics, and live outbreak feeds.
 */

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:8000' 
  : '';

let map = null;
let markersLayer = null;
let chartInstance = null;

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  initChart();
  fetchAllData();

  // Refresh Button
  document.getElementById('refreshBtn').addEventListener('click', () => {
    fetchAllData();
  });

  // Auto-refresh every 30 seconds
  setInterval(fetchAllData, 30000);
});

/** Initialize Leaflet Map centered on India agricultural belt */
function initMap() {
  map = L.map('map').setView([18.5204, 76.8567], 5);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
}

/** Initialize Chart.js Bar Chart */
function initChart() {
  const ctx = document.getElementById('diseaseChart').getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        label: 'Field Reports',
        data: [],
        backgroundColor: 'rgba(16, 185, 129, 0.7)',
        borderColor: '#10b981',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { color: '#8fa89b', stepSize: 1 },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        y: {
          ticks: { color: '#e6f1ed', font: { size: 11 } },
          grid: { display: false }
        }
      }
    }
  });
}

/** Fetch All Data from Backend APIs */
async function fetchAllData() {
  await Promise.all([
    fetchStats(),
    fetchOutbreaks(),
    fetchRecentScans()
  ]);
}

/** Fetch Stats & Update Top Metrics & Chart */
async function fetchStats() {
  try {
    const res = await fetch(`${API_BASE}/api/stats`);
    if (!res.ok) return;
    const data = await res.json();

    document.getElementById('metricTotalScans').textContent = data.total_scans;
    document.getElementById('metricDevices').textContent = data.total_devices;
    document.getElementById('metricOutbreaks').textContent = data.total_outbreaks_active;
    document.getElementById('metricScans7d').textContent = `${data.scans_last_7_days} in last 7 days`;

    // Update Chart
    if (data.disease_frequency && data.disease_frequency.length > 0) {
      chartInstance.data.labels = data.disease_frequency.map(d => `${d.crop} - ${d.disease}`);
      chartInstance.data.datasets[0].data = data.disease_frequency.map(d => d.count);
      chartInstance.update();
    }
  } catch (err) {
    console.warn('Could not fetch stats:', err);
  }
}

/** Fetch Outbreak Alerts & Render Alert Cards */
async function fetchOutbreaks() {
  try {
    const res = await fetch(`${API_BASE}/api/outbreaks`);
    if (!res.ok) return;
    const data = await res.json();

    const listEl = document.getElementById('outbreakList');
    const badgeEl = document.getElementById('outbreakCountBadge');
    badgeEl.textContent = `${data.total} Alert${data.total === 1 ? '' : 's'}`;

    if (data.total === 0) {
      listEl.innerHTML = '<div class="empty-state">No active regional outbreaks detected.<br><small>Requires ≥3 distinct farmer reports in ~5km cell.</small></div>';
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
    console.warn('Could not fetch outbreaks:', err);
  }
}

/** Fetch Recent Scans & Render Map Pins + Table */
async function fetchRecentScans() {
  try {
    const res = await fetch(`${API_BASE}/api/scans?limit=50`);
    if (!res.ok) return;
    const data = await res.json();

    document.getElementById('scansCountBadge').textContent = `${data.total} Scans`;

    // Update Table
    const tableBody = document.getElementById('recentScansBody');
    if (data.scans.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" class="empty-cell">No scan reports recorded yet.</td></tr>';
      return;
    }

    tableBody.innerHTML = data.scans.slice(0, 10).map(s => {
      const isHealthy = s.disease.toLowerCase().includes('healthy');
      const confPct = Math.round(s.confidence * 100);
      return `
        <tr>
          <td><strong>${s.crop}</strong></td>
          <td style="color: ${isHealthy ? '#10b981' : '#f59e0b'}">${s.disease}</td>
          <td>${confPct}%</td>
          <td><code>${s.geohash.substring(0, 6)}</code></td>
          <td>${new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
        </tr>
      `;
    }).join('');

    // Update Map Pins
    markersLayer.clearLayers();
    data.scans.forEach(s => {
      const isHealthy = s.disease.toLowerCase().includes('healthy');
      const color = isHealthy ? '#10b981' : '#f59e0b';

      const circle = L.circleMarker([s.latitude, s.longitude], {
        radius: 7,
        fillColor: color,
        color: '#fff',
        weight: 1,
        opacity: 0.9,
        fillOpacity: 0.75
      });

      circle.bindPopup(`
        <strong>${s.crop} — ${s.disease}</strong><br>
        Confidence: ${(s.confidence * 100).toFixed(1)}%<br>
        Device: <code>${s.device_id}</code><br>
        <small>${new Date(s.created_at).toLocaleString()}</small>
      `);

      markersLayer.addLayer(circle);
    });

  } catch (err) {
    console.warn('Could not fetch scans:', err);
  }
}
