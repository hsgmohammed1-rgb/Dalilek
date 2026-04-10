const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

require('dotenv').config();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const IS_VERCEL = !!process.env.VERCEL;
const CACHE_DIR = IS_VERCEL ? '/tmp' : ROOT;
const SEO_DATA_PATH = path.join(CACHE_DIR, 'seo-data.json');
const SITEMAP_PATH = path.join(CACHE_DIR, 'sitemap-articles.xml');
const BASE_PATH = process.env.BASE_PATH || '';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
// CRITICAL: Prefer JWT keys for REST API calls. sb_publishable_* keys do NOT work with PostgREST.
const SUPABASE_KEY = process.env.SERVICE_ROLE_API || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ANON_PUBLIC || process.env.SUPABASE_KEY;
const SEO_WEBHOOK_SECRET = process.env.SEO_WEBHOOK_SECRET;
const SITE_URL = (process.env.SITE_URL || process.env.ALLOWED_ORIGIN || '').replace(/\/$/, '');
if (!SITE_URL) throw new Error("CRITICAL: SITE_URL missing in .env");
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("CRITICAL: Supabase keys missing in .env");

function safeJsonStringify(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/\//g, '\\u002f');
}
function safeEscapeString(str) {
  return str.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/\//g, '\\u002f');
}

// Global rate limiting map
global.rateLimits = {};

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml':  'application/xml; charset=utf-8',
  '.txt':  'text/plain; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
};

const ROOT_SEO_FILES = [
  '/robots.txt','/sitemap.xml','/sitemap-index.xml',
  '/sitemap-ar.xml','/sitemap-en.xml','/sitemap-fr.xml','/sitemap-es.xml',
  '/favicon.svg','/logo.png','/opengraph.jpg',
];

const BANNERS = {
  ar: {
    landscape: SITE_URL + '/banners/ar-landscape.png',
    portrait:  SITE_URL + '/banners/ar-portrait.png',
    width: 1920, height: 1080,
  },
  en: {
    landscape: SITE_URL + '/banners/en-landscape.png',
    portrait:  SITE_URL + '/banners/en-portrait.png',
    width: 1920, height: 1080,
  },
  fr: {
    landscape: SITE_URL + '/banners/fr-landscape.png',
    portrait:  SITE_URL + '/banners/fr-portrait.png',
    width: 1920, height: 1080,
  },
  es: {
    landscape: SITE_URL + '/banners/es-landscape.png',
    portrait:  SITE_URL + '/banners/es-portrait.png',
    width: 1920, height: 1080,
  },
};

const OG_LOCALE = {
  ar: 'ar_AR',
  en: 'en_US',
  fr: 'fr_FR',
  es: 'es_ES',
};

const PAGE_META = {
  ar: {
    title: 'دليلك - الموسوعة العربية الشاملة | موسوعة المعرفة العربية',
    description: 'دليلك — الموسوعة العربية الشاملة. مقالات موثوقة ومعمّقة في التكنولوجيا، الصحة، الأعمال، العلوم، الثقافة وتطوير الذات. أكثر من ألف مقال موثوق.',
    keywords: 'دليلك, موسوعة عربية, مقالات عربية, تكنولوجيا, صحة, أعمال, علوم, ثقافة, تطوير الذات, معرفة',
    lang: 'ar', dir: 'rtl',
  },
  en: {
    title: 'Dalilek - The Comprehensive Arabic Encyclopedia | Knowledge Hub',
    description: 'Dalilek — The comprehensive Arabic encyclopedia. Trusted, in-depth articles on technology, health, business, science, culture and self-development in 4 languages.',
    keywords: 'Dalilek, Arabic encyclopedia, Arabic articles, technology, health, business, science, culture, self-development, knowledge',
    lang: 'en', dir: 'ltr',
  },
  fr: {
    title: "Dalilek - L'Encyclopédie Arabe Complète | Base de Connaissance",
    description: "Dalilek — L'encyclopédie arabe complète. Articles fiables et approfondis sur la technologie, la santé, les affaires, les sciences, la culture et le développement personnel.",
    keywords: 'Dalilek, encyclopédie arabe, articles arabes, technologie, santé, affaires, sciences, culture, développement personnel',
    lang: 'fr', dir: 'ltr',
  },
  es: {
    title: 'Dalilek - La Enciclopedia Árabe Completa | Centro de Conocimiento',
    description: 'Dalilek — La enciclopedia árabe integral. Artículos confiables y detallados sobre tecnología, salud, negocios, ciencias, cultura y desarrollo personal.',
    keywords: 'Dalilek, enciclopedia árabe, artículos árabes, tecnología, salud, negocios, ciencias, cultura, desarrollo personal',
    lang: 'es', dir: 'ltr',
  },
};

// Load SEO data cache
let seoDataCache = {};
function loadSeoCache() {
  try {
    seoDataCache = JSON.parse(fs.readFileSync(SEO_DATA_PATH, 'utf-8'));
  } catch (e) {
    console.log('No seo-data.json yet, will fetch from Supabase');
  }
}

// ── Dynamic sitemap-articles.xml ─────────────────────────────────────────────
function generateArticlesSitemapXml() {
  const today = new Date().toISOString().split('T')[0];
  const langs = ['ar', 'en', 'fr', 'es'];
  let urls = '';

  for (const [slug, article] of Object.entries(seoDataCache)) {
    const canonical = `${SITE_URL}/articles/${slug}`;
    const banner = BANNERS.ar || { landscape: SITE_URL + '/banners/ar-landscape.png' };
    const alts = langs.map(l =>
      `    <xhtml:link rel="alternate" hreflang="${l}" href="${SITE_URL}/${l}/articles/${slug}" />`
    ).join('\n');
    const xDefault = `    <xhtml:link rel="alternate" hreflang="x-default" href="${canonical}" />`;
    const imageTitle = article.title ? safeEscapeString(article.title) : 'صورة المقال';

    urls += `
  <url>
    <loc>${canonical}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
    <image:image>
      <image:loc>${banner.landscape}</image:loc>
      <image:title>${imageTitle}</image:title>
    </image:image>
${alts}
${xDefault}
  </url>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>`;
}

// Also regenerate the static file on disk so it stays up-to-date
function writeDynamicSitemap() {
  try {
    const xml = generateArticlesSitemapXml();
    fs.writeFileSync(SITEMAP_PATH, xml, 'utf-8');
    console.log(`Sitemap regenerated: ${Object.keys(seoDataCache).length} articles`);
  } catch (e) {
    console.error('Sitemap write error:', e.message);
  }
}

let refreshPromise = null;
async function ensureSeoCache() {
  if (Object.keys(seoDataCache).length > 0) return;
  if (!refreshPromise) refreshPromise = refreshSeoFromSupabase();
  await refreshPromise;
}

// ── Supabase SEO refresh ──────────────────────────────────────────────────────
async function refreshSeoFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  const host = SUPABASE_URL.replace('https://', '').split('/')[0];
  return new Promise((resolve) => {
    const opts = {
      hostname: host,
      path: '/rest/v1/articles?select=id,title,slug,category,seo_keywords,seo_description',
      method: 'GET',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Accept': 'application/json' },
    };
    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', async () => {
        try {
          const data = Buffer.concat(chunks).toString('utf-8');
          const articles = JSON.parse(data);
          if (!Array.isArray(articles)) { resolve(); return; }
          const { buildMultilingualKeywords, buildMultilingualDescription, supabaseFetch } = require('./seo-generator.js');
          const freshCache = {};
          const toUpdate = [];

          articles.forEach(a => {
            if (!a.slug) return;
            const kw = buildMultilingualKeywords(a);
            const desc = buildMultilingualDescription(a);
            freshCache[a.slug] = {
              id: a.id,
              title: a.title,
              category: a.category,
              keywords: kw,
              description: desc,
            };
            toUpdate.push({ id: a.id, slug: a.slug, kw, desc, hasDesc: !!a.seo_description });
          });

          seoDataCache = freshCache;
          fs.writeFileSync(SEO_DATA_PATH, JSON.stringify(freshCache, null, 2));
          console.log(`SEO cache refreshed: ${articles.length} articles`);

          // Save multilingual SEO back to Supabase for all articles
          if (SUPABASE_URL && SUPABASE_KEY) {
            for (const item of toUpdate) {
              try {
                const update = {
                  seo_keywords_multilingual: item.kw,
                  seo_description_multilingual: item.desc,
                };
                if (!item.hasDesc) update.seo_description = item.desc.ar;
                await supabaseFetch(
                  `articles?id=eq.${item.id}`,
                  'PATCH',
                  update
                );
              } catch (e) {
                // non-fatal: multilingual columns may not exist yet
              }
            }
          }

          // Regenerate sitemap with new articles
          writeDynamicSitemap();
        } catch (e) { console.error('SEO refresh error:', e.message); }
        resolve();
      });
    });
    req.on('error', () => resolve());
    req.end();
  });
}

function getCacheHeaders(ext) {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
  if (ext === '.html' || ext === '') {
    headers['Cache-Control'] = 'public, max-age=300, stale-while-revalidate=60';
  } else if (['.js', '.css', '.woff', '.woff2', '.ttf'].includes(ext)) {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  } else if (['.png', '.jpg', '.jpeg', '.svg', '.webp', '.ico'].includes(ext)) {
    headers['Cache-Control'] = 'public, max-age=86400';
  } else if (['.xml', '.txt'].includes(ext)) {
    headers['Cache-Control'] = 'public, max-age=300';
  }
  return headers;
}

function escapeHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function buildArticleJsonLd(article, slug, lang) {
  const kw = article.keywords[lang] || article.keywords.ar;
  const desc = article.description[lang] || article.description.ar;
  const banner = BANNERS[lang] || BANNERS.ar;
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.title,
    "description": desc,
    "keywords": kw,
    "url": `${SITE_URL}/articles/${slug}`,
    "inLanguage": lang,
    "image": {
      "@type": "ImageObject",
      "url": banner.landscape,
      "width": banner.width,
      "height": banner.height,
    },
    "author": { "@type": "Organization", "name": "فريق دليلك", "url": SITE_URL + "" },
    "publisher": {
      "@type": "Organization",
      "name": "دليلك",
      "url": SITE_URL + "",
      "logo": { "@type": "ImageObject", "url": SITE_URL + "/logo.png" },
    },
    "mainEntityOfPage": { "@type": "WebPage", "@id": `${SITE_URL}/articles/${slug}` },
    "articleSection": article.category,
    "isPartOf": { "@type": "WebSite", "name": "دليلك", "url": SITE_URL + "" },
  });
}

function buildBreadcrumbJsonLd(article, slug) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "الرئيسية", "item": SITE_URL + "/" },
      { "@type": "ListItem", "position": 2, "name": "المقالات", "item": SITE_URL + "/articles" },
      { "@type": "ListItem", "position": 3, "name": article.title, "item": `${SITE_URL}/articles/${slug}` },
    ],
  });
}

function injectArticleMeta(baseHtml, slug, lang) {
  const article = seoDataCache[slug];
  if (!article) return injectPageMeta(baseHtml, lang);

  const kw = escapeHtml(article.keywords[lang] || article.keywords.ar);
  const desc = escapeHtml(article.description[lang] || article.description.ar);
  const title = escapeHtml(article.title);
  const pageLang = lang || 'ar';
  const dir = pageLang === 'ar' ? 'rtl' : 'ltr';
  const canonicalUrl = `${SITE_URL}/articles/${slug}`;
  const fullTitle = `${title} | دليلك`;

  const articleJsonLd = buildArticleJsonLd(article, slug, pageLang);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(article, slug);

  const banner = BANNERS[pageLang] || BANNERS.ar;
  const ogImage = banner.landscape;
  const ogLocale = OG_LOCALE[pageLang] || 'ar_AR';
  const ogLocaleAlts = Object.entries(OG_LOCALE)
    .filter(([l]) => l !== pageLang)
    .map(([, locale]) => `<meta property="og:locale:alternate" content="${locale}" />`)
    .join('\n    ');

  let html = baseHtml
    .replace(/<html lang="[^"]*" dir="[^"]*"/, `<html lang="${pageLang}" dir="${dir}"`)
    .replace(/<title>[^<]*<\/title>/, `<title>${fullTitle}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${desc}" />`)
    .replace(/<meta name="keywords" content="[^"]*" \/>/, `<meta name="keywords" content="${kw}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${fullTitle}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${desc}" />`)
    .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${canonicalUrl}" />`)
    .replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${ogImage}" />`)
    .replace(/<meta property="og:image:width" content="[^"]*" \/>/, `<meta property="og:image:width" content="${banner.width}" />`)
    .replace(/<meta property="og:image:height" content="[^"]*" \/>/, `<meta property="og:image:height" content="${banner.height}" />`)
    .replace(/<meta property="og:image:alt" content="[^"]*" \/>/, `<meta property="og:image:alt" content="${fullTitle}" />`)
    .replace(/<meta property="og:locale" content="[^"]*" \/>/, `<meta property="og:locale" content="${ogLocale}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${fullTitle}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${desc}" />`)
    .replace(/<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${ogImage}" />`)
    .replace(/<meta name="twitter:image:alt" content="[^"]*" \/>/, `<meta name="twitter:image:alt" content="${fullTitle}" />`);

  // Remove all existing og:locale:alternate tags, then add correct ones after og:locale
  html = html.replace(/[ \t]*<meta property="og:locale:alternate" content="[^"]*" \/>\n?/g, '');
  html = html.replace(
    /(<meta property="og:locale" content="[^"]*" \/>)/,
    `$1\n    ${ogLocaleAlts}`
  );

  // Inject multilingual SEO keywords as global variable for React to consume
  const seoGlobal = `<script>window.__DALILEK_SEO__=${safeJsonStringify(article.keywords)};</script>`;

  // Inject article-specific JSON-LD before </head>
  const articleScripts = `
    ${seoGlobal}
    <script type="application/ld+json">${safeEscapeString(articleJsonLd)}</script>
    <script type="application/ld+json">${safeEscapeString(breadcrumbJsonLd)}</script>
  `;
  html = html.replace('</head>', articleScripts + '</head>');

  return html;
}

function injectPageMeta(html, lang) {
  const page = PAGE_META[lang] || PAGE_META.ar;
  const effectiveLang = lang || 'ar';
  const banner = BANNERS[effectiveLang] || BANNERS.ar;
  const ogImage = banner.landscape;
  const ogLocale = OG_LOCALE[effectiveLang] || 'ar_AR';
  const ogLocaleAlts = Object.entries(OG_LOCALE)
    .filter(([l]) => l !== effectiveLang)
    .map(([, locale]) => `<meta property="og:locale:alternate" content="${locale}" />`)
    .join('\n    ');

  let result = html
    .replace(/<html lang="[^"]*" dir="[^"]*"/, `<html lang="${page.lang}" dir="${page.dir}"`)
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(page.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${escapeHtml(page.description)}" />`)
    .replace(/<meta name="keywords" content="[^"]*" \/>/, `<meta name="keywords" content="${escapeHtml(page.keywords)}" />`)
    .replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${ogImage}" />`)
    .replace(/<meta property="og:image:width" content="[^"]*" \/>/, `<meta property="og:image:width" content="${banner.width}" />`)
    .replace(/<meta property="og:image:height" content="[^"]*" \/>/, `<meta property="og:image:height" content="${banner.height}" />`)
    .replace(/<meta property="og:image:alt" content="[^"]*" \/>/, `<meta property="og:image:alt" content="${escapeHtml(page.title)}" />`)
    .replace(/<meta property="og:locale" content="[^"]*" \/>/, `<meta property="og:locale" content="${ogLocale}" />`)
    .replace(/<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${ogImage}" />`)
    .replace(/<meta name="twitter:image:alt" content="[^"]*" \/>/, `<meta name="twitter:image:alt" content="${escapeHtml(page.title)}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${escapeHtml(page.title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${escapeHtml(page.description)}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${escapeHtml(page.title)}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${escapeHtml(page.description)}" />`);

  // Remove all existing og:locale:alternate tags, then add correct ones after og:locale
  result = result.replace(/[ \t]*<meta property="og:locale:alternate" content="[^"]*" \/>\n?/g, '');
  result = result.replace(
    /(<meta property="og:locale" content="[^"]*" \/>)/,
    `$1\n    ${ogLocaleAlts}`
  );

  return result;
}

function getBaseHtml() {
  try { return fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8'); } catch { return null; }
}

function injectCanonicalAndHreflang(html, effectivePath) {
  // Remove ALL existing canonical and hreflang tags (more robust regex)
  html = html.replace(/<link\s+rel=["']canonical["'][^>]*\/?>/gi, '');
  html = html.replace(/<link\s+rel=["']alternate["']\s+hreflang=[^>]*\/?>/gi, '');
  // Also clean up the section comment and any empty lines left behind
  html = html.replace(/\s*<!-- ===== CANONICAL \+ HREFLANG[^>]*-->\s*/gi, '');

  let basePath = effectivePath === '/index.html' ? '/' : effectivePath;
  const langMatch = basePath.match(/^\/(ar|en|fr|es)(\/|$)/);
  if (langMatch) {
    basePath = basePath.slice(langMatch[1].length + 1);
    if (!basePath.startsWith('/')) basePath = '/' + basePath;
  }
  if (basePath.endsWith('/') && basePath.length > 1) basePath = basePath.slice(0, -1);

  let requestedCanonPath = effectivePath === '/index.html' ? '/' : effectivePath;
  if (requestedCanonPath.endsWith('/') && requestedCanonPath.length > 1) requestedCanonPath = requestedCanonPath.slice(0, -1);
  const canonicalUrl = `${SITE_URL}${requestedCanonPath}`;

  const hreflang = `
    <!-- Canonical + Hreflang (injected by server) -->
    <link rel="canonical" href="${canonicalUrl}" />
    <link rel="alternate" hreflang="ar" href="${SITE_URL}/ar${basePath === '/' ? '' : basePath}" />
    <link rel="alternate" hreflang="en" href="${SITE_URL}/en${basePath === '/' ? '' : basePath}" />
    <link rel="alternate" hreflang="fr" href="${SITE_URL}/fr${basePath === '/' ? '' : basePath}" />
    <link rel="alternate" hreflang="es" href="${SITE_URL}/es${basePath === '/' ? '' : basePath}" />
    <link rel="alternate" hreflang="x-default" href="${SITE_URL}${basePath === '/' ? '' : basePath}" />
  `;
  
  // Insert canonical/hreflang BEFORE closing </head> — NOT after
  return html.replace('</head>', hreflang + '</head>');
}

function detectLangFromPath(urlPath) {
  const m = urlPath.match(/\/(ar|en|fr|es)(\/|$)/);
  return m ? m[1] : 'ar';
}

function detectSlugFromPath(urlPath) {
  const m = urlPath.match(/\/articles\/([^/?#]+)/);
  return m ? m[1] : null;
}

// ── Bot / Crawler detection ──────────────────────────────────────────────────
function isCrawlerBot(userAgent) {
  if (!userAgent) return false;
  return /Googlebot|bingbot|Baiduspider|YandexBot|DuckDuckBot|Slurp|facebookexternalhit|Twitterbot|LinkedInBot|WhatsApp|Applebot|AhrefsBot|SemrushBot|MJ12bot|Screaming Frog|rogerbot|Sogou|ia_archiver|archive\.org_bot|Mediapartners-Google|APIs-Google|AdsBot-Google|Googlebot-Image|Googlebot-News|Googlebot-Video|FeedFetcher-Google/i.test(userAgent);
}

// Strip virtual router scripts from HTML so crawlers see clean, stable URLs
function stripVirtualRouterForBot(html) {
  // Remove the early language detection script that does replaceState URL manipulation
  html = html.replace(/<!-- ===== Early language detection & Virtual Router ===== -->[\s\S]*?<\/script>/, '');
  // Remove the client-side navigation sync script that overrides pushState/replaceState
  html = html.replace(/<!-- ===== Multilingual SEO: client-side navigation sync ===== -->[\s\S]*?<\/script>/, '');
  return html;
}

// ── SEO Webhook handler (called when article is created/published) ─────────────
async function handleSeoWebhook(req, res) {
  let body = '';
  req.on('data', d => body += d);
  req.on('end', async () => {
    // Optional: validate a secret header to prevent unauthorized calls
    // SECURED: Always require webhook secret to prevent unauthorized Database modification
    if (!SEO_WEBHOOK_SECRET || req.headers['x-webhook-secret'] !== SEO_WEBHOOK_SECRET) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    try {
      // Parse optional single article from body to add it instantly to cache
      const payload = body ? JSON.parse(body) : null;
      if (payload && payload.slug) {
        const { buildMultilingualKeywords, buildMultilingualDescription, supabaseFetch } = require('./seo-generator.js');
        const kw = buildMultilingualKeywords(payload);
        const desc = buildMultilingualDescription(payload);
        seoDataCache[payload.slug] = {
          id: payload.id,
          title: payload.title,
          category: payload.category,
          keywords: kw,
          description: desc,
        };
        // Save multilingual SEO back to Supabase
        if (SUPABASE_URL && SUPABASE_KEY && payload.id) {
          try {
            await supabaseFetch(`articles?id=eq.${payload.id}`, 'PATCH', {
              seo_keywords_multilingual: kw,
              seo_description_multilingual: desc,
              seo_description: payload.seo_description || desc.ar,
            });
          } catch (e) { /* non-fatal */ }
        }
        console.log(`Webhook: SEO added instantly for "${payload.slug}"`);
      }
    } catch (e) { /* body not required */ }

    // Full refresh from Supabase + regenerate sitemap
    await refreshSeoFromSupabase();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      articles: Object.keys(seoDataCache).length,
      message: 'SEO cache refreshed and sitemap regenerated for all 4 languages',
    }));
  });
}

const appHandler = async (req, res) => {
  await ensureSeoCache();
  let urlPath = req.url.split('?')[0];

  // ── SEO Webhook endpoint ────────────────────────────────────────────────────
  if (urlPath === '/api/seo-webhook' && req.method === 'POST') {
    handleSeoWebhook(req, res);
    return;
  }

  // ── Article keywords API (for client-side navigation) ────────────────────
  if (urlPath === '/api/article-keywords' && req.method === 'GET') {
    const ip = req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    if (!global.rateLimits[ip] || now - global.rateLimits[ip].last > 60000) {
      global.rateLimits[ip] = { count: 1, last: now };
    } else {
      global.rateLimits[ip].count++;
    }

    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?') + 1) : '';
    const slugMatch = qs.match(/(?:^|&)slug=([^&]*)/);
    const slug = slugMatch ? decodeURIComponent(slugMatch[1]) : null;

    const allowedOrigin = process.env.ALLOWED_ORIGIN || SITE_URL + '';
    const reqOrigin = req.headers.origin;
    const isOriginAllowed = reqOrigin === allowedOrigin || (reqOrigin && reqOrigin.startsWith('http://localhost:'));
    
    const corsHeaders = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': isOriginAllowed ? reqOrigin : allowedOrigin,
      'Cache-Control': 'public, max-age=300',
    };

    if (global.rateLimits[ip].count > 30) {
      res.writeHead(429, corsHeaders);
      res.end(JSON.stringify({ error: 'Too many requests' }));
      return;
    }

    if (!slug || slug.length > 200) {
      res.writeHead(400, corsHeaders);
      res.end(JSON.stringify({ error: 'valid slug required' }));
      return;
    }

    if (seoDataCache[slug]) {
      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify(seoDataCache[slug].keywords));
      return;
    }

    // Not in cache — fetch from Supabase on demand
    if (SUPABASE_URL && SUPABASE_KEY) {
      const host = SUPABASE_URL.replace('https://', '').split('/')[0];
      const opts = {
        hostname: host,
        path: `/rest/v1/articles?slug=eq.${encodeURIComponent(slug)}&select=id,title,slug,category,seo_keywords,seo_description&limit=1`,
        method: 'GET',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Accept': 'application/json' },
      };
      const supaReq = https.request(opts, (supaRes) => {
        const chunks = [];
        supaRes.on('data', d => chunks.push(d));
        supaRes.on('end', () => {
          try {
            const data = Buffer.concat(chunks).toString('utf-8');
            const rows = JSON.parse(data);
            if (Array.isArray(rows) && rows.length > 0) {
              const { buildMultilingualKeywords } = require('./seo-generator.js');
              const kw = buildMultilingualKeywords(rows[0]);
              seoDataCache[slug] = { id: rows[0].id, title: rows[0].title, category: rows[0].category, keywords: kw };
              res.writeHead(200, corsHeaders);
              res.end(JSON.stringify(kw));
            } else {
              res.writeHead(404, corsHeaders);
              res.end(JSON.stringify({}));
            }
          } catch (e) {
            res.writeHead(500, corsHeaders);
            res.end(JSON.stringify({}));
          }
        });
      });
      supaReq.on('error', () => { res.writeHead(500, corsHeaders); res.end(JSON.stringify({})); });
      supaReq.end();
    } else {
      res.writeHead(404, corsHeaders);
      res.end(JSON.stringify({}));
    }
    return;
  }



  // ── Dynamic sitemap-articles.xml ────────────────────────────────────────────
  if (urlPath === '/sitemap-articles.xml') {
    const xml = generateArticlesSitemapXml();
    res.writeHead(200, {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    });
    res.end(xml);
    return;
  }

  // ── Root SEO files ──────────────────────────────────────────────────────────
  if (ROOT_SEO_FILES.includes(urlPath)) {
    const fp = path.join(ROOT, urlPath);
    const ext = path.extname(fp).toLowerCase();
    const ct = mimeTypes[ext] || 'application/octet-stream';
    fs.readFile(fp, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not Found'); return; }
      res.writeHead(200, { 'Content-Type': ct, ...getCacheHeaders(ext) });
      res.end(data);
    });
    return;
  }

  // ── Banner images ───────────────────────────────────────────────────────────
  if (urlPath.startsWith('/banners/')) {
    const fp = path.join(ROOT, urlPath);
    const ext = path.extname(fp).toLowerCase();
    const ct = mimeTypes[ext] || 'image/png';
    fs.readFile(fp, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not Found'); return; }
      res.writeHead(200, { 'Content-Type': ct, ...getCacheHeaders(ext), 'Access-Control-Allow-Origin': '*' });
      res.end(data);
    });
    return;
  }

  // ── Strip base path ─────────────────────────────────────────────────────────
  let effectivePath = urlPath.startsWith(BASE_PATH) ? urlPath.slice(BASE_PATH.length) : urlPath;
  if (!effectivePath || effectivePath === '/') effectivePath = '/index.html';

  const ext = path.extname(effectivePath).toLowerCase();
  
  // SECURE PATH TRAVERSAL FIX
  const resolvedPath = path.normalize(path.join(ROOT, effectivePath));
  if (!resolvedPath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  // ── Static assets ───────────────────────────────────────────────────────────
  const isAssetOrBanner = effectivePath.startsWith('/assets/') || effectivePath.startsWith('/banners/');
  const isPublicRootFile = ['/favicon.svg', '/logo.png', '/opengraph.jpg', '/robots.txt', '/seo-data.json'].includes(effectivePath);
  
  if (ext && ext !== '.html' && fs.existsSync(resolvedPath) && !fs.statSync(resolvedPath).isDirectory()) {
    if (!isAssetOrBanner && !isPublicRootFile && !effectivePath.endsWith('.xml')) {
        // Strict allowlist for source code disclosure protection
        res.writeHead(403); res.end('Forbidden: Not an asset'); return;
    }
    const ct = mimeTypes[ext] || 'application/octet-stream';
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const isCompressible = ct.startsWith('text/') || ct.startsWith('application/javascript') || ct.startsWith('application/json') || ext.endsWith('.xml') || ext.endsWith('.svg');

    if (isCompressible && /\bbr\b/.test(acceptEncoding)) {
      res.writeHead(200, { 'Content-Type': ct, 'Content-Encoding': 'br', ...getCacheHeaders(ext) });
      fs.createReadStream(resolvedPath).pipe(zlib.createBrotliCompress()).pipe(res);
    } else if (isCompressible && /\bgzip\b/.test(acceptEncoding)) {
      res.writeHead(200, { 'Content-Type': ct, 'Content-Encoding': 'gzip', ...getCacheHeaders(ext) });
      fs.createReadStream(resolvedPath).pipe(zlib.createGzip()).pipe(res);
    } else {
      fs.readFile(resolvedPath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not Found'); return; }
        res.writeHead(200, { 'Content-Type': ct, ...getCacheHeaders(ext) });
        res.end(data);
      });
    }
    return;
  }

  // ── All other routes → serve HTML with injected multilingual SEO ────────────
  const baseHtml = getBaseHtml();
  if (!baseHtml) { res.writeHead(500); res.end('Server Error'); return; }

  const lang = detectLangFromPath(effectivePath);
  const articleSlug = detectSlugFromPath(effectivePath);

  let html;
  if (articleSlug && seoDataCache[articleSlug]) {
    html = injectArticleMeta(baseHtml, articleSlug, lang);
  } else {
    html = injectPageMeta(baseHtml, lang);
  }

  html = injectCanonicalAndHreflang(html, effectivePath);

  // Inject all articles' multilingual keywords so React can resolve them on client-side navigation
  const allKeywordsMap = Object.fromEntries(
    Object.entries(seoDataCache).map(([slug, a]) => [slug, a.keywords])
  );
  const allKeywordsScript = `<script>window.__DALILEK_ALL_KEYWORDS__=${safeJsonStringify(allKeywordsMap)};</script>`;
  html = html.replace('</head>', allKeywordsScript + '</head>');

  // ── Crawler-safe rendering: strip virtual router for bots ──────────────────
  const userAgent = req.headers['user-agent'] || '';
  const isBot = isCrawlerBot(userAgent);
  if (isBot) {
    html = stripVirtualRouterForBot(html);
    // Add noscript fallback content for bots that don't execute JS
    const pageMeta = PAGE_META[lang] || PAGE_META.ar;
    const noscriptContent = `<noscript><h1>${escapeHtml(pageMeta.title)}</h1><p>${escapeHtml(pageMeta.description)}</p></noscript>`;
    html = html.replace('<div id="root"></div>', `<div id="root">${noscriptContent}</div>`);
  }

  const acceptEncoding = req.headers['accept-encoding'] || '';
  if (/\bbr\b/.test(acceptEncoding)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Encoding': 'br', ...getCacheHeaders('.html') });
    res.end(zlib.brotliCompressSync(Buffer.from(html, 'utf-8')));
  } else if (/\bgzip\b/.test(acceptEncoding)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Encoding': 'gzip', ...getCacheHeaders('.html') });
    res.end(zlib.gzipSync(Buffer.from(html, 'utf-8')));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...getCacheHeaders('.html') });
    res.end(html);
  }
};

// ── Bulletproof Error Handling ───────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('🔥 FATAL UNCAUGHT EXCEPTION:', err.message || err);
  // Squelch error to prevent process death
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 FATAL UNHANDLED REJECTION:', reason);
  // Squelch rejection to prevent process death
});

// ── Native HTTPS & SSL Setup ─────────────────────────────────────────────────
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || path.join(ROOT, 'ssl', 'key.pem');
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || path.join(ROOT, 'ssl', 'cert.pem');
const HTTPS_PORT = process.env.HTTPS_PORT || 443;

let httpServer;
let httpsServer;

if (fs.existsSync(SSL_KEY_PATH) && fs.existsSync(SSL_CERT_PATH)) {
  const options = {
    key: fs.readFileSync(SSL_KEY_PATH),
    cert: fs.readFileSync(SSL_CERT_PATH)
  };
  httpsServer = https.createServer(options, appHandler);
  
  // If HTTPS is active, standard HTTP port automatically redirects to HTTPS
  httpServer = http.createServer((req, res) => {
    res.writeHead(301, { "Location": "https://" + (req.headers['host'] || '').split(':')[0] + (HTTPS_PORT !== 443 ? ':' + HTTPS_PORT : '') + req.url });
    res.end();
  });
} else {
  // Fallback to standard HTTP if SSL keys are not provided
  httpServer = http.createServer(appHandler);
}

// ── Startup ──────────────────────────────────────────────────────────────────
loadSeoCache();

if (require.main === module && !IS_VERCEL) {
let initDone = false;
const startRoutine = async (protocol, host, port) => {
  console.log(`✅ ${protocol} Server running at ${protocol.toLowerCase()}://${host}:${port}`);
  if (initDone) return;
  initDone = true;
  console.log(`SEO articles cached: ${Object.keys(seoDataCache).length}`);
  await refreshSeoFromSupabase();
  console.log(`SEO articles after refresh: ${Object.keys(seoDataCache).length}`);
  setInterval(() => refreshSeoFromSupabase(), 10 * 60 * 1000);
};

httpServer.listen(PORT, HOST, () => {
  if (!httpsServer) startRoutine('HTTP', HOST, PORT);
});

if (httpsServer) {
  httpsServer.listen(HTTPS_PORT, HOST, () => startRoutine('HTTPS', HOST, HTTPS_PORT));
}
}

module.exports = appHandler; // Export for Vercel Serverless
