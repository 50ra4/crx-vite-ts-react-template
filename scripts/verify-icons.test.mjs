// @vitest-environment node

import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';

import {
  createPngChunk,
  decodeRgbaPng,
  parsePngChunks,
  PNG_SIGNATURE,
  setPngText,
} from './png-metadata.mjs';
import { ICON_FILENAMES, ICON_PROVENANCE_KEY } from './render-icons.mjs';
import { verifyIcons } from './verify-icons.mjs';

const fixtureIconDirectory = fileURLToPath(
  new URL('../public/logo/', import.meta.url),
);
const NORMAL_PROVENANCE = 'a'.repeat(64);
const DEVELOPMENT_PROVENANCE = 'b'.repeat(64);

let repositoryDirectory;
let fixtureIcons;

const recompressPng = (png) => {
  const chunks = parsePngChunks(png);
  const idatData = [];
  for (const chunk of chunks) {
    if (chunk.type === 'IDAT') idatData.push(chunk.data);
  }

  const recompressed = deflateSync(inflateSync(Buffer.concat(idatData)), {
    level: 0,
  });
  let wroteIdat = false;
  return Buffer.concat([
    PNG_SIGNATURE,
    ...chunks.flatMap((chunk) => {
      if (chunk.type !== 'IDAT') return [chunk.raw];
      if (wroteIdat) return [];
      wroteIdat = true;
      return [createPngChunk('IDAT', recompressed)];
    }),
  ]);
};

const encodeRgbaPng = ({ height, pixels, width }) => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const rowLength = width * 4;
  const scanlines = Buffer.alloc((rowLength + 1) * height);
  for (let row = 0; row < height; row += 1) {
    pixels.copy(
      scanlines,
      row * (rowLength + 1) + 1,
      row * rowLength,
      (row + 1) * rowLength,
    );
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    createPngChunk('IHDR', header),
    createPngChunk('IDAT', deflateSync(scanlines)),
    createPngChunk('IEND', Buffer.alloc(0)),
  ]);
};

const writeIcons = async (directory, overrides = {}) => {
  await mkdir(directory, { recursive: true });
  await Promise.all(
    ICON_FILENAMES.map((filename) =>
      writeFile(
        join(directory, filename),
        overrides[filename] ?? fixtureIcons[filename],
      ),
    ),
  );
};

beforeAll(async () => {
  fixtureIcons = Object.fromEntries(
    await Promise.all(
      ICON_FILENAMES.map(async (filename) => [
        filename,
        setPngText(
          await readFile(join(fixtureIconDirectory, filename)),
          ICON_PROVENANCE_KEY,
          filename.includes('-dev')
            ? DEVELOPMENT_PROVENANCE
            : NORMAL_PROVENANCE,
        ),
      ]),
    ),
  );
});

beforeEach(async () => {
  repositoryDirectory = await mkdtemp(join(tmpdir(), 'verify-icons-test-'));
  await writeIcons(join(repositoryDirectory, 'public', 'logo'));
});

afterEach(async () => {
  await rm(repositoryDirectory, { force: true, recursive: true });
});

test('accepts generated icons that byte-match the committed icons', async () => {
  const render = vi.fn(async ({ outputDirectory }) => {
    await writeIcons(outputDirectory);
  });

  await expect(verifyIcons({ render, repositoryDirectory })).resolves.toBe(
    undefined,
  );
  expect(render).toHaveBeenCalledWith({
    outputDirectory: expect.any(String),
    repositoryDirectory,
  });
});

test('accepts matching source hashes when PNG compression differs', async () => {
  const render = vi.fn(async ({ outputDirectory }) => {
    await writeIcons(outputDirectory, {
      'icon16.png': recompressPng(fixtureIcons['icon16.png']),
    });
  });

  await expect(verifyIcons({ render, repositoryDirectory })).resolves.toBe(
    undefined,
  );
});

test('accepts a negligible pixel difference when provenance matches', async () => {
  const image = decodeRgbaPng(fixtureIcons['icon16.png']);
  const pixels = Buffer.from(image.pixels);
  pixels[0] = (pixels[0] + 1) & 0xff;
  const render = vi.fn(async ({ outputDirectory }) => {
    await writeIcons(outputDirectory, {
      'icon16.png': setPngText(
        encodeRgbaPng({ ...image, pixels }),
        ICON_PROVENANCE_KEY,
        NORMAL_PROVENANCE,
      ),
    });
  });

  await expect(verifyIcons({ render, repositoryDirectory })).resolves.toBe(
    undefined,
  );
});

test('rejects another variant pixels even when provenance matches', async () => {
  const render = vi.fn(async ({ outputDirectory }) => {
    await writeIcons(outputDirectory, {
      'icon16.png': setPngText(
        fixtureIcons['icon16-dev.png'],
        ICON_PROVENANCE_KEY,
        NORMAL_PROVENANCE,
      ),
    });
  });

  await expect(verifyIcons({ render, repositoryDirectory })).rejects.toThrow(
    /icon16\.png \(pixel difference /u,
  );
});

test('rejects a dimension mismatch even when provenance matches', async () => {
  const render = vi.fn(async ({ outputDirectory }) => {
    await writeIcons(outputDirectory, {
      'icon16.png': setPngText(
        fixtureIcons['icon48.png'],
        ICON_PROVENANCE_KEY,
        NORMAL_PROVENANCE,
      ),
    });
  });

  await expect(verifyIcons({ render, repositoryDirectory })).rejects.toThrow(
    'icon16.png (dimensions 16x16 != 48x48)',
  );
});

test('reports every drifted icon and the regeneration command', async () => {
  const committedIconDirectory = join(repositoryDirectory, 'public', 'logo');
  const before = await Promise.all(
    ICON_FILENAMES.map((filename) =>
      readFile(join(committedIconDirectory, filename)),
    ),
  );
  let generatedIconDirectory;
  const render = vi.fn(async ({ outputDirectory }) => {
    generatedIconDirectory = outputDirectory;
    await writeIcons(outputDirectory, {
      'icon16.png': fixtureIcons['icon16-dev.png'],
      'icon48-dev.png': fixtureIcons['icon48.png'],
    });
  });

  await expect(verifyIcons({ render, repositoryDirectory })).rejects.toThrow(
    /icon16\.png \(provenance mismatch\)[\s\S]*icon48-dev\.png \(provenance mismatch\)/u,
  );
  await expect(stat(generatedIconDirectory)).rejects.toMatchObject({
    code: 'ENOENT',
  });
  await expect(
    Promise.all(
      ICON_FILENAMES.map((filename) =>
        readFile(join(committedIconDirectory, filename)),
      ),
    ),
  ).resolves.toEqual(before);
});

test('reports a missing committed icon as drift', async () => {
  await rm(join(repositoryDirectory, 'public', 'logo', 'icon128.png'));
  const render = vi.fn(async ({ outputDirectory }) => {
    await writeIcons(outputDirectory);
  });

  await expect(verifyIcons({ render, repositoryDirectory })).rejects.toThrow(
    'icon128.png (committed file missing)',
  );
});

test('reports a missing generated icon as a renderer failure', async () => {
  const render = vi.fn(async ({ outputDirectory }) => {
    await writeIcons(outputDirectory);
    await rm(join(outputDirectory, 'icon128.png'));
  });

  await expect(verifyIcons({ render, repositoryDirectory })).rejects.toThrow(
    'Generated icon missing after rendering: icon128.png.',
  );
});

test('reports a corrupt committed PNG with its filename and origin', async () => {
  await writeFile(
    join(repositoryDirectory, 'public', 'logo', 'icon16.png'),
    'not a PNG',
  );
  const render = vi.fn(async ({ outputDirectory }) => {
    await writeIcons(outputDirectory);
  });

  await expect(verifyIcons({ render, repositoryDirectory })).rejects.toThrow(
    'Cannot inspect committed icon icon16.png: Invalid PNG signature.',
  );
});

test('reports a corrupt generated PNG with its filename and origin', async () => {
  const render = vi.fn(async ({ outputDirectory }) => {
    await writeIcons(outputDirectory);
    await writeFile(join(outputDirectory, 'icon16.png'), 'not a PNG');
  });

  await expect(verifyIcons({ render, repositoryDirectory })).rejects.toThrow(
    'Cannot inspect generated icon icon16.png: Invalid PNG signature.',
  );
});
