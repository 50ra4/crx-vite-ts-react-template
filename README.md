# crx-vite-ts-react-template

[![CI](https://github.com/50ra4/crx-vite-ts-react-template/actions/workflows/ci.yml/badge.svg)](https://github.com/50ra4/crx-vite-ts-react-template/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

**English** | [日本語](./docs/README.ja.md)

A Chrome extension (Manifest V3) template built with [Vite](https://vitejs.dev/),
TypeScript, [React](https://react.dev/), and
[CRXJS](https://crxjs.dev/vite-plugin). It ships all four extension surfaces
(popup, options, background, content script) already wired together through a
typed messaging layer and a typed storage schema, plus the verification and
release pipeline to take a project from `git clone` to a Chrome Web Store
upload.

> English is the canonical version of this document. The Japanese translation
> ([docs/README.ja.md](./docs/README.ja.md)) may lag behind; when they
> disagree, this file wins.

## Features

- **Working MV3 surfaces out of the box** — popup, options page, background
  service worker, and content script, each in its own directory under
  [`src/entrypoints/`](./src/entrypoints).
- **Typed messaging between surfaces** — define a message once in
  [`src/lib/messaging/messages.ts`](./src/lib/messaging/messages.ts) and both
  sender and handler are fully typed. Runtime payload guards and
  `sender.id === chrome.runtime.id` verification are built in. Zero runtime
  dependencies.
- **Typed storage** — declare a key (area + default value) in
  [`src/lib/storage/schema.ts`](./src/lib/storage/schema.ts) and get typed
  `get` / `set` / `remove`, change subscription, and a React hook
  (`useStorageValue`) for free.
- **Enforced architecture boundary** — real `chrome.*` access is allowed only
  inside `src/lib/`; Oxlint fails the build on violations, so shared code
  stays testable and surfaces stay decoupled.
- **Three verification layers** — Vitest unit tests (jsdom + an in-memory
  `chrome` fake), built-manifest assertions
  ([`scripts/verify-manifest.mjs`](./scripts/verify-manifest.mjs)), and
  Playwright smoke tests against the built extension in a real Chromium.
- **Least privilege by contract** — permissions, host permissions, and CSP are
  pinned by `verify-manifest.mjs`; growing a privilege requires a visible
  allowlist diff, and `externally_connectable` is rejected outright.
- **Reproducible packaging & tag-driven releases** — `npm run package`
  produces a verified `extension.zip`; pushing a `v*` tag runs the full check
  suite and publishes a GitHub Release with the zip attached.
- **AI-agent ready** — [`AGENTS.md`](./AGENTS.md) documents the design and
  verification contracts so coding agents (and humans) can change the code
  safely.

## Screenshots

| Popup                                | Options                                  |
| ------------------------------------ | ---------------------------------------- |
| ![Popup](./docs/images/popup.png)    | ![Options](./docs/images/options.png)    |

## Requirements

- Node.js `>=24.0.0` ([`.nvmrc`](./.nvmrc) pins 24)
- Google Chrome or Chromium (for manual testing and E2E)

## Quick start

1. Click **Use this template** on GitHub to create your own repository (or
   clone this one directly), then install dependencies:

   ```sh
   git clone https://github.com/<your-account>/<your-extension>.git
   cd <your-extension>
   npm ci
   ```

   `npm ci` also installs the husky pre-commit hook, which lints and formats
   staged files on every commit.

2. Start the dev server:

   ```sh
   npm run dev
   ```

   CRXJS writes a development build to `dist/` and keeps it connected to the
   Vite dev server for HMR.

3. Load the extension into Chrome: open `chrome://extensions`, enable
   **Developer mode**, click **Load unpacked**, and select the `dist/`
   directory. The extension appears with a `[DEV]` name prefix.

4. Try it: click the extension's toolbar icon to open the popup, open the
   options page from the extension's details screen, and visit
   `https://example.com` to see the content script. Edit
   `src/entrypoints/popup/popup.tsx` and watch the popup hot-reload.

For a production build, run `npm run build` — the output goes to `extension/`
and can be loaded unpacked the same way.

## Development

| Surface        | Entry file                                | Notes                                                                       |
| -------------- | ----------------------------------------- | --------------------------------------------------------------------------- |
| Popup          | `src/entrypoints/popup/popup.tsx`         | Loaded via `popup.html`. Reads a shared storage value and sends a typed message to the background. |
| Options page   | `src/entrypoints/options/options.tsx`     | Loaded via `options.html`. Saves a setting to `chrome.storage.sync`.        |
| Background     | `src/entrypoints/background/background.ts`| MV3 service worker. Registers the typed message handlers.                   |
| Content script | `src/entrypoints/content/sample.tsx`      | Injected on `https://example.com/*` (see `manifest.config.ts`).             |

The manifest is not written by hand: it is generated from
[`manifest.config.ts`](./manifest.config.ts) by `@crxjs/vite-plugin` at
build time. In dev mode the extension name gets a `[DEV]` prefix and the dev
icon set is used, so a dev build and a production install can coexist.
`index.html` is a dev-only launcher page linking to the popup and options
pages; it is not part of the extension.

A DevTools panel surface is intentionally not included. If you need one, see
the [chrome.devtools documentation](https://developer.chrome.com/docs/extensions/reference/api/devtools)
and `.claude/skills/add-entrypoint/SKILL.md`.

## Testing and verification

| Command                   | What it does                                                              |
| ------------------------- | ------------------------------------------------------------------------- |
| `npm test`                | Vitest unit tests (jsdom; `npm run test -- --watch` for watch mode)       |
| `npm run e2e`             | Playwright smoke tests against the built extension in a real Chromium     |
| `npm run lint`            | Oxlint, check-only (includes the `chrome.*` boundary rule)                |
| `npm run format`          | Prettier, rewrites files                                                  |
| `npm run check-type`      | `tsc --noEmit`                                                            |
| `npm run verify:manifest` | Asserts the built `extension/manifest.json` against the pinned allowlists |
| `npm run verify`          | check-type → lint → test → build → verify:manifest, in series             |
| `npm run verify:full`     | `verify` + `e2e` — the full contract                                      |

Notes:

- E2E requires Chromium once: `npx playwright install chromium`.
- E2E loads the **build output**, not the dev server, so build first:
  `npm run build && npm run e2e`.
- After changing code, `npm run verify` is the single command that proves the
  change is safe; run `npm run verify:full` when the change affects the built
  extension's runtime wiring (entrypoints, messaging, manifest).

CI ([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)) runs the same
checks — type check, lint, unit tests, build + manifest verification, and the
real-Chromium E2E — on every push to `main` and every pull request.

## Architecture

```
src/
├── entrypoints/   # one directory per extension surface
│   ├── popup/
│   ├── options/
│   ├── background/
│   └── content/
├── lib/           # shared modules: typed messaging, typed storage, test fakes
│   ├── messaging/
│   ├── storage/
│   └── testing/
└── examples/      # sample components/hooks/utils — safe to delete wholesale
```

Dependency-direction rules (enforced where possible, documented in
[`src/lib/README.md`](./src/lib/README.md)):

- `entrypoints → lib` is the only allowed direction; `lib` never imports from
  `entrypoints`.
- Entrypoints never import each other. Surfaces are separate runtime contexts;
  they communicate through the typed messaging layer.
- Real `chrome.*` access lives only inside `src/lib/`. Outside it, referencing
  the `chrome` global is an Oxlint **error** — add a thin wrapper in
  `src/lib/` instead. Type-only references via `@types/chrome` are allowed
  everywhere; an unavoidable exception must carry a reasoned `oxlint-disable`
  comment.

Common changes:

- **Add a message type**: add one `defineMessage(...)` entry in
  `src/lib/messaging/messages.ts`, register the handler in
  `src/entrypoints/background/background.ts`, and call
  `sendMessage(name, payload)` from any surface.
- **Add a storage key**: add the key to `AppStorageValues` and
  `storageSchema` in `src/lib/storage/schema.ts`; the typed accessors and the
  `useStorageValue` hook follow automatically.
- **Add a surface**: see `.claude/skills/add-entrypoint/SKILL.md`.

### Making it your own

The template separates reusable infrastructure (`src/lib/`) from sample code:

1. Delete `src/examples/` entirely — nothing outside it imports from it.
2. Replace the sample UI in `src/entrypoints/` (popup / options / content) and
   the `greet` sample message with your own features.
3. Update `package.json` (name, description, repository), the manifest
   description in `manifest.config.ts`, and the icons in `public/logo/`.
4. Adjust or remove the content script `matches` (`https://example.com/*`) in
   `manifest.config.ts` — and mirror the change in
   `scripts/verify-manifest.mjs` (see below).

`.claude/skills/adapt-template/SKILL.md` contains the full checklist.

### Adding a Chrome permission

Permissions are guarded against silent growth:

1. Add the permission to `permissions` (or `host_permissions` /
   `optional_permissions`) in `manifest.config.ts`.
2. Update the matching allowlist (`EXPECTED_PERMISSIONS`,
   `EXPECTED_HOST_PERMISSIONS`, …) in `scripts/verify-manifest.mjs`.
3. Run `npm run verify` — a mismatch between the built manifest and the
   allowlists fails `verify:manifest` **by design**, so every privilege change
   shows up as a reviewable diff.

The same script pins the CSP to `script-src 'self'; object-src 'self';` and
rejects `externally_connectable`.

## Packaging and release

- `npm run package` builds, verifies the manifest, and creates a reproducible
  `extension.zip` containing only the distributable files from `extension/`.
  The same source, Node version, and lockfile always produce the same zip.
- Releases are tag-driven: bump the version, merge, and push a `v*` tag. The
  [Release workflow](./.github/workflows/release.yml) re-runs type check,
  lint, unit tests, packaging, and the real-Chromium E2E, and only then
  publishes a GitHub Release with `extension.zip` attached. See
  [docs/releasing.md](./docs/releasing.md) for the step-by-step procedure.
- Publishing to the Chrome Web Store is a manual step by design (no store API
  keys to manage): upload the generated `extension.zip` in the developer
  dashboard, following the
  [official publishing guide](https://developer.chrome.com/docs/webstore/publish).

## AI agent support

The repository ships a configuration layer for coding agents:

- [`AGENTS.md`](./AGENTS.md) — the always-loaded contract: architecture
  invariants, change recipes, forbidden changes, and which verification
  command proves a change safe.
- [`CLAUDE.md`](./CLAUDE.md) — Claude Code entry point; it just imports
  `AGENTS.md`.
- `.claude/rules/` — file-scoped conventions (TypeScript/React, Chrome
  extension specifics, testing) loaded on demand.
- `.claude/skills/` — step-by-step playbooks for common tasks (adapting the
  template, adding a surface, releasing).

Only `AGENTS.md` is loaded on every session; the rest is pulled in when
relevant, keeping token usage low.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, verification, and the PR
flow, and [SECURITY.md](./SECURITY.md) for how to report vulnerabilities
privately. This project follows the
[Contributor Covenant](./CODE_OF_CONDUCT.md).

## License

[MIT](./LICENSE)
