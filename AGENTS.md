# crx-vite-ts-react-template

Chrome extension (Manifest V3) template built with Vite + TypeScript + React.
Surfaces: popup, options page, devtools page, background service worker, content script.
Root-level HTML files load `src/<name>.tsx`; the manifest is generated from
`manifest.config.ts` via `@crxjs/vite-plugin`; `npm run build` outputs to
`extension/` (gitignored).

## Commands

| Command | What it does | Notes |
| --- | --- | --- |
| `npm ci` | Install deps | 645 packages, verified OK |
| `npm run dev` | Vite dev server with HMR | via `@crxjs/vite-plugin` |
| `npm run build` | Build to `extension/` | deletes and recreates the dir |
| `npm run check-type` | `tsc --noEmit` | |
| `npm test` | Run Jest | 3 sample tests, jsdom env |
| `npm run lint` | prettier --write, then eslint --fix | **rewrites files on disk**; same command runs in the pre-commit hook |
| `npm run zip` | build + `extension.zip` | |
| `npm run docs` | rebuild `docs/` from `gh-pages/` + zip | used by GitHub Pages deploy |

`.nvmrc` pins Node 16.15.1, but every command above was verified working on Node 22.

## Conventions

- Named exports only, no default exports — except `*.config.ts` (`vite.config.ts`, `manifest.config.ts`, `jest.config.ts`), which must keep `export default` because Vite/CRXJS/ts-jest require it to load the config.
- Components are arrow functions.
- Tests are colocated as `*.test.ts(x)` next to the source file.
- Hooks return tuples `as const` (state, action).
- Everything else (formatting, import order, quote style, etc.) is enforced by ESLint/Prettier/tsc — run them, don't hand-check.

## On-demand context

Read these only when the row matches your task — they are excluded from the always-loaded context by design.

| When you are... | Read |
| --- | --- |
| editing any `.ts`/`.tsx` file | `.claude/rules/typescript-react.md` |
| touching `manifest.config.ts`, background, or content scripts | `.claude/rules/chrome-extension.md` |
| writing tests | `.claude/rules/testing.md` |
| adding an extension surface (popup/options/devtools/content script) | `.claude/skills/add-entrypoint/SKILL.md` |
| turning this template into a real extension project | `.claude/skills/adapt-template/SKILL.md` |
| releasing/packaging/deploying | `.claude/skills/release/SKILL.md` |

## Git

- Stage files individually; never `git add -A` / `git add .`.
- Use Conventional Commit types: feat, fix, docs, style, refactor, test, chore.
- Commit body records WHY, not what.

## Responses

Reply in Japanese, conclusion first, concise. No greetings, emoji, or progress narration. Point out problems bluntly.

## Safety

- Destructive ops (rm -rf, force-push, history rewrite) need explicit user approval.
- Never read, print, or commit secrets.
- If the user corrects the same mistake twice, append the correction to the matching `.claude/rules/*.md` file.
