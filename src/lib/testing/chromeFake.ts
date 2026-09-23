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
  executeScriptResult?: ScriptInjectionFixtureResult[];
  extensionId?: string;
  lastFocusedWindowId?: number;
  tabs?: Partial<chrome.tabs.Tab>[];
};

type ScriptInjectionResult = {
  frameId: number;
  result?: unknown;
};

type SerializableResult =
  | null
  | string
  | number
  | boolean
  | SerializableResult[]
  | { [key: string]: SerializableResult };

type ScriptInjectionFixtureResult = {
  frameId: number;
  result?: SerializableResult;
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

const isSerializableResult = (
  value: unknown,
  ancestors = new Set<object>(),
): value is SerializableResult => {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return true;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (typeof value !== 'object' || ancestors.has(value)) {
    return false;
  }

  if (
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  ) {
    return false;
  }

  ancestors.add(value);
  try {
    return Object.values(value).every((item) =>
      isSerializableResult(item, ancestors),
    );
  } finally {
    ancestors.delete(value);
  }
};

const cloneInjectionFixture = (
  results: ScriptInjectionFixtureResult[],
): ScriptInjectionFixtureResult[] => {
  try {
    if (
      !results.every(
        ({ result }) => result === undefined || isSerializableResult(result),
      )
    ) {
      throw new TypeError();
    }
    return structuredClone(results);
  } catch {
    throw new TypeError('executeScriptResult must contain serializable data.');
  }
};

const escapeRegularExpression = (value: string): string =>
  value.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

type ParsedUrlPattern =
  | { allUrls: true }
  | {
      allUrls: false;
      host: string;
      path: string;
      scheme: string;
    };

const parseUrlPattern = (pattern: string): ParsedUrlPattern => {
  if (pattern === '<all_urls>') {
    return { allUrls: true };
  }

  const patternParts =
    /^(http|https|file|chrome-extension|\*):\/\/([^/:]*)(\/.*)$/.exec(pattern);
  if (!patternParts) {
    throw new TypeError(`Invalid Chrome match pattern: ${pattern}`);
  }

  const [, scheme, host, path] = patternParts;
  const hostWildcardIsValid =
    !host.includes('*') || host === '*' || /^\*\.[^*]+$/.test(host);
  const hostIsValid =
    scheme === 'file' ? host === '' : host.length > 0 && hostWildcardIsValid;
  if (!hostIsValid) {
    throw new TypeError(`Invalid Chrome match pattern: ${pattern}`);
  }

  return { allUrls: false, host, path, scheme };
};

const matchesUrlPattern = (url: string, pattern: string): boolean => {
  const parsedPattern = parseUrlPattern(pattern);
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return false;
  }

  if (parsedPattern.allUrls) {
    return ['file:', 'http:', 'https:'].includes(parsedUrl.protocol);
  }

  const scheme = parsedUrl.protocol.slice(0, -1);
  const schemeMatches =
    parsedPattern.scheme === '*'
      ? scheme === 'http' || scheme === 'https'
      : parsedPattern.scheme === scheme;
  if (!schemeMatches) {
    return false;
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const normalizedHostPattern = parsedPattern.host.toLowerCase();
  const hostMatches = normalizedHostPattern.startsWith('*.')
    ? hostname === normalizedHostPattern.slice(2) ||
      hostname.endsWith(`.${normalizedHostPattern.slice(2)}`)
    : normalizedHostPattern === '*' || hostname === normalizedHostPattern;
  if (!hostMatches) {
    return false;
  }

  const pathExpression = escapeRegularExpression(parsedPattern.path).replaceAll(
    '*',
    '.*',
  );
  return new RegExp(`^${pathExpression}$`).test(
    `${parsedUrl.pathname}${parsedUrl.search}`,
  );
};

const supportedTabQueryFilters = new Set([
  'active',
  'currentWindow',
  'lastFocusedWindow',
  'url',
  'windowId',
]);

const assertSupportedTabQuery = (queryInfo: chrome.tabs.QueryInfo): void => {
  for (const [key, value] of Object.entries(queryInfo)) {
    if (value !== undefined && !supportedTabQueryFilters.has(key)) {
      throw new TypeError(`Unsupported chrome.tabs.query filter: ${key}`);
    }
  }

  if (queryInfo.url !== undefined) {
    const patterns = Array.isArray(queryInfo.url)
      ? queryInfo.url
      : [queryInfo.url];
    patterns.forEach(parseUrlPattern);
  }
};

const matchesTabQuery = (
  tab: chrome.tabs.Tab,
  queryInfo: chrome.tabs.QueryInfo,
  currentWindowId: number,
  lastFocusedWindowId: number,
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

  if (
    queryInfo.lastFocusedWindow !== undefined &&
    queryInfo.lastFocusedWindow !== (tab.windowId === lastFocusedWindowId)
  ) {
    return false;
  }

  if (queryInfo.windowId !== undefined) {
    const requestedWindowId =
      queryInfo.windowId === -2 ? currentWindowId : queryInfo.windowId;
    if (tab.windowId !== requestedWindowId) {
      return false;
    }
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

const getTargetTabId = (injection: Record<string, unknown>): number => {
  const target = injection.target;
  if (
    typeof target === 'object' &&
    target !== null &&
    'tabId' in target &&
    typeof target.tabId === 'number' &&
    Number.isInteger(target.tabId)
  ) {
    return target.tabId;
  }

  throw new TypeError(
    'chrome.scripting.executeScript requires a numeric target.tabId.',
  );
};

const assertSingleScriptSource = (injection: Record<string, unknown>): void => {
  const hasFunc = typeof injection.func === 'function';
  const files = injection.files;
  const hasFiles = Array.isArray(files);

  if (hasFunc === hasFiles) {
    throw new TypeError('Exactly one of files and func must be specified.');
  }

  if (hasFiles && files.length === 0) {
    throw new TypeError('At least one file must be specified.');
  }

  if (
    Array.isArray(files) &&
    files.length > 0 &&
    !files.every((file: unknown) => typeof file === 'string')
  ) {
    throw new TypeError(
      'chrome.scripting.executeScript files must contain only strings.',
    );
  }

  if (injection.args !== undefined && !hasFunc) {
    throw new TypeError("Cannot specify 'args' without 'func'.");
  }
};

const createTabs = (
  configuredTabs: Partial<chrome.tabs.Tab>[],
  currentWindowId: number,
): chrome.tabs.Tab[] => {
  const reservedIndexesByWindow = new Map<number, Set<number>>();

  for (const tab of configuredTabs) {
    if (tab.index === undefined) {
      continue;
    }

    const windowId = tab.windowId ?? currentWindowId;
    const reservedIndexes = reservedIndexesByWindow.get(windowId) ?? new Set();
    if (reservedIndexes.has(tab.index)) {
      throw new TypeError(
        `Duplicate tab index ${tab.index} in window ${windowId}.`,
      );
    }
    reservedIndexes.add(tab.index);
    reservedIndexesByWindow.set(windowId, reservedIndexes);
  }

  const nextIndexByWindow = new Map<number, number>();
  return configuredTabs.map((tab) => {
    const windowId = tab.windowId ?? currentWindowId;
    const reservedIndexes = reservedIndexesByWindow.get(windowId) ?? new Set();
    let index = tab.index;
    if (index === undefined) {
      index = nextIndexByWindow.get(windowId) ?? 0;
      while (reservedIndexes.has(index)) {
        index += 1;
      }
      reservedIndexes.add(index);
      nextIndexByWindow.set(windowId, index + 1);
      reservedIndexesByWindow.set(windowId, reservedIndexes);
    }

    return createTab(tab, { active: false, index, windowId });
  });
};

const assertValidTabFixtures = (tabs: chrome.tabs.Tab[]): void => {
  const usedIndexesByWindow = new Map<number, Set<number>>();
  const activeWindowIds = new Set<number>();
  const tabIds = new Set<number>();

  for (const tab of tabs) {
    if (tab.id !== undefined) {
      if (tabIds.has(tab.id)) {
        throw new TypeError(`Duplicate tab id ${tab.id}.`);
      }
      tabIds.add(tab.id);
    }

    if (tab.active) {
      if (activeWindowIds.has(tab.windowId)) {
        throw new TypeError(`Multiple active tabs in window ${tab.windowId}.`);
      }
      activeWindowIds.add(tab.windowId);
    }

    if (!Number.isInteger(tab.index) || tab.index < 0) {
      throw new TypeError(
        `Invalid tab index ${tab.index} in window ${tab.windowId}.`,
      );
    }

    const usedIndexes = usedIndexesByWindow.get(tab.windowId) ?? new Set();
    if (usedIndexes.has(tab.index)) {
      throw new TypeError(
        `Duplicate tab index ${tab.index} in window ${tab.windowId}.`,
      );
    }
    usedIndexes.add(tab.index);
    usedIndexesByWindow.set(tab.windowId, usedIndexes);
  }

  for (const [windowId, usedIndexes] of usedIndexesByWindow) {
    if (!activeWindowIds.has(windowId)) {
      throw new TypeError(`No active tab in window ${windowId}.`);
    }

    for (let index = 0; index < usedIndexes.size; index += 1) {
      if (!usedIndexes.has(index)) {
        throw new TypeError(
          `Tab indexes must be contiguous in window ${windowId}.`,
        );
      }
    }
  }
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
  if (options.activeTab && options.tabs) {
    throw new TypeError('activeTab and tabs cannot be used together.');
  }

  const hasTabFixture =
    options.activeTab !== undefined || options.tabs !== undefined;
  if (options.executeScriptResult !== undefined && !hasTabFixture) {
    throw new TypeError('executeScriptResult requires activeTab or tabs.');
  }
  const scriptResults =
    options.executeScriptResult === undefined
      ? undefined
      : cloneInjectionFixture(options.executeScriptResult);

  const configuredWindowIds = new Set(
    (options.tabs ?? [])
      .map((tab) => tab.windowId)
      .filter((windowId): windowId is number => windowId !== undefined),
  );
  const hasImplicitWindowId = (options.tabs ?? []).some(
    (tab) => tab.windowId === undefined,
  );
  if (
    options.tabs &&
    options.currentWindowId === undefined &&
    configuredWindowIds.size > 1
  ) {
    throw new TypeError(
      'currentWindowId is required for multiple windows in tabs.',
    );
  }
  if (
    options.tabs &&
    options.currentWindowId === undefined &&
    configuredWindowIds.size === 1 &&
    hasImplicitWindowId
  ) {
    throw new TypeError('currentWindowId is required for mixed windowId tabs.');
  }
  const soleConfiguredWindowId =
    configuredWindowIds.size === 1
      ? configuredWindowIds.values().next().value
      : undefined;
  const currentWindowId =
    options.currentWindowId ??
    options.activeTab?.windowId ??
    soleConfiguredWindowId ??
    1;
  const lastFocusedWindowId = options.lastFocusedWindowId ?? currentWindowId;
  const extensionId = options.extensionId ?? 'test-extension-id';
  const tabs = options.tabs
    ? createTabs(options.tabs, currentWindowId)
    : options.activeTab
      ? [
          createTab(options.activeTab, {
            active: true,
            index: 0,
            windowId: currentWindowId,
          }),
        ]
      : [];
  assertValidTabFixtures(tabs);
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
        assertSingleScriptSource(injection);
        const tabId = getTargetTabId(injection);
        if (options.executeScriptError && !hasTabFixture) {
          throw options.executeScriptError;
        }
        if (!tabs.some((tab) => tab.id === tabId)) {
          throw new Error(`No tab with id: ${tabId}.`);
        }

        if (options.executeScriptError) {
          throw options.executeScriptError;
        }

        return structuredClone(scriptResults ?? []);
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
      query: vi.fn(async (queryInfo: chrome.tabs.QueryInfo) => {
        assertSupportedTabQuery(queryInfo);
        return tabs
          .filter((tab) =>
            matchesTabQuery(
              tab,
              queryInfo,
              currentWindowId,
              lastFocusedWindowId,
            ),
          )
          .sort(
            (left, right) =>
              left.windowId - right.windowId || left.index - right.index,
          )
          .map((tab) => structuredClone(tab));
      }),
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
