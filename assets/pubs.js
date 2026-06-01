/* =========================================================
   Publications loader
   ---------------------------------------------------------
   Fetches data/publications.json (auto-generated from Google
   Scholar by scripts/fetch_scholar.py) and renders the list,
   reusing the existing .pub-item / .venue-tag / .badge styles.

   Progressive enhancement: if the fetch fails (offline, no JS,
   bad JSON) the static <li> items already in index.html stay
   visible as a fallback.
   ========================================================= */
(function () {
  'use strict';

  var TAG_CLASS = { journal: 'tag-journal', conf: 'tag-conf', wip: 'tag-wip' };
  var lastListEl = null;
  var lastPublications = null;
  var lastSource = null;

  var PUB_I18N = {
    en: {
      citations: function (n) { return n + ' ' + (n === 1 ? 'citation' : 'citations'); },
      etAl: 'et al.',
      tags: {
        Journal: 'Journal',
        Conference: 'Conference',
        'Under Review': 'Under Review',
        Preprint: 'Preprint'
      },
      venues: {
        'Under Review': 'Under Review'
      }
    },
    zh: {
      citations: function (n) { return n + ' 次引用'; },
      etAl: '等',
      tags: {
        Journal: '期刊',
        Conference: '会议',
        'Under Review': '审稿中',
        Preprint: '预印本'
      },
      venues: {
        'Under Review': '审稿中'
      }
    }
  };

  function tagClass(type) {
    return TAG_CLASS[type] || 'tag-wip';
  }

  function currentLang() {
    var explicit = document.documentElement.getAttribute('data-lang') || document.documentElement.getAttribute('lang') || 'en';
    return /^zh/i.test(explicit) ? 'zh' : 'en';
  }

  function pubText() {
    return PUB_I18N[currentLang()] || PUB_I18N.en;
  }

  function localizedTag(label) {
    var dict = pubText().tags || {};
    return dict[label] || label || '';
  }

  function localizedVenue(label) {
    var dict = pubText().venues || {};
    return dict[label] || label || '';
  }

  function badgeClass(style) {
    return style === 'blue' ? 'badge-blue' : 'badge-gray';
  }

  // Only allow links we trust to be navigable; everything else is dropped.
  function safeUrl(url) {
    return typeof url === 'string' && /^(https?:|mailto:)/i.test(url);
  }

  function renderHead(pub) {
    var head = document.createElement('div');
    head.className = 'pub-head';

    if (pub.venue_tag) {
      var tag = document.createElement('span');
      tag.className = 'venue-tag ' + tagClass(pub.venue_type);
      tag.textContent = localizedTag(pub.venue_tag);
      head.appendChild(tag);
    }

    var meta = document.createElement('span');
    meta.className = 'pub-meta';
    var bits = [];
    if (pub.year) bits.push(String(pub.year));
    if (pub.cited_by && pub.cited_by > 0) {
      bits.push(pubText().citations(pub.cited_by));
    }
    meta.textContent = bits.join(' · ');
    head.appendChild(meta);
    return head;
  }

  function renderTitle(pub) {
    var h = document.createElement('h3');
    h.className = 'pub-title';
    h.textContent = pub.title || '';
    return h;
  }

  function renderAuthors(pub) {
    var div = document.createElement('div');
    div.className = 'pub-authors';
    var authors = pub.authors || [];
    authors.forEach(function (a, i) {
      if (i > 0) div.appendChild(document.createTextNode(', '));
      var name = (a.name || '') + (a.corresponding ? '*' : '');
      if (a.me) {
        // .pub-authors strong gets the blue underline highlight in CSS.
        var strong = document.createElement('strong');
        strong.textContent = name;
        div.appendChild(strong);
      } else {
        div.appendChild(document.createTextNode(name));
      }
    });
    if (pub.et_al) {
      div.appendChild(document.createTextNode(', '));
      var em = document.createElement('em');
      em.textContent = pubText().etAl;
      div.appendChild(em);
    }
    return div;
  }

  function renderVenue(pub) {
    var div = document.createElement('div');
    div.className = 'pub-venue';
    div.textContent = localizedVenue(pub.venue_short);
    return div;
  }

  function renderLinks(pub) {
    var div = document.createElement('div');
    div.className = 'pub-links';
    (pub.links || []).forEach(function (l) {
      if (!safeUrl(l.url)) return;
      var a = document.createElement('a');
      a.href = l.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.className = 'badge ' + badgeClass(l.style);
      a.textContent = l.label || 'Link';
      div.appendChild(a);
    });
    return div;
  }

  // Prefer the Google Scholar link for the whole-card click target; fall back
  // to the first http(s) link in the publication's links list.
  function pickTarget(pub) {
    var links = (pub.links || []).filter(function (l) { return safeUrl(l.url); });
    var scholar = links.filter(function (l) {
      return /scholar\.google\./i.test(l.url) || /scholar/i.test(l.label || '');
    })[0];
    return (scholar || links[0] || {}).url || null;
  }

  function renderArrow() {
    var span = document.createElement('span');
    span.className = 'pub-arrow';
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>';
    return span;
  }

  function renderItem(pub) {
    var url = pickTarget(pub);
    var el = document.createElement(url ? 'a' : 'li');
    if (url) {
      el.href = url;
      el.target = '_blank';
      el.rel = 'noopener';
    }
    el.className = 'pub-item';
    el.appendChild(renderHead(pub));
    el.appendChild(renderTitle(pub));
    el.appendChild(renderAuthors(pub));
    el.appendChild(renderVenue(pub));
    if (url) el.appendChild(renderArrow());
    // Wrap <a> in <li> so the surrounding <ul> stays valid HTML.
    if (url) {
      var li = document.createElement('li');
      li.appendChild(el);
      return li;
    }
    return el;
  }

  function render(listEl, publications, source) {
    lastListEl = listEl;
    lastPublications = publications;
    lastSource = source;
    var frag = document.createDocumentFragment();
    publications.forEach(function (pub) {
      frag.appendChild(renderItem(pub));
    });
    listEl.innerHTML = '';
    listEl.appendChild(frag);
    // Marker so you can confirm in DevTools that the live JSON (not the
    // static fallback) is what's on screen.
    listEl.setAttribute('data-source', source || 'unknown');
  }

  window.addEventListener('site:langchange', function () {
    if (lastListEl && lastPublications) {
      render(lastListEl, lastPublications, lastSource);
    }
  });

  function init() {
    var listEl = document.getElementById('pub-list');
    if (!listEl) return;
    fetch('data/publications.json', { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var pubs = (data && data.publications) || [];
        var source = (data && data.meta && data.meta.source) || 'live';
        if (pubs.length) render(listEl, pubs, source);
      })
      .catch(function (err) {
        // Leave the static <li> fallback already in the HTML untouched.
        console.error('[publications] load failed, keeping static fallback:', err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
