/* Minimal interactions: theme preference and current-section navigation. */
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
