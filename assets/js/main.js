/* ==========================================================================
   WEBDUNK — Showcase Landingpage
   Datei : assets/js/main.js
   Inhalt: 0) Utils/State   1) Smooth Scroll (Lenis optional)
           2) Navigation & Half-Screen-Drawer    3) Scroll-Animationen (GSAP)
           4) Marquee  5) Counter  6) Klicklotse-Preview  7) Accordion
           8) Formular  9) Cursor / Progress / Kleinkram
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     0 · UTILITIES & GLOBALER STATE
     ------------------------------------------------------------------------ */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* GSAP gilt erst als verfügbar, wenn AUCH ScrollTrigger geladen wurde.
     Fehlt eine der beiden Dateien (offline, Blocker, CDN-Fehler, Proxy),
     würde ein ungeschütztes registerPlugin() eine ReferenceError werfen und
     damit den kompletten Init-Block abbrechen: Titel blieben unsichtbar,
     Menü, Formular und Accordion wären tot. Deshalb hier prüfen und sauber
     auf die statische Ansicht umschalten. */
  let hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mqDesktop = window.matchMedia('(min-width: 768px)');
  const mqPointerFine = window.matchMedia('(hover: hover) and (pointer: fine)');

  const state = {
    drawerOpen: false,
    lenis: null,
    lastFocused: null,
    velocity: 0
  };

  if (hasGsap) {
    try {
      window.gsap.registerPlugin(window.ScrollTrigger);
      window.gsap.defaults({ ease: 'power3.out', duration: 1 });
    } catch (err) {
      hasGsap = false;
      window.console.warn('[Webdunk] GSAP/ScrollTrigger nicht initialisierbar — statische Ansicht.', err);
    }
  }

  /* Fällt GSAP aus, heben wir den "js"-Schutz auf, damit Titel, Hero und
     alle Reveals sofort statisch sichtbar sind. */
  if (!hasGsap) document.documentElement.classList.remove('js');

  /* ------------------------------------------------------------------------
     1 · SMOOTH SCROLL
     Lenis ist optional: fehlt die Lib, greift natives Scrollen mit
     scroll-behavior: smooth (siehe <html class="scroll-smooth">).
     ------------------------------------------------------------------------ */
  function initSmoothScroll() {
    if (typeof window.Lenis === 'undefined' || prefersReduced) return;

    state.lenis = new window.Lenis({
      duration: 1.05,
      lerp: 0.085,
      smoothWheel: true,
      syncTouch: false,        // Mobile: natives Touch-Scrolling bleibt aktiv
      wheelMultiplier: 1,
      gestureOrientation: 'vertical'
    });

    if (hasGsap) {
      state.lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => state.lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const loop = (t) => { state.lenis.raf(t); window.requestAnimationFrame(loop); };
      window.requestAnimationFrame(loop);
    }
  }

  /** Scrollt weich zu einer Sektion bzw. einem Element. */
  function scrollToTarget(target, { onComplete } = {}) {
    const el = typeof target === 'string' ? $(target) : target;
    if (!el) return;

    const top = Math.round(el.getBoundingClientRect().top + window.pageYOffset);

    if (state.lenis) {
      state.lenis.scrollTo(top, {
        duration: 1.25,
        easing: (t) => 1 - Math.pow(1 - t, 3),
        onComplete
      });
      return;
    }
    window.scrollTo({ top, behavior: prefersReduced ? 'auto' : 'smooth' });
    if (onComplete) window.setTimeout(onComplete, prefersReduced ? 0 : 700);
  }

  /** Scroll-Sperre, solange der Drawer offen ist. */
  function lockScroll(lock) {
    if (state.lenis) { lock ? state.lenis.stop() : state.lenis.start(); }
    document.body.style.overflow = lock ? 'hidden' : '';
  }

  /* ------------------------------------------------------------------------
     2 · NAVIGATION & HALF-SCREEN DRAWER
     ------------------------------------------------------------------------ */
  const drawer = $('#nav-drawer');
  const backdrop = $('#drawer-backdrop');

  const drawerLinks = drawer ? $$('.drawer-link', drawer) : [];

  function setTriggerState(open) {
    $$('[data-drawer-open]').forEach((btn) => {
      btn.setAttribute('aria-expanded', String(open));
      /* Die Trigger sind Umschalter -> Label mitführen */
      if (btn.hasAttribute('aria-label')) {
        btn.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
      }
    });
  }

  function openDrawer() {
    if (!drawer || state.drawerOpen) return;
    state.drawerOpen = true;
    state.lastFocused = document.activeElement;
    drawer.setAttribute('aria-hidden', 'false');
    setTriggerState(true);
    if (backdrop) backdrop.hidden = false;

    if (hasGsap && !prefersReduced) {
      gsap.killTweensOf([drawer, backdrop]);
      /* "x: 0" löscht den aus dem Prozent-Transform der CSS-Klasse (.drawer,
         translate3d(-100%,0,0)) gelesenen Pixelrest — sonst würde xPercent: 0
         das Panel nur von -200% auf -100% schieben und es bliebe unsichtbar. */
      gsap.set(drawer, { xPercent: -100, x: 0 });
      if (backdrop) {
        gsap.set(backdrop, { opacity: 0 });
        gsap.to(backdrop, { opacity: 1, duration: .5, ease: 'power2.out' });
      }
      gsap.to(drawer, { xPercent: 0, x: 0, duration: .85, ease: 'expo.out' });
      gsap.fromTo(drawerLinks,
        { yPercent: 60, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: .75, stagger: .045, delay: .1, ease: 'power3.out' });
    } else {
      drawer.style.transform = 'translate3d(0,0,0)';
    }

    lockScroll(true);
    const firstFocusable = drawer.querySelector('a, button');
    if (firstFocusable) window.setTimeout(() => firstFocusable.focus({ preventScroll: true }), hasGsap ? 400 : 0);
  }

  function closeDrawer(opts) {
    const restoreFocus = !opts || opts.restoreFocus !== false;
    if (!drawer || !state.drawerOpen) return;
    state.drawerOpen = false;
    drawer.setAttribute('aria-hidden', 'true');
    setTriggerState(false);

    /* Backdrop muss in JEDEM Fall wieder verschwinden — auch wenn eine
       laufende Animation unterbrochen wird (onInterrupt). */
    const hideBackdrop = () => { if (backdrop) backdrop.hidden = true; };

    if (hasGsap && !prefersReduced) {
      gsap.killTweensOf([drawer, backdrop]);
      gsap.to(drawer, { xPercent: -100, x: 0, duration: .65, ease: 'expo.inOut' });
      if (backdrop) {
        gsap.to(backdrop, {
          opacity: 0, duration: .45,
          onComplete: hideBackdrop, onInterrupt: hideBackdrop
        });
      }
      gsap.set(drawerLinks, { clearProps: 'all' });
    } else {
      drawer.style.transform = 'translate3d(-100%,0,0)';
      hideBackdrop();
    }

    lockScroll(false);
    if (restoreFocus && state.lastFocused instanceof HTMLElement) {
      state.lastFocused.focus({ preventScroll: true });
    }
  }

  /** Markiert den aktiven Menüpunkt (Rail + Drawer). */
  function setActiveSection(id) {
    $$('.rail-link, .drawer-link').forEach((el) => {
      const isActive = el.getAttribute('data-target') === '#' + id;
      el.classList.toggle('is-active', isActive);
      if (isActive) el.setAttribute('aria-current', 'true');
      else el.removeAttribute('aria-current');
    });
  }

  function initNavigation() {
    /* Trigger (Rail-Button, Mobile-Bar) schalten den Drawer um:
       klick = öffnen, erneuter Klick = schließen. */
    $$('[data-drawer-open]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (state.drawerOpen) closeDrawer();
        else openDrawer();
      });
    });
    /* Schliessen: Backdrop, Close-Button, ESC */
    $$('[data-drawer-close]').forEach((el) => el.addEventListener('click', () => closeDrawer()));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.drawerOpen) closeDrawer();
      /* Mini-Fokusfalle: Tab bleibt im offenen Drawer */
      if (e.key === 'Tab' && state.drawerOpen) {
        const focusables = $$('a[href], button:not([disabled])', drawer);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    /* Alle Sprungmarken: Drawer schliessen + weiches Auto-Scrollen */
    $$('[data-target]').forEach((link) => {
      link.addEventListener('click', (e) => {
        const target = link.getAttribute('data-target');
        if (!target || target === '#') return;
        e.preventDefault();

        const wasOpen = state.drawerOpen;
        if (wasOpen) closeDrawer({ restoreFocus: false });

        /* Drawer-Animation abwarten, danach scrollen */
        const delay = hasGsap && !prefersReduced ? (wasOpen ? 240 : 0) : 0;
        window.setTimeout(() => {
          scrollToTarget(target);
          if (window.history.replaceState) window.history.replaceState(null, '', target);
        }, delay);
      });
    });
  }

  /** Aktive Sektion hervorheben (Rail-Indikator). */
  function initActiveSectionTracking() {
    if (!hasGsap) return;
    $$('[data-section]').forEach((section) => {
      ScrollTrigger.create({
        trigger: section,
        start: 'top 55%',
        end: 'bottom 45%',
        onToggle: (self) => { if (self.isActive && section.id) setActiveSection(section.id); }
      });
    });
  }

  /* ------------------------------------------------------------------------
     3 · SCROLL-ANIMATIONEN (Split-Text, Hero, Reveals, Pinning)
     ------------------------------------------------------------------------ */

  /** Zerlegt einen Textknoten in maskierte Zeichen- bzw. Wort-Spans. */
  function splitText(el) {
    const mode = el.getAttribute('data-split') || 'words';
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    el.textContent = '';

    if (mode === 'chars') {
      const line = document.createElement('span');
      line.className = 'split-line';
      Array.from(text).forEach((ch) => {
        const span = document.createElement('span');
        span.className = 'split-char';
        span.textContent = ch === ' ' ? '\u00A0' : ch;
        line.appendChild(span);
      });
      el.appendChild(line);
      return $$('.split-char', el);
    }

    text.split(' ').forEach((word, i) => {
      const mask = document.createElement('span');
      mask.className = 'split-word';
      const inner = document.createElement('span');
      inner.className = 'split-inner';
      inner.textContent = word;
      mask.appendChild(inner);
      el.appendChild(mask);
      if (i < text.split(' ').length - 1) el.appendChild(document.createTextNode(' '));
    });
    return $$('.split-inner', el);
  }

  /** Intro des Heros: Zeichen fahren aus der Maske, Rest fadet gestaffelt ein. */
  function initHeroIntro() {
    const heroTitle = $('#home [data-split]');
    const heroBits = $$('#home [data-hero]');
    const showStatic = () => heroBits.forEach((el) => { el.style.opacity = '1'; });

    if (!hasGsap || prefersReduced || !heroTitle) {
      showStatic();
      return;
    }

    const chars = splitText(heroTitle);
    const tl = gsap.timeline({ delay: .2, defaults: { ease: 'expo.out' } });
    /* WICHTIG: Startwerte explizit setzen. Die CSS-Maske (siehe style.css,
       ".js .split-char") verschoben die Zeichen per translate3d() mit
       PROZENT. GSAP liest daraus Pixelwerte und behält sie im Transform
       bei — ein Tween auf yPercent: 0 allein würde den Titel also dauerhaft
       unter der Maske hängen lassen. Darum "y: 0" im Startzustand. */
    tl.fromTo(chars,
      { yPercent: 110, y: 0 },
      { yPercent: 0, y: 0, duration: 1.3, stagger: .05 }, 0)
      .to(heroBits, { opacity: 1, y: 0, duration: 1, stagger: .1 }, .45)
      .from('#home .scroll-cue', { opacity: 0, duration: 1 }, .9);

    /* Der Hero ist selbst ein Full-Screen-Takeover (data-pin-section):
       Pinning, Layer-Parallax und Veil-Übergabe übernimmt initPinnedSection().
       Hier bleibt nur das Ausblenden des Scroll-Hinweises — bewusst OHNE
       Fade des Inhalts, damit beim Verlassen keine leere schwarze Fläche
       entsteht (der Hero übergibt stattdessen nahtlos an die weisse Folgesektion). */
    gsap.to('#home .scroll-cue', {
      opacity: 0, ease: 'none',
      scrollTrigger: {
        trigger: '#home',
        start: 'top top',
        end: () => '+=' + Math.round(window.innerHeight * .5),
        scrub: true
      }
    });
  }

  /** Alle Überschriften mit [data-split] maskiert einfliegen lassen. */
  function initSplitHeadings() {
    $$('[data-split]').forEach((el) => {
      if (el.closest('#home')) return;               // Hero overnimmt initHeroIntro()
      const parts = splitText(el);
      if (!hasGsap || prefersReduced) {
        parts.forEach((p) => { p.style.transform = 'none'; });
        return;
      }
      /* Start explizit aus der Maske (yPercent: 110) UND mit "y: 0", damit der
         aus dem Prozent-Transform der CSS-Maske stammende Pixelrest gelöscht
         wird — sonst bleiben die Überschriften unsichtbar. */
      gsap.fromTo(parts,
        { yPercent: 110, y: 0 },
        {
          yPercent: 0, y: 0, duration: 1.15, stagger: .05, ease: 'expo.out',
          /* Wiederholbar: beim erneuten Herunterscrollen laufen die
             Überschriften jedes Mal wieder aus der Maske. */
          scrollTrigger: { trigger: el, start: 'top 86%', toggleActions: 'play none none reset' }
        });
    });
  }

  /** Generische Reveals: [data-reveal="up|scale|fade"] */
  function initReveals() {
    const items = $$('[data-reveal]');
    if (!hasGsap || prefersReduced) {
      items.forEach((el) => { el.style.opacity = '1'; el.style.transform = 'none'; });
      return;
    }
    items.forEach((el) => {
      gsap.to(el, {
        opacity: 1, y: 0, scale: 1, duration: 1.05, ease: 'power3.out',
        delay: parseFloat(el.getAttribute('data-reveal-delay') || '0'),
        /* Wiederholbar (kein "once"): jede Sektion baut sich bei jedem
           Scroll-Durchgang erneut auf. */
        scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none reset' }
      });
    });
  }

  /* ------------------------------------------------------------------------
     3b · FULL-SCREEN TAKEOVER (Pinning + gescrubbte Transformationen)
     Aktiv nur auf Desktop (>= 768px, ausreichend hoch). Auf Mobile bleibt
     der normale Scrollfluss (siehe Requirements: unter 768px Fallback).
     ------------------------------------------------------------------------ */
  function initPinnedSection(section) {
    const inner = section.querySelector('.screen__inner');
    const veil = section.querySelector('.screen__veil');
    const title = section.querySelector('[data-pin="title"]');
    const lead = section.querySelector('[data-pin="lead"]');
    const media = section.querySelector('[data-pin="media"]');
    const ghost = section.querySelector('[data-pin="ghost"]');
    const cards = $$('[data-pin="card"]', section);
    if (!inner) return;

    /* A · Eintritt: Inhalte fahren ein, sobald die Sektion andockt.
       Der Hero bringt seine eigene Intro-Choreografie mit (data-pin-intro="skip").
       Wiederholbar: beim Zurückscrollen werden die Startwerte erneut gesetzt. */
    const introTargets = [title, lead, media, ...cards].filter(Boolean);
    if (introTargets.length && section.getAttribute('data-pin-intro') !== 'skip') {
      gsap.from(introTargets, {
        y: 48, opacity: 0, duration: 1.05, stagger: .09, ease: 'power3.out',
        scrollTrigger: { trigger: section, start: 'top 72%', toggleActions: 'play none none reset' }
      });
    }

    /* B · Takeover: die Sektion wird gepinnt und beim Scrollen transformiert */
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => '+=' + Math.round(window.innerHeight * 0.85),
        pin: section,
        pinSpacing: true,
        scrub: .7,
        anticipatePin: 1,
        invalidateOnRefresh: true
      }
    });

    /* Nur Layer animieren, die tatsächlich existieren (jede Sektion hat eine
       eigene Mischung aus Ghost-Nummer, Titel, Lead, Medium und Karten). */
    if (ghost) tl.to(ghost, { yPercent: -26, scale: 1.06, ease: 'none' }, 0);
    if (media) tl.to(media, { yPercent: -9, scale: 1.05, ease: 'none' }, 0);
    if (title) tl.to(title, { yPercent: -16, ease: 'none' }, 0);
    if (lead) tl.to(lead, { yPercent: -24, ease: 'none' }, 0);
    if (cards.length) tl.to(cards, { yPercent: -32, ease: 'none', stagger: .04 }, 0);

    /* Die Veil-Farbe entspricht der Folgesektion (siehe style.css) — die
       Kontrastfarbe wird exakt am Ende der Pin-Strecke voll deckend, sodass
       die nächste Sektion ohne leeren Zwischenscreen andockt. */
    if (veil) tl.fromTo(veil, { opacity: 0 }, { opacity: 1, duration: .22, ease: 'power2.in' }, .78);
  }

  /** Mobile-Fallback: kein Pinning, nur sanfte Layer-Parallaxen. */
  function initMobileParallax(section) {
    const media = section.querySelector('[data-pin="media"]');
    const ghost = section.querySelector('[data-pin="ghost"]');
    const tl = gsap.timeline({
      scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true }
    });
    if (media) tl.to(media, { y: -26, ease: 'none' }, 0);
    if (ghost) tl.to(ghost, { y: -46, ease: 'none' }, 0);
  }

  function initSectionTakeovers() {
    if (!hasGsap || prefersReduced) return;
    const pinned = $$('[data-pin-section]');
    if (!pinned.length) return;

    const mm = gsap.matchMedia();
    mm.add('(min-width: 768px) and (min-height: 660px)', () => {
      pinned.forEach(initPinnedSection);
    });
    mm.add('(max-width: 767.98px)', () => {
      pinned.forEach(initMobileParallax);
    });
  }

  /* ------------------------------------------------------------------------
     4 · INFINITE MARQUEE
     Läuft endlos und reagiert auf Scroll-Richtung & -Geschwindigkeit.
     Ohne GSAP greift automatisch die CSS-Keyframe-Variante (.marquee--css).
     ------------------------------------------------------------------------ */
  function initMarquees() {
    $$('[data-marquee]').forEach((marquee) => {
      const track = marquee.querySelector('.marquee__track');
      if (!track) return;

      if (!hasGsap || prefersReduced) { marquee.classList.add('marquee--css'); return; }

      const reverse = marquee.getAttribute('data-marquee') === 'reverse';
      const dir = reverse ? -1 : 1;
      const tween = gsap.fromTo(track,
        { xPercent: dir === 1 ? 0 : -50 },
        { xPercent: dir === 1 ? -50 : 0, duration: 30, ease: 'none', repeat: -1 });
      tween.timeScale(dir);

      let resetId = 0;
      ScrollTrigger.create({
        trigger: marquee,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (self) => {
          const boost = Math.min(Math.abs(self.getVelocity()) / 1400, 2.2);
          gsap.to(tween, { timeScale: dir * (1 + boost), duration: .3, overwrite: true });
          window.clearTimeout(resetId);
          resetId = window.setTimeout(() => {
            gsap.to(tween, { timeScale: dir, duration: .9, overwrite: true });
          }, 180);
        }
      });
    });
  }

  /* ------------------------------------------------------------------------
     5 · ZAHLEN-COUNTER
     ------------------------------------------------------------------------ */
  function initCounters() {
    const nf = new Intl.NumberFormat('de-DE');
    $$('[data-counter]').forEach((el) => {
      const to = parseFloat(el.getAttribute('data-counter')) || 0;
      const from = parseFloat(el.getAttribute('data-counter-from') || '0');
      const suffix = el.getAttribute('data-counter-suffix') || '';
      const decimals = parseInt(el.getAttribute('data-counter-decimals') || '0', 10) || 0;
      const render = (v) => {
        const num = decimals > 0
          ? v.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
          : nf.format(Math.round(v));
        el.textContent = num + suffix;
      };

      if (!hasGsap || prefersReduced) { render(to); return; }

      const obj = { v: from };
      render(from);
      gsap.to(obj, {
        v: to, duration: 1.7, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 92%', once: true },
        onUpdate: () => render(obj.v)
      });
    });
  }

  /* ------------------------------------------------------------------------
     6 · KLICKLOTSE-DEMO-PREVIEW (Screen 1 · WordPress Vermietung für Schulen)
     Klick auf einen Demo-Tab tauscht Inhalte, Akzentfarbe und Ziel-URL
     der Browser-Vorschau — ganz ohne externe iFrame-Einbindung.
     ------------------------------------------------------------------------ */
  const DEMOS = {
    grundschule: {
      accent: '#1F6F5C',
      url: 'grundschule-sonnenblume.klicklotse.de',
      brand: 'Grundschule Sonnenblume',
      links: ['Startseite', 'Unsere Schule', 'Klassen', 'Termine'],
      headline: 'Willkommen an der Grundschule Sonnenblume',
      sub: 'Gemeinsam lernen, entdecken und wachsen — alle Infos für Eltern, Kinder und Kollegium.',
      cta: 'Elternbriefe ansehen',
      cards: ['Aktuelles', 'Ferienplan', 'Mensa']
    },
    gymnasium: {
      accent: '#1E3A8A',
      url: 'gymnasium-nord.klicklotse.de',
      brand: 'Gymnasium Nord',
      links: ['Startseite', 'Fächer', 'Oberstufe', 'Termine'],
      headline: 'Gymnasium Nord — Wissen mit Weitblick',
      sub: 'Fächer, Oberstufe, Projekte und Klausurpläne in einer klar strukturierten Schulwebsite.',
      cta: 'Oberstufe entdecken',
      cards: ['Klausurplan', 'Fächer', 'Projekte']
    },
    gesamtschule: {
      accent: '#B45309',
      url: 'gesamtschule-sued.klicklotse.de',
      brand: 'Gesamtschule Süd',
      links: ['Startseite', 'Über uns', 'Jahrgänge', 'Kontakt'],
      headline: 'Gesamtschule Süd — alle Abschlüsse an einem Ort',
      sub: 'Von Jahrgang 5 bis zum Abitur: Stundenpläne, AGs und Anmeldung digital organisiert.',
      cta: 'Anmeldung starten',
      cards: ['AG-Übersicht', 'Stundenplan', 'Anmeldung']
    }
  };

  function initKlicklotsePreview() {
    const screen = $('#demo-screen');
    if (!screen) return;

    const tabs = $$('.demo-tab');
    const els = {
      url: $('#demo-url'),
      brand: $('#demo-brand'),
      links: $('#demo-links'),
      headline: $('#demo-headline'),
      sub: $('#demo-sub'),
      cta: $('#demo-cta'),
      cards: $('#demo-cards'),
      link: $('#demo-link')
    };
    const escape = (str) => String(str).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    const apply = (key) => {
      const demo = DEMOS[key];
      if (!demo) return;

      screen.style.setProperty('--accent', demo.accent);
      if (els.url) els.url.textContent = demo.url;
      if (els.brand) els.brand.textContent = demo.brand;
      if (els.links) els.links.innerHTML = demo.links.map((l) => '<span>' + escape(l) + '</span>').join('');
      if (els.headline) els.headline.textContent = demo.headline;
      if (els.sub) els.sub.textContent = demo.sub;
      if (els.cta) els.cta.textContent = demo.cta;
      if (els.cards) {
        els.cards.innerHTML = demo.cards.map((c) =>
          '<div class="frame__card"><b>' + escape(c) + '</b><div><i></i><i></i></div></div>').join('');
      }
      if (els.link) els.link.href = 'https://' + demo.url;

      tabs.forEach((tab) => tab.classList.toggle('is-active', tab.getAttribute('data-demo') === key));

      if (hasGsap && !prefersReduced) {
        const animated = [els.headline, els.sub, els.links, els.cards].filter(Boolean);
        gsap.fromTo(animated, { y: 14, opacity: 0 },
          { y: 0, opacity: 1, duration: .6, stagger: .06, ease: 'power3.out', overwrite: true });
      }
    };

    tabs.forEach((tab) => tab.addEventListener('click', () => apply(tab.getAttribute('data-demo'))));
    apply('grundschule');
  }

  /* ------------------------------------------------------------------------
     6b · SHOWCASE-FILTER (Screen 5)
     Die Chips mit [data-filter] blenden die .work-card-Elemente ein/aus.
     Die Kategorie steht am Element als data-cat.
     ------------------------------------------------------------------------ */
  function initShowcaseFilter() {
    const grid = $('#showcase-grid');
    if (!grid) return;

    const cards = $$('.work-card', grid);
    const chips = $$('[data-filter]');
    if (!cards.length || !chips.length) return;

    const show = (card, visible) => {
      if (visible) {
        card.classList.remove('is-hidden');
        if (hasGsap && !prefersReduced) {
          gsap.fromTo(card, { opacity: 0, y: 18 },
            { opacity: 1, y: 0, duration: .5, ease: 'power3.out', overwrite: true });
        }
      } else if (hasGsap && !prefersReduced) {
        gsap.to(card, {
          opacity: 0, y: 12, duration: .3, ease: 'power2.in', overwrite: true,
          onComplete: () => { card.classList.add('is-hidden'); gsap.set(card, { clearProps: 'opacity,transform' }); }
        });
      } else {
        card.classList.add('is-hidden');
      }
    };

    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const filter = chip.getAttribute('data-filter');
        chips.forEach((c) => c.classList.toggle('is-active', c === chip));
        cards.forEach((card) => {
          show(card, filter === 'all' || card.getAttribute('data-cat') === filter);
        });
      });
    });
  }

  /* ------------------------------------------------------------------------
     7 · ACCORDION (Impressum / Datenschutz)
     ------------------------------------------------------------------------ */
  function initAccordions() {
    $$('[data-accordion]').forEach((item) => {
      const head = $('.acc__head', item);
      const panel = $('.acc__panel', item);
      if (!head || !panel) return;

      const setOpen = (open) => {
        item.classList.toggle('is-open', open);
        head.setAttribute('aria-expanded', String(open));

        if (hasGsap && !prefersReduced) {
          gsap.to(panel, {
            height: open ? panel.scrollHeight : 0,
            duration: .55, ease: 'power3.inOut', overwrite: true
          });
        } else {
          panel.style.height = open ? 'auto' : '0px';
        }
      };

      head.addEventListener('click', () => setOpen(!item.classList.contains('is-open')));
      panel.style.height = '0px';
    });
  }

  /* ------------------------------------------------------------------------
     8 · KONTAKTFORMULAR (Client-seitige Validierung)
     DEMO: Es wird nichts versendet. In Produktion hier einen fetch()-Call an
     das eigene Postfach/CRM einbauen (siehe README.md → "Formular anbinden").
     ------------------------------------------------------------------------ */
  function initContactForm() {
    const form = $('#contact-form');
    if (!form) return;
    const status = $('#form-status');

    const validate = (field) => {
      const input = field.querySelector('.field__input');
      const errorEl = field.querySelector('[data-error]');
      let message = '';

      if (input && input.hasAttribute('required')) {
        const value = (input.value || '').trim();
        if (input.type === 'checkbox') {
          if (!input.checked) message = 'Bitte bestätigen.';
        } else if (!value) {
          message = 'Bitte ausfüllen.';
        } else if (input.type === 'email' && !/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(value)) {
          message = 'Bitte eine gültige E-Mail-Adresse angeben.';
        }
      }
      field.classList.toggle('field--error', Boolean(message));
      if (errorEl) errorEl.textContent = message;
      return !message;
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let valid = true;
      $$('[data-field]', form).forEach((field) => { if (!validate(field)) valid = false; });

      if (!valid) {
        if (status) {
          status.textContent = 'Bitte prüfen Sie die markierten Felder.';
          status.classList.add('is-visible');
        }
        return;
      }

      if (status) {
        status.textContent = 'Danke! Wir melden uns innerhalb von 24 Stunden. (Demo-Formular ohne Versand.)';
        status.classList.add('is-visible');
      }
      form.reset();
    });

    form.addEventListener('input', (e) => {
      const field = e.target.closest('[data-field]');
      if (field && field.classList.contains('field--error')) validate(field);
    });
  }

  /* ------------------------------------------------------------------------
     9 · CUSTOM CURSOR (nur Zeigegeräte) & SCROLL-PROGRESS
     ------------------------------------------------------------------------ */
  function initCursor() {
    const dot = $('#cursor-dot');
    const ring = $('#cursor-ring');
    if (!dot || !ring || !mqPointerFine.matches) return;

    document.documentElement.classList.add('cursor-visible');

    let mx = window.innerWidth / 2, my = window.innerHeight / 2;
    let rx = mx, ry = my;

    window.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });

    const interactive = 'a, button, input, textarea, select, .work-card, .demo-tab, .swatch';
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest(interactive)) ring.classList.add('is-hover');
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest(interactive)) ring.classList.remove('is-hover');
    });

    const loop = () => {
      rx += (mx - rx) * 0.15;
      ry += (my - ry) * 0.15;
      dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
      ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
      window.requestAnimationFrame(loop);
    };
    window.requestAnimationFrame(loop);
  }

  function initScrollProgress() {
    const bar = $('#scroll-progress-bar');
    if (!bar) return;

    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (max > 0 ? Math.min(window.scrollY / max, 1) * 100 : 0).toFixed(2) + '%';
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  /* ------------------------------------------------------------------------
     10 · KLEINKRAM & BOOTSTRAP
     ------------------------------------------------------------------------ */
  function initMisc() {
    $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

    $$('[data-to-top]').forEach((btn) => {
      btn.addEventListener('click', (e) => { e.preventDefault(); scrollToTarget('#home'); });
    });

    /* Deep-Link (z. B. /#textil) nach dem Laden exakt anspringen */
    const hash = window.location.hash;
    if (hash && $(hash)) window.setTimeout(() => scrollToTarget(hash), 320);

    /* Positionen nach dem vollständigen Laden neu berechnen: Webfonts, Bilder
       und das erst spät injizierte Tailwind-Play-CDN-CSS verändern das Layout.
       Danach noch einmal prüfen, ob eine Einblendung ausgeblieben ist. */
    if (hasGsap) {
      const refresh = () => { ScrollTrigger.refresh(); failsafeReveal(); };
      window.addEventListener('load', refresh);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh).catch(() => {});
      window.setTimeout(refresh, 900);
      window.setTimeout(refresh, 2500);

      /* Zusätzliches Netz beim Scrollen (gedrosselt, endet nach 20 Läufen) */
      let failsafeRuns = 0;
      let lastRun = 0;
      window.addEventListener('scroll', () => {
        if (failsafeRuns >= 20) return;
        const now = Date.now();
        if (now - lastRun < 400) return;
        lastRun = now;
        failsafeRuns += 1;
        failsafeReveal();
      }, { passive: true });
    }
  }

  /* Sicherheitsnetz: Bleibt eine Animation aus (Lib fehlt, Modul wirft,
     reduziertes Motion), dürfen Titel & Inhalte nie unsichtbar hängen
     bleiben — die "js"-Schutzmasken werden dann hart aufgehoben. */
  function releaseHiddenContent() {
    $$('[data-hero], [data-reveal]').forEach((el) => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    $$('.split-char, .split-inner').forEach((el) => { el.style.transform = 'none'; });
  }

  /* Netz für Scroll-Animationen: Hat ScrollTrigger die Startpositionen
     berechnet, bevor das Layout final war, kann eine Einblendung ausbleiben
     -> Titel bleiben dann dauerhaft in der Maske hängen. Hier werden genau
     solche Elemente freigegeben; laufende Tweens (isTweening) bleiben
     unangetastet, bereits sichtige Elemente werden nicht angefasst. */
  function failsafeReveal() {
    if (!hasGsap || prefersReduced) return;

    const inView = (el) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight * 0.9;
    };

    $$('[data-reveal]').forEach((el) => {
      if (gsap.isTweening(el) || !inView(el)) return;
      if (parseFloat(window.getComputedStyle(el).opacity) < .05) {
        gsap.set(el, { opacity: 1, y: 0, scale: 1, clearProps: 'transform' });
      }
    });

    $$('.split-char, .split-inner').forEach((el) => {
      if (gsap.isTweening(el) || !inView(el.parentElement)) return;
      if (window.getComputedStyle(el).transform !== 'none') gsap.set(el, { yPercent: 0, y: 0 });
    });
  }

  /** Startet alle Module. Ein Fehler in einem Modul darf die übrigen nicht
      verhindern — sonst wäre nach einem Problem z. B. das Menü komplett tot. */
  function init() {
    [
      initSmoothScroll,
      initNavigation,
      initHeroIntro,
      initSplitHeadings,
      initReveals,
      initSectionTakeovers,
      initActiveSectionTracking,
      initMarquees,
      initCounters,
      initKlicklotsePreview,
      initShowcaseFilter,
      initAccordions,
      initContactForm,
      initCursor,
      initScrollProgress,
      initMisc
    ].forEach((module) => {
      try {
        module();
      } catch (err) {
        window.console.error('[Webdunk] Modul "' + module.name + '" fehlgeschlagen:', err);
        releaseHiddenContent();
      }
    });

    /* Ohne Animationen (bzw. bei reduziertem Motion) sofort alles zeigen */
    if (!hasGsap || prefersReduced) releaseHiddenContent();
    document.documentElement.classList.add('is-ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();






