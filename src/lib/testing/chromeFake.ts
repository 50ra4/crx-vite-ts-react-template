import { vi } from 'vitest';

type RuntimeMessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
) => boolean | undefined | void;
type StorageChangeListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: chrome.storage.AreaName,
) => void;

type ChromeFakeOptions = {
  activeTab?: Partial<chrome.tabs.Tab>;
  currentWindowId?: number;
  executeScriptError?: Error;
  executeScriptResult?: ScriptInjectionResult[];
  extensionId?: string;
  tabs?: Partial<chrome.tabs.Tab>[];
};

type ScriptInjectionResult = {
  frameId: number;
  result?: unknown;
};

export type ChromeFake = {
  chrome: ChromeApiFake;
  setRuntimeSender: (sender: chrome.runtime.MessageSender) => void;
};

type ChromeApiFake = {
  runtime: {
    id: string;
    onMessage: {
      addListener: (listener: RuntimeMessageListener) => void;
      removeListener: (listener: RuntimeMessageListener) => void;
    };
    sendMessage: (message: unknown) => Promise<unknown>;
  };
  scripting: {
    executeScript: (
      injection: Record<string, unknown>,
    ) => Promise<ScriptInjectionResult[]>;
  };
  storage: {
    local: chrome.storage.StorageArea;
    managed: chrome.storage.StorageArea;
    session: chrome.storage.StorageArea;
    sync: chrome.storage.StorageArea;
    onChanged: {
      addListener: (listener: StorageChangeListener) => void;
      removeListener: (listener: StorageChangeListener) => void;
    };
  };
  tabs: {
    query: (queryInfo: chrome.tabs.QueryInfo) => Promise<chrome.tabs.Tab[]>;
  };
};

const createTab = (
  tab: Partial<chrome.tabs.Tab>,
  defaults: { active: boolean; index: number; windowId: number },
): chrome.tabs.Tab => {
  const active = tab.active ?? defaults.active;

  return {
    ...tab,
    active,
    autoDiscardable: tab.autoDiscardable ?? true,
    discarded: tab.discarded ?? false,
    frozen: tab.frozen ?? false,
    groupId: tab.groupId ?? -1,
    highlighted: tab.highlighted ?? active,
    incognito: tab.incognito ?? false,
    index: tab.index ?? defaults.index,
    pinned: tab.pinned ?? false,
    selected: tab.selected ?? active,
    windowId: tab.windowId ?? defaults.windowId,
  };
};

const matchesUrlPattern = (url: string, pattern: string): boolean => {
  if (pattern === '<all_urls>') {
    return /^(?:file|ftp|https?):/.test(url);
  }

  const escapedPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replaceAll('*', '.*');
  return new RegExp(`^${escapedPattern}$`).test(url.split('#')[0] ?? '');
};

const matchesTabQuery = (
  tab: chrome.tabs.Tab,
  queryInfo: chrome.tabs.QueryInfo,
  currentWindowId: number,
): boolean => {
  if (queryInfo.active !== undefined && queryInfo.active !== tab.active) {
    return false;
  }

  if (
    queryInfo.currentWindow !== undefined &&
    queryInfo.currentWindow !== (tab.windowId === currentWindowId)
  ) {
    return false;
  }

  if (queryInfo.url !== undefined) {
    const patterns = Array.isArray(queryInfo.url)
      ? queryInfo.url
      : [queryInfo.url];
    const tabUrl = tab.url;
    if (
      !tabUrl ||
      !patterns.some((pattern) => matchesUrlPattern(tabUrl, pattern))
    ) {
      return false;
    }
  }

  return true;
};

const hasNumericTargetTabId = (injection: Record<string, unknown>): boolean => {
  const target = injection.target;
  return (
    typeof target === 'object' &&
    target !== null &&
    'tabId' in target &&
    typeof target.tabId === 'number' &&
    Number.isInteger(target.tabId)
  );
};

const getStoredValues = (
  store: Map<string, unknown>,
  keys?: string | string[] | Record<string, unknown> | null,
): Record<string, unknown> => {
  if (typeof keys === 'string') {
    return store.has(keys) ? { [keys]: store.get(keys) } : {};
  }

  if (Array.isArray(keys)) {
    return Object.fromEntries(
      keys.filter((key) => store.has(key)).map((key) => [key, store.get(key)]),
    );
  }

  if (keys) {
    return Object.fromEntries(
      Object.entries(keys).map(([key, defaultValue]) => [
        key,
        store.has(key) ? store.get(key) : defaultValue,
      ]),
    );
  }

  return Object.fromEntries(store);
};

const getBytesInUse = (
  store: Map<string, unknown>,
  keys?: string | string[] | null,
): number => {
  const selectedKeys =
    keys == null ? [...store.keys()] : typeof keys === 'string' ? [keys] : keys;
  const encoder = new TextEncoder();

  return selectedKeys.reduce((total, key) => {
    if (!store.has(key)) {
      return total;
    }

    const serializedValue = JSON.stringify(store.get(key)) ?? '';
    return (
      total +
      encoder.encode(key).byteLength +
      encoder.encode(serializedValue).byteLength
    );
  }, 0);
};

const createStorageArea = (
  areaName: chrome.storage.AreaName,
  emitChanges: (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: chrome.storage.AreaName,
  ) => void,
): chrome.storage.StorageArea => {
  const store = new Map<string, unknown>();

  return {
    clear: vi.fn(async () => {
      const changes = Object.fromEntries(
        [...store].map(([key, oldValue]) => [key, { oldValue }]),
      );

      if (store.size === 0) {
        return;
      }

      store.clear();
      emitChanges(changes, areaName);
    }),
    get: vi.fn(async (keys) => getStoredValues(store, keys)),
    getBytesInUse: vi.fn(async (keys) => getBytesInUse(store, keys)),
    getKeys: vi.fn(async () => [...store.keys()]),
    remove: vi.fn(async (keys: string | string[]) => {
      const changes: Record<string, chrome.storage.StorageChange> = {};

      for (const key of Array.isArray(keys) ? keys : [keys]) {
        if (!store.has(key)) {
          continue;
        }

        changes[key] = { oldValue: store.get(key) };
        store.delete(key);
      }

      if (Object.keys(changes).length > 0) {
        emitChanges(changes, areaName);
      }
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      const changes: Record<string, chrome.storage.StorageChange> = {};

      for (const [key, value] of Object.entries(items)) {
        const oldValue = store.get(key);
        if (store.has(key) && Object.is(oldValue, value)) {
          continue;
        }

        store.set(key, value);
        changes[key] = { oldValue, newValue: value };
      }

      if (Object.keys(changes).length > 0) {
        emitChanges(changes, areaName);
      }
    }),
    setAccessLevel: vi.fn(async (_accessOptions) => undefined),
  } as unknown as chrome.storage.StorageArea;
};

export const createChromeFake = (
  options: ChromeFakeOptions = {},
): ChromeFake => {
  const currentWindowId =
    options.currentWindowId ?? options.activeTab?.windowId ?? 1;
  const extensionId = options.extensionId ?? 'test-extension-id';
  const tabs = options.tabs
    ? options.tabs.map((tab, index) =>
        createTab(tab, { active: false, index, windowId: currentWindowId }),
      )
    : options.activeTab
      ? [
          createTab(options.activeTab, {
            active: true,
            index: 0,
            windowId: currentWindowId,
          }),
        ]
      : [];
  const runtimeListeners = new Set<RuntimeMessageListener>();
  const storageListeners = new Set<StorageChangeListener>();
  let runtimeSender: chrome.runtime.MessageSender = { id: extensionId };

  const emitStorageChanges = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: chrome.storage.AreaName,
  ) => {
    for (const listener of storageListeners) {
      listener(changes, areaName);
    }
  };

  const chromeFake: ChromeApiFake = {
    runtime: {
      id: extensionId,
      onMessage: {
        addListener: vi.fn((listener: RuntimeMessageListener) => {
          runtimeListeners.add(listener);
        }),
        removeListener: vi.fn((listener: RuntimeMessageListener) => {
          runtimeListeners.delete(listener);
        }),
      },
      sendMessage: vi.fn(
        (message: unknown) =>
          new Promise<unknown>((resolve) => {
            let channelKeptOpen = false;
            let responded = false;
            const sendResponse = (response: unknown) => {
              if (responded) {
                return;
              }

              responded = true;
              resolve(response);
            };

            for (const listener of runtimeListeners) {
              const keepChannelOpen = listener(
                message,
                runtimeSender,
                sendResponse,
              );

              if (keepChannelOpen === true) {
                channelKeptOpen = true;
              }
            }

            if (!responded && !channelKeptOpen) {
              resolve(undefined);
            }
          }),
      ),
    },
    scripting: {
      executeScript: vi.fn(async (injection: Record<string, unknown>) => {
        if (!hasNumericTargetTabId(injection)) {
          throw new TypeError(
            'chrome.scripting.executeScript requires a numeric target.tabId.',
          );
        }

        if (options.executeScriptError) {
          throw options.executeScriptError;
        }

        return (options.executeScriptResult ?? []).map((result) => ({
          ...result,
        }));
      }),
    },
    storage: {
      local: createStorageArea('local', emitStorageChanges),
      managed: createStorageArea('managed', emitStorageChanges),
      session: createStorageArea('session', emitStorageChanges),
      sync: createStorageArea('sync', emitStorageChanges),
      onChanged: {
        addListener: vi.fn((listener: StorageChangeListener) => {
          storageListeners.add(listener);
        }),
        removeListener: vi.fn((listener: StorageChangeListener) => {
          storageListeners.delete(listener);
        }),
      },
    },
    tabs: {
      query: vi.fn(async (queryInfo: chrome.tabs.QueryInfo) =>
        tabs
          .filter((tab) => matchesTabQuery(tab, queryInfo, currentWindowId))
          .map((tab) => ({ ...tab })),
      ),
    },
  };

  return {
    chrome: chromeFake,
    setRuntimeSender: (sender) => {
      runtimeSender = sender;
    },
  };
};

export const installChromeFake = (
  options: ChromeFakeOptions = {},
): ChromeFake => {
  const fake = createChromeFake(options);
  vi.stubGlobal('chrome', fake.chrome);
  return fake;
};
