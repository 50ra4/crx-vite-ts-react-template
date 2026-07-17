---
name: adapt-template
description: Turn this template into a real Chrome extension project. Use when starting a new extension from this repo (rename, clean samples, adjust manifest permissions).
---

Checklist:

- **`package.json`**: update `name`, `description`, `repository`, `bugs`,
  `homepage`, `author`. `manifest.config.ts` derives the extension `name`
  and `version` from here, so this is enough to rename the built extension.
- **`manifest.config.ts`**: fill in `description` (currently empty), review
  `permissions` (currently just `['background']`), and review
  `content_scripts[].matches` — the template ships with a sample match on
  `https://example.com/*`.
- **Delete or replace sample code**:
  - `src/components/SampleComponent.tsx` + its `.test.tsx`
  - `src/hooks/useIncrement.ts` + its `.test.ts`
  - `src/utils/calc.ts` + its `.test.ts`
  - `src/content_scripts/sample.tsx` — also remove its `content_scripts[]`
    entry in `manifest.config.ts`
- **Remove unused surfaces**: if you don't need e.g. the devtools page or
  options page, delete the HTML file, the `src/<name>.tsx` file, and the
  matching key in `manifest.config.ts` together (see `.claude/skills/add-entrypoint/SKILL.md`
  for what the three wiring points are).
- **Icons**: replace files under `public/logo/` (icon16/48/128, plus the
  `-dev` variants used by `npm run dev`).
- **`README.md`**: rewrite for the real project (current one describes the template itself).
- **After cleanup, confirm CI still passes locally**: `npm run check-type`,
  `npm run build`, `npm test`.
