---
paths: ['**/*.test.{mjs,ts,tsx}']
---

Vitest + jsdom (`src/**/*.test.{ts,tsx}`) or Node (`scripts/**/*.test.mjs` with
`// @vitest-environment node`).

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
- Because `installChromeFake` injects the global with `vi.stubGlobal`, call
  `vi.unstubAllGlobals()` in `afterEach`.
