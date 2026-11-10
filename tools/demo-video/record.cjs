// تسجيل مشهد الفيديو عبر لقطات CDP ثم تجميعه بـ ffmpeg
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const [p, outDir] = process.argv.slice(2);
(async () => {
  const fdir = path.join(outDir, 'frames-' + p); fs.rmSync(fdir, { recursive: true, force: true }); fs.mkdirSync(fdir, { recursive: true });
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); else if (/before-scan|fallback/.test(m.text())) console.log('LOG', m.text()); });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', async f => {
    const n = frames.length, file = path.join(fdir, String(n).padStart(6, '0') + '.jpg');
    fs.writeFileSync(file, Buffer.from(f.data, 'base64')); frames.push({ file, t: f.metadata.timestamp });
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch { }
  });
  await page.goto(`http://127.0.0.1:8765/tools/demo-video/stage.html?p=${p}`);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 });
  const t0 = Date.now();
  await page.waitForFunction(() => window.__done === true, null, { timeout: 300000, polling: 200 });
  await cdp.send('Page.stopScreencast');
  console.log('recorded', ((Date.now() - t0) / 1000).toFixed(1) + 's', frames.length, 'frames', errs.length ? 'ERR: ' + errs.join(' | ') : 'no errors');
  await b.close();
  // قائمة المدد لكل إطار
  let list = '';
  for (let i = 0; i < frames.length; i++) {
    const dur = i + 1 < frames.length ? Math.max(0.001, frames[i + 1].t - frames[i].t) : 0.5;
    list += `file '${frames[i].file}'\nduration ${dur.toFixed(4)}\n`;
  }
  list += `file '${frames[frames.length - 1].file}'\n`;
  fs.writeFileSync(path.join(outDir, `list-${p}.txt`), list);
})();
