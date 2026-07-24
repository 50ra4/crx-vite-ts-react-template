import { createHash } from 'node:crypto';
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

const E2E_EXTENSION_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAnlJy17+s4cRAMFlCbRTU6FAexIDBc+qXqUYu+aYKe6EXMFSFGyzggYn27xShGmpYYgC4lqxt90NRqmc+Vn8rMifwWHVuIdJ+MlpJf3niCXZWvIvaFqsvItXdrxTLFU9BZQYNZOmmgopqD3o6GgF2EqCZE5jjMfAw3iozBU5UT1driPC0pNcxP16GmJF0e6kcOIDZO2JTVyzSlfKlzs6NHj8yFu/8/MEIpW1/ZilcHW8kCPxAMpF66/+p9pJD8ztZ9xmuZaKStmD1oyucYeafbVekBbIhyTqaiZDsdda4urCifMT/lswtcmjPgV9XcMqkBF0Qn7rQEhw5xpkivLR8UwIDAQAB';

type PersistentContextOptions = NonNullable<
  Parameters<typeof chromium.launchPersistentContext>[1]
>;

export type ManifestPatch = {
  remove?: readonly string[];
  set?: Readonly<Record<string, unknown>>;
};

export type ExtensionOptions = {
  contextOptions?: Omit<
    PersistentContextOptions,
    'args' | 'channel' | 'headless'
  >;
  manifest?: ManifestPatch;
};

type TestFixtures = {
  extensionContext: BrowserContext;
  extensionId: string;
  extensionOptions: ExtensionOptions;
  extensionPage: Page;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const patchManifest = (
  manifest: unknown,
  patch: ManifestPatch = {},
): Record<string, unknown> => {
  if (!isRecord(manifest)) {
    throw new Error('Built extension manifest must be an object.');
  }

  const patchedManifest = { ...manifest };
  for (const field of patch.remove ?? []) {
    delete patchedManifest[field];
  }

  return {
    ...patchedManifest,
    ...patch.set,
  };
};

const createExtensionId = (manifestKey: string): string => {
  const hashPrefix = createHash('sha256')
    .update(Buffer.from(manifestKey, 'base64'))
    .digest('hex')
    .slice(0, 32);

  return hashPrefix.replace(/[0-9a-f]/gu, (digit) =>
    String.fromCharCode('a'.charCodeAt(0) + Number.parseInt(digit, 16)),
  );
};

const E2E_EXTENSION_ID = createExtensionId(E2E_EXTENSION_KEY);

const prepareExtension = async (
  manifestPatch: ManifestPatch | undefined,
): Promise<{
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
    const patchedManifest = patchManifest(parsedManifest, manifestPatch);
    patchedManifest.key = E2E_EXTENSION_KEY;

    await writeFile(
      manifestPath,
      `${JSON.stringify(patchedManifest, null, 2)}\n`,
      'utf8',
    );

    return { extensionPath, temporaryDirectory };
  } catch (error: unknown) {
    await rm(temporaryDirectory, { recursive: true, force: true });
    throw error;
  }
};

export const test = base.extend<TestFixtures>({
  extensionOptions: [{}, { option: true }],

  extensionContext: async ({ extensionOptions }, provide) => {
    const { extensionPath, temporaryDirectory } = await prepareExtension(
      extensionOptions.manifest,
    );
    let context: BrowserContext | undefined;

    try {
      context = await chromium.launchPersistentContext(
        join(temporaryDirectory, 'user-data'),
        {
          ...extensionOptions.contextOptions,
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

  extensionId:
    // Playwright requires the fixture dependency argument to use object destructuring.
    // oxlint-disable-next-line no-empty-pattern
    async ({}, provide) => {
      await provide(E2E_EXTENSION_ID);
    },

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
