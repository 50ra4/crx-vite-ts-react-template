// アプリのメッセージ契約。新しいメッセージはここに1件追加するだけで、
// 送信側・受信側の両方で型が保証される。ガードは手書きの型述語で十分
// (zod 等のランタイム依存は入れない)。
import { createMessaging, defineMessage } from './createMessaging';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const messages = {
  // popup → background のサンプル。任意のテキストを送ると挨拶を返す。
  greet: defineMessage(
    (value): value is { text: string } =>
      isRecord(value) && typeof value.text === 'string',
    (value): value is { reply: string } =>
      isRecord(value) && typeof value.reply === 'string',
  ),
} as const;

export const { sendMessage, addMessageListeners } = createMessaging(messages);
