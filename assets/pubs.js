/* Google Scholar publication loader with static HTML fallback. */
(function () {
  'use strict';

  var TAG_CLASS = { journal: 'tag-journal', conf: 'tag-conf', wip: 'tag-wip' };

  function safeUrl(url) {
    return typeof url === 'string' && /^(https?:|mailto:)/i.test(url);
  }

  function safeAssetPath(path) {
    return typeof path === 'string' &&
      /^(?:\.\/)?assets\/[A-Za-z0-9_./-]+$/.test(path) &&
      path.indexOf('..') === -1;
  }

  function tagClass(type) {
    return TAG_CLASS[type] || 'tag-wip';
  }

  function numbered(index) {
    return index + 1 < 10 ? '0' + (index + 1) : String(index + 1);
  }

  function pickTarget(pub) {
    var links = (pub.links || []).filter(function (link) { return safeUrl(link.url); });
    var scholar = links.filter(function (link) {
      return /scholar\.google\./i.test(link.url) || /scholar/i.test(link.label || '');
    })[0];
    return (scholar || links[0] || {}).url || null;
  }

  function renderHead(pub) {
    var head = document.createElement('div');
    head.className = 'pub-head';

    if (pub.venue_tag) {
      var tag = document.createElement('span');
      tag.className = 'venue-tag ' + tagClass(pub.venue_type);
      tag.textContent = pub.venue_tag;
      head.appendChild(tag);
    }

    var details = [];
    if (pub.year) details.push(String(pub.year));
    if (pub.cited_by && pub.cited_by > 0) {
      details.push(pub.cited_by + ' ' + (pub.cited_by === 1 ? 'citation' : 'citations'));
    }
    if (details.length) {
      var meta = document.createElement('span');
      meta.className = 'pub-meta';
      meta.textContent = details.join(' · ');
      head.appendChild(meta);
    }
    return head;
  }

  function renderTitle(pub) {
    var title = document.createElement('h3');
    title.className = 'pub-title';
    var target = pickTarget(pub);

    if (target) {
      var link = document.createElement('a');
      link.href = target;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = pub.title || '';
      title.appendChild(link);
    } else {
      title.textContent = pub.title || '';
    }
    return title;
  }

  function renderAuthors(pub) {
    var authorsEl = document.createElement('div');
    authorsEl.className = 'pub-authors';
    var authors = pub.authors || [];

    authors.forEach(function (author, index) {
      if (index > 0) authorsEl.appendChild(document.createTextNode(', '));
      var name = (author.name || '') + (author.corresponding ? '*' : '');
      if (author.me) {
        var strong = document.createElement('strong');
        strong.textContent = name;
        authorsEl.appendChild(strong);
      } else {
        authorsEl.appendChild(document.createTextNode(name));
      }
    });

    if (pub.et_al) {
      authorsEl.appendChild(document.createTextNode(', '));
      var etAl = document.createElement('em');
      etAl.textContent = 'et al.';
      authorsEl.appendChild(etAl);
    }
    return authorsEl;
  }

  function renderVenueMark(pub) {
    var mark = pub.venue_mark;
    if (!mark || typeof mark !== 'object') return null;

    var label = mark.alt || pub.venue_short || 'Publication venue';
    var container = document.createElement('div');
    container.setAttribute('aria-label', label);

    var lightSource = safeAssetPath(mark.src_light) ? mark.src_light : null;
    var darkSource = safeAssetPath(mark.src_dark) ? mark.src_dark : null;
    var fallbackSource = safeAssetPath(mark.src) ? mark.src : null;

    if (mark.type === 'image' && (lightSource || darkSource || fallbackSource)) {
      container.className = 'venue-mark venue-mark-image';

      function appendImage(source, className) {
        var image = document.createElement('img');
        image.src = source;
        image.alt = '';
        image.className = className;
        image.setAttribute('aria-hidden', 'true');
        container.appendChild(image);
      }

      if (lightSource && darkSource) {
        appendImage(lightSource, 'venue-logo venue-logo-light');
        appendImage(darkSource, 'venue-logo venue-logo-dark');
      } else {
        appendImage(lightSource || darkSource || fallbackSource, 'venue-logo');
      }
      return container;
    }

    if (mark.type === 'wordmark' && Array.isArray(mark.lines)) {
      container.className = 'venue-mark venue-mark-wordmark';
      mark.lines.slice(0, 2).forEach(function (line) {
        var span = document.createElement('span');
        span.textContent = String(line || '');
        container.appendChild(span);
      });
      return container.childNodes.length ? container : null;
    }

    return null;
  }

  function renderLinks(pub) {
    var linksEl = document.createElement('div');
    linksEl.className = 'pub-links';

    (pub.links || []).forEach(function (item) {
      if (!safeUrl(item.url)) return;
      var link = document.createElement('a');
      link.href = item.url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.className = 'badge ' + (item.style === 'blue' ? 'badge-blue' : 'badge-gray');
      link.textContent = (item.label || 'Link') + ' ↗';
      linksEl.appendChild(link);
    });
    return linksEl;
  }

  function renderPublication(pub, index) {
    var item = document.createElement('li');
    var article = document.createElement('article');
    article.className = 'pub-item';

    var marker = document.createElement('div');
    marker.className = 'pub-index';
    marker.setAttribute('aria-hidden', 'true');
    marker.textContent = numbered(index);
    article.appendChild(marker);

    var venueMark = renderVenueMark(pub);
    if (venueMark) {
      article.appendChild(venueMark);
    } else {
      article.classList.add('pub-item-no-mark');
    }

    var body = document.createElement('div');
    body.className = 'pub-body';
    body.appendChild(renderHead(pub));
    body.appendChild(renderTitle(pub));
    body.appendChild(renderAuthors(pub));

    var footer = document.createElement('div');
    footer.className = 'pub-footer';
    var venue = document.createElement('span');
    venue.className = 'pub-venue';
    venue.textContent = pub.venue_short || '';
    footer.appendChild(venue);

    var links = renderLinks(pub);
    if (links.childNodes.length) footer.appendChild(links);
    body.appendChild(footer);

    article.appendChild(body);
    item.appendChild(article);
    return item;
  }

  function renderPublications(list, publications, source) {
    var fragment = document.createDocumentFragment();
    publications.forEach(function (pub, index) {
      fragment.appendChild(renderPublication(pub, index));
    });
    list.innerHTML = '';
    list.appendChild(fragment);
    list.setAttribute('data-source', source || 'unknown');
    Array.prototype.forEach.call(list.querySelectorAll('.pub-item'), function (item) {
      item.classList.add('is-visible');
    });
  }

  function renderPreprint(preprint) {
    var item = document.createElement('li');
    item.className = 'preprint-item';
    var target = safeUrl(preprint.url) ? preprint.url : null;
    var row = document.createElement(target ? 'a' : 'div');
    row.className = 'preprint-row';

    if (target) {
      row.href = target;
      row.target = '_blank';
      row.rel = 'noopener';
    }

    var year = document.createElement('span');
    year.className = 'preprint-year';
    year.textContent = preprint.year || '—';
    row.appendChild(year);

    var title = document.createElement('span');
    title.className = 'preprint-title';
    title.textContent = preprint.title || '';
    row.appendChild(title);

    var meta = document.createElement('span');
    meta.className = 'preprint-meta';
    meta.textContent = preprint.venue_short || 'Preprint';
    row.appendChild(meta);

    if (target) {
      var arrow = document.createElement('span');
      arrow.className = 'preprint-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '↗';
      row.appendChild(arrow);
    }

    item.appendChild(row);
    return item;
  }

  function renderPreprints(list, preprints, source) {
    var fragment = document.createDocumentFragment();
    preprints.forEach(function (preprint) {
      fragment.appendChild(renderPreprint(preprint));
    });
    list.innerHTML = '';
    list.appendChild(fragment);
    list.setAttribute('data-source', source || 'unknown');
    Array.prototype.forEach.call(list.querySelectorAll('.preprint-item'), function (item) {
      item.classList.add('is-visible');
    });
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

        if (publicationsList && publications.length) {
          renderPublications(publicationsList, publications, source);
        }
        if (preprintsList) {
          if (preprints.length) {
            renderPreprints(preprintsList, preprints, source);
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
