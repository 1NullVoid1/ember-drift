// Renders each location in headless Chromium and saves screenshots; prints any page or shader errors.
// usage: node tools/tests/shots.js <three_dir> <out_dir> [phone|desk] [guns|models]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..'), THREE_DIR = process.argv[2], OUT = process.argv[3], phone = process.argv[4] === 'phone';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: phone ? { width: 844, height: 390 } : { width: 1200, height: 675 }, hasTouch: phone, isMobile: phone });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 400)); });
  await p.route(/three@0\.128\.0\/(.*)/, r => { const m = r.request().url().match(/three@0\.128\.0\/(.*)/); r.fulfill({ path: path.join(THREE_DIR, m[1]), contentType: 'application/javascript' }); });
  await p.route(/fonts\./, r => r.abort());
  await p.route('http://local/**', r => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname.slice(1));
    let html = fs.readFileSync(path.join(ROOT, rel || 'index.html'));
    if (!rel || rel === 'index.html') {
      html = html.toString().replace("requestAnimationFrame(frame);\n})();", "requestAnimationFrame(frame);\nwindow.__t = { travelTo, player, show: (type, dist) => { if (window.__m) scene.remove(window.__m); const d = new THREE.Vector3(); camera.getWorldDirection(d); d.y = 0; d.normalize(); const e = buildEnemy(type); e.g.position.copy(camera.position).addScaledVector(d, dist); e.g.position.y = 0; e.g.lookAt(camera.position.x, e.g.position.y, camera.position.z); scene.add(e.g); window.__m = e.g; }, gun: (arch) => { const w = makeWeapon(ARCH[arch].slots[0], 3, 1010, { arch }); inv.equipped[w.slot] = w.uid; inv.items.push(w); player.wslot = WSLOTS.indexOf(w.slot); applyWeaponLook(); } };\n})();");
      return r.fulfill({ body: html, contentType: 'text/html; charset=utf-8' });
    }
    r.fulfill({ body: html, contentType: rel.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream' });
  });
  await p.goto('http://local/index.html');
  await p.waitForTimeout(2500);
  fs.mkdirSync(OUT, { recursive: true });
  const pre = phone ? 'ph_' : '';
  await p.screenshot({ path: path.join(OUT, pre + 'menu.png') });
  const mode = process.argv[5];
  const ids = mode === 'guns' || mode === 'models' ? ['steppe'] : ['tower', 'steppe', 'veyra', 'kharun'];
  for (const id of ids) {
    await p.evaluate(id => __t.travelTo(id), id); await p.waitForTimeout(3500);
    await p.evaluate(() => { __t.player.pitch = -0.12; }); await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(OUT, pre + id + '.png') });
  }
  if (mode === 'models') for (const [t, d] of [['husk', 2.6], ['warden', 3.6], ['sentinel', 6]]) {
    await p.evaluate(([t, d]) => { __t.player.pitch = 0.05; __t.show(t, d); }, [t, d]); await p.waitForTimeout(900);
    await p.screenshot({ path: path.join(OUT, 'enemy_' + t + '.png') });
  }
  if (mode === 'models') {
    await p.evaluate(() => __t.travelTo('tower')); await p.waitForTimeout(3500);
    await p.evaluate(() => { __t.player.pos.set(0, 0, -6.2); __t.player.yaw = 0; __t.player.pitch = -0.05; }); await p.waitForTimeout(900);
    await p.screenshot({ path: path.join(OUT, 'npc_kestrel.png') });
  }
  if (mode === 'guns') for (const a of ['auto', 'pulse', 'hand', 'scout', 'smg', 'shotgun', 'sniper', 'rocket']) {
    await p.evaluate(a => __t.gun(a), a); await p.waitForTimeout(900);
    await p.screenshot({ path: path.join(OUT, 'gun_' + a + '.png') });
  }
  console.log(JSON.stringify(errs.filter(e => !/Failed to load resource/.test(e)).slice(0, 10), null, 1));
  await b.close();
})();
