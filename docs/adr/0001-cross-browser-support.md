# 1. Cross-browser support (Chrome-first)

- Status: Accepted (2026-07-18)
- Deciders: repository owner
- Related: [#31](https://github.com/50ra4/crx-vite-ts-react-template/issues/31) (chrome.* localized to `src/lib/`), roadmap [#41](https://github.com/50ra4/crx-vite-ts-react-template/issues/41)

## Context

The goal state for this template is to **not unnecessarily block** a future
expansion to Edge or Firefox — it is explicitly *not* to ship that support now.
Without recording the reasoning, contributors and AI coding agents are likely to
re-litigate the question and re-invent polyfills or abstractions the project has
already decided against. This ADR captures that decision so the policy is
durable. It changes no code.

The facts the decision rests on (verified at the accessed dates below):

- **Edge is Chromium-based.** The current build artifact runs on Edge essentially
  as-is; the differences are in host store review, not in extension runtime
  behavior. (Microsoft Edge Add-ons documentation, accessed 2026-07-18:
  <https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/>)
- **Firefox MV3 supports the `chrome.*` namespace and Promise-based
  `browser.*` APIs.** Code written against `chrome.*` is not the primary porting
  obstacle. However, the background model differs: at the accessed date Firefox's
  MV3 background is an **event page** declared via `background.scripts`, whereas
  Chrome uses a **service worker** via `background.service_worker`. A future port
  therefore needs a manifest branch, not a code rewrite. (MDN,
  "Background scripts" and "Differences between API implementations", accessed
  2026-07-18:
  <https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Background_scripts>,
  <https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities>)
- **`webextension-polyfill` is effectively unmaintained.** Its last npm release
  was published 2024-05 (`webextension-polyfill@0.12.0`). Given Firefox's native
  `chrome.*` + Promise support, adopting it would add a stalled runtime dependency
  without a clear payoff. (npm registry, accessed 2026-07-18:
  <https://www.npmjs.com/package/webextension-polyfill>)
- **The migration seam already exists.** Per #31 (completed), all real `chrome.*`
  access is confined to `src/lib/` and this boundary is statically enforced by
  Oxlint (`no-restricted-globals` / `no-restricted-properties` overrides). Any
  API-shape difference between browsers is thus already localized to one layer.

## Decision

- **Chrome — and the Chromium family, including Edge — is the single primary
  target.** Edge is covered by the Chromium artifact with no dedicated work.
- **Firefox support is not implemented.** Specifically, this template ships no
  Firefox/Edge-specific build, no per-browser manifest branching, and no
  cross-browser verification.
- **`webextension-polyfill` is not adopted**, for the reasons above.
- **The migration path is preserved by design, not by abstraction.** When Firefox
  support is actually wanted, the change is expected to be confined to:
  1. swapping or extending implementations **inside `src/lib/`** (the only place
     `chrome.*` is touched), and
  2. a **manifest branch** for the background shape and any API differences (for
     example via the crxjs `browser` build option and a
     `service_worker`-vs-`scripts` background split).

  No speculative cross-browser abstraction layer is added ahead of that need.

## Consequences

Positive:

- No dead abstraction and no stalled dependency are carried by default.
- The manifest and dependency surface stay minimal and Chrome-focused.
- The `src/lib/` boundary from #31 doubles as the documented migration seam, so
  the "don't block Firefox" goal is met without present-day cost.

Negative / limits:

- There is no Firefox verification today. The migration seam is *claimed* but
  remains **unproven** until a real port exercises it.
- Contributors wanting Firefox support must do the manifest/background work
  themselves; this template only guarantees the code boundary, not a working
  Firefox build.

## Re-evaluation triggers

Revisit this decision when any of the following occurs:

- A concrete Firefox-support Issue is filed, or real user/downstream demand for
  Firefox appears.
- crxjs's cross-browser capabilities change materially (e.g. first-class
  multi-browser manifest/background handling).
- Firefox's MV3 background model changes materially — in particular, service
  worker parity with Chrome — collapsing the manifest-branch difference.
- `webextension-polyfill` (or an equivalent) resumes active maintenance **and** a
  concrete API gap makes it worth a runtime dependency.
