# First-person arms as one skinned mesh per side (upper arm, forearm, hand), so elbows and wrists bend
# without seams. Bones are exported unparented so three.js can place each one directly in camera space.
# Hands get a 'grip' shape key that curls the fingers toward the palm.
import bpy, bmesh, numpy as np, json
from mathutils import Vector, Matrix
D='/tmp/claude-0/-home-claude/7f128bbb-226c-5ff2-abe7-379fab097e03/scratchpad/'
from PIL import Image
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=D+'ritual/ritualist.glb')
rig=[o for o in bpy.context.scene.objects if o.type=='ARMATURE'][0]
src=[o for o in bpy.context.scene.objects if o.type=='MESH'][0]
mw=src.matrix_world.copy()
RB={b.name:(rig.matrix_world@b.head_local, rig.matrix_world@b.tail_local) for b in rig.data.bones}
img=np.array(Image.open(D+'ritual/base.jpg')).astype(int); Hh=img.shape[0]
def to3(v): return [round(v[0],5), round(v[2],5), round(-v[1],5)]   # blender -> three.js axes
out=[]; meta={}
for side in ('L','R'):
    bn=['upperarm.'+side,'forearm.'+side,'hand.'+side]
    ob=src.copy(); ob.data=src.data.copy(); bpy.context.scene.collection.objects.link(ob)
    ob.parent=None; ob.matrix_world=Matrix.Identity(4)
    for m in list(ob.modifiers): ob.modifiers.remove(m)
    me=ob.data; me.transform(mw); nv=len(me.vertices)
    gi={g.index:g.name for g in ob.vertex_groups}
    Wt=np.zeros((nv,3))
    for v in me.vertices:
        for g in v.groups:
            n=gi[g.group]
            if n in bn: Wt[v.index,bn.index(n)]+=g.weight
    tot=Wt.sum(1)
    V=np.array([v.co for v in me.vertices])
    def segd(a,b):
        a=np.array(a); b=np.array(b); ab=b-a; t=np.clip(((V-a)@ab)/max(ab@ab,1e-9),0,1); return np.linalg.norm(V-(a+t[:,None]*ab),axis=1)
    near=np.minimum.reduce([segd(*RB[n]) for n in bn])
    uv=np.zeros((nv,2)); li=np.zeros(len(me.loops),int); me.loops.foreach_get('vertex_index',li)
    uvl=np.zeros(len(me.loops)*2); me.uv_layers.active.data.foreach_get('uv',uvl); uv[li]=uvl.reshape(-1,2)
    px=img[np.clip(((1-uv[:,1])*Hh).astype(int),0,Hh-1),np.clip((uv[:,0]*Hh).astype(int),0,Hh-1)]
    white=px.min(1)>135
    bm=bmesh.new(); bm.from_mesh(me)
    def keep(f):
        ids=[v.index for v in f.verts]
        return tot[ids].min()>0.6 and near[ids].max()<0.085 and not white[ids].any()
    bmesh.ops.delete(bm,geom=[f for f in bm.faces if not keep(f)],context='FACES')
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
    bm.to_mesh(me); bm.free()
    # keep only the three arm groups, renormalised
    for g in list(ob.vertex_groups):
        if g.name not in bn: ob.vertex_groups.remove(g)
    V=np.array([v.co for v in me.vertices]); nv=len(V)
    Wk=np.zeros((nv,3)); gi={g.index:bn.index(g.name) for g in ob.vertex_groups}
    for v in me.vertices:
        for g in v.groups: Wk[v.index,gi[g.group]]=g.weight
    Wk/=np.maximum(Wk.sum(1,keepdims=True),1e-6)
    for g in ob.vertex_groups:
        k=bn.index(g.name)
        for i in range(nv): g.add([i],float(Wk[i,k]),'REPLACE')
    # hand frame: palm normal = thinnest axis of the hand verts, forward = toward the fingertips
    wr=RB['hand.'+side][0]; hm=Wk[:,2]>0.5; c=V[hm]-np.array(wr)
    u,s,vt=np.linalg.svd(c-c.mean(0),full_matrices=False); n=Vector(vt[2])
    if n.z<0: n=-n
    far=c[np.linalg.norm(c,axis=1)>np.percentile(np.linalg.norm(c,axis=1),70)]
    f=Vector(far.mean(0)); f=(f-n*f.dot(n)).normalized(); r=f.cross(n)
    # grip shape key: bend the fingers (beyond the knuckles) round a 2 cm radius toward the palm
    loc=np.stack([(V-np.array(wr))@np.array(r),(V-np.array(wr))@np.array(f),(V-np.array(wr))@np.array(n)],1)
    L=loc[hm,1].max(); k=0.48*L; rad0=0.02; tmax=2.3
    y,z=loc[:,1],loc[:,2]; s_=np.clip(y-k,0,None); th=np.minimum(s_/rad0,tmax); extra=np.maximum(s_-tmax*rad0,0)
    rr=rad0-z; bend=(y>k)&(Wk[:,2]>0.3)
    ny=np.where(bend,k+rr*np.sin(th)+extra*np.cos(th),y); nz=np.where(bend,rad0-rr*np.cos(th)+extra*np.sin(th),z)
    P=np.array(wr)+np.outer(loc[:,0],r)+np.outer(ny,f)+np.outer(nz,n)
    ob.shape_key_add(name='Basis'); sk=ob.shape_key_add(name='grip'); sk.data.foreach_set('co',P.ravel())
    # armature with the three bones, unparented
    arm=bpy.data.armatures.new('fpRig'+side); ao=bpy.data.objects.new('fpRig'+side,arm); bpy.context.scene.collection.objects.link(ao)
    bpy.context.view_layer.objects.active=ao; bpy.ops.object.mode_set(mode='EDIT')
    for b in bn:
        eb=arm.edit_bones.new(b); eb.head=RB[b][0]; eb.tail=RB[b][1]
    bpy.ops.object.mode_set(mode='OBJECT')
    ob.parent=ao; md=ob.modifiers.new('Armature','ARMATURE'); md.object=ao
    ob.name='fpArm'+side; ob.data.materials.clear()
    sh,el=RB['upperarm.'+side][0],RB['forearm.'+side][0]
    meta[side]={'shoulder':to3(sh),'elbow':to3(el),'wrist':to3(wr),'handFwd':to3(f),'palm':to3(n)}
    print(side,'verts',nv,'hand verts',int(hm.sum()))
    out+= [ob,ao]
for o in list(bpy.context.scene.objects):
    if o not in out: bpy.data.objects.remove(o,do_unlink=True)
for o in out: o.select_set(True)
json.dump(meta,open(D+'ritual/fp_meta.json','w'))
print(json.dumps(meta))
bpy.ops.export_scene.gltf(filepath=D+'ritual/fparms2.glb',export_format='GLB',export_materials='NONE',use_selection=True,export_skins=True,export_morph=True,export_morph_normal=True,export_animations=False)
