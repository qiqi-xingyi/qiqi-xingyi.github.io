/* Page behaviour: a shadow under the sticky nav once the page scrolls, and a
   News list that shows the latest items with a button to reveal the rest. */
(function () {
  'use strict';

  var nav = document.getElementById('topnav');
  if (nav) {
    var update = function () {
      nav.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  var list = document.getElementById('news-list');
  var button = document.getElementById('news-more');
  var shown = 4;
  if (!list || !button) return;

  var items = Array.prototype.slice.call(list.children);
  if (items.length <= shown) return;

  function collapse(collapsed) {
    items.forEach(function (item, index) {
      item.hidden = collapsed && index >= shown;
    });
    button.textContent = collapsed ? 'More' : 'Less';
    button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  }

  button.hidden = false;
  collapse(true);
  button.addEventListener('click', function () {
    collapse(button.getAttribute('aria-expanded') === 'true');
  });
})();
