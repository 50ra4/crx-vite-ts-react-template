# リリース手順

[English](./releasing.md) | **日本語**

> 正本は英語版([releasing.md](./releasing.md))です。差異がある場合は
> 英語版が優先されます。

リリース元は `main` とし、Node.js 24 と `package-lock.json` の固定依存関係を使用する。

## 1. バージョン更新と検証

次期バージョンを指定すると、`package.json` と `package-lock.json` が同時に更新される。

```sh
npm version 1.1.0 --no-git-tag-version
npm ci
npm run check-type
npm run lint
npm run test
npm run package
npm run e2e
```

`npm run package` は build と manifest 検証を行い、`extension/` 内の配布対象ファイルだけを
リポジトリ直下の `extension.zip` に格納する。開発用アイコンは含めない。同一ソース・Node.js・
lockfile からは同一内容の zip が生成される。`npm run zip` は互換用の別名である。

生成物を手動確認する場合は `extension.zip` を展開し、Chrome の
`chrome://extensions` で展開後のディレクトリを「パッケージ化されていない拡張機能を読み込む」から選択する。

## 2. main とタグの push

バージョン更新をレビュー・マージした後、最新の `main` に `v` 接頭辞付きのタグを付ける。

```sh
git switch main
git pull --ff-only
git tag -a v1.1.0 -m "v1.1.0"
git push origin v1.1.0
```

プレリリースは package version とタグの両方を `1.1.0-rc.1` / `v1.1.0-rc.1`
のように一致させる。タグと `package.json` の version が一致しない場合、Release workflow は失敗する。
Chrome Manifest の `version` には数値部分 (`1.1.0`)、`version_name` には完全なプレリリース版を記録する。

タグ push 後、GitHub Actions が type check、lint、unit test、manifest 検証、実 Chromium E2E を実行する。
すべて成功した場合だけ、自動生成ノートと `extension.zip` を含む GitHub Release が作成される。
