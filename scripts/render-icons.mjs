import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const ICON_SIZES = [16, 48, 128];
const ICON_VARIANTS = [
  { source: 'icon.svg', suffix: '' },
  { source: 'icon-dev.svg', suffix: '-dev' },
];
const defaultRepositoryDirectory = fileURLToPath(
  new URL('../', import.meta.url),
);

export const renderIcons = async ({
  browserType = chromium,
  repositoryDirectory = defaultRepositoryDirectory,
} = {}) => {
  const sourceDirectory = resolve(repositoryDirectory, 'assets', 'branding');
  const outputDirectory = resolve(repositoryDirectory, 'public', 'logo');
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
          await icon.screenshot({
            path: resolve(outputDirectory, `icon${size}${variant.suffix}.png`),
          });
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
