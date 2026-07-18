---
paths: ['manifest.config.ts', 'src/entrypoints/background/**', 'src/entrypoints/content/**']
---

MV3 facts specific to this repo:

- `src/entrypoints/background/background.ts` is a service worker — no DOM, no `window`.
- All manifest changes go through `manifest.config.ts` (`defineManifest`); never hand-edit a raw `manifest.json`.
- Dev vs. build differ in `manifest.config.ts`: the extension name is prefixed
  `[DEV] ${name}` when `command === 'serve'`, and icon filenames get a `-dev`
  suffix (`createIconFileSuffix`).
- Stable package versions are copied to manifest `version`. For prereleases,
  manifest `version` uses the numeric SemVer core and `version_name` preserves
  the complete package version because Chrome rejects prerelease text in `version`.
- Messaging goes through the typed layer in `src/lib/messaging/`, never
  `chrome.runtime.sendMessage` / `onMessage` directly. Declare the contract in
  `src/lib/messaging/messages.ts` (`defineMessage`), send with `sendMessage(name, payload)`
  from a UI surface, and register handlers with `addMessageListeners({...})` in the
  background worker — see `entrypoints/popup/popup.tsx` + `entrypoints/background/background.ts`.
  The layer enforces `sender.id === chrome.runtime.id` and runtime payload guards by default.
- Content scripts have no host HTML: create a DOM node, `document.body.prepend(root)`,
  then `createRoot(root).render(...)` — see `src/entrypoints/content/sample.tsx`.
- A content script's `matches` and `js` entries both live in `manifest.config.ts`
  under `content_scripts[]` (e.g. `{ matches: [...], js: ['src/entrypoints/content/sample.tsx'] }`).
- Chrome APIs are typed via `@types/chrome`.
