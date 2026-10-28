import {createRequire} from 'node:module';
import {readFileSync,readdirSync,realpathSync,statSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,join,resolve,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function verifyNativeSigning(root=resolve(dirname(fileURLToPath(import.meta.url)),'..')) {
  const vendor=join(root,'vendor/expo-native-signing');
  const index=JSON.parse(readFileSync(join(vendor,'payload-integrity.json')));
  const require=createRequire(join(root,'package.json'));
  const cliPath=require.resolve('@expo/cli/package.json');
  const cliRequire=createRequire(cliPath);
  const certificatePath=cliRequire.resolve('@expo/code-signing-certificates/package.json');
  const expoRequire=createRequire(require.resolve('expo/package.json'));
  if(realpathSync(expoRequire.resolve('@expo/cli/package.json'))!==realpathSync(cliPath)) throw Error('Expo resolves a different CLI');
  const packages=[['cli',cliPath],['certificates',certificatePath]];
  let verified=0;
  for(const[kind,path]of packages){
    const expected=index[kind],manifest=JSON.parse(readFileSync(path)),base=dirname(path);
    if(manifest.name!==expected.name||manifest.version!==expected.version||manifest.dependencies?.['node-forge'])throw Error('Unexpected native signing package identity');
    const archive=readFileSync(join(vendor,expected.archive));
    if(archive.length!==expected.archiveBytes||sha(archive)!==expected.archiveSha256)throw Error('Native signing source archive drift');
    const actual=[];const queue=[''];
    while(queue.length){
      const dir=queue.pop();
      for(const entry of readdirSync(join(base,dir),{withFileTypes:true})){
        const relative=(dir?dir+'/':'')+entry.name;
        if(entry.isSymbolicLink())throw Error('Unexpected signing package link');
        if(entry.isDirectory()){if(entry.name==='node_modules')continue;queue.push(relative);}
        else if(entry.isFile())actual.push(relative);else throw Error('Unexpected signing package file type');
      }
    }
    if(actual.length!==Object.keys(expected.files).length)throw Error('Native signing asset population mismatch');
    for(const relative of actual){if(sha(readFileSync(join(base,relative)))!==expected.files[relative])throw Error('Native signing installed asset drift: '+relative);verified++;}
  }
  if(sha(readFileSync(join(vendor,'public-provenance.json')))!==index.provenanceSha256)throw Error('Native signing public provenance drift');
  const lock=JSON.parse(readFileSync(join(root,'package-lock.json')));
  for(const[path,entry]of Object.entries(lock.packages||{}))if(path.split('node_modules/').at(-1)==='node-forge'||entry.name==='node-forge'||entry.dependencies?.['node-forge'])throw Error('Forge remains in owning lock');
  const queue=[join(root,'node_modules')],seen=new Set();let directories=0;
  while(queue.length){
    const dir=queue.pop(),physical=realpathSync(dir);if(seen.has(physical))continue;seen.add(physical);
    if(++directories>50000)throw Error('Installed graph traversal bound exceeded');
    const manifestPath=join(dir,'package.json');
    if(existsSync(manifestPath)&&JSON.parse(readFileSync(manifestPath)).name==='node-forge')throw Error('Physical Forge manifest remains');
    for(const e of readdirSync(dir,{withFileTypes:true})){
      if(e.name==='node-forge')throw Error('Physical Forge directory remains');
      const path=join(dir,e.name);
      if(e.isDirectory())queue.push(path);
      else if(e.isSymbolicLink()&&statSync(path).isDirectory()){
        const target=realpathSync(path),within=relative(realpathSync(root),target);
        if(within==='..'||within.startsWith('..\\')||within.startsWith('../'))throw Error('Installed graph link escapes owning root');
        queue.push(path);
      }
    }
  }
  return {verifiedAssets:verified,cliVersion:index.cli.version,certificateVersion:index.certificates.version,lockForgeAbsent:true,physicalForgeAbsent:true,physicalDirectoriesChecked:directories};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) console.log('Native Expo signing verified: '+JSON.stringify(verifyNativeSigning()));
