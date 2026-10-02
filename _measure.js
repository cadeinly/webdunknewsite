/* TEMP: Layout-Messung der Split-Titel (Wrap-/Breiten-Analyse). */
(function () {
  function fmt(rect) {
    return 'l=' + Math.round(rect.left) + ' r=' + Math.round(rect.right) + ' w=' + Math.round(rect.width) + ' t=' + Math.round(rect.top);
  }
  function lines(parts) {
    var tops = parts.map(function (p) { return Math.round(p.getBoundingClientRect().top); });
    var uniq = tops.filter(function (v, i) { return tops.indexOf(v) === i; });
    return uniq.map(function (t) {
      return parts.filter(function (p) { return Math.round(p.getBoundingClientRect().top) === t; })
        .map(function (p) { return p.textContent; }).join('');
    });
  }
  function run() {
    var out = [];
    var h1 = document.querySelector('#home h1.hero-title');
    var chars = h1 ? [].slice.call(h1.querySelectorAll('.split-char')) : [];
    var line = h1 ? h1.querySelector('.split-line') : null;
    var cs = h1 ? window.getComputedStyle(h1) : null;
    out.push('VIEWPORT=' + window.innerWidth + 'x' + window.innerHeight);
    out.push('--rail-w=' + window.getComputedStyle(document.documentElement).getPropertyValue('--rail-w').trim());
    out.push('HERO_H1_RECT=' + (h1 ? fmt(h1.getBoundingClientRect()) : 'NO_H1'));
    out.push('HERO_H1_clientW=' + (h1 ? h1.clientWidth : -1) + ' scrollW=' + (h1 ? h1.scrollWidth : -1));
    out.push('HERO_FONT=' + (cs ? cs.fontSize : '?') + ' ls=' + (cs ? cs.letterSpacing : '?'));
    out.push('HERO_LINE_clientW=' + (line ? line.clientWidth : -1) + ' scrollW=' + (line ? line.scrollWidth : -1));
    out.push('HERO_SUM_W=' + chars.reduce(function (a, c) { return a + c.getBoundingClientRect().width; }, 0).toFixed(2));
    out.push('HERO_LINES=' + JSON.stringify(lines(chars)));
    if (chars.length && cs) {
      var fs = parseFloat(cs.fontSize);
      var sum = chars.reduce(function (a, c) { return a + c.getBoundingClientRect().width; }, 0);
      out.push('EM_FACTOR=' + (sum / fs).toFixed(4));
    }
    var others = [].slice.call(document.querySelectorAll('[data-split]')).filter(function (el) { return !el.closest('#home'); });
    others.forEach(function (el, i) {
      var parts = [].slice.call(el.querySelectorAll('.split-char, .split-inner'));
      out.push('SPLIT' + i + ' ' + el.tagName + ' class=' + el.className + ' text=' + JSON.stringify(el.textContent.trim().slice(0, 40)));
      out.push('SPLIT' + i + '_clientW=' + el.clientWidth + ' scrollW=' + el.scrollWidth + ' font=' + window.getComputedStyle(el).fontSize +
        ' rect=' + fmt(el.getBoundingClientRect()));
      out.push('SPLIT' + i + '_LINES=' + JSON.stringify(lines(parts)) + ' t0=' + window.getComputedStyle(parts[0]).transform);
    });
    var pre = document.createElement('pre');
    pre.id = '_measure_out';
    pre.textContent = out.join('\n');
    document.body.appendChild(pre);
  }
  window.addEventListener('load', function () {
    window.setTimeout(function () {
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { window.setTimeout(run, 200); });
      } else {
        window.setTimeout(run, 500);
      }
    }, 1500);
  });
})();
