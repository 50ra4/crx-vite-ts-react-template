import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const Root = () => {
  return (
    <div
      style={{
        color: 'red',
        fontSize: '24px',
        width: '320px',
        height: '320px',
      }}
    >
      options
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
