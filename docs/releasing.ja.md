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

## 3. Chrome Web Store 公開前チェックリスト

Chrome Web Store に提出するリリースでは、**限定公開 (unlisted)** を含めてすべて実施する。
限定公開は検索結果に表示されないだけのストア公開形態であり、審査・掲載情報・
プライバシー申告は公開リリースと同一である。省略できるのはストアを介さない配布
(自己ホストの `.zip` / `.crx`、エンタープライズポリシーによる配布)だけである。

タグを付ける前に(手順 1 の一部として)、以下をすべて確認する。

1. `docs/store/` の 3 文書([privacy-policy.md](./store/privacy-policy.md)、
   [store-listing.md](./store/store-listing.md)、
   [manual-test.md](./store/manual-test.md))が当該プロダクトの内容で記入され、
   プレースホルダとテンプレートのコメントがすべて置き換えられていること。
2. ユーザーデータを扱う場合(ローカルに保存するだけの場合も含む)、
   プライバシーポリシーが安定した公開 URL に掲載され、その URL が
   デベロッパーダッシュボードのプライバシー欄に設定され、
   掲載内容が当該バージョンの [privacy-policy.md](./store/privacy-policy.md) と
   一致していること。リポジトリ内の Markdown を記入するだけでは要件を満たさない。
   審査で読まれるのは公開ページであるため、初回提出前にホスティング先を決め、
   ポリシー変更時は必ず再掲載する。
3. [manual-test.md](./store/manual-test.md) をパッケージ済みビルドに対して実施済みであること。
   開発ビルドではなく、`npm run package` が生成した `extension/` ディレクトリを読み込んで実施する。
4. `npm run verify:manifest` が成功し、`scripts/expected-manifest.config.mjs` の
   `permissions` / `host_permissions` / `optional_permissions` の各エントリが、
   [store-listing.md](./store/store-listing.md) の「Permission justifications」に
   過不足なく 1 対 1 で対応していること。正当化のない権限も、
   宣言していない権限に対する正当化も残さない。
5. [store-listing.md](./store/store-listing.md) の「Screenshot checklist」に挙げた素材を、
   当該バージョンのビルドから用意していること。

GitHub Release の作成が成功した後、検証済みの `extension.zip` を Chrome Web Store
デベロッパーダッシュボードから手動でアップロードする。公開は意図的に手動であり、
Release workflow が Store へアップロードすることはない。
