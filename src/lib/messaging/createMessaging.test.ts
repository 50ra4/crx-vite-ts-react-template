import { createMessaging, defineMessage } from './createMessaging';

const EXTENSION_ID = 'test-extension-id';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

// テスト用の最小契約(エンジンは契約に非依存なので独自契約を注入できる)
const testMessages = {
  greet: defineMessage(
    (value): value is { text: string } =>
      isRecord(value) && typeof value.text === 'string',
    (value): value is { reply: string } =>
      isRecord(value) && typeof value.reply === 'string',
  ),
} as const;

type Listener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
) => boolean | undefined;

let listeners: Listener[] = [];
// 次に送るメッセージの sender。既定は拡張自身(検証を通る)。
let nextSender: chrome.runtime.MessageSender = { id: EXTENSION_ID };

const setupChromeMock = () => {
  listeners = [];
  nextSender = { id: EXTENSION_ID };
  const chromeMock = {
    runtime: {
      id: EXTENSION_ID,
      onMessage: {
        addListener: (fn: Listener) => listeners.push(fn),
        removeListener: (fn: Listener) => {
          listeners = listeners.filter((registered) => registered !== fn);
        },
      },
      // 登録済みリスナへ配送し、最初に sendResponse された値で resolve する。
      sendMessage: (message: unknown) =>
        new Promise<unknown>((resolve) => {
          for (const listener of listeners) {
            const keepChannelOpen = listener(message, nextSender, resolve);
            if (keepChannelOpen) return;
          }
          resolve(undefined);
        }),
    },
  };
  globalThis.chrome = chromeMock as unknown as typeof chrome;
};

describe('lib/messaging/createMessaging', () => {
  beforeEach(setupChromeMock);
  afterEach(() => {
    listeners = [];
  });

  it('型付き payload を送り、型付き response を受け取れる(正常往復)', async () => {
    const { sendMessage, addMessageListeners } = createMessaging(testMessages);
    addMessageListeners({
      greet: (payload) => ({ reply: `Hello, ${payload.text}!` }),
    });

    await expect(sendMessage('greet', { text: 'world' })).resolves.toEqual({
      reply: 'Hello, world!',
    });
  });

  it('非同期ハンドラの response も受け取れる', async () => {
    const { sendMessage, addMessageListeners } = createMessaging(testMessages);
    addMessageListeners({
      greet: async (payload) =>
        Promise.resolve({ reply: `Hi ${payload.text}` }),
    });

    await expect(sendMessage('greet', { text: 'async' })).resolves.toEqual({
      reply: 'Hi async',
    });
  });

  it('不正な payload は既定で拒否する', async () => {
    const { addMessageListeners } = createMessaging(testMessages);
    addMessageListeners({ greet: (payload) => ({ reply: payload.text }) });

    // 型を迂回してガードに合致しない payload を直接送る
    const response = await chrome.runtime.sendMessage({
      __messageName: 'greet',
      payload: { text: 123 },
    });

    expect(response).toEqual({
      ok: false,
      error: expect.stringContaining('invalid payload'),
    });
  });

  it('sender が拡張自身でない場合は応答しない(sendMessage は throw する)', async () => {
    const { sendMessage, addMessageListeners } = createMessaging(testMessages);
    addMessageListeners({ greet: (payload) => ({ reply: payload.text }) });

    nextSender = { id: 'malicious-extension-id' };

    await expect(sendMessage('greet', { text: 'world' })).rejects.toThrow(
      /no valid response/,
    );
  });

  it('未知のメッセージ名は拒否する', async () => {
    const { addMessageListeners } = createMessaging(testMessages);
    addMessageListeners({ greet: (payload) => ({ reply: payload.text }) });

    const response = await chrome.runtime.sendMessage({
      __messageName: 'unknown-message',
      payload: {},
    });

    expect(response).toEqual({
      ok: false,
      error: expect.stringContaining('unknown message'),
    });
  });

  it('response がガードに合致しない場合は throw する', async () => {
    const { sendMessage, addMessageListeners } = createMessaging(testMessages);
    addMessageListeners({
      // 契約に反する response を返す(型を迂回)
      greet: () => ({ wrong: true }) as unknown as { reply: string },
    });

    await expect(sendMessage('greet', { text: 'world' })).rejects.toThrow(
      /type guard/,
    );
  });

  it('ハンドラが例外を投げた場合はエラー応答になり、送信側で throw する', async () => {
    const { sendMessage, addMessageListeners } = createMessaging(testMessages);
    addMessageListeners({
      greet: () => {
        throw new Error('handler boom');
      },
    });

    await expect(sendMessage('greet', { text: 'world' })).rejects.toThrow(
      /handler boom/,
    );
  });

  it('戻り値の関数でリスナを登録解除できる', async () => {
    const { sendMessage, addMessageListeners } = createMessaging(testMessages);
    const unsubscribe = addMessageListeners({
      greet: (payload) => ({ reply: payload.text }),
    });
    unsubscribe();

    // リスナがいないので response は返らず throw する
    await expect(sendMessage('greet', { text: 'world' })).rejects.toThrow(
      /no valid response/,
    );
  });
});
