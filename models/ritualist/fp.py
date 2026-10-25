# Cuts first-person pieces (hand, forearm, upper arm per side) out of the rigged ritualist.
# Each piece is re-based so three.js can place it: origin at its distal joint, -Z (three) pointing
# down the limb. Hands get a 'grip' shape key that curls the fingers toward the palm.
import bpy, bmesh, numpy as np
from mathutils import Vector, Matrix
D='/tmp/claude-0/-home-claude/7f128bbb-226c-5ff2-abe7-379fab097e03/scratchpad/'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=D+'ritual/ritualist.glb')
rig=[o for o in bpy.context.scene.objects if o.type=='ARMATURE'][0]
src=[o for o in bpy.context.scene.objects if o.type=='MESH'][0]
mw=src.matrix_world.copy()
J={b.name:(rig.matrix_world@b.head_local) for b in rig.data.bones}
out=[]
def frame(fwd, up):
    fwd=fwd.normalized(); up=(up-fwd*up.dot(fwd)).normalized(); right=fwd.cross(up)
    return Matrix((right,fwd,up)).to_4x4()
def piece(side, part):
    ob=src.copy(); ob.data=src.data.copy(); bpy.context.scene.collection.objects.link(ob)
    ob.parent=None; ob.matrix_world=Matrix.Identity(4)
    for m in list(ob.modifiers): ob.modifiers.remove(m)
    me=ob.data; me.transform(mw); nv=len(me.vertices)
    W={k:np.zeros(nv) for k in ('upper','fore','hand')}
    gi={g.index:g.name for g in ob.vertex_groups}
    names={'upperarm.'+side:'upper','forearm.'+side:'fore','hand.'+side:'hand'}
    for v in me.vertices:
        for g in v.groups:
            k=names.get(gi[g.group])
            if k: W[k][v.index]+=g.weight
    stack=np.stack([W['upper'],W['fore'],W['hand']],1); tot=stack.sum(1); own=stack.argmax(1)
    want={'upper':0,'fore':1,'hand':2}[part]
    from PIL import Image
    img=np.array(Image.open(D+'ritual/base.jpg')).astype(int); Hh=img.shape[0]
    uv=np.zeros((nv,2)); li=np.zeros(len(me.loops),int); me.loops.foreach_get('vertex_index',li)
    uvl=np.zeros(len(me.loops)*2); me.uv_layers.active.data.foreach_get('uv',uvl); uv[li]=uvl.reshape(-1,2)
    px=img[np.clip(((1-uv[:,1])*Hh).astype(int),0,Hh-1),np.clip((uv[:,0]*Hh).astype(int),0,Hh-1)]
    white=px.min(1)>135
    bm=bmesh.new(); bm.from_mesh(me)
    sh,el,wr=J['upperarm.'+side],J['forearm.'+side],J['hand.'+side]
    seg={'upper':(sh,el),'fore':(el,wr),'hand':(wr,wr)}[part]
    A=np.array(seg[0]); B=np.array(seg[1]); AB=B-A
    Vall=np.array([v.co for v in me.vertices])
    tt=np.clip(((Vall-A)@AB)/max(AB@AB,1e-9),0,1); dist=np.linalg.norm(Vall-(A+tt[:,None]*AB),axis=1)
    def keep(f):
        ids=[v.index for v in f.verts]
        if part=='hand': return np.mean(W['hand'][ids])>=0.5
        if dist[ids].max()>0.085 or white[ids].any(): return False
        return min(tot[ids])>0.6 and np.bincount(own[ids],minlength=3).argmax()==want and np.mean(W['hand'][ids])<0.5
    bmesh.ops.delete(bm,geom=[f for f in bm.faces if not keep(f)],context='FACES')
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
    bm.to_mesh(me); bm.free(); ob.vertex_groups.clear()
    sh,el,wr=J['upperarm.'+side],J['forearm.'+side],J['hand.'+side]
    V=np.array([v.co for v in me.vertices])
    if part=='hand':
        # principal axes: longest = along the fingers, thinnest = palm normal (palms face up at rest)
        c=V-np.array(wr); u,s,vt=np.linalg.svd(c-c.mean(0),full_matrices=False)
        n=Vector(vt[2])
        if n.z<0: n=-n
        far=c[np.linalg.norm(c,axis=1)>np.percentile(np.linalg.norm(c,axis=1),70)]
        f=Vector(far.mean(0)); f=(f-n*f.dot(n)).normalized()
        R=frame(f,n); origin=wr
    elif part=='fore': R=frame(wr-el,Vector((0,0,1))); origin=wr
    else: R=frame(el-sh,Vector((0,0,1))); origin=el
    me.transform(Matrix.Translation(-origin)); me.transform(R)
    ob.name=part+side; ob.data.materials.clear()
    V=np.array([v.co for v in me.vertices])
    print(ob.name,len(V),'y',V[:,1].min().round(3),V[:,1].max().round(3),'x',V[:,0].min().round(3),V[:,0].max().round(3),'z',V[:,2].min().round(3),V[:,2].max().round(3))
    if part=='hand':
        L=V[:,1].max(); k=0.48*L; r=0.02; tmax=2.3
        ob.shape_key_add(name='Basis'); sk=ob.shape_key_add(name='grip')
        P=V.copy(); y,z=V[:,1],V[:,2]
        s_=np.clip(y-k,0,None); th=np.minimum(s_/r,tmax); extra=np.maximum(s_-tmax*r,0)
        rad=r-z
        ny=np.where(y>k,k+rad*np.sin(th)+extra*np.cos(th),y)
        nz=np.where(y>k,r-rad*np.cos(th)+extra*np.sin(th),z)
        P[:,1]=ny; P[:,2]=nz
        sk.data.foreach_set('co',P.ravel()); np.save(D+'ritual/'+ob.name+'_open.npy',V); np.save(D+'ritual/'+ob.name+'_grip.npy',P)
    out.append(ob)
for side in ('L','R'):
    for part in ('hand','fore','upper'): piece(side,part)
print('lengths upper',round((J['forearm.L']-J['upperarm.L']).length,3),'fore',round((J['hand.L']-J['forearm.L']).length,3))
for o in list(bpy.context.scene.objects):
    if o not in out: bpy.data.objects.remove(o,do_unlink=True)
for o in out: o.select_set(True)
np.save(D+'ritual/hand_dbg.npy',np.array([0]))
bpy.ops.export_scene.gltf(filepath=D+'ritual/fparms.glb',export_format='GLB',export_materials='NONE',use_selection=True,export_morph=True,export_morph_normal=True)
