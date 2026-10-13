import type { KeyObject } from 'node:crypto';
export interface NativeRSAKeyPair { privateKey: KeyObject; publicKey: KeyObject }
export interface SubjectField { readonly type: string; readonly value: string }
export interface NativeSubject { readonly attributes: readonly SubjectField[]; getField(oidOrShortName: string): SubjectField | null }
export interface NativeCertificate { readonly publicKey: KeyObject; readonly validity: { readonly notBefore: Date; readonly notAfter: Date }; readonly subject: NativeSubject; readonly issuer: NativeSubject }
export interface NativeCSR { readonly publicKey: KeyObject; readonly subject: NativeSubject; verify(): boolean }
export declare const expoProjectInformationOID: '1.2.840.113556.1.8000.2554.43437.254.128.102.157.7894389.20439.2.1';
export declare function generateKeyPair(): NativeRSAKeyPair;
export declare function convertKeyPairToPEM(pair: NativeRSAKeyPair): { privateKeyPEM: string; publicKeyPEM: string };
export declare function convertKeyPairPEMToKeyPair(pair: { privateKeyPEM: string; publicKeyPEM: string }): NativeRSAKeyPair;
export declare function convertPublicKeyPEMToPublicKey(pem: string): KeyObject;
export declare function convertPrivateKeyPEMToPrivateKey(pem: string): KeyObject;
export declare function convertCertificatePEMToCertificate(pem: string): NativeCertificate;
export declare function convertCertificateToCertificatePEM(certificate: NativeCertificate): string;
export declare function readCertificateSubject(pem: string): NativeCertificate;
export declare function convertCSRToCSRPEM(csr: NativeCSR): string;
export declare function convertCSRPEMToCSR(pem: string): NativeCSR;
export declare function generateSelfSignedCodeSigningCertificate(options: { keyPair: NativeRSAKeyPair; validityNotBefore: Date; validityNotAfter: Date; commonName: string }): NativeCertificate;
export declare function validateSelfSignedCertificate(certificate: NativeCertificate, pair: NativeRSAKeyPair): void;
export declare function signBufferRSASHA256AndVerify(privateKey: KeyObject, certificate: NativeCertificate, buffer: Buffer): string;
export declare function generateCSR(pair: NativeRSAKeyPair, commonName: string): NativeCSR;
export declare function generateDevelopmentCertificateFromCSR(issuerPrivateKey: KeyObject, issuerCertificate: NativeCertificate, csr: NativeCSR, appId: string, scopeKey: string): NativeCertificate;
