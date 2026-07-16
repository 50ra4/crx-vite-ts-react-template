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
- `chrome.*` APIs are not mocked in this setup — code touching them (e.g.
  `background.ts`, `popup.tsx`) currently has no tests. If you add some,
  mock `globalThis.chrome` manually.
