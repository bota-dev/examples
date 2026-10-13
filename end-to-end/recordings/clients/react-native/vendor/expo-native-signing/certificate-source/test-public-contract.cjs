'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { AsnParser, AsnSerializer, OctetString } = require('@peculiar/asn1-schema');
const X = require('@peculiar/asn1-x509');
const C = require('@peculiar/asn1-csr');
const ASN = require('asn1js');
const api = require('./main.cjs');
const pair = api.generateKeyPair(), other = api.generateKeyPair();
const options = { keyPair: pair, commonName: 'Example Δ\nCN', validityNotBefore: new Date(Date.now() - 100000), validityNotAfter: new Date(Date.now() + 86400000) };
const cert = api.generateSelfSignedCodeSigningCertificate(options);
const certPEM = api.convertCertificateToCertificatePEM(cert);
const der = p => Buffer.from(p.replace(/-----[^\n]+-----|\s/g, ''), 'base64');
const pem = (b, label = 'CERTIFICATE') => `-----BEGIN ${label}-----\n${Buffer.from(b).toString('base64').match(/.{1,64}/g).join('\n')}\n-----END ${label}-----\n`;
const mutateCert = callback => { const c = AsnParser.parse(der(certPEM), X.Certificate); callback(c); return pem(AsnSerializer.serialize(c)); };
test('fourteen synchronous public exports plus distinct Apple reader are present', () => {
  for (const name of ['generateKeyPair', 'convertKeyPairToPEM', 'convertCertificateToCertificatePEM', 'convertKeyPairPEMToKeyPair', 'convertPublicKeyPEMToPublicKey', 'convertPrivateKeyPEMToPrivateKey', 'convertCertificatePEMToCertificate', 'convertCSRToCSRPEM', 'convertCSRPEMToCSR', 'generateSelfSignedCodeSigningCertificate', 'validateSelfSignedCertificate', 'signBufferRSASHA256AndVerify', 'generateCSR', 'generateDevelopmentCertificateFromCSR', 'readCertificateSubject']) assert.equal(typeof api[name], 'function');
});
test('RSA native keys and public/private PEM roundtrip preserve exact SPKI', () => {
  assert.ok(pair.privateKey instanceof crypto.KeyObject); assert.equal(pair.publicKey.asymmetricKeyDetails.modulusLength, 2048);
  const p = api.convertKeyPairToPEM(pair), round = api.convertKeyPairPEMToKeyPair(p);
  assert.match(p.privateKeyPEM, /^-----BEGIN RSA PRIVATE KEY-----/); assert.match(p.publicKeyPEM, /^-----BEGIN PUBLIC KEY-----/);
  assert.equal(api.convertKeyPairToPEM(round).publicKeyPEM, p.publicKeyPEM);
  assert.equal(api.convertKeyPairToPEM(round).privateKeyPEM, p.privateKeyPEM);
});
test('key pair mismatch is refused by conversion and generation', () => {
  assert.throws(() => api.convertKeyPairToPEM({ privateKey: pair.privateKey, publicKey: other.publicKey }), /mismatch/);
  assert.throws(() => api.generateCSR({ privateKey: pair.privateKey, publicKey: other.publicKey }, 'CN'), /mismatch/);
});
test('self-signed certificate has exact subject, valid native signature and byte-preserving roundtrip', () => {
  assert.equal(cert.subject.getField('CN').value, options.commonName);
  api.validateSelfSignedCertificate(cert, pair);
  const native = new crypto.X509Certificate(certPEM); assert.ok(native.verify(pair.publicKey));
  assert.equal(api.convertCertificateToCertificatePEM(api.convertCertificatePEMToCertificate(certPEM)), certPEM);
});
test('generated serial positive, critical digital-signature and code-signing extensions', () => {
  const schema = AsnParser.parse(der(certPEM), X.Certificate), t = schema.tbsCertificate;
  assert.ok(Buffer.from(t.serialNumber).length > 0 && Buffer.from(t.serialNumber).length <= 9); assert.equal(Buffer.from(t.serialNumber)[0] & 128, 0);
  const usage = t.extensions.find(e => e.extnID === X.id_ce_keyUsage), eku = t.extensions.find(e => e.extnID === X.id_ce_extKeyUsage);
  assert.equal(usage.critical, true); assert.equal(eku.critical, true);
  assert.deepEqual(AsnParser.parse(usage.extnValue.buffer, X.KeyUsage).toJSON(), ['digitalSignature']);
  assert.deepEqual([...AsnParser.parse(eku.extnValue.buffer, X.ExtendedKeyUsage)], [X.id_kp_codeSigning]);
});
test('manifest signature matches Node/OpenSSL independent verification', () => {
  const b = Buffer.from('synthetic manifest Δ'), s = api.signBufferRSASHA256AndVerify(pair.privateKey, cert, b);
  assert.ok(crypto.verify('sha256', b, pair.publicKey, Buffer.from(s, 'base64')));
  assert.equal(crypto.verify('sha256', Buffer.from('changed'), pair.publicKey, Buffer.from(s, 'base64')), false);
  assert.throws(() => api.signBufferRSASHA256AndVerify(other.privateKey, cert, b), /mismatch/);
  assert.throws(() => api.signBufferRSASHA256AndVerify(pair.privateKey, cert, 'text'), /Buffer/);
});
test('CSR verifies and PEM roundtrip preserves subject and complete request bytes', () => {
  const csr = api.generateCSR(pair, 'Development Example'), p = api.convertCSRToCSRPEM(csr), round = api.convertCSRPEMToCSR(p);
  assert.ok(csr.verify()); assert.ok(round.verify()); assert.equal(round.subject.getField('CN').value, 'Development Example');
  assert.equal(api.convertCSRToCSRPEM(round), p);
});
test('development certificate retains CSR public key, issuer and exact project OID/value', () => {
  const csr = api.generateCSR(other, 'Child'), child = api.generateDevelopmentCertificateFromCSR(pair.privateKey, cert, csr, 'app-id', 'scope-key');
  const p = api.convertCertificateToCertificatePEM(child), n = new crypto.X509Certificate(p), s = AsnParser.parse(der(p), X.Certificate);
  assert.ok(n.verify(pair.publicKey)); assert.equal(child.subject.getField('CN').value, 'Child'); assert.equal(child.issuer.getField('CN').value, options.commonName);
  assert.equal(Buffer.from(s.tbsCertificate.extensions.find(e => e.extnID === api.expoProjectInformationOID).extnValue.buffer).toString(), 'app-id,scope-key');
  const before = new Date(); before.setDate(before.getDate() - 1); const after = new Date(); after.setDate(before.getDate() + 30);
  assert.ok(Math.abs(+child.validity.notBefore - +before) < 2000); assert.ok(Math.abs(+child.validity.notAfter - +after) < 2000);
  assert.throws(() => api.generateDevelopmentCertificateFromCSR(other.privateKey, cert, csr, 'app-id', 'scope-key'), /mismatch/);
  assert.throws(() => api.generateDevelopmentCertificateFromCSR(pair.privateKey, cert, csr, 'app,id', 'scope-key'), /scope/);
});
test('unsupported ordinary EC and constrained RSA-PSS keys are refused', () => {
  for (const p of [crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' }), crypto.generateKeyPairSync('rsa-pss', { modulusLength: 2048, hashAlgorithm: 'sha256' })]) {
    assert.throws(() => api.convertKeyPairToPEM(p), /ordinary RSA/);
    assert.throws(() => api.convertPrivateKeyPEMToPrivateKey(p.privateKey.export({ type: 'pkcs8', format: 'pem' })), /ordinary RSA|algorithm/);
  }
});
test('invalid common name, dates and PEM multi-block/trailing input are refused', () => {
  assert.throws(() => api.generateCSR(pair, '\0'), /common name/);
  assert.throws(() => api.generateSelfSignedCodeSigningCertificate({ ...options, validityNotAfter: options.validityNotBefore }), /validity/);
  assert.throws(() => api.convertCertificatePEMToCertificate(certPEM + certPEM), /multiple/);
  assert.throws(() => api.convertCertificatePEMToCertificate(certPEM + 'trailing'), /multiple/);
  assert.throws(() => api.convertCertificatePEMToCertificate(pem(Buffer.concat([der(certPEM), Buffer.from([5, 0])]))));
});
test('expired and future certificate validation refuses', () => {
  for (const range of [[-300000, -200000], [200000, 300000]]) {
    const c = api.generateSelfSignedCodeSigningCertificate({ ...options, validityNotBefore: new Date(Date.now() + range[0]), validityNotAfter: new Date(Date.now() + range[1]) });
    assert.throws(() => api.validateSelfSignedCertificate(c, pair), /validity/);
  }
});
test('tampered CSR signature and unsupported signature OID are refused', () => {
  const raw = der(api.convertCSRToCSRPEM(api.generateCSR(pair, 'test')));
  const s = AsnParser.parse(raw, C.CertificationRequest); new Uint8Array(s.signature)[0] ^= 1;
  assert.throws(() => api.convertCSRPEMToCSR(pem(AsnSerializer.serialize(s), 'CERTIFICATE REQUEST')), /signature/);
  s.signatureAlgorithm.algorithm = '1.2.840.113549.1.1.10';
  assert.throws(() => api.convertCSRPEMToCSR(pem(AsnSerializer.serialize(s), 'CERTIFICATE REQUEST')), /algorithm/);
});
test('signature AlgorithmIdentifier non-NULL and constructed NULL cannot be flattened', () => {
  assert.throws(() => api.convertCertificatePEMToCertificate(mutateCert(c => { c.signatureAlgorithm.parameters = Uint8Array.from([4, 0]).buffer; })), /parameters/);
  const raw = der(certPEM), oidWithNull = Buffer.from('06092a864886f70d01010b0500', 'hex'), at = raw.lastIndexOf(oidWithNull);
  assert.ok(at >= 0); raw[at + 11] = 0x25;
  assert.throws(() => api.convertCertificatePEMToCertificate(pem(raw)), /constructed/);
});
test('signature mismatch, missing usages and duplicate extensions cannot validate', () => {
  const bad = api.convertCertificatePEMToCertificate(mutateCert(c => { new Uint8Array(c.signatureValue)[0] ^= 1; }));
  assert.throws(() => api.validateSelfSignedCertificate(bad, pair), /self-signed/);
  assert.throws(() => api.convertCertificatePEMToCertificate(mutateCert(c => { c.tbsCertificate.extensions.push(c.tbsCertificate.extensions[0]); c.tbsCertificateRaw = undefined; })), /Duplicate/);
  assert.throws(() => api.signBufferRSASHA256AndVerify(pair.privateKey, { ...cert }, Buffer.from('x')), /native/);
});
test('Apple subject reader uses DER DN fields without interpreting textual escapes', () => {
  const fields = api.readCertificateSubject(certPEM).subject;
  assert.equal(fields.getField('CN').value, options.commonName); assert.equal(fields.getField('O'), null);
  assert.throws(() => api.signBufferRSASHA256AndVerify(pair.privateKey, api.readCertificateSubject(certPEM), Buffer.from('x')), /native RSA/);
});
test('missing signing extensions are refused on an otherwise valid self-signed certificate', () => {
  const schema = AsnParser.parse(der(certPEM), X.Certificate);
  schema.tbsCertificateRaw = undefined; schema.tbsCertificate.extensions = undefined;
  schema.signatureValue = Uint8Array.from(crypto.sign('sha256', Buffer.from(AsnSerializer.serialize(schema.tbsCertificate)), pair.privateKey)).buffer;
  const c = api.convertCertificatePEMToCertificate(pem(AsnSerializer.serialize(schema)));
  assert.throws(() => api.validateSelfSignedCertificate(c, pair), /digital-signature/);
});
test('Apple DN-only reader handles a real EC certificate while RSA signing conversion rejects it', () => {
  const e = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const schema = AsnParser.parse(der(certPEM), X.Certificate);
  schema.tbsCertificateRaw = undefined;
  schema.tbsCertificate.subjectPublicKeyInfo = AsnParser.parse(e.publicKey.export({ type: 'spki', format: 'der' }), X.SubjectPublicKeyInfo);
  schema.tbsCertificate.signature = new X.AlgorithmIdentifier({ algorithm: '1.2.840.10045.4.3.2' });
  schema.signatureAlgorithm = new X.AlgorithmIdentifier({ algorithm: '1.2.840.10045.4.3.2' });
  schema.signatureValue = Uint8Array.from(crypto.sign('sha256', Buffer.from(AsnSerializer.serialize(schema.tbsCertificate)), e.privateKey)).buffer;
  const p = pem(AsnSerializer.serialize(schema)); assert.ok(new crypto.X509Certificate(p).verify(e.publicKey));
  assert.equal(api.readCertificateSubject(p).subject.getField('CN').value, options.commonName);
  assert.throws(() => api.convertCertificatePEMToCertificate(p), /algorithm/);
});
test('malformed lengths, indefinite BER and bounded depth refuse before schema interpretation', () => {
  assert.throws(() => api.convertCertificatePEMToCertificate(pem(Buffer.from([0x30, 0x80, 5, 0, 0, 0]))), /length/);
  assert.throws(() => api.convertCertificatePEMToCertificate(pem(Buffer.from([0x30, 0x81, 2, 5, 0]))), /Nonminimal/);
  let b = Buffer.from([5, 0]);
  for (let i = 0; i < 40; i++) b = Buffer.concat([Buffer.from([0x30, b.length]), b]);
  assert.throws(() => api.convertCertificatePEMToCertificate(pem(b)), /bounds/);
});
test('bare SPKI key imports accept empty/absent NULL but reject malformed and extra parameters', () => {
  const raw = pair.publicKey.export({ type: 'spki', format: 'der' });
  const modified = params => { const s = ASN.fromBER(raw).result; s.valueBlock.value[0].valueBlock.value = [s.valueBlock.value[0].valueBlock.value[0], ...params]; return pem(s.toBER(false), 'PUBLIC KEY'); };
  for (const p of [[], [new ASN.Null()]]) assert.equal(api.convertPublicKeyPEMToPublicKey(modified(p)).asymmetricKeyType, 'rsa');
  for (const p of [[new ASN.Integer({ value: 1 })], [new ASN.Null(), new ASN.Null()], [new ASN.Constructed({ idBlock: { tagClass: 1, tagNumber: 5 } })]]) assert.throws(() => api.convertPublicKeyPEMToPublicKey(modified(p)));
});
test('bare PKCS8 key imports accept empty/absent NULL but reject malformed and extra parameters', () => {
  const raw = pair.privateKey.export({ type: 'pkcs8', format: 'der' });
  const modified = params => { const s = ASN.fromBER(raw).result; s.valueBlock.value[1].valueBlock.value = [s.valueBlock.value[1].valueBlock.value[0], ...params]; return pem(s.toBER(false), 'PRIVATE KEY'); };
  for (const p of [[], [new ASN.Null()]]) assert.equal(api.convertPrivateKeyPEMToPrivateKey(modified(p)).asymmetricKeyType, 'rsa');
  for (const p of [[new ASN.Integer({ value: 1 })], [new ASN.Null(), new ASN.Null()], [new ASN.Constructed({ idBlock: { tagClass: 1, tagNumber: 5 } })]]) assert.throws(() => api.convertPrivateKeyPEMToPrivateKey(modified(p)));
});
test('seeded serial draws preserve the masked value, minimal sign encoding and refuse all zero', () => {
  const random = crypto.randomBytes;
  try {
    for (const [draw, expected] of [['800102030405060708', '0102030405060708'], ['00ff02030405060708', '00ff02030405060708'], ['ff0102030405060708', '7f0102030405060708']]) {
      crypto.randomBytes = size => { assert.equal(size, 9); return Buffer.from(draw, 'hex'); };
      const c = api.generateSelfSignedCodeSigningCertificate(options);
      const s = AsnParser.parse(der(api.convertCertificateToCertificatePEM(c)), X.Certificate);
      assert.equal(Buffer.from(s.tbsCertificate.serialNumber).toString('hex'), expected); api.validateSelfSignedCertificate(c, pair);
    }
    crypto.randomBytes = size => Buffer.alloc(size);
    assert.throws(() => api.generateSelfSignedCodeSigningCertificate(options), /All-zero/);
  } finally { crypto.randomBytes = random; }
});
test('Apple DN reader selects first matching certificate block while signing remains single-block', () => {
  const second = api.convertCertificateToCertificatePEM(api.generateSelfSignedCodeSigningCertificate({ ...options, commonName: 'Second Match' }));
  assert.equal(api.readCertificateSubject(certPEM + second).subject.getField('CN').value, options.commonName);
  assert.equal(api.readCertificateSubject(second + certPEM).subject.getField('CN').value, 'Second Match');
  assert.throws(() => api.convertCertificatePEMToCertificate(certPEM + second), /multiple/);
  assert.throws(() => api.readCertificateSubject(api.convertKeyPairToPEM(pair).publicKeyPEM + certPEM), /Unsupported/);
  assert.throws(() => api.readCertificateSubject('-----BEGIN CERTIFICATE-----\ninvalid\n-----END CERTIFICATE-----\n' + certPEM));
});
test('public PEM conversions preserve 64-column CRLF representation', () => {
  const p = api.convertKeyPairToPEM(pair), csr = api.convertCSRToCSRPEM(api.generateCSR(pair, 'Printable Example'));
  for (const value of [p.privateKeyPEM, p.publicKeyPEM, certPEM, csr]) {
    assert.doesNotMatch(value, /(?<!\r)\n/); assert.ok(value.endsWith('\r\n'));
    for (const line of value.trim().split('\r\n').slice(1, -1)) assert.ok(line.length <= 64);
  }
});
test('PrintableString names retain upstream tag and other well-formed names use explicit UTF8', () => {
  for (const [name, field] of [['Printable Example (123)', 'printableString'], ['Δ Example', 'utf8String']]) {
    const c = api.generateSelfSignedCodeSigningCertificate({ ...options, commonName: name }), schema = AsnParser.parse(der(api.convertCertificateToCertificatePEM(c)), X.Certificate);
    assert.equal(schema.tbsCertificate.subject[0][0].value[field], name); assert.equal(c.subject.getField('CN').value, name);
  }
  assert.throws(() => api.generateCSR(pair, '\ud800'), /common name/);
});
test('development validity preserves literal public local-calendar month and DST behavior', () => {
  const ActualDate = Date, csr = api.generateCSR(other, 'Calendar Child');
  try {
    for (const instant of ['2026-03-01T20:00:00.000Z', '2026-11-02T20:00:00.000Z', '2026-12-01T20:00:00.000Z']) {
      const clock = +new ActualDate(instant);
      global.Date = class extends ActualDate { constructor(...args) { super(...(args.length ? args : [clock])); } static now() { return clock; } };
      const before = new Date(); before.setDate(before.getDate() - 1); const after = new Date(); after.setDate(before.getDate() + 30);
      const child = api.generateDevelopmentCertificateFromCSR(pair.privateKey, cert, csr, 'app', 'scope');
      assert.equal(+child.validity.notBefore, +before); assert.equal(+child.validity.notAfter, +after);
    }
  } finally { global.Date = ActualDate; }
});
