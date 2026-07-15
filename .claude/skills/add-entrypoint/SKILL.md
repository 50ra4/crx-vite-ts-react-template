---
name: add-entrypoint
description: Add or rewire a Chrome extension surface (popup, options page, devtools page, background service worker, or content script) in this template. Use when creating a new entry point or changing how an existing one is wired.
---

Three wiring points, in order:

1. **Root-level HTML** (popup, options, devtools only — not background or
   content scripts): add a file like `popup.html` at repo root with
   `<div id="root"></div>` and `<script type="module" src="/src/<name>.tsx"></script>`.
   Copy the shape of the existing `popup.html`/`options.html`/`devTools.html`.

2. **`src/<name>.tsx`**: standard mount boilerplate — see
   `.claude/rules/typescript-react.md` for the exact snippet, don't re-derive it.
   Content scripts don't mount into a host `#root`; they create and prepend
   their own DOM node instead (see `.claude/rules/chrome-extension.md`).

3. **Register in `manifest.config.ts`** — the key depends on the surface:
   - popup → `action.default_popup: '<name>.html'`
   - options page → `options_ui.page: '<name>.html'`
   - devtools page → `devtools_page: '<name>.html'`
   - background → `background.service_worker: 'src/<name>.ts'`
   - content script → add an entry to `content_scripts[]` with both
     `matches: [...]` and `js: ['src/content_scripts/<name>.tsx']`

**Verify:**

- `npm run build` — confirm the new file appears under `extension/` and that
  `extension/manifest.json` references it correctly.
- For content scripts, double-check the `matches` pattern targets the right
  site(s).
- `npm run dev` gives HMR for the new surface via `@crxjs/vite-plugin`.
