import React, { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useStorageValue } from '../../lib/storage';

const Root = () => {
  const [exampleSetting, setExampleSetting] = useStorageValue('exampleSetting');
  const [draftValue, setDraftValue] = useState(exampleSetting);

  useEffect(() => {
    setDraftValue(exampleSetting);
  }, [exampleSetting]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void setExampleSetting(draftValue);
  };

  return (
    <main
      style={{
        width: '320px',
        padding: '16px',
      }}
    >
      <h1>Options</h1>
      <p>保存した値は chrome.storage.sync に保持され、popup からも読めます。</p>
      <form onSubmit={onSubmit}>
        <label htmlFor="example-setting">共有設定</label>
        <input
          id="example-setting"
          onChange={(event) => {
            setDraftValue(event.currentTarget.value);
          }}
          type="text"
          value={draftValue}
        />
        <button type="submit">保存</button>
      </form>
      <p>現在の保存値: {exampleSetting}</p>
    </main>
  );
};

// oxlint-disable-next-line typescript/no-non-null-assertion
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
