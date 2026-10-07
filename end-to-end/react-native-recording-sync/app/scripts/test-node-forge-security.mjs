import assert from 'node:assert/strict';
import { constants, verify, X509Certificate } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import test from 'node:test';
import { applyNodeForgeSecurityPatch } from './apply-node-forge-security-patch.mjs';

const require = createRequire(import.meta.url);
const consumerRequire = createRequire(require.resolve('@expo/code-signing-certificates'));
const forge = consumerRequire('node-forge');
const certificates = require('@expo/code-signing-certificates');
const keypair = forge.pki.rsa.generateKeyPair({ bits: 1024 });
const payload = 'Synthetic node-forge parser regression';
const md = forge.md.sha256.create().update(payload);
const digest = md.digest().getBytes();
const asn1 = forge.asn1;
const item = (type, constructed, value) => asn1.create(asn1.Class.UNIVERSAL, type, constructed, value);

function signature(parameters = '', extra = false, ber = false, targetDigest = digest) {
  const algorithm = [item(asn1.Type.OID, false, asn1.oidToDer('2.16.840.1.101.3.4.2.1').getBytes())];
  if (parameters !== null) algorithm.push(item(asn1.Type.NULL, false, parameters));
  if (extra) algorithm.push(item(asn1.Type.OCTETSTRING, false, 'ignored synthetic garbage'));
  const info = item(asn1.Type.SEQUENCE, true, [
    item(asn1.Type.SEQUENCE, true, algorithm), item(asn1.Type.OCTETSTRING, false, targetDigest),
  ]);
  let encoded = asn1.toDer(info).getBytes();
  if (ber) encoded = '\x30\x80' + encoded.slice(2) + '\x00\x00';
  return forge.pki.rsa.encrypt(encoded, keypair.privateKey, 0x01);
}

test('nested DigestAlgorithm garbage is rejected by Forge and independent OpenSSL verification', () => {
  const invalid = signature('', true);
  assert.equal(verify('sha256', Buffer.from(payload), {
    key: forge.pki.publicKeyToPem(keypair.publicKey), padding: constants.RSA_PKCS1_PADDING,
  }, Buffer.from(invalid, 'binary')), false);
  assert.throws(() => keypair.publicKey.verify(digest, invalid), /valid RSASSA-PKCS1/);
});

test('nonempty ASN.1 NULL parameters cannot hide unconsumed bytes', () => {
  for (const length of [1, 8, 32]) {
    assert.throws(() => keypair.publicKey.verify(digest, signature('x'.repeat(length))), /valid RSASSA-PKCS1/);
  }
});

test('ordinary empty/absent NULL parameters and supported legacy BER still verify', () => {
  for (const value of ['', null]) assert.equal(keypair.publicKey.verify(digest, signature(value)), true);
  assert.equal(keypair.publicKey.verify(digest, signature('', false, true)), true);
  assert.equal(keypair.publicKey.verify('\x00'.repeat(32), signature()), false);
});

test('normal PKCS#1 signing agrees with independent OpenSSL verification', () => {
  const signed = keypair.privateKey.sign(forge.md.sha256.create().update(payload));
  assert.equal(keypair.publicKey.verify(digest, signed), true);
  assert.equal(verify('sha256', Buffer.from(payload), {
    key: forge.pki.publicKeyToPem(keypair.publicKey), padding: constants.RSA_PKCS1_PADDING,
  }, Buffer.from(signed, 'binary')), true);
});

test('RSA-PSS signing and verification remain compatible', () => {
  const pss = forge.pss.create({ md: forge.md.sha256.create(), mgf: forge.mgf.mgf1.create(forge.md.sha256.create()), saltLength: 20 });
  const signed = keypair.privateKey.sign(forge.md.sha256.create().update(payload), pss);
  assert.equal(keypair.publicKey.verify(digest, signed, pss), true);
});

test('CA construction, UTF8 leaf signing, PEM parsing and X509 signatures remain compatible', () => {
  const ca = forge.pki.createCertificate();
  ca.publicKey = keypair.publicKey;
  ca.serialNumber = '01';
  ca.validity.notBefore = new Date('2026-01-01');
  ca.validity.notAfter = new Date('2030-01-01');
  ca.setSubject([{ name: 'commonName', value: 'Synthetic CA' }]);
  ca.setIssuer(ca.subject.attributes);
  ca.setExtensions([{ name: 'basicConstraints', cA: true, critical: true }, { name: 'keyUsage', keyCertSign: true, critical: true }]);
  ca.sign(keypair.privateKey, forge.md.sha256.create());
  const leaf = forge.pki.createCertificate();
  leaf.publicKey = keypair.publicKey;
  leaf.serialNumber = '02';
  leaf.validity.notBefore = ca.validity.notBefore;
  leaf.validity.notAfter = ca.validity.notAfter;
  leaf.setSubject([{ name: 'commonName', value: 'dev_synthetic', valueTagClass: asn1.Type.UTF8 }]);
  leaf.setIssuer(ca.subject.attributes);
  leaf.setExtensions([{ name: 'basicConstraints', cA: false }, { name: 'extKeyUsage', clientAuth: true }]);
  leaf.sign(forge.pki.privateKeyFromPem(forge.pki.privateKeyToPem(keypair.privateKey)), forge.md.sha256.create());
  const pem = forge.pki.certificateToPem(leaf);
  assert.equal(forge.pki.certificateFromPem(pem).subject.getField('CN').value, 'dev_synthetic');
  assert.equal(ca.verify(leaf), true);
  assert.equal(new X509Certificate(pem).verify(new X509Certificate(forge.pki.certificateToPem(ca)).publicKey), true);
});

test('installer is idempotent and rejects drift before modifying unknown source', () => {
  const temp = mkdtempSync(join(tmpdir(), 'bota-forge-patch-'));
  try {
    mkdirSync(join(temp, 'lib'));
    writeFileSync(join(temp, 'package.json'), JSON.stringify({ name: 'node-forge', version: '1.4.0' }));
    const source = readFileSync(join(dirname(require.resolve('node-forge/package.json')), 'lib/rsa.js'));
    writeFileSync(join(temp, 'lib/rsa.js'), source);
    applyNodeForgeSecurityPatch(temp);
    assert.equal(applyNodeForgeSecurityPatch(temp), 'already patched');
    writeFileSync(join(temp, 'lib/rsa.js'), 'unknown source');
    assert.throws(() => applyNodeForgeSecurityPatch(temp), /Unexpected node-forge RSA source/);
    assert.equal(readFileSync(join(temp, 'lib/rsa.js'), 'utf8'), 'unknown source');
    writeFileSync(join(temp, 'package.json'), JSON.stringify({ name: 'node-forge', version: '1.4.1' }));
    assert.throws(() => applyNodeForgeSecurityPatch(temp), /changed package version/);
  } finally {
    assert.ok(resolve(temp).startsWith(resolve(tmpdir()) + sep) && basename(temp).startsWith('bota-forge-patch-'));
    rmSync(temp, { recursive: true });
  }
});

test('actual Expo certificate consumer signs, validates and independently verifies ordinary manifests', () => {
  const certificate = certificates.generateSelfSignedCodeSigningCertificate({
    keyPair: keypair, validityNotBefore: new Date('2026-01-01'),
    validityNotAfter: new Date('2030-01-01'), commonName: 'Synthetic Expo signing',
  });
  const parsed = certificates.convertCertificatePEMToCertificate(certificates.convertCertificateToCertificatePEM(certificate));
  certificates.validateSelfSignedCertificate(parsed, keypair);
  const signed = certificates.signBufferRSASHA256AndVerify(keypair.privateKey, parsed, Buffer.from(payload));
  assert.equal(verify('sha256', Buffer.from(payload), {
    key: forge.pki.publicKeyToPem(keypair.publicKey), padding: constants.RSA_PKCS1_PADDING,
  }, Buffer.from(signed, 'base64')), true);
  const originalSignature = parsed.signature;
  parsed.signature = signature('', true, false, forge.md.sha256.create().update(asn1.toDer(parsed.tbsCertificate).getBytes()).digest().getBytes());
  assert.equal(new X509Certificate(certificates.convertCertificateToCertificatePEM(parsed)).verify(new X509Certificate(certificates.convertCertificateToCertificatePEM(certificate)).publicKey), false);
  parsed.signature = originalSignature;
  const invalid = forge.pki.certificateFromPem(certificates.convertCertificateToCertificatePEM(certificate));
  const certDigest = forge.md.sha256.create().update(asn1.toDer(invalid.tbsCertificate ?? forge.pki.getTBSCertificate(invalid)).getBytes()).digest().getBytes();
  invalid.signature = signature('', true, false, certDigest);
  assert.throws(() => certificates.validateSelfSignedCertificate(invalid, keypair), /valid RSASSA-PKCS1/);
});

test('actual Expo CSR consumer verifies and issues a development certificate', () => {
  const issuer = forge.pki.createCertificate();
  issuer.publicKey = keypair.publicKey;
  issuer.serialNumber = '03';
  issuer.validity.notBefore = new Date('2026-01-01');
  issuer.validity.notAfter = new Date('2030-01-01');
  issuer.setSubject([{ name: 'commonName', value: 'Synthetic Expo CA' }]);
  issuer.setIssuer(issuer.subject.attributes);
  issuer.setExtensions([{ name: 'basicConstraints', cA: true }, { name: 'keyUsage', keyCertSign: true }]);
  issuer.sign(keypair.privateKey, forge.md.sha256.create());
  const csr = certificates.convertCSRPEMToCSR(certificates.convertCSRToCSRPEM(certificates.generateCSR(keypair, 'Synthetic Expo CSR')));
  const leaf = certificates.generateDevelopmentCertificateFromCSR(keypair.privateKey, issuer, csr, 'synthetic-app', 'synthetic-scope');
  assert.equal(issuer.verify(leaf), true);
  assert.equal(new X509Certificate(forge.pki.certificateToPem(leaf)).verify(new X509Certificate(forge.pki.certificateToPem(issuer)).publicKey), true);
  const csrDigest = forge.md.sha256.create().update(asn1.toDer(csr.certificationRequestInfo ?? forge.pki.getCertificationRequestInfo(csr)).getBytes()).digest().getBytes();
  csr.signature = signature('synthetic hidden bytes', false, false, csrDigest);
  assert.throws(() => certificates.generateDevelopmentCertificateFromCSR(keypair.privateKey, issuer, csr, 'synthetic-app', 'synthetic-scope'), /valid RSASSA-PKCS1/);
});
