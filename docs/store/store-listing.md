# Chrome Web Store Listing

<!--
TEMPLATE. Replace every placeholder and delete every HTML comment in this file
before submission.

This is the single home for the listing text: the single-purpose statement, the
permission justifications pasted into the developer dashboard, the English and
Japanese store descriptions, and the screenshot checklist. Store text is plain
text — the dashboard renders Markdown syntax literally, so keep the description
bodies free of `#`, `*`, and backticks.
-->

## Single purpose

<!--
One or two sentences. The Chrome Web Store requires a single, narrow purpose:
name the one job the extension does, when it does it (say so explicitly if it
acts only after an explicit user action), and on what pages. Everything else in
this file and in ./privacy-policy.md has to stay consistent with this
statement.
-->

## Permission justifications

<!--
Mirror the **built** `extension/manifest.json` one-to-one — the file
`npm run package` produces, which is what gets uploaded and reviewed. Do not
mirror `manifest.config.ts`: the build adds entries the source file never
declares. In the default template, `manifest.config.ts` declares no
`web_accessible_resources` at all, yet CRXJS emits one entry exposing the
content-script chunks; writing this section from the source manifest therefore
omits a real grant.

Every entry in `content_scripts[].matches`, `permissions`, `host_permissions`,
`optional_permissions`, `optional_host_permissions`, and
`web_accessible_resources` gets exactly one subsection below, and no subsection
may describe an entry that is not declared. Optional permissions need a
justification even though the user is prompted at grant time — the reviewer sees
them in the manifest either way.
`scripts/expected-manifest.config.mjs` pins those same lists, so
`npm run verify:manifest` is what proves the built manifest has not drifted;
keeping this section aligned with it is a manual step in the release
checklist (see ../releasing.md).

If the extension declares no Chrome API permissions at all, do not delete this
section — state that explicitly ("None. The extension declares no
`permissions`, `host_permissions`, `optional_permissions`, or
`optional_host_permissions` values."), because an empty section reads as an
oversight to a reviewer.

Where a justification would repeat the stored-data list in
./privacy-policy.md, that file is the source of truth: summarize in a clause
here and link to it instead of maintaining two copies that can disagree.
-->

### Site access: <!-- match pattern -->

<!--
Duplicate this heading once per `content_scripts[].matches` entry, using the
match pattern verbatim as the heading text.

Cover: what the script has to read or modify on those pages to do its job; why
a narrower pattern cannot express it (for example arbitrary owner, repository,
ref, or id path segments); and what the script does on non-matching routes —
ideally exit before observing anything. State whether the pattern is a
content-script match only or also a `host_permissions` grant, since reviewers
treat those differently.
-->

### Web-accessible resources: <!-- what this entry exposes -->

<!--
Duplicate this heading once per `web_accessible_resources` **entry** in the built
manifest — not once per file inside `resources`. Those file names are
build-generated and content-hashed (`assets/sample.tsx-Cwyi8D8p.js`), so they
change on every build; a justification pinned to them is stale immediately.
Describe the entry instead: the `matches` (or `extension_ids`) it is exposed to,
what kind of resources it covers, why the page has to reach them, and what may
and may not cross that boundary.

The default build has one such entry even though `manifest.config.ts` declares
none — CRXJS emits it for the content script's loader chunks. Delete this
heading only when the built manifest has no `web_accessible_resources` at all,
which for a build with any content script it normally will not.
-->

### <!-- permission name -->

<!--
Duplicate this heading once per `permissions`, `host_permissions`,
`optional_permissions`, and `optional_host_permissions` entry, using the exact
manifest string as the heading text.

Two or three sentences each: the user-visible capability that requires it, the
narrowest scope it is actually used at, and what it is not used for. Justify a
permission by the feature that fails without it, never by convenience or by
future plans. For an optional entry, also name the user action that triggers the
grant prompt and what the extension does when the grant is declined.
-->

## Permissions deliberately not requested

<!--
Optional, but it is the cheapest trust the listing can buy: an explicit list of
the broad permissions a reviewer might expect and this extension does not take.

List only permissions that are plausible for this product to want — naming
permissions nobody would expect adds noise instead of trust. Every bullet must
be verified absent from the built `extension/manifest.json` before publishing —
the shipped manifest, not `manifest.config.ts`, since the build adds entries the
source file does not declare. A permission listed here that the shipped manifest
actually declares is a false statement to a reviewer.

Reference example (do not paste verbatim — keep only what applies to this
product): a content-script extension that requests no host permissions might
list `tabs`, `activeTab`, `scripting`, `identity`, `webRequest`,
`host_permissions`, `optional_permissions`, and `<all_urls>`. The pattern comes
from pr-review-focus-pins.
-->

- <!-- permission this product deliberately does not request -->
- <!-- permission this product deliberately does not request -->

<!--
Close with anything else the manifest deliberately omits, such as
`externally_connectable` — `npm run verify:manifest` rejects that key outright
in this template.
-->

## English store description

### Name

<!--
The name shown on the store page. Normally identical to `displayName` in
`package.json`; if it differs, say why here so the two do not drift apart
unnoticed.
-->

### Short description

<!--
One sentence of plain text. This is the summary shown in search results; the
dashboard caps it at 132 characters. Lead with what the user gets, not with the
technology used to deliver it.
-->

### Detailed description

<!--
A few short paragraphs of plain text. Cover what the extension does and where,
the concrete outputs or checks a user can expect, and a closing paragraph on
data handling that agrees with ./privacy-policy.md. Claims here are read as
promises during review — do not describe behavior the submitted build does not
have.
-->

## Japanese store description

<!--
Translation of the English text above, entered as an additional locale in the
dashboard. Keep the claims identical: a translation that promises more than the
English version is a compliance problem, not a copywriting choice.
-->

### 名称

<!--
Japanese locale name. Keep it identical to the English name unless this locale
genuinely needs a different one — a product name that changes per locale splits
search results and support requests.
-->

### 短い説明

<!-- Japanese short description, plain text, same limit as the English one. -->

### 詳細説明

<!-- Japanese detailed description, mirroring the English paragraphs. -->

## Screenshot checklist

<!--
List each asset with the path it is committed to and what has to be visible in
it, then confirm the properties every screenshot needs. Replace the example
bullets with the real surfaces.
-->

- `docs/images/<!-- surface -->.png`: <!-- what must be visible -->
- `docs/images/<!-- surface -->.png`: <!-- what must be visible -->

- [ ] Captured from the packaged build of the version being submitted
- [ ] The store icon matches the production icons this build ships — the ones
      `npm run render:icons` writes from the SVG sources, not the development
      variants
- [ ] Sized to the Chrome Web Store's currently required dimensions — check the
      dashboard rather than reusing an old asset, since the requirement changes
- [ ] Free of production, personal, and customer data in every frame
