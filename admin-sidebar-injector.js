(function () {
  'use strict';

  var BULK_URL = '/admin/bulk';
  var NEW_LABEL = 'إضافة مقالات';
  var ANCHOR_TEXT = 'إنشاء مقال ذكي';
  var INJECTED_FLAG = 'data-bulk-articles-injected';

  function isAdminPage() {
    return /(?:^|\/)(?:ar|en|fr|es)?\/?admin(\/|$)/.test(location.pathname);
  }

  // ── Overlay (iframe panel) ───────────────────────────────────────────────────
  var overlay = null;

  function createOverlay() {
    if (overlay) { overlay.style.display = 'flex'; return; }

    overlay = document.createElement('div');
    overlay.id = 'dlk-bulk-overlay';
    overlay.style.cssText = [
      'position:fixed','inset:0','z-index:99999',
      'background:rgba(0,0,0,0.65)','display:flex',
      'align-items:stretch','justify-content:flex-end',
    ].join(';');

    var panel = document.createElement('div');
    panel.style.cssText = [
      'position:relative','width:min(900px,100vw)','height:100%',
      'background:#f8fafc','display:flex','flex-direction:column',
      'box-shadow:-8px 0 40px rgba(0,0,0,0.25)',
    ].join(';');

    // Header bar
    var header = document.createElement('div');
    header.style.cssText = [
      'display:flex','align-items:center','justify-content:space-between',
      'padding:12px 18px','background:#009688','color:#fff',
      'font-family:Tajawal,sans-serif','font-size:15px','font-weight:700',
      'flex-shrink:0',
    ].join(';');
    header.innerHTML = '<span>إضافة مقالات بالذكاء الاصطناعي</span>';

    var closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&#x2715;';
    closeBtn.title = 'إغلاق';
    closeBtn.style.cssText = [
      'background:rgba(255,255,255,0.2)','border:none','color:#fff',
      'width:32px','height:32px','border-radius:50%','cursor:pointer',
      'font-size:16px','display:flex','align-items:center','justify-content:center',
    ].join(';');
    closeBtn.addEventListener('click', function () {
      overlay.style.display = 'none';
    });
    header.appendChild(closeBtn);

    // iframe
    var iframe = document.createElement('iframe');
    iframe.src = BULK_URL;
    iframe.style.cssText = 'flex:1;border:none;width:100%;height:100%;display:block;';
    iframe.setAttribute('allow', 'clipboard-write');

    panel.appendChild(header);
    panel.appendChild(iframe);
    overlay.appendChild(panel);

    // Click outside → close
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.style.display = 'none';
    });

    document.body.appendChild(overlay);
  }

  // ── Sidebar button injection ─────────────────────────────────────────────────
  function findAnchorButtons() {
    var results = [];
    var elements = document.querySelectorAll('a, button, [role="button"]');
    for (var i = 0; i < elements.length; i++) {
      var b = elements[i];
      if ((b.textContent || '').indexOf(ANCHOR_TEXT) !== -1) {
        if (!b.getAttribute(INJECTED_FLAG)) results.push(b);
      }
    }
    return results;
  }

  function makeButton() {
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
      location.href = BULK_URL;
    });

    return btn;
  }

  function removeInjectedButtons() {
    var injected = document.querySelectorAll('[' + INJECTED_FLAG + ']');
    for (var i = 0; i < injected.length; i++) {
      if (injected[i].tagName !== 'BUTTON' || injected[i].textContent.indexOf(NEW_LABEL) !== -1) {
        injected[i].parentNode && injected[i].parentNode.removeChild(injected[i]);
      }
    }
  }

  function inject() {
    if (!isAdminPage()) {
      removeInjectedButtons();
      return false;
    }
    var anchors = findAnchorButtons();
    var injectedAny = false;
    for (var i = 0; i < anchors.length; i++) {
      var anchor = anchors[i];
      if (anchor.nextSibling && anchor.nextSibling.nodeType === 1 && anchor.nextSibling.getAttribute(INJECTED_FLAG)) {
        continue;
      }
      if (anchor.parentNode) {
        var newBtn = makeButton();
        anchor.parentNode.insertBefore(newBtn, anchor.nextSibling);
        injectedAny = true;
      }
    }
    fixArticlesPageLayout();
    return injectedAny;
  }

  // ── "المقالات" (articles list) page: make it a real full page ─────────────
  // The compiled admin's articles-list section was reported to render like a
  // boxed/floating popup (narrow card sitting in a sea of empty space) instead
  // of stretching across the page like the other admin sections. We can't
  // edit the compiled bundle, so we widen the relevant containers via inline
  // styles once we spot the page by its heading text.
  var ARTICLES_HEADING = 'إدارة المقالات';
  function fixArticlesPageLayout() {
    if (!isAdminPage()) return;
    var heading = null;
    var candidates = document.querySelectorAll('h1, h2, h3');
    for (var i = 0; i < candidates.length; i++) {
      if ((candidates[i].textContent || '').trim() === ARTICLES_HEADING) { heading = candidates[i]; break; }
    }
    if (!heading) return;

    // Walk up to the section root (the component's outer wrapper) — stop at
    // the first ancestor that also contains the search input, so we don't
    // accidentally grab something too broad (like <main> itself).
    var root = heading.parentElement;
    for (var hop = 0; hop < 6 && root; hop++) {
      if (root.querySelector('table') || root.querySelector('input')) break;
      root = root.parentElement;
    }
    if (!root) return;

    if (!root.getAttribute('data-dlk-articles-fixed')) {
      root.setAttribute('data-dlk-articles-fixed', '1');
      root.style.width = '100%';
      root.style.maxWidth = 'none';
      root.style.marginLeft = '0';
      root.style.marginRight = '0';
    }

    // Widen the card/table wrapper so it fills the page instead of floating
    // as a narrow boxed element.
    var cardWraps = root.querySelectorAll('.bg-card, .rounded-2xl');
    for (var j = 0; j < cardWraps.length; j++) {
      cardWraps[j].style.width = '100%';
      cardWraps[j].style.maxWidth = 'none';
    }
    var tables = root.querySelectorAll('table');
    for (var k = 0; k < tables.length; k++) {
      tables[k].style.width = '100%';
    }

    // Also make sure the <main> content column itself isn't artificially
    // narrowed (defensive — matches the same fix already applied to
    // bulk-admin.html's layout).
    var mainEl = heading.closest('main');
    if (mainEl && !mainEl.getAttribute('data-dlk-main-fixed')) {
      mainEl.setAttribute('data-dlk-main-fixed', '1');
      mainEl.style.maxWidth = 'none';
    }
  }

  // Hook into browser navigation so the button appears/disappears on SPA route changes.
  function onNavigate() {
    setTimeout(inject, 0); // defer so React has time to update the DOM
  }

  (function patchHistory() {
    var orig = window.history;
    ['pushState', 'replaceState'].forEach(function (method) {
      var original = orig[method];
      orig[method] = function () {
        original.apply(this, arguments);
        onNavigate();
      };
    });
  })();
  window.addEventListener('popstate', onNavigate);

  function start() {
    inject();
    var observer = new MutationObserver(function () { inject(); });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  // ── Article-delete interceptor ───────────────────────────────────────────────
  function isJwt(s){ return typeof s==='string' && s.length > 40 && s.split('.').length === 3 && s.startsWith('eyJ'); }

  function findAccessToken(){
    try {
      var keys = Object.keys(localStorage);
      for (var i = 0; i < keys.length; i++) {
        var raw = localStorage.getItem(keys[i]);
        if (!raw) continue;
        try {
          var p = JSON.parse(raw);
          if (p && p.access_token && isJwt(p.access_token)) return p.access_token;
          if (p && p.currentSession && isJwt(p.currentSession.access_token)) return p.currentSession.access_token;
          if (p && p.session && isJwt(p.session.access_token)) return p.session.access_token;
          if (p && typeof p === 'object') {
            for (var k in p) {
              var v = p[k];
              if (v && typeof v === 'object' && isJwt(v.access_token)) return v.access_token;
            }
          }
        } catch(e){}
      }
    } catch(e){}
    return null;
  }

  function extractArticleId(url){
    try {
      var m = url.match(/\/rest\/v1\/articles\?(.+)$/);
      if (!m) return null;
      var qs = m[1];
      var idMatch = qs.match(/(?:^|&)id=eq\.([^&]+)/);
      if (idMatch) return decodeURIComponent(idMatch[1]);
      var andMatch = qs.match(/id\.eq\.([^,)&]+)/);
      if (andMatch) return decodeURIComponent(andMatch[1]);
      return null;
    } catch(e){ return null; }
  }

  var origFetch = window.fetch.bind(window);
  window.fetch = function(input, init){
    try {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      if (method === 'DELETE' && /\/rest\/v1\/articles\?/.test(url)) {
        var id = extractArticleId(url);
        var token = findAccessToken();
        if (id && token) {
          return origFetch('/api/admin/articles/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken: token, id: id })
          }).then(function(r){
            if (r.ok) {
              return new Response(null, { status: 204, statusText: 'No Content' });
            }
            return r.json().catch(function(){ return { error: 'حذف فشل' }; }).then(function(j){
              return new Response(JSON.stringify({ message: j.error || 'فشل الحذف', code: 'DELETE_FAILED' }), {
                status: r.status, headers: { 'Content-Type': 'application/json' }
              });
            });
          });
        }
      }
    } catch(e){ /* fall through */ }
    return origFetch(input, init);
  };
})();
