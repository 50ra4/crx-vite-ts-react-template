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
4. **Before loading the extension**, open `chrome://net-export` in its own tab
   and start a capture. Leave it running for the entire session, then stop it at
   the end and inspect the log with
   [netlog-viewer](https://netlog-viewer.appspot.com/). Starting it here — not
   after step 5 — is what makes the install-time traffic observable: a service
   worker started by the very first install has already run by the time any
   recording set up afterwards begins.
5. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**,
   and select `extension/`.
6. Optionally attach per-context DevTools on top of the net-export capture. It
   is not a substitute for step 4 — a Network panel only records the context it
   is attached to, so a page's DevTools never shows requests made by the
   background service worker, the popup, or the options page, and every
   extension restart detaches the worker's inspector — but it shows initiators
   and request bodies, which the netlog does not surface as readably. Open a
   separate inspector for each context that exists in this build and keep each
   Network panel open for the whole run:
   - background service worker: `chrome://extensions` → the extension card →
     **service worker** under "Inspect views" (re-open it after the worker is
     terminated and restarted; requests made before the inspector attaches are
     not recorded)
   - popup: open the popup, right-click inside it → **Inspect**
   - options page: open it in a tab and use that tab's DevTools
   - content script: the DevTools of each host page the script runs on

Three standing rules apply to every section below, for the whole run:

- Watch the network recording for all contexts, not just the page under test.
  Unless the extension is documented as making network requests, any request it
  originates is a failure, not a curiosity.
- Use fixtures or throwaway accounts. Never exercise the extension against
  production systems, real customer data, or real credentials.
- Keep private context out of the record. Repository names, URLs, file paths,
  note contents, and screenshots taken from private pages do not belong in
  logs, issues, or pull requests.

<!--
The three rules above are document text, not a placeholder: they stay in the
final document. Reword them to fit the product if needed — for example, name
the exact requests that are expected when the extension does make network
requests — but do not delete them along with the HTML comments.
-->

## <!-- Feature area -->

<!--
Duplicate this section once per feature area — roughly one per user-visible
capability, plus one for lifecycle (install, reload, extension update,
uninstall). Order the sections so a tester can work top to bottom without
resetting state in between.

Run the lifecycle section with the `chrome://net-export` capture from Setup step
4 active; per-context DevTools cannot cover it, because every restart detaches
the service worker's inspector. If the capture was started after the extension
was loaded, remove the extension, restart the capture, and install it again —
the first install cannot be replayed into a recording that was not yet running.

Write each item as one checkbox pairing an action with its expected observable
result, so a failure is unambiguous and reproducible by someone else. Keep the
whole document short enough to run in a single sitting: this is a release gate,
not a specification.
-->

- [ ] <!-- action → expected observable result -->
- [ ] <!-- action → expected observable result -->

## Safety checks

<!--
Keep all four checks. Two of them need product-specific wording:

- The network check: reword it only if the extension is documented as making
  requests, and then name the exact requests that are expected.
- The sensitive-input check: it covers password, payment, and credential
  fields; every form the extension touches during the run must be a fixture.
-->

- [ ] The network recording covering every extension context (background service
      worker, popup, options page, and each host page running a content script)
      shows no request originated by the extension
- [ ] `npm run verify:manifest` passes, and the built `extension/manifest.json`
      declares exactly the permissions, host permissions, optional permissions,
      optional host permissions, content-script matches, and web-accessible
      resources justified in [store-listing.md](./store-listing.md) — no more,
      no less
- [ ] No sensitive input was written or submitted by the extension during the
      run
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
