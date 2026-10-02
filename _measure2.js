/* TEMP v2: Layout-Messung des Hero-Titels mit NEUTRALISIERTEN Transformen.
   Vor der Messung werden gsap-Timeline + Inline-Transforms entfernt, damit
   kein laufender Stagger die Zeilen-/Wrap-Analyse verfaelscht. */
(function () {
  function r(n) { return Math.round(n * 10) / 10; }
  function fmt(rect) { return 'l=' + r(rect.left) + ' r=' + r(rect.right) + ' w=' + r(rect.width) + ' t=' + r(rect.top); }
  function group(parts, tol) {
    var groups = [];
    parts.forEach(function (p) {
      var box = p.getBoundingClientRect();
      var g = null;
      groups.forEach(function (x) { if (!g && Math.abs(x.top - box.top) <= tol) g = x; });
      if (!g) { g = { top: box.top, text: '', left: box.left, right: box.right }; groups.push(g); }
      g.text += p.textContent;
      g.left = Math.min(g.left, box.left);
      g.right = Math.max(g.right, box.right);
    });
    return groups.map(function (g) { return { top: r(g.top), text: g.text, w: r(g.right - g.left) }; });
  }
  function neutralize() {
    try { if (window.gsap) window.gsap.globalTimeline.pause(); } catch (e) {}
    [].forEach.call(document.querySelectorAll('.split-char, .split-inner'), function (el) { el.style.transform = 'none'; });
  }
  function hero(out) {
    var h1 = document.querySelector('#home h1.hero-title');
    if (!h1) { out.push('HERO=NO_H1'); return; }
    var inner = h1.parentElement;
    var ics = window.getComputedStyle(inner);
    var cs = window.getComputedStyle(h1);
    out.push('HERO_PAD_L=' + ics.paddingLeft + ' PAD_R=' + ics.paddingRight);
    out.push('HERO_FONT=' + cs.fontSize + ' LH=' + cs.lineHeight + ' LS=' + cs.letterSpacing + ' WS=' + cs.whiteSpace);
    out.push('HERO_RECT=' + fmt(h1.getBoundingClientRect()) + ' clientW=' + h1.clientWidth + ' scrollW=' + h1.scrollWidth + ' clientH=' + h1.clientHeight);
    var chars = [].slice.call(h1.querySelectorAll('.split-char'));
    out.push('CHAR_COUNT=' + chars.length);
    out.push('CHAR_BOXES=' + JSON.stringify(chars.map(function (c) {
      var b = c.getBoundingClientRect();
      return c.textContent + ':' + r(b.left) + '..' + r(b.right) + '@' + r(b.top);
    })));
    var gl = group(chars, 2);
    out.push('HERO_LINES=' + JSON.stringify(gl.map(function (l) { return l.text; })));
    out.push('HERO_LINE_W=' + JSON.stringify(gl.map(function (l) { return l.w; })));
    /* Echte Ein-Zeilen-Breite: Klon mit white-space:nowrap (Layout, ohne Transform) */
    var clone = h1.cloneNode(true);
    clone.style.position = 'absolute';
    clone.style.visibility = 'hidden';
    clone.style.whiteSpace = 'nowrap';
    clone.style.width = 'auto';
    clone.style.maxWidth = 'none';
    clone.style.left = '-9999px';
    inner.appendChild(clone);
    var need = clone.getBoundingClientRect().width;
    var scrollW = clone.scrollWidth;
    inner.removeChild(clone);
    var fs = parseFloat(cs.fontSize);
    out.push('ONELINE_NEED=' + r(need) + ' scrollW=' + scrollW + ' AVAIL=' + h1.clientWidth +
      ' FITS=' + (need <= h1.clientWidth) + ' RATIO=' + (need / h1.clientWidth).toFixed(4));
    out.push('EM_FACTOR=' + (need / fs).toFixed(4));
    out.push('HERO_TARGET_FS=' + r(h1.clientWidth / (need / fs)) + ' = ' + ((h1.clientWidth / (need / fs)) / window.innerWidth * 100).toFixed(2) + 'vw');
  }
  function splits(out) {
    [].slice.call(document.querySelectorAll('[data-split]')).filter(function (el) { return !el.closest('#home'); })
      .forEach(function (el, i) {
        var parts = [].slice.call(el.querySelectorAll('.split-char, .split-inner'));
        var gl = group(parts, 2);
        out.push('S' + i + ' "' + el.textContent.trim().slice(0, 28) + '" font=' + window.getComputedStyle(el).fontSize +
          ' clientW=' + el.clientWidth + ' scrollW=' + el.scrollWidth + ' LINES=' + JSON.stringify(gl.map(function (l) { return l.text; })) +
          ' LINE_W=' + JSON.stringify(gl.map(function (l) { return l.w; })));
      });
  }
  function run() {
    neutralize();
    var out = [];
    var de = document.documentElement;
    out.push('VIEWPORT=' + window.innerWidth + 'x' + window.innerHeight + ' DOC_clientW=' + de.clientWidth +
      ' scrollbar=' + (window.innerWidth - de.clientWidth) + ' outerW=' + window.outerWidth);
    out.push('MQ_768=' + window.matchMedia('(min-width: 768px)').matches + ' MQ_1280=' + window.matchMedia('(min-width: 1280px)').matches);
    out.push('RAILW=' + window.getComputedStyle(de).getPropertyValue('--rail-w').trim());
    out.push('DOC_SCROLL_W=' + de.scrollWidth + ' vs clientW=' + de.clientWidth);
    hero(out);
    splits(out);
    var pre = document.createElement('pre');
    pre.id = '_m2_out';
    pre.textContent = out.join('\n');
    document.body.appendChild(pre);
  }
  window.addEventListener('load', function () {
    var start = function () { window.setTimeout(run, 2200); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else start();
  });
})();
