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
`executeScriptResult` だけの指定は許可せず、`activeTab` または `tabs` が必要。
タブを指定した場合は、対象タブの存在を確認してから注入結果またはエラーを返す。
注入結果はシリアライズ可能なデータに限り、fixture作成時に検証する。
返却時は毎回コピーするため、型ガードの不正値テストには文字列や不正な形の
オブジェクトなどを使う。

## activeTab + scripting によるページ注入

ページに常駐する content script が不要なら、次の順序で `src/lib/` 内に注入処理を
実装する。

1. `manifest.config.ts` の `permissions` に `activeTab` と `scripting` を追加し、
   `scripts/expected-manifest.config.mjs` の期待値も同時に更新する
2. `activeTab` の一時的な host 権限を得るため、action の `onClicked`、command、
   context menu などユーザー操作を起点に処理を呼び出す
3. `chrome.tabs.query({ active: true, currentWindow: true })` で対象タブを取得する
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

成功、権限不足で URL が伏字化された場合、注入禁止 URL、不正な戻り値のサンプルは
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
