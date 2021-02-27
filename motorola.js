/**
 * @file Motorola S-records
 * @see {@link https://en.wikipedia.org/wiki/SREC_(file_format)}
 * @module motorola
 */
'use strict';
const printf = require('printf');

/**
 * Generate one Motorola S-record
 * @param   {number} type Record type, 0-3/5-9
 * @param   {number} addr Address, 16/24/32 bits wide as appropriate to record type
 * @param   {Buffer} buf  Containing 0-252 data bytes as appropriate to record type
 * @returns {string}      Complete hex record
 * @throws  If invalid record type
 */
const buildRecord = (type, addr = 0, buf = Buffer.alloc(0)) => {
  let summablePart;
  switch (type) {
    // 16-bit address field
    case 0: // Header
    case 1: // Data
    case 5: // Record count
    case 9: // Exec address
      summablePart = printf('%02X%04X%s',
        buf.length + 3, addr & 0xFFFF, buf.toString('hex').toUpperCase()
      );
      break;

    // 24-bit address field
    case 2: // Data
    case 6: // Record count
    case 8: // Exec address
      summablePart = printf('%02X%06X%s',
        buf.length + 4, addr & 0xFFFFFF, buf.toString('hex').toUpperCase()
      );
      break;

    // 32-bit address field
    case 3: // Data
    case 7: // Exec address
      summablePart = printf('%02X%08X%s',
        buf.length + 5, addr & 0xFFFFFFFF, buf.toString('hex').toUpperCase()
      );
      break;

    default:
      throw new Error(`S${type} record not implemented`);
  }

  let sum = 0;
  for (let i = 0; i < summablePart.length; i += 2) {
    sum += parseInt(summablePart.slice(i, i + 2), 16);
  }
  return printf('S%1d%s%02X', type, summablePart, ~sum & 0xFF);
};

/**
 * Parse one Motorola S-record
 * @param   {string}      record Complete hex record, short S9 is OK
 * @returns {ParseResult}        { type, addr, buf } like the inputs to buildRecord
 * @throws  If record doesn't match format, incorrect count or checksum
 */
const parseRecord = (record) => {
  const cleanrec = record.trim().toUpperCase();
  // S9 record is sometimes shortened with no exec address
  if (cleanrec === 'S9') { return { type: 9, addr: 0, buf: Buffer.alloc(0) }; }
  // Invalid character, invalid record type, odd digit, too short, not an S-record
  if (!/^S[0-35-9]([0-9A-F][0-9A-F]){4,}$/.test(cleanrec)) {
    throw new Error('Invalid record');
  }
  // Byte count covers address, data, checksum
  if ((cleanrec.length - 4) / 2 !== parseInt(cleanrec.slice(2, 4), 16)) {
    throw new Error('Incorrect byte count');
  }
  // Checksum covers byte count, address, data
  let sum = 0;
  for (let i = 2; i < cleanrec.length; i += 2) {
    sum += parseInt(cleanrec.slice(i, i + 2), 16);
  }
  if (sum & 0xFF !== 0xFF) {
    throw new Error('Incorrect checksum');
  }

  const type = parseInt(cleanrec.slice(1, 2), 10);
  let addr = 0;
  let buf = Buffer.alloc(0);
  switch (type) {
    case 0:
    case 1:
    case 5:
    case 9:
      addr = parseInt(cleanrec.slice(4, 8), 16);
      buf = Buffer.from(cleanrec.slice(8, -2), 'hex');
      break;
    case 2:
    case 6:
    case 8:
      addr = parseInt(cleanrec.slice(4, 10), 16);
      buf = Buffer.from(cleanrec.slice(10, -2), 'hex');
      break;
    case 3:
    case 7:
      addr = parseInt(cleanrec.slice(4, 12), 16);
      buf = Buffer.from(cleanrec.slice(12, -2), 'hex');
      break;
  }
  return { type, addr, buf };
};

module.exports = { buildRecord, parseRecord };