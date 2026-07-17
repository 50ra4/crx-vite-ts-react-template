import React, { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useStorageValue } from '../../lib/storage';

const Root = () => {
  const [response, setResponse] = useState('');
  const [exampleSetting] = useStorageValue('exampleSetting');

  const onClick = () => {
    chrome.runtime.sendMessage('send message from popup', (res) => {
      console.log(res);
      setResponse(res?.message);
    });
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
      <p>共有設定: {exampleSetting}</p>
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
