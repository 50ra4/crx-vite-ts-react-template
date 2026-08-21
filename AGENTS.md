<!-- AGENTS:UNIVERSAL:BEGIN -->

# Universal collaboration contract

This section contains repository-independent working rules that remain applicable
after this template becomes a product. Do not change it merely because product
surfaces, shared layers, or inherited documents change.

## Verification contract

After changing code or documentation, prove the result with the repository's
relevant checks. The checks themselves (types, lint, tests, build, and contract
verification) are the source of truth; prose only explains which gate to run.

- Prefer the repository-defined top-level verification command that runs the
  required checks in order.
- Use the repository's full verification gate when runtime wiring or browser
  behavior may have changed.
- A passing command is not sufficient when it warns that a template default,
  placeholder, or stale contract remains.

## Architecture invariants

- **Dependency direction is runtime entrypoints → shared modules only.** Shared
  modules never import runtime entrypoints; a back-edge couples reusable code to one
  surface.
- **Entrypoints do not import each other directly.** Extension surfaces are separate
  runtime contexts and communicate through an explicit messaging boundary rather
  than shared module state.
- **Direct browser API access is centralized in the designated shared boundary and
  enforced by lint.** Type-only API references are allowed outside that boundary.
  An unavoidable runtime exception must carry a reasoned lint-disable comment so the
  boundary violation stays visible.

## Conventions

- Named exports only, no default exports — except configuration files whose tools
  require a default export.
- Unit tests are colocated with source; helper and browser tests use the
  repository-defined locations and environments.
- Formatting, quote style, and static checks are enforced by the configured tools;
  run them instead of hand-checking.

## Git

- Stage files individually; never `git add -A` / `git add .`.
- Use Conventional Commit types: feat, fix, docs, style, refactor, test, chore.
- Commit bodies record WHY, not what.

## Responses

Reply in Japanese, conclusion first, concise. No greetings, emoji, or progress
narration. Point out problems bluntly.

## Safety

- Destructive ops (rm -rf, force-push, history rewrite) need explicit user approval.
- Never read, print, or commit secrets.
- Record a repeated user correction in the repository's persistent instructions.

<!-- AGENTS:UNIVERSAL:END -->

<!-- AGENTS:DERIVATION-REQUIRED:BEGIN -->

# crx-vite-ts-react-template

> **Derived products must update this entire section.** Keep the boundary markers,
> but rewrite or delete every claim that no longer matches the retained surfaces,
> shared layers, commands, recipes, and on-demand references. Follow
> `.claude/skills/adapt-template/SKILL.md`; a passing build does not excuse stale
> agent instructions.

<!-- AGENTS:DERIVATION-METADATA:BEGIN -->

```json
{
  "entrypointRoot": "src/entrypoints",
  "sharedRoot": "src/lib",
  "surfaces": ["background", "content", "options", "popup"],
  "sharedLayers": ["messaging", "storage", "testing"]
}
```

<!-- AGENTS:DERIVATION-METADATA:END -->

Chrome extension (Manifest V3) template built with Vite + TypeScript + React.
Surfaces: popup, options page, background service worker, content script — each lives
under `src/entrypoints/`. Root-level HTML files load the popup and options
entrypoints; the manifest is generated from
`manifest.config.ts` via `@crxjs/vite-plugin`; `npm run build` outputs to
`extension/` (gitignored). `src/lib/` holds shared modules entrypoints may import
(never the reverse); `src/examples/` holds deletable sample code. See README's
"Architecture" section for the full dependency-direction rules.

## Commands

| Command | What it does | Notes |
| --- | --- | --- |
| `npm ci` | Install deps | installs exactly from `package-lock.json` |
| `npm run dev` | Vite dev server with HMR | via `@crxjs/vite-plugin` |
| `npm run build` | Build to `extension/` | deletes and recreates the dir |
| `npm run package` | Build, verify manifest, create reproducible `extension.zip` | archives distributable files from `extension/` |
| `npm run verify` | check-type → lint → test → build → verify:manifest, in series | the safety contract for most changes; excludes e2e for speed |
| `npm run verify:full` | `verify` then `npm run e2e` | full contract; requires installed Chromium |
| `npm run e2e` | Run Playwright Chromium smoke tests | requires a prior build and installed Chromium |
| `npm run render:icons` | Render 16/48/128 px normal/dev PNG icons from SVG sources | requires installed Chromium |
| `npm run check-type` | `tsc --noEmit` | |
| `npm test` | Run Vitest | src tests use jsdom; script and e2e helper tests use Node |
| `npm run lint` | `oxlint` (check-only) | no file mutation; pre-commit runs the staged-only equivalent via lint-staged |
| `npm run format` | `prettier --write` | rewrites files on disk; pre-commit runs the staged-only equivalent via lint-staged |
| `npm run zip` | Alias for `npm run package` | |

`.nvmrc` pins Node 24, matching the `engines.node` (`>=24.0.0`) requirement.

### Verification gates for this repository

- `npm run verify` runs check-type, lint, unit tests, build, and manifest
  verification in order. `verify:manifest` reads the built
  `extension/manifest.json`, so build always runs first.
- `npm run verify:full` runs `verify` and the real-Chromium E2E suite.

| Change | Run |
| --- | --- |
| `src/lib/**`, types, unit tests, `src/examples/**`, agent-document contracts | `npm run verify` |
| `manifest.config.ts`, permissions, CSP | `npm run verify` (asserts the manifest) |
| entrypoint wiring, messaging/storage round-trips, anything E2E exercises | `npm run verify:full` |

CI already runs the same underlying checks as separate jobs.

## Repository conventions

- Components are arrow functions.
- Hooks return tuples `as const` (state, action).
- The default-export exceptions are `vite.config.ts`, `manifest.config.ts`,
  `playwright.config.ts`, and `vitest.config.ts` because their tools require them.
- Unit tests are colocated as `*.test.ts(x)` next to TypeScript source or
  `*.test.mjs` next to Node scripts. E2E helper unit tests live under `e2e/` as
  `*.test.ts` with the Node environment pragma; Playwright smoke tests use
  `*.spec.ts`.
- Oxlint, Prettier, and tsc enforce the repository style. Import order is not
  lint-enforced; keep imports reasonably grouped.
- Repeated user corrections are recorded in the matching `.claude/rules/*.md` file.

## Product architecture

- `src/lib/` is reusable shared infrastructure. Tests that need Chrome APIs use
  `installChromeFake` from `src/lib/testing/chromeFake.ts`.
- Popup, options, background, and content entrypoints communicate through the typed
  messaging layer in `src/lib/messaging/`.
- The Oxlint restrictions in `.oxlintrc.json` enforce the `chrome.*` access boundary.

## Recipes

Minimal, real code paths for common changes:

- **Add a message type.** In `src/lib/messaging/messages.ts`, add one entry to
  `messages` via `defineMessage(isRequest, isResponse)` (hand-written type-guard
  predicates; no runtime schema dependency). Register the handler in
  `src/entrypoints/background/background.ts` under `addMessageListeners({ ... })`,
  and send from a surface with `sendMessage(name, payload)`. The generic engine in
  `src/lib/messaging/createMessaging.ts` needs no change. Run
  `npm run verify:full` because only the real-Chromium E2E exercises the round-trip.
- **Add a storage key.** Add the key to `AppStorageValues` and `storageSchema` in
  `src/lib/storage/schema.ts` (`area` plus `defaultValue`). Generic accessors and
  `useStorageValue` follow automatically. Run `npm run verify`; use `verify:full`
  when a surface is wired to the key.
- **Add a Chrome permission.** Update `permissions`, `host_permissions`, or
  `optional_permissions` in `manifest.config.ts` and the matching array in
  `scripts/expected-manifest.config.mjs` atomically. The mismatch failure guards
  against silent privilege growth. Do not modify the generic engine for a
  product-specific manifest shape. Run `npm run verify`.

## Forbidden changes

Do not make these without explicit owner sign-off:

- Adding a manifest permission or host permission without updating the matching
  array in `scripts/expected-manifest.config.mjs` and documenting why it is needed.
- Adding an external runtime dependency to `src/lib/`; the messaging and storage
  layers are dependency-free by design.
- Relaxing the extension-pages CSP from
  `script-src 'self'; object-src 'self';`. The expectation config cannot override
  this invariant.
- Declaring `externally_connectable`; the generic verifier rejects it and the
  expectation config cannot permit it.

## On-demand context

Read these only when the row matches the task:

| When you are... | Read |
| --- | --- |
| editing any `.ts`/`.tsx` file | `.claude/rules/typescript-react.md` |
| touching `manifest.config.ts`, background, or content scripts | `.claude/rules/chrome-extension.md` |
| writing tests | `.claude/rules/testing.md` |
| adding an extension surface (popup/options/background/content script) | `.claude/skills/add-entrypoint/SKILL.md` |
| pruning surfaces, setting product identity, or auditing inherited docs while turning this template into a real extension | `.claude/skills/adapt-template/SKILL.md` |
| releasing/packaging/deploying | `.claude/skills/release/SKILL.md` |

<!-- AGENTS:DERIVATION-REQUIRED:END -->
