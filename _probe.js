/* TEMP-Probe (wird nach dem Test geloescht): prueft Titel-Sichtbarkeit und
   Drawer-Open/Close im echten Browser und schreibt das Ergebnis in den DOM. */
(function () {
  var out = [];
  var rec = function (label, value) { out.push(label + ' = ' + value); };
  var cs = function (el, prop) { return el ? window.getComputedStyle(el)[prop] : 'NOEL'; };
  var rect = function (el) {
    if (!el) return 'NOEL';
    var r = el.getBoundingClientRect();
    return 'left=' + Math.round(r.left) + ' right=' + Math.round(r.right) + ' w=' + Math.round(r.width);
  };
  var slow = function (ms, fn) { window.setTimeout(fn, ms); };
  /* Im Headless-Betrieb laufen kaum rAF-Frames. Mit einem Sprung auf der
     globalen GSAP-Timeline werden alle Tweens sofort zu Ende gerendert —
     so lassen sich die echten Endzustaende messen. */
  var flush = function () {
    if (!window.gsap) return;
    window.gsap.globalTimeline.totalTime(window.gsap.globalTimeline.totalTime() + 30);
  };

  window.addEventListener('load', function () {
    slow(1200, function () {
      rec('HTMLCLASS', document.documentElement.className || '(leer)');
      rec('ISREADY', document.documentElement.classList.contains('is-ready'));
      rec('TYPEOF_GSAP', typeof window.gsap);
      rec('TYPEOF_SCROLLTRIGGER', typeof window.ScrollTrigger);

      /* Animationen beschleunigen: im Headless-Virtual-Time laufen nur wenige
         Frames, dadurch werden Endzustaende sonst nicht erreicht. */
      if (window.gsap) window.gsap.globalTimeline.timeScale(120);

      var h1 = document.querySelector('#home h1.hero-title');
      var line = document.querySelector('#home h1 .split-line');
      rec('H1_TEXT', h1 ? h1.textContent.trim() : 'NO_H1');

      slow(900, function () {
        flush();
        var ch = document.querySelector('#home h1 .split-char');
        rec('H1_CHAR_TRANSFORM', cs(ch, 'transform'));
        if (ch && line) {
          var cr = ch.getBoundingClientRect(), lr = line.getBoundingClientRect();
          rec('H1_CHAR_IN_MASK', 'charTop=' + Math.round(cr.top) + ' maskTop=' + Math.round(lr.top) +
            ' maskBottom=' + Math.round(lr.bottom) + ' sichtbar=' +
            (cr.top >= lr.top - 2 && cr.bottom <= lr.bottom + 2));
        }

        var h2 = document.querySelector('#textil h2 .split-inner');
        rec('TEXTIL_INNER_TRANSFORM', h2 ? cs(h2, 'transform') : 'NO_SPLIT_INNER');

        var drawer = document.getElementById('nav-drawer');
        var backdrop = document.getElementById('drawer-backdrop');
        var trigger = document.querySelector('[data-drawer-open]');
        rec('TRIGGER_LABEL', trigger ? (trigger.getAttribute('aria-label') || trigger.textContent.trim()) : 'NO_TRIGGER');
        rec('DRAWER_T0_TRANSFORM', cs(drawer, 'transform'));
        rec('DRAWER_T0_RECT', rect(drawer));
        rec('DRAWER_T0_ARIA', drawer ? drawer.getAttribute('aria-hidden') : '?');

        if (!trigger) { rec('ABORT', 'kein Trigger'); return; }

        trigger.click();
        slow(900, function () {
          flush();
          rec('DRAWER_OPEN_TRANSFORM', cs(drawer, 'transform'));
          rec('DRAWER_OPEN_RECT', rect(drawer));
          rec('DRAWER_OPEN_ARIA', drawer.getAttribute('aria-hidden'));
          rec('DRAWER_OPEN_LABEL', trigger.getAttribute('aria-label'));
          rec('DRAWER_OPEN_SICHTBAR', drawer.getBoundingClientRect().left >= -2);
          rec('BACKDROP_HIDDEN_WHILE_OPEN', backdrop.hidden);
          rec('BODY_OVERFLOW_WHILE_OPEN', document.body.style.overflow || '(leer)');

          trigger.click();
          slow(900, function () {
            flush();
            rec('DRAWER_CLOSED_TRANSFORM', cs(drawer, 'transform'));
            rec('DRAWER_CLOSED_RECT', rect(drawer));
            rec('DRAWER_CLOSED_ARIA', drawer.getAttribute('aria-hidden'));
            rec('DRAWER_CLOSED_LABEL', trigger.getAttribute('aria-label'));
            rec('BACKDROP_HIDDEN_WHILE_CLOSED', backdrop.hidden);
            rec('BODY_OVERFLOW_WHILE_CLOSED', document.body.style.overflow || '(leer)');

            var trigger2 = document.querySelectorAll('[data-drawer-close]');
            rec('CLOSE_ELEMENTS', trigger2.length);

            var track = document.querySelector('.marquee__track');
            rec('MARQUEE_TRANSFORM', cs(track, 'transform'));

            /* Scroll-abhaengige Tweens im Headless-Betrieb nicht ausloesbar:
               Tween direkt auf den Endzustand setzen und messen. */
            var secInner = document.querySelector('#textil h2 .split-inner');
            var secLine = document.querySelector('#textil h2 .split-line');
            var tweens = window.gsap && secInner ? window.gsap.getTweensOf(secInner) : [];
            rec('TEXTIL_TWEEN_COUNT', tweens.length);
            rec('TEXTIL_BEFORE', cs(secInner, 'transform'));
            tweens.forEach(function (t) { if (t.scrollTrigger) t.pause(); t.progress(1, false); });
            flush();
            rec('TEXTIL_END_TRANSFORM', cs(secInner, 'transform'));
            if (secInner && secLine) {
              var ir = secInner.getBoundingClientRect(), sr = secLine.getBoundingClientRect();
              rec('TEXTIL_IN_MASK', 'innerTop=' + Math.round(ir.top) + ' maskTop=' + Math.round(sr.top) +
                ' maskBottom=' + Math.round(sr.bottom) + ' sichtbar=' + (ir.top >= sr.top - 2 && ir.bottom <= sr.bottom + 2));
            }

            var rev = document.querySelector('#textil [data-reveal]');
            var revTweens = rev && window.gsap ? window.gsap.getTweensOf(rev) : [];
            rec('REVEAL_TWEEN_COUNT', revTweens.length);
            revTweens.forEach(function (t) { if (t.scrollTrigger) t.pause(); t.progress(1, false); });
            flush();
            rec('REVEAL_END', rev ? 'opacity=' + cs(rev, 'opacity') + ' transform=' + cs(rev, 'transform') : 'NO_REVEAL');

            var pre = document.createElement('pre');
            pre.id = 'PROBE';
            pre.textContent = 'PROBE_START\n' + out.join('\n') + '\nPROBE_END';
            document.body.appendChild(pre);
          });
        });
      });
    });
  });
})();
