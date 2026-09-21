---
name: adapt-template
description: Turn this template into a product Chrome extension by selecting and pruning surfaces, replacing samples, setting product identity and manifest expectations, auditing inherited documentation, and proving the result with the full verification suite. Use whenever deriving a real extension from this repository, including requests to remove popup/options/background/content surfaces or rename and productize the template.
---

# Adapt the template

Treat adaptation as a subtraction-first migration. A derived product should retain
only the surfaces and shared layers it uses; leaving a working sample in place makes
tests pass for behavior the product does not ship.

## 1. Record the product contract

Before deleting files, record these decisions in the task or implementation plan:

- npm `name`, Chrome `displayName`, one-sentence description, author, and repository
  URL
- initial version (use `0.1.0` unless the product already has a version policy)
- retained surfaces: popup, options, background service worker, content script
- whether a toolbar `action` is needed without a popup
- production URL matches and the minimum Chrome permissions
- every persistence mechanism and stored value, not just `chrome.storage`
- intended distribution (local/enterprise, GitHub Release, or Chrome Web Store)

Read `.claude/rules/typescript-react.md` before editing TypeScript or TSX,
`.claude/rules/chrome-extension.md` before changing the manifest/background/content
script, and `.claude/rules/testing.md` before replacing tests.

Run `npm ci` before adaptation. If Playwright's Chromium is not installed, run
`npx playwright install chromium` now; the same browser is required by the baseline
E2E suite and later by `npm run render:icons`. Then run `npm run verify:full`. A
failing baseline must be understood first; otherwise pruning can hide an existing
defect.

## 2. Select, prune, and re-contract surfaces

Delete a surface as one unit. Its source, HTML wiring, manifest declaration,
manifest expectation, E2E coverage, development links, screenshots, and prose must
agree; deleting only the entrypoint leaves either a broken build or a false contract.

| Surface    | Keep or replace                                                              | Remove when unused                                                                            | Manifest and expectation                                                                                                                                                                                                                                            |
| ---------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| popup      | `popup.html`, `src/entrypoints/popup/popup.tsx`                              | both files; popup link in `index.html`; `docs/images/popup.png` when no longer documented     | Remove `action.default_popup`. If no toolbar action remains, remove `action` and set `surfaces.action` to `{ present: false, default_popup: false }`. If an action remains without a popup, keep `action: {}` and expect `{ present: true, default_popup: false }`. |
| options    | `options.html`, `src/entrypoints/options/options.tsx`                        | both files; options link in `index.html`; `docs/images/options.png` when no longer documented | Remove `options_ui` and set `surfaces.options_ui` to `false`.                                                                                                                                                                                                       |
| background | `src/entrypoints/background/background.ts`                                   | the entrypoint and product E2E assertions for its service worker                              | Remove `background` and set `surfaces.background` to `false`.                                                                                                                                                                                                       |
| content    | Replace `src/entrypoints/content/sample.tsx` with a product-named entrypoint | the sample entrypoint and content-specific E2E routes/assertions                              | Replace or remove `content_scripts`; mirror its entries in expected `content_scripts` and the CRXJS-generated `web_accessible_resources`.                                                                                                                           |

Use the following complete pruning sets for the three common product shapes. In all
three, delete `src/examples/` and replace `e2e/extension.spec.ts` with product
behavior; do not keep the template's cross-configuration sample tests as product
coverage.

| Product shape        | Delete                                                                                                                                                              | Expected surfaces/content                                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| content only         | `popup.html`, `options.html`, popup/options/background entrypoints, their `index.html` links and obsolete screenshots                                               | action/options/background false; keep only the product content entry and matching web-accessible-resource expectation                                                                                             |
| content + background | `popup.html`, `options.html`, popup/options entrypoints, their `index.html` links and obsolete screenshots                                                          | action/options false, background true; keep product content and background expectations                                                                                                                           |
| popup + options      | background/content entrypoints and content-only documentation; remove the popup sample `sendMessage('greet', ...)`, its response state/UI, and the `greet` contract | action present with popup, options true, background false; set expected `content_scripts` and `web_accessible_resources` to `[]`; delete messaging unless another pair of retained contexts actually communicates |

After removing the popup/options links, keep `index.html` only if it remains a useful
development landing page; otherwise remove it and confirm the build has no dependency
on it.

### Prune shared sample layers by usage

Do not infer shared-layer usage from the chosen surface names. Search imports and API
use after the product entrypoints are in place. A surviving import identifies stale
sample code to replace or delete; it does not by itself justify keeping a shared
layer:

- Keep `src/lib/messaging/` only when two retained extension contexts communicate.
  Replace the `greet` contract and every `greet` test fixture with product messages
  or neutral engine-level fixtures. If messaging is unused, delete the whole layer
  and remove messaging prose from `src/lib/README.md` and `AGENTS.md`.
- Keep `src/lib/storage/` only when the product persists settings or state. Replace
  `exampleSetting` and its tests with the product schema. If storage is unused, delete
  the layer and remove the `storage` permission and documentation.
- Keep `src/lib/testing/chromeFake.ts` when retained unit tests need its runtime or
  storage fake. Delete it and its test only after all imports and Chrome-dependent
  unit tests are gone.

For popup + options specifically, remove the sample greeting button and every
`sendMessage('greet', ...)` call before deciding whether messaging is retained. Page
load alone is not coverage: the replacement E2E must exercise the retained product
behavior and must not leave the removed greeting behavior reachable.

### Synchronize the manifest contract before verification

Treat `manifest.config.ts` and `scripts/expected-manifest.config.mjs` as one atomic
change. Never run `npm run verify` after changing a surface, permission, match, or
entrypoint in one file but before updating the other. Do not weaken
`scripts/verify-manifest-engine.mjs` to accommodate a product.

- Make `permissions`, `host_permissions`, `optional_permissions`, and
  `optional_host_permissions` exact sets matching the source manifest.
- Set all three surface expectations explicitly. For action, set both `present` and
  `default_popup`.
- For every retained content script, copy its production `matches` and effective
  `run_at` into expected `content_scripts`.
- CRXJS emits hashed content chunks through `web_accessible_resources`. Keep one
  matching expectation per emitted entry using the complete schema below. Preserve
  `allowedPatterns` as an array of `RegExp` values because generated chunk filenames
  change between builds; do not replace it with a hard-coded filename or string.

  ```js
  {
    matches: CONTENT_SCRIPT_MATCHES,
    extension_ids: [],
    use_dynamic_url: false,
    resources: {
      required: [],
      allowedPatterns: [CONCRETE_JS_ASSET],
    },
  }
  ```

  Define `CONTENT_SCRIPT_MATCHES` from the product URLs and keep a concrete regex such
  as `const CONCRETE_JS_ASSET = /^assets\/[^*?[\]{}]+\.js$/u`. When no content
  script remains, use `content_scripts: []` and `web_accessible_resources: []`.

- Keep the fixed CSP and `externally_connectable` prohibition. Product adaptation is
  not permission to relax those invariants.

Run `npm run build`, inspect `extension/manifest.json`, and then run
`npm run verify`. The built file is authoritative for generated entries; the
expectation file is authoritative for what the product intentionally allows. Fix the
selected product shape; do not restore sample code merely to make a check pass.

## 3. Set product identity

Update all of the following in `package.json`:

- `name`, `displayName`, `version`, `description`, `keywords`, `author`
- `repository.url`, `bugs.url`, and `homepage`

Start a new product at `0.1.0`. Synchronize the root `name` and `version` in
`package-lock.json`; `npm install --package-lock-only --ignore-scripts` is preferred
after editing package metadata. `manifest.config.ts` derives the Chrome name from
`displayName` and the manifest version from the package version.

Then update these as one change set, synchronizing every manifest-affecting edit with
the expectation contract from the previous section before verification:

- `manifest.config.ts` description, least-privilege permissions, production matches,
  and product entrypoint paths
- `assets/branding/icon.svg` and `icon-dev.svg`, followed by `npm run render:icons`
- README title, badges, clone commands, features, screenshots, development examples,
  repository links, and product-specific usage

Add a short README provenance statement linking to
`https://github.com/50ra4/crx-vite-ts-react-template`. Preserve applicable license
notices; provenance does not justify leaving template behavior or stale product names.

Run `npm run verify` after identity, manifest, and expectation edits. Treat any
`verify:manifest` warning as incomplete adaptation even when the command exits zero.

## 4. Replace E2E coverage

Keep `e2e/fixtures.ts`, `e2e/manifest.ts`, and `e2e/manifest.test.ts`; they are
surface-independent infrastructure. Replace `e2e/extension.spec.ts` with smoke tests
against the actual selected build:

- content only: visit an intercepted production URL, assert product injection, and
  assert that no extension service worker exists
- content + background: assert product injection and the extension service worker
- popup + options: load both extension pages, exercise their retained product
  behavior, assert its result, and assert no extension service worker

Remove manifest patches that merely simulate configurations the product no longer
ships. A product test should fail when its real `manifest.config.ts` is wrong.

Run `npm run verify:full`. If the browser was removed after the baseline, reinstall it
with `npx playwright install chromium`.

## 5. Audit inherited documentation

Classify every inherited document as **keep**, **rewrite for the product**, or
**delete**. Do not leave a template claim because it is harmless-looking.

### Update the agent contract

<!-- AGENTS-CONTRACT:UNIVERSAL:PRESERVE -->

<!-- AGENTS-CONTRACT:DERIVATION:SYNCHRONIZE -->

- `AGENTS.md` has two machine-delimited contracts. The universal section from
  `<!-- AGENTS:UNIVERSAL:BEGIN -->` through `<!-- AGENTS:UNIVERSAL:END -->` must be
  preserved; do not rewrite it merely because product configuration changed. The
  derivation-required section from `<!-- AGENTS:DERIVATION-REQUIRED:BEGIN -->`
  through `<!-- AGENTS:DERIVATION-REQUIRED:END -->` must be updated, rewritten, or
  pruned to match the product while retaining both boundary markers. Audit its
  product name, surfaces, commands, shared layers, repository conventions, recipes,
  verification table, and on-demand skill references.
- A deliberate repository-independent change to the universal contract also requires
  updating its canonical SHA-256 in `scripts/agent-doc-contract.mjs`. The validator
  reports the expected and actual hashes; the value is SHA-256 of the trimmed text
  between the universal markers. Product configuration alone is not a reason to
  change either value.
- Within the derivation-required section, describe only the surfaces and shared
  layers retained by the product. Remove recipes and forbidden-change notes for
  deleted infrastructure. Keep each command and verification mapping only when it
  exists in `package.json` and still proves the stated change type.
- Update the JSON between `<!-- AGENTS:DERIVATION-METADATA:BEGIN -->` and
  `<!-- AGENTS:DERIVATION-METADATA:END -->`. Set `entrypointRoot` and `sharedRoot`
  to the product's actual repository paths, then make `surfaces` and `sharedLayers`
  equal their immediate child-directory names. Use `null` for `sharedRoot` only when
  the product has no shared-module directory, and keep `sharedLayers` empty with it.
  These are the only metadata keys. The validator rejects a configured root that
  does not exist, so a layout rename cannot silently reduce the contract to empty
  arrays.
- Check every path named in the derivation-required section. A path to a deleted
  entrypoint, shared layer, test helper, rule, or skill is a failed adaptation even
  when all code checks pass.
- Inline code spans without whitespace are treated as repository paths when they
  look path-like. Spans containing whitespace are command candidates instead, which
  avoids treating `node scripts/example.mjs` as one path; npm script names are also
  checked against `package.json`.
- Repository collection excludes `.git` and `node_modules` directories at every
  depth. Other generated and local-only paths such as root-level `dist`, `extension`,
  cache directories, `.env`, logs, and package archives are excluded only at the
  repository root so a real source directory such as `src/lib/logs/` remains visible.
  When `.gitignore` gains another root-level generated-output family that could mask
  a stale documentation path, update the ignore sets in
  `scripts/agent-doc-contract.mjs` and its test in the same change.
- Rebuild the on-demand context table from the files that remain. Every row must
  point to an existing, applicable rule or skill. Review every retained file under
  `.claude/skills/`; update or delete a skill that is no longer reachable from the
  table or automatic discovery and no longer describes supported product work.
- Keep `adapt-template` and its derivation-section reference while adaptation is in
  progress. After the product contract is complete and verified, the final cleanup
  may delete this skill and remove every reference to it. The contract test reads the
  skill optionally: when it remains, its anchors and derivation reference are
  required; when it is deleted, skill-specific checks are skipped while all AGENTS,
  path, metadata, command, and CLAUDE checks continue to run.
- Keep `CLAUDE.md` as the single `@AGENTS.md` import. It may explain discovery, but
  must not copy product facts that belong in the derivation-required section.
- Run `npm test -- --run scripts/agent-doc-contract.test.mjs` after editing these
  files. It verifies the canonical universal content, marker structure, derivation
  metadata, literal repository paths, npm scripts, the single `@AGENTS.md` import, and
  this skill's machine-readable contract anchors.

### Audit the remaining inherited documents

- `.claude/rules/*.md`: update examples and paths to deleted entrypoints or sample
  files
- `README.md` and `docs/README.ja.md`: identity, capabilities, screenshots, quick
  start, development paths, permissions, and release instructions
- `docs/adr/`: retain decisions the product still adopts, rewrite product-specific
  context and links, and supersede or remove decisions the product rejects
- `SECURITY.md`: supported versions, reporting channel, repository links, maintainer,
  and response expectations
- `docs/releasing.md`, `docs/releasing.ja.md`, and
  `.claude/skills/release/SKILL.md`: actual release and distribution policy
- `docs/store/privacy-policy.md`, `store-listing.md`, and `manual-test.md`: replace
  every placeholder and HTML comment before a Store release; reconcile permissions
  with the built manifest and stored data with the implementation
- `.github/` workflows and templates: update product names and assumptions when the
  release or contribution workflow differs

Search the tracked tree for the old package/display name, repository URL,
`exampleSetting`, `greet`, `content_script sample`, `src/examples`,
`src/entrypoints/content/sample`, `https://example.com`, placeholder markers, and
paths to deleted files. Review every match; keep only intentional provenance or
reusable-template references. This is a one-time adaptation gate: do not preserve
template terms in product E2E assertions merely to prove that their old behavior is
absent.

## 6. Completion gate

Adaptation is complete only when all of these are true:

1. `git status --short` contains only intentional product changes.
2. `npm run verify` passes after pruning and again after identity/manifest updates.
3. `npm run verify:full` passes against the final selected surfaces.
4. The built manifest contains only intended surfaces, permissions, URL matches, and
   generated resources.
5. `npm test -- --run scripts/agent-doc-contract.test.mjs` passes; its canonical
   universal-content check and derivation metadata plus literal path/command checks
   match the final tree.
6. No sample behavior, stale path, orphaned skill reference, placeholder, or
   unsupported documentation claim remains.
7. The final report lists retained surfaces, deleted layers, effective permissions,
   persistence, verification commands, and any deliberately deferred Store work.
