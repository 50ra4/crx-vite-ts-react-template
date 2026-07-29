# Manual Acceptance Test

<!--
TEMPLATE. Replace the placeholder feature sections with the real ones and
delete every HTML comment before this document is used as a release gate. Run
it against the packaged build before tagging a Chrome Web Store release — see
the publishing checklist in [../releasing.md](../releasing.md).
-->

## Setup

1. Use the Node.js version pinned in `.nvmrc`.
2. Run `npm ci`.
3. Run `npm run verify:full`.
4. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**,
   and select `extension/`.
5. Open DevTools and keep the Network tab visible for the whole run.

<!--
Three standing rules apply to every section below; state them here in whatever
form suits the product, and keep them in the final document rather than
deleting them with the rest of the comments:

- Watch the Network tab. Unless the extension is documented as making network
  requests, any request it originates is a failure, not a curiosity.
- Use fixtures or throwaway accounts. Never exercise the extension against
  production systems, real customer data, or real credentials.
- Keep private context out of the record. Repository names, URLs, file paths,
  note contents, and screenshots taken from private pages do not belong in
  logs, issues, or pull requests.
-->

## <!-- Feature area -->

<!--
Duplicate this section once per feature area — roughly one per user-visible
capability, plus one for lifecycle (install, reload, extension update,
uninstall). Order the sections so a tester can work top to bottom without
resetting state in between.

Write each item as one checkbox pairing an action with its expected observable
result, so a failure is unambiguous and reproducible by someone else. Keep the
whole document short enough to run in a single sitting: this is a release gate,
not a specification.
-->

- [ ] <!-- action → expected observable result -->
- [ ] <!-- action → expected observable result -->

## Safety checks

- [ ] The Network tab shows no request originated by the extension <!-- reword
      only if the extension is documented as making requests, and then list the
      exact requests that are expected -->
- [ ] `npm run verify:manifest` passes, and the built `extension/manifest.json`
      declares exactly the permissions, host permissions, and content-script
      matches justified in [store-listing.md](./store-listing.md) — no more, no
      less
- [ ] No sensitive input was written or submitted by the extension during the
      run <!-- password, payment, and credential fields; every form it touches
      must be a test fixture -->
- [ ] Stored data appears, changes, and disappears as described in
      [privacy-policy.md](./privacy-policy.md), including after uninstall

## Compatibility cases

<!--
OPTIONAL SECTION — keep it when behavior can plausibly differ across
environments, delete it otherwise. Typical axes: a second Chromium-based
browser, light and dark theme, keyboard-only navigation with visible focus,
zoom levels and narrow windows, and a second locale if the UI is translated.
-->

- [ ] <!-- environment → expected result -->

## Restricted pages

<!--
OPTIONAL SECTION — keep it when any surface could be invoked on a page Chrome
protects: `chrome://` pages, the Chrome Web Store, other extensions' pages,
`view-source:`, PDF viewers, and cross-origin iframes. The expected result is a
clean no-op with a comprehensible message, never an uncaught error.
-->

- [ ] <!-- restricted page → expected no-op behavior -->

## Expected limitations

<!--
OPTIONAL SECTION — keep a short list of known unsupported cases so testers do
not file them as regressions and support answers stay consistent. Anything
listed here that a user could reasonably expect to work should also be
acknowledged in the store description.
-->

- <!-- known unsupported case -->
