/**
 * @file Intel hex format
 * @see {@link https://en.wikipedia.org/wiki/Intel_HEX}
 * @module intel
 */
'use strict';
const printf = require('printf');

/**
 * Generate one Intel hex record
 * @param   {number} type Record type, 0x00-0xFF
 * @param   {number} addr Address, 0x0000-0xFFFF
 * @param   {Buffer} buf  Containing 0-255 data bytes as appropriate to record type
 * @returns {string}      Complete hex record
 */
const buildRecord = (type, addr = 0, buf = Buffer.alloc(0)) => {
  const summablePart = printf('%02X%04X%02X%s',
    buf.length, addr & 0xFFFF, type & 0xFF, buf.toString('hex').toUpperCase()
  );
  let sum = 0;
  for (let i = 0; i < summablePart.length; i += 2) {
    sum += parseInt(summablePart.slice(i, i + 2), 16);
  }
  return printf(':%s%02X', summablePart, -sum & 0xFF);
};

/**
 * Parse one Intel hex record
 * @param   {string}      record Complete hex record
 * @returns {ParseResult}        { type, addr, buf } like the inputs to buildRecord
 * @throws  If record doesn't match format, incorrect count or checksum
 */
const parseRecord = (record) => {
  const cleanrec = record.trim().toUpperCase();
  // Invalid character, odd digit, too short, not an Intel hex record
  if (!/^:([0-9A-F][0-9A-F]){5,}$/.test(cleanrec)) {
    throw new Error('Invalid record');
  }
  // Byte count covers data
  if ((cleanrec.length - 11) / 2 !== parseInt(cleanrec.slice(1, 3), 16)) {
    throw new Error('Incorrect byte count');
  }
  // Checksum covers byte count, address, record type, data
  let sum = 0;
  for (let i = 1; i < cleanrec.length; i += 2) {
    sum += parseInt(cleanrec.slice(i, i + 2), 16);
  }
  if (sum & 0xFF) {
    throw new Error('Incorrect checksum');
  }

  const type = parseInt(cleanrec.slice(7, 9), 16);
  const addr = parseInt(cleanrec.slice(3, 7), 16);
  const buf = Buffer.from(cleanrec.slice(9, -2), 'hex');
  return { type, addr, buf };
};

module.exports = { buildRecord, parseRecord };
