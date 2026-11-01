#!/usr/bin/env node
/**
 * Build a deterministic Chrome Web Store ZIP with only runtime files.
 * Uses the ZIP store format (no compression) and Node built-ins only.
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

if (manifest.version !== pkg.version) {
  console.error(
    `Version mismatch: manifest.json=${manifest.version}, package.json=${pkg.version}`,
  );
  process.exit(1);
}

const files = [
  'manifest.json',
  'background.js',
  'fetch-retry.js',
  'parser.js',
  'forum-parser.js',
  'forum-storage.js',
  'forum-indexer.js',
  'indexer.js',
  'offscreen.html',
  'content.js',
  'inline-panel.js',
  'inline-storage.js',
  'inline-ui.js',
  'inline-styles.css',
  'icons/icon16.png',
  'icons/icon32.png',
  'icons/icon48.png',
  'icons/icon128.png',
];

const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error(`Missing files:\n${missing.join('\n')}`);
  process.exit(1);
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc = crcTable[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value, 0);
  return buffer;
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0, 0);
  return buffer;
}

const localParts = [];
const centralParts = [];
let offset = 0;

for (const file of files) {
  const data = fs.readFileSync(path.join(root, file));
  const name = Buffer.from(file, 'utf8');
  const checksum = crc32(data);

  const local = Buffer.concat([
    u32(0x04034b50),
    u16(20),
    u16(0x0800),
    u16(0),
    u16(0),
    u16(0x21),
    u32(checksum),
    u32(data.length),
    u32(data.length),
    u16(name.length),
    u16(0),
    name,
    data,
  ]);

  const central = Buffer.concat([
    u32(0x02014b50),
    u16(20),
    u16(20),
    u16(0x0800),
    u16(0),
    u16(0),
    u16(0x21),
    u32(checksum),
    u32(data.length),
    u32(data.length),
    u16(name.length),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    u32(0),
    u32(offset),
    name,
  ]);

  localParts.push(local);
  centralParts.push(central);
  offset += local.length;
}

const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
const end = Buffer.concat([
  u32(0x06054b50),
  u16(0),
  u16(0),
  u16(files.length),
  u16(files.length),
  u32(centralSize),
  u32(offset),
  u16(0),
]);

const zip = Buffer.concat([...localParts, ...centralParts, end]);
const outDir = path.join(root, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `laststicker-search-${manifest.version}.zip`);
fs.writeFileSync(outFile, zip);

console.log(`Built ${path.relative(root, outFile)} (${zip.length} bytes, ${files.length} files)`);
