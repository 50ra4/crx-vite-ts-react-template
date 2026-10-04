import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

import { ICON_FILENAMES, renderIcons } from './render-icons.mjs';

const defaultRepositoryDirectory = fileURLToPath(
  new URL('../', import.meta.url),
);
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const paethPredictor = (left, above, upperLeft) => {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) {
    return left;
  }
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
};

const getFilterPredictor = ({ filter, left, above, upperLeft }) => {
  switch (filter) {
    case 0:
      return 0;
    case 1:
      return left;
    case 2:
      return above;
    case 3:
      return Math.floor((left + above) / 2);
    case 4:
      return paethPredictor(left, above, upperLeft);
    default:
      throw new Error(`Unsupported PNG filter: ${filter}.`);
  }
};

const decodeRgbaPng = (png) => {
  if (!png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error('Invalid PNG signature.');
  }

  let header;
  const imageData = [];
  let offset = PNG_SIGNATURE.length;
  while (offset < png.length) {
    if (offset + 12 > png.length) throw new Error('Truncated PNG chunk.');
    const length = png.readUInt32BE(offset);
    const chunkEnd = offset + length + 12;
    if (chunkEnd > png.length) throw new Error('Truncated PNG chunk data.');
    const type = png.subarray(offset + 4, offset + 8).toString('ascii');
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') header = data;
    if (type === 'IDAT') imageData.push(data);
    offset = chunkEnd;
    if (type === 'IEND') break;
  }

  if (header?.length !== 13 || imageData.length === 0) {
    throw new Error('PNG is missing required chunks.');
  }
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const isSupported =
    width > 0 &&
    height > 0 &&
    header[8] === 8 &&
    header[9] === 6 &&
    header[10] === 0 &&
    header[11] === 0 &&
    header[12] === 0;
  if (!isSupported) throw new Error('PNG must be non-interlaced 8-bit RGBA.');

  const bytesPerPixel = 4;
  const rowLength = width * bytesPerPixel;
  const filtered = inflateSync(Buffer.concat(imageData));
  if (filtered.length !== (rowLength + 1) * height) {
    throw new Error('PNG pixel data has an unexpected length.');
  }

  const pixels = Buffer.alloc(rowLength * height);
  for (let row = 0; row < height; row += 1) {
    const filteredRowStart = row * (rowLength + 1);
    const pixelRowStart = row * rowLength;
    const filter = filtered[filteredRowStart];

    for (let column = 0; column < rowLength; column += 1) {
      const encoded = filtered[filteredRowStart + column + 1];
      const pixelOffset = pixelRowStart + column;
      const left = column >= bytesPerPixel ? pixels[pixelOffset - 4] : 0;
      const above = row > 0 ? pixels[pixelOffset - rowLength] : 0;
      const upperLeft =
        row > 0 && column >= bytesPerPixel
          ? pixels[pixelOffset - rowLength - bytesPerPixel]
          : 0;
      const predictor = getFilterPredictor({
        above,
        filter,
        left,
        upperLeft,
      });
      pixels[pixelOffset] = (encoded + predictor) & 0xff;
    }
  }

  return { height, pixels, width };
};

const pngPixelsEqual = (first, second) => {
  const firstImage = decodeRgbaPng(first);
  const secondImage = decodeRgbaPng(second);
  return (
    firstImage.width === secondImage.width &&
    firstImage.height === secondImage.height &&
    firstImage.pixels.equals(secondImage.pixels)
  );
};

const readOptionalFile = async (path) => {
  try {
    return await readFile(path);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
};

export const verifyIcons = async ({
  render = renderIcons,
  repositoryDirectory = defaultRepositoryDirectory,
} = {}) => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'verify-icons-'));
  const generatedIconDirectory = join(temporaryDirectory, 'logo');
  const committedIconDirectory = resolve(repositoryDirectory, 'public', 'logo');

  try {
    await render({
      outputDirectory: generatedIconDirectory,
      repositoryDirectory,
    });

    const driftedIcons = [];
    for (const filename of ICON_FILENAMES) {
      const [committed, generated] = await Promise.all([
        readOptionalFile(join(committedIconDirectory, filename)),
        readOptionalFile(join(generatedIconDirectory, filename)),
      ]);
      if (committed === null || generated === null) {
        driftedIcons.push(filename);
        continue;
      }
      if (!committed.equals(generated)) {
        try {
          if (!pngPixelsEqual(committed, generated))
            driftedIcons.push(filename);
        } catch {
          driftedIcons.push(filename);
        }
      }
    }

    if (driftedIcons.length > 0) {
      throw new Error(
        `Icon PNG drift detected: ${driftedIcons.join(', ')}. ` +
          'Run `npm run render:icons` and commit the regenerated files.',
      );
    }
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
};

const isDirectExecution =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  try {
    await verifyIcons();
    console.log('Icon PNGs match their SVG sources.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
