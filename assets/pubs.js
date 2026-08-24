/* Google Scholar publication loader with static HTML fallback.
   The markup emitted here must stay in step with the static fallback in
   index.html — that fallback is what visitors see if this fetch fails. */
(function () {
  'use strict';

  function safeUrl(url) {
    return typeof url === 'string' && /^(https?:|mailto:)/i.test(url);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function pickTarget(pub) {
    var links = (pub.links || []).filter(function (link) { return safeUrl(link.url); });
    var isScholar = function (link) {
      return /scholar\.google\./i.test(link.url) || /scholar/i.test(link.label || '');
    };
    var canonical = links.filter(function (link) { return !isScholar(link); })[0];
    return (canonical || links.filter(isScholar)[0] || {}).url || null;
  }

  function paperId(pub, prefix, index) {
    var id = pub.paper_id;
    return typeof id === 'string' && /^[A-Za-z0-9_-]+$/.test(id) ? id : prefix + (index + 1);
  }

  function renderRail(pub) {
    var rail = el('div', 'pub-rail');
    var venue = el('div', 'pub-venue' + (pub.venue_type === 'journal' ? ' is-journal' : ''),
                   pub.venue_short || '');
    rail.appendChild(venue);

    var types = (pub.work_types || []).filter(function (t) { return typeof t === 'string' && t; });
    if (types.length) {
      var list = el('ul', 'pub-types');
      types.forEach(function (t) { list.appendChild(el('li', null, t)); });
      rail.appendChild(list);
    }
    return rail;
  }

  function renderAuthors(pub) {
    var authorsEl = el('div', 'pub-authors');

    (pub.authors || []).forEach(function (author, index) {
      if (index > 0) authorsEl.appendChild(document.createTextNode(', '));
      var name = (author.name || '') + (author.corresponding ? '*' : '');
      if (author.me) {
        authorsEl.appendChild(el('strong', null, name));
      } else {
        authorsEl.appendChild(document.createTextNode(name));
      }
    });

    if (pub.et_al) {
      authorsEl.appendChild(document.createTextNode(', '));
      authorsEl.appendChild(el('em', null, 'et al.'));
    }
    return authorsEl;
  }

  function renderMain(pub) {
    var main = el('div', 'pub-main');

    var title = el('h3', 'pub-title');
    var target = pickTarget(pub);
    if (target) {
      var link = el('a', null, pub.title || '');
      link.href = target;
      link.target = '_blank';
      link.rel = 'noopener';
      title.appendChild(link);
    } else {
      title.textContent = pub.title || '';
    }
    main.appendChild(title);
    main.appendChild(renderAuthors(pub));

    var links = el('div', 'pub-links');
    (pub.links || []).forEach(function (item) {
      if (!safeUrl(item.url)) return;
      var a = el('a', null, (item.label || 'Link') + ' ↗');
      a.href = item.url;
      a.target = '_blank';
      a.rel = 'noopener';
      links.appendChild(a);
    });
    if (links.childNodes.length) main.appendChild(links);

    return main;
  }

  function renderAside(pub) {
    var aside = el('div', 'pub-aside');

    if (pub.cited_by && pub.cited_by > 0) {
      aside.appendChild(el('div', 'pub-cites', String(pub.cited_by)));
      aside.appendChild(el('div', 'pub-cites-label',
                           pub.cited_by === 1 ? 'citation' : 'citations'));
    } else if (pub.status) {
      aside.appendChild(el('div', 'pub-status', String(pub.status)));
    }

    if (pub.year) aside.appendChild(el('div', 'pub-year', String(pub.year)));
    return aside;
  }

  function renderPublication(pub, index) {
    var item = document.createElement('li');
    var article = el('article', 'pub-item');
    article.setAttribute('data-paper', paperId(pub, 'p', index));

    article.appendChild(renderRail(pub));
    article.appendChild(renderMain(pub));
    article.appendChild(renderAside(pub));

    item.appendChild(article);
    return item;
  }

  function renderPreprint(preprint, index) {
    var item = document.createElement('li');
    var target = safeUrl(preprint.url) ? preprint.url : null;
    var row = el(target ? 'a' : 'div', 'preprint-row');
    row.setAttribute('data-paper', paperId(preprint, 'pre', index));

    if (target) {
      row.href = target;
      row.target = '_blank';
      row.rel = 'noopener';
    }

    row.appendChild(el('span', 'preprint-year', preprint.year || '—'));
    row.appendChild(el('span', 'preprint-title', preprint.title || ''));
    row.appendChild(el('span', 'preprint-meta',
                       (preprint.venue_short || 'Preprint') + (target ? ' ↗' : '')));

    item.appendChild(row);
    return item;
  }

  function renderInto(list, entries, source, renderer) {
    var fragment = document.createDocumentFragment();
    entries.forEach(function (entry, index) {
      fragment.appendChild(renderer(entry, index));
    });
    list.innerHTML = '';
    list.appendChild(fragment);
    list.setAttribute('data-source', source || 'unknown');
  }

  function renderUpdateDate(value) {
    var target = document.getElementById('publication-update');
    if (!target || !value) return;
    var date = new Date(value);
    if (isNaN(date.getTime())) return;
    var formatted = new Intl.DateTimeFormat('en-US', {
      month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC'
    }).format(date);
    target.textContent = 'Publication data updated ' + formatted + '.';
  }

  function init() {
    var publicationsList = document.getElementById('pub-list');
    var preprintsList = document.getElementById('preprint-list');
    if (!publicationsList && !preprintsList) return;

    fetch('data/publications.json', { cache: 'no-cache' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        var publications = (data && data.publications) || [];
        var preprints = (data && data.preprints) || [];
        var source = (data && data.meta && data.meta.source) || 'live';
        renderUpdateDate(data && data.meta && data.meta.generated_at);

        if (publicationsList && publications.length) {
          renderInto(publicationsList, publications, source, renderPublication);
        }
        if (preprintsList) {
          if (preprints.length) {
            renderInto(preprintsList, preprints, source, renderPreprint);
          } else {
            var section = document.getElementById('preprints');
            if (section) section.hidden = true;
          }
        }
      })
      .catch(function (error) {
        console.error('[publications] load failed; keeping static fallback:', error);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
