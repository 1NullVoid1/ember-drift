// Renders the rigged Commander alone at chosen animation times, front and side, for checking his idle.
// usage: node tools/tests/pose.js <three_dir> <out.png> [CMD overrides as JSON] [times,comma,separated]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..'), THREE_DIR = process.argv[2], OUT = process.argv[3];
const over = process.argv[4] || '{}', times = (process.argv[5] || '0,2,4,6').split(',').map(Number);
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const glb = src.match(/<script>const COMMANDER_GLB="[^"]*";<\/script>/)[0];
const a = src.indexOf('// Commander Kestrel: Scott'), b = src.indexOf('function buildSoldierNpc(');
const html = `<html><body style="margin:0;background:#333">
<script src="http://local/three.min.js"></script><script src="http://local/GLTFLoader.js"></script>${glb}
<script>const isTouch = false;\n${src.slice(a, b)}
Object.assign(CMD, ${over});
const R = new THREE.WebGLRenderer({ antialias: true }); R.setPixelRatio(1); R.setSize(${times.length * 260}, 760); document.body.appendChild(R.domElement);
const S = new THREE.Scene(); S.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2)); const d = new THREE.DirectionalLight(0xffffff, 1); d.position.set(2, 4, 3); S.add(d);
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
const views = ${JSON.stringify(times)}.flatMap(t => [[t, 0], [t, Math.PI / 2]]);
const npcs = views.map(() => { const n = buildCommanderNpc(0x7fd8ff); S.add(n.g); return n; });
window.go = () => {
  R.setScissorTest(true);
  views.forEach(([t, yaw], i) => {
    npcs.forEach((n, k) => n.g.visible = k === i);
    npcs[i].anim(t); npcs[i].g.rotation.y = yaw;
    const x = (i >> 1) * 260, y = (i & 1) ? 0 : 380;
    R.setViewport(x, y, 260, 380); R.setScissor(x, y, 260, 380);
    cam.left = -0.75; cam.right = 0.75; cam.top = 2.1; cam.bottom = -0.1; cam.position.set(0, 0, 5); cam.updateProjectionMatrix();
    R.render(S, cam);
  });
};
</script></body></html>`;
(async () => {
  const br = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await br.newPage({ viewport: { width: times.length * 260, height: 760 } });
  p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => m.type() === 'error' && console.log(m.text()));
  await p.route('http://local/**', r => {
    const f = new URL(r.request().url()).pathname.slice(1);
    if (f === 'test.html') return r.fulfill({ body: html, contentType: 'text/html' });
    r.fulfill({ path: path.join(THREE_DIR, f === 'three.min.js' ? 'build/three.min.js' : 'examples/js/loaders/GLTFLoader.js'), contentType: 'application/javascript' });
  });
  await p.goto('http://local/test.html'); await p.waitForTimeout(3000);
  await p.evaluate(() => go()); await p.waitForTimeout(300);
  await p.screenshot({ path: OUT }); await br.close();
})();
