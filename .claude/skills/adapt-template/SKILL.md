---
name: adapt-template
description: Turn this template into a real Chrome extension project. Use when starting a new extension from this repo (rename, clean samples, adjust manifest permissions).
---

Checklist:

- **`package.json`**: update `name` (the kebab-case npm package identifier),
  `displayName` (the human-readable Chrome product name), `description`,
  `repository`, `bugs`, `homepage`, `author`. `manifest.config.ts` derives the
  extension `name` from `displayName` and its version from `version`.
  `npm run verify:manifest` warns while `displayName` still has the template
  default.
- **`manifest.config.ts`**: fill in `description` (currently empty), review
  `permissions` (currently just `['storage']`), and review
  `content_scripts[].matches` — the template ships with a sample match on
  `https://example.com/*`. When changing that match, update the production URL
  and host-permission values in `e2e/extension.spec.ts` so its intercepted page
  is still covered.
- **Delete or replace sample code**: `src/examples/` collects everything
  disposable — delete the whole directory in one shot, or replace pieces
  individually:
  - `src/examples/components/SampleComponent.tsx` + its `.test.tsx`
  - `src/examples/hooks/useIncrement.ts` + its `.test.ts`
  - `src/examples/utils/calc.ts` + its `.test.ts`
  - `src/entrypoints/content/sample.tsx` — also remove its `content_scripts[]`
    entry in `manifest.config.ts`
- **Remove unused surfaces**: if you don't need e.g. the options page, delete
  the HTML file, the `src/entrypoints/<surface>/<name>.tsx` file, and the
  matching key in `manifest.config.ts` together (see `.claude/skills/add-entrypoint/SKILL.md`
  for what the three wiring points are).
- **Icons**: replace `assets/branding/icon.svg` and `icon-dev.svg`, then run
  `npm run render:icons` to regenerate the 16/48/128 px PNG files under
  `public/logo/`. The development variants keep the `-dev` suffix used by
  `npm run dev`. Install Chromium once with
  `npx playwright install chromium` if Playwright has not downloaded it yet.
- **`README.md`**: rewrite for the real project (current one describes the template itself).
- **`docs/store/`**: rewrite the three Chrome Web Store templates
  (`privacy-policy.md`, `store-listing.md`, `manual-test.md`) for the real
  product, replacing every placeholder and HTML comment — they ship as blank
  forms, not as usable copy. Their permission and stored-data sections must
  match the final `manifest.config.ts`, so do this after the permission review
  above (see `.claude/skills/release/SKILL.md` phase (e) for when these
  documents gate a release).
- **After cleanup, confirm CI still passes locally**: `npm run check-type`,
  `npm run build`, `npm test`.
