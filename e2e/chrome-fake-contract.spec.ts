import type { BrowserContext, Page } from '@playwright/test';
import {
  injectionArgumentCases,
  executeArgumentContractCase,
  acceptedTabUrlPatterns,
  invalidTabUrlPatterns,
  queryFixtureUrls,
  tabUrlFilterCases,
  tabUrlCases,
} from '../src/lib/testing/chromeFake.contractCases';
import { expect, test } from './fixtures';

// Permissions belong only to the disposable browser fixture, not the product.
test.use({
  extensionOptions: {
    manifest: {
      set: {
        permissions: ['storage', 'tabs', 'scripting'],
        host_permissions: ['https://example.com/*'],
      },
    },
  },
});

test.afterEach(async ({ extensionPage, extensionId }) => {
  // The oracle must work even when every product HTML surface is removed.
  expect(extensionPage.url()).toBe(
    `chrome-extension://${extensionId}/manifest.json`,
  );
});

const createTargetTab = async (
  context: BrowserContext,
  extensionPage: Page,
): Promise<{ page: Page; tabId: number }> => {
  const [page, tabId] = await Promise.all([
    context.waitForEvent('page'),
    extensionPage.evaluate(async () => {
      // oxlint-disable-next-line no-restricted-globals -- Obtain identity from creation, never from a possibly duplicated URL.
      const tab = await chrome.tabs.create({
        url: 'about:blank',
        active: false,
      });
      if (tab.id === undefined) throw new Error('Missing created tab ID');
      return tab.id;
    }),
  ]);
  await page.route(/^https?:/, (route) =>
    route.fulfill({
      body: '<html><body>Contract fixture</body></html>',
      contentType: 'text/html',
    }),
  );
  return { page, tabId };
};

test('checks fake URL expectations against real Chromium tabs.query', async ({
  extensionContext,
  extensionPage,
  extensionId,
}) => {
  await extensionPage.goto(`chrome-extension://${extensionId}/manifest.json`);
  const { page: targetPage, tabId } = await createTargetTab(
    extensionContext,
    extensionPage,
  );

  for (const { url, pattern, matches } of tabUrlCases) {
    const resolvedUrl = url.replaceAll('EXTENSION_ID', extensionId);
    await targetPage.goto(resolvedUrl);
    // Both suites consume canonical Tab.url values; fixture shorthand is tested separately.
    const actualUrl = await extensionPage.evaluate(async (id) => {
      // oxlint-disable-next-line no-restricted-globals -- Assert the exact URL of the target tab before querying.
      return (await chrome.tabs.get(id)).url;
    }, tabId);
    expect(actualUrl).toBe(resolvedUrl);
    const actual = await extensionPage.evaluate(
      async ({ targetTabId, queryPattern }) => {
        // oxlint-disable-next-line no-restricted-globals -- Browser-side oracle for the unit fake's contract.
        const tabs = await chrome.tabs.query({ url: queryPattern });
        return tabs.some((tab) => tab.id === targetTabId);
      },
      {
        targetTabId: tabId,
        queryPattern: pattern.replaceAll('EXTENSION_ID', extensionId),
      },
    );
    expect(actual, `${pattern} against ${url}`).toBe(matches);
  }

  const targetIds: number[] = [];
  for (const url of queryFixtureUrls) {
    const target = await createTargetTab(extensionContext, extensionPage);
    await target.page.goto(url);
    targetIds.push(target.tabId);
  }
  for (const { name, url, indexes } of tabUrlFilterCases) {
    const actualIds = await extensionPage.evaluate(
      async ({ queryUrl, ids }) => {
        // oxlint-disable-next-line no-restricted-globals -- Ignore unrelated fixture tabs, but compare every controlled tab by ID.
        const tabs = await chrome.tabs.query(
          queryUrl === undefined ? {} : { url: queryUrl },
        );
        return tabs
          .map((tab) => tab.id)
          .filter((id) => id !== undefined && ids.includes(id));
      },
      { queryUrl: url, ids: targetIds },
    );
    expect(actualIds, name).toEqual(indexes.map((index) => targetIds[index]));
  }

  for (const pattern of [...acceptedTabUrlPatterns, ...invalidTabUrlPatterns]) {
    const accepted = await extensionPage.evaluate(async (url) => {
      try {
        // oxlint-disable-next-line no-restricted-globals -- Verify parsing even when no tab matches.
        await chrome.tabs.query({ url });
        return true;
      } catch {
        return false;
      }
    }, pattern);
    expect(accepted, pattern).toBe(acceptedTabUrlPatterns.includes(pattern));
  }
});

test('documents the serialized values expected by injection result fixtures', async ({
  extensionContext,
  extensionPage,
  extensionId,
}) => {
  await extensionPage.goto(`chrome-extension://${extensionId}/manifest.json`);
  const { page: targetPage, tabId } = await createTargetTab(
    extensionContext,
    extensionPage,
  );
  await targetPage.goto('https://example.com/injection-contract');
  const results = await extensionPage.evaluate(async (targetTabId) => {
    const values = [];
    for (const kind of [
      'undefined-property',
      'function',
      'dom',
      'undefined',
      'sparse',
    ]) {
      // oxlint-disable-next-line no-restricted-globals -- Measure serialization at the browser boundary.
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: targetTabId, allFrames: false },
        func: (value: string) => {
          if (value === 'undefined-property') return { title: undefined, a: 1 };
          if (value === 'function') return () => 1;
          if (value === 'dom') return document.body;
          if (value === 'sparse') {
            const values = [1, 0, 2];
            delete values[1];
            return values;
          }
          return undefined;
        },
        args: [kind],
      });
      values.push({
        result: result.result,
        frameId: result.frameId,
        hasDocumentId: typeof result.documentId === 'string',
      });
    }
    return values;
  }, tabId);
  expect(results).toEqual(
    [{ a: 1 }, null, {}, null, [1, null, 2]].map((result) => ({
      result,
      frameId: 0,
      hasDocumentId: true,
    })),
  );
  const rejections = await extensionPage.evaluate(async (targetTabId) => {
    const cases = [
      { args: [() => 1] },
      { args: [undefined] },
      { target: { tabId: targetTabId, allFrames: true, frameIds: [0] } },
      { target: { tabId: targetTabId, frameIds: [5] } },
    ];
    const errors = [];
    for (const injection of cases) {
      try {
        // oxlint-disable-next-line no-restricted-globals -- Measure rejected injection arguments at the browser boundary.
        await chrome.scripting.executeScript({
          // @ts-expect-error deliberately send a conflicting target to verify runtime rejection
          target: { tabId: targetTabId },
          func: () => undefined,
          ...injection,
        });
        errors.push('unexpected success');
      } catch (error) {
        errors.push(String(error));
      }
    }
    return errors;
  }, tabId);
  expect(rejections[0]).toContain('unserializable');
  expect(rejections[1]).toContain('unserializable');
  expect(rejections[2]).toContain("Cannot specify 'allFrames'");
  expect(rejections[3]).toContain('No frame with id 5');
  for (const contract of injectionArgumentCases) {
    const result = extensionPage.evaluate(executeArgumentContractCase, {
      name: contract.name,
      tabId,
    });
    if (contract.accepted)
      await expect(result).resolves.toEqual(contract.expected);
    else await expect(result).rejects.toThrow('unserializable');
  }
  await extensionPage.evaluate(async (tabId) => {
    for (const value of [null, undefined]) {
      for (const key of ['frameIds', 'documentIds', 'allFrames']) {
        // oxlint-disable-next-line no-restricted-globals -- Verify nullish options through Chromium's binding.
        const call = chrome.scripting.executeScript;
        const [result] = await Reflect.apply(call, undefined, [
          {
            target: { tabId, [key]: value },
            func: () => 7,
            files: value,
            args: value,
          },
        ]);
        if (result.result !== 7)
          throw new Error('Unexpected nullish option result');
      }
      try {
        // oxlint-disable-next-line no-restricted-globals -- A missing file distinguishes accepted bindings from type errors.
        await Reflect.apply(chrome.scripting.executeScript, undefined, [
          {
            target: { tabId },
            files: ['missing-contract.js'],
            func: value,
            args: value,
          },
        ]);
        throw new Error('Missing script unexpectedly loaded');
      } catch (error) {
        if (!String(error).includes('Could not load file')) throw error;
      }
    }
  }, tabId);
  await expect(
    extensionPage.evaluate(async (tabId) => {
      // oxlint-disable-next-line no-restricted-globals -- Probe invalid source types through the real API.
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['a.js'],
        // @ts-expect-error intentionally malformed JavaScript caller
        func: 'x',
      });
    }, tabId),
  ).rejects.toThrow('expected function');
  await expect(
    extensionPage.evaluate(async (tabId) => {
      // oxlint-disable-next-line no-restricted-globals -- Probe invalid source types through the real API.
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => undefined,
        // @ts-expect-error intentionally malformed JavaScript caller
        files: 'a.js',
      });
    }, tabId),
  ).rejects.toThrow('expected array');
});
