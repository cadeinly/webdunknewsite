/* ==========================================================================
   WEBDUNK — Showcase Landingpage
   Datei : assets/js/main.js
   Inhalt: 0) Utils/State   1) Smooth Scroll (Lenis + GSAP Sync)
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

  let hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mqDesktop = window.matchMedia('(min-width: 768px)');
  const mqPointerFine = window.matchMedia('(hover: hover) and (pointer: fine)');

  const state = {
    drawerOpen: false,
    lenis: null,
    lastFocused: null,
    sectionTriggers: new Map()
  };

  if (hasGsap) {
    try {
      window.gsap.registerPlugin(window.ScrollTrigger);
      window.ScrollTrigger.config({ ignoreMobileResize: true });
      window.gsap.defaults({ ease: 'power3.out', duration: 0.95 });
    } catch (err) {
      hasGsap = false;
      window.console.warn('[Webdunk] GSAP/ScrollTrigger nicht initialisierbar — statische Ansicht.', err);
    }
  }

  if (!hasGsap) document.documentElement.classList.remove('js');

  /* ------------------------------------------------------------------------
     1 · SMOOTH SCROLL (Lenis + native Fallback ohne CSS-Konflikt)
     ------------------------------------------------------------------------ */
  function initSmoothScroll() {
    /* WICHTIG: Natives CSS scroll-smooth deaktivieren, sobald JS übernimmt,
       da es sonst gegen Lenis und GSAP ScrollTrigger kämpft! */
    document.documentElement.classList.remove('scroll-smooth');

    if (typeof window.Lenis === 'undefined' || prefersReduced) return;

    state.lenis = new window.Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.5,
      gestureOrientation: 'vertical'
    });

    if (hasGsap) {
      state.lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => {
        state.lenis.raf(time * 1000);
      });
      gsap.ticker.lagSmoothing(0);
    } else {
      const loop = (t) => {
        state.lenis.raf(t);
        window.requestAnimationFrame(loop);
      };
      window.requestAnimationFrame(loop);
    }
  }

  /**
   * Berechnet die exakte Dokument-Y-Position einer Sektion — selbst dann,
   * wenn GSAP das Element in einen .pin-spacer gepackt oder transformiert hat.
   */
  function getExactScrollTop(el) {
    if (!el) return 0;

    // 1. Falls ein ScrollTrigger für diese Sektion registriert ist -> exakter Startwert
    if (hasGsap && state.sectionTriggers.has(el)) {
      const st = state.sectionTriggers.get(el);
      if (st && typeof st.start === 'number') {
        return Math.max(0, Math.round(st.start));
      }
    }

    // 2. Falls das Element in einem GSAP .pin-spacer steckt -> Spacer messen
    const targetBox = el.parentElement && el.parentElement.classList.contains('pin-spacer')
      ? el.parentElement
      : el;

    const mobileHeaderOffset = !mqDesktop.matches ? 56 : 0;
    const rect = targetBox.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;

    return Math.max(0, Math.round(rect.top + scrollTop - mobileHeaderOffset));
  }

  /** Scrollt präzise und butterweich zu einer Sektion. */
  function scrollToTarget(target, { onComplete, immediate = false } = {}) {
    const el = typeof target === 'string' ? $(target) : target;
    if (!el) return;

    if (hasGsap) ScrollTrigger.refresh();
    const top = getExactScrollTop(el);

    if (state.lenis) {
      state.lenis.scrollTo(top, {
        immediate: immediate || prefersReduced,
        duration: 1.2,
        lock: false,
        easing: (t) => 1 - Math.pow(1 - t, 4),
        onComplete: () => {
          if (hasGsap) ScrollTrigger.update();
          if (onComplete) onComplete();
        }
      });
      return;
    }

    if (hasGsap && !prefersReduced && !immediate) {
      const proxy = { y: window.pageYOffset };
      gsap.to(proxy, {
        y: top,
        duration: 1.1,
        ease: 'power3.inOut',
        onUpdate: () => window.scrollTo(0, proxy.y),
        onComplete: () => {
          ScrollTrigger.update();
          if (onComplete) onComplete();
        }
      });
      return;
    }

    window.scrollTo({ top, behavior: prefersReduced || immediate ? 'auto' : 'smooth' });
    if (onComplete) window.setTimeout(onComplete, prefersReduced || immediate ? 0 : 600);
  }

  /** Scroll-Sperre, solange der Drawer offen ist. */
  function lockScroll(lock) {
    if (state.lenis) {
      lock ? state.lenis.stop() : state.lenis.start();
    }
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
      gsap.set(drawer, { xPercent: -100, x: 0 });
      if (backdrop) {
        gsap.set(backdrop, { opacity: 0 });
        gsap.to(backdrop, { opacity: 1, duration: 0.4, ease: 'power2.out' });
      }
      gsap.to(drawer, { xPercent: 0, x: 0, duration: 0.7, ease: 'expo.out' });
      gsap.fromTo(
        drawerLinks,
        { yPercent: 45, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.6, stagger: 0.04, delay: 0.08, ease: 'power3.out' }
      );
    } else {
      drawer.style.transform = 'translate3d(0,0,0)';
    }

    lockScroll(true);
    const firstFocusable = drawer.querySelector('a, button');
    if (firstFocusable) {
      window.setTimeout(() => firstFocusable.focus({ preventScroll: true }), hasGsap ? 300 : 0);
    }
  }

  function closeDrawer(opts) {
    const restoreFocus = !opts || opts.restoreFocus !== false;
    if (!drawer || !state.drawerOpen) return;
    state.drawerOpen = false;
    drawer.setAttribute('aria-hidden', 'true');
    setTriggerState(false);

    const hideBackdrop = () => {
      if (backdrop) backdrop.hidden = true;
    };

    if (hasGsap && !prefersReduced) {
      gsap.killTweensOf([drawer, backdrop]);
      gsap.to(drawer, { xPercent: -100, x: 0, duration: 0.55, ease: 'expo.inOut' });
      if (backdrop) {
        gsap.to(backdrop, {
          opacity: 0,
          duration: 0.35,
          onComplete: hideBackdrop,
          onInterrupt: hideBackdrop
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
    $$('[data-drawer-open]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (state.drawerOpen) closeDrawer();
        else openDrawer();
      });
    });

    $$('[data-drawer-close]').forEach((el) => el.addEventListener('click', () => closeDrawer()));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.drawerOpen) closeDrawer();
      if (e.key === 'Tab' && state.drawerOpen) {
        const focusables = $$('a[href], button:not([disabled])', drawer);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    /* Alle Sprungmarken: Drawer sofort entsperren & punktgenau zur Sektion scrollen */
    $$('[data-target]').forEach((link) => {
      link.addEventListener('click', (e) => {
        const targetSelector = link.getAttribute('data-target');
        if (!targetSelector || targetSelector === '#') return;
        const targetEl = $(targetSelector);
        if (!targetEl) return;

        e.preventDefault();

        const wasOpen = state.drawerOpen;
        if (wasOpen) closeDrawer({ restoreFocus: false });

        if ( targetEl.id ) setActiveSection(targetEl.id);

        /* Kurz warten bis Body-Overflow & Lenis wieder frei sind, dann exakt scrollen */
        const delay = wasOpen ? 80 : 0;
        window.setTimeout(() => {
          scrollToTarget(targetEl);
          if (window.history.replaceState) {
            window.history.replaceState(null, '', targetSelector);
          }
        }, delay);
      });
    });
  }

  /** Aktive Sektion zuverlässig hervorheben (Rail-Indikator). */
  function initActiveSectionTracking() {
    const sections = $$('[data-section]');
    if (!sections.length) return;

    if (!hasGsap) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && entry.target.id) {
              setActiveSection(entry.target.id);
            }
          });
        },
        { rootMargin: '-40% 0px -40% 0px' }
      );
      sections.forEach((s) => io.observe(s));
      return;
    }

    sections.forEach((section) => {
      const st = ScrollTrigger.create({
        trigger: section,
        start: () => 'top ' + (!mqDesktop.matches ? '65px' : '45%'),
        end: 'bottom 45%',
        onToggle: (self) => {
          if (self.isActive && section.id) setActiveSection(section.id);
        }
      });
      /* Speichert den Trigger am Startpunkt der Sektion für die Navigation */
      const navTrigger = ScrollTrigger.create({
        trigger: section,
        start: () => 'top ' + (!mqDesktop.matches ? '56px' : 'top')
      });
      state.sectionTriggers.set(section, navTrigger);
    });
  }

  /* ------------------------------------------------------------------------
     3 · SCROLL-ANIMATIONEN (Split-Text, Hero, Reveals, Nahtloser Parallax)
     ------------------------------------------------------------------------ */
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

    const words = text.split(' ');
    words.forEach((word, i) => {
      const mask = document.createElement('span');
      mask.className = 'split-word';
      const inner = document.createElement('span');
      inner.className = 'split-inner';
      inner.textContent = word;
      mask.appendChild(inner);
      el.appendChild(mask);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
    return $$('.split-inner', el);
  }

  /** Intro des Heros */
  function initHeroIntro() {
    const heroTitle = $('#home [data-split]');
    const heroBits = $$('#home [data-hero]');
    const showStatic = () => heroBits.forEach((el) => { el.style.opacity = '1'; });

    if (!hasGsap || prefersReduced || !heroTitle) {
      showStatic();
      return;
    }

    const chars = splitText(heroTitle);
    const tl = gsap.timeline({ delay: 0.15, defaults: { ease: 'expo.out' } });

    tl.fromTo(
      chars,
      { yPercent: 110, y: 0 },
      { yPercent: 0, y: 0, duration: 1.2, stagger: 0.045 },
      0
    )
      .fromTo(
        heroBits,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.9, stagger: 0.08 },
        0.35
      )
      .from('#home .scroll-cue', { opacity: 0, duration: 0.9 }, 0.8);

    gsap.to('#home .scroll-cue', {
      opacity: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: '#home',
        start: 'top top',
        end: '+=350',
        scrub: true
      }
    });
  }

  /**
   * Alle Überschriften mit [data-split] maskiert einfliegen lassen.
   * KEIN "reset" beim Zurückscrollen — verhindert weisse Löcher beim Hochscrollen!
   */
  function initSplitHeadings() {
    $$('[data-split]').forEach((el) => {
      if (el.closest('#home')) return;
      const parts = splitText(el);
      if (!hasGsap || prefersReduced) {
        parts.forEach((p) => { p.style.transform = 'none'; });
        return;
      }

      gsap.fromTo(
        parts,
        { yPercent: 105, y: 0 },
        {
          yPercent: 0,
          y: 0,
          duration: 1.0,
          stagger: 0.04,
          ease: 'expo.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 88%',
            toggleActions: 'play none none none'
          }
        }
      );
    });
  }

  /**
   * Generische Reveals: [data-reveal="up|scale|fade"]
   * Bleiben nach dem ersten Einblenden sichtbar, damit beim Hochscrollen
   * niemals leere weisse Sektoren entstehen.
   */
  function initReveals() {
    const items = $$('[data-reveal]');
    if (!hasGsap || prefersReduced) {
      items.forEach((el) => {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
      return;
    }

    items.forEach((el) => {
      gsap.to(el, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.9,
        ease: 'power3.out',
        delay: parseFloat(el.getAttribute('data-reveal-delay') || '0'),
        scrollTrigger: {
          trigger: el,
          start: 'top 90%',
          toggleActions: 'play none none none'
        }
      });
    });
  }

  /* ------------------------------------------------------------------------
     3b · SEAMLESS SECTION PARALLAX & FLOW
     Ersetzt das künstliche Pin-Spacing + weisse Veil-Wand durch einen
     nahtlosen, butterweichen Tiefen-Parallax-Fluss ohne tote Scroll-Strecken.
     ------------------------------------------------------------------------ */
  function initSectionFlow(section) {
    const title = section.querySelector('[data-pin="title"]');
    const lead = section.querySelector('[data-pin="lead"]');
    const media = section.querySelector('[data-pin="media"]');
    const ghost = section.querySelector('[data-pin="ghost"]');
    const cards = $$('[data-pin="card"]', section);

    /* Sanfter Eingangs-Flow für Haupt-Elemente der Sektion */
    const introTargets = [lead, media, ...cards].filter(Boolean);
    if (introTargets.length && section.getAttribute('data-pin-intro') !== 'skip') {
      gsap.fromTo(
        introTargets,
        { y: 36, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.95,
          stagger: 0.08,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: section,
            start: 'top 80%',
            toggleActions: 'play none none none'
          }
        }
      );
    }

    /* Nahtloser Scrub-Parallax über die natürliche Sektionshöhe (ohne leere Pin-Spacer!) */
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 0.6,
        invalidateOnRefresh: true
      }
    });

    if (ghost) {
      tl.fromTo(ghost, { yPercent: 18 }, { yPercent: -22, ease: 'none' }, 0);
    }
    if (media) {
      tl.fromTo(media, { y: 28 }, { y: -28, ease: 'none' }, 0);
    }
    if (title && !section.closest('#home')) {
      tl.fromTo(title, { y: 12 }, { y: -14, ease: 'none' }, 0);
    }
  }

  function initSectionTakeovers() {
    if (!hasGsap || prefersReduced) return;
    const sections = $$('[data-pin-section]');
    if (!sections.length) return;

    sections.forEach(initSectionFlow);
  }

  /* ------------------------------------------------------------------------
     4 · INFINITE MARQUEE
     ------------------------------------------------------------------------ */
  function initMarquees() {
    $$('[data-marquee]').forEach((marquee) => {
      const track = marquee.querySelector('.marquee__track');
      if (!track) return;

      if (!hasGsap || prefersReduced) {
        marquee.classList.add('marquee--css');
        return;
      }

      const reverse = marquee.getAttribute('data-marquee') === 'reverse';
      const dir = reverse ? -1 : 1;
      const tween = gsap.fromTo(
        track,
        { xPercent: dir === 1 ? 0 : -50 },
        { xPercent: dir === 1 ? -50 : 0, duration: 30, ease: 'none', repeat: -1 }
      );
      tween.timeScale(dir);

      let resetId = 0;
      ScrollTrigger.create({
        trigger: marquee,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (self) => {
          const boost = Math.min(Math.abs(self.getVelocity()) / 1500, 2.0);
          gsap.to(tween, { timeScale: dir * (1 + boost), duration: 0.25, overwrite: true });
          window.clearTimeout(resetId);
          resetId = window.setTimeout(() => {
            gsap.to(tween, { timeScale: dir, duration: 0.8, overwrite: true });
          }, 160);
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
        const num =
          decimals > 0
            ? v.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
            : nf.format(Math.round(v));
        el.textContent = num + suffix;
      };

      if (!hasGsap || prefersReduced) {
        render(to);
        return;
      }

      const obj = { v: from };
      render(from);
      gsap.to(obj, {
        v: to,
        duration: 1.6,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 92%', once: true },
        onUpdate: () => render(obj.v)
      });
    });
  }

  /* ------------------------------------------------------------------------
     6 · KLICKLOTSE-DEMO-PREVIEW
     ------------------------------------------------------------------------ */
  const DEMOS = {
    schulen: {
      accent: '#1F6F5C',
      url: 'schulen.klick-lotse.de',
      brand: 'Schulen · Klassen & Träger',
      links: ['Startseite', 'Klassen', 'Termine', 'Kontakt'],
      headline: 'Willkommen an Ihrer Schule',
      sub: 'Termine, Elternbriefe und Klassenfotos — pflegbar ohne IT-Kenntnisse.',
      cta: 'Elternbriefe ansehen',
      cards: ['Aktuelles', 'Termine', 'Klassen']
    },
    aerzte: {
      accent: '#0F4C81',
      url: 'aerzte.klick-lotse.de',
      brand: 'Ärzte & Heilpraktiker · Praxis',
      links: ['Startseite', 'Leistungen', 'Termine', 'Kontakt'],
      headline: 'Ihre Praxis digital erreichbar',
      sub: 'Leistungen, Sprechzeiten und Online-Terminanfrage — klar strukturiert für Patientinnen und Patienten.',
      cta: 'Termin anfragen',
      cards: ['Sprechzeiten', 'Leistungen', 'Kontakt']
    },
    gastro: {
      accent: '#9A3412',
      url: 'gastro.klick-lotse.de',
      brand: 'Gastronomie · Menü & Reservierung',
      links: ['Startseite', 'Menü', 'Reservierung', 'Kontakt'],
      headline: 'Menü, Öffnungszeiten & Reservierung',
      sub: 'Speisekarte, Tischreservierung und Gutscheine — einladend für Ihre Gäste.',
      cta: 'Tisch reservieren',
      cards: ['Menü', 'Reservierung', 'Anfahrt']
    },
    vereine: {
      accent: '#1E3A8A',
      url: 'vereine.klick-lotse.de',
      brand: 'Vereine & Verbände',
      links: ['Startseite', 'Mitglieder', 'News', 'Kontakt'],
      headline: 'Mitglieder, News & Termine gebündelt',
      sub: 'Aktuelles, Trainingszeiten und Mitgliederbereich — ein Zuhause für Ihren Verein.',
      cta: 'News ansehen',
      cards: ['Termine', 'Mitglieder', 'News']
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
    const escape = (str) =>
      String(str).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

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
        els.cards.innerHTML = demo.cards
          .map((c) => '<div class="frame__card"><b>' + escape(c) + '</b><div><i></i><i></i></div></div>')
          .join('');
      }
      if (els.link) els.link.href = 'https://' + demo.url;

      tabs.forEach((tab) => tab.classList.toggle('is-active', tab.getAttribute('data-demo') === key));

      if (hasGsap && !prefersReduced) {
        const animated = [els.headline, els.sub, els.links, els.cards].filter(Boolean);
        gsap.fromTo(
          animated,
          { y: 12, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, stagger: 0.05, ease: 'power3.out', overwrite: true }
        );
      }
    };

    tabs.forEach((tab) => tab.addEventListener('click', () => apply(tab.getAttribute('data-demo'))));
    apply('schulen');
  }

  /* ------------------------------------------------------------------------
     6b · SHOWCASE-FILTER (Ideas4Net)
     Aktualisiert nach dem Filtern auch ScrollTrigger, damit nachfolgende
     Menü-Sprünge (#about, #contact) exakt auf der richtigen Höhe landen!
     ------------------------------------------------------------------------ */
  function initShowcaseFilter() {
    const grid = $('#showcase-grid');
    if (!grid) return;

    const cards = $$('.work-card', grid);
    const chips = $$('[data-filter]');
    if (!cards.length || !chips.length) return;

    const refreshLayout = () => {
      if (hasGsap) ScrollTrigger.refresh();
      if (state.lenis) state.lenis.resize();
    };

    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const filter = chip.getAttribute('data-filter');
        chips.forEach((c) => c.classList.toggle('is-active', c === chip));

        const visibleCards = [];
        cards.forEach((card) => {
          const isMatch = filter === 'all' || card.getAttribute('data-cat') === filter;
          card.classList.toggle('is-hidden', !isMatch);
          if (isMatch) visibleCards.push(card);
        });

        if (hasGsap && !prefersReduced && visibleCards.length) {
          gsap.fromTo(
            visibleCards,
            { opacity: 0, y: 16 },
            { opacity: 1, y: 0, duration: 0.45, stagger: 0.03, ease: 'power3.out', overwrite: true }
          );
        }

        window.requestAnimationFrame(refreshLayout);
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
            duration: 0.5,
            ease: 'power3.inOut',
            overwrite: true,
            onComplete: () => {
              ScrollTrigger.refresh();
              if (state.lenis) state.lenis.resize();
            }
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
     8 · KONTAKTFORMULAR
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
      $$('[data-field]', form).forEach((field) => {
        if (!validate(field)) valid = false;
      });

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
     9 · CUSTOM CURSOR & SCROLL-PROGRESS
     ------------------------------------------------------------------------ */
  function initCursor() {
    const dot = $('#cursor-dot');
    const ring = $('#cursor-ring');
    if (!dot || !ring || !mqPointerFine.matches) return;

    document.documentElement.classList.add('cursor-visible');

    let mx = window.innerWidth / 2,
      my = window.innerHeight / 2;
    let rx = mx,
      ry = my;

    window.addEventListener(
      'mousemove',
      (e) => {
        mx = e.clientX;
        my = e.clientY;
      },
      { passive: true }
    );

    const interactive = 'a, button, input, textarea, select, .work-card, .demo-tab, .swatch';
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest(interactive)) ring.classList.add('is-hover');
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest(interactive)) ring.classList.remove('is-hover');
    });

    const loop = () => {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
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
    $$('[data-year]').forEach((el) => {
      el.textContent = String(new Date().getFullYear());
    });

    $$('[data-to-top]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        scrollToTarget('#home');
      });
    });

    const hash = window.location.hash;
    if (hash && $(hash)) {
      window.setTimeout(() => scrollToTarget(hash), 250);
    }

    if (hasGsap) {
      const refresh = () => {
        ScrollTrigger.refresh();
        if (state.lenis) state.lenis.resize();
        failsafeReveal();
      };
      window.addEventListener('load', refresh);
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(refresh).catch(() => {});
      }
      window.setTimeout(refresh, 600);
      window.setTimeout(refresh, 1800);
    }
  }

  function releaseHiddenContent() {
    $$('[data-hero], [data-reveal]').forEach((el) => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    $$('.split-char, .split-inner').forEach((el) => {
      el.style.transform = 'none';
    });
  }

  function failsafeReveal() {
    if (!hasGsap || prefersReduced) return;

    const inView = (el) => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight * 0.92;
    };

    $$('[data-reveal]').forEach((el) => {
      if (gsap.isTweening(el) || !inView(el)) return;
      if (parseFloat(window.getComputedStyle(el).opacity) < 0.05) {
        gsap.set(el, { opacity: 1, y: 0, scale: 1, clearProps: 'transform' });
      }
    });

    $$('.split-char, .split-inner').forEach((el) => {
      if (gsap.isTweening(el) || !inView(el.parentElement)) return;
      if (window.getComputedStyle(el).transform !== 'none') gsap.set(el, { yPercent: 0, y: 0 });
    });
  }

  function init() {
    [
      initSmoothScroll,
      initHeroIntro,
      initSplitHeadings,
      initReveals,
      initSectionTakeovers,
      initActiveSectionTracking,
      initNavigation,
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

    if (!hasGsap || prefersReduced) releaseHiddenContent();
    document.documentElement.classList.add('is-ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();