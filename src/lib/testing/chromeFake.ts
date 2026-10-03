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
  documentId?: string;
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
  documentId?: string;
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
    ...structuredClone(tab),
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
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        if (
          !Object.hasOwn(value, index) ||
          !isSerializableResult(value[index], ancestors)
        ) {
          return false;
        }
      }
      return Object.keys(value).length === value.length;
    }
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
  if (!Array.isArray(results)) {
    throw new TypeError('executeScriptResult must be a dense array.');
  }
  for (let index = 0; index < results.length; index += 1) {
    if (!Object.hasOwn(results, index)) {
      throw new TypeError('executeScriptResult must be a dense array.');
    }
    const entry = results[index];
    if (!entry || !Number.isInteger(entry.frameId) || entry.frameId < 0) {
      throw new TypeError(
        'executeScriptResult frameId must be a non-negative integer.',
      );
    }
    if (
      entry.documentId !== undefined &&
      typeof entry.documentId !== 'string'
    ) {
      throw new TypeError('executeScriptResult documentId must be a string.');
    }
    if (entry.result !== undefined && !isSerializableResult(entry.result)) {
      throw new TypeError(
        'executeScriptResult must contain serializable data.',
      );
    }
  }
  try {
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
      path: { expression: RegExp; directory?: string };
      port: string;
      scheme: string;
    };

// tabs.query uses Chromium URLPattern(SCHEME_ALL), not manifest permissions'
// narrower scheme set. Supported desktop standard schemes require ://; opaque
// schemes use :. Do not accept arbitrary scheme:// patterns: Chromium rejects
// unregistered ones (including urn://). Keep additions browser-tested.
const standardSchemes = new Set([
  '*',
  'http',
  'https',
  'file',
  'ftp',
  'ws',
  'wss',
  'chrome',
  'chrome-extension',
  'chrome-search',
  'chrome-native',
  'chrome-distiller',
  'chrome-untrusted',
  'devtools',
  'isolated-app',
]);
const defaultPorts: Record<string, string> = {
  http: '80',
  https: '443',
  ftp: '21',
  ws: '80',
  wss: '443',
};

const compilePath = (
  path: string,
): { expression: RegExp; directory?: string } => ({
  expression: new RegExp(
    `^${escapeRegularExpression(path).replaceAll('*', '.*')}$`,
  ),
  // Chromium compares its glob-escaped path literally for this exception.
  directory: path.endsWith('/*')
    ? path.slice(0, -2).replaceAll('\\', '\\\\').replaceAll('?', '\\?')
    : undefined,
});

const normalizeHost = (host: string): string => {
  // Use a standard URL scheme to canonicalize IDNs, IPv6, and case equally
  // for Chrome-specific schemes and ordinary web URLs.
  if (/[\s/@?#\\]/.test(host)) throw new TypeError('Invalid host');
  return new URL(`http://${host}/`).hostname.toLowerCase().replace(/\.+$/, '');
};

const parseUrlPattern = (pattern: string): ParsedUrlPattern => {
  if (pattern === '<all_urls>') {
    return { allUrls: true };
  }

  const patternParts = /^([a-z][a-z0-9+.-]*|\*):(.*)$/s.exec(pattern);
  if (!patternParts) {
    throw new TypeError(`Invalid Chrome match pattern: ${pattern}`);
  }

  const [, scheme, remainder] = patternParts;
  try {
    if (
      !remainder ||
      standardSchemes.has(scheme) !== remainder.startsWith('//')
    ) {
      throw new TypeError();
    }
    if (!standardSchemes.has(scheme)) {
      return {
        allUrls: false,
        scheme,
        host: '*',
        port: '*',
        path: compilePath(remainder),
      };
    }

    const authorityAndPath = remainder.slice(2);
    const slash = authorityAndPath.indexOf('/');
    if (scheme === 'file') {
      // Chromium ignores the file host and allows file://* as file:///*.
      const path =
        slash < 0 ? `/${authorityAndPath}` : authorityAndPath.slice(slash);
      return {
        allUrls: false,
        scheme,
        host: '*',
        port: '*',
        path: compilePath(path),
      };
    }
    if (slash < 1) throw new TypeError();
    const authority = authorityAndPath.slice(0, slash);
    const parts = /^(\[[^\]]+\]|[^:]+)(?::(.*))?$/.exec(authority);
    if (!parts) throw new TypeError();
    const [, rawHost, explicitPort] = parts;
    const port = explicitPort ?? '*';
    if (
      port !== '*' &&
      (!Object.hasOwn(defaultPorts, scheme) ||
        !/^\d+$/.test(port) ||
        Number(port) > 65535)
    )
      throw new TypeError();

    let host = rawHost;
    if (host !== '*') {
      const subdomains = host.startsWith('*.');
      const baseHost = subdomains ? host.slice(2) : host;
      if (!baseHost || baseHost.includes('*')) throw new TypeError();
      host = `${subdomains ? '*.' : ''}${normalizeHost(baseHost)}`;
    }
    return {
      allUrls: false,
      host,
      port,
      scheme,
      path: compilePath(authorityAndPath.slice(slash)),
    };
  } catch {
    throw new TypeError(`Invalid Chrome match pattern: ${pattern}`);
  }
};

type ParsedTabUrl = {
  hostname: string;
  path: string;
  port: string | undefined;
  scheme: string;
};

const parseTabUrl = (url: string): ParsedTabUrl | undefined => {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname
      ? normalizeHost(parsedUrl.hostname)
      : '';
    const scheme = parsedUrl.protocol.slice(0, -1);
    const pathname =
      parsedUrl.pathname || (standardSchemes.has(scheme) ? '/' : '');
    // URL.search drops a bare '?'; Chromium PathForRequest preserves it.
    // Only inspect the portion before '#', so a fragment's '?' is not a query.
    const withoutFragment = parsedUrl.href.split('#', 1)[0];
    const queryIndex = withoutFragment.indexOf('?');
    const search = queryIndex < 0 ? '' : withoutFragment.slice(queryIndex);
    return {
      hostname,
      scheme,
      port: parsedUrl.port || defaultPorts[scheme],
      path: `${pathname}${search}`,
    };
  } catch {
    return undefined;
  }
};

const matchesUrlPattern = (
  { hostname, path, port, scheme }: ParsedTabUrl,
  parsedPattern: ParsedUrlPattern,
): boolean => {
  if (parsedPattern.allUrls) {
    return true;
  }

  const schemeMatches =
    parsedPattern.scheme === '*'
      ? scheme === 'http' || scheme === 'https'
      : parsedPattern.scheme === scheme;
  if (!schemeMatches) {
    return false;
  }

  const normalizedHostPattern = parsedPattern.host;
  const hostMatches = normalizedHostPattern.startsWith('*.')
    ? hostname === normalizedHostPattern.slice(2) ||
      hostname.endsWith(`.${normalizedHostPattern.slice(2)}`)
    : normalizedHostPattern === '*' || hostname === normalizedHostPattern;
  if (!hostMatches) {
    return false;
  }

  if (parsedPattern.port !== '*' && parsedPattern.port !== port) {
    return false;
  }
  return (
    path === parsedPattern.path.directory ||
    parsedPattern.path.expression.test(path)
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
};

const matchesTabQuery = (
  tab: chrome.tabs.Tab,
  queryInfo: chrome.tabs.QueryInfo,
  currentWindowId: number,
  lastFocusedWindowId: number,
  urlPatterns: ParsedUrlPattern[] | undefined,
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

  if (urlPatterns !== undefined && urlPatterns.length > 0) {
    const tabUrl = tab.url === undefined ? undefined : parseTabUrl(tab.url);
    if (
      !tabUrl ||
      !urlPatterns.some((pattern) => matchesUrlPattern(tabUrl, pattern))
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
    const unsupported = Object.keys(target).find(
      (key) =>
        key !== 'tabId' &&
        !(
          key === 'allFrames' &&
          'allFrames' in target &&
          target.allFrames === false
        ),
    );
    if (unsupported) {
      throw new TypeError(`Unsupported executeScript target: ${unsupported}.`);
    }
    return target.tabId;
  }

  throw new TypeError(
    'chrome.scripting.executeScript requires a numeric target.tabId.',
  );
};

const assertSingleScriptSource = (injection: Record<string, unknown>): void => {
  if (injection.func !== undefined && typeof injection.func !== 'function') {
    throw new TypeError('executeScript func must be a function.');
  }
  if (injection.files !== undefined && !Array.isArray(injection.files)) {
    throw new TypeError('executeScript files must be an array.');
  }
  const hasFunc = typeof injection.func === 'function';
  const files = injection.files;
  const hasFiles = Array.isArray(files);

  if (hasFunc === hasFiles) {
    throw new TypeError('Exactly one of files and func must be specified.');
  }

  if (hasFiles && files.length === 0) {
    throw new TypeError('At least one file must be specified.');
  }

  if (hasFiles && !files.every((file: unknown) => typeof file === 'string')) {
    throw new TypeError(
      'chrome.scripting.executeScript files must contain only strings.',
    );
  }

  if (injection.args !== undefined && !hasFunc) {
    throw new TypeError("Cannot specify 'args' without 'func'.");
  }
  if (
    injection.args !== undefined &&
    (!Array.isArray(injection.args) || !isSerializableResult(injection.args))
  ) {
    throw new TypeError('executeScript args must contain serializable data.');
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
    if (!Number.isInteger(tab.windowId) || tab.windowId < 0) {
      throw new TypeError(`Invalid tab windowId ${tab.windowId}.`);
    }
    if (tab.id !== undefined) {
      if (!Number.isInteger(tab.id) || tab.id < 0) {
        throw new TypeError(`Invalid tab id ${tab.id}.`);
      }
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
  if (options.activeTab?.active === false) {
    throw new TypeError('activeTab.active must be true or omitted.');
  }
  if (
    options.executeScriptResult !== undefined &&
    options.executeScriptError !== undefined
  ) {
    throw new TypeError(
      'executeScriptResult and executeScriptError cannot be used together.',
    );
  }

  for (const key of ['currentWindowId', 'lastFocusedWindowId'] as const) {
    const value = options[key];
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
      throw new TypeError(`Invalid ${key} ${value}.`);
    }
  }

  const hasTabFixture =
    options.activeTab !== undefined || options.tabs !== undefined;
  const executeScriptError = options.executeScriptError;
  if (options.executeScriptResult !== undefined && !hasTabFixture) {
    throw new TypeError('executeScriptResult requires activeTab or tabs.');
  }
  if (options.executeScriptResult !== undefined && options.tabs?.length === 0) {
    throw new TypeError('executeScriptResult requires at least one tab.');
  }
  const scriptResults =
    options.executeScriptResult === undefined
      ? [{ frameId: 0, result: null }]
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
  if (
    options.executeScriptResult !== undefined &&
    !tabs.some((tab) => tab.id !== undefined)
  ) {
    throw new TypeError('executeScriptResult requires a tab with an id.');
  }
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
        // The owner-approved error-only fixture bypasses tab existence checks.
        const requiresTab = hasTabFixture || !executeScriptError;
        if (requiresTab && !tabs.some((tab) => tab.id === tabId)) {
          throw new Error(`No tab with id: ${tabId}.`);
        }

        if (executeScriptError) {
          throw executeScriptError;
        }

        return structuredClone(scriptResults);
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
        const urlPatterns =
          queryInfo.url === undefined
            ? undefined
            : (Array.isArray(queryInfo.url)
                ? queryInfo.url
                : [queryInfo.url]
              ).map(parseUrlPattern);
        return tabs
          .filter((tab) =>
            matchesTabQuery(
              tab,
              queryInfo,
              currentWindowId,
              lastFocusedWindowId,
              urlPatterns,
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
