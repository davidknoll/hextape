hextape
=======

Converts to/from various ASCII hex record formats used in EPROM programming, paper tapes etc

* `hextape`
  * `intel` - Intel hex format
    * `buildRecord(type, addr, buf)`
    * `parseRecord(record)`
    * `new HexStream(header, base, exec, reclen)`
  * `motorola` - Motorola S-records
    * `buildRecord(type, addr, buf)`
    * `parseRecord(record)`
    * `new HexStream(header, base, exec, reclen)`
  * `signetics` - Signetics absolute object format
    * `buildRecord(type, addr, buf)`
    * `parseRecord(record)`
    * `new HexStream(header, base, exec, reclen)`

Usage
-----

See also `examples.js`. JSDoc comments are available in the source code.

```javascript
const fs = require('fs');
const hextape = require('hextape');

console.log(hextape.motorola.buildRecord(
  1,            // Record type
  0x0038,       // Address
  Buffer.from([ // Data
    0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x20, 0x77,
    0x6F, 0x72, 0x6C, 0x64, 0x2E, 0x0A, 0x00,
  ])
));

console.log(hextape.motorola.parseRecord(
  'S111003848656C6C6F20776F726C642E0A0042'
));

fs.createReadStream('LICENSE')
  .pipe(new hextape.motorola.HexStream('LICENSE'))
  .pipe(process.stdout);
```

```
S111003848656C6C6F20776F726C642E0A0042

{
  type: 1,
  addr: 56,
  buf: <Buffer 48 65 6c 6c 6f 20 77 6f 72 6c 64 2e 0a 00>
}

...
```

License
-------

MIT license, copyright (c) 2021 David Knoll
