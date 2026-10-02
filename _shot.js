/* TEMP: Animationen beschleunigen und den Drawer oeffnen (Screenshot-Test). */
(function () {
  var flush = function () {
    if (!window.gsap) return;
    window.gsap.globalTimeline.totalTime(window.gsap.globalTimeline.totalTime() + 30);
  };
  window.addEventListener('load', function () {
    window.setTimeout(function () {
      if (window.gsap) window.gsap.globalTimeline.timeScale(120);
      window.setTimeout(function () {
        var trigger = document.querySelector('[data-drawer-open]');
        if (trigger) trigger.click();
        flush();
        flush();
      }, 700);
    }, 1200);
  });
})();
