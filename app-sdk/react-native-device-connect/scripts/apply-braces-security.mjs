import {createHash} from 'node:crypto';
import {readFileSync,existsSync,readdirSync,realpathSync,statSync} from 'node:fs';
import {dirname,join,resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const within=(base,target)=>{const p=relative(base,target);return p!=='..'&&!p.startsWith('../')&&!p.startsWith('..\\')&&!isAbsolute(p);};
const alias=value=>typeof value==='string'&&/^npm:braces(?:@|$)/i.test(value);
const archiveUrl=value=>typeof value==='string'&&/^https:\/\/registry\.npmjs\.org\/braces\/-\/braces-/i.test(value);
function inspectDeclarations(value){
  if(!value||typeof value!=='object')return;
  for(const[key,child]of Object.entries(value)){
    if(key==='braces'||alias(child)||archiveUrl(child))throw Error('Braces declaration remains');
    inspectDeclarations(child);
  }
}
export function verifyMetroPublicParents(root=resolve(dirname(fileURLToPath(import.meta.url)),'..')){
  const physicalRoot=realpathSync(root),vendor=join(root,'vendor/metro-public-matching'),physicalVendor=realpathSync(vendor);
  if(!within(physicalRoot,physicalVendor))throw Error('Metro vendor escapes owning root');
  if(!within(physicalVendor,realpathSync(join(vendor,'provenance.json'))))throw Error('Metro provenance escapes vendor');
  const provenance=JSON.parse(readFileSync(join(vendor,'provenance.json')));
  const lock=JSON.parse(readFileSync(join(root,'package-lock.json')));
  inspectDeclarations(JSON.parse(readFileSync(join(root,'package.json'))));
  for(const[p,r]of Object.entries(lock.packages||{})){
    if(p.split('/').some(part=>part.toLowerCase()==='braces')||r.name==='braces'||archiveUrl(r.resolved))throw Error('Braces remains in owning lock');
    for(const section of ['dependencies','optionalDependencies','devDependencies','peerDependencies'])inspectDeclarations(r[section]);
  }
  let verifiedAssets=0;
  for(const parent of provenance.parentArtifacts){
    const archive=join(vendor,parent.derivedArchive);
    if(!within(physicalVendor,realpathSync(archive)))throw Error('Metro archive escapes vendor');
    const bytes=readFileSync(archive);
    if(bytes.length!==parent.derivedBytes||hash(bytes)!==parent.derivedSha256||'sha512-'+createHash('sha512').update(bytes).digest('base64')!==parent.derivedIntegrity)throw Error('Metro source archive drift');
    const row=lock.packages?.[parent.lockedPath];
    if(!row||row.version!==parent.version||row.integrity!==parent.derivedIntegrity||row.resolved!=='file:vendor/metro-public-matching/'+parent.derivedArchive||row.dependencies?.micromatch||row.dependencies?.picomatch!=='2.3.2')throw Error('Unexpected Metro locked parent');
    const base=join(root,parent.lockedPath);if(!existsSync(base))throw Error('Expected Metro installed parent missing');
    const physical=realpathSync(base);if(!within(physicalRoot,physical))throw Error('Metro installed parent escapes owning root');
    const manifest=JSON.parse(readFileSync(join(base,'package.json')));
    if(manifest.name!==parent.name||manifest.version!==parent.version||manifest.dependencies?.micromatch||manifest.dependencies?.picomatch!=='2.3.2')throw Error('Unexpected Metro parent manifest');
    const actual=[];const queue=[''];
    while(queue.length){
      const dir=queue.pop();for(const entry of readdirSync(join(base,dir),{withFileTypes:true})){
        const p=(dir?dir+'/':'')+entry.name;
        if(entry.isSymbolicLink())throw Error('Unexpected Metro asset link');
        if(entry.isDirectory()){if(entry.name!=='node_modules')queue.push(p);}
        else if(entry.isFile())actual.push(p);else throw Error('Unexpected Metro asset kind');
      }
    }
    if(actual.length!==parent.files.length)throw Error('Metro asset population mismatch');
    const expected=new Map(parent.files.map(f=>[f.path,f]));
    for(const p of actual){const f=expected.get(p);if(!f||hash(readFileSync(join(base,p)))!==f.sha256)throw Error('Metro installed asset drift: '+p);verifiedAssets++;}
    const matcherManifest=createRequire(join(base,'package.json')).resolve('picomatch/package.json');
    if(!within(physicalRoot,realpathSync(matcherManifest)))throw Error('Metro matcher escapes owning root');
    const matcher=JSON.parse(readFileSync(matcherManifest)),matcherBase=dirname(matcherManifest);
    if(matcher.name!=='picomatch'||matcher.version!==provenance.matcher.version)throw Error('Unexpected Metro matcher identity');
    for(const file of provenance.matcher.files){const target=join(matcherBase,file.path);if(!within(realpathSync(matcherBase),realpathSync(target))||hash(readFileSync(target))!==file.sha256)throw Error('Metro matcher asset drift');}
  }
  const nodes=join(root,'node_modules');if(!existsSync(nodes))throw Error('Expected owning installed tree missing');
  const queue=[nodes],seen=new Set();let directories=0;
  while(queue.length){
    const dir=queue.pop(),physical=realpathSync(dir);if(!within(physicalRoot,physical))throw Error('Installed graph escapes owning root');if(seen.has(physical))continue;seen.add(physical);
    if(++directories>50000)throw Error('Installed graph traversal bound exceeded');
    const manifestPath=join(dir,'package.json');if(existsSync(manifestPath)){
      if(!within(physical,realpathSync(manifestPath)))throw Error('Installed manifest escapes package');
      if(JSON.parse(readFileSync(manifestPath)).name==='braces')throw Error('Physical braces manifest remains');
    }
    for(const entry of readdirSync(dir,{withFileTypes:true})){
      if(entry.name.toLowerCase()==='braces')throw Error('Physical braces directory remains');
      const target=join(dir,entry.name);if(entry.isDirectory()||(entry.isSymbolicLink()&&statSync(target).isDirectory()))queue.push(target);
    }
  }
  return {guard:'exact public Metro some parents and zero braces',verifiedAssets,lockBracesAbsent:true,physicalBracesAbsent:true,physicalDirectoriesChecked:directories,picomatchVersion:'2.3.2',mode:'read-only'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  if(process.argv.slice(2).some(arg=>arg!=='--verify'))throw Error('Unknown Metro guard argument');
  console.log(JSON.stringify(verifyMetroPublicParents()));
}
