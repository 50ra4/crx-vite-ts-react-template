import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';

const PRODUCTION_PAGE_URL = 'https://example.com/e2e-fixture';
const EXTENSION_ORIGIN = 'chrome-extension://';
const E2E_HOST_PERMISSION = 'https://example.com/*';

const extensionPageUrl = (extensionId: string, path: string): string =>
  `${EXTENSION_ORIGIN}${extensionId}/${path}`;

const routeProductionPage = async (page: Page): Promise<void> => {
  await page.route(PRODUCTION_PAGE_URL, async (route) => {
    await route.fulfill({
      body: '<!doctype html><html><body><main>E2E fixture page</main></body></html>',
      contentType: 'text/html; charset=utf-8',
      status: 200,
    });
  });
};

test.describe('default sample configuration', () => {
  test('popup exchanges a typed message with the background', async ({
    extensionId,
    extensionPage,
  }) => {
    await extensionPage.goto(extensionPageUrl(extensionId, 'popup.html'));
    await extensionPage.getByRole('button', { name: 'send message' }).click();

    await expect(extensionPage.getByText('Hello, popup!')).toBeVisible();
  });

  test('content script is injected at its production URL', async ({
    extensionPage,
  }) => {
    await routeProductionPage(extensionPage);
    await extensionPage.goto(PRODUCTION_PAGE_URL);

    await expect(
      extensionPage.getByRole('heading', { name: 'content_script sample' }),
    ).toBeVisible();
  });
});

test.describe('content-only configuration', () => {
  test.use({
    extensionOptions: {
      manifest: {
        remove: ['action', 'background', 'options_ui'],
      },
    },
  });

  test('loads without a background and injects the content script', async ({
    extensionContext,
    extensionPage,
  }) => {
    await routeProductionPage(extensionPage);
    await extensionPage.goto(PRODUCTION_PAGE_URL);

    await expect(
      extensionPage.getByRole('heading', { name: 'content_script sample' }),
    ).toBeVisible();
    expect(
      extensionContext
        .serviceWorkers()
        .filter((worker) => worker.url().startsWith(EXTENSION_ORIGIN)),
    ).toHaveLength(0);
  });
});

test.describe('content and background configuration', () => {
  test.use({
    extensionOptions: {
      contextOptions: {
        timezoneId: 'UTC',
      },
      manifest: {
        remove: ['action', 'options_ui'],
      },
    },
  });

  test('loads both declared surfaces', async ({
    extensionContext,
    extensionId,
    extensionPage,
  }) => {
    await routeProductionPage(extensionPage);
    await extensionPage.goto(PRODUCTION_PAGE_URL);

    await expect(
      extensionPage.getByRole('heading', { name: 'content_script sample' }),
    ).toBeVisible();

    let serviceWorker = extensionContext
      .serviceWorkers()
      .find((worker) => worker.url().startsWith(EXTENSION_ORIGIN));
    serviceWorker ??= await extensionContext.waitForEvent('serviceworker', {
      predicate: (worker) => worker.url().startsWith(EXTENSION_ORIGIN),
    });
    expect(new URL(serviceWorker.url()).host).toBe(extensionId);
  });
});

test.describe('popup and options configuration', () => {
  test.use({
    extensionOptions: {
      manifest: {
        remove: ['background', 'content_scripts'],
        set: {
          host_permissions: [E2E_HOST_PERMISSION],
        },
      },
    },
  });

  test('resolves the extension ID without a background and renders both pages', async ({
    extensionContext,
    extensionId,
    extensionPage,
  }) => {
    await extensionPage.goto(extensionPageUrl(extensionId, 'popup.html'));
    await expect(
      extensionPage.getByRole('heading', { name: 'popup' }),
    ).toBeVisible();

    await extensionPage.goto(extensionPageUrl(extensionId, 'options.html'));
    await expect(
      extensionPage.getByRole('heading', { name: 'Options' }),
    ).toBeVisible();
    expect(
      await extensionPage.evaluate(() => chrome.runtime.getManifest()),
    ).toMatchObject({
      host_permissions: [E2E_HOST_PERMISSION],
    });
    expect(
      extensionContext
        .serviceWorkers()
        .filter((worker) => worker.url().startsWith(EXTENSION_ORIGIN)),
    ).toHaveLength(0);
  });
});
