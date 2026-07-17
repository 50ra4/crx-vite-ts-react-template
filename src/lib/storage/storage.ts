import { storageSchema, type StorageKey, type StorageValue } from './schema';

const getArea = <Key extends StorageKey>(
  key: Key,
): chrome.storage.StorageArea => {
  return chrome.storage[storageSchema[key].area];
};

export const getStorageValue = async <Key extends StorageKey>(
  key: Key,
): Promise<StorageValue<Key>> => {
  const values = await getArea(key).get({
    [key]: storageSchema[key].defaultValue,
  });
  return values[key] as StorageValue<Key>;
};

export const setStorageValue = async <Key extends StorageKey>(
  key: Key,
  value: StorageValue<Key>,
): Promise<void> => {
  await getArea(key).set({ [key]: value });
};

export const removeStorageValue = async <Key extends StorageKey>(
  key: Key,
): Promise<void> => {
  await getArea(key).remove(key);
};

export const onStorageValueChanged = <Key extends StorageKey>(
  key: Key,
  listener: (value: StorageValue<Key>, oldValue: StorageValue<Key>) => void,
): (() => void) => {
  const onChanged = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: chrome.storage.AreaName,
  ) => {
    if (areaName !== storageSchema[key].area || !(key in changes)) {
      return;
    }

    const change = changes[key];
    listener(
      (change.newValue ?? storageSchema[key].defaultValue) as StorageValue<Key>,
      (change.oldValue ?? storageSchema[key].defaultValue) as StorageValue<Key>,
    );
  };

  chrome.storage.onChanged.addListener(onChanged);

  return () => {
    chrome.storage.onChanged.removeListener(onChanged);
  };
};
