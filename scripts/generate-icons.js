const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    table[i] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const crcVal = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crcVal, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createPng(width, height, drawFn) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8-bit depth
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);
  const ihdrChunk = makeChunk('IHDR', ihdr);

  const raw = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // Filter none
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawFn(x, y, width, height);
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
      raw[offset++] = a;
    }
  }

  const idatChunk = makeChunk('IDAT', zlib.deflateSync(raw));
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.join(__dirname, '../extension/icons');
fs.mkdirSync(iconsDir, { recursive: true });

for (const size of [16, 48, 128]) {
  const png = createPng(size, size, (x, y, w, h) => {
    // Coordinate normalized 0..1
    const nx = (x + 0.5) / w;
    const ny = (y + 0.5) / h;
    const cx = 0.5;
    const cy = 0.5;
    const distCenter = Math.sqrt((nx - cx) ** 2 + (ny - cy) ** 2);

    // Rounded rectangle background (radius ~ 0.22)
    const cornerR = 0.22;
    const dx = Math.max(0, Math.abs(nx - 0.5) - (0.5 - cornerR));
    const dy = Math.max(0, Math.abs(ny - 0.5) - (0.5 - cornerR));
    const distCorner = Math.sqrt(dx * dx + dy * dy);

    if (distCorner > cornerR) {
      return [0, 0, 0, 0]; // Transparent outside rounded box
    }

    // Inside base rounded rectangle: Slate dark (#1e293b)
    let r = 30, g = 41, b = 59, a = 255;

    // Green Playwright accent ring at the border (nx near border)
    const isBorder = (distCorner > cornerR - 0.05) ||
      (nx < 0.06 || nx > 0.94 || ny < 0.06 || ny > 0.94);
    if (isBorder) {
      // Playwright green #2EAD33
      r = 46; g = 173; b = 51;
      return [r, g, b, a];
    }

    // Center recording circle: vibrant red #ef4444
    const recordRadius = 0.26;
    if (distCenter < recordRadius) {
      // Smooth red circle
      r = 239; g = 68; b = 68;
      // White inner ring / dot for 48 and 128
      if (size >= 48 && distCenter < 0.08) {
        r = 255; g = 255; b = 255;
      }
    }

    return [r, g, b, a];
  });

  const dest = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(dest, png);
  console.log(`Generated ${dest} (${size}x${size}, ${png.length} bytes)`);
}
