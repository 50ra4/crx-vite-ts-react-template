import { findSampleInsertionPoint } from './sampleAdapter';

describe('findSampleInsertionPoint', () => {
  test('finds the primary main element in a real HTML fixture', () => {
    document.body.innerHTML = `
      <header>Header</header>
      <main id="primary-content">Content</main>
    `;

    const insertionPoint = findSampleInsertionPoint(document);

    expect(insertionPoint?.tagName).toBe('MAIN');
    expect(insertionPoint?.id).toBe('primary-content');
  });

  test('falls back to the main landmark when the primary selector is absent', () => {
    document.body.innerHTML = `
      <section role="main" id="fallback-content">Content</section>
    `;

    const insertionPoint = findSampleInsertionPoint(document);

    expect(insertionPoint?.tagName).toBe('SECTION');
    expect(insertionPoint?.id).toBe('fallback-content');
  });

  test('falls back to body when the host page has no main landmark', () => {
    document.body.innerHTML = '<div>Example Domain</div>';

    expect(findSampleInsertionPoint(document)).toBe(document.body);
  });
});
