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
Follow "Chrome Web Store publishing checklist" in `docs/releasing.md`. It is two
gates, because the dashboard's privacy and listing forms do not exist until a
first package upload creates the item; an upload only creates or updates a
draft, so a first submission may upload one before tagging just to open them.

Before tagging (all verifiable locally):

1. Fill the three templates in `docs/store/` (`privacy-policy.md`,
   `store-listing.md`, `manual-test.md`) with product-specific content, leaving
   no placeholder or template comment behind. Check the two facts that drift
   silently: the single-purpose statement matches between `privacy-policy.md`
   and `store-listing.md`, and the "Data stored" list (with any limits it
   quotes) matches `src/lib/storage/schema.ts` plus any other persistence in
   use — the manifest cannot tell you this.
2. If the extension handles user data (local persistence included), publish the
   privacy policy at a stable public URL and confirm the hosted page matches
   `docs/store/privacy-policy.md` at this version — the repository file alone
   does not satisfy the requirement. Bump the effective date and re-publish on
   every revision.
3. Run `docs/store/manual-test.md` against the packaged build (the `extension/`
   directory produced by `npm run package`), not a development build.
4. Confirm `npm run verify:manifest` passes with no warnings, and that every
   access-granting entry in the built `extension/manifest.json` — the one from
   the same `npm run package` run as item 3 — has exactly one matching
   justification in `docs/store/store-listing.md`, no extras on either side. All
   six verified lists count: `permissions`, `host_permissions`,
   `optional_permissions`, `optional_host_permissions`,
   `content_scripts[].matches`, and `web_accessible_resources`. Justify against
   the built manifest, never `manifest.config.ts`: the build adds entries the
   source declares nowhere (by default CRXJS emits a `web_accessible_resources`
   entry for the content-script chunks). `scripts/expected-manifest.config.mjs`
   pins the built file; warnings do not fail the command but do block a release
   (a `displayName` warning means the store name is still the template's).
5. Confirm every bullet under "Permissions deliberately not requested" in
   `store-listing.md` is genuinely absent from that built manifest.
6. Prepare the assets listed in that file's "Screenshot checklist".

In the dashboard, before submitting for review — the upload stays manual:

1. Upload the reviewed package: the `extension.zip` attached to the GitHub
   Release, the only artifact CI verified. A brand-new item may take a local
   draft build before tagging, purely to create the item and open the forms;
   that scaffold must be overwritten with the Release's `extension.zip` once the
   tag ships, and steps 2-4 redone against the replaced build (form values
   entered against the scaffold survive and are re-validated by nothing).
2. Set the privacy policy URL to the page published above.
3. Walk the **Privacy practices** form top to bottom: single-purpose
   description, permission and remote-code justifications, collected data types
   with usage and sharing, and the certification checkboxes — each matching the
   uploaded build and the three `docs/store/` documents. The policy URL fills
   none of these fields.
4. Confirm the listing fields (name, short and detailed descriptions, every
   locale, screenshots) match `store-listing.md`.
5. Confirm the package in the draft is the Release artifact — dashboard version
   equals the tag, and `shasum -a 256` of the uploaded zip matches the Release
   asset (the build is reproducible) — then submit for review.
