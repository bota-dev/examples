import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,mkdirSync,rmdirSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {verify,createHash} from 'node:crypto';
import {verifyNativeSigning} from './verify-native-expo-signing.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(join(root,'package.json'));
const cliPath=require.resolve('@expo/cli/package.json'),cliRequire=createRequire(cliPath),cli=dirname(cliPath);
const signing=cliRequire('@expo/code-signing-certificates');
const pair=signing.generateKeyPair(),pems=signing.convertKeyPairToPEM(pair);
const certificate=signing.generateSelfSignedCodeSigningCertificate({keyPair:pair,validityNotBefore:new Date(Date.now()-60000),validityNotAfter:new Date(Date.now()+86400000),commonName:'Synthetic Example Signing'});
const certificatePEM=signing.convertCertificateToCertificatePEM(certificate);
const codesigning=cliRequire(join(cli,'build/src/utils/codesigning.js'));
// Register the actual installed provider's public-contract regressions in this
// owning Node test runner. Nested runners inherit NODE_TEST_CONTEXT and can
// suppress their independent stdout; direct registration retains every result.
await import(pathToFileURL(cliRequire.resolve('@expo/code-signing-certificates/test-public-contract.cjs')).href);
test('mandatory artifact guard binds all installed CLI/certificate assets and absent Forge',()=>{
 const proof=verifyNativeSigning(root);assert.equal(proof.verifiedAssets,803);assert.equal(proof.lockForgeAbsent,true);assert.equal(proof.physicalForgeAbsent,true);
});
test('actual public Expo CLI manifest-signing caller produces independently verified UTF-8 signature',()=>{
 const manifest='{"synthetic":"Δ recording","items":[]}';
 const s=codesigning.signManifestString(manifest,{privateKey:pems.privateKeyPEM,certificateForPrivateKey:certificatePEM});
 assert.ok(verify('sha256',Buffer.from(manifest),pair.publicKey,Buffer.from(s,'base64')));
 assert.equal(verify('sha256',Buffer.from('tampered'),pair.publicKey,Buffer.from(s,'base64')),false);
});
test('actual local project-certificate caller preserves required key/algorithm and file validation',async()=>{
 const temporary=mkdtempSync(join(root,'.native-signing-test-'));
 try{
  const key=join(temporary,'key.pem'),cert=join(temporary,'certificate.pem');writeFileSync(key,pems.privateKeyPEM);writeFileSync(cert,certificatePEM);
  const exp={updates:{codeSigningCertificate:cert,codeSigningMetadata:{keyid:'synthetic-key',alg:'rsa-v1_5-sha256'}}};
  const info=await codesigning.getCodeSigningInfoAsync(exp,'keyid="synthetic-key", alg="rsa-v1_5-sha256"',key);
  assert.equal(info.keyId,'synthetic-key');assert.ok(info.privateKey===pems.privateKeyPEM,'Synthetic private key input preserved');assert.equal(info.certificateForPrivateKey,certificatePEM);assert.deepEqual(info.certificateChainForResponse,[]);
  await assert.rejects(()=>codesigning.getCodeSigningInfoAsync(exp,'keyid="different"',key),/keyid mismatch/);
  await assert.rejects(()=>codesigning.getCodeSigningInfoAsync(exp,'keyid="synthetic-key", alg="different"',key),/mismatch/);
  await assert.rejects(()=>codesigning.getCodeSigningInfoAsync(exp,'keyid="synthetic-key"'),/private-key-path/);
  writeFileSync(cert,'invalid');await assert.rejects(()=>codesigning.getCodeSigningInfoAsync(exp,'keyid="synthetic-key"',key),/PEM/);
 }finally{rmSync(temporary,{recursive:true,force:true});}
});
test('actual public CLI unsigned and embedded-key branches require no credential/network operation',async()=>{
 assert.equal(await codesigning.getCodeSigningInfoAsync({},undefined),null);
 await assert.rejects(()=>codesigning.getCodeSigningInfoAsync({},'keyid="expo-go"'),/embedded/);
 await assert.rejects(()=>codesigning.getCodeSigningInfoAsync({},'alg="rsa-v1_5-sha256"'),/keyid not present/);
});
test('actual Apple signing caller reads synthetic DER subject without running Keychain security',async()=>{
 const spawnPath=cliRequire.resolve('@expo/spawn-async'),before=require.cache[spawnPath],calls=[];
 require.cache[spawnPath]={id:spawnPath,filename:spawnPath,loaded:true,exports:async(command,args)=>{calls.push({command,args});return {stdout:certificatePEM};}};
 try{
  const security=cliRequire(join(cli,'build/src/run/ios/codeSigning/Security.js'));
  const info=await security.resolveCertificateSigningInfoAsync('synthetic-identity');
  assert.equal(info.codeSigningInfo,'Synthetic Example Signing');assert.equal(info.appleTeamName,undefined);assert.equal(info.appleTeamId,undefined);
  assert.deepEqual(calls,[{command:'security',args:['find-certificate','-c','synthetic-identity','-p']}]);
  assert.equal(security.extractSigningId('Apple Development: Synthetic (ABC123)'),'ABC123');
  assert.equal(security.extractCodeSigningInfo('  1) 123 "Apple Development: Synthetic (ABC123)"'),'Apple Development: Synthetic (ABC123)');
 }finally{if(before)require.cache[spawnPath]=before;else delete require.cache[spawnPath];}
});
test('artifact-byte drift refuses and restoration preserves the original exact archive',()=>{
 const index=JSON.parse(readFileSync(join(root,'vendor/expo-native-signing/payload-integrity.json'))),p=join(root,'vendor/expo-native-signing',index.certificates.archive),original=readFileSync(p);
 try{writeFileSync(p,Buffer.concat([original,Buffer.from('drift')]));assert.throws(()=>verifyNativeSigning(root),/archive drift/);}
 finally{writeFileSync(p,original);}
 assert.equal(createHash('sha256').update(readFileSync(p)).digest('hex'),index.certificates.archiveSha256);
});
test('unexpected physical Forge package refuses without weakening other mandatory guards',()=>{
 const p=join(root,'node_modules/node-forge');mkdirSync(p);
 try{assert.throws(()=>verifyNativeSigning(root),/Physical Forge/);}finally{rmdirSync(p);}
 const alias=join(root,'node_modules/forge-probe-alias');mkdirSync(alias);
 try{writeFileSync(join(alias,'package.json'),JSON.stringify({name:'node-forge',version:'1.4.0'}));assert.throws(()=>verifyNativeSigning(root),/Physical Forge manifest/);}
 finally{rmSync(join(alias,'package.json'));rmdirSync(alias);}
 assert.equal(verifyNativeSigning(root).physicalForgeAbsent,true);
});
