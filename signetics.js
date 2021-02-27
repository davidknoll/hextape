/**
 * @file Signetics absolute object format
 * @see 2650 microprocessor applications memo SS51
 * @module signetics
 */
'use strict';
const printf = require('printf');

// Update the block control character
const bcc = (sum, data) => {
  sum ^= data;
  sum <<= 1;
  sum |= (sum >> 8) & 1;
  return sum & 0xFF;
};

/**
 * Generate one Signetics hex record
 * @param   {null}   type Not used in Signetics hex
 * @param   {number} addr Address, 0x0000-0xFFFF
 * @param   {Buffer} buf  Containing 0-255 data bytes as appropriate to record type
 * @returns {string}      Complete hex record, short EOF if no data
 */
const buildRecord = (type, addr = 0, buf = Buffer.alloc(0)) => {
  addr &= 0xFFFF;
  // Short EOF record?
  if (!buf.length) { return printf(':%04X00', addr); }

  let asum = 0, dsum = 0;
  asum = bcc(asum, addr >> 8);
  asum = bcc(asum, addr);
  asum = bcc(asum, buf.length);
  for (let i = 0; i < buf.length; i++) { dsum = bcc(dsum, buf[i]); }

  return printf(':%04X%02X%02X%s%02X',
    addr, buf.length, asum,
    buf.toString('hex').toUpperCase(), dsum
  );
};

/**
 * Parse one Signetics hex record
 * @param   {string}      record Complete hex record, short EOF is OK
 * @returns {ParseResult}        { type, addr, buf } like the inputs to buildRecord
 * @throws  If record doesn't match format, incorrect count or either checksum
 */
const parseRecord = (record) => {
  const cleanrec = record.trim().toUpperCase();
  const addr = parseInt(cleanrec.slice(1, 5), 16);
  if (/^:[0-9A-F]{4}00$/.test(cleanrec)) {
    return { type: null, addr, buf: Buffer.alloc(0) };
  }

  if (!/^:([0-9A-F][0-9A-F]){5,}$/.test(cleanrec)) {
    throw new Error('Invalid record');
  }
  if ((cleanrec.length - 11) / 2 !== parseInt(cleanrec.slice(5, 7), 16)) {
    throw new Error('Incorrect byte count');
  }

  const buf = Buffer.from(cleanrec.slice(9, -2), 'hex');

  let asum = 0, dsum = 0;
  asum = bcc(asum, addr >> 8);
  asum = bcc(asum, addr);
  asum = bcc(asum, buf.length);
  for (let i = 0; i < buf.length; i++) { dsum = bcc(dsum, buf[i]); }

  if (
    asum !== parseInt(cleanrec.slice(7, 9), 16) ||
    dsum !== parseInt(cleanrec.slice(-2), 16)
  ) {
    throw new Error('Incorrect checksum');
  }

  return { type: null, addr, buf };
};

module.exports = { buildRecord, parseRecord };
