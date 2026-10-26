"""Shrinks Scott's 'near future soldier' model for the game: decimate, downsize the texture, export glb,
and render a preview. Usage: python3 tools/models/commander.py <in.glb> <out.glb> <preview.png>"""
import sys, bpy, math
src, out, prev = sys.argv[-3:]
bpy.ops.wm.read_factory_settings(use_empty=True)
# merge the UV-seam duplicates first so decimation can't open cracks along the seams
bpy.ops.import_scene.gltf(filepath=src, merge_vertices=True)
ob = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
print('tris before', sum(len(p.vertices) - 2 for p in ob.data.polygons))
bpy.context.view_layer.objects.active = ob
mod = ob.modifiers.new('dec', 'DECIMATE'); mod.ratio = 0.3; mod.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier='dec')
print('tris after', sum(len(p.vertices) - 2 for p in ob.data.polygons))
for img in bpy.data.images:
    if img.size[0] > 2048: img.scale(2048, 2048)
    img.file_format = 'JPEG'
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=85, use_selection=False)
# preview
bpy.ops.object.camera_add(location=(0.3, -1.3, 0.45), rotation=(math.radians(90), 0, math.radians(12))); cam = bpy.context.object
bpy.context.scene.camera = cam; cam.data.lens = 50
bpy.ops.object.light_add(type='SUN', rotation=(math.radians(50), 0, math.radians(30))); bpy.context.object.data.energy = 4
w = bpy.data.worlds.new('w'); w.use_nodes = True; w.node_tree.nodes['Background'].inputs[1].default_value = 0.6; bpy.context.scene.world = w
sc = bpy.context.scene; sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'CYCLES'
if sc.render.engine == 'CYCLES': sc.cycles.samples = 16
sc.render.resolution_x, sc.render.resolution_y = 600, 900
sc.render.filepath = prev
bpy.ops.render.render(write_still=True)
