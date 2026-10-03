import { afterEach, describe, expect, it, vi } from 'vitest';
import { createChromeFake, installChromeFake } from './chromeFake';
import {
  acceptedTabUrlPatterns,
  invalidTabUrlPatterns,
  queryFixtureUrls,
  tabUrlFilterCases,
  tabUrlCases,
} from './chromeFake.contractCases';

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

const executeInTab = async (
  activeTab?: chrome.tabs.Tab,
): Promise<SampleInjectionResult | null> => {
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

// Query only for popup callers; event handlers pass their original tab instead.
const executeInActiveTab = async (): Promise<SampleInjectionResult | null> => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return executeInTab(tab);
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

  it('supports redacted active tab URLs when host access is unavailable', async () => {
    const fake = installChromeFake({ activeTab: { id: 42 } });

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
    const emptyFake = createChromeFake();
    const injectionFake = createChromeFake({
      executeScriptError: injectionError,
    });

    await expect(
      emptyFake.chrome.tabs.query({ active: true, currentWindow: true }),
    ).resolves.toEqual([]);
    await expect(
      injectionFake.chrome.scripting.executeScript({
        target: { tabId: 42 },
        func: () => undefined,
      }),
    ).rejects.toThrow('Injection denied');
  });

  it('requires a tab fixture for configured injection results', () => {
    expect(() =>
      createChromeFake({
        executeScriptResult: [{ frameId: 0, result: { filled: 1 } }],
      }),
    ).toThrow('executeScriptResult requires activeTab or tabs');
  });

  it.each([
    { executeScriptResult: [] },
    { executeScriptResult: [{ frameId: 0, result: null }] },
  ])(
    'rejects competing injection result and error fixtures (%j)',
    ({ executeScriptResult }) => {
      for (const fixture of [
        {},
        { activeTab: { id: 1 } },
        { tabs: [] },
        { tabs: [{ id: 1, active: true }] },
      ]) {
        expect(() =>
          createChromeFake({
            ...fixture,
            executeScriptResult,
            executeScriptError: new Error('denied'),
          }),
        ).toThrow(
          'executeScriptResult and executeScriptError cannot be used together.',
        );
      }
    },
  );

  it('rejects a contradictory activeTab flag without silently overriding it', () => {
    expect(() =>
      createChromeFake({ activeTab: { id: 1, active: false } }),
    ).toThrow('activeTab.active must be true or omitted.');
    expect(() =>
      createChromeFake({ activeTab: { id: 1, active: true } }),
    ).not.toThrow();
    expect(() => createChromeFake({ activeTab: { id: 1 } })).not.toThrow();
  });

  it.each([
    { executeScriptResult: [] },
    { executeScriptResult: [{ frameId: 0, result: null }] },
  ])(
    'rejects configured results with empty tabs (%j)',
    ({ executeScriptResult }) => {
      expect(() => createChromeFake({ tabs: [], executeScriptResult })).toThrow(
        'executeScriptResult requires at least one tab',
      );
    },
  );

  it('keeps the event tab when another window has focus', async () => {
    const fake = installChromeFake({
      currentWindowId: 2,
      tabs: [
        { active: true, id: 42, windowId: 1, url: 'https://example.com/form' },
        { active: true, id: 99, windowId: 2, url: 'https://other.example/' },
      ],
      executeScriptResult: [{ frameId: 0, result: { filled: 1 } }],
    });
    const [eventTab] = await fake.chrome.tabs.query({ windowId: 1 });
    vi.mocked(fake.chrome.tabs.query).mockClear();
    await expect(executeInTab(eventTab)).resolves.toEqual({ filled: 1 });
    expect(fake.chrome.tabs.query).not.toHaveBeenCalled();
    expect(fake.chrome.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({ target: { tabId: 42 } }),
    );
    await expect(executeInTab()).resolves.toBeNull();
  });

  it.each(tabUrlCases)(
    'matches browser URL contract: $pattern against $url',
    async ({ url, pattern, matches }) => {
      const fake = createChromeFake({ activeTab: { id: 1, url } });
      await expect(
        fake.chrome.tabs.query({ url: pattern }),
      ).resolves.toHaveLength(matches ? 1 : 0);
    },
  );

  it.each(tabUrlFilterCases)(
    'matches browser URL collection contract: $name',
    async ({ url, indexes }) => {
      const fake = createChromeFake({
        tabs: queryFixtureUrls.map((tabUrl, index) => ({
          active: index === 0,
          id: index + 1,
          url: tabUrl,
        })),
      });
      const tabs = await fake.chrome.tabs.query({ url });
      expect(tabs.map((tab) => tab.id)).toEqual(
        indexes.map((index) => index + 1),
      );
    },
  );

  // Convenience for handwritten fixtures; real Tab.url values are normalized.
  it.each(['https://example.com', 'chrome://version'])(
    'normalizes handwritten fixture URL %s',
    async (url) => {
      await expect(
        createChromeFake({ activeTab: { id: 1, url } }).chrome.tabs.query({
          url: `${url}/*`,
        }),
      ).resolves.toHaveLength(1);
    },
  );

  it.each(acceptedTabUrlPatterns)(
    'accepts tabs.query pattern %s',
    async (url) => {
      await expect(
        createChromeFake().chrome.tabs.query({ url }),
      ).resolves.toEqual([]);
    },
  );

  it.each(invalidTabUrlPatterns)(
    'rejects invalid pattern even without tabs: %s',
    async (url) => {
      await expect(
        createChromeFake().chrome.tabs.query({ url }),
      ).rejects.toThrow('Invalid Chrome match pattern');
    },
  );

  it.each([
    'ftp://example.com/file',
    'ws://example.com/socket',
    'wss://example.com/socket',
    'urn:example:test',
    'data:text/plain,test',
    'file:///tmp/test',
  ])(
    'matches explicit schemes and all URLs but not a wildcard scheme: %s',
    async (url) => {
      const fake = createChromeFake({ activeTab: { id: 1, url } });
      const pattern = url.startsWith('file:')
        ? 'file:///*'
        : url.slice(0, url.indexOf(':') + 1) +
          (url.includes('://') ? '//*/*' : '*');
      await expect(
        fake.chrome.tabs.query({ url: pattern }),
      ).resolves.toHaveLength(1);
      await expect(
        fake.chrome.tabs.query({ url: '<all_urls>' }),
      ).resolves.toHaveLength(1);
      await expect(fake.chrome.tabs.query({ url: '*://*/*' })).resolves.toEqual(
        [],
      );
    },
  );

  it('validates all patterns before filtering and ignores missing or malformed tab URLs', async () => {
    const fake = createChromeFake({
      tabs: [
        { active: true, id: 1, url: 'https://example.com/' },
        { id: 2, url: 'not a URL' },
        { id: 3 },
      ],
    });
    await expect(
      fake.chrome.tabs.query({ url: ['<all_urls>', 'https://example.com/*'] }),
    ).resolves.toEqual([expect.objectContaining({ id: 1 })]);
    await expect(fake.chrome.tabs.query({ url: [] })).resolves.toHaveLength(3);
    await expect(
      fake.chrome.tabs.query({ active: false, url: [] }),
    ).resolves.toHaveLength(2);
    await expect(
      fake.chrome.tabs.query({
        active: false,
        url: ['<all_urls>', 'https://example.com'],
      }),
    ).rejects.toThrow('Invalid Chrome match pattern');
  });

  it('returns tabs in window and tab-strip order', async () => {
    const fake = createChromeFake({
      currentWindowId: 1,
      tabs: [
        { id: 1, index: 1, windowId: 2 },
        { id: 2, index: 1, windowId: 1 },
        { active: true, id: 3, index: 0, windowId: 2 },
        { active: true, id: 4, index: 0, windowId: 1 },
      ],
    });

    await expect(fake.chrome.tabs.query({})).resolves.toEqual([
      expect.objectContaining({ id: 4, index: 0, windowId: 1 }),
      expect.objectContaining({ id: 2, index: 1, windowId: 1 }),
      expect.objectContaining({ id: 3, index: 0, windowId: 2 }),
      expect.objectContaining({ id: 1, index: 1, windowId: 2 }),
    ]);
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

  it('matches Chrome host wildcards and normalized URL paths', async () => {
    const fake = createChromeFake({
      tabs: [
        { active: true, id: 1, url: 'https://example.com' },
        { id: 2, url: 'https://sub.example.com/form' },
      ],
    });

    await expect(
      fake.chrome.tabs.query({ url: '*://*.example.com/*' }),
    ).resolves.toEqual([
      expect.objectContaining({ id: 1 }),
      expect.objectContaining({ id: 2 }),
    ]);

    const portFake = createChromeFake({
      tabs: [{ active: true, id: 3, url: 'https://example.com:8443/admin' }],
    });
    await expect(
      portFake.chrome.tabs.query({ url: 'https://example.com/*' }),
    ).resolves.toEqual([expect.objectContaining({ id: 3 })]);
    await expect(
      portFake.chrome.tabs.query({ url: 'https://example.com:8443/*' }),
    ).resolves.toEqual([expect.objectContaining({ id: 3 })]);

    const extensionFake = createChromeFake({
      tabs: [
        { active: true, id: 4, url: 'chrome-extension://abcdef/options.html' },
      ],
    });
    await expect(
      extensionFake.chrome.tabs.query({
        url: 'chrome-extension://abcdef/*',
      }),
    ).resolves.toEqual([expect.objectContaining({ id: 4 })]);
  });

  it('ignores malformed tab fixture URLs while matching valid tabs', async () => {
    const fake = createChromeFake({
      tabs: [
        { id: 1, url: 'example.com/form' },
        { active: true, id: 2, url: 'https://ok.example/' },
        { id: 3, url: 'chrome://bad%hostname/' },
      ],
    });

    await expect(
      fake.chrome.tabs.query({ url: 'https://ok.example/*' }),
    ).resolves.toEqual([expect.objectContaining({ id: 2 })]);
    await expect(
      fake.chrome.tabs.query({ url: 'chrome://*/*' }),
    ).resolves.toEqual([]);
  });

  it('rejects malformed Chrome match patterns', async () => {
    const fake = createChromeFake({
      activeTab: { id: 1, url: 'https://example.com/' },
    });

    for (const pattern of [
      'https://example.com',
      'example.com/*',
      'https://exa*.com/*',
    ]) {
      await expect(fake.chrome.tabs.query({ url: pattern })).rejects.toThrow(
        `Invalid Chrome match pattern: ${pattern}`,
      );
    }
  });

  it('filters explicit and last-focused windows and rejects unsupported filters', async () => {
    const fake = createChromeFake({
      currentWindowId: 1,
      lastFocusedWindowId: 2,
      tabs: [
        { active: true, id: 1, windowId: 1 },
        { active: true, id: 2, windowId: 2 },
      ],
    });

    await expect(fake.chrome.tabs.query({ windowId: 2 })).resolves.toEqual([
      expect.objectContaining({ id: 2 }),
    ]);
    await expect(
      fake.chrome.tabs.query({ active: true, lastFocusedWindow: true }),
    ).resolves.toEqual([expect.objectContaining({ id: 2 })]);
    await expect(fake.chrome.tabs.query({ pinned: true })).rejects.toThrow(
      'Unsupported chrome.tabs.query filter: pinned',
    );
  });

  it('returns complete, isolated tab snapshots', async () => {
    const fake = createChromeFake({
      activeTab: {
        id: 42,
        mutedInfo: { muted: false },
        url: 'https://example.com/form',
      },
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
      if (firstResult.mutedInfo) {
        firstResult.mutedInfo.muted = true;
      }
    }

    const [secondResult] = await fake.chrome.tabs.query({ active: true });
    expect(secondResult?.url).toBe('https://example.com/form');
    expect(secondResult?.mutedInfo?.muted).toBe(false);
    expect(secondResult).not.toBe(firstResult);
  });

  it.each(['activeTab', 'tabs'] as const)(
    'snapshots nested input fixtures for %s',
    async (mode) => {
      const tab = { active: true, id: 42, mutedInfo: { muted: false } };
      const fake = createChromeFake(
        mode === 'tabs' ? { tabs: [tab] } : { activeTab: tab },
      );
      tab.mutedInfo.muted = true;
      tab.id = 99;
      await expect(fake.chrome.tabs.query({})).resolves.toEqual([
        expect.objectContaining({ id: 42, mutedInfo: { muted: false } }),
      ]);
    },
  );

  it('does not inject successfully without any fixture', async () => {
    await expect(
      createChromeFake().chrome.scripting.executeScript({
        target: { tabId: 42 },
        func: () => undefined,
      }),
    ).rejects.toThrow('No tab with id: 42');
  });

  it.each<null | Record<string, number>>([null, {}, { a: 1 }])(
    'lets guards reject serialized browser results: %j',
    async (result) => {
      installChromeFake({
        activeTab: { id: 42, url: 'https://example.com/' },
        executeScriptResult: [{ frameId: 0, result }],
      });
      await expect(executeInActiveTab()).resolves.toBeNull();
    },
  );

  it('assigns tab indexes per window and infers a sole current window', async () => {
    const singleWindowFake = createChromeFake({
      tabs: [
        { active: true, id: 1, windowId: 7 },
        { id: 2, windowId: 7 },
      ],
    });

    await expect(
      singleWindowFake.chrome.tabs.query({ currentWindow: true }),
    ).resolves.toEqual([
      expect.objectContaining({ id: 1, index: 0 }),
      expect.objectContaining({ id: 2, index: 1 }),
    ]);
    await expect(
      singleWindowFake.chrome.tabs.query({ windowId: -2 }),
    ).resolves.toHaveLength(2);

    const mixedWindowIdFake = createChromeFake({
      currentWindowId: 7,
      tabs: [{ active: true, id: 1, windowId: 7 }, { id: 2 }],
    });
    await expect(
      mixedWindowIdFake.chrome.tabs.query({ currentWindow: true }),
    ).resolves.toHaveLength(2);

    const multipleWindowsFake = createChromeFake({
      currentWindowId: 1,
      tabs: [
        { active: true, id: 1, windowId: 1 },
        { active: true, id: 2, windowId: 2 },
        { id: 3, windowId: 2 },
      ],
    });
    await expect(multipleWindowsFake.chrome.tabs.query({})).resolves.toEqual([
      expect.objectContaining({ id: 1, index: 0 }),
      expect.objectContaining({ id: 2, index: 0 }),
      expect.objectContaining({ id: 3, index: 1 }),
    ]);

    const explicitIndexFake = createChromeFake({
      tabs: [
        { id: 1, index: 1 },
        { active: true, id: 2 },
      ],
    });
    await expect(explicitIndexFake.chrome.tabs.query({})).resolves.toEqual([
      expect.objectContaining({ id: 2, index: 0 }),
      expect.objectContaining({ id: 1, index: 1 }),
    ]);

    const laterExplicitIndexFake = createChromeFake({
      tabs: [{ id: 1 }, { active: true, id: 2, index: 0 }],
    });
    await expect(laterExplicitIndexFake.chrome.tabs.query({})).resolves.toEqual(
      [
        expect.objectContaining({ id: 2, index: 0 }),
        expect.objectContaining({ id: 1, index: 1 }),
      ],
    );
  });

  it('requires currentWindowId for tabs spanning multiple windows', () => {
    expect(() =>
      createChromeFake({
        tabs: [
          { id: 1, windowId: 2 },
          { id: 2, windowId: 3 },
        ],
      }),
    ).toThrow('currentWindowId is required for multiple windows');

    expect(() =>
      createChromeFake({
        tabs: [
          { active: true, id: 1 },
          { active: true, id: 2, windowId: 2 },
        ],
      }),
    ).toThrow('currentWindowId is required for mixed windowId tabs');
  });

  it('rejects duplicate and negative tab indexes', () => {
    expect(() =>
      createChromeFake({
        tabs: [
          { id: 1, index: 0 },
          { id: 2, index: 0 },
        ],
      }),
    ).toThrow('Duplicate tab index 0 in window 1');
    expect(() => createChromeFake({ tabs: [{ id: 1, index: -5 }] })).toThrow(
      'Invalid tab index -5 in window 1',
    );
  });

  it('rejects gaps in indexes within a window', () => {
    expect(() =>
      createChromeFake({
        tabs: [{ active: true, id: 1, index: 3 }, { id: 2 }],
      }),
    ).toThrow('Tab indexes must be contiguous in window 1');
  });

  it('rejects multiple active tabs in the same window', () => {
    expect(() =>
      createChromeFake({
        tabs: [
          { active: true, id: 1 },
          { active: true, id: 2 },
        ],
      }),
    ).toThrow('Multiple active tabs in window 1');
  });

  it('rejects nonempty windows without an active tab', () => {
    expect(() => createChromeFake({ tabs: [{ id: 1 }] })).toThrow(
      'No active tab in window 1',
    );
    expect(() =>
      createChromeFake({
        currentWindowId: 1,
        tabs: [
          { active: true, id: 1, windowId: 1 },
          { id: 2, windowId: 2 },
        ],
      }),
    ).toThrow('No active tab in window 2');
    expect(() => createChromeFake({ tabs: [] })).not.toThrow();
  });

  it('rejects duplicate tab IDs across windows', () => {
    expect(() =>
      createChromeFake({
        currentWindowId: 1,
        tabs: [
          { id: 7, windowId: 1 },
          { id: 7, windowId: 2 },
        ],
      }),
    ).toThrow('Duplicate tab id 7');
  });

  it('rejects script injection without a numeric target tab ID', async () => {
    const fake = createChromeFake({
      activeTab: { id: 42 },
      executeScriptResult: [{ frameId: 0, result: { filled: 1 } }],
    });

    await expect(
      fake.chrome.scripting.executeScript({
        target: {},
        func: () => undefined,
      }),
    ).rejects.toThrow('target.tabId');
  });

  it('rejects injection into missing tabs and without exactly one script source', async () => {
    const fake = createChromeFake({
      activeTab: { id: 42 },
      executeScriptResult: [{ frameId: 0, result: { filled: 1 } }],
    });
    const func = () => undefined;

    await expect(
      fake.chrome.scripting.executeScript({
        target: { tabId: 0 },
        func,
      }),
    ).rejects.toThrow('No tab with id: 0');
    await expect(
      fake.chrome.scripting.executeScript({
        target: { tabId: -1 },
        func,
      }),
    ).rejects.toThrow('No tab with id: -1');
    await expect(
      fake.chrome.scripting.executeScript({ target: { tabId: 42 } }),
    ).rejects.toThrow('Exactly one of files and func must be specified.');
    await expect(
      fake.chrome.scripting.executeScript({ target: { tabId: 999 } }),
    ).rejects.toThrow('Exactly one of files and func must be specified.');
    await expect(
      fake.chrome.scripting.executeScript({
        target: { tabId: 42 },
        files: ['content.js'],
        func,
      }),
    ).rejects.toThrow('Exactly one of files and func must be specified.');
    await expect(
      fake.chrome.scripting.executeScript({
        target: { tabId: 42 },
        files: ['content.js'],
        args: [1],
      }),
    ).rejects.toThrow("Cannot specify 'args' without 'func'.");
    await expect(
      fake.chrome.scripting.executeScript({
        target: { tabId: 42 },
        files: ['content.js'],
      }),
    ).resolves.toEqual([{ frameId: 0, result: { filled: 1 } }]);
  });

  it('checks explicit tab fixtures before returning a configured injection error', async () => {
    const denied = new Error('Injection denied');
    const activeTabFake = createChromeFake({
      activeTab: { id: 42 },
      executeScriptError: denied,
    });
    const emptyTabsFake = createChromeFake({
      tabs: [],
      executeScriptError: denied,
    });
    const listedTabsFake = createChromeFake({
      tabs: [{ active: true, id: 42 }],
      executeScriptError: denied,
    });
    const injection = (tabId: number) => ({
      target: { tabId },
      func: () => undefined,
    });

    await expect(
      activeTabFake.chrome.scripting.executeScript(injection(999)),
    ).rejects.toThrow('No tab with id: 999');
    await expect(
      activeTabFake.chrome.scripting.executeScript(injection(42)),
    ).rejects.toThrow('Injection denied');
    await expect(
      emptyTabsFake.chrome.scripting.executeScript(injection(42)),
    ).rejects.toThrow('No tab with id: 42');
    await expect(
      listedTabsFake.chrome.scripting.executeScript(injection(999)),
    ).rejects.toThrow('No tab with id: 999');
    await expect(
      listedTabsFake.chrome.scripting.executeScript(injection(42)),
    ).rejects.toThrow('Injection denied');
  });

  it('rejects malformed script files without hiding source conflicts', async () => {
    const fake = createChromeFake({ activeTab: { id: 42 } });
    const func = () => undefined;

    await expect(
      fake.chrome.scripting.executeScript({
        target: { tabId: 42 },
        files: [undefined] as unknown as string[],
        func,
      }),
    ).rejects.toThrow('Exactly one of files and func must be specified.');
    await expect(
      fake.chrome.scripting.executeScript({
        target: { tabId: 42 },
        files: ['content.js', 42] as unknown as string[],
      }),
    ).rejects.toThrow('files must contain only strings');
  });

  it('treats an empty files array as specified and rejects it', async () => {
    const fake = createChromeFake({ activeTab: { id: 42 } });

    await expect(
      fake.chrome.scripting.executeScript({
        target: { tabId: 42 },
        func: () => undefined,
        files: [],
      }),
    ).rejects.toThrow('Exactly one of files and func must be specified.');
    await expect(
      fake.chrome.scripting.executeScript({
        target: { tabId: 42 },
        files: [],
      }),
    ).rejects.toThrow('At least one file must be specified.');
  });

  it('validates script source exclusivity before args', async () => {
    const fake = createChromeFake({ activeTab: { id: 42 } });

    await expect(
      fake.chrome.scripting.executeScript({
        target: { tabId: 42 },
        args: [1],
      }),
    ).rejects.toThrow('Exactly one of files and func must be specified.');
  });

  it('returns isolated script injection results', async () => {
    const fixture = [{ frameId: 0, result: { summary: { filled: 1 } } }];
    const fake = createChromeFake({
      activeTab: { id: 42 },
      executeScriptResult: fixture,
    });
    fixture[0].result.summary.filled = 7;
    const injection = {
      target: { tabId: 42 },
      func: () => undefined,
    };

    const [firstResult] = await fake.chrome.scripting.executeScript(injection);
    if (
      firstResult &&
      typeof firstResult.result === 'object' &&
      firstResult.result !== null &&
      'summary' in firstResult.result &&
      typeof firstResult.result.summary === 'object' &&
      firstResult.result.summary !== null &&
      'filled' in firstResult.result.summary
    ) {
      firstResult.result.summary.filled = 99;
    }

    const [secondResult] = await fake.chrome.scripting.executeScript(injection);
    expect(secondResult?.result).toEqual({ summary: { filled: 1 } });
    expect(secondResult?.result).not.toBe(firstResult?.result);
  });

  it('rejects non-serializable injection results at fixture creation', () => {
    expect(() =>
      createChromeFake({
        activeTab: { id: 42 },
        executeScriptResult: [
          {
            frameId: 0,
            // @ts-expect-error functions cannot be serialized as injection results
            result: () => 1,
          },
        ],
      }),
    ).toThrow('executeScriptResult must contain serializable data');
  });

  it('rejects ambiguous activeTab and tabs options', () => {
    expect(() =>
      createChromeFake({
        activeTab: { id: 42, windowId: 3 },
        tabs: [{ id: 1, windowId: 3 }],
      }),
    ).toThrow('activeTab and tabs cannot be used together');
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
