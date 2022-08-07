import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const Root = () => {
  return (
    <>
      <h1>content_script sample</h1>
      <p>This is being displayed by chrome-extension content_script</p>
    </>
  );
};

const render = () => {
  const root = document.createElement('div');
  document.body.prepend(root);
  createRoot(root).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
};

render();
