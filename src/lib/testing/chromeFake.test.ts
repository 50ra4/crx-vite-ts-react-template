import { afterEach, describe, expect, it, vi } from 'vitest';
import { createChromeFake } from './chromeFake';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Chrome fake', () => {
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
