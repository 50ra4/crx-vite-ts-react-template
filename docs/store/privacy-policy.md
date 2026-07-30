# Privacy Policy

<!--
TEMPLATE. Replace every placeholder and delete every HTML comment in this file
before the extension is submitted to the Chrome Web Store. Keep the section
order: reviewers read the policy top to bottom and expect these headings.

This document is English-only on purpose — the Chrome Web Store requires one
privacy policy, and the translated listing text lives in ./store-listing.md.

This file is the source that gets published, not the published artifact: the
store requires the policy to be reachable at a public URL registered in the
developer dashboard, so mirror this content there and re-publish it on every
revision. See the publishing checklist in [../releasing.md](../releasing.md).
-->

Effective date: <!-- YYYY-MM-DD -->

<!--
"Last updated: <Month D, YYYY>" is equally acceptable. Pick one label and one
date format, then keep both stable across revisions so a reviewer can tell at a
glance when the policy last changed.
-->

<!--
One opening paragraph. State the product name, what kinds of data it processes,
where that processing happens (locally in the browser, or on a server you
operate), and the single purpose the processing serves. This must agree with
the "Single purpose" statement in ./store-listing.md — a mismatch between the
two is a common cause of review rejection.
-->

## Data collection and transmission

<!--
State plainly whether the extension collects, transmits, sells, shares, or
remotely processes any data.

If it does not, enumerate what is absent so the claim is checkable rather than
rhetorical: backend, account system, analytics SDK, crash-reporting SDK,
advertising SDK, remote configuration, remotely hosted code, and any
first-party or third-party API calls.

If it does transmit, name each destination, the exact data sent, the trigger,
and the reason.

Whatever is written here has to match the data-use disclosures entered in the
Chrome Web Store developer dashboard.
-->

## Data stored

<!--
List every value persisted on the device as a bullet, described in user-visible
terms rather than internal field names, and name the storage area each value
lives in (for example `chrome.storage.local`, `chrome.storage.sync`, IndexedDB,
`localStorage`, cookies). Note explicitly which areas are NOT used, and whether
anything syncs across the user's profiles.

If the extension persists nothing, say so in one sentence and delete the
bullets below.

Take the list from the implementation, not from `manifest.config.ts` — the
manifest only shows whether the `storage` permission is held. Start from every
key and `area` in `src/lib/storage/schema.ts`, then add any other persistence the
code uses (IndexedDB, `localStorage` / `sessionStorage`, cookies, `chrome.storage`
calls made outside the schema).
-->

- <!-- stored value — storage area -->
- <!-- stored value — storage area -->

<!--
If the implementation enforces caps (per-scope item limits, total item limits,
value length limits), state the numbers here and keep them in sync with the
code. If there are no caps, delete this paragraph rather than inventing one.
-->

## Host-page behavior

<!--
OPTIONAL SECTION — delete it unless a content script has observable side effects
on the pages it runs on.

Keep it when the extension writes into the host DOM or dispatches events the
page can react to (for example bubbling `input` / `change` events after
assigning a value): the page's own scripts may then autosave, submit, or
transmit those values under that site's own terms, outside this extension's
control. Describe the side effect, say plainly that the page-side consequences
cannot be guaranteed or controlled, and name the environments where use is
intended.

Also keep it when the extension renders its own UI inside the page and the
origin boundary matters (for example an extension-origin iframe), and state
which data does and does not cross that boundary.
-->

## Permissions

<!--
Do not restate the permission justifications here — keep one source of truth so
the two documents cannot drift apart. A sentence naming the declared
permissions and content-script matches at a high level is enough, followed by:

  See [store-listing.md](./store-listing.md) for the justification of each
  permission and content-script match.

Both documents must mirror what `manifest.config.ts` actually declares, which
`scripts/expected-manifest.config.mjs` and `npm run verify:manifest` pin down.
-->

## Third-party code

<!--
OPTIONAL SECTION — delete it unless the extension bundles third-party runtime
libraries that require attribution.

When kept, state that the bundled libraries execute locally and are not loaded
from a CDN (Manifest V3 forbids remotely hosted code), and link to wherever the
notices are published. Generating and maintaining that notice file is an
organization-specific process and is deliberately out of scope for this
template; decide where it lives before linking to it.
-->

## Retention and deletion

<!--
State how long stored data is kept, which user actions delete it (in-product
delete controls, clearing extension storage, uninstalling the extension), and
whether anything is evicted automatically when a limit is reached.

If nothing is stored, say that no data is retained and that uninstalling
therefore leaves no extension data to delete.
-->

## Changes

<!--
State how policy changes are published — typically a new extension version with
an updated effective date in this file — and where the history can be read.
-->

## Contact

<!--
Give one reachable channel for privacy questions: the repository issue tracker,
the links already recorded in `package.json`, or a support address. If
sensitive reports must follow a different route, point at
[SECURITY.md](../../SECURITY.md).
-->
