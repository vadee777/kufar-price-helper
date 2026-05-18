# Chrome Web Store / Microsoft Edge Add-ons Submission Checklist

Use this checklist before publishing version `1.1.0`.

## Package

- Upload `dist/kufar-price-helper-1.1.0.zip`.
- Confirm the package contains `manifest.json`, `src`, and `images`.
- Do not upload the whole repository or `store-assets`.
- Chrome Web Store / Microsoft Edge Add-ons will verify the uploaded `.zip` package.

## Availability

- Set pricing to free.
- Choose public visibility when ready for store search.
- Choose target markets where Kufar support is relevant.

## Properties

- Category: Shopping.
- Website: add the GitHub Pages landing URL when published.
- Support contact: add a real support email or URL.
- Mature content: no, unless screenshots or listing text change.
- Donation links: replace all placeholder Buy Me a Coffee and ЮMoney URLs before store submission.

## Privacy

- Single purpose: show USD equivalents for Kufar prices and locally track selected listing prices.
- Permission justification: `storage` stores settings/rate/history; `alarms` refreshes rate and tracked prices; host permissions allow NBRB rate fetch and Kufar listing updates.
- Remote code: no remote code is executed.
- Data usage: local browser storage only; no developer server receives user data.
- Add a hosted privacy policy URL before final submission if Partner Center requires it.

## Store Listings

- Use `listing-ru.md` for Russian listing text.
- Use `listing-en.md` for English listing text.
- Upload screenshots showing Kufar prices with USD conversion and the popup.
- Upload the 128x128 icon from `images/icon128.png` as the store logo if Partner Center asks separately.

## Final Review

- Load the unpacked extension in `edge://extensions`.
- Test on `https://*.kufar.by/*`.
- Open the popup and test all toggles.
- Track and untrack a listing.
- Confirm no duplicate USD labels are created after filtering or navigation.
