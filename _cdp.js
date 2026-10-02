/* TEMP: Headless-Edge ueber CDP steuern (ohne puppeteer) und die mit
   _measure2.js gemessenen Layout-Werte + Screenshots einsammeln. */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const DIR = __dirname;
const PAGE = 'file:///' + path.join(DIR, '_measure2.html').replace(/\\/g, '/');
const WIDTHS = [1280, 1366, 1440, 1536, 1600, 1920];
const HEIGHT = 808;
const STAMP = Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const progress = (line) => fs.appendFileSync(path.join(DIR, '_m2_progress.txt'), line + '\n', 'utf8');

async function waitServer(port) {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + port + '/json/version');
      if (r.ok) return true;
    } catch (e) { /* noch nicht da */ }
    await sleep(400);
  }
  return false;
}

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

async function readPre(cdp) {
  let last = 'PENDING';
  for (let i = 0; i < 50; i++) {
    const r = await cdp.send('Runtime.evaluate', {
      expression: "JSON.stringify({pre:(document.getElementById('_m2_out')||{}).textContent||'',ready:document.readyState,gsap:!!window.gsap,chars:document.querySelectorAll('.split-char').length,iw:window.innerWidth,ih:window.innerHeight,sw:document.documentElement.scrollWidth})",
      returnByValue: true
    });
    try {
      const d = JSON.parse(r.result.value);
      if (d.pre) {
        return d.pre + '\nDIAG ready=' + d.ready + ' gsap=' + d.gsap + ' splitChars=' + d.chars +
          ' innerW=' + d.iw + 'x' + d.ih + ' docScrollW=' + d.sw;
      }
      last = 'NO_PRE ready=' + d.ready + ' gsap=' + d.gsap + ' splitChars=' + d.chars + ' innerW=' + d.iw;
    } catch (e) { last = 'EVAL_ERR ' + e.message; }
    await sleep(500);
  }
  return 'TIMEOUT: ' + last;
}

async function main() {
  const log = [];
  for (let i = 0; i < WIDTHS.length; i++) {
    const w = WIDTHS[i];
    const PORT = 9400 + i;
    const userDir = path.join(os.tmpdir(), 'edge_cdp_' + STAMP + '_' + w);
    progress('START w=' + w + ' port=' + PORT + ' t=' + ((Date.now() - STAMP) / 1000).toFixed(1) + 's');
    const proc = spawn(EDGE, [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--disable-extensions', '--disable-background-networking', '--mute-audio',
      '--user-data-dir=' + userDir, '--window-size=' + w + ',' + HEIGHT,
      '--remote-debugging-port=' + PORT, '--remote-allow-origins=*', PAGE
    ], { stdio: 'ignore' });
    let cdp = null;
    try {
      if (!(await waitServer(PORT))) throw new Error('devtools port offen? nein');
      const list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
      const target = list.filter((t) => t.type === 'page').find((t) => /_measure2\.html/.test(t.url)) || list.find((t) => t.type === 'page');
      if (!target) throw new Error('kein page-target');
      cdp = await connect(target.webSocketDebuggerUrl);
      await cdp.send('Page.enable');
      const text = await readPre(cdp);
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      fs.writeFileSync(path.join(DIR, '_m2_' + w + '.png'), Buffer.from(shot.data, 'base64'));
      fs.writeFileSync(path.join(DIR, '_m2_' + w + '.txt'), text, 'utf8');
      log.push('=== WINDOW ' + w + ' ===');
      log.push(text);
    } catch (e) {
      log.push('=== WINDOW ' + w + ' === FEHLER: ' + e.message);
    } finally {
      try { if (cdp) await cdp.send('Browser.close'); } catch (e) {}
      try { cdp && cdp.close(); } catch (e) {}
      try { proc.kill(); } catch (e) {}
      progress('FERTIG w=' + w + ' t=' + ((Date.now() - STAMP) / 1000).toFixed(1) + 's');
      await sleep(800);
    }
  }
  fs.writeFileSync(path.join(DIR, '_m2_all.txt'), log.join('\n'), 'utf8');
  console.log('fertig: ' + log.length + ' Bloecke');
}

main().catch((e) => {
  fs.writeFileSync(path.join(DIR, '_m2_all.txt'), 'FATAL ' + e.stack, 'utf8');
});
