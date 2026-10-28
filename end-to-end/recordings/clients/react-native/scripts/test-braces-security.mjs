import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync,symlinkSync,readdirSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {verifyMetroPublicParents} from './apply-braces-security.mjs';

const owningRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const vendor=join(owningRoot,'vendor/metro-public-matching');
const provenance=JSON.parse(readFileSync(join(vendor,'provenance.json')));
const assets=JSON.parse(readFileSync(join(vendor,'public-assets-fixture.json')));
const sha=b=>createHash('sha256').update(b).digest('hex');
function write(path,bytes){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,bytes);}
function fixture(){
  const root=mkdtempSync(join(tmpdir(),'examples-public-metro-'));
  write(join(root,'package.json'),JSON.stringify({name:'public-parent-test',private:true}));
  const packages={'':{name:'public-parent-test'}};
  for(const parent of provenance.parentArtifacts){
    packages[parent.lockedPath]={name:parent.name,version:parent.version,resolved:'file:vendor/metro-public-matching/'+parent.derivedArchive,integrity:parent.derivedIntegrity,dependencies:{picomatch:'2.3.2'}};
    write(join(root,'vendor/metro-public-matching',parent.derivedArchive),readFileSync(join(vendor,parent.derivedArchive)));
  }
  packages['node_modules/picomatch']={version:'2.3.2',integrity:provenance.matcher.integrity};
  write(join(root,'package-lock.json'),JSON.stringify({lockfileVersion:3,packages}));
  write(join(root,'vendor/metro-public-matching/provenance.json'),JSON.stringify(provenance));
  for(const[base,files]of Object.entries(assets))for(const[p,value]of Object.entries(files))write(join(root,base,p),Buffer.from(value,'base64'));
  return root;
}
function run(fn){const root=fixture();try{return fn(root);}finally{rmSync(root,{recursive:true,force:true});}}
function lockChange(root,fn){const p=join(root,'package-lock.json'),d=JSON.parse(readFileSync(p));fn(d);writeFileSync(p,JSON.stringify(d));}
function refuse(label,change,match){test(label,()=>run(root=>{change(root);assert.throws(()=>verifyMetroPublicParents(root),match);}));}
test('Complete public source assets and literal matcher verify without writes',()=>run(root=>{
  const before=provenance.parentArtifacts.map(p=>sha(readFileSync(join(root,p.lockedPath,'package.json'))));
  assert.deepEqual(verifyMetroPublicParents(root).verifiedAssets,218);
  assert.deepEqual(verifyMetroPublicParents(root).verifiedAssets,218);
  assert.deepEqual(provenance.parentArtifacts.map(p=>sha(readFileSync(join(root,p.lockedPath,'package.json')))),before);
}));
refuse('Canonical locked braces refuses',root=>lockChange(root,d=>d.packages['node_modules/braces']={version:'3.0.3'}),/Braces remains/);
refuse('Aliased locked manifest name refuses',root=>lockChange(root,d=>d.packages['node_modules/renamed']={name:'braces'}),/Braces remains/);
refuse('Nested scoped locked braces refuses',root=>lockChange(root,d=>d.packages['node_modules/@scope/parent/node_modules/braces']={}),/Braces remains/);
refuse('Locked public braces tar under another identity refuses',root=>lockChange(root,d=>d.packages['node_modules/renamed']={resolved:'https://registry.npmjs.org/braces/-/braces-3.0.3.tgz'}),/Braces remains/);
refuse('Declared npm alias in owning manifest refuses',root=>writeFileSync(join(root,'package.json'),JSON.stringify({dependencies:{renamed:'npm:braces@3.0.3'}})),/Braces declaration/);
refuse('Transitive optional braces declaration refuses',root=>lockChange(root,d=>d.packages['node_modules/picomatch'].optionalDependencies={braces:'3.0.3'}),/Braces declaration/);
refuse('Unregistered physical alias manifest refuses',root=>write(join(root,'node_modules/renamed/package.json'),JSON.stringify({name:'braces'})),/Physical braces manifest/);
refuse('Nested physical alias manifest refuses',root=>write(join(root,'node_modules/renamed/node_modules/hidden/package.json'),JSON.stringify({name:'braces'})),/Physical braces manifest/);
refuse('Physical braces directory without a manifest refuses',root=>mkdirSync(join(root,'node_modules/braces')),/Physical braces directory/);
refuse('Uppercase physical braces directory refuses',root=>mkdirSync(join(root,'node_modules/BRACES')),/Physical braces directory/);
refuse('Unknown public parent archive bytes refuse',root=>writeFileSync(join(root,'vendor/metro-public-matching',provenance.parentArtifacts[0].derivedArchive),'drift'),/Metro source archive drift/);
refuse('Parent source helper drift refuses',root=>writeFileSync(join(root,provenance.parentArtifacts[0].lockedPath,'public-micromatch-some.cjs'),'drift'),/Metro installed asset drift/);
refuse('Parent manifest dependency drift refuses',root=>{const p=join(root,provenance.parentArtifacts[0].lockedPath,'package.json'),d=JSON.parse(readFileSync(p));d.dependencies.micromatch='4.0.8';writeFileSync(p,JSON.stringify(d));},/Unexpected Metro parent manifest/);
refuse('Additional parent source asset refuses',root=>write(join(root,provenance.parentArtifacts[0].lockedPath,'additional.js'),'drift'),/Metro asset population/);
refuse('Missing required installed parent refuses',root=>rmSync(join(root,provenance.parentArtifacts[0].lockedPath),{recursive:true,force:true}),/Expected Metro installed parent missing/);
refuse('Missing required locked parent refuses',root=>lockChange(root,d=>delete d.packages[provenance.parentArtifacts[0].lockedPath]),/Unexpected Metro locked parent/);
refuse('Matcher source drift refuses',root=>writeFileSync(join(root,'node_modules/picomatch/index.js'),'drift'),/Metro matcher asset drift/);
refuse('Matcher version drift refuses',root=>{const p=join(root,'node_modules/picomatch/package.json'),d=JSON.parse(readFileSync(p));d.version='4.0.7';writeFileSync(p,JSON.stringify(d));},/Unexpected Metro matcher identity/);
test('Escaping installed directory link refuses before traversal',()=>run(root=>{
  const outside=mkdtempSync(join(tmpdir(),'examples-metro-external-'));try{symlinkSync(outside,join(root,'node_modules/escape'),'junction');assert.throws(()=>verifyMetroPublicParents(root),/Installed graph escapes/);}finally{rmSync(outside,{recursive:true,force:true});}
}));
test('Escaping physical manifest link refuses before reading contents',()=>run(root=>{
  const target=join(root,'external-manifest-directory');mkdirSync(target);
  const dir=join(root,'node_modules/linked-manifest');mkdirSync(dir);symlinkSync(target,join(dir,'package.json'),'junction');
  assert.throws(()=>verifyMetroPublicParents(root),/Installed manifest escapes package/);
}));
