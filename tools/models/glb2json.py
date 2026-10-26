"""Converts .glb files to self-contained glTF JSON (buffer as a data URI) saved with a .json name, for hosts
that only serve text types (the claude.ai artifact copy of the game). Usage: glb2json.py <out_dir> <a.glb>..."""
import sys, json, struct, base64, os
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
for f in sys.argv[2:]:
    d = open(f, 'rb').read()
    jl = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20 + jl])
    bl = struct.unpack('<I', d[20 + jl:24 + jl])[0]; b = d[28 + jl:28 + jl + bl]
    j['buffers'][0]['uri'] = 'data:application/octet-stream;base64,' + base64.b64encode(b).decode()
    open(os.path.join(out, os.path.basename(f)[:-4] + '.json'), 'w').write(json.dumps(j, separators=(',', ':')))
