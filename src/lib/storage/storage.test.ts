import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeFake, type ChromeFake } from '../testing/chromeFake';
import {
  getStorageValue,
  onStorageValueChanged,
  removeStorageValue,
  setStorageValue,
} from './storage';

let chromeFake: ChromeFake;

beforeEach(() => {
  chromeFake = installChromeFake();
});

afterEach(() => {
  vi.unstubAllGlobals();
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

  it('subscribes to typed storage changes for a key', async () => {
    const listener = vi.fn();
    const unsubscribe = onStorageValueChanged('exampleSetting', listener);

    await setStorageValue('exampleSetting', '変更前');
    listener.mockClear();
    await setStorageValue('exampleSetting', '変更後');

    expect(listener).toHaveBeenCalledWith('変更後', '変更前');

    unsubscribe();
    expect(
      chromeFake.chrome.storage.onChanged.removeListener,
    ).toHaveBeenCalledTimes(1);
  });
});
