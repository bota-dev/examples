'use strict';
// Independent implementation of the public Expo development-signing contract.
// Crypto operations use Node/OpenSSL; ASN.1 models use the retained public packages.
const crypto = require('node:crypto');
const { AsnParser, AsnSerializer, OctetString } = require('@peculiar/asn1-schema');
const X = require('@peculiar/asn1-x509');
const C = require('@peculiar/asn1-csr');
const ASN = require('asn1js');
const RSA = '1.2.840.113549.1.1.1';
const RSA_SHA256 = '1.2.840.113549.1.1.11';
const expoProjectInformationOID = '1.2.840.113556.1.8000.2554.43437.254.128.102.157.7894389.20439.2.1';
const certificates = new WeakMap();
const requests = new WeakMap();
const ab = value => Uint8Array.from(value).buffer;
const serialize = value => Buffer.from(AsnSerializer.serialize(value));
function fail(message) { throw new Error(message); }

// Bound the maintained parser's work and refuse BER/constructed primitives before
// parsing. This is a DER admission check, not a cryptographic or ASN.1 serializer.
function admitDER(value, expectedTag = 0x30) {
  const b = Buffer.from(value);
  if (!b.length || b.length > 1024 * 1024) fail('DER size outside supported bounds');
  let offset = 0, visits = 0;
  const frames = [{ end: b.length, depth: 0, root: true, children: 0, set: false }];
  while (frames.length) {
    const f = frames.at(-1);
    if (offset === f.end) {
      if (f.root && f.children !== 1) fail('DER requires one top-level value');
      frames.pop(); continue;
    }
    if (offset > f.end || ++visits > 4096 || f.depth > 32) fail('DER structure exceeds bounds');
    const start = offset, tag = b[offset++], cls = tag >> 6, constructed = !!(tag & 32);
    let number = tag & 31;
    if (number === 31) {
      number = 0; let count = 0, next;
      do {
        if (offset >= f.end || ++count > 4) fail('Invalid DER tag');
        next = b[offset++]; if (count === 1 && !(next & 127)) fail('Nonminimal DER tag');
        number = number * 128 + (next & 127);
      } while (next & 128);
      if (number < 31) fail('Nonminimal DER tag');
    }
    if (offset >= f.end) fail('Missing DER length');
    let length = b[offset++];
    if (length & 128) {
      const count = length & 127;
      if (!count || count > 4 || offset + count > f.end || !b[offset]) fail('Invalid DER length');
      length = 0; for (let i = 0; i < count; i++) length = length * 256 + b[offset++];
      if (length < 128) fail('Nonminimal DER length');
    }
    const content = offset, end = offset + length;
    if (end > f.end) fail('Truncated DER value');
    if (f.root && (tag !== expectedTag || start !== 0)) fail('Unexpected top-level DER tag');
    if (cls === 0) {
      if (!number || constructed !== (number === 16 || number === 17)) fail('Unsupported constructed primitive');
      if (number === 5 && length !== 0) fail('Invalid NULL');
      if (number === 1 && (length !== 1 || ![0, 255].includes(b[content]))) fail('Invalid DER boolean');
      if (number === 2 && (!length || (length > 1 && ((b[content] === 0 && !(b[content + 1] & 128)) || (b[content] === 255 && (b[content + 1] & 128)))))) fail('Nonminimal DER integer');
      if (number === 3 && (!length || b[content] > 7 || (length === 1 && b[content]) || (b[content] && (b[end - 1] & ((1 << b[content]) - 1))))) fail('Invalid DER bit string');
      if (number === 6) {
        if (!length || b[end - 1] & 128) fail('Invalid DER object identifier');
        let first = true;
        for (let i = content; i < end; i++) { if (first && b[i] === 128) fail('Nonminimal DER object identifier'); first = !(b[i] & 128); }
      }
    }
    const raw = b.subarray(start, end);
    if (f.set && f.previous && Buffer.compare(f.previous, raw) > 0) fail('Unsorted DER set');
    f.previous = raw; f.children++;
    if (constructed) frames.push({ end, depth: f.depth + 1, children: 0, set: cls === 0 && number === 17 });
    else offset = end;
  }
  return b;
}
function parseDER(bytes, type) {
  const raw = admitDER(bytes, type === X.KeyUsage ? 3 : 0x30), result = AsnParser.parse(ab(raw), type);
  if (!serialize(result).equals(raw)) fail('Noncanonical or unsupported ASN.1 representation');
  return result;
}
function decodePEM(pem, labels) {
  if (typeof pem !== 'string' || pem.length > 2 * 1024 * 1024) fail('Invalid PEM input');
  const match = /^\s*-----BEGIN ([A-Z ]+)-----\r?\n([A-Za-z0-9+/=\r\n]+)\r?\n-----END \1-----\s*$/.exec(pem);
  if (!match || !labels.includes(match[1])) fail('Unsupported or multiple PEM blocks');
  const encoded = match[2].replace(/[\r\n]/g, ''), raw = Buffer.from(encoded, 'base64');
  if (!raw.length || raw.toString('base64') !== encoded) fail('Invalid PEM base64');
  return { raw: admitDER(raw), label: match[1] };
}
function encodePEM(raw, label) {
  return `-----BEGIN ${label}-----\r\n${Buffer.from(raw).toString('base64').match(/.{1,64}/g).join('\r\n')}\r\n-----END ${label}-----\r\n`;
}
function rsaKey(key, type) {
  if (!(key instanceof crypto.KeyObject) || key.type !== type || key.asymmetricKeyType !== 'rsa') fail('Only ordinary RSA KeyObject keys are supported');
  return key;
}
function publicDER(key) { return rsaKey(key, 'public').export({ type: 'spki', format: 'der' }); }
function assertPair(pair) {
  rsaKey(pair.privateKey, 'private'); rsaKey(pair.publicKey, 'public');
  if (!publicDER(crypto.createPublicKey(pair.privateKey)).equals(publicDER(pair.publicKey))) fail('Private/public key mismatch');
}
function rsaAlgorithm(value, oid) {
  if (value.algorithm !== oid || (value.parameters !== undefined && value.parameters !== null && !Buffer.from(value.parameters).equals(Buffer.from([5, 0])))) fail('Unsupported RSA algorithm or parameters');
}
function signatureAlgorithm() { return new X.AlgorithmIdentifier({ algorithm: RSA_SHA256, parameters: ab([5, 0]) }); }
function commonName(value) {
  if (typeof value !== 'string' || !value.length || !value.isWellFormed() || Buffer.byteLength(value, 'utf8') > 4096 || /\0/.test(value)) fail('Invalid common name');
  const encoding = /^[A-Za-z0-9 '()+,\-./:=?]+$/.test(value) ? { printableString: value } : { utf8String: value };
  return new X.Name([new X.RelativeDistinguishedName([new X.AttributeTypeAndValue({ type: '2.5.4.3', value: new X.AttributeValue(encoding) })])]);
}
function subjectFields(name) {
  const fields = [];
  for (const rdn of name) for (const attr of rdn) fields.push(Object.freeze({ type: attr.type, value: attr.value.toString() }));
  return Object.freeze({ attributes: Object.freeze(fields), getField(oid) { return fields.find(field => field.type === ({ CN: '2.5.4.3', O: '2.5.4.10', OU: '2.5.4.11' }[oid] || oid)) || null; } });
}
function certModel(raw, requireRSA) {
  const schema = parseDER(raw, X.Certificate), native = new crypto.X509Certificate(raw);
  if (requireRSA) {
    rsaAlgorithm(schema.signatureAlgorithm, RSA_SHA256);
    rsaAlgorithm(schema.tbsCertificate.signature, RSA_SHA256);
    rsaAlgorithm(schema.tbsCertificate.subjectPublicKeyInfo.algorithm, RSA);
    rsaKey(native.publicKey, 'public');
  }
  const before = schema.tbsCertificate.validity.notBefore.getTime(), after = schema.tbsCertificate.validity.notAfter.getTime();
  if (!Number.isFinite(+before) || !Number.isFinite(+after) || +after <= +before) fail('Invalid certificate validity');
  const extensions = schema.tbsCertificate.extensions || [];
  if (new Set(extensions.map(e => e.extnID)).size !== extensions.length) fail('Duplicate certificate extension');
  const result = Object.freeze({ publicKey: native.publicKey, validity: Object.freeze({ get notBefore() { return new Date(+before); }, get notAfter() { return new Date(+after); } }), subject: subjectFields(schema.tbsCertificate.subject), issuer: subjectFields(schema.tbsCertificate.issuer) });
  certificates.set(result, { raw: Buffer.from(raw), schema, native, requireRSA }); return result;
}
function certificateState(value) { const state = certificates.get(value); if (!state || !state.requireRSA) fail('Expected native RSA signing certificate'); return state; }
function requestModel(raw) {
  const schema = parseDER(raw, C.CertificationRequest);
  if (schema.certificationRequestInfo.version !== 0) fail('Unsupported CSR version');
  rsaAlgorithm(schema.signatureAlgorithm, RSA_SHA256);
  rsaAlgorithm(schema.certificationRequestInfo.subjectPKInfo.algorithm, RSA);
  const publicKey = crypto.createPublicKey({ key: serialize(schema.certificationRequestInfo.subjectPKInfo), type: 'spki', format: 'der' });
  rsaKey(publicKey, 'public');
  const info = Buffer.from(schema.certificationRequestInfoRaw || serialize(schema.certificationRequestInfo));
  const verify = () => crypto.verify('sha256', info, { key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(schema.signature));
  if (!verify()) fail('Invalid CSR signature');
  const result = Object.freeze({ publicKey, subject: subjectFields(schema.certificationRequestInfo.subject), verify });
  requests.set(result, { schema, raw: Buffer.from(raw) }); return result;
}
function generateKeyPair() { return crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }); }
function convertKeyPairToPEM(pair) {
  assertPair(pair);
  return { privateKeyPEM: pair.privateKey.export({ type: 'pkcs1', format: 'pem' }).toString().replace(/\r?\n/g, '\r\n'), publicKeyPEM: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString().replace(/\r?\n/g, '\r\n') };
}
function convertPrivateKeyPEMToPrivateKey(pem) {
  const decoded = decodePEM(pem, ['RSA PRIVATE KEY', 'PRIVATE KEY']);
  if (decoded.label === 'PRIVATE KEY') {
    const parsed = ASN.fromBER(ab(decoded.raw));
    if (parsed.offset !== decoded.raw.length || !(parsed.result instanceof ASN.Sequence)) fail('Invalid PKCS8 structure');
    const children = parsed.result.valueBlock.value;
    if (children.length < 3 || !(children[0] instanceof ASN.Integer) || children[0].valueBlock.valueDec !== 0 || !(children[1] instanceof ASN.Sequence) || !(children[2] instanceof ASN.OctetString)) fail('Unsupported PKCS8 structure');
    rsaAlgorithm(parseDER(children[1].valueBeforeDecodeView, X.AlgorithmIdentifier), RSA);
  }
  return rsaKey(crypto.createPrivateKey(pem), 'private');
}
function convertPublicKeyPEMToPublicKey(pem) {
  const decoded = decodePEM(pem, ['RSA PUBLIC KEY', 'PUBLIC KEY']);
  if (decoded.label === 'PUBLIC KEY') rsaAlgorithm(parseDER(decoded.raw, X.SubjectPublicKeyInfo).algorithm, RSA);
  return rsaKey(crypto.createPublicKey(pem), 'public');
}
function convertKeyPairPEMToKeyPair({ privateKeyPEM, publicKeyPEM }) {
  const pair = { privateKey: convertPrivateKeyPEMToPrivateKey(privateKeyPEM), publicKey: convertPublicKeyPEMToPublicKey(publicKeyPEM) }; assertPair(pair); return pair;
}
function convertCertificatePEMToCertificate(pem) { return certModel(decodePEM(pem, ['CERTIFICATE']).raw, true); }
function convertCertificateToCertificatePEM(certificate) { return encodePEM(certificateState(certificate).raw, 'CERTIFICATE'); }
// iOS identity lookup only reads DN fields; it neither grants certificate trust
// nor constrains Apple certificates to the RSA development-signing profile.
function readCertificateSubject(pem) {
  if (typeof pem !== 'string' || pem.length > 2 * 1024 * 1024) fail('Invalid Apple certificate output');
  // `security find-certificate -c id -p` can return several matches. Preserve
  // the official caller's first-certificate behavior, separate from strict
  // signing/CSR admission. Do not skip an invalid or wrong-type first block.
  const first = /-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/.exec(pem);
  if (!first) fail('Missing Apple certificate PEM');
  return certModel(decodePEM(first[0], ['CERTIFICATE']).raw, false);
}
function convertCSRPEMToCSR(pem) { return requestModel(decodePEM(pem, ['CERTIFICATE REQUEST', 'NEW CERTIFICATE REQUEST']).raw); }
function convertCSRToCSRPEM(csr) { const state = requests.get(csr); if (!state) fail('Expected native CSR'); return encodePEM(state.raw, 'CERTIFICATE REQUEST'); }
function signingExtensions() {
  return new X.Extensions([
    new X.Extension({ extnID: X.id_ce_keyUsage, critical: true, extnValue: new OctetString(serialize(new X.KeyUsage(X.KeyUsageFlags.digitalSignature))) }),
    new X.Extension({ extnID: X.id_ce_extKeyUsage, critical: true, extnValue: new OctetString(serialize(new X.ExtendedKeyUsage([X.id_kp_codeSigning]))) })
  ]);
}
function makeCertificate(privateKey, publicKey, subject, issuer, before, after, extra = []) {
  rsaKey(privateKey, 'private'); rsaKey(publicKey, 'public');
  if (!(before instanceof Date) || !(after instanceof Date) || !Number.isFinite(+before) || !Number.isFinite(+after) || +after <= +before) fail('Invalid validity range');
  const draw = crypto.randomBytes(9); draw[0] &= 127;
  let first = 0; while (first < draw.length && draw[first] === 0) first++;
  if (first === draw.length) fail('All-zero serial draw refused');
  // Preserve the upstream masked numeric draw, with minimal positive DER sign
  // encoding. Leading-zero draws must not be changed into a different number.
  let serial = draw.subarray(first);
  if (serial[0] & 128) serial = Buffer.concat([Buffer.from([0]), serial]);
  const tbs = new X.TBSCertificate({ version: X.Version.v3, serialNumber: ab(serial), signature: signatureAlgorithm(), issuer, subject, validity: new X.Validity({ notBefore: before, notAfter: after }), subjectPublicKeyInfo: AsnParser.parse(ab(publicDER(publicKey)), X.SubjectPublicKeyInfo), extensions: new X.Extensions([...signingExtensions(), ...extra]) });
  const signature = crypto.sign('sha256', serialize(tbs), { key: privateKey, padding: crypto.constants.RSA_PKCS1_PADDING });
  return certModel(serialize(new X.Certificate({ tbsCertificate: tbs, signatureAlgorithm: signatureAlgorithm(), signatureValue: ab(signature) })), true);
}
function generateSelfSignedCodeSigningCertificate({ keyPair, validityNotBefore, validityNotAfter, commonName: cn }) {
  assertPair(keyPair); const name = commonName(cn);
  return makeCertificate(keyPair.privateKey, keyPair.publicKey, name, name, validityNotBefore, validityNotAfter);
}
function validateSelfSignedCertificate(certificate, pair) {
  const { schema, native } = certificateState(certificate); assertPair(pair);
  const tbs = schema.tbsCertificate, now = Date.now();
  if (!serialize(tbs.subject).equals(serialize(tbs.issuer)) || !native.verify(certificate.publicKey)) fail('Certificate is not self-signed');
  if (+certificate.validity.notBefore > now || +certificate.validity.notAfter < now) fail('Certificate outside validity range');
  if (!publicDER(certificate.publicKey).equals(publicDER(pair.publicKey))) fail('Certificate/key mismatch');
  const usage = tbs.extensions?.find(e => e.extnID === X.id_ce_keyUsage), extended = tbs.extensions?.find(e => e.extnID === X.id_ce_extKeyUsage);
  if (!usage || !parseDER(usage.extnValue.buffer, X.KeyUsage).toJSON().includes('digitalSignature')) fail('Missing digital-signature usage');
  if (!extended || !parseDER(extended.extnValue.buffer, X.ExtendedKeyUsage).includes(X.id_kp_codeSigning)) fail('Missing code-signing usage');
}
function signBufferRSASHA256AndVerify(privateKey, certificate, buffer) {
  certificateState(certificate); rsaKey(privateKey, 'private');
  if (!Buffer.isBuffer(buffer)) fail('Signing input must be a Buffer');
  const signature = crypto.sign('sha256', buffer, { key: privateKey, padding: crypto.constants.RSA_PKCS1_PADDING });
  if (!crypto.verify('sha256', buffer, { key: certificate.publicKey, padding: crypto.constants.RSA_PKCS1_PADDING }, signature)) fail('Signature/key mismatch');
  return signature.toString('base64');
}
function generateCSR(pair, cn) {
  assertPair(pair);
  const info = new C.CertificationRequestInfo({ subject: commonName(cn), subjectPKInfo: AsnParser.parse(ab(publicDER(pair.publicKey)), X.SubjectPublicKeyInfo) });
  const signature = crypto.sign('sha256', serialize(info), { key: pair.privateKey, padding: crypto.constants.RSA_PKCS1_PADDING });
  return requestModel(serialize(new C.CertificationRequest({ certificationRequestInfo: info, signatureAlgorithm: signatureAlgorithm(), signature: ab(signature) })));
}
function generateDevelopmentCertificateFromCSR(issuerPrivateKey, issuerCertificate, csr, appId, scopeKey) {
  const issuer = certificateState(issuerCertificate), request = requests.get(csr);
  if (!request || !csr.verify()) fail('Invalid CSR');
  assertPair({ privateKey: issuerPrivateKey, publicKey: issuerCertificate.publicKey });
  for (const value of [appId, scopeKey]) if (typeof value !== 'string' || !value.length || value.includes(',') || value.includes('\0') || Buffer.byteLength(value) > 4096) fail('Invalid Expo project scope');
  const extra = [new X.Extension({ extnID: expoProjectInformationOID, extnValue: new OctetString(Buffer.from(`${appId},${scopeKey}`, 'utf8')) })];
  // Preserve the published API's literal local-calendar calculation, including
  // month-boundary/DST behavior; this is not a management rotation policy.
  const before = new Date(); before.setDate(before.getDate() - 1);
  const after = new Date(); after.setDate(before.getDate() + 30);
  const result = makeCertificate(issuerPrivateKey, csr.publicKey, request.schema.certificationRequestInfo.subject, issuer.schema.tbsCertificate.subject, before, after, extra);
  if (!certificateState(result).native.verify(issuerCertificate.publicKey)) fail('Development certificate verification failed');
  return result;
}
module.exports = { expoProjectInformationOID, generateKeyPair, convertKeyPairToPEM, convertCertificateToCertificatePEM, convertKeyPairPEMToKeyPair, convertPublicKeyPEMToPublicKey, convertPrivateKeyPEMToPrivateKey, convertCertificatePEMToCertificate, convertCSRToCSRPEM, convertCSRPEMToCSR, generateSelfSignedCodeSigningCertificate, validateSelfSignedCertificate, signBufferRSASHA256AndVerify, generateCSR, generateDevelopmentCertificateFromCSR, readCertificateSubject };
