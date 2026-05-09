'use strict';

// ── Theme colors ───────────────────────────────────────────────
const COLORS = {
  purple: '#bf00ff',
  green:  '#00f7ff',
  red:    '#ff0055',
  amber:  '#ffcc00',
  text:   '#ffffff',
  text2:  '#c0c0c0',
  border: 'rgba(191, 0, 255, 0.1)'
};

// ── State ───────────────────────────────────────────────────────
let todayChart = null;
let weekChart = null;

// ── Init ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await renderDashboard();
});

async function renderDashboard() {
  const data = await chrome.storage.local.get(['usage', 'history']);
  const usage = data.usage || {};
  const history = data.history || [];

  const today = new Date().toDateString();
  const todayData = usage[today] || {};

  updateOverview(todayData, history);
  renderTodayDistribution(todayData);
  renderWeekHistory(usage);
  renderSiteBreakdown(todayData);
}

// ── Overview ────────────────────────────────────────────────────
function updateOverview(todayData, history) {
  let totalSecs = 0;
  let topSite = '-';
  let maxTime = 0;

  for (const [site, secs] of Object.entries(todayData)) {
    totalSecs += secs;
    if (secs > maxTime) {
      maxTime = secs;
      topSite = site;
    }
  }

  document.getElementById('total-time-today').textContent = formatTimeShort(totalSecs);
  document.getElementById('top-site-today').textContent = topSite;
  document.getElementById('sessions-completed').textContent = history.length;
}

// ── Distribution Chart (Doughnut) ───────────────────────────────
function renderTodayDistribution(todayData) {
  const ctx = document.getElementById('todayChart').getContext('2d');
  
  const entries = Object.entries(todayData).sort((a, b) => b[1] - a[1]);
  const labels = entries.slice(0, 5).map(e => e[0]);
  const values = entries.slice(0, 5).map(e => Math.round(e[1] / 60));

  if (entries.length > 5) {
    const otherSum = entries.slice(5).reduce((acc, curr) => acc + curr[1], 0);
    labels.push('Other');
    values.push(Math.round(otherSum / 60));
  }

  if (todayChart) todayChart.destroy();
  
  if (values.length === 0) {
    // Handle empty state
    return;
  }

  todayChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: [
          COLORS.purple,
          '#9d00d1',
          '#7b00a3',
          '#590075',
          '#370047',
          '#150019'
        ],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: COLORS.text2, font: { family: 'DM Sans' }, usePointStyle: true }
        }
      },
      cutout: '70%'
    }
  });
}

// ── Week History Chart (Bar) ────────────────────────────────────
function renderWeekHistory(usage) {
  const ctx = document.getElementById('weekChart').getContext('2d');
  const labels = [];
  const values = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toDateString();
    labels.push(i === 0 ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' }));
    
    const dayData = usage[dateStr] || {};
    const totalMins = Object.values(dayData).reduce((a, b) => a + b, 0) / 60;
    values.push(Math.round(totalMins));
  }

  if (weekChart) weekChart.destroy();

  weekChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Minutes',
        data: values,
        backgroundColor: COLORS.purple,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: COLORS.border },
          ticks: { color: COLORS.text2 }
        },
        x: {
          grid: { display: false },
          ticks: { color: COLORS.text2 }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// ── Site Breakdown Table ───────────────────────────────────────
function renderSiteBreakdown(todayData) {
  const table = document.getElementById('site-table');
  table.innerHTML = '';

  const entries = Object.entries(todayData).sort((a, b) => b[1] - a[1]);
  const totalSecs = entries.reduce((acc, curr) => acc + curr[1], 0);

  entries.forEach(([site, secs]) => {
    const row = document.createElement('div');
    row.className = 'site-row';
    
    const pct = totalSecs > 0 ? Math.round((secs / totalSecs) * 100) : 0;
    
    row.innerHTML = `
      <div class="site-info">
        <div class="site-dot"></div>
        <span class="site-name">${site}</span>
      </div>
      <div class="site-time">${formatTimeShort(secs)}</div>
      <div class="site-pct">${pct}%</div>
    `;
    table.appendChild(row);
  });
}

// ── Helpers ─────────────────────────────────────────────────────
function formatTimeShort(seconds) {
  if (seconds < 60) return seconds + 's';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return mins + 'm';
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return hrs + 'h ' + (remMins > 0 ? remMins + 'm' : '');
}