const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');
const adler32 = require('adler-32');

const HEADER_LENGTH = 53;
const ZLIB_HEADER = Buffer.from([0x78, 0x9c]);
const CHUNK_SIZE = 1024 * 1024; // 1 MB

function computeMD5(buf) {
  return crypto.createHash('md5').update(buf).digest('hex');
}

function decodeFile(filePath) {
  const content = fs.readFileSync(filePath);
  console.log(`MD5 original: ${computeMD5(content.slice(HEADER_LENGTH))}`);

  let offset = HEADER_LENGTH;
  const chunks = [];

  while (offset < content.length) {
    const uncmpSize = content.readUInt32LE(offset);
    const cmpSize   = content.readUInt32LE(offset + 4);
    const start     = offset + 8;
    const block     = content.slice(start, start + cmpSize);

    if (!block.slice(0,2).equals(ZLIB_HEADER)) {
      throw new Error(`ZLIB_HEADER não encontrado em offset ${start}`);
    }

    const raw      = block.slice(2);
    const inflated = zlib.inflateRawSync(raw);
    chunks.push(inflated);
    offset += 8 + cmpSize;
  }

  return { content, decompressed: Buffer.concat(chunks) };
}

function encodeFile(contentBuf, decompressedBuf, outputPath) {
  const parts = [];

  for (let i = 0; i < decompressedBuf.length; i += CHUNK_SIZE) {
    const slice   = decompressedBuf.slice(i, i + CHUNK_SIZE);
    const deflated = zlib.deflateRawSync(slice);

    let sum = adler32.buf(slice) >>> 0;  // Ensure unsigned
    const adler = Buffer.alloc(4);
    adler.writeUInt32BE(sum, 0);

    const block = Buffer.concat([ ZLIB_HEADER, deflated, adler ]);
    const header = Buffer.alloc(8);
    header.writeUInt32LE(slice.length, 0);
    header.writeUInt32LE(block.length, 4);

    parts.push(Buffer.concat([ header, block ]));
  }

  const zlibData = Buffer.concat(parts);
  console.log(`MD5 novo: ${computeMD5(zlibData)}`);

  const header = Buffer.concat([
    contentBuf.slice(0,4),
    int32le(zlibData.length),
    Buffer.alloc(4,0),
    int32le(decompressedBuf.length),
    Buffer.alloc(4,0),
    Buffer.from(computeMD5(zlibData),'utf8'),
    Buffer.from([0x03])
  ]);

  fs.writeFileSync(outputPath, Buffer.concat([ header, zlibData ]));
}

function int32le(n) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(n, 0);
  return buf;
}

module.exports = { decodeFile, encodeFile };
