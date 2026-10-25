import bpy, math, os, sys
from mathutils import Vector

OUT = sys.argv[1] if len(sys.argv) > 1 else "out"
os.makedirs(OUT, exist_ok=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, color, metal=0.0, rough=0.5, emit=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = strength
    return m


def finish(o, m, bevel=0.0, seg=2):
    o.data.materials.append(m)
    if bevel:
        bv = o.modifiers.new("Bevel", "BEVEL")
        bv.width = bevel
        bv.segments = seg
        bv.limit_method = "ANGLE"
    return o


def box(name, size, loc, m, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, m, bevel)


def cyl(name, r, depth, loc, m, rot=(0, 0, 0), verts=16, bevel=0.0, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    return finish(o, m, bevel)


def ico(name, r, loc, m, sub=1, scale=(1, 1, 1), rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, m)


def torus(name, R, r, loc, m, rot=(0, 0, 0), maj=48, mn=8):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=loc, rotation=rot, major_segments=maj, minor_segments=mn)
    o = bpy.context.object
    o.name = name
    return finish(o, m)


def stage_and_render(name, cam_dir=(1.0, -1.3, 0.55), lens=50):
    objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    lo = Vector((1e9, 1e9, 1e9)); hi = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    center = (lo + hi) / 2
    size = (hi - lo).length

    # export first, before staging lights/camera
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, name + ".glb"), use_selection=True, export_apply=True)

    sc = bpy.context.scene
    world = bpy.data.worlds.new("w"); sc.world = world; world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.05, 0.035, 0.08, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.6

    d = Vector(cam_dir).normalized()
    cam_data = bpy.data.cameras.new("cam"); cam_data.lens = lens
    cam = bpy.data.objects.new("cam", cam_data); sc.collection.objects.link(cam)
    fov = 2 * math.atan(18 / lens)
    dist = (size * 0.55) / math.tan(fov / 2)
    cam.location = center + d * dist
    cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam

    def light(n, loc, energy, color, sz):
        ld = bpy.data.lights.new(n, "AREA"); ld.energy = energy; ld.color = color; ld.size = sz
        lo_ = bpy.data.objects.new(n, ld); sc.collection.objects.link(lo_)
        lo_.location = loc
        lo_.rotation_euler = (center - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    s = size
    light("key", center + Vector((s * 1.2, -s * 1.0, s * 1.4)), 110 * s * s, (1.0, 0.82, 0.65), s)
    light("rim", center + Vector((-s * 1.3, s * 1.2, s * 0.8)), 125 * s * s, (0.55, 0.75, 1.0), s * 0.8)
    light("fill", center + Vector((-s * 1.2, -s * 1.4, -s * 0.2)), 25 * s * s, (0.8, 0.6, 1.0), s * 1.5)

    # ground disc for contact
    bpy.ops.mesh.primitive_circle_add(vertices=64, radius=size * 1.5, fill_type="NGON", location=(center.x, center.y, lo.z))
    g = bpy.context.object
    g.data.materials.append(mat("ground", (0.07, 0.05, 0.08), 0, 0.8))

    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 64
    sc.cycles.use_denoising = True
    sc.render.resolution_x = 1100; sc.render.resolution_y = 800
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    sc.render.filepath = os.path.join(OUT, name + ".png")
    bpy.ops.render.render(write_still=True)


# ------------------------------------------------------------------ rifle
def rifle():
    reset()
    dark = mat("gunmetal", (0.06, 0.065, 0.075), 0.85, 0.32)
    ivory = mat("ivory_paint", (0.72, 0.66, 0.55), 0.1, 0.45)
    rubber = mat("grip", (0.03, 0.03, 0.03), 0, 0.8)
    glow = mat("ember_glow", (1, 0.4, 0.1), 0, 0.3, (1.0, 0.42, 0.12), 4)
    lens = mat("lens", (0.1, 0.6, 1.0), 0, 0.05, (0.3, 0.8, 1.0), 3)
    # x = forward (barrel), z = up
    box("receiver", (0.42, 0.075, 0.12), (0, 0, 0), dark, bevel=0.012)
    box("upper_shell", (0.36, 0.085, 0.05), (0.02, 0, 0.075), ivory, bevel=0.015)
    box("shroud", (0.3, 0.08, 0.085), (0.35, 0, 0.015), ivory, bevel=0.018)
    for i in range(4):
        box(f"vent{i}", (0.035, 0.084, 0.012), (0.27 + i * 0.05, 0, 0.045), dark, bevel=0.003)
    box("shroud_under", (0.26, 0.06, 0.03), (0.34, 0, -0.04), dark, bevel=0.008)
    cyl("barrel", 0.018, 0.22, (0.58, 0, 0.015), dark, rot=(0, math.pi / 2, 0), verts=12)
    cyl("muzzle", 0.028, 0.06, (0.7, 0, 0.015), dark, rot=(0, math.pi / 2, 0), verts=6, bevel=0.004)
    box("mag", (0.07, 0.05, 0.2), (0.08, 0, -0.14), dark, rot=(0, math.radians(-12), 0), bevel=0.01)
    box("mag_plate", (0.075, 0.055, 0.02), (0.1, 0, -0.24), ivory, rot=(0, math.radians(-12), 0), bevel=0.005)
    box("grip", (0.06, 0.055, 0.16), (-0.12, 0, -0.12), rubber, rot=(0, math.radians(18), 0), bevel=0.012)
    box("trigger_guard", (0.1, 0.012, 0.012), (-0.04, 0, -0.1), dark)
    box("stock_arm", (0.22, 0.04, 0.04), (-0.32, 0, 0.0), dark, bevel=0.008)
    box("stock_pad", (0.12, 0.07, 0.15), (-0.46, 0, -0.03), ivory, rot=(0, math.radians(-6), 0), bevel=0.02)
    box("stock_butt", (0.03, 0.072, 0.155), (-0.53, 0, -0.035), rubber, rot=(0, math.radians(-6), 0), bevel=0.008)
    # optic
    box("rail", (0.24, 0.04, 0.012), (0.02, 0, 0.106), dark)
    box("optic_body", (0.13, 0.05, 0.05), (0.02, 0, 0.14), dark, bevel=0.012)
    cyl("optic_hood", 0.03, 0.04, (0.1, 0, 0.145), dark, rot=(0, math.pi / 2, 0), verts=8, bevel=0.004)
    cyl("optic_lens", 0.024, 0.005, (0.122, 0, 0.145), lens, rot=(0, math.pi / 2, 0), verts=16)
    # glowing accents
    box("glow_strip_l", (0.3, 0.004, 0.01), (0.04, 0.044, 0.04), glow)
    box("glow_strip_r", (0.3, 0.004, 0.01), (0.04, -0.044, 0.04), glow)
    box("glow_core", (0.05, 0.082, 0.02), (0.44, 0, 0.06), glow)
    stage_and_render("field_issue_carbine", cam_dir=(0.35, -1.0, 0.25), lens=60)


# ------------------------------------------------------------------ wisp
def wisp():
    reset()
    shell = mat("wisp_shell", (0.78, 0.74, 0.68), 0.25, 0.35)
    trim = mat("wisp_trim", (0.08, 0.08, 0.1), 0.8, 0.3)
    core = mat("wisp_core", (0.4, 0.85, 1.0), 0, 0.2, (0.45, 0.85, 1.0), 4)
    halo = mat("wisp_halo", (1.0, 0.6, 0.3), 0, 0.2, (1.0, 0.62, 0.3), 3.5)
    z = 0.6
    # lantern body: hexagonal prism with tapered caps
    cyl("body", 0.16, 0.18, (0, 0, z), shell, verts=6, bevel=0.012)
    cyl("cap_top", 0.16, 0.1, (0, 0, z + 0.14), shell, verts=6, r2=0.06, bevel=0.008)
    cyl("cap_bot", 0.06, 0.12, (0, 0, z - 0.15), shell, verts=6, r2=0.16, bevel=0.008)
    cyl("band", 0.165, 0.035, (0, 0, z), trim, verts=6)
    cyl("finial", 0.02, 0.08, (0, 0, z + 0.22), trim, verts=6)
    ico("finial_gem", 0.03, (0, 0, z + 0.28), core, sub=0)
    cyl("tail", 0.02, 0.1, (0, 0, z - 0.26), trim, verts=6, r2=0.0)
    # eye windows on the band
    for i in range(6):
        a = i * math.pi / 3 + math.pi / 6
        box(f"window{i}", (0.012, 0.07, 0.022), (math.cos(a) * 0.168, math.sin(a) * 0.168, z), core, rot=(0, 0, a))
    # floating halo rings, tilted
    torus("halo_a", 0.3, 0.008, (0, 0, z + 0.02), halo, rot=(math.radians(14), 0, 0))
    torus("halo_b", 0.24, 0.006, (0, 0, z - 0.03), core, rot=(math.radians(-10), math.radians(20), 0))
    # side fins
    for s in (-1, 1):
        box(f"fin{s}", (0.03, 0.12, 0.22), (0, s * 0.2, z), trim, rot=(math.radians(s * 12), 0, 0), bevel=0.01)
    stage_and_render("wisp_companion", cam_dir=(1.0, -1.1, 0.35), lens=55)


# ------------------------------------------------------------------ husk
def husk():
    reset()
    hide = mat("husk_hide", (0.045, 0.03, 0.055), 0.2, 0.6)
    bone = mat("husk_bone", (0.55, 0.5, 0.42), 0.0, 0.55)
    glow = mat("husk_glow", (0.75, 1.0, 0.3), 0, 0.2, (0.78, 1.0, 0.32), 4)
    # legs (digitigrade: thigh, shin, foot)
    for s in (-1, 1):
        y = s * 0.16
        box(f"thigh{s}", (0.13, 0.12, 0.42), (0.04, y, 0.62), hide, rot=(0, math.radians(-25), 0), bevel=0.02)
        box(f"shin{s}", (0.1, 0.1, 0.42), (0.02, y, 0.25), hide, rot=(0, math.radians(20), 0), bevel=0.02)
        box(f"foot{s}", (0.22, 0.12, 0.05), (0.08, y, 0.03), bone, bevel=0.015)
        cyl(f"knee_spike{s}", 0.035, 0.14, (0.16, y, 0.46), bone, rot=(0, math.radians(70), 0), verts=5, r2=0.0)
    # hunched torso
    box("pelvis", (0.22, 0.34, 0.14), (0, 0, 0.84), hide, bevel=0.03)
    box("torso", (0.32, 0.42, 0.42), (0.1, 0, 1.08), hide, rot=(0, math.radians(35), 0), bevel=0.05)
    box("chest_plate", (0.06, 0.34, 0.3), (0.27, 0, 1.06), bone, rot=(0, math.radians(35), 0), bevel=0.03)
    for i, (dx, dz) in enumerate([(-0.08, 1.32), (0.0, 1.38), (-0.16, 1.24)]):
        cyl(f"back_spine{i}", 0.05, 0.26, (dx - 0.05, 0, dz), bone, rot=(0, math.radians(-40), 0), verts=5, r2=0.0)
    # head with glowing crystal (crit spot)
    box("neck", (0.1, 0.12, 0.12), (0.32, 0, 1.28), hide, bevel=0.02)
    box("skull", (0.2, 0.2, 0.15), (0.42, 0, 1.3), bone, rot=(0, math.radians(15), 0), bevel=0.04)
    ico("crit_crystal", 0.08, (0.48, 0, 1.4), glow, sub=0, scale=(1, 1, 1.5), rot=(0, math.radians(20), 0))
    for s in (-1, 1):
        ico(f"eye{s}", 0.025, (0.52, s * 0.06, 1.29), glow, sub=1)
    # long arms with claws
    for s in (-1, 1):
        y = s * 0.29
        box(f"shoulder{s}", (0.16, 0.14, 0.12), (0.18, y, 1.2), bone, bevel=0.03)
        box(f"upper_arm{s}", (0.09, 0.09, 0.38), (0.26, y * 1.05, 1.0), hide, rot=(0, math.radians(-30), 0), bevel=0.02)
        box(f"forearm{s}", (0.08, 0.08, 0.42), (0.42, y * 1.1, 0.72), hide, rot=(0, math.radians(-15), 0), bevel=0.02)
        for k in (-1, 0, 1):
            cyl(f"claw{s}{k}", 0.018, 0.2, (0.5, y * 1.1 + k * 0.035, 0.45), bone, rot=(0, math.radians(160), 0), verts=5, r2=0.0)
    stage_and_render("husk_enemy", cam_dir=(1.0, -0.9, 0.3), lens=40)


for fn in (rifle, wisp, husk):
    fn()
print("DONE")
