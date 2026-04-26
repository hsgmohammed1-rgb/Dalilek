# Dalilek (دليلك) - Arabic Encyclopedia

## Overview
A pre-built React + Vite static web application for "دليلك" (Dalilek), the Comprehensive Arabic Encyclopedia. Provides multilingual articles (Arabic, English, French, Spanish) across categories: Technology, Health, Business, Science, Culture, Arts, Sports, Self-Development.

## Tech Stack
- **Frontend:** React + Vite (pre-built production bundle, base path `/m-njhku`)
- **Styling:** Tailwind CSS v4
- **Fonts:** Tajawal (Google Fonts)
- **Server:** Node.js HTTP server (`server.js`)

## Project Structure
```
/
├── index.html              # Main HTML - full SEO meta tags, hreflang, JSON-LD
├── assets/                 # Compiled JS + CSS bundles (immutable cache)
├── server.js               # Node.js server with SEO-optimized headers + meta injection
├── robots.txt              # Multi-bot rules, points to all sitemaps
├── sitemap.xml             # Main sitemap (all pages, all languages, hreflang)
├── sitemap-index.xml       # Sitemap index pointing to all language sitemaps
├── sitemap-ar.xml          # Arabic language sitemap
├── sitemap-en.xml          # English language sitemap
├── sitemap-fr.xml          # French language sitemap
├── sitemap-es.xml          # Spanish language sitemap
├── favicon.svg
├── logo.png
└── opengraph.jpg
```

## SEO Implementation
### Strategies applied:
1. **Meta tags** — Full title, description, keywords for all 4 languages injected server-side per route
2. **hreflang** — `ar`, `en`, `fr`, `es`, `x-default` alternate links in `<head>` for multilingual targeting
3. **Structured Data (JSON-LD)** — WebSite + SearchAction, Organization, Book/Encyclopedia, BreadcrumbList, SiteNavigationElement, FAQPage (all 4 languages)
4. **Open Graph + Twitter Card** — All 4 locale alternates
5. **Sitemap Index** — Master index + 5 sitemaps (main + per-language) all accessible at root
6. **robots.txt** — All major bots allowed, AhrefsBot/SemrushBot partially allowed, all sitemaps listed
7. **HTTP Headers** — Cache-Control per file type, X-Content-Type-Options, X-Frame-Options, Referrer-Policy
8. **Server-side lang injection** — Routes matching `/ar/`, `/en/`, `/fr/`, `/es/` get appropriate `<html lang>`, `<title>`, `<description>`, `<keywords>` injected before serving HTML

## Important Notes
- The Vite build has `base: '/m-njhku'` baked in — all asset paths use this prefix
- Root `/` redirects to `/m-njhku/`
- SEO files (robots.txt, sitemaps, favicon, images) are served from root without the base prefix
- Server runs on `0.0.0.0:5000`

## Running
```bash
node server.js
```

## Bulk Article Generator (`/admin/bulk-tools`)
- Backend: `bulk-admin.js` (mounted in `server.js`)
- Restricted to email in `BULK_ADMIN_EMAIL` (default `cpshzt@gmail.com`) via Supabase Google OAuth
- Three speed profiles: fast / medium / thorough (`SPEED_PROFILES`)
- Every generated article includes:
  - **Full Arabic content** (title, intro, stats, sections, skills, conclusion)
  - **Auto-translated en/fr/es content** via 3 parallel calls (falls back to Arabic if a translation fails)
  - **3 Pexels HD images** + **1 Pexels HD video** (fallback chain: AI image_query → English slug words → category keyword → generic "business workspace")
  - Per-language `seo_description` + `seo_keywords` saved both inside `content.languages.<lang>` and into top-level `seo_*_multilingual` JSON columns (auto-skipped if columns absent)
- Required env: `PEXELS_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL`
- Reachable URLs: `/admin/bulk-tools`, `/admin/bulk`, `/bulk-admin` (all serve the same `bulk-admin.html`)
- `bulk-admin.html` sends `provider` (gemini / groq / openrouter) on every API call so the user's key is matched to the right provider's endpoint

## Admin Sidebar Injection
- `admin-sidebar-injector.js` (root, served via static-file allowlist) is loaded from `index.html`
- On any `/admin*` page it watches the DOM, finds the React sidebar button "إنشاء مقال ذكي", and inserts a styled "إنشاء مقالات كثيرة" button right after it that navigates to `/admin/bulk`
- The compiled React bundle (`assets/index-CdSb2jcH.js`) is not modified — the injector reuses the existing Tailwind classes so the new button visually matches
