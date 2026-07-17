---
paths: ['**/*.{ts,tsx}']
---

Conventions ESLint/Prettier/tsc cannot enforce:

- Never use `any`; use `unknown` and narrow it.
- Named exports only, no default exports — except `*.config.ts` (`vite.config.ts`, `manifest.config.ts`, `vitest.config.ts`), which must keep `export default` because Vite/CRXJS/Vitest require it to load the config.
- Components are arrow functions; the top-level component in an entry file is named `Root`.
- Entry mount boilerplate (see `src/entrypoints/popup/popup.tsx`):

  ```tsx
  // oxlint-disable-next-line typescript/no-non-null-assertion
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
  ```

- Custom hooks return `[state, action] as const` (see `src/examples/hooks/useIncrement.ts`).
- Pure utilities have explicit return types (see `src/examples/utils/calc.ts`: `(a: number, b: number): number`).
- Name unused callback params `_` (e.g. an unused `sender` / event argument).
