const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const parseChunks = (png) => {
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

const createChunk = (type, data) => {
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
  const chunk = parseChunks(png).find(
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

  const textChunk = createChunk(
    'tEXt',
    Buffer.concat([
      keywordBuffer,
      Buffer.from([0]),
      Buffer.from(value, 'latin1'),
    ]),
  );
  const chunks = parseChunks(png).filter(
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
