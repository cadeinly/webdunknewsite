/* TEMP: Verifiziert das Full-Screen-Takeover-Scrolling der echten index.html
   mit headless Edge ueber CDP (ohne puppeteer).
   Prueft: JS-Fehler, Pin-Spacer je Sektion, Veil-Farben, leere Vollbilder. */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const DIR = __dirname;
const PAGE = 'file:///' + path.join(DIR, 'index.html').replace(/\\/g, '/');
const W = 1440, H = 900, PORT = 9510;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitServer(port) {
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch('http://127.0.0.1:' + port + '/json/version'); if (r.ok) return true; } catch (e) { }
    await sleep(400);
  }
  return false;
}

function connect(wsUrl, events) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    let id = 0;
    const timer = setTimeout(() => reject(new Error('ws timeout')), 15000);
    ws.addEventListener('open', () => {
      clearTimeout(timer);
      resolve({
        send(method, params) {
          id += 1; const myId = id;
          return new Promise((res, rej) => {
            pending.set(myId, { res, rej });
            ws.send(JSON.stringify({ id: myId, method, params: params || {} }));
            setTimeout(() => { if (pending.has(myId)) { pending.delete(myId); rej(new Error('cdp timeout ' + method)); } }, 40000);
          });
        },
        close() { try { ws.close(); } catch (e) { } }
      });
    });
    ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('ws error')); });
    ws.addEventListener('message', (ev) => {
      let msg = null;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id); pending.delete(msg.id);
        if (msg.error) p.rej(new Error('cdp ' + JSON.stringify(msg.error))); else p.res(msg.result);
      } else if (msg.method && events) {
        events.push(msg);
      }
    });
  });
}

async function evalJson(cdp, expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('EVAL ' + JSON.stringify(r.exceptionDetails.exception || r.exceptionDetails.text));
  return r.result.value;
}

/* Zustand: Sektionen, Veil-Opacity, Pin-Strecken, Farben an Messpunkten. */
const PROBE = `(function(){
  function bg(el){
    var e = el;
    while (e && e !== document.documentElement) {
      var b = getComputedStyle(e).backgroundColor;
      if (b && b !== 'rgba(0, 0, 0, 0)' && b !== 'transparent') return b;
      e = e.parentElement;
    }
    return getComputedStyle(document.documentElement).backgroundColor;
  }
  function sec(el){ var s = el && el.closest ? el.closest('section[data-section], footer') : null; return s ? (s.id || 'FOOTER') : 'NONE'; }
  var w = window.innerWidth, h = window.innerHeight;
  var secs = [].slice.call(document.querySelectorAll('main > section[data-section]')).map(function(s){
    var v = s.querySelector('.screen__veil');
    return {
      id: s.id,
      cls: s.className.replace(/screen|relative|overflow-hidden|isolate/g, '').trim().replace(/\\s+/g, ' '),
      top: Math.round(s.getBoundingClientRect().top),
      h: Math.round(s.getBoundingClientRect().height),
      veil: v ? +(+getComputedStyle(v).opacity).toFixed(2) : null,
      veilCol: v ? getComputedStyle(v).backgroundColor : null,
      bg: getComputedStyle(s).backgroundColor
    };
  });
  var content = 0;
  [].slice.call(document.querySelectorAll('h1,h2,h3,p,li,button,input,textarea,svg,dt,dd,.frame,.tee,.swatch')).forEach(function(el){
    var r = el.getBoundingClientRect();
    if (r.bottom < 8 || r.top > h - 8 || r.width < 2 || r.height < 2) return;
    if (el.getAttribute('aria-hidden') === 'true') return;
    if (el.closest('.screen__veil') || el.closest('.ghost')) return;
    var own = el.closest('section[data-section]');
    if (own) { var v = own.querySelector('.screen__veil'); if (v && +getComputedStyle(v).opacity > .5) return; }
    content += 1;
  });
  function pt(f){
    var y = Math.max(2, Math.min(h - 2, Math.round(h * f)));
    var el = document.elementFromPoint(Math.round(w / 2), y);
    return { y: y, sec: sec(el), bg: bg(el) };
  }
  return JSON.stringify({
    scrollY: Math.round(window.scrollY),
    doc: Math.round(document.documentElement.scrollHeight),
    spacers: document.querySelectorAll('.pin-spacer').length,
    secs: secs, content: content,
    top: pt(0.01), mid: pt(0.5), bot: pt(0.98),
    st: (window.ScrollTrigger ? ScrollTrigger.getAll().filter(function(t){ return t.pin; }).map(function(t){
      return { id: (t.trigger && t.trigger.id) || '?', start: Math.round(t.start), end: Math.round(t.end) };
    }) : [])
  });
})()`;

async function main() {
  const log = [];
  const events = [];
  const userDir = path.join(os.tmpdir(), 'edge_verify_' + Date.now());
  const proc = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-networking', '--mute-audio',
    '--user-data-dir=' + userDir, '--window-size=' + W + ',' + H,
    '--remote-debugging-port=' + PORT, '--remote-allow-origins=*', PAGE
  ], { stdio: 'ignore' });

  let cdp = null;
  try {
    if (!(await waitServer(PORT))) throw new Error('DevTools-Port nicht offen');
    const list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
    const target = list.find((t) => t.type === 'page');
    cdp = await connect(target.webSocketDebuggerUrl, events);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Page.reload', { ignoreCache: true });
    await sleep(4500);

    log.push('BOOT ' + await evalJson(cdp, "JSON.stringify({ready:document.readyState,gsap:!!window.gsap,st:!!window.ScrollTrigger,secs:document.querySelectorAll('main > section[data-section]').length,doc:document.documentElement.scrollHeight,vp:window.innerWidth+'x'+window.innerHeight})"));

    const first = JSON.parse(await evalJson(cdp, PROBE));
    log.push('DOC height=' + first.doc + ' viewport=' + W + 'x' + H + ' spacers=' + first.spacers + ' sections=' + first.secs.length);
    first.secs.forEach((s) => log.push('  SEC ' + s.id.padEnd(12) + ' cls=' + (s.cls || '-').padEnd(14) + ' bg=' + s.bg.padEnd(20) + ' h=' + String(s.h).padStart(5) + ' veilCol=' + s.veilCol));
    first.st.forEach((s) => log.push('  PIN ' + s.id.padEnd(12) + ' start=' + String(s.start).padStart(6) + ' end=' + String(s.end).padStart(6) + ' laenge=' + (s.end - s.start)));

    log.push('');
    log.push('--- SCROLL DURCHLAUF (step 150px) ---');
    const flags = [];
    for (let y = 0; y <= first.doc - H; y += 150) {
      await evalJson(cdp, 'window.scrollTo(0,' + y + '); true');
      await sleep(520);
      const s = JSON.parse(await evalJson(cdp, PROBE));
      const line = 'y=' + String(s.scrollY).padStart(5) +
        ' | top=' + s.top.sec.padEnd(11) + s.top.bg.padEnd(30) +
        ' | mid=' + s.mid.sec.padEnd(11) + s.mid.bg.padEnd(30) +
        ' | content=' + String(s.content).padStart(3) +
        ' | veil=' + s.secs.filter((x) => x.veil > 0.01).map((x) => x.id + ':' + x.veil).join(',');
      log.push(line);
      if (s.content < 3) flags.push('LEER y=' + s.scrollY + ' :: ' + line);
    }

    log.push('');
    log.push('--- JS-FEHLER / WARNUNGEN ---');
    const errs = events.filter((e) => /exceptionThrown|entryAdded/.test(e.method)).map((e) => {
      const p = e.params || {};
      if (e.method === 'Runtime.exceptionThrown') return 'EXCEPTION ' + JSON.stringify(p.exceptionDetails && (p.exceptionDetails.exception || p.exceptionDetails.text));
      return (p.entry ? p.entry.level + ' ' + p.entry.text : JSON.stringify(p).slice(0, 200));
    }).filter((t) => !/favicon/i.test(t));
    log.push(errs.length ? errs.join('\n') : 'keine');

    log.push('');
    log.push('--- BEFUNDE ---');
    log.push(flags.length ? flags.join('\n') : 'keine leeren Vollbild-Screens erkannt (content >= 3 ueberall)');
  } catch (e) {
    log.push('FEHLER: ' + e.stack);
  } finally {
    try { if (cdp) await cdp.send('Browser.close'); } catch (e) { }
    try { cdp && cdp.close(); } catch (e) { }
    try { proc.kill(); } catch (e) { }
  }
  fs.writeFileSync(path.join(DIR, '_verify_scroll.txt'), log.join('\n'), 'utf8');
  console.log('FERTIG -> _verify_scroll.txt (' + log.length + ' Zeilen)');
}

main().catch((e) => {
  fs.writeFileSync(path.join(__dirname, '_verify_scroll.txt'), 'FATAL ' + e.stack, 'utf8');
});
