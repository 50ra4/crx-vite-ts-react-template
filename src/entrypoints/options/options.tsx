import React, { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useStorageValue } from '../../lib/storage';

const Root = () => {
  const [exampleSetting, setExampleSetting] = useStorageValue('exampleSetting');
  const [draftValue, setDraftValue] = useState(exampleSetting);
  const [saveError, setSaveError] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const syncedSettingRef = useRef(exampleSetting);

  useEffect(() => {
    if (syncedSettingRef.current === exampleSetting) {
      return;
    }

    syncedSettingRef.current = exampleSetting;

    if (!isDirty) {
      setDraftValue(exampleSetting);
    }
  }, [exampleSetting, isDirty]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveError('');

    try {
      await setExampleSetting(draftValue);
      syncedSettingRef.current = draftValue;
      setIsDirty(false);
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <main
      style={{
        width: '320px',
        padding: '16px',
      }}
    >
      <h1>Options</h1>
      <p>保存した値は同期ストレージに保持され、popup からも読めます。</p>
      <form onSubmit={onSubmit}>
        <label htmlFor="example-setting">共有設定</label>
        <input
          id="example-setting"
          onChange={(event) => {
            const nextValue = event.currentTarget.value;
            setDraftValue(nextValue);
            setIsDirty(nextValue !== syncedSettingRef.current);
          }}
          type="text"
          value={draftValue}
        />
        <button type="submit">保存</button>
      </form>
      <p>現在の保存値: {exampleSetting}</p>
      {isDirty && <p>未保存の変更があります。</p>}
      {saveError && <p role="alert">保存に失敗しました: {saveError}</p>}
    </main>
  );
};

// oxlint-disable-next-line typescript/no-non-null-assertion
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
