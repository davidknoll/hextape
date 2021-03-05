/**
 * @file Motorola S-records
 * @see {@link https://en.wikipedia.org/wiki/SREC_(file_format)}
 * @module motorola
 */
'use strict';
const printf = require('printf');
const { Transform } = require('stream');

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

class HexStream extends Transform {
  // Private instance variables
  _tmpbuf;
  _cnt;
  _ptr;
  _exec;
  _reclen;

  // Find appropriate data/count/exec record type for address width
  _dtype(addr) { return (addr > 0xFFFFFF) ? 3 : (addr > 0xFFFF) ? 2 : 1; }
  _ctype(addr) { return (addr > 0xFFFF) ? 6 : 5; }
  _atype(addr) { return (addr > 0xFFFFFF) ? 7 : (addr > 0xFFFF) ? 8 : 9; }

  /**
   * Construct a new transform stream turning binary data into Motorola S-records.
   * Record types and checksums are determined automatically.
   * @param {?string} header An identifying string to embed in the output file
   * @param {?number} base   Load address, 0x0 - 0xFFFFFFFF
   * @param {?number} exec   Execution address, 0x0 - 0xFFFFFFFF
   * @param {?number} reclen Maximum data bytes in one record, 1 - 250
   * @throws If header too long or addresses bad
   */
  constructor(header = null, base = 0, exec = 0, reclen = 0x20) {
    if (!Number.isInteger(base) || base < 0 || base > 0xFFFFFFFF) {
      throw new Error('Bad base address');
    }
    if (!Number.isInteger(exec) || exec < 0 || exec > 0xFFFFFFFF) {
      throw new Error('Bad exec address');
    }
    if (!Number.isInteger(reclen) || reclen < 1 || reclen + 5 > 0xFF) {
      reclen = 0x20;
    }

    super();
    this._tmpbuf = Buffer.alloc(0);
    this._cnt = 0;
    this._ptr = base;
    this._exec = exec;
    this._reclen = reclen;

    // Emit a header record if we have one
    if (header) {
      const hdrbuf = Buffer.from(header, 'ascii');
      if (hdrbuf.length > reclen) { throw new Error('Header too long'); }
      if (hdrbuf.length) { this.push(buildRecord(0, 0, hdrbuf) + '\n'); }
    }
  }

  // Transform stream implementation, receive a binary chunk
  _transform(chunk, encoding, callback) {
    // Still not enough bytes to emit a record after this chunk, just save it
    if (this._tmpbuf.length + chunk.length < this._reclen) {
      this._tmpbuf = Buffer.concat([this._tmpbuf, chunk]);
      return callback();
    }

    // Emit one data record, part of which may have been left over from the last chunk
    let chunkptr = this._reclen - this._tmpbuf.length;
    if (this._ptr > 0xFFFFFFFF) {
      return callback(new Error('Load address too wide'));
    }
    this.push(buildRecord(
      this._dtype(this._ptr), this._ptr,
      Buffer.concat([this._tmpbuf, chunk.slice(0, chunkptr)])
    ) + '\n');
    this._cnt++;
    this._ptr += this._reclen;

    // Emit as many more full-length data records as possible from this chunk
    while (chunkptr + this._reclen <= chunk.length) {
      if (this._ptr > 0xFFFFFFFF) {
        return callback(new Error('Load address too wide'));
      }
      this.push(buildRecord(
        this._dtype(this._ptr), this._ptr,
        chunk.slice(chunkptr, chunkptr + this._reclen)
      ) + '\n');
      this._cnt++;
      this._ptr += this._reclen;
      chunkptr += this._reclen;
    }

    // And save the remainder
    this._tmpbuf = chunk.slice(chunkptr);
    callback();
  }

  // Transform stream implementation, flush remaining data and send EOF records
  _flush(callback) {
    // If remaining data, emit one more short record
    if (this._tmpbuf.length) {
      if (this._ptr > 0xFFFFFFFF) {
        return callback(new Error('Load address too wide'));
      }
      this.push(buildRecord(this._dtype(this._ptr), this._ptr, this._tmpbuf) + '\n');
      this._cnt++;
    }

    // Data record count, exec address
    if (this._cnt > 0 && this._cnt <= 0xFFFFFF) {
      this.push(buildRecord(this._ctype(this._cnt), this._cnt) + '\n');
    }
    this.push(buildRecord(this._atype(this._exec), this._exec) + '\n');
    callback();
  }
}

module.exports = { buildRecord, parseRecord, HexStream };
