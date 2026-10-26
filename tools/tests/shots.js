// Renders each location in headless Chromium and saves screenshots; prints any page or shader errors.
// usage: node tools/tests/shots.js <three_dir> <out_dir> [phone]
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
      html = html.toString().replace("requestAnimationFrame(frame);\n})();", "requestAnimationFrame(frame);\nwindow.__t = { travelTo, player };\n})();");
      return r.fulfill({ body: html, contentType: 'text/html; charset=utf-8' });
    }
    r.fulfill({ body: html, contentType: rel.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream' });
  });
  await p.goto('http://local/index.html');
  await p.waitForTimeout(2500);
  fs.mkdirSync(OUT, { recursive: true });
  const pre = phone ? 'ph_' : '';
  await p.screenshot({ path: path.join(OUT, pre + 'menu.png') });
  for (const id of ['tower', 'steppe', 'veyra', 'kharun']) {
    await p.evaluate(id => __t.travelTo(id), id); await p.waitForTimeout(3500);
    await p.evaluate(() => { __t.player.pitch = -0.12; }); await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(OUT, pre + id + '.png') });
  }
  console.log(JSON.stringify(errs.filter(e => !/Failed to load resource/.test(e)).slice(0, 10), null, 1));
  await b.close();
})();
