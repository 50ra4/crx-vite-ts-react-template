# src/lib

entrypoints から利用する共有モジュールの置き場です。

- 依存方向は `entrypoints → lib` のみ許可。`lib` から `entrypoints` への import は禁止
- Chrome API の実参照は `src/lib/` 内だけで許可。entrypoints などからは lib のラッパーを利用する
- 例外が不可避な場合は `oxlint-disable` コメントに理由を記載し、境界違反を顕在化する

テストでは `src/lib/testing/chromeFake.ts` の `installChromeFake` を使う。runtime
messaging と storage(local / managed / session / sync)を in-memory で再現し、
`vi.stubGlobal` でテストごとに注入できる。`activeTab` または `tabs` で対象タブを
設定し、`executeScriptResult` または `executeScriptError` で注入結果を再現できる。
両方を同時指定すると、結果が空配列でも生成時に拒否する。
`activeTab` は `active` の省略または `true` を許可し、`false` は矛盾する指定として
明示的に拒否する。非activeタブを含む構成には `tabs` を使う。
複数ウィンドウやクエリ条件は `tabs` と
`currentWindowId` / `lastFocusedWindowId` で設定する。対応する query 条件は
`active`、`currentWindow`、`lastFocusedWindow`、`windowId`、`url`。未対応条件は
黙って無視せずエラーにする。全タブの `windowId` が同じならその ID を current
window として推論する。`windowId` の指定有無が混在する場合や複数ウィンドウでは、
曖昧さを避けるため `currentWindowId` を必須とする。
タブの `id` は全ウィンドウで一意。指定する `id` / `windowId` と
`currentWindowId` / `lastFocusedWindowId` は0以上の整数でなければならない。
タブのあるウィンドウには `active: true` を
ちょうど1件指定する。
明示した `index` を先に確保し、省略したタブには各ウィンドウの空き番号を小さい順に
割り当てる。各ウィンドウの `index` は `0` からの連番でなければならない。
`executeScriptError` だけの指定は、エラー経路専用のfixtureモードであり、
タブを登録せず任意の整数タブIDで設定エラーを再現できる。
引数形式の検証は省略しない。
`executeScriptResult` だけの指定は許可せず、`activeTab` または `tabs` に
有効な `id` を持つタブが1件以上必要。結果を指定しない場合は、ID欠落への防御を
検証するため `id` のないタブも許可する。
結果を `[]` にした場合も同じで、`tabs: []` と結果の同時指定は生成時に拒否する。
結果なしの `tabs: []` は「タブがない」分岐のテストに使える。
タブを指定した場合は、対象タブの存在を確認してから注入結果またはエラーを返す。
対象タブが存在し、結果・エラーを指定しない場合の既定応答は
`[{ frameId: 0, result: null }]`。明示的な `executeScriptResult: []` は通常の成功応答
ではなく、不完全な応答への防御を検証するために許可する。
タブと注入結果は生成時にも返却時にもdeep cloneし、入力・呼び出し間の変更を分離する。

`executeScriptResult` は **Chromeによる変換後のAPI応答** を指定するfixtureであり、
注入関数の生の戻り値ではない。`func` の実行やChromeの直列化処理は再現しない。
各応答の `frameId` は0以上の整数。実Chromeが返す `documentId` はfakeでは省略可能で、
指定する場合は文字列とする。fakeによるdocument IDの自動生成は行わない。
結果には `null`・文字列・有限数・真偽値・密な配列・plain object
からなるデータを指定し、生成時に検証する。関数やDOMを自動変換したり、元の参照を
そのまま返したりはしない。例えば実Chromeで `{ title: undefined, a: 1 }` を返す
ケースは `{ a: 1 }`、関数や `undefined` を返すケースは `null`、`document.body`
を返すケースは `{}`、疎配列 `[1, , 2]` は `[1, null, 2]` をfixtureに設定する。
応答一覧およびネストした結果配列の穴、結果配列の追加の列挙可能プロパティ、
循環参照や非有限数は生成時に拒否する。これらの変換は
`e2e/chrome-fake-contract.spec.ts` で実Chromiumにも照合する。
型ガードの不正値テストには `null`・文字列・不正な形のオブジェクトを使える。
`result` の省略は、不完全な応答への防御を検証するために許可する。

URL条件はmanifestの権限パターンではなく `tabs.query` のパターンとして扱う。
`url` の省略と `url: []` はどちらもURLによる絞り込みを行わず、URL未指定のタブも
返す。他のquery条件はそのまま適用する。非空の配列は各パターンのOR条件となる。
ポート省略・`:*` は全ポート、数値はそのポート（既定の80/443などを含む）に一致する。
IPv6ホストは `[...]` で指定する。schemeの `*` はhttp/httpsのみ、明示schemeは
同じschemeだけ、`<all_urls>` は `chrome:`・拡張ページ・`about:blank` も対象とする。
非空のURL条件では、不正patternを検索前に拒否し、不正なfixture URLや未指定URLは
非一致にする。空クエリの区切り文字 `?` は保持し、fragmentの `#` 以降は照合しない。
末尾 `/*` にはChromiumの特例を適用し、`https://example.com/docs/*` は
`https://example.com/docs` にも一致する。ただし `/doc/*` や `/do*s/*` を同じURLに
一致させたり、クエリ付きの `/docs?x=1` や `/docs?` をこの特例で一致させたりはしない。
`scheme://` 形式の対応範囲は `http` / `https` / `file` / `ftp` / `ws` / `wss` /
`chrome` / `chrome-extension` / `chrome-search` / `chrome-native` /
`chrome-distiller` / `chrome-untrusted` / `devtools` / `isolated-app` と
ワイルドカードscheme。その他のschemeは `urn:*` などのopaque形式を扱う。
Chromiumは未登録schemeの `://` を拒否するため、任意の `scheme://` は受理しない。
OS固有・将来追加されるschemeやChromeのURL実装全体の再現は保証しない。
対応追加時は実機で確認して契約テストに追加する。
単体テストと実ChromiumのE2Eで同じ正規化済みURL・query条件を使い、ブラウザ側は
作成時に取得したタブIDで照合する。非正規化URLの補完はfake固有の便利機能として
別の単体テストで検証する。
fakeは権限付与・URL伏字化・実際のページ注入を行わないので、それらはE2Eでも確認する。

## activeTab + scripting によるページ注入

ページに常駐する content script が不要なら、次の順序で `src/lib/` 内に注入処理を
実装する。

1. `manifest.config.ts` の `permissions` に `activeTab` と `scripting` を追加し、
   `scripts/expected-manifest.config.mjs` の期待値も同時に更新する
2. `activeTab` の一時的な host 権限を得るため、actionのクリックで開くpopup、
   `action.onClicked`、command、context menuなどユーザー操作を起点に呼び出す。
   このテンプレートはpopupを設定済みなので、`action.onClicked` を使う場合は
   `action.default_popup` と対応するmanifest期待値も変更する。
   popupがある間は `onClicked` が発火しない（[Chrome公式](https://developer.chrome.com/docs/extensions/reference/api/action#popup)）
3. イベントハンドラではイベント引数の `tab` をそのまま使い、欠落時は処理しない。
   別ウィンドウへフォーカスが移る可能性があるので、service worker側で取り直さない。
   popupから呼ぶ場合のみ `chrome.tabs.query({ active: true, currentWindow: true })`
   で対象を取得する。取得後はそのタブを手順4・5へ渡す
4. タブ ID の欠落、権限不足で `url` が `undefined` の場合、`chrome:` など注入禁止
   URL を拒否する
5. `chrome.scripting.executeScript` で対象タブへ関数を注入する
6. 戻り値を `unknown` として型ガードで検証してから利用する

テストでは個別に Chrome API をモックせず、次のように fake の入出力だけを指定する。

```ts
installChromeFake({
  activeTab: { id: 42, url: 'https://example.com/form' },
  executeScriptResult: [{ frameId: 0, result: { ok: true } }],
});
```

成功、イベント対象とフォーカス先が異なる場合、権限不足でURLが伏字化された場合、
注入禁止URL、不正な戻り値のサンプルは
`src/lib/testing/chromeFake.test.ts` を参照する。

## messaging(`src/lib/messaging/`)

Extension context 間(popup / options / content ↔ background)の型安全な
messaging レイヤー。依存ゼロの自前実装。

- `createMessaging.ts` — 汎用エンジン(`createMessaging` / `defineMessage`)。触らなくてよい
- `messages.ts` — アプリのメッセージ契約。**新しいメッセージはここに1件追加するだけ**

### 使い方

1. `messages.ts` の `messages` に契約を追加(request / response の実行時ガードを宣言):

   ```ts
   export const messages = {
     greet: defineMessage(
       (v): v is { text: string } => isRecord(v) && typeof v.text === 'string',
       (v): v is { reply: string } =>
         isRecord(v) && typeof v.reply === 'string',
     ),
   } as const;
   ```

2. 送信側(popup 等)は `sendMessage(name, payload)`。payload / 戻り値は型推論される:

   ```ts
   const res = await sendMessage('greet', { text: 'popup' }); // res: { reply: string }
   ```

3. 受信側(background)は `addMessageListeners`。検証済みの型付き payload を受け取る:

   ```ts
   addMessageListeners({
     greet: (payload) => ({ reply: `Hello, ${payload.text}!` }),
   });
   ```

`sender.id !== chrome.runtime.id` の発信・未知メッセージ・payload ガード不合格は
**既定で拒否**される。tabs / Port(長寿命接続)は未対応(必要時に拡張)。
