import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

import { setPngText } from './png-metadata.mjs';

const ICON_SIZES = [16, 48, 128];
const ICON_VARIANTS = [
  { source: 'icon.svg', suffix: '' },
  { source: 'icon-dev.svg', suffix: '-dev' },
];
export const ICON_FILENAMES = ICON_VARIANTS.flatMap(({ suffix }) =>
  ICON_SIZES.map((size) => `icon${size}${suffix}.png`),
);
export const ICON_PROVENANCE_KEY = 'Icon-Provenance-SHA256';
const defaultRepositoryDirectory = fileURLToPath(
  new URL('../', import.meta.url),
);
const rendererSource = await readFile(fileURLToPath(import.meta.url), 'utf8');

const normalizeLineEndings = (value) => value.replaceAll(/\r\n?/gu, '\n');

export const createIconProvenance = ({ rendererSource: source, svg }) =>
  createHash('sha256')
    .update(
      JSON.stringify({
        rendererSource: normalizeLineEndings(source),
        svg: normalizeLineEndings(svg),
      }),
    )
    .digest('hex');

export const renderIcons = async ({
  browserType = chromium,
  repositoryDirectory = defaultRepositoryDirectory,
  outputDirectory = resolve(repositoryDirectory, 'public', 'logo'),
} = {}) => {
  const sourceDirectory = resolve(repositoryDirectory, 'assets', 'branding');
  await mkdir(outputDirectory, { recursive: true });

  const browser = await browserType.launch({
    channel: 'chromium',
    headless: true,
  });

  try {
    for (const variant of ICON_VARIANTS) {
      const svg = await readFile(
        resolve(sourceDirectory, variant.source),
        'utf8',
      );
      const provenance = createIconProvenance({
        rendererSource,
        svg,
      });

      for (const size of ICON_SIZES) {
        const page = await browser.newPage({
          deviceScaleFactor: 1,
          viewport: { height: size, width: size },
        });

        try {
          await page.setContent(svg);
          const icon = page.locator('svg');
          await icon.evaluate((element, dimension) => {
            element.style.display = 'block';
            element.style.height = `${dimension}px`;
            element.style.width = `${dimension}px`;
          }, size);
          const outputPath = resolve(
            outputDirectory,
            `icon${size}${variant.suffix}.png`,
          );
          const png = await icon.screenshot({
            omitBackground: true,
          });
          await writeFile(
            outputPath,
            setPngText(png, ICON_PROVENANCE_KEY, provenance),
          );
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
};

const isDirectExecution =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) await renderIcons();
