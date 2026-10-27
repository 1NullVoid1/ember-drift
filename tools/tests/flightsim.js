// Offline flight check: pulls flyJet and steerToward out of index.html and flies the mouse-aim autopilot through a
// set of maneuvers, printing peak bank, time to settle within 2 degrees, height change and tracking error.
// usage: node tools/tests/flightsim.js <three_dir> [index.html] [file with a steerToward to try instead]
// env: V=1 prints a bank/offset trace per maneuver, ONLY=<name> runs one maneuver
const fs = require('fs'), path = require('path');
const THREE = require(path.resolve(process.argv[2], 'build', 'three.js'));
const html = fs.readFileSync(process.argv[3] || path.resolve(__dirname, '..', '..', 'index.html'), 'utf8');
const override = process.argv[4] ? fs.readFileSync(process.argv[4], 'utf8') : null;
function grab(name, src){
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('no ' + name);
  for (let d = 0, n = src.indexOf('{', i); n < src.length; n++) { if (src[n] === '{') d++; else if (src[n] === '}' && --d === 0) return src.slice(i, n + 1); }
}
// the bits of the game the two functions touch
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const _jq2 = new THREE.Quaternion(), _jf = new THREE.Vector3(), _ju = new THREE.Vector3(), _jr = new THREE.Vector3(), _jq = new THREE.Quaternion(), _jm = new THREE.Matrix4(), _jv = new THREE.Vector3(), _jv2 = new THREE.Vector3(), _jv3 = new THREE.Vector3();
const jetFwd = (j, out) => (out || _jf).set(0, 0, -1).applyQuaternion(j.q);
const jetUp = (j, out) => (out || _ju).set(0, 1, 0).applyQuaternion(j.q);
const jetRight = (j, out) => (out || _jr).set(1, 0, 0).applyQuaternion(j.q);
const G_MAX = 9, airFloor = () => -1000, pillarAt = () => false, destroyJet = () => {}, flight = {}, player = {};
eval((grab('flyJet', html) + '\n' + grab('steerToward', override || html)).replace(/function (\w+)\(/g, 'global.$1 = function $1('));

const aimDir = (yawDeg, pitchDeg) => { const y = -yawDeg / 57.3, p = pitchDeg / 57.3; return new THREE.Vector3(-Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p)); };
function bankOf(j){ const r = new THREE.Vector3(1, 0, 0).applyQuaternion(j.q), u = new THREE.Vector3(0, 1, 0).applyQuaternion(j.q); let b = Math.asin(clamp(-r.y, -1, 1)) * 57.3; if (u.y < 0) b = (b >= 0 ? 180 : -180) - b; return b; }
function run(name, aimFn, frames, every){
  if (process.env.ONLY && process.env.ONLY !== name) return;
  // level at 450 m and about 610 km/h, 80% throttle, 30 frames a second like the game's test sim
  const j = { pos: new THREE.Vector3(0, 450, 700), vel: new THREE.Vector3(0, 0, -170), q: new THREE.Quaternion(), rate: new THREE.Vector3(), throttle: 0.8, grounded: false, flames: [] }, dt = 1 / 30;
  let maxBank = 0, settled = null, sumOff = 0, y0 = j.pos.y, ymin = y0, ymax = y0; const trace = [];
  for (let f = 0; f < frames; f++) {
    const aim = aimFn(f * dt), inp = steerToward(j, aim, 0);
    flyJet(j, Object.assign(inp, { thr: 0, burner: false, resp: 5 }), dt);
    const off = jetFwd(j, new THREE.Vector3()).angleTo(aim) * 57.3, b = bankOf(j);
    maxBank = Math.max(maxBank, Math.abs(b)); sumOff += off; ymin = Math.min(ymin, j.pos.y); ymax = Math.max(ymax, j.pos.y);
    if (off > 2) settled = null; else if (settled === null) settled = f * dt;
    if (f % every === 0) trace.push(Math.round(b) + '/' + off.toFixed(1));
  }
  console.log(name.padEnd(12), 'peak bank', String(Math.round(maxBank)).padStart(3), ' settled', settled === null ? '   -' : settled.toFixed(2), ' height', Math.round(ymin - y0) + '..+' + Math.round(ymax - y0), ' mean off', (sumOff / frames).toFixed(1), ' km/h', Math.round(j.vel.length() * 3.6));
  if (process.env.V) console.log('   bank/off', trace.join(' '));
}
const fixed = d => () => d;
run('level 40R', fixed(aimDir(40, 0)), 240, 6);
run('level 90R', fixed(aimDir(90, 0)), 300, 6);
run('level 150R', fixed(aimDir(150, 0)), 360, 6);
run('up30 R30', fixed(aimDir(30, 30)), 240, 6);
run('down20 R40', fixed(aimDir(40, -20)), 240, 6);
run('nudge 3R', fixed(aimDir(3, 1)), 120, 3);
run('nudge 8L', fixed(aimDir(-8, -2)), 120, 3);
run('up 60', fixed(aimDir(0, 60)), 240, 6);
run('below 6', fixed(aimDir(0, -6)), 150, 3);
run('below 5R5', fixed(aimDir(5, -5)), 150, 3);
run('below 18R', fixed(aimDir(10, -15)), 200, 6);
run('below 50', fixed(aimDir(10, -50)), 240, 6);
run('behind low', fixed(aimDir(160, -20)), 360, 6);
// the mouse swings right at 35 degrees a second for 2 s, then stops
run('sweep', t => aimDir(Math.min(t, 2) * 35, 0), 300, 6);
// following a target that weaves across the sky, slowly and then hard; and a shaky hand
run('track', t => aimDir(20 * Math.sin(t * 0.8), 6 * Math.sin(t * 1.3)), 360, 6);
run('track hard', t => aimDir(35 * Math.sin(t * 1.2), 10 * Math.sin(t * 1.9) - 4), 360, 6);
run('jitter', t => aimDir(3 * Math.sin(t * 5), 2 * Math.sin(t * 7)), 240, 6);
