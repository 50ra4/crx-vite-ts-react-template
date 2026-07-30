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

Bump `version` in `package.json`; no separate manifest edit is needed. Stable
versions are copied to manifest `version`. Prereleases use the numeric SemVer
core for `version` and the complete package version for `version_name`. Follow
`docs/releasing.md`; use `npm version <version> --no-git-tag-version` to keep
`package-lock.json` aligned.

**(e) Store publishing checklist:**

For every release submitted to the Chrome Web Store, **including unlisted ones**
— unlisted is a store distribution hidden from search, subject to the same
review, listing information, and privacy declarations. Only distribution outside
the store (self-hosted `.zip`/`.crx`, enterprise policy) skips this phase.
Complete "Chrome Web Store publishing checklist" in `docs/releasing.md` before
tagging:

1. Fill the three templates in `docs/store/` (`privacy-policy.md`,
   `store-listing.md`, `manual-test.md`) with product-specific content, leaving
   no placeholder or template comment behind.
2. If the extension handles user data (local persistence included), publish the
   privacy policy at a stable public URL, set that URL in the developer
   dashboard's privacy fields, and confirm the hosted page matches
   `docs/store/privacy-policy.md` at this version — the repository file alone
   does not satisfy the requirement.
3. Complete the dashboard's **Privacy practices** form, not just the policy URL:
   single-purpose description, permission and remote-code justifications,
   collected data types with usage and sharing, and the certification
   checkboxes — each matching the submitted build and the three `docs/store/`
   documents.
4. Run `docs/store/manual-test.md` against the packaged build (the `extension/`
   directory produced by `npm run package`), not a development build.
5. Confirm `npm run verify:manifest` passes and that every `permissions`,
   `host_permissions`, `optional_permissions`, and `optional_host_permissions`
   entry in `scripts/expected-manifest.config.mjs` has exactly one matching
   justification in `docs/store/store-listing.md` — no extras on either side.
6. Prepare the assets listed in that file's "Screenshot checklist".

The store upload itself stays manual and happens after the GitHub Release
succeeds.
