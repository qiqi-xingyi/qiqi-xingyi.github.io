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

  function tagClass(type) {
    return TAG_CLASS[type] || 'tag-wip';
  }

  function badgeClass(style) {
    return style === 'blue' ? 'badge-blue' : 'badge-gray';
  }

  // Only allow links we trust to be navigable; everything else is dropped.
  function safeUrl(url) {
    return typeof url === 'string' && /^(https?:|mailto:)/i.test(url);
  }

  function renderTitle(pub) {
    var span = document.createElement('span');
    span.className = 'pub-title';
    if (pub.venue_tag) {
      var tag = document.createElement('span');
      tag.className = 'venue-tag ' + tagClass(pub.venue_type);
      tag.textContent = pub.venue_tag;
      span.appendChild(tag);
      span.appendChild(document.createTextNode(' '));
    }
    span.appendChild(document.createTextNode(pub.title || ''));
    return span;
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
      em.textContent = 'et al.';
      div.appendChild(em);
    }
    return div;
  }

  function renderVenue(pub) {
    var div = document.createElement('div');
    div.className = 'pub-venue';
    // venue_html is a trusted snippet (authored by you in overrides.json or
    // assembled by the fetch script, allowing <strong>/<em>), never raw
    // visitor input — so innerHTML is safe here.
    div.innerHTML = pub.venue_html || '';
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
    // Citation count auto-synced from Scholar; hidden while 0 so the seed
    // data looks identical to the original hand-written page.
    if (pub.cited_by && pub.cited_by > 0) {
      var cite = document.createElement('span');
      cite.className = 'badge badge-gray pub-cited';
      cite.textContent = 'Cited by ' + pub.cited_by;
      div.appendChild(cite);
    }
    return div;
  }

  function renderItem(pub) {
    var li = document.createElement('li');
    li.className = 'pub-item';
    li.appendChild(renderTitle(pub));
    li.appendChild(renderAuthors(pub));
    li.appendChild(renderVenue(pub));
    li.appendChild(renderLinks(pub));
    return li;
  }

  function render(listEl, publications, source) {
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
