"""Rigs the Commander (Scott's soldier) with a simple humanoid skeleton and automatic distance-based weights.
The game poses the bones procedurally (idle breathing, weight shifts, wrist checks).
Usage: python3 tools/models/commander_rig.py <commander.glb> <out.glb>"""
import sys, bpy, numpy as np
from mathutils import Vector
src, out = sys.argv[-2:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
ob = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
bpy.context.view_layer.objects.active = ob; ob.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
ob.parent = None
# joints measured from mesh slices (blender space: z up, model faces -y, height -1..1)
def J(x, y, z): return np.array([x, y, z], float)
bones = {  # name: (head, tail, parent, radius, cap)
    'hips':   (J(0, 0, -0.08), J(0, 0, 0.14), None, 0.2, None),
    'spine':  (J(0, 0, 0.14), J(0, 0, 0.38), 'hips', 0.2, None),
    'chest':  (J(0, 0, 0.38), J(0, 0, 0.7), 'spine', 0.22, None),
    'neck':   (J(0, 0, 0.7), J(0, 0, 0.8), 'chest', 0.1, None),
    'head':   (J(0, 0, 0.8), J(0, 0, 1.0), 'neck', 0.12, None),
}
for s, n in ((1, 'L'), (-1, 'R')):
    bones.update({
        'upperarm' + n: (J(s * 0.27, 0.01, 0.6), J(s * 0.39, 0.02, 0.2), 'chest', 0.07, 0.16),
        'forearm' + n:  (J(s * 0.39, 0.02, 0.2), J(s * 0.42, 0.0, -0.06), 'upperarm' + n, 0.06, 0.13),
        'hand' + n:     (J(s * 0.42, 0.0, -0.06), J(s * 0.41, -0.02, -0.18), 'forearm' + n, 0.05, 0.12),
        'thigh' + n:    (J(s * 0.13, 0, -0.1), J(s * 0.2, 0.02, -0.56), 'hips', 0.11, None),
        'shin' + n:     (J(s * 0.2, 0.02, -0.56), J(s * 0.24, 0.05, -0.9), 'thigh' + n, 0.09, None),
        'foot' + n:     (J(s * 0.24, 0.05, -0.9), J(s * 0.27, -0.12, -0.99), 'shin' + n, 0.08, None),
    })
arm = bpy.data.armatures.new('Rig'); ao = bpy.data.objects.new('Rig', arm); bpy.context.scene.collection.objects.link(ao)
bpy.context.view_layer.objects.active = ao; bpy.ops.object.mode_set(mode='EDIT')
for n, (h, t, p, r, c) in bones.items():
    b = arm.edit_bones.new(n); b.head = Vector(h); b.tail = Vector(t)
for n, (h, t, p, r, c) in bones.items():
    if p: arm.edit_bones[n].parent = arm.edit_bones[p]
bpy.ops.object.mode_set(mode='OBJECT')

V = np.array([v.co for v in ob.data.vertices]); names = list(bones)
def segdist(P, a, b):
    ab = b - a; t = np.clip(((P - a) @ ab) / (ab @ ab), 0, 1); return np.linalg.norm(P - (a + t[:, None] * ab), axis=1)
score = np.full((len(V), len(names)), np.inf)
for i, n in enumerate(names):
    h, t, p, r, c = bones[n]; d = segdist(V, h, t); s = d / r
    if c is not None: s[d > c] = np.inf
    score[:, i] = s
x, z = V[:, 0], V[:, 2]
for i, n in enumerate(names):
    side = 1 if n.endswith('L') else -1 if n.endswith('R') else 0
    limb = n.rstrip('LR')
    if limb in ('thigh', 'shin', 'foot'):
        score[x * side < -0.02, i] = np.inf                                             # legs keep to their side
        score[(np.abs(x) > 0.32) & (z > -0.25), i] = np.inf                             # hands hang beside the thighs
    if limb in ('upperarm', 'forearm', 'hand'):
        score[(x * side < 0.2) & (z < 0.55), i] = np.inf                                # torso stays off the arms
        score[(x * side < 0.31) & (z < 0.05), i] = np.inf                               # and so do the thigh pockets
    if limb in ('hips', 'spine', 'chest', 'neck', 'head'):
        score[(np.abs(x) > 0.26) & (z < 0.42), i] = np.inf                              # hanging arms stay off the torso
        if limb != 'hips': score[z < -0.15, i] = np.inf
# anything the rules left without a bone falls back to the nearest arm or hand bone, else the nearest bone
lost = ~np.isfinite(score).any(1)
for i, n in enumerate(names):
    h, t, p, r, c = bones[n]; d = segdist(V[lost], h, t) / r
    if n.rstrip('LR') not in ('forearm', 'hand'): d = d + 5
    score[lost, i] = d
W = np.zeros_like(score); o = np.argsort(score, 1)[:, :3]
for k in range(3):
    s = score[np.arange(len(V)), o[:, k]]
    W[np.arange(len(V)), o[:, k]] = np.where(np.isfinite(s), 1 / np.maximum(s, 0.05) ** 4, 0)
W /= np.maximum(W.sum(1, keepdims=True), 1e-9)
E = np.array([e.vertices[:] for e in ob.data.edges])
for it in range(3):  # smooth across edges so joints bend softly
    acc = np.zeros_like(W); cnt = np.zeros(len(V))
    np.add.at(acc, E[:, 0], W[E[:, 1]]); np.add.at(acc, E[:, 1], W[E[:, 0]])
    np.add.at(cnt, E[:, 0], 1); np.add.at(cnt, E[:, 1], 1)
    W = 0.5 * W + 0.5 * acc / np.maximum(cnt, 1)[:, None]
o = np.argsort(-W, 1); keep = np.zeros_like(W, bool); keep[np.arange(len(V))[:, None], o[:, :4]] = True
W = np.where(keep, W, 0); W /= np.maximum(W.sum(1, keepdims=True), 1e-9)
for i, n in enumerate(names):
    g = ob.vertex_groups.new(name=n); idx = np.nonzero(W[:, i] > 0.005)[0]
    for j in idx: g.add([int(j)], float(W[j, i]), 'REPLACE')
print('unweighted', int((W.sum(1) < 0.5).sum()), {n: int((W.argmax(1) == i).sum()) for i, n in enumerate(names)})
ob.parent = ao; m = ob.modifiers.new('Armature', 'ARMATURE'); m.object = ao
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=85, export_skins=True, export_animations=False, export_apply=False)
