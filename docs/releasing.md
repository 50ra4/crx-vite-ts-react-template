# Releasing

**English** | [日本語](./releasing.ja.md)

Releases are cut from `main`, using Node.js 24 and the locked dependencies in
`package-lock.json`.

## 1. Bump the version and verify

Specifying the next version updates `package.json` and `package-lock.json`
together.

```sh
npm version 1.1.0 --no-git-tag-version
npm ci
npm run check-type
npm run lint
npm run test
npm run package
npm run e2e
```

`npm run package` builds, verifies the manifest, and stores only the
distributable files from `extension/` in `extension.zip` at the repository
root. Development icons are excluded. The same source, Node.js version, and
lockfile always produce a byte-identical zip. `npm run zip` is a compatibility
alias.

To inspect the artifact manually, unzip `extension.zip` and load the extracted
directory in Chrome via `chrome://extensions` → **Load unpacked**.

## 2. Push main and the tag

After the version bump is reviewed and merged, tag the latest `main` with a
`v`-prefixed tag.

```sh
git switch main
git pull --ff-only
git tag -a v1.1.0 -m "v1.1.0"
git push origin v1.1.0
```

For prereleases, keep the package version and the tag in sync, e.g.
`1.1.0-rc.1` / `v1.1.0-rc.1`. If the tag and the `package.json` version do not
match, the Release workflow fails. The Chrome manifest records the numeric
core in `version` (`1.1.0`) and the full prerelease string in `version_name`.

After the tag is pushed, GitHub Actions runs the type check, lint, unit tests,
manifest verification, and the real-Chromium E2E. Only if everything passes is
a GitHub Release created, with auto-generated notes and `extension.zip`
attached.

## 3. Chrome Web Store publishing checklist

Complete this for every release submitted to the Chrome Web Store, including
**unlisted** ones: unlisted is a store distribution that is merely hidden from
search, so it goes through the same review, listing information, and privacy
declarations as a public listing. Only distribution that never touches the store
— a self-hosted `.zip`/`.crx` or an enterprise-policy install — can skip it.

The checks come in two gates because half of them cannot be performed in the
repository. A new store item does not exist — and its **Privacy practices**,
privacy, and listing forms cannot be opened — until a first package has been
uploaded. Uploading only creates or updates a draft; nothing reaches users until
you explicitly submit for review, so for a first submission upload a draft build
early, purely to unlock the dashboard forms.

### 3a. Before tagging (repository side)

Confirm all of the following as part of step 1. Every item here is verifiable
locally, without a store item.

1. The three documents under `docs/store/`
   ([privacy-policy.md](./store/privacy-policy.md),
   [store-listing.md](./store/store-listing.md), and
   [manual-test.md](./store/manual-test.md)) describe this product, with every
   placeholder and template comment replaced. Two cross-document facts go stale
   quietly, so check them here: the single-purpose statement reads the same in
   [privacy-policy.md](./store/privacy-policy.md) and
   [store-listing.md](./store/store-listing.md), and the "Data stored" list —
   including any limits it quotes — matches the implementation
   (`src/lib/storage/schema.ts` plus any other persistence the product uses),
   which the manifest cannot tell you.
2. If the extension handles user data — including data it only persists locally
   — the privacy policy is published at a stable public URL and the page served
   there matches [privacy-policy.md](./store/privacy-policy.md) at this version.
   A completed Markdown file in the repository does not satisfy the requirement
   on its own: the reviewer reads the hosted page, so decide the hosting
   location before the first submission, and on every revision update the
   effective date and re-publish. (Pointing the dashboard at this URL is
   [3b](#3b-in-the-dashboard-before-submitting-for-review) — the field only
   exists once the item does.)
3. [manual-test.md](./store/manual-test.md) has been run against the packaged
   build: load the `extension/` directory produced by `npm run package`, not a
   development build.
4. `npm run verify:manifest` passes **and prints no warnings**, and every
   access-granting entry in `scripts/expected-manifest.config.mjs` has exactly
   one matching justification in the "Permission justifications" section of
   [store-listing.md](./store/store-listing.md) — no unjustified entry, and no
   justification for something that is not declared. That covers all six lists
   the verifier checks: `permissions`, `host_permissions`,
   `optional_permissions`, `optional_host_permissions`,
   `content_scripts[].matches`, and `web_accessible_resources` (each entry's
   `resources` and the `matches` it is exposed to). Warnings do not fail the
   command but do block a release: the `displayName` warning, for instance,
   means the store name is still the template's.
5. Every bullet in the "Permissions deliberately not requested" section of
   [store-listing.md](./store/store-listing.md) is absent from
   `manifest.config.ts`. A permission listed there that the manifest actually
   declares is a false statement to a reviewer.
6. The assets named in the "Screenshot checklist" section of
   [store-listing.md](./store/store-listing.md) are prepared from this
   version's build.

### 3b. In the dashboard, before submitting for review

Publishing stays manual by design; the release workflow never uploads to the
store. Work through this gate in order — each step unlocks or feeds the next —
and submit for review only at the end.

1. Upload the package. For a version release this is the verified
   `extension.zip` from the GitHub Release created in step 2. For a brand-new
   item, the upload is what creates the item, so it necessarily precedes the
   rest of this gate and may happen before tagging.
2. Set the privacy policy URL to the page published in 3a-2, and open the URL as
   saved to confirm it resolves to that page.
3. Walk the **Privacy practices** form top to bottom: the single-purpose
   description, the justification of each permission and of remote code, the
   data types collected, their usage and sharing, and the certification
   checkboxes. Setting the policy URL fills none of these fields, and
   [privacy-policy.md](./store/privacy-policy.md) requires its own text to agree
   with them. Each answer must match the uploaded build and the three
   `docs/store/` documents.
4. The listing fields — name, short description, detailed description, every
   locale, and the uploaded screenshots — match
   [store-listing.md](./store/store-listing.md).
5. Only then submit for review.
