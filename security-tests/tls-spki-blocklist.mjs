import assert from 'node:assert/strict';
import { createHash, X509Certificate } from 'node:crypto';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import tls from 'node:tls';

const root = new URL('./fixtures/', import.meta.url);
const read = (name) => readFile(new URL(name, root), 'utf8');
const manifest = JSON.parse(await read('manifest.json'));
const key = await read('leaf-key.pem');
const names = ['control', ...manifest.map(({ slug }) => slug)];
const chains = new Map(await Promise.all(
  names.map(async (name) => [name, await read(`${name}-chain.pem`)]),
));
const certificates = (pem) =>
  pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g)
    .map((pemCertificate) => new X509Certificate(pemCertificate));

assert.equal(manifest.length, 8);
assert.equal(new Set(manifest.map(({ spki }) => spki)).size, 8);
for (const { slug, spki } of manifest) {
  const ca = certificates(chains.get(slug))[1];
  assert.equal(
    createHash('sha256')
      .update(ca.publicKey.export({ type: 'spki', format: 'der' }))
      .digest('hex'),
    spki,
    `${slug} fixture must contain the real compromised SPKI`,
  );
}

let chain = chains.get('control');
const server = tls.createServer({
  key,
  cert: chain,
  SNICallback(_servername, callback) {
    callback(null, tls.createSecureContext({ key, cert: chain }));
  },
});
server.on('secureConnection', (socket) => socket.end());
server.on('tlsClientError', () => {});
server.listen(0, '127.0.0.1');
await once(server, 'listening');

try {
  for (const name of names) {
    chain = chains.get(name);
    const ca = certificates(chain).at(-1).toString();
    const socket = tls.connect({
      host: '127.0.0.1',
      port: server.address().port,
      servername: 'emudhra-blocklist.test',
      ca,
    });
    try {
      if (name === 'control') {
        await once(socket, 'secureConnect');
        assert.equal(socket.authorized, true);
        assert.equal(socket.authorizationError, null);
      } else {
        await assert.rejects(once(socket, 'secureConnect'), {
          code: 'CERT_REVOKED',
          message: 'certificate revoked',
        });
      }
    } finally {
      socket.destroy();
    }
  }
} finally {
  server.close();
  await once(server, 'close');
}

console.log(`PASS: ${process.version} blocks all 8 eMudhra SPKIs.`);
