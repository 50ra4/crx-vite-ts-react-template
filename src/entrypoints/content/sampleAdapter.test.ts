import { findSampleInsertionPoint } from './sampleAdapter';

describe('findSampleInsertionPoint', () => {
  test('finds the primary main element in a real HTML fixture', () => {
    document.documentElement.innerHTML = `
      <html>
        <body>
          <header>Header</header>
          <main id="primary-content">Content</main>
        </body>
      </html>
    `;

    expect(findSampleInsertionPoint(document)).toBe(
      document.querySelector('#primary-content'),
    );
  });

  test('falls back to the main landmark when the primary selector is absent', () => {
    document.documentElement.innerHTML = `
      <html>
        <body>
          <section role="main" id="fallback-content">Content</section>
        </body>
      </html>
    `;

    expect(findSampleInsertionPoint(document)).toBe(
      document.querySelector('#fallback-content'),
    );
  });

  test('returns null while the host page has no supported insertion point', () => {
    document.documentElement.innerHTML =
      '<html><body><div>Loading...</div></body></html>';

    expect(findSampleInsertionPoint(document)).toBeNull();
  });
});
