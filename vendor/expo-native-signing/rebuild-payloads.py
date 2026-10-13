"""Reproduce this root's development-tool archives from retained public inputs.

Python 3.12+ standard library only. Installation uses Node; this optional offline
builder performs no network, npm, auth, keychain, certificate or device action.
"""
from pathlib import Path
import gzip,hashlib,io,json,tarfile
R=Path(__file__).parent
index=json.loads((R/'payload-integrity.json').read_bytes())
provenance=json.loads((R/'public-provenance.json').read_bytes())
upstream=(R/'official-expo-cli-57.0.27.tgz').read_bytes()
if hashlib.sha256(upstream).hexdigest()!=provenance['originalCLI']['archiveSha256']:raise ValueError('Official CLI input drift')
cli={};modes={}
with tarfile.open(fileobj=io.BytesIO(upstream),mode='r:gz') as tf:
    for m in tf.getmembers():
        if m.issym() or m.islnk() or '..' in Path(m.name).parts:raise ValueError('Unsupported upstream archive path')
        if m.isfile():
            path=str(Path(m.name).relative_to('package')).replace('\\','/');cli[path]=tf.extractfile(m).read();modes[path]=m.mode&0o777
security='build/src/run/ios/codeSigning/Security.js'
for name in [security,'package.json']:cli[name]=(R/'cli-adapted-assets'/name).read_bytes()
del cli[security+'.map'];del modes[security+'.map']
native={name:(R/'certificate-source'/name).read_bytes() for name in index['certificates']['files']}
def build(files,modes):
    stream=io.BytesIO()
    with tarfile.open(fileobj=stream,mode='w',format=tarfile.USTAR_FORMAT) as tf:
        for name,b in sorted(files.items()):
            info=tarfile.TarInfo('package/'+name);info.size=len(b);info.mode=modes.get(name,0o644);info.mtime=0;info.uid=info.gid=0;info.uname=info.gname='';tf.addfile(info,io.BytesIO(b))
    compressed=io.BytesIO()
    with gzip.GzipFile(fileobj=compressed,mode='wb',filename='',compresslevel=9,mtime=0) as gz:gz.write(stream.getvalue())
    return compressed.getvalue()
for kind,files,fileModes in [('cli',cli,modes),('certificates',native,{})]:
    expected=index[kind]
    if set(files)!=set(expected['files']):raise ValueError('Rebuild source population drift')
    for path,b in files.items():
        if hashlib.sha256(b).hexdigest()!=expected['files'][path]:raise ValueError('Rebuild source drift: '+path)
    raw=build(files,fileModes)
    if len(raw)!=expected['archiveBytes'] or hashlib.sha256(raw).hexdigest()!=expected['archiveSha256']:raise ValueError('Reproduced archive differs; preserve existing artifact and review builder/platform difference')
    output=R/expected['archive'];output.write_bytes(raw)
    print(kind,len(raw),hashlib.sha256(raw).hexdigest())
