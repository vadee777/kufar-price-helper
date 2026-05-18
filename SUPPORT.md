# Support Links Setup

Version 1.1.0 adds small, optional support links in the extension popup and on the GitHub Pages landing page.

Before publishing, replace these placeholders everywhere:

- `https://www.buymeacoffee.com/YOUR_USERNAME`
- `https://yoomoney.ru/to/YOUR_WALLET`

Files to update:

- `src/popup.html`
- `docs/index.html`

## Buy Me a Coffee

1. Open `https://buymeacoffee.com/signup`.
2. Choose a short username for the public page URL.
3. Sign up with email or a supported social login.
4. Fill profile basics: project name, logo/icon, short bio, and website or GitHub link.
5. Connect payout details. Buy Me a Coffee keeps the page hidden until payout setup is complete.
6. Open the public page and copy its URL, for example `https://www.buymeacoffee.com/yourname`.
7. Replace `https://www.buymeacoffee.com/YOUR_USERNAME` in the project files.

## ЮMoney

1. Open `https://yoomoney.ru/get/fundraise`.
2. Create or sign in to a ЮMoney wallet.
3. Make sure the wallet is named or identified. Anonymous wallets cannot create public fundraisers.
4. Create a collective fundraiser or personal payment link.
5. Copy the public fundraiser/widget link or a direct wallet link.
6. Replace `https://yoomoney.ru/to/YOUR_WALLET` in the project files.

## Pre-Publication Check

1. Click both links from `docs/index.html`.
2. Load the unpacked extension and click both popup links.
3. Confirm the links open the real public donation pages, not registration pages or placeholders.
