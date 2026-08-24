/* Theme preference and section navigation. */
(function () {
  'use strict';

  var root = document.documentElement;
  var toggle = document.getElementById('theme-toggle');

  function currentTheme() {
    var explicit = root.getAttribute('data-theme');
    if (explicit === 'light' || explicit === 'dark') return explicit;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark' : 'light';
  }

  function updateThemeLabel() {
    if (!toggle) return;
    var target = currentTheme() === 'dark' ? 'light' : 'dark';
    var label = 'Switch to ' + target + ' theme';
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('title', label);
  }

  if (toggle) {
    updateThemeLabel();
    toggle.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      updateThemeLabel();
    });
  }

  var links = Array.prototype.slice.call(document.querySelectorAll('.nav a[href^="#"]'));
  var sections = [];
  var linkById = {};

  links.forEach(function (link) {
    var id = link.getAttribute('href').slice(1);
    var section = document.getElementById(id);
    if (section) {
      sections.push(section);
      linkById[id] = link;
    }
  });

  if (!sections.length) return;

  var ticking = false;
  var activationLine = 0;

  function measure() {
    activationLine = (parseFloat(getComputedStyle(root).scrollPaddingTop) || 0) + 8;
  }

  function updateNavigation() {
    ticking = false;
    var current = sections[0];

    sections.forEach(function (section) {
      if (section.getBoundingClientRect().top <= activationLine) current = section;
    });

    if (window.innerHeight + window.scrollY >= root.scrollHeight - 4) {
      current = sections[sections.length - 1];
    }

    links.forEach(function (link) {
      var active = link === linkById[current.id];
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }

  function requestUpdate() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateNavigation);
    }
  }

  function handleResize() {
    measure();
    requestUpdate();
  }

  measure();
  updateNavigation();
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', handleResize, { passive: true });
})();

/* Research module -> publication highlight.
   Papers are re-rendered at runtime by pubs.js, so the [data-paper] set is
   queried at event time rather than cached. Hover drives the preview; click
   pins a selection so the interaction is reachable without a pointer. */
(function () {
  'use strict';

  var modules = Array.prototype.slice.call(document.querySelectorAll('[data-stage]'));
  if (!modules.length) return;

  var pinned = null;

  function dim(ids) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-paper]'), function (el) {
      el.style.opacity = !ids || ids.indexOf(el.dataset.paper) !== -1 ? '1' : '0.28';
    });
  }

  function stageIds(el) {
    return (el.dataset.stage || '').split(/\s+/).filter(Boolean);
  }

  function apply() {
    dim(pinned ? stageIds(pinned) : null);
    modules.forEach(function (el) {
      var on = el === pinned;
      el.classList.toggle('is-pinned', on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  modules.forEach(function (el) {
    el.addEventListener('mouseenter', function () {
      if (!pinned) dim(stageIds(el));
    });
    el.addEventListener('mouseleave', function () {
      if (!pinned) dim(null);
    });
    el.addEventListener('click', function () {
      pinned = pinned === el ? null : el;
      apply();
    });
  });
})();
