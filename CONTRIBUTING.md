# Contributing

Thanks for your interest in contributing to this project. This document covers
setup, verification commands, and the branch/PR flow. For architecture,
directory layout, and dependency-direction rules, see the README's
"Architecture" section. For AI-agent-specific conventions, see
`AGENTS.md` and `.claude/rules/`.

## Getting started

Requires Node.js `>=24.0.0` (see `.nvmrc`).

```sh
npm ci
npm run dev
```

`npm ci` also installs the `husky` pre-commit hook (via the `prepare` script),
which runs `oxlint --fix` and `prettier --write` on staged files automatically.

## Before you push

Run the same checks CI runs, in the same order:

```sh
npm run check-type
npm run lint
npm run test
npm run build && npm run verify:manifest
```

- `npm run lint` is check-only; use `npm run format` to auto-fix formatting.
- Code style (formatting, quote style, etc.) is enforced by Oxlint/Prettier —
  run them, don't hand-format.
- E2E tests (`npm run e2e`) require a prior build and Chromium installed once
  via `npx playwright install chromium`. Run `npm run build && npm run e2e`
  before submitting changes that affect runtime behavior.

## Branching and commits

- Branch from `main`.
- Use [Conventional Commits](https://www.conventionalcommits.org/) types:
  `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.
- Commit messages should explain *why*, not just *what*.

## Pull requests

- Open PRs against `main`. The PR template is applied automatically — fill in
  the summary, verification steps, and breaking-change checkbox.
- All CI jobs (type-check, lint, test, build, e2e) must pass before merge.
- By submitting a PR, you agree your contribution is licensed under this
  project's [MIT License](./LICENSE).

## Reporting bugs and requesting features

Use the issue templates (bug report / feature request) when opening a new
issue. Do **not** file a public issue for security vulnerabilities — see
[SECURITY.md](./SECURITY.md).
