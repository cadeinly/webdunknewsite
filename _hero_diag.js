/* TEMP: Diagnose fuer den Hero-Titel (.hero-title).
   Misst pro Viewport die real verfuegbare Breite, die benoetigte Textbreite
   und die Zeilenzahl -> daraus den exakten cla... Faktor ableiten.
   Schreibt _hero_diag.txt und _hero_<id>.png.                              */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const DIR = __dirname;
const PAGE = 'file:///' + path.join(DIR, 'index.html').replace(/\\/g, '/');
const STAMP = Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = [];
const log = (s) => { out.push(s); fs.writeFileSync(path.join(DIR, '_hero_diag.txt'), out.join('\n'), 'utf8'); };

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    let id = 0;
    const timer = setTimeout(() => reject(new Error('ws timeout')), 15000);
    ws.addEventListener('open', () => {
      clearTimeout(timer);
      resolve({
        send(method, params) {
          id += 1;
          const myId = id;
          return new Promise((res, rej) => {
            pending.set(myId, { res, rej });
            ws.send(JSON.stringify({ id: myId, method, params: params || {} }));
            setTimeout(() => { if (pending.has(myId)) { pending.delete(myId); rej(new Error('cdp timeout ' + method)); } }, 30000);
          });
        },
        close() { try { ws.close(); } catch (e) {} }
      });
    });
    ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('ws error')); });
    ws.addEventListener('message', (ev) => {
      let msg = null;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) p.rej(new Error('cdp ' + JSON.stringify(msg.error))); else p.res(msg.result);
      }
    });
  });
}

const DIAG = `(() => {
  const h1 = document.querySelector('.hero-title');
  if (!h1) return JSON.stringify({ error: 'kein .hero-title' });
  const inner = document.querySelector('.screen__inner');
  const rail = document.querySelector('.rail');
  const chars = [...h1.querySelectorAll('.split-char')];
  const lines = chars.length ? new Set(chars.map((c) => c.offsetTop)).size : 1;
  const sumChars = chars.reduce((a, c) => a + c.offsetWidth, 0);
  const fs = parseFloat(getComputedStyle(h1).fontSize);
  // Referenzmessung: gleicher Font/Groesse/Tracking, aber ohne Split-Spans
  const probe = document.createElement('span');
  probe.className = 'hero-title';
  probe.style.cssText = 'position:absolute;left:-9999px;top:0;white-space:nowrap;visibility:hidden;margin:0';
  probe.textContent = h1.textContent.trim();
  document.body.appendChild(probe);
  const probeW = probe.getBoundingClientRect().width;
  const probeFs = parseFloat(getComputedStyle(probe).fontSize);
  probe.remove();
  const avail = h1.clientWidth;
  const need = Math.max(sumChars, probeW);
  return JSON.stringify({
    vp: innerWidth, clientW: document.documentElement.clientWidth,
    pad: inner ? getComputedStyle(inner).paddingLeft : null,
    railW: rail ? Math.round(rail.getBoundingClientRect().width) : 0,
    fs: fs, probeFs: probeFs, chars: chars.length, lines: lines,
    avail: avail, sumChars: Math.round(sumChars), probeW: Math.round(probeW),
    need: Math.round(need),
    emFaktor: +(need / fs).toFixed(4),
    reserve: +(100 * (avail - need) / avail).toFixed(2),
    h1Rect: Math.round(h1.getBoundingClientRect().width),
    boxH: Math.round(h1.getBoundingClientRect().height)
  }, null, 1);
})()`;
/* Fenstergroesse = Viewport + 24px (Chrome-Chrome) -> Viewport gezielt treffen */
const JOBS = [
  { id: 'vp1280', w: 1304, h: 900 },
  { id: 'vp1342', w: 1366, h: 900 },
  { id: 'vp1416', w: 1440, h: 900 },
  { id: 'vp1476', w: 1500, h: 900 },
  { id: 'vp1512', w: 1536, h: 900 },
  { id: 'vp1576', w: 1600, h: 900 },
  { id: 'vp1896', w: 1920, h: 1080 }
];

async function waitServer(port) {
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch('http://127.0.0.1:' + port + '/json/version'); if (r.ok) return true; } catch (e) {}
    await sleep(400);
  }
  return false;
}

async function evaluate(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return r.result.value;
}

/** Wartet, bis der Tailwind-CDN-Layer greift (xl:px-24 => 96px). */
async function waitReady(cdp, w) {
  const want = w >= 1280 ? '96px' : null;
  for (let i = 0; i < 40; i++) {
    try {
      const pad = await evaluate(cdp, "getComputedStyle(document.querySelector('.screen__inner')).paddingLeft");
      const ready = await evaluate(cdp, 'document.readyState');
      if (ready === 'complete' && (want === null || pad === want)) return 'ok pad=' + pad + ' n=' + i;
      if (i === 39) return 'TIMEOUT pad=' + pad + ' n=' + i;
    } catch (e) { /* noch nicht da */ }
    await sleep(500);
  }
  return 'TIMEOUT';
}

async function main() {
  for (let i = 0; i < JOBS.length; i++) {
    const job = JOBS[i];
    const PORT = 9600 + i;
    const userDir = path.join(os.tmpdir(), 'edge_hero_' + STAMP + '_' + job.id);
    log('>>> START ' + job.id + ' ' + job.w + 'x' + job.h + ' port=' + PORT);
    const proc = spawn(EDGE, [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--disable-extensions', '--disable-background-networking', '--mute-audio',
      '--user-data-dir=' + userDir, '--window-size=' + job.w + ',' + job.h,
      '--remote-debugging-port=' + PORT, '--remote-allow-origins=*', PAGE
    ], { stdio: 'ignore' });
    let cdp = null;
    try {
      if (!(await waitServer(PORT))) throw new Error('devtools-port nicht offen');
      const list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
      const target = list.filter((t) => t.type === 'page').find((t) => /index\.html/.test(t.url)) || list.find((t) => t.type === 'page');
      if (!target) throw new Error('kein page-target');
      cdp = await connect(target.webSocketDebuggerUrl);
      await cdp.send('Page.enable');
      log('    ready: ' + (await waitReady(cdp, job.w)));
      await sleep(1500);
      const diag = await evaluate(cdp, DIAG);
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      fs.writeFileSync(path.join(DIR, '_hero_' + job.id + '.png'), Buffer.from(shot.data, 'base64'));
      log('=== ' + job.id + ' (' + job.w + 'x' + job.h + ') ===');
      log(diag);
    } catch (e) {
      log('=== ' + job.id + ' FEHLER: ' + e.message);
    } finally {
      try { if (cdp) await cdp.send('Browser.close'); } catch (e) {}
      try { cdp && cdp.close(); } catch (e) {}
      try { proc.kill(); } catch (e) {}
      await sleep(700);
    }
  }
  log('FERTIG ' + JOBS.length + ' Jobs');
}

main().catch((e) => log('FATAL ' + e.stack));

