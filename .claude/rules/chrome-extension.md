---
paths: ['manifest.config.ts', 'src/background.ts', 'src/content_scripts/**']
---

MV3 facts specific to this repo:

- `src/background.ts` is a service worker — no DOM, no `window`.
- All manifest changes go through `manifest.config.ts` (`defineManifest`); never hand-edit a raw `manifest.json`.
- Dev vs. build differ in `manifest.config.ts`: the extension name is prefixed
  `[DEV] ${name}` when `command === 'serve'`, and icon filenames get a `-dev`
  suffix (`createIconFileSuffix`).
- Messaging pattern: `chrome.runtime.sendMessage(msg, (res) => ...)` from a
  UI surface, `chrome.runtime.onMessage.addListener((request, _, sendResponse) => ...)`
  in the background worker — see `popup.tsx` + `background.ts`.
- Content scripts have no host HTML: create a DOM node, `document.body.prepend(root)`,
  then `createRoot(root).render(...)` — see `src/content_scripts/sample.tsx`.
- A content script's `matches` and `js` entries both live in `manifest.config.ts`
  under `content_scripts[]` (e.g. `{ matches: [...], js: ['src/content_scripts/sample.tsx'] }`).
- Chrome APIs are typed via `@types/chrome`.
