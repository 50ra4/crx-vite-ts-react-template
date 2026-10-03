import {
  acceptedTabUrlPatterns,
  invalidTabUrlPatterns,
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

test('checks fake URL expectations against real Chromium tabs.query', async ({
  extensionContext,
  extensionPage,
  extensionId,
}) => {
  await extensionPage.goto(`chrome-extension://${extensionId}/popup.html`);
  const targetPage = await extensionContext.newPage();
  await targetPage.route(/^https?:/, (route) =>
    route.fulfill({
      body: '<html><body>Contract fixture</body></html>',
      contentType: 'text/html',
    }),
  );

  for (const { url, pattern, matches } of tabUrlCases) {
    const resolvedUrl = url.replaceAll('EXTENSION_ID', extensionId);
    await targetPage.goto(resolvedUrl);
    const actual = await extensionPage.evaluate(
      async ({ targetUrl, queryPattern }) => {
        // oxlint-disable-next-line no-restricted-globals -- Browser-side oracle for the unit fake's contract.
        const tabs = await chrome.tabs.query({ url: queryPattern });
        return tabs.some((tab) => tab.url === targetUrl);
      },
      {
        targetUrl: targetPage.url(),
        queryPattern: pattern.replaceAll('EXTENSION_ID', extensionId),
      },
    );
    expect(actual, `${pattern} against ${url}`).toBe(matches);
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
  const targetPage = await extensionContext.newPage();
  await targetPage.route('https://example.com/*', (route) =>
    route.fulfill({
      body: '<html><body>Injection fixture</body></html>',
      contentType: 'text/html',
    }),
  );
  await targetPage.goto('https://example.com/injection-contract');
  const results = await extensionPage.evaluate(async () => {
    // oxlint-disable-next-line no-restricted-globals -- This oracle executes in a real extension, not the unit fake.
    const [tab] = await chrome.tabs.query({
      url: 'https://example.com/injection-contract',
    });
    if (tab?.id === undefined) throw new Error('Missing contract tab');
    const values = [];
    for (const kind of ['undefined-property', 'function', 'dom', 'undefined']) {
      // oxlint-disable-next-line no-restricted-globals -- Measure serialization at the browser boundary.
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
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
  });
  expect(results).toEqual([{ a: 1 }, null, {}, null]);
});
