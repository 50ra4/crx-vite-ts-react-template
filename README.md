# crx-vite-ts-react-template

このプロジェクトは Vite、TypeScript、React を用いた Chrome 拡張機能を開発向けの Template です。
一部、サンプルとなるソースコードを含んでいます。

## Setup

`git clone`後、プロジェクト直下で npm package の依存関係を install します。

```
npm i
```

別途、node.js（>=24.0.0）が必要です。

## Build

Vite を利用して、ソースコードを build します。
実行するとプロジェクト直下の extension のディレクトリに展開します。

```
npm run build
```

## Testing

Vitest や@testing-library を用いて、テストを実行します。

```
npm run test
```

開発中にテストを実行する場合、Vitest の watch オプションを追加することでソースファイルが変更される度にテストを実行します。

```
npm run test -- --watch
```

実 Chromium でビルド成果物の popup、background messaging、content script を検証する E2E スモークテストも用意しています。初回のみ Playwright の Chromium をインストールしてください。

```
npx playwright install chromium
```

E2E は dev server ではなく `extension/` をロードするため、先に build します。

```
npm run build && npm run e2e
```

## Dev Server

Vite と`@crxjs/vite-plugin`の plugin を利用して、HMR を使いながら開発できます。

```
npm run dev
```

## Linting

Oxlint を利用し、Lint を実行しています(検査のみ、ファイルは書き換えません)。

```
npm run lint
```

VSCode の拡張機能と併用することで、ファイル保存時に実行します。
また、husky + lint-staged と併せて利用しており、commit 時に staged ファイルのみを検査するため、
エラー状態での commit を抑止します(未 staged のファイルは対象外)。

## Formatting

prettier を利用し、コードの整形を行なっています。

```
npm run format
```

VSCode の拡張機能と併用することで、ファイル保存時に実行します。
また、husky + lint-staged と併せて利用しており、commit 時に staged ファイルのみを対象に
自動で整形します。

## CI

github actions を用いた CI を追加しています。
type check、lint、unit test、build、実 Chromium E2E のチェックを、main への push と pull request をトリガーに実行します。

## Release

`npm run package` で manifest を検証した再現可能な `extension.zip` を生成します。
バージョン更新、タグ付与、GitHub Release の手順は [リリース手順](docs/releasing.md) を参照してください。

## ディレクトリ構成

- `src/entrypoints/{popup,options,background,content}/` : 拡張機能の各サーフェス(エントリポイント)
- `src/lib/` : entrypoints から利用する共有モジュール置き場(messaging / storage、Chrome API 境界、共通テストfake)
- `src/examples/` : 学習用のサンプル実装(components / hooks / utils)。不要であれば `src/examples/` ごと削除可能

依存方向の規約:

- `entrypoints → lib` は許可、`lib → entrypoints` は禁止
- entrypoints 同士の直接 import は禁止(サーフェス間の通信は messaging 経由)
- `chrome` グローバルの実参照は `src/lib/` 内のみ許可。entrypoints から Chrome API を使う場合は lib に薄いラッパーを追加する

この Chrome API 境界は Oxlint で静的に検査される。例外が不可避な場合だけ、理由を
明記した `oxlint-disable` コメントを使用する。`@types/chrome` の型参照は全域で利用できる。

DevTools パネルは本 template では提供していません。追加したい場合は
[chrome.devtools 公式ドキュメント](https://developer.chrome.com/docs/extensions/reference/api/devtools)を参照してください。

## AI開発設定 (Claude Code / Codex)

コーディングエージェント向けの基本設定を用意しています。

- `AGENTS.md` : 共通エントリポイント(常時ロードされる正本)
- `CLAUDE.md` : Claude Code 用(`AGENTS.md` を import するのみ)
- `.claude/rules/` : 対象ファイル編集時に読み込む技術規約
- `.claude/skills/` : タスク該当時にオンデマンドで読み込む手順書

トークン消費を抑えるため、常時ロードは `AGENTS.md` のみとし、詳細は必要時に読み込む構成としています。
