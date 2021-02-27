/**
 * What gets returned from the parseRecord functions
 * @typedef  {Object}  ParseResult
 * @property {?number} type Record type, 0x00-0xFF, or null if no record types in format
 * @property {number}  addr Address, 16/24/32 bits wide as appropriate to record type
 * @property {Buffer}  buf  Containing 0-255 data bytes as appropriate to record type
 */

'use strict';
module.exports = {
  intel: require('./intel'),
  motorola: require('./motorola'),
  signetics: require('./signetics'),
};
