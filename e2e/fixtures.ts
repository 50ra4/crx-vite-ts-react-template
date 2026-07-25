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

import {
  createExtensionId,
  patchManifest,
  type ManifestPatch,
} from './manifest';

// Test-only RSA public key generated for this fixture. Chrome uses it to assign
// a stable unpacked-extension ID; it is public material and needs no secret key.
const E2E_EXTENSION_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAnlJy17+s4cRAMFlCbRTU6FAexIDBc+qXqUYu+aYKe6EXMFSFGyzggYn27xShGmpYYgC4lqxt90NRqmc+Vn8rMifwWHVuIdJ+MlpJf3niCXZWvIvaFqsvItXdrxTLFU9BZQYNZOmmgopqD3o6GgF2EqCZE5jjMfAw3iozBU5UT1driPC0pNcxP16GmJF0e6kcOIDZO2JTVyzSlfKlzs6NHj8yFu/8/MEIpW1/ZilcHW8kCPxAMpF66/+p9pJD8ztZ9xmuZaKStmD1oyucYeafbVekBbIhyTqaiZDsdda4urCifMT/lswtcmjPgV9XcMqkBF0Qn7rQEhw5xpkivLR8UwIDAQAB';
const DEFAULT_EXTENSION_LOAD_TIMEOUT_MS = 5_000;

type PersistentContextOptions = NonNullable<
  Parameters<typeof chromium.launchPersistentContext>[1]
>;

export type ExtensionOptions = {
  contextOptions?: Omit<
    PersistentContextOptions,
    'args' | 'channel' | 'headless'
  >;
  loadTimeoutMs?: number;
  manifest?: ManifestPatch;
};

type TestFixtures = {
  extensionContext: BrowserContext;
  extensionId: string;
  extensionOptions: ExtensionOptions;
  extensionPage: Page;
};

const E2E_EXTENSION_ID = createExtensionId(E2E_EXTENSION_KEY);

const verifyExtensionLoaded = async (
  context: BrowserContext,
  extensionId: string,
  timeout: number,
): Promise<void> => {
  const probePage = await context.newPage();

  try {
    await expect(async () => {
      const response = await probePage.goto(
        `chrome-extension://${extensionId}/manifest.json`,
      );
      expect(response?.ok()).toBe(true);
    }).toPass({
      intervals: [100, 250, 500],
      timeout,
    });
  } catch (cause: unknown) {
    throw new Error(
      `Extension failed to load (id=${extensionId}). Check extensionOptions.manifest.`,
      { cause },
    );
  } finally {
    await probePage.close();
  }
};

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

  extensionContext: async ({ extensionId, extensionOptions }, provide) => {
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
      await verifyExtensionLoaded(
        context,
        extensionId,
        extensionOptions.loadTimeoutMs ?? DEFAULT_EXTENSION_LOAD_TIMEOUT_MS,
      );
      await provide(context);
    } finally {
      await context?.close();
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  },

  extensionId: E2E_EXTENSION_ID,

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
