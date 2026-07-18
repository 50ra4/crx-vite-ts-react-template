---
name: release
description: "Package, verify, and release the extension: build a reproducible extension.zip, load unpacked into Chrome, or publish a tag-driven GitHub Release. Use for release or manual-testing-in-browser tasks."
---

**(a) Local verification (load unpacked):**

1. `npm run build` (outputs to `extension/`)
2. Chrome → `chrome://extensions`
3. Enable Developer mode
4. "Load unpacked" → select the `extension/` directory

**(b) Packaging:**

`npm run package` builds the extension, verifies its manifest, and produces a
reproducible `extension.zip` containing only the contents of `extension/`.
`npm run zip` is a compatibility alias. Both `extension/` and `extension.zip`
are gitignored — never commit them.

**(c) CI:**

`.github/workflows/ci.yml` runs on push to `main` and on pull requests, as five
parallel jobs: `check-type`, `lint`, `test`, `build`, and `e2e`. Workflow-level
`permissions: contents: read` and a `concurrency` group cancel stale runs on the
same ref.

`.github/workflows/release.yml` runs on `v*` tag pushes. It requires the tag to
equal `v${package.json.version}`, repeats the checks (including E2E), and creates
a GitHub Release with generated notes and `extension.zip`.

**(d) Versioning:**

Bump `version` in `package.json`. `manifest.config.ts` imports `version` from
`package.json` and sets it directly as the manifest's `version` field, so no
separate manifest edit is needed. Follow `docs/releasing.md`; use `npm version
<version> --no-git-tag-version` to keep `package-lock.json` aligned.
