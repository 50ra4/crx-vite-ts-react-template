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
   access-granting entry in the built `extension/manifest.json` has exactly one
   matching justification in the "Permission justifications" section of
   [store-listing.md](./store/store-listing.md) — no unjustified entry, and no
   justification for something that is not declared. That covers all six lists
   the verifier checks: `permissions`, `host_permissions`,
   `optional_permissions`, `optional_host_permissions`,
   `content_scripts[].matches`, and `web_accessible_resources` (each entry's
   `matches` and what it exposes). Read the manifest produced by the same
   `npm run package` run as item 3, never an older build — `verify:manifest`
   itself reads that file, and `scripts/expected-manifest.config.mjs` is what
   pins it. Warnings do not fail the command but do block a release: the
   `displayName` warning, for instance, means the store name is still the
   template's.
5. Every bullet in the "Permissions deliberately not requested" section of
   [store-listing.md](./store/store-listing.md) is absent from that same built
   manifest. Checking `manifest.config.ts` instead is not equivalent — the build
   adds entries the source file never declares (see 3a-4) — and a permission
   listed as not requested while the shipped manifest declares it is a false
   statement to a reviewer.
6. The assets named in the "Screenshot checklist" section of
   [store-listing.md](./store/store-listing.md) are prepared from this
   version's build.

### 3b. In the dashboard, before submitting for review

Publishing stays manual by design; the release workflow never uploads to the
store. Work through this gate in order — each step unlocks or feeds the next —
and submit for review only at the end.

1. Upload the package that will be reviewed: the `extension.zip` attached to the
   GitHub Release created in step 2. That artifact — not a local build — is the
   only one CI has verified.

   A brand-new item is the exception, and only partly: the item does not exist
   until something is uploaded, so a locally built draft may go up before
   tagging purely to create the item and open the forms. It is scaffolding, not
   a submission, and it must carry a **placeholder version below the release
   version** so the two are distinguishable in the dashboard:

   ```sh
   npm version 0.0.1 --no-git-tag-version
   npm run package
   git checkout -- package.json package-lock.json
   ```

   Never build the scaffold at the version you are about to release. The
   dashboard exposes the package version and little else, so a scaffold sharing
   the release version makes a forgotten replacement indistinguishable from a
   completed one. That build also overwrites `extension/` and `extension.zip`
   with placeholder-version artifacts, so re-run `npm run package` after
   restoring the version files — 3a-3 through 3a-5 must not be evaluated
   against the scaffold build.

   Once the tag's Release succeeds, upload the Release's `extension.zip` over
   the scaffold and watch the displayed version change from `0.0.1` to the
   release version — that transition is the only in-dashboard evidence that the
   replacement happened. Then **redo steps 2–4 against the replaced build**: the
   form values entered against the scaffold survive the upload and are
   re-validated by nothing.
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
5. Confirm the package now sitting in the draft is the Release artifact, not a
   leftover scaffold:
   - The version and version name shown in the dashboard equal the tag.
   - If a scaffold was used, you **observed** the version change from the
     placeholder to the release version during step 1. Finding the release
     version there is not the same evidence: a scaffold built after the version
     bump would show it too.
   - The file you uploaded is the Release asset itself — downloaded from the
     Release, not rebuilt locally and not re-picked from an old path.

   `shasum -a 256` on the downloaded Release asset and on a local
   `npm run package` output proves the Release artifact is the reproducible,
   CI-verified build — it says nothing about which file the dashboard holds,
   because the uploaded package cannot be read back out. The observed version
   transition and your own upload of that exact file are what connect the two,
   which is why the scaffold must never carry the release version.
6. Only then submit for review.
