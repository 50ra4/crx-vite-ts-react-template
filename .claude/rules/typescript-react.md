---
paths: ['**/*.{ts,tsx}']
---

Conventions ESLint/Prettier/tsc cannot enforce:

- Never use `any`; use `unknown` and narrow it.
- Named exports only, no default exports — except `*.config.ts` (`vite.config.ts`, `manifest.config.ts`, `jest.config.ts`), which must keep `export default` because Vite/CRXJS/ts-jest require it to load the config.
- Components are arrow functions; the top-level component in an entry file is named `Root`.
- Entry mount boilerplate (see `src/popup.tsx`):

  ```tsx
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
  ```

- Custom hooks in `src/hooks/` return `[state, action] as const` (see `useIncrement.ts`).
- Pure utilities in `src/utils/` have explicit return types (see `calc.ts`: `(a: number, b: number): number`).
- Name unused callback params `_` (see `background.ts`'s `onMessage` listener).
