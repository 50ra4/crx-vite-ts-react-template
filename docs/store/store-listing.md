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
Mirror `manifest.config.ts` one-to-one. Every entry in
`content_scripts[].matches`, `permissions`, `host_permissions`, and
`optional_permissions` gets exactly one subsection below, and no subsection may
describe a permission that is not declared.
`scripts/expected-manifest.config.mjs` holds the same lists, so
`npm run verify:manifest` is what proves the manifest itself has not drifted;
keeping this section aligned with that file is a manual step in the release
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
treat those differently. If `web_accessible_resources` exposes anything to the
page, justify each entry here as well, including what may and may not cross
that boundary.
-->

### <!-- permission name -->

<!--
Duplicate this heading once per `permissions`, `host_permissions`, and
`optional_permissions` entry, using the exact manifest string as the heading
text.

Two or three sentences each: the user-visible capability that requires it, the
narrowest scope it is actually used at, and what it is not used for. Justify a
permission by the feature that fails without it, never by convenience or by
future plans.
-->

## Permissions deliberately not requested

<!--
Optional, but it is the cheapest trust the listing can buy: an explicit list of
the broad permissions a reviewer might expect and this extension does not take.

Replace the example bullets below with the ones that are actually plausible for
this product — naming permissions nobody would expect adds noise instead of
trust. Every bullet must be absent from `manifest.config.ts`; check before
publishing. The example list is taken from pr-review-focus-pins, a
content-script extension that requests no host permissions.
-->

- `tabs`
- `activeTab`
- `scripting`
- `identity`
- `webRequest`
- `host_permissions`
- `optional_permissions`
- `<all_urls>`

<!--
Close with anything else the manifest deliberately omits, such as
`externally_connectable` — `npm run verify:manifest` rejects that key outright
in this template.
-->

## English store description

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
- [ ] Sized to the Chrome Web Store's currently required dimensions — check the
      dashboard rather than reusing an old asset, since the requirement changes
- [ ] Free of production, personal, and customer data in every frame
