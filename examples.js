#!/usr/bin/env node
'use strict';
const hextape = require('.');

// Generate Signetics
const buf1 = Buffer.from([
  0x04, 0x55, 0xB0, 0x24, 0xFF, 0xF0, 0x1F, 0x05, 0x04, 0x00,
]);
console.log(hextape.signetics.buildRecord(null, 0x0500, buf1));

// Parse Signetics
const rec2 = ':05000A3C0455B024FFF01F05040030';
console.log(hextape.signetics.parseRecord(rec2));

// Generate Intel
const buf3 = Buffer.from([
  0x61, 0x64, 0x64, 0x72, 0x65, 0x73, 0x73, 0x20, 0x67, 0x61, 0x70,
]);
console.log(hextape.intel.buildRecord(0x00, 0x0010, buf3));

// Parse Intel
const rec4 = ':0B0010006164647265737320676170A7';
console.log(hextape.intel.parseRecord(rec4));

// Generate Motorola
const buf5 = Buffer.from([
  0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x20, 0x77,
  0x6F, 0x72, 0x6C, 0x64, 0x2E, 0x0A, 0x00,
]);
console.log(hextape.motorola.buildRecord(1, 0x0038, buf5));

// Parse Motorola
const rec6 = 'S111003848656C6C6F20776F726C642E0A0042';
console.log(hextape.motorola.parseRecord(rec6));
