import { addMessageListeners } from '../../lib/messaging/messages';

// sender 検証・payload ガードはレイヤー側が既定で行う。ここでは検証済みの
// 型付き payload を受け取り、型付き response を返すだけでよい。
addMessageListeners({
  greet: (payload) => ({ reply: `Hello, ${payload.text}!` }),
});
