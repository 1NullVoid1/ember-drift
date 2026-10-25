import bpy, numpy as np, sys
from mathutils import Vector
D='/tmp/claude-0/-home-claude/7f128bbb-226c-5ff2-abe7-379fab097e03/scratchpad/'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=D+'ritual_in/254ad3eaf19366e4a574d9fe3912e684.obj')
ob=[o for o in bpy.context.scene.objects if o.type=='MESH'][0]
ob.name='Ritualist'
S=1.75
ob.scale=(S,S,S); bpy.context.view_layer.objects.active=ob; ob.select_set(True)
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
for p in ob.data.polygons: p.use_smooth=True
# joints in OBJ space (x, y-up, z-forward) -> blender (x, -z, y), scaled
def J(x,y,z): return np.array([x,-z,y])*S
cz=0.07
bones={ # name: (head, tail, parent, radius, cap)
 'hips':  (J(0.015,0.48,cz), J(0.015,0.62,cz), None, 0.11, None),
 'spine': (J(0.015,0.62,cz), J(0.015,0.74,cz+0.01), 'hips', 0.10, None),
 'chest': (J(0.015,0.74,cz+0.01), J(0.015,0.845,cz), 'spine', 0.10, None),
 'neck':  (J(0.015,0.845,cz), J(0.015,0.9,cz+0.01), 'chest', 0.05, None),
 'head':  (J(0.015,0.9,cz+0.01), J(0.015,1.03,cz+0.01), 'neck', 0.08, None),
 'upperarm.R': (J(-0.08,0.815,cz), J(-0.145,0.69,cz+0.01), 'chest', 0.04, 0.075),
 'forearm.R':  (J(-0.145,0.69,cz+0.01), J(-0.17,0.585,cz+0.02), 'upperarm.R', 0.035, 0.07),
 'hand.R':     (J(-0.17,0.585,cz+0.02), J(-0.215,0.54,cz+0.03), 'forearm.R', 0.035, 0.07),
 'upperarm.L': (J(0.11,0.815,cz), J(0.17,0.69,cz+0.01), 'chest', 0.04, 0.075),
 'forearm.L':  (J(0.17,0.69,cz+0.01), J(0.2,0.585,cz+0.02), 'upperarm.L', 0.035, 0.07),
 'hand.L':     (J(0.2,0.585,cz+0.02), J(0.245,0.54,cz+0.03), 'forearm.L', 0.035, 0.07),
 'thigh.R': (J(-0.03,0.5,0.09), J(-0.035,0.27,0.05), 'hips', 0.05, 0.075),
 'shin.R':  (J(-0.035,0.27,0.05), J(0.0,0.06,0.05), 'thigh.R', 0.04, 0.06),
 'foot.R':  (J(0.0,0.06,0.05), J(0.0,0.01,0.16), 'shin.R', 0.035, 0.06),
 'thigh.L': (J(0.06,0.5,0.1), J(0.058,0.28,0.11), 'hips', 0.05, 0.075),
 'shin.L':  (J(0.058,0.28,0.11), J(0.059,0.06,0.03), 'thigh.L', 0.04, 0.06),
 'foot.L':  (J(0.059,0.06,0.03), J(0.05,0.01,0.16), 'shin.L', 0.035, 0.06),
 'skirt':   (J(0.015,0.45,0.03), J(0.0,0.06,-0.16), 'hips', 0.12, None),
}
arm=bpy.data.armatures.new('Rig'); ao=bpy.data.objects.new('Rig',arm); bpy.context.scene.collection.objects.link(ao)
bpy.context.view_layer.objects.active=ao; bpy.ops.object.mode_set(mode='EDIT')
for n,(h,t,p,r,c) in bones.items():
    b=arm.edit_bones.new(n); b.head=Vector(h); b.tail=Vector(t)
for n,(h,t,p,r,c) in bones.items():
    if p: arm.edit_bones[n].parent=arm.edit_bones[p]; arm.edit_bones[n].use_connect=False
bpy.ops.object.mode_set(mode='OBJECT')

V=np.array([v.co for v in ob.data.vertices])
names=list(bones); NB=len(names)
def segdist(P,a,b):
    ab=b-a; t=np.clip(((P-a)@ab)/(ab@ab),0,1); return np.linalg.norm(P-(a+t[:,None]*ab),axis=1)
from PIL import Image
me=ob.data; uv=np.zeros((len(V),2)); li=np.zeros(len(me.loops),int); me.loops.foreach_get('vertex_index',li)
uvl=np.zeros(len(me.loops)*2); me.uv_layers.active.data.foreach_get('uv',uvl); uv[li]=uvl.reshape(-1,2)
img=np.array(Image.open(D+'ritual/base.jpg')).astype(int); H=img.shape[0]
px=img[np.clip(((1-uv[:,1])*H).astype(int),0,H-1),np.clip((uv[:,0]*H).astype(int),0,H-1)]
skin=(px[:,0]-px[:,2]>25)&(px[:,0]>90)&(px[:,0]-px[:,1]>10)&(V[:,2]/S<0.5)
def segdist0(P,a,b):
    ab=b-a; t=np.clip(((P-a)@ab)/(ab@ab),0,1); return np.linalg.norm(P-(a+t[:,None]*ab),axis=1)
near=np.min([segdist0(V,bones[n][0],bones[n][1]) for n in ('shin.R','foot.R','shin.L','foot.L')],axis=0)/S
skin|=(near<0.03)&(V[:,2]/S<0.32)
print('skin verts',int(skin.sum()))
score=np.full((len(V),NB),np.inf)
for i,n in enumerate(names):
    h,t,p,r,c=bones[n]; d=segdist(V,h,t)
    s=d/(r*S)
    if c is not None: s[d>c*S]=np.inf
    score[:,i]=s
# the skirt bone only owns cloth below the hips, and is preferred there over the hips
yh=V[:,2]/S
sk=names.index('skirt'); hp=names.index('hips')
score[yh>0.47,sk]=np.inf
for n in names:
    kind=n.split('.')[0]
    if kind in ('thigh','shin','foot'):
        i=names.index(n); h,t,p,r,c=bones[n]; d=segdist(V,h,t)/S
        tight={'thigh':0.06,'shin':0.05,'foot':0.05}[kind]
        if kind=='thigh': score[:,i]=np.where(skin|(d<0.045),score[:,i]*np.where(skin,0.1,0.45),np.inf)
        else: score[:,i]=np.where(skin,score[:,i]*0.1,np.inf)
# leg skin belongs to the legs only
for n in names:
    if n.split('.')[0] not in ('thigh','shin','foot','hips'): score[skin&(yh<0.45),names.index(n)]=np.inf
score[skin&(yh<0.4),hp]=np.inf
W=np.zeros_like(score)
o=np.argsort(score,axis=1)[:,:3]
for k in range(3):
    s=score[np.arange(len(V)),o[:,k]]
    W[np.arange(len(V)),o[:,k]]=np.where(np.isfinite(s),1/np.maximum(s,0.05)**4,0)
W/=W.sum(1,keepdims=True)
# smooth weights over mesh edges so joints bend softly
E=np.array([e.vertices[:] for e in ob.data.edges])
for it in range(3):
    acc=np.zeros_like(W); cnt=np.zeros(len(V))
    np.add.at(acc,E[:,0],W[E[:,1]]); np.add.at(acc,E[:,1],W[E[:,0]])
    np.add.at(cnt,E[:,0],1); np.add.at(cnt,E[:,1],1)
    W=0.5*W+0.5*acc/np.maximum(cnt,1)[:,None]
# keep top 4
o=np.argsort(-W,axis=1); keep=np.zeros_like(W,bool); keep[np.arange(len(V))[:,None],o[:,:4]]=True
W=np.where(keep,W,0); W/=W.sum(1,keepdims=True)
for i,n in enumerate(names):
    g=ob.vertex_groups.new(name=n); idx=np.nonzero(W[:,i]>0.005)[0]
    for j in idx: g.add([int(j)],float(W[j,i]),'REPLACE')
print('owner counts',{n:int((W.argmax(1)==i).sum()) for i,n in enumerate(names)})
ob.parent=ao; m=ob.modifiers.new('Armature','ARMATURE'); m.object=ao

mat=bpy.data.materials.new('Ritualist'); mat.use_nodes=True; nt=mat.node_tree; bs=nt.nodes['Principled BSDF']
def img(p,cs):
    n=nt.nodes.new('ShaderNodeTexImage'); n.image=bpy.data.images.load(D+'ritual/'+p); n.image.colorspace_settings.name=cs; return n
b=img('base.jpg','sRGB'); nt.links.new(b.outputs['Color'],bs.inputs['Base Color'])
mr=img('mr.jpg','Non-Color'); sep=nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(mr.outputs['Color'],sep.inputs[0])
nt.links.new(sep.outputs[1],bs.inputs['Roughness']); nt.links.new(sep.outputs[2],bs.inputs['Metallic'])
nm=img('normal.jpg','Non-Color'); nmap=nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(nm.outputs['Color'],nmap.inputs['Color']); nt.links.new(nmap.outputs['Normal'],bs.inputs['Normal'])
ob.data.materials.clear(); ob.data.materials.append(mat)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=D+'ritual/ritualist.glb',export_format='GLB',export_image_format='JPEG',export_jpeg_quality=88,export_skins=True,export_animations=False,export_apply=False)
print('done')
