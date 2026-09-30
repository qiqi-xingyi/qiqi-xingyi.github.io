/* Google Scholar publication loader with static HTML fallback.
   The markup emitted here must stay in step with the static fallback in
   index.html — that fallback is what visitors see if this fetch fails. */
(function () {
  'use strict';

  function safeUrl(url) {
    return typeof url === 'string' && /^(https?:|mailto:)/i.test(url);
  }

  function safeImage(path) {
    return typeof path === 'string' && /^assets\/img\/papers\/[A-Za-z0-9_.-]+$/.test(path);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function text(value) {
    return document.createTextNode(value);
  }

  function link(label, url, className) {
    var a = el('a', className, label);
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
  }

  function pickTarget(links) {
    links = (links || []).filter(function (item) { return safeUrl(item.url); });
    var isScholar = function (item) {
      return /scholar\.google\./i.test(item.url) || /scholar/i.test(item.label || '');
    };
    var canonical = links.filter(function (item) { return !isScholar(item); })[0];
    return (canonical || links.filter(isScholar)[0] || {}).url || null;
  }

  function paperId(pub, prefix, index) {
    var id = pub.paper_id;
    return typeof id === 'string' && /^[A-Za-z0-9_-]+$/.test(id) ? id : prefix + (index + 1);
  }

  function appendAuthors(target, pub) {
    (pub.authors || []).forEach(function (author, index) {
      if (index > 0) target.appendChild(text(', '));
      var name = (author.name || '') + (author.corresponding ? '*' : '');
      target.appendChild(author.me ? el('b', null, name) : text(name));
    });
    if (pub.et_al) target.appendChild(text(', et al.'));
    target.appendChild(el('br'));
  }

  /* "SC '26, to appear" / "Advanced Science, 2025" / "SC '25". A venue that
     already carries its year ('25) doesn't repeat it. */
  function appendVenue(target, pub) {
    var venue = pub.venue_short || '';
    var when = pub.status || (/'\d{2}\b/.test(venue) ? '' : pub.year);
    if (venue) target.appendChild(el('span', 'venue', venue));
    if (venue && when) target.appendChild(text(', '));
    if (when) target.appendChild(text(String(when)));
    target.appendChild(el('br'));
  }

  function appendLinks(target, links, citedBy) {
    var count = 0;
    (links || []).forEach(function (item) {
      if (!safeUrl(item.url)) return;
      if (count++) target.appendChild(text(' / '));
      target.appendChild(link(item.label || 'Link', item.url));
    });
    if (citedBy > 0) target.appendChild(text(' (cited by ' + citedBy + ')'));
  }

  function renderPaper(id, entry, links, withAuthors) {
    var paper = el('div', 'paper');
    paper.id = 'paper-' + id;

    if (safeImage(entry.image)) {
      var figure = el('div', 'paper-figure');
      var img = el('img');
      img.src = entry.image;
      img.alt = '';
      img.loading = 'lazy';
      figure.appendChild(img);
      paper.appendChild(figure);
    }

    var body = el('div', 'paper-text');
    var target = pickTarget(links);
    body.appendChild(target ? link(entry.title || '', target, 'paper-title')
                            : el('b', 'paper-title', entry.title || ''));
    body.appendChild(el('br'));
    if (withAuthors) appendAuthors(body, entry);
    appendVenue(body, entry);
    appendLinks(body, links, entry.cited_by);
    if (entry.summary) body.appendChild(el('p', null, entry.summary));

    paper.appendChild(body);
    return paper;
  }

  function renderPublication(pub, index) {
    return renderPaper(paperId(pub, 'p', index), pub, pub.links, true);
  }

  function renderPreprint(preprint, index) {
    var venue = preprint.venue_short || 'Preprint';
    var links = safeUrl(preprint.url) ? [{ label: venue, url: preprint.url }] : [];
    var entry = Object.assign({}, preprint, { venue_short: venue });
    return renderPaper(paperId(preprint, 'pre', index), entry, links, false);
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
