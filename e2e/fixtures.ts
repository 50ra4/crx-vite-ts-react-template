import { createServer, type Server } from 'node:http';
import { access, cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  chromium,
  expect,
  test as base,
  type BrowserContext,
  type Page,
} from '@playwright/test';

const PRODUCTION_CONTENT_MATCH = 'https://example.com/*';
const E2E_CONTENT_MATCH = 'http://127.0.0.1/*';

type TestFixtures = {
  extensionPage: Page;
};

type WorkerFixtures = {
  extensionContext: BrowserContext;
  extensionId: string;
  testPageUrl: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const replaceContentMatches = (entries: unknown): number => {
  if (!Array.isArray(entries)) return 0;

  let replacementCount = 0;
  for (const entry of entries) {
    if (!isRecord(entry) || !Array.isArray(entry.matches)) continue;

    entry.matches = entry.matches.map((match) => {
      if (match !== PRODUCTION_CONTENT_MATCH) return match;
      replacementCount += 1;
      return E2E_CONTENT_MATCH;
    });
  }

  return replacementCount;
};

const prepareExtension = async (): Promise<{
  extensionPath: string;
  temporaryDirectory: string;
}> => {
  const builtExtensionPath = resolve(process.cwd(), 'extension');
  const builtManifestPath = join(builtExtensionPath, 'manifest.json');

  try {
    await access(builtManifestPath);
  } catch {
    throw new Error(
      'E2E requires extension/manifest.json. Run "npm run build" first.',
    );
  }

  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'crx-e2e-'));
  const extensionPath = join(temporaryDirectory, 'extension');

  try {
    await cp(builtExtensionPath, extensionPath, { recursive: true });

    const manifestPath = join(extensionPath, 'manifest.json');
    const parsedManifest: unknown = JSON.parse(
      await readFile(manifestPath, 'utf8'),
    );
    if (!isRecord(parsedManifest)) {
      throw new Error('Built extension manifest must be an object.');
    }

    if (
      !isRecord(parsedManifest.background) ||
      typeof parsedManifest.background.service_worker !== 'string'
    ) {
      throw new Error('Built extension has no background service worker.');
    }

    const contentScriptMatches = replaceContentMatches(
      parsedManifest.content_scripts,
    );
    if (contentScriptMatches === 0) {
      throw new Error(
        `Built extension has no content script matching ${PRODUCTION_CONTENT_MATCH}.`,
      );
    }

    replaceContentMatches(parsedManifest.web_accessible_resources);
    await writeFile(
      manifestPath,
      `${JSON.stringify(parsedManifest, null, 2)}\n`,
      'utf8',
    );

    return { extensionPath, temporaryDirectory };
  } catch (error: unknown) {
    await rm(temporaryDirectory, { recursive: true, force: true });
    throw error;
  }
};

const closeServer = (server: Server): Promise<void> =>
  new Promise((resolvePromise, rejectPromise) => {
    server.close((error) => {
      if (error) rejectPromise(error);
      else resolvePromise();
    });
    server.closeAllConnections();
  });

export const test = base.extend<TestFixtures, WorkerFixtures>({
  extensionContext: [
    async ({ browserName: _ }, provide) => {
      const { extensionPath, temporaryDirectory } = await prepareExtension();
      let context: BrowserContext | undefined;

      try {
        context = await chromium.launchPersistentContext(
          join(temporaryDirectory, 'user-data'),
          {
            channel: 'chromium',
            headless: true,
            args: [
              `--disable-extensions-except=${extensionPath}`,
              `--load-extension=${extensionPath}`,
            ],
          },
        );
        await provide(context);
      } finally {
        await context?.close();
        await rm(temporaryDirectory, { recursive: true, force: true });
      }
    },
    { scope: 'worker' },
  ],

  extensionId: [
    async ({ extensionContext }, provide) => {
      let serviceWorker = extensionContext
        .serviceWorkers()
        .find((worker) => worker.url().startsWith('chrome-extension://'));

      serviceWorker ??= await extensionContext.waitForEvent('serviceworker', {
        predicate: (worker) => worker.url().startsWith('chrome-extension://'),
      });

      await provide(new URL(serviceWorker.url()).host);
    },
    { scope: 'worker' },
  ],

  testPageUrl: [
    async ({ browserName: _ }, provide) => {
      const server = createServer((_request, response) => {
        response.writeHead(200, {
          Connection: 'close',
          'Content-Type': 'text/html; charset=utf-8',
        });
        response.end(
          '<!doctype html><html><body><main>E2E fixture page</main></body></html>',
        );
      });

      await new Promise<void>((resolvePromise, rejectPromise) => {
        server.once('error', rejectPromise);
        server.listen(0, '127.0.0.1', resolvePromise);
      });

      const address = server.address();
      if (!address || typeof address === 'string') {
        await closeServer(server);
        throw new Error('Failed to resolve the local E2E server address.');
      }

      try {
        await provide(`http://127.0.0.1:${address.port}/`);
      } finally {
        await closeServer(server);
      }
    },
    { scope: 'worker' },
  ],

  extensionPage: async ({ extensionContext }, provide) => {
    const page = await extensionContext.newPage();
    try {
      await provide(page);
    } finally {
      await page.close();
    }
  },
});

export { expect };
