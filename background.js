// ── Tab time tracking ──────────────────────────────────────────
let activeTabId = null;
let activeStart = null;

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  await saveTime();
  const tab = await chrome.tabs.get(tabId);
  activeTabId = tabId;
  activeStart = Date.now();
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tabId === activeTabId && changeInfo.url) {
    await saveTime();
    activeStart = Date.now();
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await saveTime();
    activeTabId = null;
    activeStart = null;
  } else {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab) {
      activeTabId = tab.id;
      activeStart = Date.now();
    }
  }
});

async function saveTime() {
  if (!activeTabId || !activeStart) return;
  try {
    const tab = await chrome.tabs.get(activeTabId);
    if (!tab.url || tab.url.startsWith("chrome://")) return;
    const host = new URL(tab.url).hostname.replace("www.", "");
    const elapsed = Math.floor((Date.now() - activeStart) / 1000);
    const data = await chrome.storage.local.get("usage");
    const usage = data.usage || {};
    const today = new Date().toDateString();
    if (!usage[today]) usage[today] = {};
    usage[today][host] = (usage[today][host] || 0) + elapsed;
    await chrome.storage.local.set({ usage });
  } catch {}
}

// ── Focus session ──────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type === "START_FOCUS") startFocus(msg.payload);
  if (msg.type === "END_FOCUS")   endFocus();
  if (msg.type === "GET_SESSION") getSession(reply);
  return true;
});

async function startFocus({ duration, mode, goal, blocked }) {
  const session = {
    startTime: Date.now(),
    duration,       // minutes
    mode,           // "deep" | "soft" | "pomodoro"
    goal,
    blocked,        // array of hostnames e.g. ["youtube.com","twitter.com"]
    attempts: {},
    phase: "work",  // for pomodoro
    cycleStart: Date.now()
  };
  await chrome.storage.session.set({ session });

  // badge
  updateBadge(duration);

  // alarm to end session
  chrome.alarms.create("focusEnd", { delayInMinutes: duration });

  // for pomodoro, set a cycle alarm
  if (mode === "pomodoro") {
    chrome.alarms.create("pomodoroCycle", { delayInMinutes: 25 });
  }

  // inject blocking rules
  if (mode === "deep" || mode === "soft" || mode === "pomodoro") {
    await setBlockRules(blocked, mode);
  }
}

async function endFocus() {
  const data = await chrome.storage.session.get("session");
  if (data.session) {
    const historyData = await chrome.storage.local.get("history");
    const history = historyData.history || [];
    const completedSession = {
      ...data.session,
      endTime: Date.now(),
      actualDuration: Math.round((Date.now() - data.session.startTime) / 60000)
    };
    history.push(completedSession);
    await chrome.storage.local.set({ history });
  }

  chrome.alarms.clear("focusEnd");
  chrome.alarms.clear("pomodoroCycle");
  await removeBlockRules();
  await chrome.storage.session.remove("session");
  chrome.action.setBadgeText({ text: "" });
}

async function getSession(reply) {
  const data = await chrome.storage.session.get("session");
  reply(data.session || null);
}

// ── Alarms ─────────────────────────────────────────────────────
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "focusEnd") {
    await endFocus();
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "Focus session complete!",
      message: "Great work. Check your session summary."
    });
  }
  if (alarm.name === "pomodoroCycle") {
    await handlePomodoroCycle();
  }
  if (alarm.name === "badgeTick") {
    await tickBadge();
  }
});

async function handlePomodoroCycle() {
  const data = await chrome.storage.session.get("session");
  const session = data.session;
  if (!session) return;
  if (session.phase === "work") {
    session.phase = "break";
    await removeBlockRules();
    chrome.notifications.create({
      type: "basic", iconUrl: "icons/icon128.png",
      title: "Break time!", message: "5 minute break. Distractions unlocked."
    });
    chrome.alarms.create("pomodoroCycle", { delayInMinutes: 5 });
  } else {
    session.phase = "work";
    await setBlockRules(session.blocked, "pomodoro");
    chrome.notifications.create({
      type: "basic", iconUrl: "icons/icon128.png",
      title: "Back to work!", message: "Break over. Distractions blocked again."
    });
    chrome.alarms.create("pomodoroCycle", { delayInMinutes: 25 });
  }
  await chrome.storage.session.set({ session });
}

// ── Blocking via declarativeNetRequest ─────────────────────────
async function setBlockRules(hostnames, mode) {
  const rules = hostnames.map((host, i) => ({
    id: i + 1,
    priority: 1,
    action: {
      type: "redirect",
      redirect: {
        url: chrome.runtime.getURL(
          `blocked/blocked.html?site=${host}&mode=${mode}`
        )
      }
    },
    condition: {
      urlFilter: `||${host}^`,
      resourceTypes: ["main_frame"]
    }
  }));
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: rules.map(r => r.id),
    addRules: rules
  });
}

async function removeBlockRules() {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map(r => r.id)
  });
}

// ── Badge countdown ────────────────────────────────────────────
function updateBadge(minutes) {
  chrome.action.setBadgeText({ text: `${minutes}m` });
  chrome.action.setBadgeBackgroundColor({ color: "#534AB7" });
  chrome.alarms.create("badgeTick", { periodInMinutes: 1 });
}

async function tickBadge() {
  const data = await chrome.storage.session.get("session");
  if (!data.session) { chrome.action.setBadgeText({ text: "" }); return; }
  const elapsed = Math.floor((Date.now() - data.session.startTime) / 60000);
  const remaining = data.session.duration - elapsed;
  if (remaining <= 0) { chrome.action.setBadgeText({ text: "" }); return; }
  chrome.action.setBadgeText({ text: `${remaining}m` });
}