// @vitest-environment node

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { renderIcons } from './render-icons.mjs';

const NORMAL_SVG = '<svg data-variant="normal"></svg>';
const DEVELOPMENT_SVG = '<svg data-variant="development"></svg>';

const createFakeBrowserType = ({ failingScreenshot = 0 } = {}) => {
  const pages = [];
  const browser = {
    close: vi.fn(),
    newPage: vi.fn(async (options) => {
      const pageNumber = pages.length + 1;
      const locator = {
        evaluate: vi.fn(async (callback, dimension) => {
          void callback;
          return dimension;
        }),
        screenshot: vi.fn(async ({ path }) => {
          if (pageNumber === failingScreenshot) {
            throw new Error('Screenshot failed');
          }
          await writeFile(path, `icon-${pageNumber}`);
        }),
      };
      const page = {
        close: vi.fn(),
        locator: vi.fn(() => locator),
        setContent: vi.fn(),
      };
      pages.push({ locator, options, page });
      return page;
    }),
  };
  const browserType = {
    launch: vi.fn(async () => browser),
  };

  return { browser, browserType, pages };
};

let repositoryDirectory;

beforeEach(async () => {
  repositoryDirectory = await mkdtemp(join(tmpdir(), 'render-icons-'));
  const sourceDirectory = join(repositoryDirectory, 'assets', 'branding');
  await mkdir(sourceDirectory, { recursive: true });
  await writeFile(join(sourceDirectory, 'icon.svg'), NORMAL_SVG);
  await writeFile(join(sourceDirectory, 'icon-dev.svg'), DEVELOPMENT_SVG);
});

afterEach(async () => {
  await rm(repositoryDirectory, { force: true, recursive: true });
});

test('renders normal and development SVGs at every extension icon size', async () => {
  const { browser, browserType, pages } = createFakeBrowserType();

  await renderIcons({ browserType, repositoryDirectory });

  expect(browserType.launch).toHaveBeenCalledWith({
    channel: 'chromium',
    headless: true,
  });
  expect(pages.map(({ options }) => options)).toEqual([
    { deviceScaleFactor: 1, viewport: { height: 16, width: 16 } },
    { deviceScaleFactor: 1, viewport: { height: 48, width: 48 } },
    { deviceScaleFactor: 1, viewport: { height: 128, width: 128 } },
    { deviceScaleFactor: 1, viewport: { height: 16, width: 16 } },
    { deviceScaleFactor: 1, viewport: { height: 48, width: 48 } },
    { deviceScaleFactor: 1, viewport: { height: 128, width: 128 } },
  ]);
  expect(pages.map(({ page }) => page.setContent.mock.calls[0][0])).toEqual([
    NORMAL_SVG,
    NORMAL_SVG,
    NORMAL_SVG,
    DEVELOPMENT_SVG,
    DEVELOPMENT_SVG,
    DEVELOPMENT_SVG,
  ]);
  expect(pages.map(({ locator }) => locator.evaluate.mock.calls[0][1])).toEqual(
    [16, 48, 128, 16, 48, 128],
  );
  expect(pages.map(({ page }) => page.locator.mock.calls[0][0])).toEqual(
    Array(6).fill('svg'),
  );

  const expectedPaths = [
    'icon16.png',
    'icon48.png',
    'icon128.png',
    'icon16-dev.png',
    'icon48-dev.png',
    'icon128-dev.png',
  ].map((filename) => join(repositoryDirectory, 'public', 'logo', filename));
  expect(
    pages.map(({ locator }) => locator.screenshot.mock.calls[0][0].path),
  ).toEqual(expectedPaths);
  await expect(
    Promise.all(expectedPaths.map((path) => readFile(path, 'utf8'))),
  ).resolves.toEqual([
    'icon-1',
    'icon-2',
    'icon-3',
    'icon-4',
    'icon-5',
    'icon-6',
  ]);
  for (const { page } of pages) {
    expect(page.close).toHaveBeenCalledOnce();
  }
  expect(browser.close).toHaveBeenCalledOnce();
});

test('closes the active page and browser when rendering fails', async () => {
  const { browser, browserType, pages } = createFakeBrowserType({
    failingScreenshot: 2,
  });

  await expect(
    renderIcons({ browserType, repositoryDirectory }),
  ).rejects.toThrow('Screenshot failed');

  expect(pages).toHaveLength(2);
  expect(pages[0].page.close).toHaveBeenCalledOnce();
  expect(pages[1].page.close).toHaveBeenCalledOnce();
  expect(browser.close).toHaveBeenCalledOnce();
});
