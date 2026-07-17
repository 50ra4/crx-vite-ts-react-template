import { sendMessage } from './messages';

// コンパイル時の型契約テスト。`@ts-expect-error` の各行は「そこで型エラーが
// 起きること」を要求するため、契約が緩むと `npm run check-type` が落ちる。
// これらの関数は実行されない(型検査のみ)。

const _requestTypeChecks = () => {
  // @ts-expect-error 存在しないメッセージ名は拒否される
  void sendMessage('unknown-message', { text: 'x' });

  // @ts-expect-error payload の型が契約と一致しない(text は string)
  void sendMessage('greet', { text: 123 });

  // @ts-expect-error payload のプロパティ不足
  void sendMessage('greet', {});

  // 正しい呼び出しは型エラーにならない
  void sendMessage('greet', { text: 'ok' });
};

const _responseTypeChecks = async () => {
  const res = await sendMessage('greet', { text: 'ok' });

  // response は { reply: string }。存在しないプロパティ参照は型エラー
  // @ts-expect-error
  void res.nonExistent;

  // 正しいプロパティ参照は型エラーにならない
  void res.reply;
};

// 未使用シンボル警告を避けるため参照する(呼び出しはしない)
void _requestTypeChecks;
void _responseTypeChecks;

describe('lib/messaging types', () => {
  it('コンパイル時の型契約は check-type で検査される', () => {
    expect(typeof sendMessage).toBe('function');
  });
});
