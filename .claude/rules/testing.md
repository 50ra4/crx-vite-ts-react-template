---
paths: ['**/*.test.{mjs,ts,tsx}', 'e2e/**/*.ts']
---

Vitest + jsdom (`src/**/*.test.{ts,tsx}`), Vitest + Node
(`scripts/**/*.test.mjs` and `e2e/**/*.test.ts`, each with
`// @vitest-environment node`), or Playwright (`e2e/**/*.spec.ts`).

- Colocate tests as `*.test.ts(x)` next to the source file.
- Components: `render`/`screen` from `@testing-library/react` (see `SampleComponent.test.tsx`).
- Hooks: `renderHook`/`act` imported **from `@testing-library/react`** (bundles
  these since v13 — do not add the old separate `@testing-library/react-hooks` package;
  see `useIncrement.test.ts`).
- Pure functions: plain unit tests (see `calc.test.ts`).
- Node release scripts: colocate `*.test.mjs` under `scripts/` and select the
  Node environment with the file pragma above.
- Run: `npm test`; watch mode: `npm test -- --watch`.
- Tests that use Chrome APIs must call `installChromeFake` from
  `src/lib/testing/chromeFake.ts`. Do not duplicate runtime messaging or storage
  mocks in individual test files.
- When changing `chromeFake` fixture validation or injection error precedence,
  keep regression tests for previously supported fixture modes and failure paths.
  In particular, preserve `executeScriptError`-only behavior while checking tab
  existence whenever `activeTab` or `tabs` is supplied.
- Error-only fixtures let tests reproduce injection failures for arbitrary
  integer tab IDs without registering tabs; explicit tab fixtures still check
  existence first. Preserve this distinction when revising validation.
- Before revising a reviewed fake contract, inspect resolved threads as well as
  open ones to avoid reintroducing previously fixed regressions. Verify disputed browser
  behavior against Chromium; keep shared cases in unit and browser tests instead
  of treating a review assertion as the specification. Injection result fixtures
  describe the serialized API response, not the injected function's raw return.
- Do not apply serialized-result validation recursively to injection arguments.
  Test nullish optional properties and top-level versus nested argument values
  against Chromium using the same case constructors as the fake tests.
- Browser contract tests identify controlled tabs by the ID returned at creation,
  not by URL (duplicate URLs are valid). Feed both suites the same canonical URLs;
  test handwritten fixture normalization separately. Include omitted, empty,
  scalar, and multiple-value query conditions, not only single-pattern matches.
- Because `installChromeFake` injects the global with `vi.stubGlobal`, call
  `vi.unstubAllGlobals()` in `afterEach`.
- E2E tests run against the built extension with `npm run e2e`; use
  `npm run verify:full` to build first and run the complete verification chain.
- Configure E2E surface variants from the spec with
  `test.use({ extensionOptions: { manifest: { remove, set }, contextOptions } })`.
  Do not edit `e2e/fixtures.ts` for each derived product.
- `extensionOptions.manifest.remove` deletes top-level manifest fields and
  `extensionOptions.manifest.set` replaces them. Use `contextOptions` for
  Playwright settings such as `timezoneId`; use `loadTimeoutMs` to raise the
  extension readiness timeout on slower CI. The fixture rejects missing removal
  targets, remove/set conflicts, and attempts to configure its reserved `key`.
- Test content scripts at their production URL and intercept the response with
  `extensionPage.route()`. Do not rewrite manifest match patterns or create a
  local HTTP server solely for E2E. When changing `content_scripts[].matches`,
  update the production URL and host-permission values in the E2E spec so the
  intercepted URL remains covered by the manifest.
- Extension ID resolution is independent of service workers. Do not add a dummy
  background worker to make Playwright fixtures start. The fixture probes the
  extension origin before exposing the context and reports invalid manifest
  patches as extension-load failures.
- Pure E2E fixture logic lives in `e2e/*.test.ts`, selects the Node environment
  with `// @vitest-environment node`, and runs in the fast Vitest lane.
  Playwright is restricted to `e2e/*.spec.ts` so those tests are not run twice.
  Import the reusable `ManifestPatch` type from `e2e/fixtures.ts`.
- `extensionOptions` and the persistent context are test-scoped so describe-level
  `test.use()` can model multiple surface variants in one spec. Each test that
  requests the context launches Chromium; group related assertions into one test.
  If startup cost becomes material, split variants into spec files or Playwright
  projects and move their configuration to worker scope.
