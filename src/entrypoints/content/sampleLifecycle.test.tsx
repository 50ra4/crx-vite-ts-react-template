const reactRoot = vi.hoisted(() => ({
  render: vi.fn(),
  unmount: vi.fn(),
}));

vi.mock('react-dom/client', () => ({
  createRoot: vi.fn(() => reactRoot),
}));

import * as sampleAdapter from './sampleAdapter';
import { startSample } from './sampleLifecycle';

const SAMPLE_HOST_SELECTOR = '[data-crx-content-script-sample]';

describe('startSample', () => {
  let stopSample: (() => void) | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<main>Content</main>';
    reactRoot.render.mockClear();
    reactRoot.unmount.mockClear();
  });

  afterEach(() => {
    stopSample?.();
    stopSample = undefined;
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  test('reconciles within the maximum wait while mutations continue', async () => {
    stopSample = startSample();
    document.querySelector(SAMPLE_HOST_SELECTOR)?.remove();
    await Promise.resolve();

    const activityTimer = window.setInterval(() => {
      document.body.append(document.createElement('span'));
    }, 20);

    await vi.advanceTimersByTimeAsync(999);
    expect(document.querySelectorAll(SAMPLE_HOST_SELECTOR)).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(document.querySelectorAll(SAMPLE_HOST_SELECTOR)).toHaveLength(1);
    window.clearInterval(activityTimer);
  });

  test('replaces an untracked marker-only host with a live Shadow Root', async () => {
    stopSample = startSample();
    const originalHost = document.querySelector(SAMPLE_HOST_SELECTOR);
    const insertionPoint = document.querySelector('main');

    expect(originalHost?.shadowRoot).not.toBeNull();
    if (!insertionPoint) throw new Error('Expected the main fixture element.');
    const replacement = document.createElement('main');
    replacement.innerHTML = insertionPoint.innerHTML;
    insertionPoint.replaceWith(replacement);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(100);

    const hosts = replacement.querySelectorAll(SAMPLE_HOST_SELECTOR);
    expect(hosts).toHaveLength(1);
    expect(hosts[0]).not.toBe(originalHost);
    expect(hosts[0]?.shadowRoot).not.toBeNull();
  });

  test('reconciles when popstate fires without a DOM mutation', async () => {
    const findInsertionPoint = vi.spyOn(
      sampleAdapter,
      'findSampleInsertionPoint',
    );
    stopSample = startSample();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(100);
    findInsertionPoint.mockClear();

    window.history.pushState({}, '', '/next');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.advanceTimersByTimeAsync(100);

    expect(findInsertionPoint).toHaveBeenCalledTimes(1);
  });
});
