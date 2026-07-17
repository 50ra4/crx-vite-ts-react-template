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

**(c) CI:**

`.github/workflows/ci.yml` runs on push to `main` and on pull requests, as four
parallel jobs: `check-type`, `lint`, `test`, `build` (each `npm ci` then the
matching npm script). Workflow-level `permissions: contents: read` and a
`concurrency` group cancel stale runs on the same ref.

**(d) Versioning:**

Bump `version` in `package.json`. `manifest.config.ts` imports `version` from
`package.json` and sets it directly as the manifest's `version` field, so no
separate manifest edit is needed.
