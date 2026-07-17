---
name: release
description: "Package, verify, and distribute the extension: build extension.zip, load unpacked into Chrome, or publish the download page via GitHub Pages. Use for release or manual-testing-in-browser tasks."
---

**(a) Local verification (load unpacked):**

1. `npm run build` (outputs to `extension/`)
2. Chrome → `chrome://extensions`
3. Enable Developer mode
4. "Load unpacked" → select the `extension/` directory

**(b) Packaging:**

`npm run zip` runs the build and produces `extension.zip` at the repo root.
Both `extension/` and `extension.zip` are gitignored — never commit them.

**(c) GitHub Pages flow:**

`npm run docs` = `rm -rf docs && cp -r gh-pages docs && npm run zip && mv extension.zip docs`
— it copies the static `gh-pages/` site into `docs/` and drops the built
`extension.zip` into it for download. `docs/` is also gitignored; it's
generated fresh, not maintained by hand.
`.github/workflows/deploy-docs.yml` runs `npm run docs` and publishes
`./docs` to GitHub Pages on every push to `main`.

**(d) CI:**

`.github/workflows/ci.yml` runs on every push: `npm ci` → `npm run check-type`
→ `npm run build` → `npm run test`. Lint is **not** part of CI — it only runs
locally via the husky pre-commit hook, which runs lint-staged (`oxlint --fix`
then `prettier --write`) against staged files only.

**(e) Versioning:**

Bump `version` in `package.json`. `manifest.config.ts` imports `version` from
`package.json` and sets it directly as the manifest's `version` field, so no
separate manifest edit is needed.
