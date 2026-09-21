import { afterEach, describe, expect, it, vi } from 'vitest';
import { createChromeFake, installChromeFake } from './chromeFake';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

type SampleInjectionResult = {
  filled: number;
};

const isSampleInjectionResult = (
  value: unknown,
): value is SampleInjectionResult =>
  typeof value === 'object' &&
  value !== null &&
  'filled' in value &&
  typeof value.filled === 'number';

const executeInActiveTab = async (): Promise<SampleInjectionResult | null> => {
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (
    typeof activeTab?.id !== 'number' ||
    !activeTab.url?.startsWith('https://')
  ) {
    return null;
  }

  const [injectionResult] = await chrome.scripting.executeScript({
    target: { tabId: activeTab.id },
    func: (result: SampleInjectionResult) => result,
    args: [{ filled: 1 }],
  });

  return isSampleInjectionResult(injectionResult?.result)
    ? injectionResult.result
    : null;
};

describe('Chrome fake', () => {
  it('supports the activeTab + scripting injection recipe without custom mocks', async () => {
    installChromeFake({
      activeTab: { id: 42, url: 'https://example.com/form' },
      executeScriptResult: [{ frameId: 0, result: { filled: 1 } }],
    });

    await expect(executeInActiveTab()).resolves.toEqual({ filled: 1 });
  });

  it('supports restricted URL checks before script injection', async () => {
    const fake = installChromeFake({
      activeTab: { id: 42, url: 'chrome://settings' },
    });

    await expect(executeInActiveTab()).resolves.toBeNull();
    expect(fake.chrome.scripting.executeScript).not.toHaveBeenCalled();
  });

  it('supports guarding untrusted script injection results', async () => {
    installChromeFake({
      activeTab: { id: 42, url: 'https://example.com/form' },
      executeScriptResult: [{ frameId: 0, result: { filled: 'invalid' } }],
    });

    await expect(executeInActiveTab()).resolves.toBeNull();
  });

  it('returns no active tab by default and can reject script injection', async () => {
    const injectionError = new Error('Injection denied');
    const fake = createChromeFake({ executeScriptError: injectionError });

    await expect(
      fake.chrome.tabs.query({ active: true, currentWindow: true }),
    ).resolves.toEqual([]);
    await expect(
      fake.chrome.scripting.executeScript({ target: { tabId: 42 } }),
    ).rejects.toThrow('Injection denied');
  });

  it('filters tabs by active state, current window, and URL patterns', async () => {
    const fake = createChromeFake({
      currentWindowId: 1,
      tabs: [
        { active: true, id: 1, url: 'https://example.com/form', windowId: 1 },
        { active: true, id: 2, url: 'https://other.example/form', windowId: 2 },
      ],
    });

    await expect(
      fake.chrome.tabs.query({ active: true }),
    ).resolves.toHaveLength(2);
    await expect(fake.chrome.tabs.query({ active: false })).resolves.toEqual(
      [],
    );
    await expect(
      fake.chrome.tabs.query({ active: true, currentWindow: true }),
    ).resolves.toEqual([
      expect.objectContaining({ id: 1, url: 'https://example.com/form' }),
    ]);
    await expect(
      fake.chrome.tabs.query({ url: 'https://example.com/*' }),
    ).resolves.toEqual([
      expect.objectContaining({ id: 1, url: 'https://example.com/form' }),
    ]);
    await expect(
      fake.chrome.tabs.query({ url: 'https://missing.example/*' }),
    ).resolves.toEqual([]);
  });

  it('returns complete, isolated tab snapshots', async () => {
    const fake = createChromeFake({
      activeTab: { id: 42, url: 'https://example.com/form' },
    });

    const [firstResult] = await fake.chrome.tabs.query({ active: true });
    expect(firstResult).toEqual(
      expect.objectContaining({
        active: true,
        autoDiscardable: true,
        discarded: false,
        frozen: false,
        groupId: -1,
        highlighted: true,
        incognito: false,
        index: 0,
        pinned: false,
        selected: true,
        windowId: 1,
      }),
    );

    if (firstResult) {
      firstResult.url = 'https://mutated.example/';
    }

    const [secondResult] = await fake.chrome.tabs.query({ active: true });
    expect(secondResult?.url).toBe('https://example.com/form');
    expect(secondResult).not.toBe(firstResult);
  });

  it('rejects script injection without a numeric target tab ID', async () => {
    const fake = createChromeFake({
      executeScriptResult: [{ frameId: 0, result: { filled: 1 } }],
    });

    await expect(
      fake.chrome.scripting.executeScript({ target: {} }),
    ).rejects.toThrow('target.tabId');
  });

  it('omits missing keys from string and array storage reads', async () => {
    const fake = createChromeFake();
    await fake.chrome.storage.local.set({ present: 'value' });

    await expect(fake.chrome.storage.local.get('missing')).resolves.toEqual({});
    await expect(
      fake.chrome.storage.local.get(['present', 'missing']),
    ).resolves.toEqual({ present: 'value' });
  });

  it('dispatches a runtime message to every registered listener', async () => {
    const fake = createChromeFake();
    const asyncListener = vi.fn((_message, _sender, sendResponse) => {
      queueMicrotask(() => sendResponse('async response'));
      return true;
    });
    const syncListener = vi.fn((_message, _sender, sendResponse) => {
      sendResponse('sync response');
    });
    fake.chrome.runtime.onMessage.addListener(asyncListener);
    fake.chrome.runtime.onMessage.addListener(syncListener);

    await expect(fake.chrome.runtime.sendMessage({})).resolves.toBe(
      'sync response',
    );
    expect(asyncListener).toHaveBeenCalledOnce();
    expect(syncListener).toHaveBeenCalledOnce();
  });

  it('does not emit a storage change when a value remains unchanged', async () => {
    const fake = createChromeFake();
    const listener = vi.fn();
    fake.chrome.storage.onChanged.addListener(listener);
    await fake.chrome.storage.sync.set({ setting: 'same' });
    listener.mockClear();

    await fake.chrome.storage.sync.set({ setting: 'same' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('implements the additional StorageArea methods', async () => {
    const fake = createChromeFake();
    const areas = [
      fake.chrome.storage.local,
      fake.chrome.storage.managed,
      fake.chrome.storage.session,
      fake.chrome.storage.sync,
    ];

    for (const area of areas) {
      expect(area.clear).toBeTypeOf('function');
      expect(area.getBytesInUse).toBeTypeOf('function');
      expect(area.getKeys).toBeTypeOf('function');
      expect(area.setAccessLevel).toBeTypeOf('function');
    }

    await fake.chrome.storage.local.set({ first: 'value', second: 2 });
    await expect(fake.chrome.storage.local.getKeys()).resolves.toEqual([
      'first',
      'second',
    ]);
    await expect(
      fake.chrome.storage.local.getBytesInUse('first'),
    ).resolves.toBeGreaterThan(0);
    await expect(
      fake.chrome.storage.local.getBytesInUse('missing'),
    ).resolves.toBe(0);
    await expect(
      fake.chrome.storage.local.setAccessLevel({
        accessLevel: 'TRUSTED_CONTEXTS',
      }),
    ).resolves.toBeUndefined();

    await fake.chrome.storage.local.clear();
    await expect(fake.chrome.storage.local.get()).resolves.toEqual({});
  });
});
