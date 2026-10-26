"""Prepares Scott's downloaded gun models for the game: import, apply transforms, decimate heavy meshes,
shrink textures, export compact glb, and render a side and top preview with the bounding box printed.
Usage: python3 tools/models/guns.py -- <input> models/game/gun_<name>.glb <preview.png> <max_tris> <tex_px> <rot_z_deg> <length_m>
The output is normalised for the game: barrel along blender +y (glTF -z) with the muzzle at +y, centred on its
bounding box, scaled so its length is <length_m>."""
import sys, bpy, math, os
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[-5:]
src, out, prev = args[:3]
max_tris = int(args[3]) if len(args) > 3 else 12000
tex = int(args[4]) if len(args) > 4 else 1024
rotz = float(args[5]) if len(args) > 5 else 0
length = float(args[6]) if len(args) > 6 else 0
bpy.ops.wm.read_factory_settings(use_empty=True)
ext = os.path.splitext(src)[1].lower()
if ext in ('.glb', '.gltf'): bpy.ops.import_scene.gltf(filepath=src, merge_vertices=True)
elif ext == '.fbx': bpy.ops.import_scene.fbx(filepath=src)
else: bpy.ops.wm.obj_import(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
# bake every transform into the meshes, drop empties/armatures, so the glb is plain geometry in metres
for o in bpy.context.scene.objects: o.select_set(o.type == 'MESH')
bpy.context.view_layer.objects.active = meshes[0]
for o in meshes:
    mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in list(bpy.context.scene.objects):
    if o.type != 'MESH': bpy.data.objects.remove(o)
import mathutils
def bbox():
    pts = [o.matrix_world @ mathutils.Vector(c) for o in meshes for c in o.bound_box]
    return [min(p[i] for p in pts) for i in range(3)], [max(p[i] for p in pts) for i in range(3)]
if rotz or length:
    mn, mx = bbox(); c = mathutils.Vector([(a + b) / 2 for a, b in zip(mn, mx)])
    R = mathutils.Matrix.Rotation(math.radians(rotz), 4, 'Z')
    for o in meshes: o.matrix_world = R @ mathutils.Matrix.Translation(-c) @ o.matrix_world
    if length:
        mn, mx = bbox(); k = length / (mx[1] - mn[1])
        for o in meshes: o.matrix_world = mathutils.Matrix.Scale(k, 4) @ o.matrix_world
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
if tris > max_tris:
    r = max_tris / tris
    for o in meshes:
        m = o.modifiers.new('dec', 'DECIMATE'); m.ratio = r; m.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='dec')
tris2 = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
for img in bpy.data.images:
    if img.size[0] > tex: img.scale(tex, int(tex * img.size[1] / img.size[0]))
mn, mx = bbox()
print('GUN', os.path.basename(src), 'tris', tris, '->', tris2, 'min', [round(v, 3) for v in mn], 'max', [round(v, 3) for v in mx], 'mats', len(bpy.data.materials), 'imgs', [(i.name, i.size[0]) for i in bpy.data.images])
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=82, use_selection=False)
# preview: side view looking along +y (blender) with the x axis to the right, plus a top view
c = [(a + b) / 2 for a, b in zip(mn, mx)]; size = max(b - a for a, b in zip(mn, mx))
sc = bpy.context.scene
w = bpy.data.worlds.new('w'); w.use_nodes = True; w.node_tree.nodes['Background'].inputs[1].default_value = 0.8; sc.world = w
bpy.ops.object.light_add(type='SUN', rotation=(math.radians(40), math.radians(20), 0)); bpy.context.object.data.energy = 4
bpy.ops.object.camera_add(location=(c[0], c[1] - size * 3, c[2]), rotation=(math.radians(90), 0, 0)); cam = bpy.context.object
cam.data.type = 'ORTHO'; cam.data.ortho_scale = size * 1.15; sc.camera = cam
sc.render.engine = 'CYCLES'; sc.cycles.samples = 12; sc.render.resolution_x, sc.render.resolution_y = 640, 360
sc.render.filepath = prev.replace('.png', '_side.png'); bpy.ops.render.render(write_still=True)
cam.location = (c[0], c[1], c[2] + size * 3); cam.rotation_euler = (0, 0, 0)
sc.render.filepath = prev.replace('.png', '_top.png'); bpy.ops.render.render(write_still=True)
