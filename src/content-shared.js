(function () {
  const SETTINGS_KEY = "priceHelper.settings";
  const CONVERTED_CLASS = "price-helper-usd";
  const DEFAULT_SETTINGS = {
    enabled: true,
    kufarEnabled: true,
    showAsterisk: true,
    useCompactRounding: true
  };

  window.PriceHelper = {
    CONVERTED_CLASS,
    createConverter,
    getRate,
    getSettings,
    injectStyles,
    isEnabledForSite,
    parseBynPrice,
    roundUsd,
    sendMessage
  };

  async function getRate(forceRefresh = false) {
    const response = await sendMessage({ type: "GET_RATE", forceRefresh });
    if (!response?.ok) {
      throw new Error(response?.error || "Could not load exchange rate");
    }
    return response.rate;
  }

  async function getSettings() {
    const response = await sendMessage({ type: "GET_SETTINGS" });
    if (response?.ok) {
      return { ...DEFAULT_SETTINGS, ...response.settings };
    }

    const { [SETTINGS_KEY]: settings } = await chrome.storage.local.get(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...settings };
  }

  function isEnabledForSite(settings, siteKey) {
    return Boolean(settings.enabled && settings[`${siteKey}Enabled`]);
  }

  function createConverter(config) {
    let rate = null;
    let settings = DEFAULT_SETTINGS;
    let observer = null;
    let scheduled = false;

    init();

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local" || !changes[SETTINGS_KEY]) {
        return;
      }

      settings = { ...DEFAULT_SETTINGS, ...changes[SETTINGS_KEY].newValue };
      removeConversions();
      if (isEnabledForSite(settings, config.siteKey)) {
        ensureRunning();
      }
    });

    async function init() {
      try {
        injectStyles();
        settings = await getSettings();
        if (!isEnabledForSite(settings, config.siteKey)) {
          return;
        }

        await ensureRunning();
      } catch (error) {
        console.warn("Price Helper: initialization failed", error);
      }
    }

    async function ensureRunning() {
      if (!rate) {
        rate = await getRate();
      }

      convert();
      setTimeout(convert, 1200);
      setTimeout(convert, 3000);
      observe();
    }

    function observe() {
      if (observer) {
        observer.disconnect();
      }

      observer = new MutationObserver(scheduleConvert);
      const targets = config.observerSelectors
        ? Array.from(document.querySelectorAll(config.observerSelectors))
        : [document.body || document.documentElement];

      for (const target of targets.length ? targets : [document.body || document.documentElement]) {
        observer.observe(target, {
          childList: true,
          characterData: true,
          subtree: true
        });
      }
    }

    function scheduleConvert() {
      if (scheduled) {
        return;
      }

      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        convert();
      });
    }

    function convert() {
      if (!rate || !isEnabledForSite(settings, config.siteKey)) {
        return;
      }

      const elements = [
        ...document.querySelectorAll(config.priceSelectors),
        ...(typeof config.getExtraPriceElements === "function" ? config.getExtraPriceElements() : [])
      ];
      const renderedElements = new Set();
      for (const element of elements) {
        if (renderedElements.has(element)) {
          continue;
        }

        if (shouldSkipElement(element)) {
          continue;
        }

        const parsed = config.parse ? config.parse(element) : parseBynPrice(element.textContent);
        if (!parsed) {
          continue;
        }

        renderConversion(element, parsed);
        renderedElements.add(element);
      }
    }

    function shouldSkipElement(element) {
      if (element.closest(`.${CONVERTED_CLASS}`)) {
        return true;
      }

      const nestedPrice = Array.from(element.querySelectorAll(config.priceSelectors))
        .find((nested) => nested !== element && !nested.closest(`.${CONVERTED_CLASS}`));

      return Boolean(nestedPrice);
    }

    function renderConversion(element, parsed) {
      const usdPrices = Array.isArray(parsed)
        ? parsed.map((price) => roundUsd(price / rate, settings))
        : [roundUsd(parsed / rate, settings)];
      const conversion = usdPrices.join(" - ");
      const suffix = settings.showAsterisk ? " $*" : " $";

      const placeAfterElement = element.dataset.priceHelperPlaceAfter === "true";
      if (placeAfterElement) {
        element.querySelector(`:scope > .${CONVERTED_CLASS}`)?.remove();
      }

      let usdElement = placeAfterElement
        ? getAdjacentConversionElement(element)
        : element.querySelector(`:scope > .${CONVERTED_CLASS}`);
      if (!usdElement) {
        usdElement = document.createElement(placeAfterElement ? "div" : config.inline ? "span" : "div");
        usdElement.className = `${CONVERTED_CLASS} ${config.siteKey}${placeAfterElement ? " price-helper-after-price" : ""}`;
        if (placeAfterElement) {
          element.after(usdElement);
        } else {
          element.append(usdElement);
        }
      }

      let valueElement = usdElement.querySelector(":scope > .price-helper-usd-value");
      if (!valueElement) {
        valueElement = document.createElement("span");
        valueElement.className = "price-helper-usd-value";
        usdElement.append(valueElement);
      }

      valueElement.textContent = `${conversion}${suffix}`;
      if (typeof config.decorate === "function") {
        config.decorate(usdElement, element);
      }

      if (typeof config.afterRender === "function" && !Array.isArray(parsed)) {
        config.afterRender({
          bynPrice: parsed,
          priceElement: element,
          rate,
          usdElement,
          usdPrice: usdPrices[0]
        });
      }
    }
  }

  function getAdjacentConversionElement(element) {
    const next = element.nextElementSibling;
    if (next?.classList.contains(CONVERTED_CLASS)) {
      return next;
    }

    const previous = element.previousElementSibling;
    if (previous?.classList.contains(CONVERTED_CLASS)) {
      return previous;
    }

    return null;
  }

  function removeConversions() {
    for (const element of document.querySelectorAll(`.${CONVERTED_CLASS}`)) {
      element.remove();
    }
  }

  function parseBynPrice(text) {
    const normalized = text.replace(/\s+/g, " ");
    if (normalized.includes("$") || normalized.includes("%") || !looksLikeByn(normalized)) {
      return null;
    }

    const match = normalized.match(/\d[\d\s]*(?:[,.]\d+)?/);
    return match ? normalizeNumber(match[0]) : null;
  }

  function looksLikeByn(text) {
    return /(?:\u0440\.|\u0440\u0443\u0431\.|byn|br|\u0431\u0435\u043b\.?\s*\u0440\u0443\u0431)/i.test(text);
  }

  function normalizeNumber(value) {
    const number = Number(value.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(number) ? number : null;
  }

  function roundUsd(price, settings) {
    if (!Number.isFinite(price)) {
      return null;
    }

    if (!settings.useCompactRounding) {
      return Math.round(price * 100) / 100;
    }

    return price >= 10 ? Math.round(price) : Math.round(price * 100) / 100;
  }

  function injectStyles() {
    if (document.getElementById("price-helper-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "price-helper-styles";
    style.textContent = `
      .${CONVERTED_CLASS} {
        color: #64748b !important;
        font-size: 0.88em !important;
        font-weight: 500 !important;
        line-height: 1.35 !important;
        white-space: nowrap !important;
      }

      .${CONVERTED_CLASS}.kufar {
        align-items: center !important;
        display: inline-flex !important;
        gap: 6px !important;
        margin-left: 8px !important;
      }

      .${CONVERTED_CLASS}.kufar.price-helper-after-price {
        display: flex !important;
        margin: 4px 0 0 !important;
      }

      .price-helper-controls {
        align-items: center !important;
        display: inline-flex !important;
        gap: 4px !important;
      }

      .price-helper-icon-button {
        align-items: center !important;
        background: #ffffff !important;
        border: 1px solid #cbd5e1 !important;
        border-radius: 999px !important;
        color: #334155 !important;
        cursor: pointer !important;
        display: inline-flex !important;
        font: 12px/1 system-ui, sans-serif !important;
        height: 22px !important;
        justify-content: center !important;
        padding: 0 !important;
        width: 22px !important;
      }

      .price-helper-icon-button:hover {
        background: #eff6ff !important;
        border-color: #60a5fa !important;
        color: #1d4ed8 !important;
      }

      .price-helper-icon-button.is-active {
        background: #2563eb !important;
        border-color: #2563eb !important;
        color: #ffffff !important;
      }

      .price-helper-modal-backdrop {
        align-items: center !important;
        background: rgba(15, 23, 42, 0.38) !important;
        bottom: 0 !important;
        display: flex !important;
        justify-content: center !important;
        left: 0 !important;
        padding: 24px !important;
        position: fixed !important;
        right: 0 !important;
        top: 0 !important;
        z-index: 2147483647 !important;
      }

      .price-helper-modal {
        background: #ffffff !important;
        border-radius: 8px !important;
        box-shadow: 0 20px 60px rgba(15, 23, 42, 0.25) !important;
        color: #172033 !important;
        max-height: min(680px, 90vh) !important;
        max-width: 520px !important;
        overflow: auto !important;
        padding: 18px !important;
        width: min(520px, 100%) !important;
      }

      .price-helper-modal-header {
        align-items: start !important;
        display: flex !important;
        gap: 12px !important;
        justify-content: space-between !important;
        margin-bottom: 14px !important;
      }

      .price-helper-modal-title {
        font: 700 18px/1.25 system-ui, sans-serif !important;
        margin: 0 !important;
      }

      .price-helper-modal-subtitle {
        color: #64748b !important;
        font: 13px/1.4 system-ui, sans-serif !important;
        margin: 4px 0 0 !important;
      }

      .price-helper-history-row {
        display: grid !important;
        gap: 6px !important;
        grid-template-columns: 92px 74px 1fr !important;
        margin-top: 10px !important;
      }

      .price-helper-history-date,
      .price-helper-history-price {
        color: #334155 !important;
        font: 13px/1.4 system-ui, sans-serif !important;
      }

      .price-helper-history-bar {
        background: #e2e8f0 !important;
        border-radius: 999px !important;
        height: 8px !important;
        margin-top: 5px !important;
        overflow: hidden !important;
      }

      .price-helper-history-fill {
        background: #2563eb !important;
        border-radius: inherit !important;
        height: 100% !important;
      }
    `;
    document.documentElement.append(style);
  }

  function sendMessage(message) {
    return chrome.runtime.sendMessage(message);
  }
})();
