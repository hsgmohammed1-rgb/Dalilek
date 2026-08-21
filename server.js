const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

require('dotenv').config({ override: true });
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
  '.xsl':  'text/xsl; charset=utf-8',
};

// Note: sitemap.xml + sitemap-{lang}.xml are now generated DYNAMICALLY below
// (so lastmod stays fresh and reflects the live article cache). Only the
// static stylesheet + brand assets are served from disk.
const ROOT_SEO_FILES = [
  '/robots.txt',
  '/sitemap-style.xsl',
  '/favicon.svg','/logo.png','/opengraph.jpg',
  '/ads.txt'
];

// ── IndexNow (Bing/Yandex/DuckDuckGo/Naver/Seznam instant indexing) ─────────
// IndexNow lets us push new/updated URLs to multiple search engines without
// auth — they fetch /{key}.txt to verify ownership, then crawl the URLs.
const INDEXNOW_KEY_FILE = path.join(ROOT, '.indexnow-key');
let INDEXNOW_KEY = '';
try {
  if (fs.existsSync(INDEXNOW_KEY_FILE)) {
    INDEXNOW_KEY = fs.readFileSync(INDEXNOW_KEY_FILE, 'utf-8').trim();
  }
  if (!INDEXNOW_KEY) {
    INDEXNOW_KEY = require('crypto').randomBytes(16).toString('hex');
    fs.writeFileSync(INDEXNOW_KEY_FILE, INDEXNOW_KEY);
  }
} catch (e) { console.warn('IndexNow key init failed:', e.message); }

// Submit a list of canonical URLs to IndexNow. Fire-and-forget; never throws.

// Google Indexing API Fire-and-Forget
function submitGoogleIndexingAPI(urls) {
  return new Promise((resolve) => {
    const path = require('path');
    const credsPath = path.join(__dirname, 'google-credentials.json');
    if (!fs.existsSync(credsPath)) return resolve({ ok: false, skipped: true, error: 'No credentials' });
    
    // In the future: use 'googleapis' npm package to auth and submit.
    // For now we just log it as a placeholder until the package is installed and configured.
    console.log('[Google Indexing API] Credentials found, ready to submit:', urls.length, 'URLs');
    resolve({ ok: true });
  });
}

function submitIndexNow(urls) {
  return new Promise((resolve) => {
    try {
      if (!INDEXNOW_KEY || !Array.isArray(urls) || urls.length === 0) return resolve({ ok: false, skipped: true });
      const host = SITE_URL.replace(/^https?:\/\//, '').split('/')[0];
      const payload = JSON.stringify({
        host,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: urls.slice(0, 10000),
      });
      const req = https.request({
        hostname: 'api.indexnow.org',
        path: '/indexnow',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(payload),
          'User-Agent': 'dalilek-indexnow/1.0',
        },
        timeout: 10000,
      }, (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
          console.log(`[IndexNow] ${res.statusCode} for ${urls.length} URLs`);
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body: body.slice(0, 200) });
        });
      });
      req.on('error', (e) => { console.warn('[IndexNow] error:', e.message); resolve({ ok: false, error: e.message }); });
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
      req.write(payload);
      req.end();
    } catch (e) { resolve({ ok: false, error: e.message }); }
  });
}

// Build the full multilingual URL list for an article (canonical + 4 langs).
function articleUrlsForIndexNow(slug) {
  if (!slug) return [];
  const langs = ['ar', 'en', 'fr', 'es'];
  return [`${SITE_URL}/articles/${slug}`, ...langs.map(l => `${SITE_URL}/${l}/articles/${slug}`)];
}

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
  const articleSlugs = Object.keys(seoDataCache);

  for (const [slug, article] of Object.entries(seoDataCache)) {
    const canonical = `${SITE_URL}/articles/${slug}`;
    const articleLang = 'ar'; // canonical defaults to Arabic
    const banner = BANNERS[articleLang] || BANNERS.ar || { landscape: SITE_URL + '/banners/ar-landscape.png' };
    const alts = langs.map(l =>
      `    <xhtml:link rel="alternate" hreflang="${l}" href="${SITE_URL}/${l}/articles/${slug}" />`
    ).join('\n');
    const xDefault = `    <xhtml:link rel="alternate" hreflang="x-default" href="${canonical}" />`;
    const imageTitle = article.title ? safeEscapeString(article.title) : 'صورة المقال';

    urls += `
  <url>
    <loc>${canonical}</loc>
    <lastmod>${(article.created_at || new Date().toISOString()).split('T')[0]}</lastmod>
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
<?xml-stylesheet type="text/xsl" href="/sitemap-style.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>`;
}

// ── Dynamic sitemap.xml (master, fresh lastmod every request) ───────────────
function generateMasterSitemapXml() {
  const today = new Date().toISOString().split('T')[0];
  const langs = ['ar', 'en', 'fr', 'es'];
  const staticPaths = [
    { p: '/',           pri: '1.00', cf: 'daily'   },
    { p: '/articles',   pri: '0.90', cf: 'hourly'  },
    { p: '/categories', pri: '0.80', cf: 'weekly'  },
    { p: '/about',      pri: '0.50', cf: 'monthly' },
    { p: '/contact',    pri: '0.50', cf: 'monthly' },
  ];
  const categories = ['technology','health','business','science','culture','arts','sports','self-development'];
  staticPaths.push(...categories.map(c => ({ p: `/categories/${c}`, pri: '0.70', cf: 'weekly' })));

  const urlBlock = (pathStr, pri, cf) => {
    const canonical = `${SITE_URL}${pathStr}`;
    const alts = langs.map(l =>
      `    <xhtml:link rel="alternate" hreflang="${l}" href="${SITE_URL}/${l}${pathStr === '/' ? '/' : pathStr}" />`
    ).join('\n');
    return `  <url>
    <loc>${canonical}</loc>
    <lastmod>${(article.created_at || new Date().toISOString()).split('T')[0]}</lastmod>
    <changefreq>${cf}</changefreq>
    <priority>${pri}</priority>
${alts}
    <xhtml:link rel="alternate" hreflang="x-default" href="${canonical}" />
  </url>`;
  };

  const urls = staticPaths.map(s => urlBlock(s.p, s.pri, s.cf)).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap-style.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>`;
}

// ── Dynamic sitemap-{lang}.xml (per-language article URLs) ──────────────────
function generateLangSitemapXml(lang) {
  const today = new Date().toISOString().split('T')[0];
  const langs = ['ar', 'en', 'fr', 'es'];
  if (!langs.includes(lang)) lang = 'ar';

  let urls = '';
  // Static per-lang pages
  const staticPaths = ['/', '/articles', '/categories', '/about', '/contact'];
  for (const p of staticPaths) {
    const loc = `${SITE_URL}/${lang}${p === '/' ? '/' : p}`;
    urls += `\n  <url>\n    <loc>${loc}</loc>\n    <lastmod>${(article.created_at || new Date().toISOString()).split('T')[0]}</lastmod>\n    <changefreq>weekly</changefreq>\n  </url>`;
  }
  // Per-lang article URLs
  for (const slug of Object.keys(seoDataCache)) {
    const loc = `${SITE_URL}/${lang}/articles/${slug}`;
    urls += `\n  <url>\n    <loc>${loc}</loc>\n    <lastmod>${(article.created_at || new Date().toISOString()).split('T')[0]}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
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

// ── Article List Cache (slim content — fast listing without full Supabase payload) ──
let _artListCache = { rows: [], ts: 0 };
let _artListRefreshPromise = null;
// Egress control: the article list cache pulls the FULL `content` column for
// every article (large JSON blobs) just to build the slim listing payload.
// A short TTL meant this multi-MB fetch repeated on almost every request burst,
// which is what drove Supabase egress up. 10 minutes keeps listings fresh
// enough for a content site while cutting worst-case refetches ~6-7x.
const ART_LIST_TTL = 10 * 60_000; // 10 minutes

async function getArticleList() {
  if (_artListCache.rows.length && Date.now() - _artListCache.ts < ART_LIST_TTL) {
    return _artListCache.rows;
  }
  // Deduplicate concurrent refresh requests — only one Supabase call at a time
  if (_artListRefreshPromise) return _artListRefreshPromise;
  if (!SUPABASE_URL || !SUPABASE_KEY) return _artListCache.rows;
  const host = SUPABASE_URL.replace('https://', '').split('/')[0];
  _artListRefreshPromise = new Promise(resolve => {
    const req = https.request({
      hostname: host,
      path: '/rest/v1/articles?select=id,title,slug,category,created_at,views,title_multilingual,seo_description_multilingual,images:content->images,languages:content->languages&order=created_at.desc&limit=1000',
      method: 'GET',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Accept': 'application/json' },
      timeout: 20000,
    }, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        try {
          const arts = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
          if (!Array.isArray(arts)) { _artListRefreshPromise = null; resolve(_artListCache.rows); return; }
          const LANG_KEYS = ['ar', 'en', 'fr', 'es'];
          const slim = arts.map(a => {
            const langs = {};
            const HAS_ARABIC = /[\u0600-\u06FF]/;
            for (const l of LANG_KEYS) {
               const title = (a.title_multilingual && a.title_multilingual[l]) || (a.languages && a.languages[l] && a.languages[l].title) || a.title;
               const intro = (a.seo_description_multilingual && a.seo_description_multilingual[l]) || (a.languages && a.languages[l] && a.languages[l].intro) || a.seo_description || '';
               if (l !== 'ar' && HAS_ARABIC.test(title)) continue; // skip untranslated
               langs[l] = { title, intro: String(intro).slice(0, 200) };
            }
            const slimContent = JSON.stringify({
               languages: langs,
               images: Array.isArray(a.images) ? a.images : (a.images ? [a.images] : []),
               intro: String((a.seo_description_multilingual && a.seo_description_multilingual.ar) || (a.languages && a.languages.ar && a.languages.ar.intro) || a.seo_description || '').slice(0, 200)
            });
            return { id: a.id, title: a.title, slug: a.slug, category: a.category, created_at: a.created_at, views: a.views || 0, content: slimContent };
          });
          _artListCache = { rows: slim, ts: Date.now() };
          console.log(`[artCache] refreshed: ${slim.length} articles`);
        } catch (e) { console.error('[artCache] error:', e.message); }
        _artListRefreshPromise = null; // allow next refresh after TTL
        resolve(_artListCache.rows);
      });
    });
    req.on('error', () => { _artListRefreshPromise = null; resolve(_artListCache.rows); });
    req.on('timeout', () => { req.destroy(); _artListRefreshPromise = null; resolve(_artListCache.rows); });
    req.end();
  });
  return _artListRefreshPromise;
}
// Pre-warm article list cache 4 seconds after startup (non-blocking)
setTimeout(() => getArticleList().catch(() => {}), 4000);

// ── Supabase SEO refresh ──────────────────────────────────────────────────────
let _multilingualColumnsExist = null; // null = unknown, true/false = confirmed
async function refreshSeoFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  const host = SUPABASE_URL.replace('https://', '').split('/')[0];
  return new Promise((resolve) => {
    const opts = {
      hostname: host,
      path: '/rest/v1/articles?select=id,title,slug,category,seo_keywords,seo_description,seo_keywords_multilingual,seo_description_multilingual,title_multilingual',
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

            // Extract multilingual titles: prefer stored title_multilingual,
            // then fall back to content.languages[lang].title, then Arabic title.
            let titleMultilingual = { ar: a.title, en: a.title, fr: a.title, es: a.title };
            if (a.title_multilingual && typeof a.title_multilingual === 'object') {
              titleMultilingual = {
                ar: a.title_multilingual.ar || a.title,
                en: a.title_multilingual.en || a.title,
                fr: a.title_multilingual.fr || a.title,
                es: a.title_multilingual.es || a.title,
              };
            } else if (a.content) {
              try {
                const parsed = typeof a.content === 'string' ? JSON.parse(a.content) : a.content;
                const langs = parsed.languages || {};
                titleMultilingual = {
                  ar: langs.ar?.title || a.title,
                  en: langs.en?.title || a.title,
                  fr: langs.fr?.title || a.title,
                  es: langs.es?.title || a.title,
                };
              } catch (e) { /* keep default */ }
            }

            freshCache[a.slug] = {
              id: a.id,
              title: a.title,
              title_multilingual: titleMultilingual,
              category: a.category,
              keywords: kw,
              description: desc,
            };
            toUpdate.push({ id: a.id, slug: a.slug, kw, desc, hasDesc: !!a.seo_description });
          });

          seoDataCache = freshCache;
          fs.writeFileSync(SEO_DATA_PATH, JSON.stringify(freshCache, null, 2));
          console.log(`SEO cache refreshed: ${articles.length} articles (${toUpdate.length} need write-back)`);

          // ── Write-back disabled for performance ──────────────────────────
          // The write-back loop PATCHes every article one-by-one back to
          // Supabase. With 797+ articles this blocks the Node.js event loop
          // for minutes, making ALL HTTP requests (including article lists)
          // extremely slow (~2-3s). The multilingual SEO data is already
          // computed in-memory by the server; the DB columns are optional.
          // Disabled to keep the server fast and responsive.
          // To re-enable: uncomment the block below and restart.
          /*
          if (SUPABASE_URL && SUPABASE_KEY && _multilingualColumnsExist !== false) {
            for (const item of toUpdate) {
              try {
                const update = {
                  seo_keywords_multilingual: item.kw,
                  seo_description_multilingual: item.desc,
                };
                if (!item.hasDesc) update.seo_description = item.desc.ar;
                const resp = await supabaseFetch(
                  `articles?id=eq.${item.id}`,
                  'PATCH',
                  update
                );
                if (resp && resp.code === '42703') {
                  _multilingualColumnsExist = false;
                  break;
                }
                _multilingualColumnsExist = true;
              } catch (e) {}
            }
          }
          */

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

// ── Fetch full article content for bots ──────────────────────────────────────
async function fetchArticleContent(slug) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return '';
  const host = SUPABASE_URL.replace('https://', '').split('/')[0];
  return new Promise((resolve) => {
    const opts = {
      hostname: host,
      path: '/rest/v1/articles?slug=eq.' + encodeURIComponent(slug) + '&select=content',
      method: 'GET',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Accept': 'application/json' },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const rows = JSON.parse(data);
          if (Array.isArray(rows) && rows.length > 0) resolve(rows[0].content || '');
          else resolve('');
        } catch(e) { resolve(''); }
      });
    });
    req.on('error', () => resolve(''));
    req.end();
  });
}

const IS_PROD = SITE_URL.includes('dalilek.online');

function getCacheHeaders(ext, isHashedAsset = false) {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
  if (IS_PROD) headers['X-Frame-Options'] = 'SAMEORIGIN';
  if (isHashedAsset) {
    // Hashed filenames (e.g. index-CdSb2jcH.js) never change → cache forever
    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  } else if (ext === '.html' || ext === '') {
    headers['Cache-Control'] = 'no-cache, must-revalidate';
  } else if (['.js', '.css', '.woff', '.woff2', '.ttf'].includes(ext)) {
    headers['Cache-Control'] = 'public, max-age=3600, stale-while-revalidate=300';
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
  const titleForLang = article.title_multilingual
    ? (article.title_multilingual[lang] || article.title_multilingual.ar || article.title)
    : article.title;
  // Publisher/author names per language
  const publisherName = { ar: 'دليلك', en: 'Dalilek', fr: 'Dalilek', es: 'Dalilek' }[lang] || 'Dalilek';
  const authorName = { ar: 'فريق دليلك', en: 'Dalilek Team', fr: 'Équipe Dalilek', es: 'Equipo Dalilek' }[lang] || 'Dalilek';
  const homeLabel = { ar: 'الرئيسية', en: 'Home', fr: 'Accueil', es: 'Inicio' }[lang] || 'Home';
  const articlesLabel = { ar: 'المقالات', en: 'Articles', fr: 'Articles', es: 'Artículos' }[lang] || 'Articles';
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": titleForLang,
    "description": desc,
    "keywords": kw,
    "url": `${SITE_URL}/${lang}/articles/${slug}`,
    "inLanguage": lang,
    "image": {
      "@type": "ImageObject",
      "url": banner.landscape,
      "width": banner.width,
      "height": banner.height,
    },
    "author": { "@type": "Organization", "name": authorName, "url": SITE_URL + "" },
    "publisher": {
      "@type": "Organization",
      "name": publisherName,
      "url": SITE_URL + "",
      "logo": { "@type": "ImageObject", "url": SITE_URL + "/logo.png" },
    },
    "mainEntityOfPage": { "@type": "WebPage", "@id": `${SITE_URL}/${lang}/articles/${slug}` },
    "articleSection": article.category,
    "datePublished": article.created_at || new Date().toISOString(),
    "dateModified": article.created_at || new Date().toISOString(),
    "isPartOf": { "@type": "WebSite", "name": publisherName, "url": SITE_URL + "" },
  });
}

function buildBreadcrumbJsonLd(article, slug, lang) {
  const titleForLang = article.title_multilingual
    ? (article.title_multilingual[lang] || article.title_multilingual.ar || article.title)
    : article.title;
  const homeLabel = { ar: 'الرئيسية', en: 'Home', fr: 'Accueil', es: 'Inicio' }[lang] || 'Home';
  const articlesLabel = { ar: 'المقالات', en: 'Articles', fr: 'Articles', es: 'Artículos' }[lang] || 'Articles';
  const pageLang = lang || 'ar';
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": homeLabel, "item": `${SITE_URL}/${pageLang}/` },
      { "@type": "ListItem", "position": 2, "name": articlesLabel, "item": `${SITE_URL}/${pageLang}/articles` },
      { "@type": "ListItem", "position": 3, "name": titleForLang, "item": `${SITE_URL}/${pageLang}/articles/${slug}` },
    ],
  });
}

// Convert a URL slug to a readable Title Case string (used as title fallback
// for non-Arabic languages when title_multilingual is not yet in the cache).
// e.g. "virtual-reality-sleep-disorder-treatment" → "Virtual Reality Sleep Disorder Treatment"
function slugToReadableTitle(slug) {
  return (slug || '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function injectArticleMeta(baseHtml, slug, lang) {
  const article = seoDataCache[slug];
  if (!article) return injectPageMeta(baseHtml, lang);

  const kw = escapeHtml((article.keywords && (article.keywords[lang] || article.keywords.ar)) || '');
  const desc = escapeHtml((article.description && (article.description[lang] || article.description.ar)) || '');
  // Priority: 1) stored title_multilingual, 2) slug-derived title for Latin langs, 3) Arabic title
  let titleForLang;
  if (article.title_multilingual && article.title_multilingual[lang]) {
    titleForLang = article.title_multilingual[lang];
  } else if (lang && lang !== 'ar') {
    // Derive a readable title from the slug as a fallback for non-Arabic languages
    titleForLang = slugToReadableTitle(slug);
  } else {
    titleForLang = article.title;
  }
  const title = escapeHtml(titleForLang);
  const pageLang = lang || 'ar';
  const dir = pageLang === 'ar' ? 'rtl' : 'ltr';
  const hreflangs = ['ar', 'en', 'fr', 'es'].map(l => `<link rel="alternate" hreflang="${l}" href="${l === 'ar' ? `${SITE_URL}/articles/${slug}` : `${SITE_URL}/${l}/articles/${slug}`}" />`).join('\n    ');
  const hreflangTags = hreflangs + `\n    <link rel="alternate" hreflang="x-default" href="${SITE_URL}/articles/${slug}" />`;
  const canonicalUrl = pageLang === 'ar' ? `${SITE_URL}/articles/${slug}` : `${SITE_URL}/${pageLang}/articles/${slug}`;
  const fullTitle = `${title} | Dalilek`;

  const articleJsonLd = buildArticleJsonLd(article, slug, pageLang);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(article, slug, pageLang);

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
    .replace(/<meta name="description"\s+content="[^"]*"\s*\/>/, `<meta name="description" content="${desc}" />`)
    .replace(/<meta name="keywords"\s+content="[^"]*"\s*\/>/, `<meta name="keywords" content="${kw}" />`)
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
    .replace(/<meta name="description"\s+content="[^"]*"\s*\/>/, `<meta name="description" content="${escapeHtml(page.description)}" />`)
    .replace(/<meta name="keywords"\s+content="[^"]*"\s*\/>/, `<meta name="keywords" content="${escapeHtml(page.keywords)}" />`)
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
  try { 
    let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8'); 
    html = html.replace(/index-CdSb2jcH\.([a-zA-Z0-9.]+)\.js/g, 'index-CdSb2jcH.$1.js?v=' + Date.now());
    return html;
  } catch { return null; }
}

function injectCanonicalAndHreflang(html, effectivePath) {
  // Remove ALL existing canonical and hreflang tags (more robust regex)
  html = html.replace(/<link\s+rel=["']canonical["'][^>]*\/?>/gi, '');
  html = html.replace(/<link\s+rel=["']alternate["']\s+hreflang=[^>]*\/?>/gi, '');
  html = html.replace(/\s*<!-- ===== CANONICAL \+ HREFLANG[^>]*-->\s*/gi, '');

  // Normalize effective path
  let urlPath = effectivePath === '/index.html' ? '/' : effectivePath;

  // Detect language prefix and extract base path (without lang prefix)
  const langMatch = urlPath.match(/^\/(ar|en|fr|es)(\/(.*)|$)/);
  let basePath;
  if (langMatch) {
    basePath = langMatch[3] ? '/' + langMatch[3] : '/';
  } else {
    basePath = urlPath;
  }
  // Remove trailing slash from basePath UNLESS it IS just "/"
  if (basePath.endsWith('/') && basePath.length > 1) basePath = basePath.slice(0, -1);

  const isRoot = (basePath === '/');

  // Build canonical URL — consistent with sitemap:
  // Language roots get trailing slash (/ar/), other paths don't
  let canonicalPath;
  if (langMatch && isRoot) {
    canonicalPath = '/' + langMatch[1] + '/';
  } else if (!langMatch && isRoot) {
    canonicalPath = '/';
  } else {
    canonicalPath = urlPath;
    if (canonicalPath.endsWith('/') && canonicalPath.length > 1) canonicalPath = canonicalPath.slice(0, -1);
  }
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;

  // Build hreflang alternate URLs — language roots get trailing slash
  const buildLangUrl = (lang) => isRoot ? `${SITE_URL}/${lang}/` : `${SITE_URL}/${lang}${basePath}`;
  const xDefaultUrl = isRoot ? `${SITE_URL}/` : `${SITE_URL}${basePath}`;

  const hreflang = `
    <!-- Canonical + Hreflang (injected by server) -->
    <link rel="canonical" href="${canonicalUrl}" />
    <link rel="alternate" hreflang="ar" href="${buildLangUrl('ar')}" />
    <link rel="alternate" hreflang="en" href="${buildLangUrl('en')}" />
    <link rel="alternate" hreflang="fr" href="${buildLangUrl('fr')}" />
    <link rel="alternate" hreflang="es" href="${buildLangUrl('es')}" />
    <link rel="alternate" hreflang="x-default" href="${xDefaultUrl}" />
  `;

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

// ── Rich pre-rendered content for search engine bots ────────────────────────
// Google has TWO crawl passes:
//   1. HTML-only pass: indexes raw HTML (no JS)
//   2. JS rendering pass (WRS): executes JavaScript like a real browser
// This function generates meaningful HTML for the HTML-only pass so Google
// can index real content, links, and navigation even before JS runs.
// React will replace this content when it mounts on the WRS pass.
function generateBotContent(effectivePath, lang, articleSlug, articleContentHTML = '') {
  const effectiveLang = lang || 'ar';
  const pageMeta = PAGE_META[effectiveLang] || PAGE_META.ar;

  const catLabels = {
    ar: { technology:'تكنولوجيا', health:'صحة', business:'أعمال', science:'علوم', culture:'ثقافة', arts:'فنون', sports:'رياضة', 'self-development':'تطوير الذات' },
    en: { technology:'Technology', health:'Health', business:'Business', science:'Science', culture:'Culture', arts:'Arts', sports:'Sports', 'self-development':'Self Development' },
    fr: { technology:'Technologie', health:'Santé', business:'Affaires', science:'Sciences', culture:'Culture', arts:'Arts', sports:'Sports', 'self-development':'Développement personnel' },
    es: { technology:'Tecnología', health:'Salud', business:'Negocios', science:'Ciencias', culture:'Cultura', arts:'Artes', sports:'Deportes', 'self-development':'Desarrollo personal' },
  };
  const labels = catLabels[effectiveLang] || catLabels.ar;

  const txt = {
    ar: { home:'الرئيسية', articles:'المقالات', categories:'التصنيفات', about:'من نحن', contact:'تواصل معنا', latest:'أحدث المقالات', category:'التصنيف', keywords:'كلمات مفتاحية', privacy:'سياسة الخصوصية', terms:'شروط الاستخدام' },
    en: { home:'Home', articles:'Articles', categories:'Categories', about:'About', contact:'Contact', latest:'Latest Articles', category:'Category', keywords:'Keywords', privacy:'Privacy Policy', terms:'Terms of Use' },
    fr: { home:'Accueil', articles:'Articles', categories:'Catégories', about:'À propos', contact:'Contact', latest:'Derniers articles', category:'Catégorie', keywords:'Mots-clés', privacy:'Politique de confidentialité', terms:"Conditions d'utilisation" },
    es: { home:'Inicio', articles:'Artículos', categories:'Categorías', about:'Acerca de', contact:'Contacto', latest:'Últimos artículos', category:'Categoría', keywords:'Palabras clave', privacy:'Política de privacidad', terms:'Términos de uso' },
  };
  const T = txt[effectiveLang] || txt.ar;

  // Language switcher
  const langLinks = ['ar','en','fr','es'].map(l => {
    const name = l==='ar'?'العربية':l==='en'?'English':l==='fr'?'Français':'Español';
    return `<a href="${SITE_URL}/${l}/">${name}</a>`;
  }).join(' | ');

  // Main navigation
  const nav = `<header><nav><a href="${SITE_URL}/${effectiveLang}/">${T.home}</a> | <a href="${SITE_URL}/${effectiveLang}/articles">${T.articles}</a> | <a href="${SITE_URL}/${effectiveLang}/categories">${T.categories}</a> | <a href="${SITE_URL}/${effectiveLang}/about">${T.about}</a> | <a href="${SITE_URL}/${effectiveLang}/contact">${T.contact}</a></nav><nav>${langLinks}</nav></header>`;

  // Category links
  const categories = ['technology','health','business','science','culture','arts','sports','self-development'];
  const catLinks = categories.map(c =>
    `<li><a href="${SITE_URL}/${effectiveLang}/categories/${c}">${escapeHtml(labels[c]||c)}</a></li>`
  ).join('');

  // Article links (up to 50)
  const articleEntries = Object.entries(seoDataCache);
  const articleLinks = articleEntries.slice(0, 50).map(([slug, a]) => {
    const desc = (a.description && (a.description[effectiveLang] || a.description.ar)) || '';
    return `<li><a href="${SITE_URL}/${effectiveLang}/articles/${slug}">${escapeHtml(a.title)}</a><p>${escapeHtml(desc.substring(0, 200))}</p></li>`;
  }).join('');

  // ── Individual article page ────────────────────
  if (articleSlug && seoDataCache[articleSlug]) {
    const article = seoDataCache[articleSlug];
    const desc = (article.description && (article.description[effectiveLang] || article.description.ar)) || '';
    const kw = (article.keywords && (article.keywords[effectiveLang] || article.keywords.ar)) || '';
    return `${nav}<main><article><h1>${escapeHtml(article.title)}</h1><p>${escapeHtml(desc)}</p>${articleContentHTML}<p><strong>${T.category}:</strong> ${escapeHtml(article.category||'')}</p><p><strong>${T.keywords}:</strong> ${escapeHtml(kw)}</p></article><section><h2>${T.latest}</h2><ul>${articleLinks}</ul></section></main><footer><ul>${catLinks}</ul></footer>`;
  }

  // Strip lang prefix for path matching
  const pathWithoutLang = effectivePath.replace(/^\/(ar|en|fr|es)(\/|$)/, '/');

  // ── Articles listing ───────────────────────────
  if (pathWithoutLang === '/articles' || pathWithoutLang === '/articles/') {
    return `${nav}<main><h1>${escapeHtml(pageMeta.title)} — ${T.articles}</h1><p>${escapeHtml(pageMeta.description)}</p><section><h2>${T.latest}</h2><ul>${articleLinks}</ul></section><section><h2>${T.categories}</h2><ul>${catLinks}</ul></section></main>`;
  }

  // ── Categories listing ─────────────────────────
  if (pathWithoutLang === '/categories' || pathWithoutLang === '/categories/') {
    return `${nav}<main><h1>${escapeHtml(pageMeta.title)} — ${T.categories}</h1><p>${escapeHtml(pageMeta.description)}</p><ul>${catLinks}</ul></main>`;
  }

  // ── Category page ──────────────────────────────
  const catMatch = pathWithoutLang.match(/^\/categories\/([^/?#]+)/);
  if (catMatch) {
    const catSlug = catMatch[1];
    const catName = labels[catSlug] || catSlug;
    const catArticles = articleEntries
      .filter(([, a]) => a.category && (a.category.toLowerCase() === catSlug.toLowerCase() || a.category === (catLabels.ar[catSlug]||'')))
      .map(([slug, a]) => `<li><a href="${SITE_URL}/${effectiveLang}/articles/${slug}">${escapeHtml(a.title)}</a></li>`).join('');
    return `${nav}<main><h1>${escapeHtml(catName)}</h1><p>${escapeHtml(pageMeta.description)}</p><ul>${catArticles || articleLinks}</ul></main>`;
  }

  // ── About / Contact / Privacy / Terms ──────────
  if (pathWithoutLang === '/about' || pathWithoutLang === '/about/') return `${nav}<main><h1>${T.about}</h1><p>${escapeHtml(pageMeta.description)}</p></main>`;
  if (pathWithoutLang === '/contact' || pathWithoutLang === '/contact/') return `${nav}<main><h1>${T.contact}</h1><p>${escapeHtml(pageMeta.description)}</p></main>`;
  if (pathWithoutLang === '/privacy') return `${nav}<main><h1>${T.privacy}</h1><p>${escapeHtml(pageMeta.description)}</p></main>`;
  if (pathWithoutLang === '/terms') return `${nav}<main><h1>${T.terms}</h1><p>${escapeHtml(pageMeta.description)}</p></main>`;

  // ── Default: Home page ─────────────────────────
  return `${nav}<main><h1>${escapeHtml(pageMeta.title)}</h1><p>${escapeHtml(pageMeta.description)}</p><section><h2>${T.latest}</h2><ul>${articleLinks}</ul></section><section><h2>${T.categories}</h2><ul>${catLinks}</ul></section></main>`;
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
        // Extract multilingual titles from payload
        let titleMultilingual = { ar: payload.title, en: payload.title, fr: payload.title, es: payload.title };
        if (payload.title_multilingual && typeof payload.title_multilingual === 'object') {
          titleMultilingual = {
            ar: payload.title_multilingual.ar || payload.title,
            en: payload.title_multilingual.en || payload.title,
            fr: payload.title_multilingual.fr || payload.title,
            es: payload.title_multilingual.es || payload.title,
          };
        } else if (payload.content) {
          try {
            const parsed = typeof payload.content === 'string' ? JSON.parse(payload.content) : payload.content;
            const langs = parsed.languages || {};
            titleMultilingual = {
              ar: langs.ar?.title || payload.title,
              en: langs.en?.title || payload.title,
              fr: langs.fr?.title || payload.title,
              es: langs.es?.title || payload.title,
            };
          } catch (e) { /* keep default */ }
        }
        seoDataCache[payload.slug] = {
          id: payload.id,
          title: payload.title,
          title_multilingual: titleMultilingual,
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

const bulkAdmin = require('./bulk-admin.js');

const appHandler = async (req, res) => {
  await ensureSeoCache();
  let urlPath = req.url.split('?')[0];

  // Strip language prefix (e.g., /ar/admin/bulk -> /admin/bulk)
  let checkPath = urlPath;
  const langPrefixMatch = urlPath.match(/^\/(ar|en|fr|es)(\/|$)/);
  if (langPrefixMatch) {
    checkPath = '/' + urlPath.substring(langPrefixMatch[0].length);
    if (checkPath === '//') checkPath = '/';
  }

  // ── Bulk Admin page (served at multiple paths so it feels part of /admin) ──
  const isBulkAdminPath = (
    checkPath === '/bulk-admin' || checkPath === '/bulk-admin/' ||
    checkPath === '/admin/bulk-tools' || checkPath === '/admin/bulk-tools/' ||
    checkPath === '/admin/bulk' || checkPath === '/admin/bulk/'
  );
  if (isBulkAdminPath && req.method === 'GET') {
    fs.readFile(path.join(ROOT, 'bulk-admin.html'), (err, data) => {
      if (err) { res.writeHead(404); res.end('Not Found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex,nofollow' });
      res.end(data);
    });
    return;
  }

  // ── Category Counts API (full article list → {category: count} array) ─────
  // Used by the fetch interceptor to replace the yI() Supabase .select("category") call
  // so the counts shown on category cards reflect the complete dataset, not a 20-row slice.
  if (urlPath === '/api/categories/counts' && req.method === 'GET') {
    try {
      const rows = await getArticleList();
      // Return an array of {category} objects — same shape as Supabase .select("category")
      // so the existing yI() counting loop works without any frontend changes.
      const catArray = rows.map(a => ({ category: a.category || 'عام' }));
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify(catArray));
    } catch (e) {
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── Fast Article List API (server-side cache → slim payload → fast browser) ──
  console.log(`[REQ] ${req.method} ${urlPath}${req.url.substring(urlPath.length)}`);
  
  if (urlPath === '/api/articles/list' && req.method === 'GET') {
    const t0 = Date.now();
    try {
      const qs = new URL('http://x' + req.url).searchParams;
      const lang    = qs.get('lang')  || 'ar';
      const limit   = Math.min(Math.max(1, parseInt(qs.get('limit')  || '20') || 20), 150);
      const offset  = Math.max(0, parseInt(qs.get('offset') || '0') || 0);
      const order   = qs.get('order') || 'created_at.desc';
      const afterTs = qs.get('after') || null;
      const category = qs.get('category') || null;

      const HAS_ARABIC = /[\u0600-\u06FF]/;

      let rows = await getArticleList();

      if (category) {
        rows = rows.filter(a => (a.category || 'عام') === category);
      }

      if (afterTs) {
        const after = new Date(afterTs).getTime();
        if (!isNaN(after)) rows = rows.filter(a => new Date(a.created_at).getTime() >= after);
      }

      if (lang !== 'ar') {
        rows = rows.filter(a => {
          try {
            const title = JSON.parse(a.content || '{}').languages?.[lang]?.title;
            return !!(title && !HAS_ARABIC.test(title));
          } catch { return false; }
        });
        rows = rows.map(a => {
          try {
            const content = JSON.parse(a.content || '{}');
            const localTitle = content.languages?.[lang]?.title;
            const localIntro = content.languages?.[lang]?.intro || '';
            if (!localTitle || HAS_ARABIC.test(localTitle)) return null;
            const patchedContent = JSON.stringify({
              ...content,
              intro: localIntro || content.languages?.[lang]?.intro || '',
            });
            return { ...a, title: localTitle, content: patchedContent };
          } catch { return null; }
        }).filter(Boolean);
      }

      if (order.startsWith('views')) {
        rows = [...rows].sort((a, b) => (b.views || 0) - (a.views || 0));
      }

      const total = rows.length;
      const slice = rows.slice(offset, offset + limit);
      const rangeHeader = slice.length === 0
        ? `*/${total}`
        : `${offset}-${offset + slice.length - 1}/${total}`;

      const body = JSON.stringify(slice);
      console.log(`[perf] /api/articles/list lang=${lang} offset=${offset} limit=${limit} → ${Date.now()-t0}ms`);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=5, stale-while-revalidate=30',
        'Vary': 'Accept-Language',
        'Content-Range': rangeHeader,
        'X-Total-Count': String(total),
        'Access-Control-Expose-Headers': 'Content-Range, X-Total-Count',
      });
      res.end(body);
    } catch (e) {
      res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── Bulk Admin API ─────────────────────────────────────────────────────────
  if (urlPath.startsWith('/api/bulk-admin/')) {
    req.app = { refreshSeoFromSupabase, submitIndexNow, submitGoogleIndexingAPI, articleUrlsForIndexNow, seoDataCache, SITE_URL, INDEXNOW_KEY };
    return bulkAdmin.handle(req, res);
  }

  // ── Public cron trigger (secret-protected, no session) ─────────────────────
  if (urlPath.startsWith('/api/cron/')) {
    req.app = { refreshSeoFromSupabase, submitIndexNow, submitGoogleIndexingAPI, articleUrlsForIndexNow, seoDataCache, SITE_URL, INDEXNOW_KEY };
    return bulkAdmin.handle(req, res);
  }

  // ── Admin operations that bypass Supabase RLS (delete/update articles) ─────
  // Auth happens inside via the user's Supabase access_token.
  if (urlPath.startsWith('/api/admin/')) {
    req.app = { refreshSeoFromSupabase, submitIndexNow, submitGoogleIndexingAPI, articleUrlsForIndexNow, seoDataCache, SITE_URL, INDEXNOW_KEY };
    return bulkAdmin.handle(req, res);
  }

  // ── SEO Webhook endpoint ────────────────────────────────────────────────────
  if (urlPath === '/api/seo-webhook' && req.method === 'POST') {
    handleSeoWebhook(req, res);
    return;
  }

  // ── Article keywords API (for client-side navigation) ────────────────────
  // ── All-keywords JS file (cached, ~300 articles keywords for client-side SEO) ─
  if (urlPath === '/api/all-keywords.js') {
    if (!global._allKeywordsCache) {
      const map = Object.fromEntries(
        Object.entries(seoDataCache).map(([slug, a]) => [slug, a.keywords])
      );
      const js = `window.__DALILEK_ALL_KEYWORDS__=${safeJsonStringify(map)};`;
      global._allKeywordsCache = {
        raw: Buffer.from(js, 'utf-8'),
        br: zlib.brotliCompressSync(Buffer.from(js, 'utf-8'), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } }),
        gz: zlib.gzipSync(Buffer.from(js, 'utf-8')),
      };
    }
    const ae = req.headers['accept-encoding'] || '';
    const hdrs = { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=300, stale-while-revalidate=60', 'Vary': 'Accept-Encoding' };
    if (/\bbr\b/.test(ae)) {
      res.writeHead(200, { ...hdrs, 'Content-Encoding': 'br' }); res.end(global._allKeywordsCache.br);
    } else if (/\bgzip\b/.test(ae)) {
      res.writeHead(200, { ...hdrs, 'Content-Encoding': 'gzip' }); res.end(global._allKeywordsCache.gz);
    } else {
      res.writeHead(200, hdrs); res.end(global._allKeywordsCache.raw);
    }
    return;
  }

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
              const { buildMultilingualKeywords, buildMultilingualDescription } = require('./seo-generator.js');
              const kw = buildMultilingualKeywords(rows[0]);
              const desc = buildMultilingualDescription(rows[0]);
              seoDataCache[slug] = { id: rows[0].id, title: rows[0].title, category: rows[0].category, keywords: kw, description: desc };
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

  // ── Article Rating API (GET/POST /api/rate) ────────────────────────────────
  if (urlPath === '/api/rate' && req.method === 'GET') {
    const allowedOrigin = process.env.ALLOWED_ORIGIN || SITE_URL + '';
    const reqOrigin = req.headers.origin;
    const isOriginAllowed = reqOrigin === allowedOrigin || (reqOrigin && reqOrigin.startsWith('http://localhost:'));
    const corsHeaders = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': isOriginAllowed ? reqOrigin : allowedOrigin,
    };
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    const params = new URLSearchParams(qs);
    const article_id = params.get('article_id');
    if (!article_id) { res.writeHead(400, corsHeaders); res.end(JSON.stringify({ error: 'article_id required' })); return; }
    const RATINGS_FILE = path.join(CACHE_DIR, 'ratings.json');
    try {
      const ratings = JSON.parse(fs.readFileSync(RATINGS_FILE, 'utf-8'));
      const articleRatings = ratings.filter(r => r.article_id === article_id);
      const sum = articleRatings.reduce((a, r) => a + r.rating, 0);
      const avg_rating = articleRatings.length > 0 ? Math.round((sum / articleRatings.length) * 10) / 10 : 0;
      const rating_count = articleRatings.length;
      res.writeHead(200, corsHeaders);
      res.end(JSON.stringify({ avg_rating, rating_count }));
    } catch { res.writeHead(200, corsHeaders); res.end(JSON.stringify({ avg_rating: 0, rating_count: 0 })); }
    return;
  }
  if (urlPath === '/api/rate' && req.method === 'POST') {
    const allowedOrigin = process.env.ALLOWED_ORIGIN || SITE_URL + '';
    const reqOrigin = req.headers.origin;
    const isOriginAllowed = reqOrigin === allowedOrigin || (reqOrigin && reqOrigin.startsWith('http://localhost:'));
    const corsHeaders = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': isOriginAllowed ? reqOrigin : allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders); res.end(); return; }
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { article_id, rating, session_id } = JSON.parse(body);
        if (!article_id || !rating || !session_id || rating < 1 || rating > 5) {
          res.writeHead(400, corsHeaders);
          res.end(JSON.stringify({ error: 'Invalid rating data' }));
          return;
        }
        const RATINGS_FILE = path.join(CACHE_DIR, 'ratings.json');
        let ratings = [];
        try { ratings = JSON.parse(fs.readFileSync(RATINGS_FILE, 'utf-8')); } catch {}
        const existing = ratings.findIndex(r => r.article_id === article_id && r.session_id === session_id);
        if (existing >= 0) {
          ratings[existing].rating = rating;
        } else {
          ratings.push({ article_id, session_id, rating, created_at: new Date().toISOString() });
        }
        fs.writeFileSync(RATINGS_FILE, JSON.stringify(ratings));
        const articleRatings = ratings.filter(r => r.article_id === article_id);
        const sum = articleRatings.reduce((a, r) => a + r.rating, 0);
        const avg_rating = articleRatings.length > 0 ? Math.round((sum / articleRatings.length) * 10) / 10 : 0;
        const rating_count = articleRatings.length;
        const result = existing >= 0
          ? { avg_rating, rating_count, updated: true }
          : { avg_rating, rating_count, updated: false };
        // Also update Supabase articles table
        try {
          const host = SUPABASE_URL.replace('https://', '').split('/')[0];
          const patchOpts = {
            hostname: host,
            path: '/rest/v1/articles?id=eq.' + encodeURIComponent(article_id),
            method: 'PATCH',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          };
          const patchReq = https.request(patchOpts);
          patchReq.write(JSON.stringify({ avg_rating, rating_count }));
          patchReq.end();
        } catch {}
        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, corsHeaders);
        res.end(JSON.stringify({ error: 'Server error' }));
      }
    });
    return;
  }

  // ── Dynamic sitemap-index.xml ───────────────────────────────────────────────
  if (urlPath === '/sitemap-index.xml') {
    const today = new Date().toISOString().split('T')[0];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${SITE_URL}/sitemap.xml</loc>
    <lastmod>${(article.created_at || new Date().toISOString()).split('T')[0]}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITE_URL}/sitemap-articles.xml</loc>
    <lastmod>${(article.created_at || new Date().toISOString()).split('T')[0]}</lastmod>
  </sitemap>
</sitemapindex>`;
    res.writeHead(200, {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    });
    res.end(xml);
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

  // ── Dynamic master sitemap.xml (fresh lastmod, all static + lang pages) ────
  if (urlPath === '/sitemap.xml') {
    const xml = generateMasterSitemapXml();
    res.writeHead(200, {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    });
    res.end(xml);
    return;
  }

  // ── Dynamic per-language sitemaps (sitemap-ar.xml, sitemap-en.xml, …) ──────
  {
    const m = urlPath.match(/^\/sitemap-(ar|en|fr|es)\.xml$/);
    if (m) {
      const xml = generateLangSitemapXml(m[1]);
      res.writeHead(200, {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      });
      res.end(xml);
      return;
    }
  }

  // ── IndexNow ownership verification key ─────────────────────────────────────
  if (INDEXNOW_KEY && urlPath === `/${INDEXNOW_KEY}.txt`) {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(INDEXNOW_KEY);
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

  if (effectivePath.includes('/http:/') || effectivePath.includes('/https:/') || effectivePath.includes('//')) {
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(effectivePath).toLowerCase();
  
  // SECURE PATH TRAVERSAL FIX
  const resolvedPath = path.normalize(path.join(ROOT, effectivePath));
  if (!resolvedPath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  // ── Static assets ───────────────────────────────────────────────────────────
  const isAssetOrBanner = effectivePath.startsWith('/assets/') || effectivePath.startsWith('/banners/');
  const isPublicRootFile = ['/favicon.svg', '/logo.png', '/opengraph.jpg', '/robots.txt', '/seo-data.json', '/admin-sidebar-injector.js'].includes(effectivePath);
  
  if (ext && ext !== '.html' && fs.existsSync(resolvedPath) && !fs.statSync(resolvedPath).isDirectory()) {
    if (!isAssetOrBanner && !isPublicRootFile && !effectivePath.endsWith('.xml')) {
        // Strict allowlist for source code disclosure protection
        res.writeHead(403); res.end('Forbidden: Not an asset'); return;
    }
    const ct = mimeTypes[ext] || 'application/octet-stream';
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const isCompressible = ct.startsWith('text/') || ct.startsWith('application/javascript') || ct.startsWith('application/json') || ext.endsWith('.xml') || ext.endsWith('.svg');

    const isHashedAsset = effectivePath.startsWith('/assets/');
    const cacheHdrs = getCacheHeaders(ext, isHashedAsset);
    // Serve pre-compressed files directly (zero CPU overhead)
    if (isCompressible && /\bbr\b/.test(acceptEncoding) && fs.existsSync(resolvedPath + '.br')) {
      res.writeHead(200, { 'Content-Type': ct, 'Content-Encoding': 'br', 'Vary': 'Accept-Encoding', ...cacheHdrs });
      fs.createReadStream(resolvedPath + '.br').pipe(res);
    } else if (isCompressible && /\bgzip\b/.test(acceptEncoding) && fs.existsSync(resolvedPath + '.gz')) {
      res.writeHead(200, { 'Content-Type': ct, 'Content-Encoding': 'gzip', 'Vary': 'Accept-Encoding', ...cacheHdrs });
      fs.createReadStream(resolvedPath + '.gz').pipe(res);
    } else if (isCompressible && /\bbr\b/.test(acceptEncoding)) {
      res.writeHead(200, { 'Content-Type': ct, 'Content-Encoding': 'br', 'Vary': 'Accept-Encoding', ...cacheHdrs });
      fs.createReadStream(resolvedPath).pipe(zlib.createBrotliCompress({ params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } })).pipe(res);
    } else if (isCompressible && /\bgzip\b/.test(acceptEncoding)) {
      res.writeHead(200, { 'Content-Type': ct, 'Content-Encoding': 'gzip', 'Vary': 'Accept-Encoding', ...cacheHdrs });
      fs.createReadStream(resolvedPath).pipe(zlib.createGzip()).pipe(res);
    } else {
      fs.readFile(resolvedPath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not Found'); return; }
        res.writeHead(200, { 'Content-Type': ct, ...cacheHdrs });
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
  } else if (articleSlug) {
    html = injectPageMeta(baseHtml, lang);
  } else {
    html = injectPageMeta(baseHtml, lang);
  }

  html = injectCanonicalAndHreflang(html, effectivePath);

  // Load allKeywords via external cacheable script instead of inlining 546KB into every HTML page
  html = html.replace('</head>', '<script src="/api/all-keywords.js"></script></head>');

  // Detect bot/crawler early (used both for speed injection guard and bot rendering below)
  const userAgent = req.headers['user-agent'] || '';
  const isBot = isCrawlerBot(userAgent);

  // ── Speed + Animation injection ─────────────────────────────────────────────
  // 1. Fetch interceptor: routes Supabase article-list calls → /api/articles/list
  //    (server-side slim cache — payload ~95% smaller, no Supabase round-trip)
  // 2. Staggered fade-up animation for article cards as they appear in the DOM
  if (!isBot) {
    const SB_NEW_HOST = (SUPABASE_URL || '').replace('https://', '').split('/')[0].replace(/['"\\\\]/g, '');
    const SB_OLD_HOST = (process.env.OLD_SUPABASE_URL || 'https://pbebygpwujbtlwuhatmm.supabase.co').replace('https://', '').split('/')[0].replace(/['"\\]/g, '');
    const SB_NEW_KEY = (SUPABASE_KEY || '').replace(/['"\\\\]/g, '');
    const SPEED_ANIM = `<style>
@keyframes _dlk_fu{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
.dlk-au{animation:_dlk_fu 0.45s cubic-bezier(0.22,1,0.36,1) both;animation-delay:var(--dlk-d,0ms)}
/* Fix: prevent read-time badge text from wrapping onto two lines */
.text-\\[10px\\].font-medium,.text-xs.font-medium.bg-primary\\/10{white-space:nowrap!important;flex-shrink:0!important;margin-inline-end:8px!important}
/* Fix: truncate article card descriptions to 3 lines with ellipsis */
[class*="bg-card"][class*="overflow-hidden"] p.text-sm.text-muted-foreground.leading-relaxed{overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;max-height:none}
/* Hide developer badge in footer */
#footer a[href*="mohhsg.vercel.app"]{display:none!important}
</style><script>
(function(){
/* ── lang constants (shared by interceptor + URL sync) ── */
var LANGS=['ar','en','fr','es'];
/* Capture the NATIVE pushState before React Router patches it.
   React Router v6 monkey-patches history.pushState to dispatch events;
   using the original avoids triggering a re-route to /es/ (which has no
   React Router route defined) while still updating the address bar. */
var _nativePS=history.pushState.bind(history);
/* ── URL ↔ lang sync: when React calls setLang it updates html[lang];
   we mirror that into the address bar via the unpatched pushState.   ──*/
(function(){
  var _prev=document.documentElement.lang;
  new MutationObserver(function(){
    var nl=document.documentElement.lang;
    if(!nl||nl===_prev||LANGS.indexOf(nl)<0)return;
    _prev=nl;
    var segs=window.location.pathname.split('/');
    var found=false;
    for(var i=0;i<segs.length;i++){if(LANGS.indexOf(segs[i])>=0){segs[i]=nl;found=true;break;}}
    if(!found)segs.splice(1,0,nl);
    var np=segs.join('/');
    if(window.location.pathname!==np)_nativePS(null,'',np);
  }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
})();
/* ── fetch interceptor ── */
var OH='${SB_OLD_HOST}', NH='${SB_NEW_HOST}', NK='${SB_NEW_KEY}', _f=window.fetch.bind(window);
window.fetch=function(inp,init){
  var url=typeof inp==='string'?inp:(inp&&inp.url)||'';
  var method=(init&&init.method)||'GET';
  
  var isArticles = url.indexOf('/rest/v1/articles')>-1 && (url.indexOf(OH)>-1 || url.indexOf(NH)>-1);

  /* ── category-counts intercept: yI() calls .select("category") with no filters.
     Route to /api/categories/counts which returns the full dataset so card badges
     show the real article count instead of a 20-row slice. ── */
  if(method==='GET'&&isArticles
     &&url.indexOf('select=category')>-1
     &&url.indexOf('slug=eq')===-1&&url.indexOf('id=eq')===-1&&url.indexOf('ilike')===-1){
    return _f('/api/categories/counts',{headers:{'Accept':'application/json'}})
           .catch(function(){return _f(inp,init);});
  }
  /* ── single-article-by-slug intercept: patch in real translated keywords/description.
     The DB's seo_keywords_multilingual column is empty, so the React bundle falls back
     to the raw Arabic seo_keywords on every non-ar page. We fetch the real Supabase row
     as normal, then overlay server-computed translated keywords/description
     (from /api/article-keywords, which runs buildMultilingualKeywords) before handing
     the response back to React. ── */
  if(method==='GET'&&isArticles
     &&url.indexOf('slug=eq')>-1&&url.indexOf('ilike')===-1){
    var slugMatch=url.match(/slug=eq\\.([^&]+)/);
    var slugVal=slugMatch?decodeURIComponent(slugMatch[1]):null;
    
    // Rewrite URL and Headers to use NEW Supabase for the underlying fetch
    var newUrl = url.replace(OH, NH).replace(/select=[^&]+/, 'select=*');
    var newHeaders = (init&&init.headers)?new Headers(init.headers):new Headers();
    if(newHeaders.has('apikey')) newHeaders.set('apikey', NK);
    if(newHeaders.has('Authorization')) newHeaders.set('Authorization', 'Bearer ' + NK);
    
    return _f(newUrl, { method: 'GET', headers: newHeaders }).then(function(resp){
      if(!slugVal||!resp.ok)return resp;
      return resp.clone().json().then(function(body){
        /* body can be an array (default select) OR a single object
           (.single()/.maybeSingle() sets Accept: vnd.pgrst.object+json) */
        var isArr=Array.isArray(body);
        var rows=isArr?body:[body];
        if(!rows.length||!rows[0])return resp;
        return _f('/api/article-keywords?slug='+encodeURIComponent(slugVal),{headers:{'Accept':'application/json'}})
          .then(function(kr){return kr.ok?kr.json():null;})
          .then(function(kw){
            if(kw&&typeof kw==='object'){
              rows=rows.map(function(r){r.seo_keywords_multilingual=kw;return r;});
            }
            // Fix JSON content type issue for the frontend (it expects a string to parse)
            rows = rows.map(function(r) {
              if (r.content && typeof r.content === 'object') {
                r.content = JSON.stringify(r.content);
              }
              return r;
            });
            var outBody=isArr?rows:rows[0];
            return new Response(JSON.stringify(outBody),{status:200,headers:resp.headers});
          })
          .catch(function(){return resp;});
      }).catch(function(){return resp;});
    }).catch(function(){return _f(inp,init);});
  }
  if(method==='GET'&&isArticles
     &&url.indexOf('slug=eq')===-1&&url.indexOf('id=eq')===-1
     &&url.indexOf('ilike')===-1){
    try{
      var u=new URL(url),
          limit=u.searchParams.get('limit')||'20',
          order=u.searchParams.get('order')||'created_at.desc',
          after=(u.searchParams.get('created_at')||'').replace(/^gte?\\./,''),
          catRaw=u.searchParams.get('category')||'',
          category=catRaw.replace(/^eq\\./,'');
      /* ── Pagination: supabase-js v2 .range(from,to) sets offset= and limit= in the URL.
         Older versions used a Range header as fallback. Read both. ── */
      var offset=0;
      /* 1. URL params (supabase-js v2 primary path) */
      var urlOffset=u.searchParams.get('offset');
      if(urlOffset!==null&&urlOffset!==''){offset=parseInt(urlOffset,10)||0;}
      else{
        /* 2. Range header fallback (older supabase-js / manual callers) */
        try{
          var hdrs=(init&&init.headers)||(inp&&inp.headers)||{};
          var rawRange=(typeof hdrs.get==='function'?hdrs.get('Range'):hdrs['Range']||hdrs['range'])||'';
          var rm=rawRange.match(/^(\d+)-(\d+)$/);
          if(rm){offset=parseInt(rm[1],10)||0;limit=String(parseInt(rm[2],10)-parseInt(rm[1],10)+1);}
        }catch(e){}
      }
      /* Lang priority:
         1. html[lang] set by React (already correct after setLang fires)
         2. URL path segment (correct on first load; server sets html[lang] to match)
         3. localStorage fallback
         4. default ar
         Scanning all path segments skips any base-path prefix (e.g. /m-njhku/). */
      var docLang=document.documentElement.lang;
      var pp=window.location.pathname.split('/').filter(function(s){return LANGS.indexOf(s)>=0;})[0]||'';
      var stored='';try{stored=localStorage.getItem('dalilek-lang')||'';}catch(e){}
      var lang=(LANGS.indexOf(docLang)>=0?docLang:'')||pp||stored||'ar';
      var p='/api/articles/list?lang='+encodeURIComponent(lang)
           +'&limit='+limit
           +'&offset='+offset
           +'&order='+encodeURIComponent(order)
           +(after?'&after='+encodeURIComponent(after):'')
           +(category?'&category='+encodeURIComponent(category):'');
      return _f(p,{headers:{'Accept':'application/json'}})
             .catch(function(){return _f(inp,init);});
    }catch(e){}
  }
  
  /* ── Fallback: ANY other query to articles (e.g. HEAD requests for counts, 
     or fetching by id=eq) MUST go to the NEW database, never the old one! ── */
  if (isArticles) {
    var newUrl = url.replace(OH, NH);
    
    // The OLD database had article_ratings and saved_articles, but the NEW one does not.
    // If the frontend asks for them (e.g. select=*,article_ratings(*)), the NEW DB will crash (400).
    // We strip out all complex relational joins and just fetch the main table columns (*).
    newUrl = newUrl.replace(/select=[^&]+/, 'select=*');
    
    var newHeaders = (init&&init.headers)?new Headers(init.headers):new Headers();
    if(newHeaders.has('apikey')) newHeaders.set('apikey', NK);
    if(newHeaders.has('Authorization')) newHeaders.set('Authorization', 'Bearer ' + NK);
    
    var newInit = Object.assign({}, init);
    newInit.headers = newHeaders;
    return _f(newUrl, newInit).then(function(resp){
      if(!resp.ok) return resp;
      // We must stringify content JSON objects because the React frontend expects it as a string
      return resp.clone().json().then(function(body){
        var isArr=Array.isArray(body);
        var rows=isArr?body:[body];
        rows = rows.map(function(r) {
          if (r && r.content && typeof r.content === 'object') r.content = JSON.stringify(r.content);
          return r;
        });
        var outBody=isArr?rows:rows[0];
        return new Response(JSON.stringify(outBody),{status:200,headers:resp.headers});
      }).catch(function(){return resp;});
    });
  }

  return _f(inp,init);
};
/* ── card fade-up animation ── */
var seen=new WeakSet(),qi=0;
function animCards(reset){
  if(reset)qi=0;
  /* Target article cards in #latest section only (avoids Framer Motion hero conflicts) */
  document.querySelectorAll(
    '#latest [class*="bg-card"][class*="overflow-hidden"]'
  ).forEach(function(el){
    if(seen.has(el))return;
    seen.add(el);
    /* cap stagger at 8 cards (640ms max) so late loads feel instant */
    el.style.setProperty('--dlk-d',(qi%8)*80+'ms');
    el.classList.add('dlk-au');
    qi++;
  });
}
var obs=new MutationObserver(function(){setTimeout(function(){animCards(true);},30);});
document.addEventListener('DOMContentLoaded',function(){
  obs.observe(document.body,{childList:true,subtree:true});
  animCards();
});
/* ── footer brand-name localization: the compiled bundle hardcodes the
   Arabic "دليلك" wordmark inside <footer id="footer">, ignoring the
   active language. Patch it to the Latin "Dalilek" on en/fr/es. ── */
var FOOTER_NAMES={ar:'دليلك',en:'Dalilek',fr:'Dalilek',es:'Dalilek'};
function fixFooterBrand(){
  var footer=document.getElementById('footer');
  if(!footer)return;
  var lang=document.documentElement.lang;
  var name=FOOTER_NAMES[LANGS.indexOf(lang)>=0?lang:'ar'];
  footer.querySelectorAll('img[alt="دليلك"]').forEach(function(img){img.alt=name;});
  footer.querySelectorAll('span,p').forEach(function(el){
    if(el.children.length===0&&el.textContent.trim()==='دليلك'&&el.textContent.trim()!==name){
      el.textContent=name;
    }
  });
}
/* ── category-label localization: the article's "category" field is stored
   in the DB only in Arabic, so category badges/chips always render Arabic
   text regardless of the active language. Translate known category names
   to the active language via the same map the bundle itself ships. ── */
var CATEGORY_MAP={
"أبحاث ودراسات":{en:"Research",fr:"Recherche",es:"Investigación"},
"أحياء وجينات":{en:"Biology",fr:"Biologie",es:"Biología"},
"أسلوب حياة":{en:"Lifestyle",fr:"Style de vie",es:"Estilo de vida"},
"ألعاب إلكترونية":{en:"Gaming",fr:"Jeux Vidéo",es:"Videojuegos"},
"أمن وخصوصية":{en:"Security",fr:"Sécurité",es:"Seguridad"},
"إعلام وصحافة":{en:"Media",fr:"Médias",es:"Medios"},
"إنتاجية ووقت":{en:"Productivity",fr:"Productivité",es:"Productividad"},
"استثمار ومال":{en:"Investing",fr:"Investissement",es:"Inversión"},
"اقتصاد كلي":{en:"Macro Economy",fr:"Macro-économie",es:"Macroeconomía"},
"الفضاء والكون":{en:"Space",fr:"Espace",es:"Espacio"},
"برمجة وتطوير":{en:"Programming",fr:"Programmation",es:"Programación"},
"بيئة واستدامة":{en:"Environment",fr:"Environnement",es:"Medio Ambiente"},
"تاريخ وحضارات":{en:"History",fr:"Histoire",es:"Historia"},
"تربية وأطفال":{en:"Parenting",fr:"Parentalité",es:"Crianza"},
"تسويق وإعلان":{en:"Marketing",fr:"Marketing",es:"Marketing"},
"تصميم جرافيك":{en:"Graphic Design",fr:"Design Graphique",es:"Diseño Gráfico"},
"تصوير فوتوغرافي":{en:"Photography",fr:"Photographie",es:"Fotografía"},
"تطوير الذات":{en:"Self Development",fr:"Développement Personnel",es:"Desarrollo Personal"},
"تعلم اللغات":{en:"Languages",fr:"Langues",es:"Idiomas"},
"تعليم وأكاديميا":{en:"Education",fr:"Éducation",es:"Educación"},
"تغذية وغذاء":{en:"Nutrition",fr:"Nutrition",es:"Nutrición"},
"تقنية طبية":{en:"Medical Technology",fr:"Technologie Médicale",es:"Tecnología Médica"},
"تكنولوجيا":{en:"Technology",fr:"Technologie",es:"Tecnología"},
"ثقافة عامة":{en:"Culture",fr:"Culture",es:"Cultura"},
"جغرافيا وخرائط":{en:"Geography",fr:"Géographie",es:"Geografía"},
"جيوسياسة":{en:"Geopolitics",fr:"Géopolitique",es:"Geopolítica"},
"حيوانات أليفة":{en:"Pets",fr:"Animaux de compagnie",es:"Mascotas"},
"دين وروحانيات":{en:"Religion",fr:"Religion",es:"Religión"},
"ذكاء اصطناعي":{en:"Artificial Intelligence",fr:"Intelligence Artificielle",es:"Inteligencia Artificial"},
"رياضة":{en:"Sports",fr:"Sport",es:"Deportes"},
"زراعة وغذاء":{en:"Agriculture",fr:"Agriculture",es:"Agricultura"},
"سفر وسياحة":{en:"Travel",fr:"Voyage",es:"Viajes"},
"سيارات ومركبات":{en:"Automotive",fr:"Automobile",es:"Automovilismo"},
"سياسة":{en:"Politics",fr:"Politique",es:"Política"},
"سينما ومسرح":{en:"Cinema",fr:"Cinéma",es:"Cine"},
"شركات ناشئة":{en:"Startups",fr:"Startups",es:"Startups"},
"صحة المرأة":{en:"Women's Health",fr:"Santé Féminine",es:"Salud Femenina"},
"صحة نفسية":{en:"Mental Health",fr:"Santé Mentale",es:"Salud Mental"},
"صحة وطب":{en:"Health",fr:"Santé",es:"Salud"},
"طاقة شمسية":{en:"Solar Energy",fr:"Énergie Solaire",es:"Energía Solar"},
"طبخ ومطبخ":{en:"Cooking",fr:"Cuisine",es:"Cocina"},
"طبيعة وحياة برية":{en:"Nature",fr:"Nature",es:"Naturaleza"},
"عقارات وإسكان":{en:"Real Estate",fr:"Immobilier",es:"Bienes Raíces"},
"علاقات دولية":{en:"International Relations",fr:"Relations Internationales",es:"Relaciones Internacionales"},
"علوم وطبيعة":{en:"Science",fr:"Sciences",es:"Ciencias"},
"فلسفة وفكر":{en:"Philosophy",fr:"Philosophie",es:"Filosofía"},
"فنون وأدب":{en:"Arts",fr:"Arts",es:"Arte"},
"قانون وحقوق":{en:"Law",fr:"Droit",es:"Derecho"},
"كتابة وإبداع":{en:"Writing",fr:"Écriture",es:"Escritura"},
"كتب ومراجعات":{en:"Books",fr:"Livres",es:"Libros"},
"لياقة بدنية":{en:"Fitness",fr:"Fitness",es:"Fitness"},
"مال وأعمال":{en:"Business",fr:"Business",es:"Negocios"},
"مجتمع وأسرة":{en:"Society",fr:"Société",es:"Sociedad"},
"مجوهرات وأناقة":{en:"Jewelry",fr:"Bijoux",es:"Joyería"},
"محيطات وبحار":{en:"Ocean",fr:"Océans",es:"Océanos"},
"مغامرة وطبيعة":{en:"Adventure",fr:"Aventure",es:"Aventura"},
"موسيقى وفن":{en:"Music",fr:"Musique",es:"Música"},
"موضة وأزياء":{en:"Fashion",fr:"Mode",es:"Moda"}
};
function fixCategoryLabels(){
  var lang=document.documentElement.lang;
  if(lang==='ar'||LANGS.indexOf(lang)<0)return;
  var walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null);
  var node,toFix=[];
  while(node=walker.nextNode()){
    var t=node.nodeValue.trim();
    if(t&&CATEGORY_MAP.hasOwnProperty(t)&&node.nodeValue===t){toFix.push(node);}
  }
  toFix.forEach(function(n){
    var tr=CATEGORY_MAP[n.nodeValue][lang];
    if(tr)n.nodeValue=tr;
  });
}
new MutationObserver(function(){fixFooterBrand();fixCategoryLabels();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
document.addEventListener('DOMContentLoaded',function(){
  fixFooterBrand();
  fixCategoryLabels();
  new MutationObserver(function(){fixFooterBrand();fixCategoryLabels();}).observe(document.body,{childList:true,subtree:true});
});
})();
<\/script>`;
    html = html.replace('</head>', SPEED_ANIM + '</head>');
  }

  // ── Crawler-safe rendering: rich pre-rendered content for bots ──────────────
  // IMPORTANT: Do NOT strip Virtual Router scripts!
  // Google's WRS (Web Rendering Service) executes JavaScript like Chrome.
  // If we strip the Virtual Router, React Router sees /ar/ and has no route → 404.
  // Instead, we KEEP the Virtual Router so WRS can handle URL rewriting,
  // AND we add rich pre-rendered HTML content inside <div id="root"> for
  // Google's initial HTML-only crawl pass (before WRS runs JS).
  // React will replace this pre-rendered content when it mounts.
  if (isBot) {
    let articleContentHTML = '';
    if (articleSlug && seoDataCache[articleSlug]) {
      const rawContent = await fetchArticleContent(articleSlug);
      articleContentHTML = `<div class="article-body" style="margin-top:1em;">${rawContent}</div>`;
    }
    const botContent = generateBotContent(effectivePath, lang, articleSlug, articleContentHTML);
    html = html.replace('<div id="root"></div>', `<div id="root"><div id="bot-seo-content">${botContent}</div></div>`);
  }

  const acceptEncoding = req.headers['accept-encoding'] || '';
  if (/\bbr\b/.test(acceptEncoding)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Encoding': 'br', ...getCacheHeaders('.html') });
    res.end(zlib.brotliCompressSync(Buffer.from(html, 'utf-8'), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } }));
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

// Generous request timeout: an article-generation POST can legitimately take
// 60-120s when retrying through 3 fallback models, so we allow 5 minutes.
// Anything beyond that is almost certainly a stuck socket and should be freed
// to avoid leaking file descriptors / memory.
httpServer.requestTimeout = 5 * 60 * 1000;
httpServer.headersTimeout = 65 * 1000;
httpServer.keepAliveTimeout = 60 * 1000;

httpServer.listen(PORT, HOST, () => {
  if (!httpsServer) startRoutine('HTTP', HOST, PORT);
});

if (httpsServer) {
  httpsServer.listen(HTTPS_PORT, HOST, () => startRoutine('HTTPS', HOST, HTTPS_PORT));
}
}

module.exports = appHandler; // Export for Vercel Serverless
