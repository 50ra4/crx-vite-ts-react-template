import type { BrowserContext, Page } from '@playwright/test';
import {
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
  await extensionPage.goto(`chrome-extension://${extensionId}/popup.html`);
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
  await extensionPage.goto(`chrome-extension://${extensionId}/popup.html`);
  const { page: targetPage, tabId } = await createTargetTab(
    extensionContext,
    extensionPage,
  );
  await targetPage.goto('https://example.com/injection-contract');
  const results = await extensionPage.evaluate(async (targetTabId) => {
    const values = [];
    for (const kind of ['undefined-property', 'function', 'dom', 'undefined']) {
      // oxlint-disable-next-line no-restricted-globals -- Measure serialization at the browser boundary.
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        func: (value: string) => {
          if (value === 'undefined-property') return { title: undefined, a: 1 };
          if (value === 'function') return () => 1;
          if (value === 'dom') return document.body;
          return undefined;
        },
        args: [kind],
      });
      values.push(result.result);
    }
    return values;
  }, tabId);
  expect(results).toEqual([{ a: 1 }, null, {}, null]);
});
