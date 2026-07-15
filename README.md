# crx-vite-ts-react-template

このプロジェクトは Vite、TypeScript、React を用いた Chrome 拡張機能を開発向けの Template です。
一部、サンプルとなるソースコードを含んでいます。

## Setup

`git clone`後、プロジェクト直下で npm package の依存関係を install します。

```
npm i
```

別途、node.js（16.15.1）が必要です。

## Build

Vite を利用して、ソースコードを build します。
実行するとプロジェクト直下の extension のディレクトリに展開します。

```
npm run build
```

## Testing

Jest や@testing-library を用いて、テストを実行します。

```
npm run test
```

開発中にテストを実行する場合、Jest の watch オプションを追加することでソースファイルが変更される度にテストを実行します。

```
npm run test -- --watch
```

## Dev Server

Vite と`@crxjs/vite-plugin`の plugin を利用して、HMR を使いながら開発できます。

```
npm run dev
```

## Linting

ESLint を利用し、Lint を実行しています。

```
npm run lint:eslint
```

VSCode の拡張機能と併用することで、ファイル保存時に実行します。
また、husky と併せて利用しており、commit 時にチェックを実行しているため、エラー状態での commit を抑止します。

## Formatting

prettier を利用し、コードの整形を行なっています。

```
npm run lint:prettier
```

VSCode の拡張機能と併用することで、ファイル保存時に実行します。
また、husky と併せて利用しており、commit 時にチェックを実行し、自動で整形します。

## Document

作成した Chrome 拡張機能を公開時に利用する静的な html などを docs ディレクトリに構築します。

```
npm run docs
```

## CI/CD

github actions を用いた CI/CD を追加しています。
CI は、type error、build、test のチェックを行なっています。
CD は、前述の`npm run docs`を用いて、作成した Chrome 拡張機能を github pages に公開します。
（github pages に公開するには別途 github repository の設定が必要です）

## AI開発設定 (Claude Code / Codex)

コーディングエージェント向けの基本設定を用意しています。

- `AGENTS.md` : 共通エントリポイント(常時ロードされる正本)
- `CLAUDE.md` : Claude Code 用(`AGENTS.md` を import するのみ)
- `.claude/rules/` : 対象ファイル編集時に読み込む技術規約
- `.claude/skills/` : タスク該当時にオンデマンドで読み込む手順書

トークン消費を抑えるため、常時ロードは `AGENTS.md` のみとし、詳細は必要時に読み込む構成としています。
