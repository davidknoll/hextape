/**
 * @file Intel hex format
 * @see {@link https://en.wikipedia.org/wiki/Intel_HEX}
 * @module intel
 */
'use strict';
const printf = require('printf');
const { Transform } = require('stream');

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

function * concatgen(bufs) {
  for (let i = 0; i < bufs.length; i++) {
    for (const value of bufs[i]) { yield value; }
  }
}

class HexStream extends Transform {
  // Private instance variables
  _tmpbuf;
  _ptr;
  _exec;
  _reclen;
  _needea;

  /**
   * Construct a new transform stream turning binary data into Intel hex records.
   * Record types and checksums are determined automatically.
   * @param {?null}   header Not used in Intel hex
   * @param {?number} base   Load address, 0x0 - 0xFFFFFFFF
   * @param {?number} exec   Execution address, 0x0 - 0xFFFFFFFF
   * @param {?number} reclen Maximum data bytes in one record, 1 - 255
   * @throws If addresses bad
   */
  constructor(header = null, base = 0, exec = 0, reclen = 0x20) {
    if (!Number.isInteger(base) || base < 0 || base > 0xFFFFFFFF) {
      throw new Error('Bad base address');
    }
    if (!Number.isInteger(exec) || exec < 0 || exec > 0xFFFFFFFF) {
      throw new Error('Bad exec address');
    }
    if (!Number.isInteger(reclen) || reclen < 1 || reclen > 0xFF) {
      reclen = 0x20;
    }

    super();
    this._tmpbuf = Buffer.alloc(0);
    this._ptr = base;
    this._exec = exec;
    this._reclen = reclen;
    this._needea = true;
  }

  // Transform stream implementation, receive a binary chunk
  _transform(chunk, encoding, callback) {
    const bg = concatgen([this._tmpbuf, chunk]);
    let recbytes = [];
    while (true) {
      // Get next byte, or save any incomplete record
      const b = bg.next();
      if (b.done) {
        this._tmpbuf = Buffer.from(recbytes);
        return callback();
      }
      recbytes.push(b.value);

      // Got enough bytes for a record
      if (recbytes.length === this._reclen) {
        // If last record crossed or ended on a 64KB boundary, output extended address
        if (this._needea) {
          const eabuf = Buffer.allocUnsafe(2);
          eabuf.writeInt16BE(this._ptr >> 16);
          this.push(buildRecord(4, 0, eabuf) + '\n');
          this._needea = false;
        }
        this.push(buildRecord(0, this._ptr & 0xFFFF, Buffer.from(recbytes)) + '\n');

        // Did that record cross or end on a 64KB boundary?
        if (this._ptr >> 16 !== (this._ptr + this._reclen) >> 16) {
          this._needea = true;
        }
        this._ptr += this._reclen;
        recbytes = [];
      }
    }
  }

  // Transform stream implementation, flush remaining data and send EOF records
  _flush(callback) {
    // If remaining data, emit one more short record
    if (this._tmpbuf.length) {
      if (this._needea) {
        const eabuf = Buffer.allocUnsafe(2);
        eabuf.writeInt16BE(this._ptr >> 16);
        this.push(buildRecord(4, 0, eabuf) + '\n');
      }
      this.push(buildRecord(0, this._ptr & 0xFFFF, this._tmpbuf) + '\n');
    }

    // Exec address if any, EOF
    if (this._exec) {
      const eabuf = Buffer.allocUnsafe(4);
      eabuf.writeInt32BE(this._exec);
      this.push(buildRecord(5, 0, eabuf) + '\n');
    }
    this.push(buildRecord(1) + '\n');
    callback();
  }
}

module.exports = { buildRecord, parseRecord, HexStream };
