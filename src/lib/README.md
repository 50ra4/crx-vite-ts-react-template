# src/lib

entrypoints から利用する共有モジュールの置き場です。

- 依存方向は `entrypoints → lib` のみ許可。`lib` から `entrypoints` への import は禁止
- Chrome API の実参照は `src/lib/` 内だけで許可。entrypoints などからは lib のラッパーを利用する
- 例外が不可避な場合は `oxlint-disable` コメントに理由を記載し、境界違反を顕在化する

テストでは `src/lib/testing/chromeFake.ts` の `installChromeFake` を使う。runtime
messaging と storage(local / managed / session / sync)を in-memory で再現し、
`vi.stubGlobal` でテストごとに注入できる。`activeTab` または `tabs` で対象タブを
設定し、`executeScriptResult` または `executeScriptError` で注入結果を再現できる。
複数ウィンドウやクエリ条件は `tabs` と
`currentWindowId` / `lastFocusedWindowId` で設定する。対応する query 条件は
`active`、`currentWindow`、`lastFocusedWindow`、`windowId`、`url`。未対応条件は
黙って無視せずエラーにする。全タブの `windowId` が同じならその ID を current
window として推論する。`windowId` の指定有無が混在する場合や複数ウィンドウでは、
曖昧さを避けるため `currentWindowId` を必須とする。
タブの `id` は全ウィンドウで一意、タブのあるウィンドウには `active: true` を
ちょうど1件指定する。
明示した `index` を先に確保し、省略したタブには各ウィンドウの空き番号を小さい順に
割り当てる。各ウィンドウの `index` は `0` からの連番でなければならない。
`executeScriptError` だけを指定した場合は従来どおり任意のタブIDで注入失敗を再現する。
`executeScriptResult` だけの指定は許可せず、`activeTab` または1件以上の `tabs` が必要。
結果を `[]` にした場合も同じで、`tabs: []` と結果の同時指定は生成時に拒否する。
結果なしの `tabs: []` は「タブがない」分岐のテストに使える。
タブを指定した場合は、対象タブの存在を確認してから注入結果またはエラーを返す。
タブと注入結果は生成時にも返却時にもdeep cloneし、入力・呼び出し間の変更を分離する。

`executeScriptResult` は **Chromeによる変換後のAPI応答** を指定するfixtureであり、
注入関数の生の戻り値ではない。`func` の実行やChromeの直列化処理は再現しない。
結果には `null`・文字列・有限数・真偽値・配列・plain object
からなるデータを指定し、生成時に検証する。関数やDOMを自動変換したり、元の参照を
そのまま返したりはしない。例えば実Chromeで `{ title: undefined, a: 1 }` を返す
ケースは `{ a: 1 }`、関数や `undefined` を返すケースは `null`、`document.body`
を返すケースは `{}` をfixtureに設定する。これらの変換は
`e2e/chrome-fake-contract.spec.ts` で実Chromiumにも照合する。
型ガードの不正値テストには `null`・文字列・不正な形のオブジェクトを使える。
`result` の省略は、不完全な応答への防御を検証するために許可する。

URL条件はmanifestの権限パターンではなく `tabs.query` のパターンとして扱う。
ポート省略・`:*` は全ポート、数値はそのポート（既定の80/443などを含む）に一致する。
IPv6ホストは `[...]` で指定する。schemeの `*` はhttp/httpsのみ、明示schemeは
同じschemeだけ、`<all_urls>` は `chrome:`・拡張ページ・`about:blank` も対象とする。
不正patternは検索前に拒否し、不正なfixture URLや未指定URLは非一致にする。
単体テストと実ChromiumのE2Eで同じケース表を検証する。
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
