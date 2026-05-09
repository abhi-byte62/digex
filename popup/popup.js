'use strict';

// ── Mode descriptions ───────────────────────────────────────────
const MODE_DESC = {
  deep:     'Hard block — distraction sites redirect instantly. No override possible.',
  soft:     '10-second friction screen on blocked sites. You can still proceed, but you\'ll be aware.',
  pomodoro: '25 min work + 5 min break cycles. Sites auto-unlock during break time.'
};

// ── Default blocked sites ───────────────────────────────────────
const DEFAULT_SITES = ['youtube.com', 'twitter.com', 'instagram.com'];

// ── State ───────────────────────────────────────────────────────
let currentMode = 'deep';
let timerInterval = null;

// ── DOM refs ────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Init ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  loadDefaultSites();
  bindIdleEvents();
  bindActiveEvents();
  bindSummaryEvents();

  // Check if a session is already running
  const session = await getSession();
  if (session) {
    renderActiveView(session);
  }
});

// ── Default sites ───────────────────────────────────────────────
function loadDefaultSites() {
  DEFAULT_SITES.forEach(addSiteTag);
}

// ── Idle view ───────────────────────────────────────────────────
function bindIdleEvents() {
  // Duration slider
  const range = $('dur-range');
  const val   = $('dur-val');
  range.addEventListener('input', () => {
    val.textContent = range.value + ' min';
  });

  // Mode buttons
  document.querySelectorAll('.mbtn[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mbtn[data-mode]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;
      $('mode-desc').textContent = MODE_DESC[currentMode];
    });
  });

  // Add site
  $('add-btn').addEventListener('click', handleAddSite);
  $('site-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleAddSite();
  });

  // Start
  $('start-btn').addEventListener('click', handleStart);

  // Dashboard
  $('open-dash').addEventListener('click', () => {
    chrome.tabs.create({ url: 'dashboard/dashboard.html' });
  });
}

function handleAddSite() {
  const inp = $('site-input');
  let raw = inp.value.trim().toLowerCase();
  if (!raw) return;
  // Normalize — strip protocol and www
  raw = raw.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  if (!raw) return;

  const existing = [...document.querySelectorAll('#site-list .site-name')].map(n => n.textContent);
  if (existing.includes(raw)) { inp.value = ''; return; }

  addSiteTag(raw);
  inp.value = '';
}

function addSiteTag(site) {
  const tag = document.createElement('div');
  tag.className = 'site-tag';
  tag.dataset.site = site;
  tag.innerHTML = `
    <div class="site-dot"></div>
    <span class="site-name">${site}</span>
    <button class="rm-btn" aria-label="Remove ${site}">×</button>
  `;
  tag.querySelector('.rm-btn').addEventListener('click', () => tag.remove());
  $('site-list').appendChild(tag);
}

// ── Start session ───────────────────────────────────────────────
async function handleStart() {
  const goal    = $('goal-input').value.trim() || 'Stay focused.';
  const duration = parseInt($('dur-range').value);
  const mode    = currentMode;
  const blocked = [...document.querySelectorAll('#site-list .site-name')].map(n => n.textContent);

  if (blocked.length === 0) {
    alert('Add at least one site to block.');
    return;
  }

  const payload = { goal, duration, mode, blocked };

  // Tell background to start
  chrome.runtime.sendMessage({ type: 'START_FOCUS', payload });

  // Build a local session object to render immediately
  const session = {
    goal,
    duration,
    mode,
    blocked,
    startTime: Date.now(),
    attempts: {}
  };

  renderActiveView(session);
}

// ── Active view ─────────────────────────────────────────────────
function renderActiveView(session) {
  showView('active');

  // Header label
  const modeLabel = { deep: 'Deep work', soft: 'Soft focus', pomodoro: 'Pomodoro' };
  $('active-mode-label').textContent = 'Focusing · ' + (modeLabel[session.mode] || session.mode);

  // Goal
  $('active-goal').textContent = session.goal;

  // Pomodoro pips
  $('pomo-section').style.display = session.mode === 'pomodoro' ? 'block' : 'none';

  // Build blocked site list with attempt counters
  const list = $('active-site-list');
  list.innerHTML = '';
  session.blocked.forEach(site => {
    const count = (session.attempts && session.attempts[site]) || 0;
    const tag = document.createElement('div');
    tag.className = 'site-tag';
    tag.dataset.site = site;
    tag.innerHTML = `
      <div class="site-dot"></div>
      <span class="site-name">${site}</span>
      <span class="site-count">${count}×</span>
    `;
    list.appendChild(tag);
  });

  // Start countdown
  startCountdown(session);
}

function startCountdown(session) {
  if (timerInterval) clearInterval(timerInterval);

  function tick() {
    const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
    const totalSecs = session.duration * 60;
    const remaining = Math.max(0, totalSecs - elapsed);

    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    $('stat-time').textContent = m + ':' + String(s).padStart(2, '0');

    // Pomodoro phase
    if (session.mode === 'pomodoro') {
      const cycleLen = 25 * 60;
      const breakLen = 5 * 60;
      const cycleTotal = cycleLen + breakLen;
      const posInCycle = elapsed % cycleTotal;
      const phase = posInCycle < cycleLen ? 'work' : 'break';
      const phEl = $('stat-phase');
      phEl.textContent = phase;
      phEl.style.color = phase === 'work' ? 'var(--green)' : 'var(--amber)';

      const cycle = Math.floor(elapsed / cycleTotal);
      updatePomoPips(cycle, phase);
    }

    // Refresh attempt counts from storage
    refreshAttempts(session.blocked);

    if (remaining === 0) {
      clearInterval(timerInterval);
      handleSessionEnd(session);
    }
  }

  tick();
  timerInterval = setInterval(tick, 1000);
}

function updatePomoPips(completedCycles, phase) {
  const pips = document.querySelectorAll('.pip');
  pips.forEach((pip, i) => {
    pip.classList.remove('done', 'active');
    if (i < completedCycles) pip.classList.add('done');
    else if (i === completedCycles) pip.classList.add('active');
  });
}

async function refreshAttempts(blocked) {
  try {
    const data = await chrome.storage.session.get('session');
    const session = data.session;
    if (!session || !session.attempts) return;

    let total = 0;
    blocked.forEach(site => {
      const count = session.attempts[site] || 0;
      total += count;
      const tag = document.querySelector(`#active-site-list [data-site="${site}"] .site-count`);
      if (tag) tag.textContent = count + '×';
    });
    $('stat-blocks').textContent = total;
  } catch {}
}

function bindActiveEvents() {
  $('end-btn').addEventListener('click', async () => {
    if (timerInterval) clearInterval(timerInterval);
    const data = await chrome.storage.session.get('session').catch(() => ({}));
    chrome.runtime.sendMessage({ type: 'END_FOCUS' });
    handleSessionEnd(data.session || null);
  });
}

// ── Session end / summary ───────────────────────────────────────
async function handleSessionEnd(session) {
  if (timerInterval) clearInterval(timerInterval);

  let blocks = 0;
  let duration = session ? session.duration : parseInt($('dur-range').value);

  if (session) {
    // Recalculate actual elapsed minutes
    const elapsedMs = Date.now() - session.startTime;
    duration = Math.max(1, Math.round(elapsedMs / 60000));

    if (session.attempts) {
      blocks = Object.values(session.attempts).reduce((a, b) => a + b, 0);
    }
  }

  // Focus score: start at 100, -5 per block attempt, min 0
  const score = Math.max(0, Math.min(100, 100 - blocks * 5));

  $('sum-duration').textContent = duration + 'm';
  $('sum-blocks').textContent   = blocks;
  $('sum-score').textContent    = score + '%';

  // Calculate Streak
  const streak = await calculateStreak();
  $('sum-streak').textContent = `${streak} day${streak === 1 ? '' : 's'} 🔥`;

  // Points: base 10, +5 if score >= 80
  const pts = score >= 80 ? 15 : 10;
  $('points-badge').textContent = '+' + pts + ' pts';

  // Tell background to end (in case it's still running)
  chrome.runtime.sendMessage({ type: 'END_FOCUS' });

  showView('summary');

  // Animate score bar after DOM paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      $('score-fill').style.width = score + '%';
    });
  });
}

async function calculateStreak() {
  const data = await chrome.storage.local.get(['usage', 'history']);
  const usage = data.usage || {};
  const history = data.history || [];
  
  // Combine dates from usage and history
  const activeDates = new Set();
  Object.keys(usage).forEach(dateStr => activeDates.add(new Date(dateStr).toDateString()));
  history.forEach(session => {
    if (session.startTime) {
      activeDates.add(new Date(session.startTime).toDateString());
    }
  });

  let streak = 0;
  let curr = new Date();
  
  while (true) {
    const dateStr = curr.toDateString();
    if (activeDates.has(dateStr)) {
      streak++;
      curr.setDate(curr.getDate() - 1);
    } else {
      // If we are checking "today" and it's not there, maybe the session we just finished isn't saved yet
      // But we just finished a session, so today should count as 1 at minimum
      if (streak === 0 && dateStr === new Date().toDateString()) {
        streak = 1;
        curr.setDate(curr.getDate() - 1);
        continue;
      }
      break;
    }
  }
  
  return streak || 1;
}

// ── Summary view ────────────────────────────────────────────────
function bindSummaryEvents() {
  $('btn-yes').addEventListener('click', function() {
    this.classList.add('active');
    $('btn-no').classList.remove('active');
  });

  $('btn-no').addEventListener('click', function() {
    this.classList.add('active');
    $('btn-yes').classList.remove('active');
  });

  $('new-btn').addEventListener('click', () => {
    $('goal-input').value = '';
    showView('idle');
  });
}

// ── Background comms ─────────────────────────────────────────────
function getSession() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'GET_SESSION' }, session => {
      resolve(session || null);
    });
  });
}

// ── View switcher ────────────────────────────────────────────────
function showView(name) {
  ['idle', 'active', 'summary'].forEach(v => {
    $(('view-' + v)).style.display = v === name ? '' : 'none';
  });
}