import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const main = require.resolve('braces');
const packageRoot = dirname(require.resolve('braces/package.json'));
const braces = require(main);
const installer = join(root, 'scripts/apply-braces-security.mjs');
const prefix = `const assert=require('node:assert/strict');const braces=require(${JSON.stringify(main)});const safe=e=>e instanceof SyntaxError&&e.code==='ERR_BRACES_COMPLEXITY';`;
function bounded(body) {
  const result = spawnSync(process.execPath, ['--stack-size=512', '--max-old-space-size=256', '-e', prefix + body], { encoding: 'utf8', timeout: 4000, maxBuffer: 64 * 1024 });
  assert.equal(result.error, undefined, String(result.error));
  assert.equal(result.status, 0, result.stderr);
}

test('installed package identity and strict complete source verification stay truthful', () => {
  assert.equal(require('braces/package.json').version, '3.0.3');
  assert.equal(require('braces/package.json').license, 'MIT');
  const result = spawnSync(process.execPath, [installer, '--verify'], { encoding: 'utf8', timeout: 4000 });
  assert.equal(result.status, 0, result.stderr);
  const status = JSON.parse(result.stdout);
  assert.ok(status.installed.length > 0);
  assert.equal(status.changedFiles, 0);
});

for (const method of ['parse', 'compile', 'expand', 'stringify']) {
  test(`${method} rejects excessive nesting even when caller options request no bound`, () => bounded(`for(const [open,close] of [['{','}'],['(',')'],['{','']]){const input=open.repeat(4000)+'x'+close.repeat(4000);assert.throws(()=>braces.${method}(input,{maxDepth:Infinity,rangeLimit:false}),safe);}`));
}
for (const method of ['compile', 'expand', 'stringify']) {
  test(`${method} validates deep and cyclic direct ASTs before recursion`, () => bounded(`const direct=require(${JSON.stringify(join(packageRoot, 'lib'))}+'/'+${JSON.stringify(method)});let deep={type:'text',value:'x'};for(let i=0;i<4000;i++)deep={type:'root',nodes:[deep]};assert.throws(()=>direct(deep),safe);const cycle={type:'root',nodes:[]};cycle.nodes.push(cycle);assert.throws(()=>direct(cycle),safe);`));
}
test('parser, AST depth and visit boundaries are explicit and cannot be disabled', () => bounded(`const nested=n=>'{'.repeat(n)+'x'+'}'.repeat(n);braces.parse(nested(128));assert.throws(()=>braces.parse(nested(129)),safe);for(const method of ['compile','expand','stringify']){braces[method](nested(127));assert.throws(()=>braces[method](nested(128)),safe);const make=n=>{let node={type:'text',value:'x'};while(n--)node={type:'root',nodes:[node]};return node;};braces[method](make(128));assert.throws(()=>braces[method](make(129)),safe);braces[method]({type:'root',nodes:Array.from({length:65535},()=>({type:'text',value:'x'}))});assert.throws(()=>braces[method]({type:'root',nodes:Array.from({length:65536},()=>({type:'text',value:'x'}))}),safe);}`));
test('parent metadata cannot supply a cyclic or foreign expansion queue', () => bounded(`const parent={type:'paren',nodes:[],queue:['foreign']};parent.parent=parent;assert.deepEqual(braces.expand({type:'root',nodes:[{type:'paren',nodes:[],parent}]}),[]);assert.deepEqual(braces.expand('{(a)'),['{(a)']);assert.deepEqual(parent.queue,['foreign']);`));
test('shared and repeated range ASTs retain arguments and children', () => {
  const range = braces.parse('{1..3}').nodes.find(node => node.type === 'brace');
  const ast = { type: 'root', nodes: [range, range] };
  assert.equal(braces.compile(ast), '([1-3])([1-3])');
  assert.equal(braces.compile(ast), '([1-3])([1-3])');
  const expected = ['11', '12', '13', '21', '22', '23', '31', '32', '33'];
  assert.deepEqual(braces.expand(ast), expected);
  assert.deepEqual(braces.expand(ast), expected);
  assert.equal(braces.stringify(ast), '{1..3}{1..3}');
});
test('ordinary range, quote, escape and existing rangeLimit behavior is preserved', () => {
  assert.deepEqual(braces.expand('a/{b,c}/d'), ['a/b/d', 'a/c/d']);
  assert.deepEqual(braces.expand('{01..03}'), ['01', '02', '03']);
  assert.deepEqual(braces.expand('{3..1}'), ['3', '2', '1']);
  assert.deepEqual(braces.expand('{a..e..2}'), ['a', 'c', 'e']);
  assert.deepEqual(braces.expand('{1..9..2}', { rangeLimit: false }), ['1', '3', '5', '7', '9']);
  // Published 3.0.3 also throws for combined explicit and option steps; this scoped guard preserves it.
  assert.throws(() => braces.expand('{1..9..2}', { rangeLimit: false, step: 2 }), RangeError);
  assert.throws(() => braces.expand('{1..1001}'), RangeError);
  assert.deepEqual(braces.expand('\\{'.repeat(2000) + 'x' + '\\}'.repeat(2000)), ['{'.repeat(2000) + 'x' + '}'.repeat(2000)]);
  assert.deepEqual(braces.expand('"' + '{'.repeat(2000) + 'x' + '}'.repeat(2000) + '"'), ['{'.repeat(2000) + 'x' + '}'.repeat(2000)]);
});
test('actual micromatch importer uses the guarded package and preserves matching', () => {
  const micromatch = require('micromatch');
  assert.equal(createRequire(require.resolve('micromatch')).resolve('braces'), main);
  assert.deepEqual(micromatch.braces('a/{b,c}/d'), ['a/(b|c)/d']);
  assert.deepEqual(micromatch.braceExpand('{01..03}'), ['01', '02', '03']);
  assert.deepEqual(micromatch(['src/a/a.ts', 'src/b/b.ts', 'src/c/a.ts'], 'src/{a,b}/*.ts'), ['src/a/a.ts', 'src/b/b.ts']);
  bounded(`const mm=require(${JSON.stringify(require.resolve('micromatch'))});for(const method of ['braces','braceExpand','parse'])assert.throws(()=>mm[method]('{'.repeat(4000)+'x'+'}'.repeat(4000)),safe);`);
});

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'bota-braces-security-'));
  mkdirSync(join(dir, 'scripts'));
  cpSync(installer, join(dir, 'scripts/apply-braces-security.mjs'));
  mkdirSync(join(dir, 'vendor'));
  cpSync(join(root, 'vendor/braces-security'), join(dir, 'vendor/braces-security'), { recursive: true });
  mkdirSync(join(dir, 'node_modules'));
  cpSync(packageRoot, join(dir, 'node_modules/braces'), { recursive: true });
  const provenance = JSON.parse(readFileSync(join(dir, 'vendor/braces-security/provenance.json')));
  writeFileSync(join(dir, 'package-lock.json'), JSON.stringify({ packages: { 'node_modules/braces': { version: provenance.version, integrity: provenance.integrity } } }));
  return dir;
}
function cleanup(dir) {
  assert.equal(dirname(dir), tmpdir());
  assert.ok(basename(dir).startsWith('bota-braces-security-'));
  rmSync(dir, { recursive: true, force: true });
}
function apply(dir, verify = false) {
  return spawnSync(process.execPath, [join(dir, 'scripts/apply-braces-security.mjs'), ...(verify ? ['--verify'] : [])], { encoding: 'utf8', timeout: 4000 });
}
test('complete preflight rejects later source drift before writing an earlier missing helper', () => {
  const dir = fixture();
  try {
    const helper = join(dir, 'node_modules/braces/lib/depth-guard.js');
    rmSync(helper);
    writeFileSync(join(dir, 'node_modules/braces/lib/stringify.js'), 'unrecognized runtime');
    assert.notEqual(apply(dir).status, 0);
    assert.equal(existsSync(helper), false);
  } finally { cleanup(dir); }
});
test('unknown identity, manifest, vendor bytes and unsafe lock paths fail before writes', () => {
  const mutations = [
    dir => { const path = join(dir, 'package-lock.json'); const value = JSON.parse(readFileSync(path)); value.packages['node_modules/braces'].version = '99.0.0'; writeFileSync(path, JSON.stringify(value)); },
    dir => writeFileSync(join(dir, 'node_modules/braces/package.json'), '{}'),
    dir => writeFileSync(join(dir, 'vendor/braces-security/lib/expand.js.source'), 'unrecognized vendor'),
    dir => { const path = join(dir, 'package-lock.json'); const value = JSON.parse(readFileSync(path)); value.packages['../outside/node_modules/braces'] = value.packages['node_modules/braces']; delete value.packages['node_modules/braces']; writeFileSync(path, JSON.stringify(value)); },
  ];
  for (const mutate of mutations) {
    const dir = fixture();
    try { const before = readFileSync(join(dir, 'node_modules/braces/lib/compile.js')); mutate(dir); assert.notEqual(apply(dir).status, 0); assert.deepEqual(readFileSync(join(dir, 'node_modules/braces/lib/compile.js')), before); }
    finally { cleanup(dir); }
  }
});
test('verification rejects partial application and known helper recovery is idempotent', () => {
  const dir = fixture();
  try {
    assert.equal(apply(dir, true).status, 0);
    rmSync(join(dir, 'node_modules/braces/lib/depth-guard.js'));
    assert.notEqual(apply(dir, true).status, 0);
    assert.equal(apply(dir).status, 0);
    assert.equal(JSON.parse(apply(dir).stdout).changedFiles, 0);
    assert.equal(apply(dir, true).status, 0);
  } finally { cleanup(dir); }
});
