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

Before tagging — as part of step 1 — confirm all of the following.

1. The three documents under `docs/store/`
   ([privacy-policy.md](./store/privacy-policy.md),
   [store-listing.md](./store/store-listing.md), and
   [manual-test.md](./store/manual-test.md)) describe this product, with every
   placeholder and template comment replaced.
2. If the extension handles user data — including data it only persists locally
   — the privacy policy is published at a stable public URL, that URL is set in
   the developer dashboard's privacy fields, and the page served there matches
   [privacy-policy.md](./store/privacy-policy.md) at this version. A completed
   Markdown file in the repository does not satisfy the requirement on its own:
   the reviewer reads the hosted page, so decide the hosting location before the
   first submission and re-publish it whenever the policy changes.
3. [manual-test.md](./store/manual-test.md) has been run against the packaged
   build: load the `extension/` directory produced by `npm run package`, not a
   development build.
4. `npm run verify:manifest` passes, and every `permissions`,
   `host_permissions`, and `optional_permissions` entry in
   `scripts/expected-manifest.config.mjs` has exactly one matching
   justification in the "Permission justifications" section of
   [store-listing.md](./store/store-listing.md) — no unjustified permission,
   and no justification for a permission that is not declared.
5. The assets named in the "Screenshot checklist" section of
   [store-listing.md](./store/store-listing.md) are prepared from this
   version's build.

After the GitHub Release succeeds, upload the verified `extension.zip` manually
in the Chrome Web Store developer dashboard. Publishing is a manual step by
design; the release workflow never uploads to the store.
