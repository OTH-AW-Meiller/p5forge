// Minimal, dependency-free ZIP writer (STORE method, no compression).
// Enough to bundle a handful of small text files into a downloadable archive.

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8");

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toBytes(content) {
  return content instanceof Uint8Array ? content : encoder.encode(String(content));
}

function readUint16(view, offset) {
  return view.getUint16(offset, true);
}

function readUint32(view, offset) {
  return view.getUint32(offset, true);
}

async function inflateRawBytes(bytes) {
  if (typeof DecompressionStream !== "function") {
    throw new Error("Compressed .pdez files are not supported in this browser.");
  }

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

// Minimal ZIP reader for project import (supports STORE and DEFLATE entries).
// Returns: Array<{ name: string, content: Uint8Array }>
export async function readZipEntries(blob) {
  const buffer = await blob.arrayBuffer();
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const entries = [];

  let offset = 0;
  const LOCAL_FILE_HEADER = 0x04034b50;
  const CENTRAL_DIRECTORY_HEADER = 0x02014b50;
  const END_OF_CENTRAL_DIRECTORY = 0x06054b50;

  while (offset + 4 <= view.byteLength) {
    const signature = readUint32(view, offset);

    if (signature === CENTRAL_DIRECTORY_HEADER || signature === END_OF_CENTRAL_DIRECTORY) {
      break;
    }

    if (signature !== LOCAL_FILE_HEADER) {
      // Not a local file header, stop parsing.
      break;
    }

    if (offset + 30 > view.byteLength) {
      throw new Error("Invalid ZIP header.");
    }

    const flags = readUint16(view, offset + 6);
    const compressionMethod = readUint16(view, offset + 8);
    const compressedSize = readUint32(view, offset + 18);
    const uncompressedSize = readUint32(view, offset + 22);
    const fileNameLength = readUint16(view, offset + 26);
    const extraLength = readUint16(view, offset + 28);

    // Data descriptor mode requires central-directory parsing; unsupported here.
    if ((flags & 0x0008) !== 0) {
      throw new Error("ZIP data descriptors are not supported for import.");
    }

    const nameStart = offset + 30;
    const nameEnd = nameStart + fileNameLength;
    const extraEnd = nameEnd + extraLength;
    const dataStart = extraEnd;
    const dataEnd = dataStart + compressedSize;

    if (dataEnd > view.byteLength) {
      throw new Error("Invalid ZIP entry size.");
    }

    const name = decoder.decode(bytes.slice(nameStart, nameEnd));
    const compressedBytes = bytes.slice(dataStart, dataEnd);

    let content;
    if (compressionMethod === 0) {
      content = compressedBytes;
    } else if (compressionMethod === 8) {
      content = await inflateRawBytes(compressedBytes);
    } else {
      throw new Error(`Unsupported ZIP compression method: ${compressionMethod}`);
    }

    if (uncompressedSize !== 0 && content.length !== uncompressedSize) {
      throw new Error(`ZIP entry size mismatch for ${name}`);
    }

    entries.push({ name, content });
    offset = dataEnd;
  }

  return entries;
}

// files: Array<{ name: string, content: string | Uint8Array }>
export function createZipBlob(files) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = toBytes(file.content);
    const crc = crc32(data);
    const size = data.length;

    const local = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true); // local file header signature
    dv.setUint16(4, 20, true); // version needed
    dv.setUint16(6, 0x0800, true); // flags: UTF-8 filename
    dv.setUint16(8, 0, true); // compression: store
    dv.setUint16(10, 0, true); // mod time
    dv.setUint16(12, 0, true); // mod date
    dv.setUint32(14, crc, true);
    dv.setUint32(18, size, true); // compressed size
    dv.setUint32(22, size, true); // uncompressed size
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true); // extra length
    local.set(nameBytes, 30);

    chunks.push(local, data);

    const cd = new Uint8Array(46 + nameBytes.length);
    const cdv = new DataView(cd.buffer);
    cdv.setUint32(0, 0x02014b50, true); // central directory signature
    cdv.setUint16(4, 20, true); // version made by
    cdv.setUint16(6, 20, true); // version needed
    cdv.setUint16(8, 0x0800, true); // flags
    cdv.setUint16(10, 0, true); // compression
    cdv.setUint16(12, 0, true); // time
    cdv.setUint16(14, 0, true); // date
    cdv.setUint32(16, crc, true);
    cdv.setUint32(20, size, true);
    cdv.setUint32(24, size, true);
    cdv.setUint16(28, nameBytes.length, true);
    cdv.setUint16(30, 0, true); // extra length
    cdv.setUint16(32, 0, true); // comment length
    cdv.setUint16(34, 0, true); // disk number
    cdv.setUint16(36, 0, true); // internal attrs
    cdv.setUint32(38, 0, true); // external attrs
    cdv.setUint32(42, offset, true); // local header offset
    cd.set(nameBytes, 46);
    central.push(cd);

    offset += local.length + data.length;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const cd of central) {
    chunks.push(cd);
    cdSize += cd.length;
  }

  const end = new Uint8Array(22);
  const edv = new DataView(end.buffer);
  edv.setUint32(0, 0x06054b50, true); // end of central directory signature
  edv.setUint16(4, 0, true); // disk number
  edv.setUint16(6, 0, true); // disk with cd
  edv.setUint16(8, files.length, true); // entries on this disk
  edv.setUint16(10, files.length, true); // total entries
  edv.setUint32(12, cdSize, true);
  edv.setUint32(16, cdOffset, true);
  edv.setUint16(20, 0, true); // comment length
  chunks.push(end);

  return new Blob(chunks, { type: "application/zip" });
}
