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

  /* ---- 3D tilt + diagonal gloss reacting to the cursor on the cards ---- */
  if (!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    Array.prototype.forEach.call(document.querySelectorAll('.card'), function (card) {
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;
        card.style.setProperty('--ry', ((px - 0.5) * 10).toFixed(2) + 'deg');
        card.style.setProperty('--rx', ((0.5 - py) * 10).toFixed(2) + 'deg');
        card.style.setProperty('--gloss', (px * 100).toFixed(1) + '%');
      });
      card.addEventListener('mouseleave', function () {
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    });
  }

  /* ---- Active nav highlight: the last section whose top has passed the
          header line. Reliable at the very top and bottom of the page. ---- */
  (function () {
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav a[href^="#"]'));
    var byId = {}, sections = [];
    links.forEach(function (a) {
      var sec = document.getElementById(a.getAttribute('href').slice(1));
      if (sec) { byId[sec.id] = a; sections.push(sec); }
    });
    if (!sections.length) return;
    var ticking = false;
    function update() {
      ticking = false;
      var current = sections[0];
      sections.forEach(function (sec) {
        if (sec.getBoundingClientRect().top <= 90) current = sec;
      });
      // Near the bottom the last short section can't reach the top line,
      // so pin the final section once the page is scrolled to the end.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        current = sections[sections.length - 1];
      }
      links.forEach(function (a) { a.classList.remove('active'); });
      if (byId[current.id]) byId[current.id].classList.add('active');
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  })();
})();
