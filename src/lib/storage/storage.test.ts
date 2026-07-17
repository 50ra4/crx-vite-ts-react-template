import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getStorageValue,
  onStorageValueChanged,
  removeStorageValue,
  setStorageValue,
} from './storage';

type StorageListener = Parameters<
  typeof chrome.storage.onChanged.addListener
>[0];

const createStorageArea = () => {
  const store = new Map<string, unknown>();

  return {
    get: vi.fn(
      async (keys?: string | string[] | Record<string, unknown> | null) => {
        if (typeof keys === 'string') {
          return { [keys]: store.get(keys) };
        }

        if (Array.isArray(keys)) {
          return Object.fromEntries(keys.map((key) => [key, store.get(key)]));
        }

        if (keys && typeof keys === 'object') {
          return Object.fromEntries(
            Object.entries(keys).map(([key, defaultValue]) => [
              key,
              store.has(key) ? store.get(key) : defaultValue,
            ]),
          );
        }

        return Object.fromEntries(store);
      },
    ),
    remove: vi.fn(async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        store.delete(key);
      }
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(items)) {
        store.set(key, value);
      }
    }),
  };
};

const listeners = new Set<StorageListener>();

beforeEach(() => {
  const sync = createStorageArea();

  globalThis.chrome = {
    storage: {
      sync,
      local: createStorageArea(),
      managed: createStorageArea(),
      session: createStorageArea(),
      onChanged: {
        addListener: vi.fn((listener: StorageListener) => {
          listeners.add(listener);
        }),
        removeListener: vi.fn((listener: StorageListener) => {
          listeners.delete(listener);
        }),
      },
    },
  } as unknown as typeof chrome;
});

afterEach(() => {
  listeners.clear();
  vi.restoreAllMocks();
});

describe('typed storage', () => {
  it('returns the schema default value when storage has no value', async () => {
    await expect(getStorageValue('exampleSetting')).resolves.toBe('未設定');
  });

  it('sets and gets a typed value', async () => {
    await setStorageValue('exampleSetting', '保存済み');

    await expect(getStorageValue('exampleSetting')).resolves.toBe('保存済み');
  });

  it('removes a value and falls back to the schema default value', async () => {
    await setStorageValue('exampleSetting', '削除予定');
    await removeStorageValue('exampleSetting');

    await expect(getStorageValue('exampleSetting')).resolves.toBe('未設定');
  });

  it('subscribes to typed storage changes for a key', () => {
    const listener = vi.fn();
    const unsubscribe = onStorageValueChanged('exampleSetting', listener);

    for (const storageListener of listeners) {
      storageListener(
        {
          exampleSetting: {
            oldValue: '変更前',
            newValue: '変更後',
          },
        },
        'sync',
      );
    }

    expect(listener).toHaveBeenCalledWith('変更後', '変更前');

    unsubscribe();
    expect(chrome.storage.onChanged.removeListener).toHaveBeenCalledTimes(1);
  });
});
