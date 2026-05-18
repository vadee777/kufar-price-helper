# Kufar Price Helper

Chromium extension for Chrome, Microsoft Edge, and compatible browsers that adds approximate USD equivalents to BYN prices on Kufar and can track selected listing prices over time.

Current version: `1.1.0`.

## Features

- Converts BYN prices to USD using the official NBRB USD rate.
- Caches the exchange rate for 6 hours.
- Handles dynamic listing updates with `MutationObserver`.
- Lets you enable or disable the extension globally or for Kufar from the popup.
- Adds a watch button next to converted Kufar prices.
- Stores tracked Kufar listings and weekly USD price snapshots in `chrome.storage.local`.
- Shows a compact price-history dialog from the chart button next to the USD price.
- Avoids duplicate USD labels when a page re-renders.
- Shows small optional support links in the popup.

## Load Unpacked

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `edge-price-converter`.

## GitHub Pages Landing

The landing page lives in `docs/index.html`.

1. Create a GitHub repository.
2. Push this project.
3. In GitHub, open **Settings** -> **Pages**.
4. Set source to **Deploy from a branch**.
5. Select the default branch and `/docs`.
6. Replace placeholder links in `docs/index.html` after donation pages are ready.

## Support Links

Version 1.1.0 includes lightweight popup and landing-page links for:

- Buy Me a Coffee
- ЮMoney

Before publishing, follow `SUPPORT.md` and replace placeholder URLs in:

- `src/popup.html`
- `docs/index.html`

## Project Structure

- `manifest.json` - Microsoft Edge / Chromium Manifest V3 config.
- `src/background.js` - exchange-rate fetching, caching, settings, and tracked price storage.
- `src/content-shared.js` - shared conversion engine.
- `src/kufar.js` - Kufar selectors, page-specific formatting, tracking controls, and history dialog.
- `src/popup.*` - extension popup with toggles and manual rate refresh.
- `docs/` - GitHub Pages landing page.
- `store-assets/` - Partner Center copy, privacy text, and submission checklist.

## Notes

The extension uses NBRB rate ID `431`, which is USD in Belarusian rubles. Prices are approximate and intended for quick comparison.

Browser extensions cannot modify files inside their installed folder at runtime. Tracking data is therefore stored in Edge extension storage, which is the durable browser-managed storage area designed for this use case.
