import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const require=createRequire(import.meta.url);
if(process.argv[2]==='--public-worker') {
  const name=process.argv[3],chokidar=require('chokidar');
  const root=mkdtempSync(join(tmpdir(),'examples-chokidar-public-'));
  const previousCwd=process.cwd();process.chdir(root);
  mkdirSync('ordinary');writeFileSync('ordinary/a.js','ordinary');
  const complex='{'.repeat(200)+'a,b'+'}'.repeat(200);
  const options={cwd:root,usePolling:true,interval:20,persistent:false};
  const events=[],errors=[];let watcher,error,before,after,initialExistingEvents=[];
  const snapshot=w=>({closed:w.closed,readyCount:w._readyCount??null,closers:[...w._closers.keys()],watched:[...w._watched.keys()],streams:w._streams.size,ignoredPaths:[...w._ignoredPaths]});
  let supplied=complex;
  if(name==='negative')supplied='!'+complex;
  if(name==='ignored-function')options.ignored=()=>true;
  if(name==='ignored-all')options.ignored='**';
  if(name==='changing-ignore'){let calls=0;options.ignored=()=>calls++===0;}
  if(name==='stats-ignore')options.ignored=(_path,stats)=>stats===undefined;
  if(name==='disable-globbing') {
    options.disableGlobbing=true;
    // Preserve depth 200 while keeping literal components below NAME_MAX.
    supplied=['{'.repeat(100),'{'.repeat(100)+'a,b'+'}'.repeat(100),'}'.repeat(100)].join('/');
    assert.equal(supplied.replaceAll('/',''),complex);
    assert.ok(supplied.split('/').every(part=>Buffer.byteLength(part)<=255));
  }
  if(name==='ordinary')supplied='ordinary/*.{js,tsx}';
  if(['mixed','empty-add','existing-add','closed-add'].includes(name))supplied=['ordinary/**/*.js',complex];
  if(name==='positive-then-negative')supplied=[complex,'!'+complex];
  if(name==='negative-then-positive')supplied=['!'+complex,complex];
  if(name==='literal') {
    const parts=Array.from({length:4},()=>'{'.repeat(60));
    mkdirSync(join(root,...parts),{recursive:true});writeFileSync(join(root,...parts,'literal.js'),'literal');
    supplied=parts.join('/')+'/literal.js';
  }
  try {
    if(['empty-add','existing-add','closed-add'].includes(name)) {
      if(name==='existing-add') {
        mkdirSync('stable');writeFileSync('stable/stable.txt','stable');
        watcher=chokidar.watch('stable/*.txt',options);
      } else watcher=new chokidar.FSWatcher(options);
      watcher.on('all',(event,path)=>events.push({event,path}));watcher.on('error',e=>errors.push({code:e.code??null,name:e.name}));
      if(name==='existing-add') {
        await new Promise((done,fail)=>{const timer=setTimeout(()=>fail(new Error('Existing watcher ready deadline')),1500);watcher.once('ready',()=>{clearTimeout(timer);done();});});
        initialExistingEvents=[...events];events.length=0;
      }
      if(name==='closed-add')await watcher.close();
      before=snapshot(watcher);watcher.add(supplied);after=snapshot(watcher);
    } else {
      watcher=chokidar.watch(supplied,options);
      watcher.on('all',(event,path)=>events.push({event,path}));watcher.on('error',e=>errors.push({code:e.code??null,name:e.name}));
    }
  } catch(e) {error={name:e.name,code:e.code??null,message:e.message};if(watcher)after=snapshot(watcher);}
  await new Promise(done=>setTimeout(done,400));
  if(watcher)await watcher.close();
  await new Promise(done=>setImmediate(done));
  const report={name,error:error??null,events,errors,before,after,initialExistingEvents,atomicRefusal:before&&error?JSON.stringify(before)===JSON.stringify(after):null,unhandledListenerInstalled:false};
  process.chdir(previousCwd);
  const cleanup=resolve(root);assert.equal(dirname(cleanup),resolve(tmpdir()));assert.ok(basename(cleanup).startsWith('examples-chokidar-public-'));
  rmSync(cleanup,{recursive:true});
  console.log(JSON.stringify(report));
} else {
  const run=name=>{
    const child=spawnSync(process.execPath,[import.meta.filename,'--public-worker',name],{timeout:6000,maxBuffer:256*1024});
    assert.equal(child.status,0,`${name}: default child unhandled errors remain fatal; ${child.stderr}`);
    assert.equal(child.stderr.length,0,name);const report=JSON.parse(child.stdout.toString());
    assert.equal(report.unhandledListenerInstalled,false);assert.deepEqual(report.errors,[],name);return report;
  };
  test('Chokidar public watch rejects selected excessive brace globs synchronously before partial events',()=>{
    for(const name of ['complex','mixed','negative-then-positive']) {
      const report=run(name);assert.equal(report.error?.code,'ERR_CHOKIDAR_GLOB_COMPLEXITY',name);assert.deepEqual(report.events,[],name);
    }
  });
  test('Chokidar public add refuses mixed batches without changing new, active or closed watcher state',()=>{
    for(const name of ['empty-add','existing-add','closed-add']) {
      const report=run(name);assert.equal(report.error?.code,'ERR_CHOKIDAR_GLOB_COMPLEXITY',name);assert.equal(report.atomicRefusal,true,name);assert.deepEqual(report.events,[],name);
      if(name==='existing-add')assert.ok(report.initialExistingEvents.some(e=>e.event==='add'&&e.path.replaceAll('\\','/')==='stable/stable.txt'));
      if(name==='closed-add')assert.equal(report.after.closed,true);
    }
  });
  test('Chokidar selected ignore snapshots, negative ordering and disableGlobbing remain nonthrowing',()=>{
    for(const name of ['negative','ignored-function','ignored-all','changing-ignore','stats-ignore','disable-globbing','positive-then-negative']) {
      const report=run(name);assert.equal(report.error,null,name);assert.deepEqual(report.events,[],name);
    }
  });
  test('Chokidar ordinary braces and real non-glob brace directory names still produce file events',()=>{
    for(const name of ['ordinary','literal']) {
      const report=run(name);assert.equal(report.error,null,name);assert.ok(report.events.some(e=>e.event==='add'&&e.path.endsWith('.js')),name);
    }
  });
}
