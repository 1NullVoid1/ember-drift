"""Generates Ember Drift's tileable PBR surface textures (all procedural, all original).

Each material gets three seamless 1024px maps:
  <name>_color.jpg   albedo
  <name>_normal.jpg  tangent-space normal (OpenGL / +Y up, the convention three.js and Unity both read)
  <name>_rough.jpg   roughness (white = matte)

Run:  python3 tools/textures/make_textures.py [output_dir]
Needs numpy, scipy and Pillow.
"""
import sys, os
import numpy as np
from scipy.spatial import cKDTree
from PIL import Image

N = 1024
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', '..', 'textures')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(1729)
yy, xx = np.mgrid[0:N, 0:N] / N   # 0..1 texture coordinates


# ---------- seamless noise ----------
def value_noise(period, seed):
    """Smooth value noise that wraps every `period` cells, so it tiles."""
    r = np.random.default_rng(seed).random((period, period))
    x, y = xx * period, yy * period
    xi, yi = x.astype(int), y.astype(int)
    xf, yf = x - xi, y - yi
    u, v = xf * xf * (3 - 2 * xf), yf * yf * (3 - 2 * yf)
    x0, y0, x1, y1 = xi % period, yi % period, (xi + 1) % period, (yi + 1) % period
    a, b, c, d = r[y0, x0], r[y0, x1], r[y1, x0], r[y1, x1]
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v


def fbm(base, octaves, seed, gain=0.5):
    t, amp, tot = 0, 1.0, 0
    for i in range(octaves):
        t = t + amp * value_noise(base * 2 ** i, seed + i * 31)
        tot += amp; amp *= gain
    return t / tot


def ridged(base, octaves, seed):
    t, amp, tot = 0, 1.0, 0
    for i in range(octaves):
        n = 1 - np.abs(value_noise(base * 2 ** i, seed + i * 17) * 2 - 1)
        t = t + amp * n * n; tot += amp; amp *= 0.5
    return t / tot


def cells(count, seed, jitter=1.0):
    """Periodic Worley noise: distance to nearest and second-nearest feature point, plus a per-cell id."""
    pts = np.random.default_rng(seed).random((count, 2))
    tree = cKDTree(pts, boxsize=1.0)
    q = np.stack([xx.ravel(), yy.ravel()], 1)
    d, idx = tree.query(q, k=2)
    f1, f2 = d[:, 0].reshape(N, N), d[:, 1].reshape(N, N)
    return f1 * np.sqrt(count), f2 * np.sqrt(count), idx[:, 0].reshape(N, N)


def warp(field_fn, amount, seed):
    """Domain-warp a field by sampling it at wobbled coordinates (keeps tiling: offsets are periodic)."""
    ox = (fbm(4, 4, seed) - 0.5) * amount
    oy = (fbm(4, 4, seed + 99) - 0.5) * amount
    return field_fn((xx + ox) % 1.0, (yy + oy) % 1.0)


def sample(img, u, v):
    """Bilinear lookup into a tiling image at fractional coordinates."""
    x, y = u * N, v * N
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    fx, fy = x - x0, y - y0
    x0 %= N; y0 %= N; x1 = (x0 + 1) % N; y1 = (y0 + 1) % N
    return (img[y0, x0] * (1 - fx) * (1 - fy) + img[y0, x1] * fx * (1 - fy) + img[y1, x0] * (1 - fx) * fy + img[y1, x1] * fx * fy)


# ---------- map helpers ----------
def normal_from_height(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * N
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * N
    n = np.stack([-dx * strength / N * 4, dy * strength / N * 4, np.ones_like(h)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5


def ramp(t, stops):
    """Map 0..1 to colour through (position, (r,g,b)) stops."""
    t = np.clip(t, 0, 1)
    out = np.zeros(t.shape + (3,))
    ps = [s[0] for s in stops]; cs = [np.array(s[1], float) / 255 for s in stops]
    for i in range(len(stops) - 1):
        m = (t >= ps[i]) & (t <= ps[i + 1])
        k = ((t - ps[i]) / max(ps[i + 1] - ps[i], 1e-6))[m][:, None]
        out[m] = cs[i] * (1 - k) + cs[i + 1] * k
    return out


def norm01(a):
    return (a - a.min()) / (a.max() - a.min() + 1e-9)


def save(name, color, height, rough, nstrength):
    Image.fromarray((np.clip(color, 0, 1) * 255).astype(np.uint8)).save(os.path.join(OUT, name + '_color.jpg'), quality=88)
    Image.fromarray((normal_from_height(height, nstrength) * 255).astype(np.uint8)).save(os.path.join(OUT, name + '_normal.jpg'), quality=92)
    Image.fromarray((np.clip(rough, 0, 1) * 255).astype(np.uint8)).save(os.path.join(OUT, name + '_rough.jpg'), quality=85)
    print('wrote', name)


# ---------- materials ----------
def gravel():
    """Dusty regolith with scattered pebbles: the Steppe's ground (neutral enough to tint per planet)."""
    base = fbm(6, 6, 11)
    f1, f2, cid = cells(900, 12)
    pebble_r = 0.35 + np.random.default_rng(13).random(900)[cid] * 0.35
    peb = np.clip(1 - f1 / pebble_r, 0, 1) ** 0.6 * (np.random.default_rng(14).random(900)[cid] > 0.45)
    fine = value_noise(256, 15)
    h = base * 0.35 + peb * 0.55 + fine * 0.1
    tone = np.random.default_rng(16).random(900)[cid]
    col = ramp(base * 0.8 + fine * 0.2, [(0, (104, 86, 74)), (0.5, (146, 122, 101)), (1, (178, 156, 132))])
    pcol = ramp(tone, [(0, (90, 84, 82)), (0.5, (128, 116, 106)), (1, (160, 150, 140))])
    col = col * (1 - peb[..., None] * 0.85) + pcol * peb[..., None] * 0.85
    col *= (0.86 + 0.14 * value_noise(64, 17))[..., None]
    rough = 0.82 + 0.15 * fine - peb * 0.15
    save('gravel', col, h, rough, 2.2)


def rock():
    """Layered, cracked cliff rock used on slopes and boulders."""
    strata = lambda u, v: np.sin((v * 7 + fbm(3, 5, 21) * 1.6) * np.pi * 2) * 0.5 + 0.5
    layers = warp(lambda u, v: np.sin((v * 6 + 0.3 * np.sin(u * np.pi * 2)) * np.pi * 2) * 0.5 + 0.5, 0.35, 22)
    big = ridged(4, 6, 23)
    f1, f2, _ = cells(28, 24)
    gate = np.clip((fbm(5, 4, 27) - 0.45) * 6, 0, 1)       # only some cell borders crack
    cracks = 1 - (1 - np.clip((f2 - f1) * 14, 0, 1)) * gate  # thin dark seams
    h = big * 0.6 + layers * 0.2 + cracks * 0.12 + fbm(32, 4, 25) * 0.12
    col = ramp(norm01(big * 0.6 + layers * 0.4), [(0, (70, 68, 72)), (0.45, (112, 108, 110)), (1, (156, 150, 146))])
    col *= (0.6 + 0.4 * cracks)[..., None]
    col *= (0.8 + 0.2 * norm01(ridged(12, 4, 28)))[..., None]
    col *= (0.85 + 0.15 * fbm(16, 4, 26))[..., None]
    rough = 0.78 + 0.2 * (1 - cracks) * 0.5
    save('rock', col, h, rough, 3.2)


def snow():
    """Wind-packed snow over ice, with sastrugi ridges and glints."""
    drift = warp(lambda u, v: np.sin((u * 5 + v * 2) * np.pi * 2) * 0.5 + 0.5, 0.5, 31)
    soft = fbm(5, 6, 32)
    ice = np.clip((fbm(3, 6, 33) - 0.62) * 4, 0, 1) * 0.5
    h = soft * 0.6 + drift * 0.3 + value_noise(200, 34) * 0.05 - ice * 0.2
    col = ramp(soft * 0.7 + drift * 0.3, [(0, (186, 200, 218)), (1, (240, 245, 250))])
    icec = np.array([150, 190, 222]) / 255
    col = col * (1 - ice[..., None] * 0.6) + icec * ice[..., None] * 0.6
    glint = (value_noise(512, 35) > 0.93) * 0.25
    col = col + glint[..., None]
    rough = 0.7 - ice * 0.45 - glint
    save('snow', col, h, rough, 1.4)


def moss():
    """Jungle floor: soil, leaf litter and moss patches for Kharun."""
    patches = norm01(warp(lambda u, v: fbm(3, 7, 41) + 0.6 * ridged(5, 5, 49), 0.7, 47))
    mossy = np.clip((patches - 0.38) * 3.5, 0, 1) * (0.7 + 0.3 * value_noise(160, 48))
    f1, f2, cid = cells(700, 42)
    leaves = np.clip(1 - f1 / 0.55, 0, 1) * (np.random.default_rng(43).random(700)[cid] > 0.5)
    fibre = value_noise(300, 44)
    h = patches * 0.4 + mossy * 0.25 + leaves * 0.25 + fibre * 0.1
    soil = ramp(fbm(12, 4, 45), [(0, (58, 44, 32)), (1, (96, 74, 52))])
    leafc = ramp(np.random.default_rng(46).random(700)[cid], [(0, (92, 70, 36)), (0.5, (120, 96, 48)), (1, (82, 98, 46))])
    mossc = ramp(fibre * 0.5 + patches * 0.5, [(0, (44, 66, 34)), (1, (84, 112, 52))])
    col = soil * (1 - leaves[..., None]) + leafc * leaves[..., None]
    col = col * (1 - mossy[..., None]) + mossc * mossy[..., None]
    rough = 0.9 - mossy * 0.1
    save('moss', col, h, rough, 2.0)


def ash():
    """Black volcanic ash with glassy obsidian flakes and faint ember veins (the Hollow Crown)."""
    base = fbm(6, 6, 51)
    f1, f2, cid = cells(400, 52)
    flakes = np.clip(1 - f1 / 0.45, 0, 1) * (np.random.default_rng(53).random(400)[cid] > 0.6)
    veins = np.clip(1 - np.abs(warp(lambda u, v: fbm(3, 5, 54), 0.4, 55) - 0.5) * 90, 0, 1) * np.clip((fbm(4, 3, 56) - 0.5) * 4, 0, 1)
    h = base * 0.5 + flakes * 0.4 - veins * 0.1
    col = ramp(base, [(0, (22, 18, 22)), (1, (60, 50, 54))])
    col = col * (1 - flakes[..., None] * 0.6) + np.array([14, 12, 18]) / 255 * flakes[..., None] * 0.6
    col = col + veins[..., None] * np.array([110, 30, 18]) / 255
    rough = 0.85 - flakes * 0.65
    save('ash', col, h, rough, 1.8)


def tiles():
    """Emberhold plaza: large worn stone flags with grout, chips and a warm sandstone tone."""
    n = 4
    gu, gv = xx * n, yy * n
    row = np.floor(gv)
    gu = gu + (row % 2) * 0.5                               # running bond
    tid = (np.floor(gu) % n) + row * n
    fu, fv = gu % 1.0, gv % 1.0
    edge = np.minimum(np.minimum(fu, 1 - fu), np.minimum(fv, 1 - fv))
    grout = np.clip(edge / 0.018, 0, 1)
    bevel = np.clip(edge / 0.06, 0, 1) ** 0.5
    shade = np.random.default_rng(61).random(64)[tid.astype(int) % 64]
    wear = fbm(8, 6, 62)
    chips = np.clip((value_noise(48, 63) - 0.8) * 8, 0, 1) * (1 - bevel)
    h = bevel * 0.7 + wear * 0.2 - chips * 0.4 + value_noise(256, 64) * 0.04
    col = ramp(shade * 0.5 + wear * 0.5, [(0, (120, 108, 104)), (0.5, (152, 140, 132)), (1, (178, 166, 152))])
    col = col * grout[..., None] + np.array([46, 40, 42]) / 255 * (1 - grout[..., None])
    col *= (0.88 + 0.12 * value_noise(128, 65))[..., None]
    rough = 0.7 + 0.2 * (1 - grout) + wear * 0.08
    save('tiles', col, h, rough, 2.4)


def concrete():
    """Weathered cast stone for ruins and cover walls: pores, stains, cracks and form lines."""
    pores = (value_noise(400, 71) > 0.82) * 1.0
    stains = fbm(3, 5, 72)
    f1, f2, _ = cells(14, 76)
    crack = np.clip(1 - (f2 - f1) * 40, 0, 1) * np.clip((fbm(6, 3, 77) - 0.62) * 8, 0, 1) * 0.7
    form = (np.abs(((yy * 4) % 1.0) - 0.5) > 0.495) * 1.0  # pour lines every quarter
    h = fbm(16, 5, 78) * 0.4 - pores * 0.25 - crack * 0.4 - form * 0.2
    col = ramp(stains, [(0, (112, 110, 112)), (0.6, (150, 146, 144)), (1, (170, 166, 160))])
    col *= (1 - 0.18 * np.clip(stains - 0.5, 0, 1) * 2)[..., None]
    col *= (1 - pores * 0.25 - crack * 0.5 - form * 0.15)[..., None]
    rough = 0.85 + pores * 0.1
    save('concrete', col, h, rough, 2.0)


def metal():
    """Painted sci-fi hull panels with seams, rivets, worn edges and grime."""
    # irregular panel layout: split a 4x4 grid, then merge some cells horizontally
    seam = np.ones((N, N)); rivet = np.zeros((N, N)); wear = np.zeros((N, N))
    r = np.random.default_rng(81)
    rows = [0, 0.25, 0.5, 0.75, 1.0]
    for i in range(4):
        y0, y1 = rows[i], rows[i + 1]
        cuts = [0] + sorted(r.choice([0.25, 0.375, 0.5, 0.625, 0.75], size=2, replace=False).tolist()) + [1.0]
        for j in range(len(cuts) - 1):
            x0, x1 = cuts[j], cuts[j + 1]
            m = (xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1)
            e = np.minimum(np.minimum(xx - x0, x1 - xx), np.minimum(yy - y0, y1 - yy))
            seam[m] = np.clip(e[m] / 0.004, 0, 1)
            wear[m] = np.clip(1 - e[m] / 0.03, 0, 1)
            for cx in (x0 + 0.015, x1 - 0.015):
                for cy in (y0 + 0.015, y1 - 0.015):
                    d = np.hypot(((xx - cx + 0.5) % 1) - 0.5, ((yy - cy + 0.5) % 1) - 0.5)
                    rivet = np.maximum(rivet, np.clip(1 - d / 0.005, 0, 1))
    grime = fbm(4, 5, 82)
    scratches = (np.abs(np.sin((xx * 300 + fbm(8, 3, 83) * 40))) > 0.995) * (fbm(6, 3, 84) > 0.55)
    chipped = (wear * (fbm(32, 3, 85) > 0.55)) > 0.4
    h = seam * 0.6 + rivet * 0.3 + (1 - chipped) * 0.05 + value_noise(256, 86) * 0.02
    paint = ramp(grime, [(0, (120, 124, 130)), (1, (150, 154, 160))])
    bare = np.array([180, 182, 186]) / 255
    col = paint * (1 - chipped[..., None]) + bare * chipped[..., None]
    col = col * (0.55 + 0.45 * seam[..., None]) + scratches[..., None] * 0.12
    col *= (1 - 0.25 * np.clip(grime - 0.55, 0, 1) * 2)[..., None]
    rough = 0.55 - chipped * 0.3 - scratches * 0.2 + grime * 0.15
    save('metal', col, h, rough, 1.6)


if __name__ == '__main__':
    for fn in (gravel, rock, snow, moss, ash, tiles, concrete, metal):
        fn()
