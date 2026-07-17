import React, { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { sendMessage } from '../../lib/messaging/messages';

const Root = () => {
  const [response, setResponse] = useState('');

  const onClick = () => {
    // payload / 戻り値の型は契約から推論される(型注釈不要)
    sendMessage('greet', { text: 'popup' })
      .then((res) => setResponse(res.reply))
      .catch((error: unknown) => setResponse(String(error)));
  };

  return (
    <div
      style={{
        width: '320px',
        height: '320px',
      }}
    >
      <h2
        style={{
          color: 'red',
          fontSize: '24px',
        }}
      >
        popup
      </h2>
      <button onClick={onClick}>send message</button>
      {response && <p>{response}</p>}
    </div>
  );
};

// oxlint-disable-next-line typescript/no-non-null-assertion
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
