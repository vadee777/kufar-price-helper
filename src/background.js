const RATE_CACHE_KEY = "priceHelper.rate.usd";
const SETTINGS_KEY = "priceHelper.settings";
const TRACKED_KEY = "priceHelper.trackedKufar";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_SETTINGS = {
  enabled: true,
  kufarEnabled: true,
  showAsterisk: true,
  useCompactRounding: true
};

chrome.runtime.onInstalled.addListener(async () => {
  const { [SETTINGS_KEY]: settings } = await chrome.storage.local.get(SETTINGS_KEY);
  if (!settings) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
  }
  chrome.alarms.create("refresh-rate", { periodInMinutes: 360 });
  chrome.alarms.create("weekly-price-snapshot", { periodInMinutes: 7 * 24 * 60 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "refresh-rate") {
    getUsdRate({ forceRefresh: true }).catch((error) => {
      console.warn("Price Helper: scheduled rate refresh failed", error);
    });
  }

  if (alarm.name === "weekly-price-snapshot") {
    refreshTrackedKufarPrices().catch((error) => {
      console.warn("Price Helper: scheduled price tracking failed", error);
    });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_RATE") {
    getUsdRate({ forceRefresh: Boolean(message.forceRefresh) })
      .then((rate) => sendResponse({ ok: true, rate }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "GET_SETTINGS") {
    getSettings()
      .then((settings) => sendResponse({ ok: true, settings }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "SAVE_SETTINGS") {
    saveSettings(message.settings)
      .then((settings) => sendResponse({ ok: true, settings }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "GET_TRACKED_KUFAR_PAGE") {
    getTrackedPage(message.url)
      .then((entry) => sendResponse({ ok: true, entry }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "TRACK_KUFAR_PRICE") {
    trackKufarPrice(message.payload)
      .then((entry) => sendResponse({ ok: true, entry }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "UNTRACK_KUFAR_PRICE") {
    untrackKufarPrice(message.url)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "GET_KUFAR_PRICE_HISTORY") {
    getTrackedPage(message.url)
      .then((entry) => sendResponse({ ok: true, entry }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});

async function getSettings() {
  const { [SETTINGS_KEY]: settings } = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...settings };
}

async function saveSettings(nextSettings) {
  const currentSettings = await getSettings();
  const settings = { ...currentSettings, ...nextSettings };
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  return settings;
}

async function getUsdRate({ forceRefresh = false } = {}) {
  const { [RATE_CACHE_KEY]: cached } = await chrome.storage.local.get(RATE_CACHE_KEY);
  const isFresh = cached && Date.now() - cached.timestamp < CACHE_TTL_MS;

  if (!forceRefresh && isFresh) {
    return cached.rate;
  }

  try {
    const response = await fetch("https://api.nbrb.by/exrates/rates/431");
    if (!response.ok) {
      throw new Error(`NBRB returned ${response.status}`);
    }

    const data = await response.json();
    const rate = Number(data.Cur_OfficialRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error("Invalid USD rate from NBRB");
    }

    await chrome.storage.local.set({
      [RATE_CACHE_KEY]: {
        rate,
        timestamp: Date.now()
      }
    });

    return rate;
  } catch (error) {
    if (cached?.rate) {
      return cached.rate;
    }
    throw error;
  }
}

async function getTrackedPages() {
  const { [TRACKED_KEY]: tracked } = await chrome.storage.local.get(TRACKED_KEY);
  return tracked && typeof tracked === "object" ? tracked : {};
}

async function saveTrackedPages(tracked) {
  await chrome.storage.local.set({ [TRACKED_KEY]: tracked });
}

async function getTrackedPage(url) {
  const tracked = await getTrackedPages();
  return tracked[normalizeUrl(url)] || null;
}

async function trackKufarPrice(payload) {
  const tracked = await getTrackedPages();
  const url = normalizeUrl(payload.url);
  const now = Date.now();
  const existing = tracked[url] || {
    url,
    createdAt: now,
    history: []
  };

  const entry = {
    ...existing,
    url,
    title: payload.title || existing.title || url,
    currentBynPrice: payload.bynPrice,
    currentUsdPrice: payload.usdPrice,
    lastRate: payload.rate,
    updatedAt: now,
    history: recordWeeklySnapshot(existing.history || [], {
      bynPrice: payload.bynPrice,
      usdPrice: payload.usdPrice,
      rate: payload.rate,
      source: "page",
      timestamp: now
    }, Boolean(payload.forceSnapshot))
  };

  tracked[url] = entry;
  await saveTrackedPages(tracked);
  return entry;
}

async function untrackKufarPrice(url) {
  const tracked = await getTrackedPages();
  delete tracked[normalizeUrl(url)];
  await saveTrackedPages(tracked);
}

async function refreshTrackedKufarPrices() {
  const tracked = await getTrackedPages();
  const urls = Object.keys(tracked);
  if (!urls.length) {
    return;
  }

  const rate = await getUsdRate({ forceRefresh: true });
  let changed = false;

  for (const url of urls) {
    const entry = tracked[url];
    if (!isSnapshotDue(entry.history)) {
      continue;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Kufar returned ${response.status}`);
      }

      const html = await response.text();
      const bynPrice = parseKufarPriceFromHtml(html);
      if (!bynPrice) {
        continue;
      }

      const usdPrice = roundUsd(bynPrice / rate);
      const now = Date.now();
      tracked[url] = {
        ...entry,
        title: parseTitleFromHtml(html) || entry.title,
        currentBynPrice: bynPrice,
        currentUsdPrice: usdPrice,
        lastRate: rate,
        updatedAt: now,
        history: recordWeeklySnapshot(entry.history || [], {
          bynPrice,
          usdPrice,
          rate,
          source: "weekly-fetch",
          timestamp: now
        }, true)
      };
      changed = true;
    } catch (error) {
      console.warn("Price Helper: could not refresh tracked Kufar page", url, error);
    }
  }

  if (changed) {
    await saveTrackedPages(tracked);
  }
}

function recordWeeklySnapshot(history, snapshot, forceSnapshot) {
  if (!forceSnapshot && !isSnapshotDue(history)) {
    return history;
  }

  return [
    ...history,
    {
      bynPrice: snapshot.bynPrice,
      usdPrice: snapshot.usdPrice,
      rate: snapshot.rate,
      source: snapshot.source,
      timestamp: snapshot.timestamp
    }
  ].slice(-104);
}

function isSnapshotDue(history = []) {
  if (!history.length) {
    return true;
  }

  const last = history[history.length - 1];
  return Date.now() - last.timestamp >= WEEK_MS;
}

function normalizeUrl(url) {
  const parsed = new URL(url);
  parsed.hash = "";
  parsed.search = "";
  return parsed.toString();
}

function parseKufarPriceFromHtml(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
  const match = text.match(/(\d[\d\s]*(?:[,.]\d+)?)\s*(?:р\.|руб\.|byn|br)/i);
  if (!match) {
    return null;
  }

  const price = Number(match[1].replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(price) ? price : null;
}

function parseTitleFromHtml(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtml(match[1]).trim() : "";
}

function decodeHtml(value) {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function roundUsd(price) {
  return price >= 10 ? Math.round(price) : Math.round(price * 100) / 100;
}
