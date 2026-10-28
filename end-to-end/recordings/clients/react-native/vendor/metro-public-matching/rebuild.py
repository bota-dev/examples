from pathlib import Path
import argparse,base64,gzip,hashlib,io,json,tarfile
P=Path(__file__).parent
def sha(b):return hashlib.sha256(b).hexdigest()
def rebuild(output):
 provenance=json.loads((P/'provenance.json').read_bytes())
 literal=base64.b64decode(provenance['literalSome']['rawBase64']);assert sha(literal)==provenance['literalSome']['sha256']
 shim=b"'use strict';\n// MIT source: micromatch 4.0.8; literal .some implementation, same picomatch 2.3.2.\nconst picomatch = require('picomatch');\nconst micromatch = {};\n"+literal+b'\nmodule.exports = micromatch;\n'
 for parent in provenance['parentArtifacts']:
  source=(P/parent['upstreamArchive']).read_bytes();assert sha(source)==parent['upstreamSha256']
  with tarfile.open(fileobj=io.BytesIO(source),mode='r:gz') as tar:
   members={}
   for m in tar.getmembers():
    assert m.isfile() or m.isdir();assert m.name.startswith('package/') and '..' not in m.name.split('/')
    if m.isfile():members[m.name]={'mode':m.mode,'bytes':tar.extractfile(m).read()}
  files={p:r['bytes'] for p,r in members.items()};manifest=json.loads(files['package/package.json']);assert manifest['name']==parent['name'] and manifest['version']==parent['version'];assert manifest['dependencies'].pop('micromatch')=='^4.0.4';manifest['dependencies']['picomatch']='2.3.2';files['package/package.json']=(json.dumps(manifest,indent=2)+'\n').encode()
  for relative in parent['changedOriginalPaths']:
   if relative=='package.json':continue
   path='package/'+relative;before=files[path]
   if path.endswith('.flow'):files[path]=before.replace(b"import micromatch from 'micromatch';",b"import micromatch from '../../public-micromatch-some.cjs';").replace(b'Write libdefs for `micromatch`',b'Public literal micromatch.some compatibility helper')
   else:files[path]=before.replace(b'require("micromatch")',b'require("../../public-micromatch-some.cjs")')
  files['package/public-micromatch-some.cjs']=shim
  fixture=json.loads((P/'public-assets-fixture.json').read_bytes());licenseBytes=base64.b64decode(fixture[parent['lockedPath']]['PUBLIC-MICROMATCH-SOME-LICENSE']);assert sha(licenseBytes)==provenance['literalSome']['licenseSha256'];files['package/PUBLIC-MICROMATCH-SOME-LICENSE']=licenseBytes
  buf=io.BytesIO()
  with tarfile.open(fileobj=buf,mode='w',format=tarfile.USTAR_FORMAT) as tar:
   for path,b in sorted(files.items()):
    m=tarfile.TarInfo(path);m.size=len(b);m.mode=members.get(path,{}).get('mode',0o644);m.mtime=0;m.uid=m.gid=0;m.uname=m.gname='';tar.addfile(m,io.BytesIO(b))
  data=gzip.compress(buf.getvalue(),mtime=0);assert sha(data)==parent['derivedSha256'] and len(data)==parent['derivedBytes'];output.mkdir(parents=True,exist_ok=True);(output/parent['derivedArchive']).write_bytes(data);print(parent['name'],parent['version'],len(data),sha(data))
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--output-dir',type=Path,required=True);args=parser.parse_args();rebuild(args.output_dir)
