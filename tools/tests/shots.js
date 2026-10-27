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
      html = html.toString().replace("requestAnimationFrame(frame);\n})();", "requestAnimationFrame(frame);\nwindow.__t = { big: () => { const out = []; scene.traverse(o => { if (!o.visible || !(o.isMesh || o.isSprite || o.isPoints)) return; if (o.isMesh && !o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); const r = o.isMesh ? o.geometry.boundingSphere.radius * o.getWorldScale(new THREE.Vector3()).length() / 1.732 : 0; const d = o.getWorldPosition(new THREE.Vector3()).distanceTo(camera.position); if (r > 60 && d < 800 || (o.isSprite && o.scale.x > 20)) out.push((o.geometry ? o.geometry.type : o.type) + ' r' + Math.round(r) + ' d' + Math.round(d) + ' ' + (o.material && o.material.type) + ' parent ' + (o.parent && (o.parent === scene ? 'scene' : o.parent === world ? 'world' : o.parent.type))); }); return out.join(' ; '); }, openGear, openDirector, renderGear, setTab: t => { gearTab = t; renderGear(); }, fill: n => { for (let k = 0; k < n; k++) { const it = rollItem(Math.floor(rand() * 5)); if (k % 2) inv.vault.push(it); else addItem(it); } saveInv(); }, sim: (n, dt) => { dt = dt || 1 / 30; for (let i = 0; i < n; i++) { time += dt; if (player.jet) updateFlight(dt); else updatePlayer(dt); updateEnemies(dt); updateProjectiles(dt); if (loc.battle) updateBattle(dt); updateFx(dt); if (player.jet) flightCamera(dt); } }, travelTo, aimTurn, chooseDeploy, ISLAND, camera, scene, renderer, player, BATTLE, enterJet, exitJet, keys, flight, get interactJet() { return interactJet; }, get state() { return state; }, info: () => JSON.stringify(renderer.info.render), get zone() { return ZONE; }, outposts, enemies, groundY, playDist, airFloor, pad, get near() { return camera.near; }, drop: p => { const L0 = loot.length; while (loot.length === L0 || loot[loot.length - 1].item.kind !== 'weapon') { if (loot.length > L0) { scene.remove(loot.pop().g); } dropLoot(p, 1); } }, show: (type, dist) => { if (window.__m) scene.remove(window.__m); const d = new THREE.Vector3(); camera.getWorldDirection(d); d.y = 0; d.normalize(); const e = buildEnemy(type); e.g.position.copy(camera.position).addScaledVector(d, dist); e.g.position.y = 0; e.g.lookAt(camera.position.x, e.g.position.y, camera.position.z); scene.add(e.g); window.__m = e.g; }, gun: (arch) => { const w = makeWeapon(ARCH[arch].slots[0], 3, 1010, { arch }); inv.equipped[w.slot] = w.uid; inv.items.push(w); player.wslot = WSLOTS.indexOf(w.slot); applyWeaponLook(); } };\n})();");
      return r.fulfill({ body: html, contentType: 'text/html; charset=utf-8' });
    }
    r.fulfill({ body: html, contentType: rel.endsWith('.jpg') ? 'image/jpeg' : rel.endsWith('.glb') ? 'model/gltf-binary' : 'application/octet-stream' });
  });
  await p.goto('http://local/index.html?q=full');
  await p.waitForTimeout(2500);
  fs.mkdirSync(OUT, { recursive: true });
  const pre = phone ? 'ph_' : '';
  await p.screenshot({ path: path.join(OUT, pre + 'menu.png') });
  const mode = process.argv[5];
  const ids = mode === 'guns' || mode === 'models' || mode === 'drops' ? ['steppe'] : mode === 'world' || mode === 'fps' || mode === 'battle' || mode === 'deploy' || mode === 'perf' || mode === 'probe' || mode === 'flight' || mode === 'jets' || mode === 'aitrace' || mode === 'ui' ? [] : ['tower', 'steppe', 'veyra', 'kharun'];
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
    await p.evaluate(() => __t.travelTo('rift')); await p.waitForFunction(() => __t.state === 'deploy', null, { timeout: 60000 }); await p.evaluate(() => __t.chooseDeploy(1)); await p.waitForTimeout(1500);
    await p.evaluate(() => { __t.player.pitch = -0.05; }); await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(OUT, pre + 'rift_ground.png') });
    // look at the field where the armies meet
    await p.evaluate(() => { __t.player.pos.set(0, 0, 200); __t.player.yaw = 0; }); await p.waitForTimeout(6000);
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
  if (mode === 'perf') {
    const rep = async tag => console.log(tag, await p.evaluate(() => { const scene = __t.scene; let n = 0, sh = 0; scene.traverse(o => { if (o.isMesh && o.visible) { n++; if (o.castShadow) sh++; } }); const lights = []; scene.traverse(o => { if (o.isLight) lights.push(o.type); }); const r = __t.renderer; r.info.autoReset = false; r.info.reset(); return new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => { const i = r.info.render; r.info.autoReset = true; res('meshes ' + n + ' shadowcasters ' + sh + ' lights ' + lights.length + ' calls ' + i.calls + ' tris ' + i.triangles + ' (2 frames incl shadows)'); }))); }));
    await p.evaluate(() => __t.travelTo('steppe')); await p.waitForFunction(() => __t.state === 'play', null, { timeout: 60000 }); await p.waitForTimeout(1500); await rep('steppe');
    await p.evaluate(() => __t.travelTo('rift')); await p.waitForFunction(() => __t.state === 'deploy', null, { timeout: 60000 }); await p.evaluate(() => __t.chooseDeploy(1)); await p.evaluate(() => __t.sim(60)); await p.waitForTimeout(1500); await rep('rift front');
    await p.evaluate(() => { __t.player.pos.set(0, 0, 0); __t.player.yaw = 0; }); await p.waitForTimeout(1500); await rep('rift mid');
    await p.evaluate(() => { const j = __t.BATTLE.jets.find(j => j.parked); __t.player.pos.set(j.pos.x + 5, 0, j.pos.z); __t.enterJet(j); j.pos.set(0, 300, 900); j.grounded = false; j.vel.set(0, 0, -150); __t.flight.camInit = false; __t.sim(2); }); await p.waitForTimeout(1500); await rep('rift air');
  }
  if (mode === 'flight') {
    await p.evaluate(() => __t.travelTo('rift')); await p.waitForFunction(() => __t.state === 'deploy', null, { timeout: 60000 }); await p.evaluate(() => __t.chooseDeploy(0)); await p.waitForTimeout(500);
    const st = () => p.evaluate(() => { const j = __t.player.jet; if (!j) return 'no jet ' + __t.state; const f = new THREE.Vector3(0, 0, -1).applyQuaternion(j.q), r = new THREE.Vector3(1, 0, 0).applyQuaternion(j.q); return JSON.stringify({ y: j.pos.y | 0, v: Math.round(j.vel.length() * 3.6), g: (j.gLoad || 0).toFixed(1), hdg: Math.round(Math.atan2(-f.x, -f.z) * 57.3), pit: Math.round(Math.asin(f.y) * 57.3), bank: Math.round(Math.asin(-r.y) * 57.3), aimOff: Math.round(f.angleTo(__t.flight.aim) * 57.3), gr: j.grounded, br: j.brake }); });
    await p.evaluate(() => { const j = __t.BATTLE.jets.find(j => j.parked && j.pos.z > 1000); __t.player.pos.set(j.pos.x + 5, 0, j.pos.z); __t.enterJet(j); __t.keys.KeyW = true; });
    for (let k = 0; k < 4; k++) { await p.evaluate(() => __t.sim(30)); console.log('roll', k, await st()); }
    await p.evaluate(() => __t.aimTurn(Math.PI, -0.35));
    for (let k = 0; k < 6; k++) { await p.evaluate(() => __t.sim(30)); console.log('climb', k, await st()); }
    await p.evaluate(() => __t.aimTurn(0, 0.35));
    for (let k = 0; k < 4; k++) { await p.evaluate(() => __t.sim(30)); console.log('level', k, await st()); }
    await p.evaluate(() => { __t.keys.ShiftLeft = true; __t.sim(240); }); console.log('burner 8s', await st());
    await p.evaluate(() => __t.aimTurn(-1.57, 0));
    for (let k = 0; k < 10; k++) { await p.evaluate(() => __t.sim(15)); console.log('turn90', k, await st()); }
    await p.waitForTimeout(800); await p.screenshot({ path: path.join(OUT, pre + 'flight_turn.png') });
    await p.evaluate(() => __t.aimTurn(3.0, 0));
    for (let k = 0; k < 10; k++) { await p.evaluate(() => __t.sim(20)); console.log('reverse', k, await st()); }
    await p.waitForTimeout(800); await p.screenshot({ path: path.join(OUT, pre + 'flight_level.png') });
    await p.evaluate(() => { __t.keys.ShiftLeft = false; __t.keys.KeyW = false; __t.keys.KeyS = true; __t.sim(90); }); console.log('throttle cut', await st());
    await p.evaluate(() => { __t.sim(90); }); console.log('airbrake', await st());
    await p.evaluate(() => { __t.keys.KeyS = false; __t.keys.ArrowDown = true; __t.keys.KeyW = true; __t.sim(30); __t.keys.ArrowDown = false; }); console.log('hand pull', await st());
    await p.evaluate(() => { __t.sim(60); }); console.log('after hand', await st());
  }
  if (mode === 'jets') {
    // flight handling: mouse-aim settling, direct-flight wing leveling, the airspace edge, bailing out outside the zone
    await p.evaluate(() => __t.travelTo('rift')); await p.waitForFunction(() => __t.state === 'deploy', null, { timeout: 60000 }); await p.evaluate(() => __t.chooseDeploy(0)); await p.waitForTimeout(300);
    const air = (mode, x, y, z, vx, vz) => p.evaluate(([mode, x, y, z, vx, vz]) => {
      let j = __t.player.jet; if (!j) { j = __t.BATTLE.jets.find(j => j.parked); __t.enterJet(j); }
      j.pos.set(x, y, z); j.grounded = false; j.vel.set(vx, 0, vz); j.q.setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(), new THREE.Vector3(vx, 0, vz).normalize(), new THREE.Vector3(0, 1, 0)));
      j.rate.set(0, 0, 0); j.throttle = 0.8; j.hp = j.maxHp; __t.flight.mode = mode; __t.flight.aim.set(vx, 0, vz).normalize(); __t.flight.camInit = false; __t.flight.handsOff = 0;
      for (const k in __t.keys) __t.keys[k] = false;
    }, [mode, x, y, z, vx, vz]);
    const trace = (n, step) => p.evaluate(([n, step]) => { const out = []; for (let i = 0; i < n; i++) { __t.sim(step); const j = __t.player.jet; if (!j) { out.push('nojet'); break; } const f = new THREE.Vector3(0, 0, -1).applyQuaternion(j.q), r = new THREE.Vector3(1, 0, 0).applyQuaternion(j.q), u = new THREE.Vector3(0, 1, 0).applyQuaternion(j.q); let bank = Math.asin(Math.max(-1, Math.min(1, -r.y))) * 57.3; if (u.y < 0) bank = (bank >= 0 ? 180 : -180) - bank; out.push([Math.round(bank), +(f.angleTo(__t.flight.aim) * 57.3).toFixed(1), Math.round(Math.hypot(j.pos.x, j.pos.z)), Math.round(j.pos.y)]); } return out; }, [n, step]);
    const fmt = t => t.map(x => Array.isArray(x) ? x[0] + '/' + x[1] + '@' + x[3] : x).join(' ');
    // A. mouse aim: 40 degrees right, then a 3 degree nudge
    await air('aim', 0, 450, 700, 0, -170); await p.evaluate(() => __t.aimTurn(0.7, 0));
    let t = await trace(40, 3); console.log('aim 40R bank/off', fmt(t));
    await p.evaluate(() => __t.aimTurn(0.05, -0.03)); t = await trace(20, 3); console.log('aim 3deg bank/off', fmt(t));
    // B. direct: roll right for half a second, let go
    await air('direct', 0, 450, 700, 0, -170);
    await p.evaluate(() => { __t.keys.ArrowRight = true; __t.sim(15); __t.keys.ArrowRight = false; });
    t = await trace(25, 3); console.log('direct release bank', t.map(x => x[0]).join(' '));
    // upside down, hands off
    await air('direct', 0, 450, 700, 0, -170); await p.evaluate(() => { const j = __t.player.jet; j.q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI * 0.97)); });
    t = await trace(25, 6); console.log('direct inverted bank', t.map(x => x[0]).join(' '));
    // a held bank-and-pull turn keeps its bank (the leveler waits for hands off)
    await air('direct', 0, 450, 700, 0, -170);
    await p.evaluate(() => { __t.keys.ArrowRight = true; __t.sim(12); __t.keys.ArrowRight = false; __t.keys.ArrowDown = true; });
    t = await trace(10, 6); console.log('direct pull bank', t.map(x => x[0]).join(' ')); await p.evaluate(() => { __t.keys.ArrowDown = false; });
    await p.waitForTimeout(600); await p.screenshot({ path: path.join(OUT, pre + 'jets_direct.png') });
    // C. direct: flying out past the edge of the airspace
    await air('direct', 2280, 300, 0, 200, 0);
    t = await trace(14, 30); console.log('edge r/alt', t.map(x => Array.isArray(x) ? x[2] + '@' + x[3] : x).join(' '));
    // D. bail out over the hills just outside the zone, and far out over the sea
    const spot = await p.evaluate(() => { for (let a = 0; a < 6.28; a += 0.05) for (const d of [520, 560, 600, 480]) { const x = Math.cos(a) * d, z = Math.sin(a) * d, pd = __t.playDist(x, z); if (pd > 40 && pd < 90 && __t.groundY(x, z) > 8) return [x, z, pd, __t.groundY(x, z)]; } return null; });
    console.log('hill spot', JSON.stringify(spot));
    if (spot) {
      await air('direct', spot[0], 120, spot[1], 0, -150); await p.evaluate(() => __t.exitJet(false));
      const r = await p.evaluate(() => { let n = 0; while (n < 900 && __t.player.eject && __t.state === 'play') { __t.sim(1); n++; } return JSON.stringify({ t: (n / 30).toFixed(1), state: __t.state, eject: __t.player.eject, pd: Math.round(__t.playDist(__t.player.pos.x, __t.player.pos.z)), y: __t.player.pos.y.toFixed(1) }); });
      console.log('bail near zone', r);
      if (await p.evaluate(() => __t.state) === 'deploy') await p.evaluate(() => __t.chooseDeploy(0));
    }
    await p.evaluate(() => { const j = __t.BATTLE.jets.find(j => j.parked); __t.player.pos.set(j.pos.x + 5, 0, j.pos.z); });
    await air('direct', -1700, 140, -500, 0, -150); await p.evaluate(() => __t.exitJet(false));
    const r2 = await p.evaluate(() => { let n = 0; while (n < 900 && __t.player.eject && __t.state === 'play') { __t.sim(1); n++; } return JSON.stringify({ t: (n / 30).toFixed(1), state: __t.state, eject: __t.player.eject, floor: __t.airFloor(__t.player.pos.x, __t.player.pos.z).toFixed(1), y: __t.player.pos.y.toFixed(1), note: !document.getElementById('depNote').hidden }); });
    console.log('bail at sea', r2);
    await p.waitForTimeout(400); await p.screenshot({ path: path.join(OUT, pre + 'jets_rescue.png') });
    // E. leaving the battle world while flying puts the near plane back and silences the engine
    await p.evaluate(() => __t.chooseDeploy(0)); await air('direct', 0, 300, 600, 0, -150); await p.evaluate(() => __t.sim(5));
    console.log('near in flight', await p.evaluate(() => __t.near));
    await p.evaluate(() => __t.travelTo('tower')); await p.waitForFunction(() => __t.state === 'play', null, { timeout: 60000 });
    console.log('near after travel', await p.evaluate(() => __t.near), 'muted', await p.evaluate(() => __t.flight.muted));
  }
  if (mode === 'probe') {
    await p.evaluate(() => __t.travelTo('rift')); await p.waitForFunction(() => __t.state === 'deploy', null, { timeout: 60000 }); await p.evaluate(() => __t.chooseDeploy(0));
    for (const y of [400, 830]) {
      await p.evaluate(y => { if (!__t.player.jet) { const j = __t.BATTLE.jets.find(j => j.parked && j.pos.z > 1000); __t.player.pos.set(j.pos.x + 5, 0, j.pos.z); __t.enterJet(j); } const j = __t.player.jet; j.pos.set(0, y, 900); j.grounded = false; j.vel.set(0, 0, -200); j.q.set(0, 0, 0, 1); __t.flight.aim.set(-0.5, 0.3, -0.8).normalize(); __t.flight.camInit = false; __t.sim(2); }, y);
      await p.waitForTimeout(1200); await p.screenshot({ path: path.join(OUT, 'probe_' + y + '.png') });
      console.log(y, await p.evaluate(() => __t.big()));
    }
  }
  if (mode === 'deploy') {
    await p.evaluate(() => __t.travelTo('rift')); await p.waitForFunction(() => __t.state === 'deploy', null, { timeout: 60000 }); await p.waitForTimeout(800);
    await p.screenshot({ path: path.join(OUT, pre + 'deploy_menu.png') });
    await p.click('#depHangar'); await p.waitForTimeout(1500);
    console.log('hangar', await p.evaluate(() => JSON.stringify({ state: __t.state, pos: __t.player.pos, pads: __t.BATTLE.pads.length, parked: __t.BATTLE.jets.filter(j => j.parked).length })));
    await p.evaluate(() => { __t.player.yaw = Math.PI; __t.player.pitch = -0.08; }); await p.waitForTimeout(1500);
    await p.screenshot({ path: path.join(OUT, pre + 'deploy_hangar.png') });
    await p.evaluate(() => { __t.player.yaw = 0; __t.player.pitch = -0.05; }); await p.waitForTimeout(1500);
    await p.screenshot({ path: path.join(OUT, pre + 'deploy_runway.png') });
    // high overview of the whole world from above the island
    await p.evaluate(() => { const j = __t.BATTLE.jets.find(j => j.parked && j.pos.z > 1000); __t.player.pos.set(j.pos.x + 5, 0, j.pos.z); __t.enterJet(j); j.pos.set(0, 420, 1500); j.q.setFromEuler(new THREE.Euler(-0.35, 0, 0)); j.vel.set(0, 0, -120); j.grounded = false; j.throttle = 0.7; __t.flight.camInit = false; __t.sim(2); }); await p.waitForTimeout(1500);
    await p.screenshot({ path: path.join(OUT, pre + 'deploy_overview.png') });
    await p.evaluate(() => { __t.exitJet(false); __t.sim(400); });
    // die-and-respawn shows the choice again; pick the front and watch the soldiers up close
    await p.evaluate(() => { __t.player.hp = 0; }); await p.evaluate(() => __t.sim(3)); await p.waitForTimeout(500);
    console.log('after death', await p.evaluate(() => __t.state));
    await p.evaluate(() => { document.getElementById('respawn').click(); }); await p.waitForTimeout(400);
    console.log('respawn ->', await p.evaluate(() => __t.state));
    await p.evaluate(() => __t.chooseDeploy(1)); await p.evaluate(() => __t.sim(120));
    for (let k = 0; k < 3; k++) {
      const r = await p.evaluate(() => { const a = __t.BATTLE.allies.filter(a => !a.dead).sort((x, y) => x.pos.distanceTo(__t.player.pos) - y.pos.distanceTo(__t.player.pos))[0]; if (!a) return 'none'; const sd = Math.atan2(a.vel ? a.vel.x : 0, a.vel ? a.vel.z : 1); __t.player.pos.set(a.pos.x + 4.5, 0, a.pos.z + 1.5); __t.player.yaw = Math.atan2(4.5, 1.5); __t.player.pitch = -0.05; __t.sim(4); return 'ally v ' + (a.vel ? a.vel.length().toFixed(1) : '?'); });
      await p.waitForTimeout(700); await p.screenshot({ path: path.join(OUT, pre + 'troop_' + k + '.png') }); console.log(r);
      await p.evaluate(() => __t.sim(9));
    }
    console.log('end', await p.evaluate(() => JSON.stringify({ allies: __t.BATTLE.allies.length, rivals: __t.enemies.filter(e => e.type === 'rival' && !e.dead).length, state: __t.state })));
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
