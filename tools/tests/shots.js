// Renders each location in headless Chromium and saves screenshots; prints any page or shader errors.
// usage: node tools/tests/shots.js <three_dir> <out_dir> [phone|desk] [guns|models|drops|world|fps]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..'), THREE_DIR = process.argv[2], OUT = process.argv[3], phone = process.argv[4] === 'phone';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: phone ? { width: 844, height: 390 } : { width: 1200, height: 675 }, hasTouch: phone, isMobile: phone });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 400)); });
  await p.route(/three@0\.128\.0\/(.*)/, r => { const m = r.request().url().match(/three@0\.128\.0\/(.*)/); r.fulfill({ path: path.join(THREE_DIR, m[1]), contentType: 'application/javascript' }); });
  await p.route(/fonts\./, r => r.abort());
  await p.route('http://local/**', r => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname.slice(1));
    let html = fs.readFileSync(path.join(ROOT, rel || 'index.html'));
    if (!rel || rel === 'index.html') {
      html = html.toString().replace("requestAnimationFrame(frame);\n})();", "requestAnimationFrame(frame);\nwindow.__t = { big: () => { const out = []; scene.traverse(o => { if (!o.visible || !(o.isMesh || o.isSprite || o.isPoints)) return; if (o.isMesh && !o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); const r = o.isMesh ? o.geometry.boundingSphere.radius * o.getWorldScale(new THREE.Vector3()).length() / 1.732 : 0; const d = o.getWorldPosition(new THREE.Vector3()).distanceTo(camera.position); if (r > 60 && d < 800 || (o.isSprite && o.scale.x > 20)) out.push((o.geometry ? o.geometry.type : o.type) + ' r' + Math.round(r) + ' d' + Math.round(d) + ' ' + (o.material && o.material.type) + ' parent ' + (o.parent && (o.parent === scene ? 'scene' : o.parent === world ? 'world' : o.parent.type))); }); return out.join(' ; '); }, openGear, openDirector, renderGear, setTab: t => { gearTab = t; renderGear(); }, fill: n => { for (let k = 0; k < n; k++) { const it = rollItem(Math.floor(rand() * 5)); if (k % 2) inv.vault.push(it); else addItem(it); } saveInv(); }, sim: (n, dt) => { dt = dt || 1 / 30; for (let i = 0; i < n; i++) { time += dt; if (player.jet) updateFlight(dt); else updatePlayer(dt); updateEnemies(dt); updateProjectiles(dt); if (loc.battle) updateBattle(dt); updateFx(dt); if (player.jet) flightCamera(dt); } }, travelTo, player, BATTLE, enterJet, exitJet, keys, flight, get interactJet() { return interactJet; }, get state() { return state; }, info: () => JSON.stringify(renderer.info.render), get zone() { return ZONE; }, outposts, enemies, groundY, drop: p => { const L0 = loot.length; while (loot.length === L0 || loot[loot.length - 1].item.kind !== 'weapon') { if (loot.length > L0) { scene.remove(loot.pop().g); } dropLoot(p, 1); } }, show: (type, dist) => { if (window.__m) scene.remove(window.__m); const d = new THREE.Vector3(); camera.getWorldDirection(d); d.y = 0; d.normalize(); const e = buildEnemy(type); e.g.position.copy(camera.position).addScaledVector(d, dist); e.g.position.y = 0; e.g.lookAt(camera.position.x, e.g.position.y, camera.position.z); scene.add(e.g); window.__m = e.g; }, gun: (arch) => { const w = makeWeapon(ARCH[arch].slots[0], 3, 1010, { arch }); inv.equipped[w.slot] = w.uid; inv.items.push(w); player.wslot = WSLOTS.indexOf(w.slot); applyWeaponLook(); } };\n})();");
      return r.fulfill({ body: html, contentType: 'text/html; charset=utf-8' });
    }
    r.fulfill({ body: html, contentType: rel.endsWith('.jpg') ? 'image/jpeg' : rel.endsWith('.glb') ? 'model/gltf-binary' : 'application/octet-stream' });
  });
  await p.goto('http://local/index.html');
  await p.waitForTimeout(2500);
  fs.mkdirSync(OUT, { recursive: true });
  const pre = phone ? 'ph_' : '';
  await p.screenshot({ path: path.join(OUT, pre + 'menu.png') });
  const mode = process.argv[5];
  const ids = mode === 'guns' || mode === 'models' || mode === 'drops' ? ['steppe'] : mode === 'world' || mode === 'fps' || mode === 'battle' || mode === 'aitrace' || mode === 'ui' ? [] : ['tower', 'steppe', 'veyra', 'kharun'];
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
    await p.evaluate(() => __t.travelTo('tower')); await p.waitForTimeout(8000);
    await p.evaluate(() => { __t.player.pos.set(0, 0, -6.2); __t.player.yaw = 0; __t.player.pitch = -0.05; }); await p.waitForTimeout(900);
    await p.screenshot({ path: path.join(OUT, pre + 'npc_kestrel.png') });
    await p.evaluate(() => { __t.player.pos.set(0.3, 0, -12.2); __t.player.yaw = Math.PI; __t.player.pitch = 0.05; }); await p.waitForTimeout(900);
    await p.screenshot({ path: path.join(OUT, pre + 'npc_kestrel_close.png') });
  }
  if (mode === 'fps') for (const id of ['tower', 'steppe']) {
    await p.evaluate(id => __t.travelTo(id), id); await p.waitForTimeout(4000);
    const f = await p.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { if (++n < 20) requestAnimationFrame(f); else r(1000 * n / (performance.now() - t0)); }; requestAnimationFrame(f); }));
    console.log(id, 'fps', f.toFixed(1), 'drawcalls', await p.evaluate(() => __t.info()));
  }
  if (mode === 'ui') {
    await p.evaluate(() => __t.travelTo('steppe')); await p.waitForFunction(() => __t.state === 'play', null, { timeout: 60000 }); await p.waitForTimeout(500);
    console.log('ui state', await p.evaluate(() => { const b = __t.state; __t.fill(40); __t.openGear(); return b + ' -> ' + __t.state; })); await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(OUT, pre + 'ui_gear.png') });
    await p.evaluate(() => { document.querySelector('#gMid .gtile:nth-child(2)') && document.querySelector('#gMid .gtile:nth-child(2)').click(); }); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(OUT, pre + 'ui_gear2.png') });
    console.log('tab', await p.evaluate(() => { try { __t.setTab('vault'); } catch (e) { return 'ERR ' + e.message; } return __t.state; })); await p.waitForTimeout(300);
    await p.evaluate(() => { const c = [...document.querySelectorAll('#gLeft .chip')].find(c => c.textContent === 'Weapons'); c.click(); }); await p.waitForTimeout(200);
    await p.evaluate(() => { document.querySelector('#gMid .gtile').click(); }); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(OUT, pre + 'ui_vault.png') });
    await p.evaluate(() => { document.getElementById('gearClose').click(); __t.openDirector(); }); await p.waitForTimeout(700);
    await p.screenshot({ path: path.join(OUT, pre + 'ui_map.png') });
    await p.evaluate(() => { [...document.querySelectorAll('.dnode')].find(n => n.textContent.includes('Talos')).click(); }); await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(OUT, pre + 'ui_map2.png') });
  }
  if (mode === 'aitrace') {
    await p.evaluate(() => __t.travelTo('rift')); await p.waitForTimeout(6000);
    console.log(await p.evaluate(() => { window.__nanlog = []; const orig = __t.BATTLE.jets; for (let k = 0; k < 1800; k++) { const snap = __t.BATTLE.jets.map(j => JSON.stringify({ team: j.team, ai: j.ai, dead: j.dead, p: j.pos, v: j.vel, b: j.bank, s: j.speed, e: j.extendT, ab: j.abandoned, pk: j.parked })); __t.sim(1); for (let i = 0; i < __t.BATTLE.jets.length; i++) { const j = __t.BATTLE.jets[i]; if (isNaN(j.pos.x + j.vel.x + j.q.x + j.bank + j.speed)) return 'NaN step ' + k + ' idx ' + i + ' before ' + snap[i] + ' missiles ' + __t.BATTLE.missiles.length; } if (k % 60 === 59) { /* let the page breathe between chunks is not possible here */ } } return 'clean'; }));
    for (let k = 0; k < 12; k++) { await p.evaluate(() => __t.sim(60)); console.log(await p.evaluate(() => window.__nan || ''), await p.evaluate(() => __t.BATTLE.jets.filter(j => j.ai && !j.dead).map(j => j.team[0] + Math.round(j.pos.y) + (j.extendT > 0 ? 'x' : '') + (j.target ? '>' + Math.round(j.target.pos.y) : '')).join(' '))); }
  }
  if (mode === 'battle') {
    await p.evaluate(() => __t.travelTo('rift')); await p.waitForFunction(() => __t.state === 'play', null, { timeout: 60000 }); await p.waitForTimeout(1500);
    await p.evaluate(() => { __t.player.pitch = -0.05; }); await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(OUT, pre + 'rift_ground.png') });
    // look at the field where the armies meet
    await p.evaluate(() => { __t.player.pos.set(0, 0, 40); __t.player.yaw = 0; }); await p.waitForTimeout(6000);
    await p.screenshot({ path: path.join(OUT, pre + 'rift_field.png') });
    console.log('battle', await p.evaluate(() => JSON.stringify({ jets: __t.BATTLE.jets.length, allies: __t.BATTLE.allies.length, score: __t.BATTLE.score, state: __t.state })));
    // walk to a pad and fly
    await p.evaluate(() => { const j = __t.BATTLE.jets.find(j => j.parked); __t.player.pos.set(j.pos.x + 5, 0, j.pos.z); __t.player.yaw = Math.PI / 2; }); await p.waitForTimeout(800);
    await p.screenshot({ path: path.join(OUT, pre + 'rift_pad.png') });
    console.log('near jet', await p.evaluate(() => !!__t.interactJet));
    const st = () => p.evaluate(() => { const j = __t.player.jet; return j ? JSON.stringify({ y: j.pos.y | 0, z: j.pos.z | 0, v: Math.round(j.vel.length() * 3.6), grounded: j.grounded, hp: j.hp | 0, thr: j.throttle.toFixed(2) }) : 'no jet, state ' + __t.state; });
    await p.evaluate(() => { __t.enterJet(__t.interactJet); __t.keys.KeyW = true; __t.keys.ShiftLeft = true; });
    for (let k = 0; k < 2; k++) { await p.evaluate(() => __t.sim(30)); console.log('roll', k, await st()); }
    await p.evaluate(() => { __t.keys.ArrowDown = true; });
    for (let k = 0; k < 16; k++) { if (k === 3) await p.evaluate(() => { __t.keys.ArrowDown = false; }); await p.evaluate(() => __t.sim(8)); console.log('pull', k, await st(), await p.evaluate(() => { const j = __t.player.jet; if (!j) return ''; const f = new THREE.Vector3(0, 0, -1).applyQuaternion(j.q), u = new THREE.Vector3(0, 1, 0).applyQuaternion(j.q); return 'fy ' + f.y.toFixed(2) + ' uy ' + u.y.toFixed(2) + ' vy ' + j.vel.y.toFixed(1); })); }
    await p.waitForTimeout(600); await p.screenshot({ path: path.join(OUT, pre + 'rift_fly.png') });
    console.log('rects', await p.evaluate(() => ['jThr', 'jThrFill', 'jLock', 'jPipper'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return id + ' ' + [r.x, r.y, r.width, r.height].map(Math.round) + ' ' + getComputedStyle(document.getElementById(id)).transform; }).join(' | ')));
    await p.evaluate(() => { __t.keys.ArrowRight = true; __t.sim(12); __t.keys.ArrowRight = false; __t.keys.ArrowDown = true; __t.sim(30); });
    console.log('bank and pull', await st());
    await p.waitForTimeout(600); await p.screenshot({ path: path.join(OUT, pre + 'rift_bank.png') });
    console.log(await p.evaluate(() => __t.BATTLE.jets.filter(j => !j.dead && j !== __t.player.jet && !j.parked).map(j => j.team + ' y' + Math.round(j.pos.y) + ' ai' + j.ai + ' ab' + j.abandoned + ' ext' + j.extendT.toFixed(1) + ' fy' + new THREE.Vector3(0, 0, -1).applyQuaternion(j.q).y.toFixed(2) + ' vy' + j.vel.y.toFixed(0)).join(' | ')));
    await p.evaluate(() => { __t.keys.ArrowDown = false; __t.keys.ArrowLeft = true; __t.sim(12); __t.keys.ArrowLeft = false; __t.sim(200); });
    console.log('level 7s', await st(), await p.evaluate(() => JSON.stringify({ score: __t.BATTLE.score, jets: __t.BATTLE.jets.filter(j => !j.dead).map(j => j.team[0] + (j.parked ? 'P' : '') + Math.round(j.pos.y)).join(' '), missiles: __t.BATTLE.missiles.length, allies: __t.BATTLE.allies.length })));
    // throttle off, stall
    await p.evaluate(() => { __t.keys.KeyW = false; __t.keys.KeyS = true; __t.keys.ArrowDown = true; __t.sim(150); __t.keys.KeyS = false; __t.keys.ArrowDown = false; });
    console.log('stall', await st());
    await p.waitForTimeout(600); await p.screenshot({ path: path.join(OUT, pre + 'rift_stall.png') });
    for (let k = 0; k < 10; k++) { await p.evaluate(() => { __t.keys.KeyW = true; __t.sim(30); }); console.log('recover', k, await st()); }
    await p.evaluate(() => __t.exitJet(false)); await p.evaluate(() => __t.sim(150));
    console.log('ejected', await p.evaluate(() => JSON.stringify({ y: __t.player.pos.y.toFixed(1), eject: __t.player.eject, state: __t.state })));
    await p.evaluate(() => __t.sim(600));
    console.log('sim 20s more', await p.evaluate(() => JSON.stringify({ score: __t.BATTLE.score, rivals: __t.enemies.filter(e => e.type === 'rival' && !e.dead).length, allies: __t.BATTLE.allies.length, jets: __t.BATTLE.jets.length, hp: __t.player.hp | 0, state: __t.state })));
  }
  if (mode === 'world') for (const id of ['steppe', 'veyra', 'kharun']) {
    await p.evaluate(id => __t.travelTo(id), id); await p.waitForTimeout(3500);
    // stand halfway down the first path, looking toward its outpost
    await p.evaluate(() => { const s = __t.zone.paths[0], a = { x: s.ax, z: s.az }, b = { x: s.bx, z: s.bz }; __t.player.pos.set((a.x + b.x) / 2, 0, (a.z + b.z) / 2); __t.player.yaw = Math.atan2(-(b.x - a.x), -(b.z - a.z)); __t.player.pitch = -0.08; });
    await p.waitForTimeout(1200); await p.screenshot({ path: path.join(OUT, pre + 'path_' + id + '.png') });
    // walk up to the outpost so its squad wakes
    const info = await p.evaluate(() => { const o = __t.zone.areas[1]; __t.player.pos.set(o.x + o.r + 20, 0, o.z); __t.player.yaw = Math.PI / 2; __t.player.pitch = -0.1; return { areas: __t.zone.areas.length, paths: __t.zone.paths.length }; });
    const f0 = await p.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { if (++n < 30) requestAnimationFrame(f); else r(1000 * n / (performance.now() - t0)); }; requestAnimationFrame(f); }));
    await p.waitForTimeout(9000); await p.screenshot({ path: path.join(OUT, pre + 'outpost_' + id + '.png') });
    info.fps = Math.round(f0);
    const st = await p.evaluate(() => ({ enemies: __t.enemies.length, aware: __t.enemies.filter(e => e.aware).length, outpost: __t.enemies.filter(e => e.outpost).length }));
    // run far away: outpost enemies should lose track
    await p.evaluate(() => { const o = __t.zone.areas[1]; __t.player.pos.set(0, 0, 8); }); await p.waitForTimeout(9000);
    const st2 = await p.evaluate(() => ({ aware: __t.enemies.filter(e => e.outpost && e.aware).length }));
    console.log(id, JSON.stringify(info), JSON.stringify(st), 'after leaving', JSON.stringify(st2));
  }
  if (mode === 'drops') {
    await p.evaluate(() => { __t.player.pitch = -0.35; for (let k = 0; k < 6; k++) __t.drop(new THREE.Vector3(__t.player.pos.x + (k - 2.5) * 1.3, 0, __t.player.pos.z - 4.5)); });
    await p.waitForTimeout(900); await p.screenshot({ path: path.join(OUT, pre + 'drops.png') });
  }
  if (mode === 'guns') for (const a of ['auto', 'pulse', 'hand', 'scout', 'smg', 'shotgun', 'sniper', 'rocket']) {
    await p.evaluate(a => __t.gun(a), a); await p.waitForTimeout(900);
    await p.screenshot({ path: path.join(OUT, 'gun_' + a + '.png') });
  }
  console.log(JSON.stringify(errs.filter(e => !/Failed to load resource/.test(e)).slice(0, 10), null, 1));
  await b.close();
})();
