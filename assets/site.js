/* =========================================================
   Site interactions: theme toggle, scroll-reveal, active nav.
   All progressive: nothing here is required to read the page.
   ========================================================= */
(function () {
  'use strict';
  var root = document.documentElement;

  /* ---- Dark / light toggle (remembers choice, else follows system) ---- */
  function currentTheme() {
    var explicit = root.getAttribute('data-theme');
    if (explicit) return explicit;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark' : 'light';
  }
  var toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  }

  /* ---- Scroll-reveal (skipped entirely if IntersectionObserver missing,
          so content never gets stuck hidden) ---- */
  if ('IntersectionObserver' in window) {
    var reveals = document.querySelectorAll(
      '.card, .pub-item, .section-intro, .ack-text, .contact-list'
    );
    if (reveals.length) {
      Array.prototype.forEach.call(reveals, function (el) { el.classList.add('reveal'); });
      var revealIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add('is-visible');
            revealIO.unobserve(en.target);
          }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      Array.prototype.forEach.call(reveals, function (el) { revealIO.observe(el); });
    }
  }

  /* ---- Active nav highlight while scrolling ---- */
  if ('IntersectionObserver' in window) {
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav a[href^="#"]'));
    var byId = {};
    links.forEach(function (a) {
      var sec = document.getElementById(a.getAttribute('href').slice(1));
      if (sec) byId[sec.id] = a;
    });
    var ids = Object.keys(byId);
    if (ids.length) {
      var navIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            links.forEach(function (a) { a.classList.remove('active'); });
            if (byId[en.target.id]) byId[en.target.id].classList.add('active');
          }
        });
      }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
      ids.forEach(function (id) { navIO.observe(document.getElementById(id)); });
    }
  }
})();
