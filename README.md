hextape
=======

Converts to/from various ASCII hex record formats used in EPROM programming, paper tapes etc

* `hextape`
  * `intel` - Intel hex format
    * `buildRecord(type, addr, buf)`
    * `parseRecord(record)`
  * `motorola` - Motorola S-records
    * `buildRecord(type, addr, buf)`
    * `parseRecord(record)`
  * `signetics` - Signetics absolute object format
    * `buildRecord(type, addr, buf)`
    * `parseRecord(record)`

Usage
-----

See also `examples.js`.

```javascript
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
);
```

```
S111003848656C6C6F20776F726C642E0A0042

{
  type: 1,
  addr: 56,
  buf: <Buffer 48 65 6c 6c 6f 20 77 6f 72 6c 64 2e 0a 00>
}
```

License
-------

MIT License

Copyright (c) 2021 David Knoll
