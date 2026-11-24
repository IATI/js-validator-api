# Runtime security tests

## TLS SPKI blocklist

`tls-spki-blocklist.mjs` is an offline loopback TLS test for the Node.js fix for
the October 2026 eMudhra intermediate CA compromise.

It creates a local TLS server whose certificate chains contain synthetic CAs built
from the eight real compromised eMudhra public keys. A normal RSA control chain must
authenticate successfully; every compromised-key chain must fail with exactly
`CERT_REVOKED`. The test also recomputes each CA's SPKI SHA-256 and checks it against
`fixtures/manifest.json`, so the fixtures cannot silently drift to unrelated keys.

Run with Node 24.22.1 or later:

```bash
npm run security:test
```

No network access, Mocha, or `--expose-internals` is required.

### Fixtures

The checked-in fixtures are valid until 2046. `generate-fixtures.sh` regenerates them
from the public incident metadata in `data/`; it requires `openssl` and Node. The
generator writes temporary CA private keys only to reproduce the compromised public
keys, then deletes them. Do not commit generated CA private keys.

The two code-signing intermediates are included as synthetic TLS CAs with no EKU
restriction so the same certificate-verification path exercises all eight blocked
SPKIs. They are test certificates only and are not usable outside this loopback test.

### Why it is a regression test

A version assertion can pass even if a base-image rebuild, dependency change, or
future rollback reintroduces a runtime without the key blocklist. This test proves
the actual behavior required by the security fix, using the real compromised SPKIs.
