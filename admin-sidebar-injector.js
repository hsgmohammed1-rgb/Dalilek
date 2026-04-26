(function () {
  'use strict';

  if (!/^\/admin(\/|$)/.test(location.pathname)) return;

  var BULK_URL = '/admin/bulk';
  var NEW_LABEL = 'إنشاء مقالات كثيرة';
  var ANCHOR_TEXT = 'إنشاء مقال ذكي';
  var INJECTED_FLAG = 'data-bulk-articles-injected';

  function findAnchorButton() {
    var buttons = document.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      if ((b.textContent || '').indexOf(ANCHOR_TEXT) !== -1) return b;
    }
    return null;
  }

  function makeButton(template) {
    var btn = document.createElement('button');
    btn.className = 'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-muted-foreground hover:bg-muted hover:text-foreground';
    btn.setAttribute(INJECTED_FLAG, '1');
    btn.setAttribute('type', 'button');

    var iconSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" ' +
      'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
      'stroke-linejoin="round" class="w-4 h-4 flex-shrink-0">' +
      '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect>' +
      '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>' +
      '<path d="M8 11h8"></path><path d="M8 15h5"></path>' +
      '</svg>';

    btn.innerHTML =
      iconSvg +
      '<span>' + NEW_LABEL + '</span>' +
      '<span class="mr-auto text-xs px-1.5 py-0.5 rounded-md bg-primary text-primary-foreground font-bold">+</span>';

    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      window.location.assign(BULK_URL);
    });

    return btn;
  }

  function inject() {
    if (document.querySelector('button[' + INJECTED_FLAG + ']')) return true;
    var anchor = findAnchorButton();
    if (!anchor || !anchor.parentNode) return false;
    var newBtn = makeButton(anchor);
    anchor.parentNode.insertBefore(newBtn, anchor.nextSibling);
    return true;
  }

  function start() {
    if (inject()) return;
    var observer = new MutationObserver(function () {
      if (!document.querySelector('button[' + INJECTED_FLAG + ']')) {
        inject();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
