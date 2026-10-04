import { inflateSync } from 'node:zlib';

export const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export const parsePngChunks = (png) => {
  if (!png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error('Invalid PNG signature.');
  }

  const chunks = [];
  let offset = PNG_SIGNATURE.length;
  while (offset < png.length) {
    if (offset + 12 > png.length) throw new Error('Truncated PNG chunk.');
    const length = png.readUInt32BE(offset);
    const chunkEnd = offset + length + 12;
    if (chunkEnd > png.length) throw new Error('Truncated PNG chunk data.');
    const type = png.subarray(offset + 4, offset + 8).toString('ascii');
    chunks.push({
      data: png.subarray(offset + 8, offset + 8 + length),
      raw: png.subarray(offset, chunkEnd),
      type,
    });
    offset = chunkEnd;
    if (type === 'IEND') break;
  }

  if (chunks.at(-1)?.type !== 'IEND') throw new Error('PNG is missing IEND.');
  return chunks;
};

const crc32 = (data) => {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
};

export const createPngChunk = (type, data) => {
  const typeBuffer = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(
    crc32(Buffer.concat([typeBuffer, data])),
    data.length + 8,
  );
  return chunk;
};

const textKeyword = (chunk) => {
  if (chunk.type !== 'tEXt') return null;
  const separator = chunk.data.indexOf(0);
  return separator === -1
    ? null
    : chunk.data.subarray(0, separator).toString('latin1');
};

export const getPngText = (png, keyword) => {
  const chunk = parsePngChunks(png).find(
    (candidate) => textKeyword(candidate) === keyword,
  );
  if (chunk === undefined) return null;
  const separator = chunk.data.indexOf(0);
  return chunk.data.subarray(separator + 1).toString('latin1');
};

export const setPngText = (png, keyword, value) => {
  const keywordBuffer = Buffer.from(keyword, 'latin1');
  if (
    keywordBuffer.length === 0 ||
    keywordBuffer.length > 79 ||
    keywordBuffer.includes(0)
  ) {
    throw new Error('PNG text keyword must contain 1-79 Latin-1 bytes.');
  }

  const textChunk = createPngChunk(
    'tEXt',
    Buffer.concat([
      keywordBuffer,
      Buffer.from([0]),
      Buffer.from(value, 'latin1'),
    ]),
  );
  const chunks = parsePngChunks(png).filter(
    (chunk) => textKeyword(chunk) !== keyword,
  );
  const endIndex = chunks.findIndex(({ type }) => type === 'IEND');
  return Buffer.concat([
    PNG_SIGNATURE,
    ...chunks.slice(0, endIndex).map(({ raw }) => raw),
    textChunk,
    ...chunks.slice(endIndex).map(({ raw }) => raw),
  ]);
};

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

const filterPredictor = ({ filter, left, above, upperLeft }) => {
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

export const decodeRgbaPng = (png) => {
  const chunks = parsePngChunks(png);
  const header = chunks.find(({ type }) => type === 'IHDR')?.data;
  const imageData = chunks
    .filter(({ type }) => type === 'IDAT')
    .map(({ data }) => data);
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
      const pixelOffset = pixelRowStart + column;
      const left = column >= bytesPerPixel ? pixels[pixelOffset - 4] : 0;
      const above = row > 0 ? pixels[pixelOffset - rowLength] : 0;
      const upperLeft =
        row > 0 && column >= bytesPerPixel
          ? pixels[pixelOffset - rowLength - bytesPerPixel]
          : 0;
      pixels[pixelOffset] =
        (filtered[filteredRowStart + column + 1] +
          filterPredictor({ above, filter, left, upperLeft })) &
        0xff;
    }
  }

  return { height, pixels, width };
};
