type AppStorageValues = {
  exampleSetting: string;
};

export const storageSchema = {
  exampleSetting: {
    area: 'sync',
    defaultValue: '未設定',
  },
} as const satisfies {
  [Key in keyof AppStorageValues]: {
    area: chrome.storage.AreaName;
    defaultValue: AppStorageValues[Key];
  };
};

export type StorageSchema = typeof storageSchema;
export type StorageKey = keyof StorageSchema;
export type StorageValue<Key extends StorageKey> = AppStorageValues[Key];
export type StorageAreaName<Key extends StorageKey> =
  StorageSchema[Key]['area'];
