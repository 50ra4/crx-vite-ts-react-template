// Extension context 間の型安全 messaging レイヤー(依存ゼロ)。
// 契約(メッセージ名 → request/response の実行時ガード)を単一ソースとし、
// 送信側・受信側の型をガードの型述語から導出する。sender 検証と payload の
// 実行時ガードにより、不正な送信元・不正な payload を既定で拒否する。
//
// 対象は chrome.runtime.sendMessage(拡張内の一往復)のみ。tabs / Port は
// 意図的に未対応(YAGNI)。

/** メッセージ1件の契約。request/response それぞれの実行時ガードを持つ。 */
export type MessageContract<Req = unknown, Res = unknown> = {
  isRequest: (value: unknown) => value is Req;
  isResponse: (value: unknown) => value is Res;
};

/** メッセージ名 → 契約のマップ。 */
export type ContractMap = Record<string, MessageContract>;

/**
 * 契約を1件宣言する。両ガードから Req / Res を推論するため、型注釈は不要。
 * これがメッセージの型と実行時検証の単一ソースになる。
 */
export const defineMessage = <Req, Res>(
  isRequest: (value: unknown) => value is Req,
  isResponse: (value: unknown) => value is Res,
): MessageContract<Req, Res> => ({ isRequest, isResponse });

type GuardType<G> = G extends (value: unknown) => value is infer T ? T : never;

/** 契約からメッセージ名の union を取り出す。 */
export type MessageName<M extends ContractMap> = keyof M & string;
/** 指定メッセージの request 型。 */
export type RequestOf<M extends ContractMap, K extends keyof M> = GuardType<
  M[K]['isRequest']
>;
/** 指定メッセージの response 型。 */
export type ResponseOf<M extends ContractMap, K extends keyof M> = GuardType<
  M[K]['isResponse']
>;

/** 受信側ハンドラマップ。登録は部分的でよい(未登録メッセージは無視)。 */
export type MessageHandlers<M extends ContractMap> = {
  [K in MessageName<M>]?: (
    payload: RequestOf<M, K>,
    sender: chrome.runtime.MessageSender,
  ) => ResponseOf<M, K> | Promise<ResponseOf<M, K>>;
};

// --- ワイヤ形式(この2種のエンベロープ以外は未知メッセージとして無視する) ---

type RequestEnvelope = { __messageName: string; payload: unknown };
type ResponseEnvelope =
  { ok: true; data: unknown } | { ok: false; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isRequestEnvelope = (value: unknown): value is RequestEnvelope =>
  isRecord(value) &&
  typeof value.__messageName === 'string' &&
  'payload' in value;

const isResponseEnvelope = (value: unknown): value is ResponseEnvelope =>
  isRecord(value) && typeof value.ok === 'boolean';

const toErrorMessage = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

/**
 * 契約から型付きの送信ヘルパーと受信登録関数を生成する。
 * 利用者はメッセージ契約を1箇所に書き、この戻り値を送受信で共有する。
 */
export const createMessaging = <M extends ContractMap>(contracts: M) => {
  /**
   * 型付き送信。payload / 戻り値の型は契約から推論される。
   * response エンベロープ欠落・`ok:false`・response ガード不合格はいずれも throw。
   */
  const sendMessage = async <K extends MessageName<M>>(
    name: K,
    payload: RequestOf<M, K>,
  ): Promise<ResponseOf<M, K>> => {
    const envelope: RequestEnvelope = { __messageName: name, payload };
    const response: unknown = await chrome.runtime.sendMessage(envelope);

    if (!isResponseEnvelope(response)) {
      throw new Error(`messaging: no valid response for "${name}"`);
    }
    if (!response.ok) {
      throw new Error(`messaging: "${name}" was rejected: ${response.error}`);
    }
    if (!contracts[name].isResponse(response.data)) {
      throw new Error(
        `messaging: response for "${name}" failed its type guard`,
      );
    }
    return response.data as ResponseOf<M, K>;
  };

  /**
   * 型付き受信登録。onMessage リスナ内で以下を既定で拒否する:
   * 拡張外の sender / 未知メッセージ名 / request ガード不合格。
   * 戻り値は登録解除関数。
   */
  const addMessageListeners = (handlers: MessageHandlers<M>): (() => void) => {
    const listener = (
      message: unknown,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: ResponseEnvelope) => void,
    ): boolean | undefined => {
      // 1. 拡張内発信のみ許可(content script / 他拡張 / Web ページを除外)
      if (sender.id !== chrome.runtime.id) {
        return undefined;
      }
      // 2. このレイヤーのエンベロープ以外は無視
      if (!isRequestEnvelope(message)) {
        return undefined;
      }
      // 3. 未知のメッセージ名は拒否
      if (
        !Object.prototype.hasOwnProperty.call(contracts, message.__messageName)
      ) {
        sendResponse({
          ok: false,
          error: `unknown message "${message.__messageName}"`,
        });
        return undefined;
      }
      const name = message.__messageName as MessageName<M>;
      const handler = handlers[name];
      // ハンドラ未登録: 他リスナに委ねるため応答せず無視
      if (!handler) {
        return undefined;
      }
      // 4. payload の実行時ガード
      if (!contracts[name].isRequest(message.payload)) {
        sendResponse({ ok: false, error: `invalid payload for "${name}"` });
        return undefined;
      }
      // 5. ハンドラ実行(同期/非同期の両対応)。例外は握りつぶさずエラー応答にする
      Promise.resolve(
        handler(message.payload as RequestOf<M, typeof name>, sender),
      )
        .then((data) => sendResponse({ ok: true, data }))
        .catch((cause: unknown) =>
          sendResponse({ ok: false, error: toErrorMessage(cause) }),
        );
      // 非同期で sendResponse を呼ぶため、チャネルを開いたままにする
      return true;
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  };

  return { sendMessage, addMessageListeners };
};
