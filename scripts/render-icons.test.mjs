// @vitest-environment node

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getPngText } from './png-metadata.mjs';
import {
  createIconProvenance,
  ICON_FILENAMES,
  ICON_PROVENANCE_KEY,
  renderIcons,
} from './render-icons.mjs';

const NORMAL_SVG = '<svg data-variant="normal"></svg>';
const DEVELOPMENT_SVG = '<svg data-variant="development"></svg>';
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const committedIconDirectory = fileURLToPath(
  new URL('../public/logo/', import.meta.url),
);
const pngFixture = await readFile(join(committedIconDirectory, 'icon16.png'));

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
        screenshot: vi.fn(async () => {
          if (pageNumber === failingScreenshot) {
            throw new Error('Screenshot failed');
          }
          return pngFixture;
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

  const expectedPaths = ICON_FILENAMES.map((filename) =>
    join(repositoryDirectory, 'public', 'logo', filename),
  );
  expect(
    pages.map(({ locator }) => locator.screenshot.mock.calls[0][0]),
  ).toEqual(Array(6).fill({ omitBackground: true }));
  const provenances = await Promise.all(
    expectedPaths.map(async (path) =>
      getPngText(await readFile(path), ICON_PROVENANCE_KEY),
    ),
  );
  expect(provenances[0]).toMatch(/^[a-f0-9]{64}$/u);
  expect(provenances.slice(0, 3)).toEqual(Array(3).fill(provenances[0]));
  expect(provenances[3]).not.toBe(provenances[0]);
  expect(provenances.slice(3)).toEqual(Array(3).fill(provenances[3]));
  for (const { page } of pages) {
    expect(page.close).toHaveBeenCalledOnce();
  }
  expect(browser.close).toHaveBeenCalledOnce();
});

test('renders into an explicit output directory', async () => {
  const { browserType } = createFakeBrowserType();
  const outputDirectory = join(repositoryDirectory, 'generated-icons');

  await renderIcons({
    browserType,
    outputDirectory,
    repositoryDirectory,
  });

  const rendered = await readFile(join(outputDirectory, 'icon16.png'));
  expect(getPngText(rendered, ICON_PROVENANCE_KEY)).toMatch(/^[a-f0-9]{64}$/u);
  await expect(
    readFile(join(repositoryDirectory, 'public', 'logo', 'icon16.png')),
  ).rejects.toMatchObject({ code: 'ENOENT' });
});

test('normalizes line endings in provenance inputs', () => {
  const lf = createIconProvenance({
    playwrightVersion: '1.2.3',
    rendererSource: 'const size = 16;\n',
    svg: '<svg>\n</svg>\n',
  });
  const crlf = createIconProvenance({
    playwrightVersion: '1.2.3',
    rendererSource: 'const size = 16;\r\n',
    svg: '<svg>\r\n</svg>\r\n',
  });

  expect(crlf).toBe(lf);
});

test('changes provenance with the renderer implementation or Playwright version', () => {
  const input = {
    playwrightVersion: '1.2.3',
    rendererSource: 'const size = 16;',
    svg: '<svg></svg>',
  };

  expect(
    createIconProvenance({ ...input, rendererSource: 'const size = 48;' }),
  ).not.toBe(createIconProvenance(input));
  expect(
    createIconProvenance({ ...input, playwrightVersion: '1.2.4' }),
  ).not.toBe(createIconProvenance(input));
});

test.each([
  ['icon16.png', 16],
  ['icon48.png', 48],
  ['icon128.png', 128],
  ['icon16-dev.png', 16],
  ['icon48-dev.png', 48],
  ['icon128-dev.png', 128],
])('%s is a square RGBA PNG at its declared size', async (filename, size) => {
  const png = await readFile(join(committedIconDirectory, filename));

  expect(png.subarray(0, PNG_SIGNATURE.length)).toEqual(PNG_SIGNATURE);
  expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
  expect(png.readUInt32BE(16)).toBe(size);
  expect(png.readUInt32BE(20)).toBe(size);
  expect(png[25]).toBe(6);
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
