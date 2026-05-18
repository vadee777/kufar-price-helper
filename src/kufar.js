(function () {
  const selectors = [
    "[class*='styles_price__']",
    "[class*='styles_discountPrice']",
    "[class*='styles_brief_wrapper__price']",
    "[data-testid*='price']",
    "[data-name*='price']",
    ".account_ads__price"
  ].join(",");

  window.PriceHelper.createConverter({
    siteKey: "kufar",
    priceSelectors: selectors,
    inline: true,
    parse(element) {
      const text = element.textContent;
      if (text.includes("$") || text.includes("%") || isSquareMeterPrice(text)) {
        return null;
      }

      if (isProductPage()) {
        const mainPriceElement = getProductMainPriceElement();
        if (!mainPriceElement || element !== mainPriceElement) {
          return null;
        }

        element.dataset.priceHelperPlaceAfter = "true";
      }

      return window.PriceHelper.parseBynPrice(text);
    },
    getExtraPriceElements() {
      if (!isProductPage()) {
        return [];
      }

      const mainPriceElement = getProductMainPriceElement();
      return mainPriceElement ? [mainPriceElement] : [];
    },
    decorate(usdElement, priceElement) {
      if (String(priceElement.className).includes("brief_wrapper")) {
        usdElement.style.fontSize = "14px";
        usdElement.style.lineHeight = "20px";
      }
    },
    afterRender(context) {
      attachTrackerControls(context);
    }
  });

  function getProductMainPriceElement() {
    const title = document.querySelector("h1");
    if (!title) {
      return null;
    }

    const candidates = getNearbyProductPriceElements(title);
    if (!candidates.length) {
      return null;
    }

    return candidates
      .map((element) => ({
        element,
        price: window.PriceHelper.parseBynPrice(element.textContent) || 0
      }))
      .sort((left, right) => right.price - left.price)[0].element;
  }

  function getNearbyProductPriceElements(title) {
    const region = title.closest("aside, section") || title.parentElement?.parentElement || title.parentElement;
    if (!region) {
      return [];
    }

    return Array.from(region.querySelectorAll("*"))
      .filter((element) => {
        if (element.children.length || element.querySelector(`.${window.PriceHelper.CONVERTED_CLASS}`)) {
          return false;
        }

        const text = element.textContent.replace(/\s+/g, " ").trim();
        if (isSquareMeterPrice(text) || !isStandaloneBynPrice(text)) {
          return false;
        }

        const priceRect = element.getBoundingClientRect();
        const titleRect = title.getBoundingClientRect();
        return priceRect.top <= titleRect.top + 8 && Math.abs(priceRect.left - titleRect.left) < 140;
      })
      .slice(0, 4);
  }

  function isProductPage() {
    return /\/vi\//.test(window.location.pathname);
  }

  function isSquareMeterPrice(text) {
    return /(?:\u043c\u00b2|\u043c2|m\u00b2|m2|\/\s*\u043c)/i.test(text);
  }

  function isStandaloneBynPrice(text) {
    return /^\d[\d\s]*(?:[,.]\d+)?\s*(?:\u0440\.|\u0440\u0443\u0431\.|byn|br)(?:\.*)?$/i.test(text);
  }

  function attachTrackerControls(context) {
    const target = getTrackingTarget(context.priceElement);
    if (!target) {
      return;
    }

    let controls = context.usdElement.querySelector(":scope > .price-helper-controls");
    if (!controls) {
      controls = document.createElement("span");
      controls.className = "price-helper-controls";
      context.usdElement.append(controls);
    }

    let watchButton = controls.querySelector(".price-helper-watch");
    if (!watchButton) {
      watchButton = document.createElement("button");
      watchButton.className = "price-helper-icon-button price-helper-watch";
      watchButton.type = "button";
      watchButton.title = "\u0421\u043b\u0435\u0434\u0438\u0442\u044c \u0437\u0430 \u0446\u0435\u043d\u043e\u0439";
      watchButton.setAttribute("aria-label", "\u0421\u043b\u0435\u0434\u0438\u0442\u044c \u0437\u0430 \u0446\u0435\u043d\u043e\u0439");
      controls.append(watchButton);
    }

    let historyButton = controls.querySelector(".price-helper-history");
    if (!historyButton) {
      historyButton = document.createElement("button");
      historyButton.className = "price-helper-icon-button price-helper-history";
      historyButton.type = "button";
      historyButton.textContent = "\u2197";
      historyButton.title = "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0434\u0438\u043d\u0430\u043c\u0438\u043a\u0443 \u0446\u0435\u043d\u044b";
      historyButton.setAttribute("aria-label", "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0434\u0438\u043d\u0430\u043c\u0438\u043a\u0443 \u0446\u0435\u043d\u044b");
      controls.append(historyButton);
    }

    syncWatchButton(watchButton, target.url);

    watchButton.onclick = async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await toggleTracking(watchButton, {
        ...target,
        bynPrice: context.bynPrice,
        rate: context.rate,
        usdPrice: context.usdPrice
      });
    };

    historyButton.onclick = async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await showHistory(target.url);
    };
  }

  async function syncWatchButton(button, url) {
    const response = await window.PriceHelper.sendMessage({
      type: "GET_TRACKED_KUFAR_PAGE",
      url
    });
    setWatchButtonState(button, Boolean(response?.entry));
  }

  async function toggleTracking(button, payload) {
    const isTracked = button.classList.contains("is-active");
    if (isTracked) {
      await window.PriceHelper.sendMessage({
        type: "UNTRACK_KUFAR_PRICE",
        url: payload.url
      });
      setWatchButtonState(button, false);
      return;
    }

    const response = await window.PriceHelper.sendMessage({
      type: "TRACK_KUFAR_PRICE",
      payload: {
        ...payload,
        forceSnapshot: true
      }
    });
    setWatchButtonState(button, Boolean(response?.ok));
  }

  function setWatchButtonState(button, isTracked) {
    button.classList.toggle("is-active", isTracked);
    button.textContent = isTracked ? "\u2605" : "\u2606";
    button.title = isTracked
      ? "\u0426\u0435\u043d\u0430 \u043e\u0442\u0441\u043b\u0435\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044f"
      : "\u0421\u043b\u0435\u0434\u0438\u0442\u044c \u0437\u0430 \u0446\u0435\u043d\u043e\u0439";
    button.setAttribute("aria-pressed", String(isTracked));
  }

  async function showHistory(url) {
    const response = await window.PriceHelper.sendMessage({
      type: "GET_KUFAR_PRICE_HISTORY",
      url
    });
    renderHistoryModal(response?.entry);
  }

  function renderHistoryModal(entry) {
    document.querySelector(".price-helper-modal-backdrop")?.remove();

    const backdrop = document.createElement("div");
    backdrop.className = "price-helper-modal-backdrop";

    const modal = document.createElement("section");
    modal.className = "price-helper-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    const history = entry?.history || [];
    const maxPrice = Math.max(...history.map((item) => item.usdPrice), entry?.currentUsdPrice || 0, 1);
    const emptyMessage = "\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u043f\u043e\u044f\u0432\u0438\u0442\u0441\u044f \u043f\u043e\u0441\u043b\u0435 \u0432\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u044f \u043e\u0442\u0441\u043b\u0435\u0436\u0438\u0432\u0430\u043d\u0438\u044f \u0446\u0435\u043d\u044b.";

    modal.innerHTML = `
      <div class="price-helper-modal-header">
        <div>
          <h2 class="price-helper-modal-title">\u0414\u0438\u043d\u0430\u043c\u0438\u043a\u0430 \u0446\u0435\u043d\u044b</h2>
          <p class="price-helper-modal-subtitle">${escapeHtml(entry?.title || "\u0421\u0442\u0440\u0430\u043d\u0438\u0446\u0430 \u043f\u043e\u043a\u0430 \u043d\u0435 \u043e\u0442\u0441\u043b\u0435\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044f")}</p>
        </div>
        <button class="price-helper-icon-button" type="button" aria-label="\u0417\u0430\u043a\u0440\u044b\u0442\u044c">\u00d7</button>
      </div>
      ${
        history.length
          ? history.map((item) => renderHistoryRow(item, maxPrice)).join("")
          : `<p class="price-helper-modal-subtitle">${emptyMessage}</p>`
      }
    `;

    modal.querySelector("button").addEventListener("click", () => backdrop.remove());
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) {
        backdrop.remove();
      }
    });

    backdrop.append(modal);
    document.body.append(backdrop);
  }

  function renderHistoryRow(item, maxPrice) {
    const width = Math.max(4, Math.round((item.usdPrice / maxPrice) * 100));
    return `
      <div class="price-helper-history-row">
        <span class="price-helper-history-date">${formatDate(item.timestamp)}</span>
        <span class="price-helper-history-price">${item.usdPrice} $</span>
        <span class="price-helper-history-bar">
          <span class="price-helper-history-fill" style="width: ${width}%"></span>
        </span>
      </div>
    `;
  }

  function getTrackingTarget(priceElement) {
    const link = priceElement.closest("a[href]") || priceElement.querySelector("a[href]");
    const url = new URL(link?.href || window.location.href, window.location.href);
    if (!url.hostname.endsWith("kufar.by")) {
      return null;
    }

    url.hash = "";
    url.search = "";
    return {
      title: getTitle(priceElement, link),
      url: url.toString()
    };
  }

  function getTitle(priceElement, link) {
    const titleElement = link?.querySelector("[class*='title'], h2, h3") || document.querySelector("h1");
    return (titleElement?.textContent || document.title || priceElement.textContent).replace(/\s+/g, " ").trim();
  }

  function formatDate(timestamp) {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit"
    }).format(new Date(timestamp));
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
