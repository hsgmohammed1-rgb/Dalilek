(function () {
  'use strict';

  if (!/^\/(ar|en|fr|es)?\/?admin(\/|$)/.test(location.pathname)) return;

  var BULK_URL = '/admin/bulk';
  var NEW_LABEL = 'عمل مقالات';
  var ANCHOR_TEXT = 'إنشاء مقال ذكي';
  var INJECTED_FLAG = 'data-bulk-articles-injected';

  function findAnchorButtons() {
    var results = [];
    var elements = document.querySelectorAll('a, button, [role="button"]');
    for (var i = 0; i < elements.length; i++) {
      var b = elements[i];
      if ((b.textContent || '').indexOf(ANCHOR_TEXT) !== -1) {
        // Avoid adding to our own injected button if its text somehow matched
        if (!b.getAttribute(INJECTED_FLAG)) {
          results.push(b);
        }
      }
    }
    return results;
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
      var langMatch = location.pathname.match(/^\/(ar|en|fr|es)(\/|$)/);
      var prefix = langMatch ? '/' + langMatch[1] : '';
      window.location.assign(prefix + BULK_URL);
    });

    return btn;
  }

  function inject() {
    var anchors = findAnchorButtons();
    var injectedAny = false;
    for (var i = 0; i < anchors.length; i++) {
      var anchor = anchors[i];
      // Check if we already injected next to this specific anchor
      if (anchor.nextSibling && anchor.nextSibling.nodeType === 1 && anchor.nextSibling.getAttribute(INJECTED_FLAG)) {
        continue;
      }
      if (anchor.parentNode) {
        var newBtn = makeButton();
        anchor.parentNode.insertBefore(newBtn, anchor.nextSibling);
        injectedAny = true;
      }
    }
    return injectedAny;
  }

  function start() {
    inject();
    var observer = new MutationObserver(function () {
      inject();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  // ── Article-delete interceptor ───────────────────────────────────────────
  // The admin SPA calls Supabase REST directly with the user's session JWT,
  // which fails on DELETE because RLS policies block anon-key writes. We
  // intercept those fetches and reroute them to our server endpoint, which
  // verifies the user and then deletes via the Supabase service role key.
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

  // Match: /rest/v1/articles?id=eq.123 OR /rest/v1/articles?and=...id.eq.123...
  function extractArticleId(url){
    try {
      var m = url.match(/\/rest\/v1\/articles\?(.+)$/);
      if (!m) return null;
      var qs = m[1];
      // Standard: id=eq.123
      var idMatch = qs.match(/(?:^|&)id=eq\.([^&]+)/);
      if (idMatch) return decodeURIComponent(idMatch[1]);
      // Postgrest "and=(id.eq.123,...)" form
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
              // Mimic Supabase 204 No Content so the SPA's success branch fires.
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
    } catch(e){ /* fall through to original fetch */ }
    return origFetch(input, init);
  };
})();
