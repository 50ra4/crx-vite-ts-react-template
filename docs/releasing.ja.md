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

チェックは 2 つのゲートに分かれる。半数はリポジトリ側では実施できないためである。
新規アイテムは最初のパッケージをアップロードするまで存在せず、**Privacy practices**・
プライバシー・掲載情報の各フォームを開くこともできない。アップロードはドラフトの
作成/更新にすぎず、明示的に審査提出するまでユーザーには一切届かないので、
初回提出時はフォームを開けるようにする目的だけで先にドラフトをアップロードしてよい。

### 3a. タグ付け前(リポジトリ側)

手順 1 の一部として以下をすべて確認する。ここの項目はすべて、ストアアイテムが
無くてもローカルで検証できる。

1. `docs/store/` の 3 文書([privacy-policy.md](./store/privacy-policy.md)、
   [store-listing.md](./store/store-listing.md)、
   [manual-test.md](./store/manual-test.md))が当該プロダクトの内容で記入され、
   プレースホルダとテンプレートのコメントがすべて置き換えられていること。
   気づかないまま古くなりやすい 2 点はここで確認する:
   [privacy-policy.md](./store/privacy-policy.md) と
   [store-listing.md](./store/store-listing.md) の single purpose の記述が
   一致していること、および「Data stored」の一覧(記載した上限値を含む)が
   実装(`src/lib/storage/schema.ts` と、プロダクトが使う他の永続化)と
   一致していること。後者は manifest からは判別できない。
2. ユーザーデータを扱う場合(ローカルに保存するだけの場合も含む)、
   プライバシーポリシーが安定した公開 URL に掲載され、掲載内容が当該バージョンの
   [privacy-policy.md](./store/privacy-policy.md) と一致していること。
   リポジトリ内の Markdown を記入するだけでは要件を満たさない。
   審査で読まれるのは公開ページであるため、初回提出前にホスティング先を決め、
   改訂のたびに effective date を更新して再掲載する。
   (ダッシュボードの URL 欄への設定は [3b](#3b-ダッシュボード上審査提出前) —
   アイテムが存在しなければその欄も存在しない。)
3. [manual-test.md](./store/manual-test.md) をパッケージ済みビルドに対して実施済みであること。
   開発ビルドではなく、`npm run package` が生成した `extension/` ディレクトリを読み込んで実施する。
4. `npm run verify:manifest` が**警告なしで**成功し、生成された
   `extension/manifest.json` のアクセスを与える全エントリが、
   [store-listing.md](./store/store-listing.md) の「Permission justifications」に
   過不足なく 1 対 1 で対応していること。対象は verifier が検証する
   6 つのリストすべて — `permissions` / `host_permissions` /
   `optional_permissions` / `optional_host_permissions` /
   `content_scripts[].matches` / `web_accessible_resources`(各エントリの
   `matches` と、公開しているもの)。正当化のないエントリも、
   宣言していない対象への正当化も残さない。読むのは項目 3 と同じ
   `npm run package` が生成した manifest であり、古いビルドを読まない
   (`verify:manifest` 自身がこのファイルを読み、
   `scripts/expected-manifest.config.mjs` がその内容を pin している)。
   警告はコマンドを失敗させないがリリースは止める。例えば `displayName` の
   警告は、ストア掲載名がテンプレートのままであることを意味する。
5. [store-listing.md](./store/store-listing.md) の
   「Permissions deliberately not requested」に挙げた全項目が、
   同じ生成後 manifest に実在しないこと。`manifest.config.ts` を見るのでは
   代用にならない(ビルドが source に無いエントリを追加する。3a-4 参照)。
   配布される manifest が宣言している権限を「要求しない」と書くのは、
   審査に対する虚偽記載である。
6. [store-listing.md](./store/store-listing.md) の「Screenshot checklist」に挙げた素材を、
   当該バージョンのビルドから用意していること。

### 3b. ダッシュボード上、審査提出前

公開は意図的に手動であり、Release workflow が Store へアップロードすることはない。
このゲートは順番どおりに進める(各手順が次の手順を可能にする、または入力になる)。
審査提出は最後に行う。

1. 審査に出すパッケージをアップロードする。手順 2 の GitHub Release に添付された
   `extension.zip` がそれであり、CI が検証済みなのはこの成果物だけである
   (ローカルビルドではない)。

   新規アイテムだけが部分的な例外になる。何かをアップロードするまでアイテムが
   存在しないため、アイテム作成とフォーム解放のためだけに、タグ付け前へ
   ローカルビルドのドラフトを上げてよい。これは足場であって提出物ではなく、
   ダッシュボード上で両者を判別できるように**リリース版より低いプレースホルダ
   version** で作る:

   ```sh
   npm version 0.0.1 --no-git-tag-version
   npm run package
   git checkout -- package.json package-lock.json
   ```

   これから公開する version のまま足場を作ってはならない。ダッシュボードから
   分かるのは実質パッケージの version だけであり、足場が同じ version を持つと
   「差し替え忘れ」と「差し替え済み」が区別できなくなる。なおこのビルドは
   `extension/` と `extension.zip` をプレースホルダ version の成果物で
   上書きするため、version ファイルを復元した後に `npm run package` を
   実行し直すこと。3a-3〜3a-5 を足場ビルドに対して評価してはならない。

   タグの Release が成功したら、足場を Release の `extension.zip` で上書きし、
   表示される version が `0.0.1` からリリース版へ変わることを確認する。この
   遷移だけが、差し替えが実際に起きたことのダッシュボード上の証拠である。
   その後、**差し替え後のビルドに対して手順 2〜4 をやり直す**。足場に対して
   入力したフォームの値はアップロードしても残り、どこでも再検証されない。
2. プライバシーポリシー URL 欄に 3a-2 で公開したページを設定し、
   保存した URL を実際に開いてそのページに到達することを確認する。
3. **Privacy practices** フォームを上から順に確認する。single purpose の説明、
   各権限とリモートコードの正当化、収集するデータ種別とその利用目的・共有方針、
   認証(certification)のチェック項目。ポリシー URL を設定してもこれらの項目は
   1 つも埋まらず、[privacy-policy.md](./store/privacy-policy.md) 自体が
   ダッシュボード申告との一致を要求している。各回答は、アップロードしたビルドと
   `docs/store/` の 3 文書に一致していなければならない。
4. 掲載情報(名称、短い説明、詳細説明、全ロケール、アップロード済みスクリーンショット)が
   [store-listing.md](./store/store-listing.md) と一致していること。
5. ドラフトに入っているパッケージが、足場の残骸ではなく Release 成果物で
   あることを確認する。
   - ダッシュボードに表示される version / version name がタグと一致すること。
   - 足場を使った場合、手順 1 で version がプレースホルダからリリース版へ
     変わるのを**実際に見ている**こと。そこにリリース版が表示されていることは
     同じ証拠にならない。version 更新後に作った足場も同じ表示になる。
   - アップロードしたファイルが Release アセットそのもの(Release から
     ダウンロードしたもの)であること。ローカルで再ビルドしたものや、
     古いパスから選び直したものではない。

   ダウンロードした Release アセットとローカルの `npm run package` 出力を
   `shasum -a 256` で突き合わせると、Release 成果物が再現可能な CI 検証済み
   ビルドであることは証明できるが、ダッシュボードがどのファイルを保持して
   いるかは何も証明しない(アップロード済みパッケージは読み出せない)。
   両者を接続するのは、上記の version 遷移の目視と、そのファイルを自分で
   アップロードしたという事実だけである。足場にリリース版の version を
   使ってはならない理由がこれである。
6. ここまで揃ってから審査に提出する。
