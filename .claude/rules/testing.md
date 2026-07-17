---
paths: ['**/*.test.{ts,tsx}']
---

Vitest + jsdom (`vitest.config.ts`: `test: { globals: true, environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'] }`).

- Colocate tests as `*.test.ts(x)` next to the source file.
- Components: `render`/`screen` from `@testing-library/react` (see `SampleComponent.test.tsx`).
- Hooks: `renderHook`/`act` imported **from `@testing-library/react`** (bundles
  these since v13 — do not add the old separate `@testing-library/react-hooks` package;
  see `useIncrement.test.ts`).
- Pure functions: plain unit tests (see `calc.test.ts`).
- Run: `npm test`; watch mode: `npm test -- --watch`.
- Chrome API を使うテストは `src/lib/testing/chromeFake.ts` の `installChromeFake` を使う。
  runtime messaging と storage の個別モックを各テストへ重複実装しない。
- `installChromeFake` は `vi.stubGlobal` で注入するため、`afterEach` で
  `vi.unstubAllGlobals()` を呼ぶ。
