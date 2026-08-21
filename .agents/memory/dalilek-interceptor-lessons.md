---
name: Dalilek fetch interceptor lessons
description: Known bugs and fixes for the server-injected fetch interceptor and /api/articles/list endpoint in server.js
---

## Fetch interceptor (injected via SPEED_ANIM string in server.js ~line 1340)

The interceptor rewrites Supabase article-list calls to `/api/articles/list`. Key lessons:

**Lang detection order:** `html[lang]` → URL path segment → localStorage → `'ar'`. React can fire fetches before `html[lang]` is updated on language switch, so the URL path fallback is critical.

**Pagination / Load More — CRITICAL:** supabase-js v2 `.range(from, to)` sets `offset=N` and `limit=N` as **URL query params** (NOT a Range header). Confirmed from bundle grep:
```javascript
range(e,t,...){this.url.searchParams.set('offset',`${e}`);this.url.searchParams.set('limit',`${t-e+1}`);return this}
```
The interceptor MUST read `u.searchParams.get('offset')` from the URL, not from Range headers.
Range headers are only a fallback for older supabase-js callers.

**Load More accumulation (React side):** The `Sz` component accumulates pages with a dedup Set on `id`. If the server returns the same articles twice (offset=0 always), `A.length===0` and nothing appends — looks like button does nothing. The button visibility is `q = S.length === 16` (page size is 16).

**gte prefix:** `created_at` filter arrives as `gte.2025-01-01`; strip with `.replace(/^gte?\./, '')`.

**GET-only guard:** Only intercept `method === 'GET'`.

**ilike exclusion:** Calls with `ilike` (search) bypass the interceptor and go direct to Supabase.

## /api/articles/list endpoint (server.js ~line 895)

**Language filter (non-ar):** Filter by `languages[lang].title` existing AND not containing Arabic script (`/[\u0600-\u06FF]/`). Apply both in the `.filter()` AND again in the `.map()` as a safety double-check; return `null` from map and `.filter(Boolean)` to prevent Arabic titles leaking through.

**Pagination:** Accept `offset` query param. Return `Content-Range: start-end/total` and `X-Total-Count` headers. Use `*/${total}` for empty slices (RFC 7233).

**parseInt hardening:** Always use `|| fallback` after parseInt to handle NaN from malformed input.

**Why:** The publishable Supabase key embedded in the React bundle CAN allow reads; any call that bypasses the interceptor returns Arabic articles unfiltered.

## Category filter was never forwarded (fixed)
The general list interceptor stripped ALL Supabase filters and only forwarded lang/limit/offset/order/after — category (`category=eq.X` or `ilike`) was silently dropped, so paginated/"load more" category browsing returned unrelated articles. Fixed by parsing `category` from the Supabase URL in the interceptor and adding a matching `category` filter to `/api/articles/list` on the server.

## Multi-line meta tags break single-line regex replace (fixed)
`index.html`'s `<meta name="description"|"keywords" ... />` tags are formatted across two lines (attribute on its own line). The server's `injectArticleMeta`/`injectPageMeta` used single-line regexes (`content="[^"]*" \/>` with a literal space before `content`), which silently failed to match multi-line tags — meta description/keywords silently stayed as the generic Arabic homepage defaults on every non-Arabic article page. Fix: use `\s+` between attributes in these regexes. **Any future regex-based HTML meta rewrite must tolerate whitespace/newlines, not assume single-line tags.**

## Article page keyword tags also fetch article directly from Supabase (fixed)
The article detail page's on-page tag chips read `t.seo_keywords_multilingual[lang] || t.seo_keywords` from the raw Supabase row (bypassing the server). Since the `seo_keywords_multilingual` DB column is unpopulated, non-Arabic pages showed Arabic tags. Fixed by intercepting `slug=eq` article-detail fetches client-side and overlaying the server's already-computed translated keywords (via `/api/article-keywords`, which runs `buildMultilingualKeywords`) onto the row before returning it to React.
