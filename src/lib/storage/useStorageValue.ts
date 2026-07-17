import { useEffect, useState } from 'react';
import {
  getStorageValue,
  onStorageValueChanged,
  setStorageValue,
} from './storage';
import { storageSchema, type StorageKey, type StorageValue } from './schema';

export const useStorageValue = <Key extends StorageKey>(key: Key) => {
  const [value, setValue] = useState<StorageValue<Key>>(
    storageSchema[key].defaultValue,
  );

  useEffect(() => {
    let isMounted = true;

    getStorageValue(key).then((storedValue) => {
      if (isMounted) {
        setValue(storedValue);
      }
    });

    const unsubscribe = onStorageValueChanged(key, (storedValue) => {
      setValue(storedValue);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [key]);

  const updateValue = async (nextValue: StorageValue<Key>): Promise<void> => {
    await setStorageValue(key, nextValue);
  };

  return [value, updateValue] as const;
};
