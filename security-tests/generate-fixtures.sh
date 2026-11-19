#!/usr/bin/env bash
#
# Regenerate the synthetic long-lived test chains used by tls-spki-blocklist.mjs.
#
# Requires: openssl, node. The generated CA private keys are deleted at the end;
# do not commit them. The public incident metadata in data/ is the input.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
D="$ROOT/fixtures"
DATA="$ROOT/data"

rm -rf "$D"
mkdir -p "$D/work"

cat > "$D/work/openssl.cnf" <<'EOF'
[req]
distinguished_name=dn
prompt=no
[dn]
CN=emudhra-blocklist.test
[leaf]
subjectAltName=DNS:emudhra-blocklist.test
basicConstraints=critical,CA:false
keyUsage=critical,digitalSignature
extendedKeyUsage=serverAuth
[ca]
basicConstraints=critical,CA:true
keyUsage=critical,keyCertSign,cRLSign
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid:always
EOF

openssl req -new -newkey rsa:2048 -nodes \
    -keyout "$D/leaf-key.pem" -out "$D/work/leaf.csr" \
    -config "$D/work/openssl.cnf" 2>/dev/null

node --input-type=module - "$ROOT" <<'EOF'
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash, createPrivateKey, X509Certificate } from 'node:crypto';

const root = process.argv[2];
const fixtures = `${root}/fixtures`;
const data = `${root}/data`;

// Publicly recovered private scalars for the eight compromised eMudhra P-384
// intermediates. These are used only to create synthetic test certificates.
const privateScalars = {
    'EM DV TLS CA - G3B': 156,
    'EM DV TLS CA - G3C': 230,
    'EM EV TLS CA - G3B': 115,
    'EM EV TLS CA - G3C': 56,
    'EM OV TLS CA - G3B': 155,
    'EM OV TLS CA - G3C': 4,
    'EM OV CS CA - G3B': 66,
    'EM OV CS CA - G3C': 237,
};

const impacted = JSON.parse(readFileSync(`${data}/impacted-intermediates.json`, 'utf8'));
const manifest = [];

for (const [name, scalar] of Object.entries(privateScalars)) {
    const item = impacted.find(
        (candidate) => candidate.name === name && candidate.issuer_operator === 'eMudhra',
    );
    if (!item) throw new Error(`Missing incident metadata for ${name}`);

    const certificate = new X509Certificate(item.pem);
    const publicJwk = certificate.publicKey.export({ format: 'jwk' });
    const key = createPrivateKey({
        key: {
            ...publicJwk,
            d: Buffer.from(scalar.toString(16).padStart(96, '0'), 'hex').toString('base64url'),
        },
        format: 'jwk',
    });

    const slug = name.toLowerCase().replaceAll(' ', '-').replaceAll('---', '-');
    writeFileSync(`${fixtures}/work/${slug}-ca-key.pem`, key.export({ format: 'pem', type: 'pkcs8' }));

    const spki = createHash('sha256')
        .update(certificate.publicKey.export({ type: 'spki', format: 'der' }))
        .digest('hex');
    if (spki !== item.spki_sha256.toLowerCase()) throw new Error(`SPKI mismatch for ${name}`);

    manifest.push({ name, slug, spki });
}

writeFileSync(`${fixtures}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
EOF

for ca_key in "$D"/work/*-ca-key.pem; do
    slug="$(basename "$ca_key" -ca-key.pem)"
    openssl req -new -key "$ca_key" \
        -subj "/CN=SPKI fixture $slug" -out "$D/work/$slug-ca.csr" 2>/dev/null
    openssl x509 -req -in "$D/work/$slug-ca.csr" -signkey "$ca_key" \
        -out "$D/work/$slug-ca.pem" -days 7300 -sha384 \
        -extfile "$D/work/openssl.cnf" -extensions ca >/dev/null 2>&1
    openssl x509 -req -in "$D/work/leaf.csr" -CA "$D/work/$slug-ca.pem" \
        -CAkey "$ca_key" -CAcreateserial -out "$D/work/$slug-leaf.pem" \
        -days 7300 -sha384 -extfile "$D/work/openssl.cnf" \
        -extensions leaf >/dev/null 2>&1
    { cat "$D/work/$slug-leaf.pem"; printf '\n'; cat "$D/work/$slug-ca.pem"; } \
        > "$D/$slug-chain.pem"
done

# Positive control: an ordinary RSA CA and a valid leaf with the same SAN.
openssl req -new -newkey rsa:2048 -nodes \
    -keyout "$D/work/control-ca-key.pem" -out "$D/work/control-ca.csr" \
    -subj '/CN=TLS test control CA' 2>/dev/null
openssl x509 -req -in "$D/work/control-ca.csr" -signkey "$D/work/control-ca-key.pem" \
    -out "$D/work/control-ca.pem" -days 7300 -sha256 \
    -extfile "$D/work/openssl.cnf" -extensions ca >/dev/null 2>&1
openssl x509 -req -in "$D/work/leaf.csr" -CA "$D/work/control-ca.pem" \
    -CAkey "$D/work/control-ca-key.pem" -CAcreateserial \
    -out "$D/work/control-leaf.pem" -days 7300 -sha256 \
    -extfile "$D/work/openssl.cnf" -extensions leaf >/dev/null 2>&1
{ cat "$D/work/control-leaf.pem"; printf '\n'; cat "$D/work/control-ca.pem"; } \
    > "$D/control-chain.pem"

rm -rf "$D/work"
find "$D" -maxdepth 1 -type f -printf '%f %s bytes\n' | sort
