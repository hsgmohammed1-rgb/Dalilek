// bulk-admin.js — AI-powered bulk article generator for Dalilek
// Routes mounted under /api/bulk-admin/*
const https = require('https');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
// IMPORTANT: SERVICE_ROLE_API is the secret name used in this project; keep
// the legacy names too so the module works on either configuration.
const SUPABASE_KEY = process.env.SERVICE_ROLE_API
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_KEY
  || process.env.ANON_PUBLIC;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const ALLOWED_EMAIL = (process.env.BULK_ADMIN_EMAIL || 'cpshzt@gmail.com').toLowerCase();


const ALLOWED_CATEGORIES = [
  'تكنولوجيا', 'ذكاء اصطناعي', 'برمجة وتطوير', 'الفضاء والكون', 'علوم وطبيعة', 'أحياء وجينات',
  'أمن وخصوصية', 'تقنية طبية', 'صحة وطب', 'تغذية وغذاء', 'صحة نفسية', 'لياقة بدنية', 'صحة المرأة',
  'مال وأعمال', 'استثمار ومال', 'شركات ناشئة', 'تسويق وإعلان', 'عقارات وإسكان', 'اقتصاد كلي',
  'تطوير الذات', 'تعليم وأكاديميا', 'تعلم اللغات', 'إنتاجية ووقت',
  'فنون وأدب', 'ثقافة عامة', 'موسيقى وفن', 'سينما ومسرح', 'تصوير فوتوغرافي', 'كتب ومراجعات', 'تصميم جرافيك',
  'رياضة', 'سفر وسياحة', 'مغامرة وطبيعة', 'ألعاب إلكترونية',
  'بيئة واستدامة', 'طبيعة وحياة برية', 'محيطات وبحار', 'قانون وحقوق', 'مجتمع وأسرة', 'زراعة وغذاء',
  'تاريخ وحضارات', 'فلسفة وفكر', 'أبحاث ودراسات', 'إعلام وصحافة', 'جغرافيا وخرائط',
  'دين وروحانيات', 'سياسة', 'علاقات دولية', 'جيوسياسة',
  'أسلوب حياة', 'موضة وأزياء', 'تربية وأطفال', 'حيوانات أليفة', 'طاقة شمسية', 'سيارات ومركبات',
  'مجوهرات وأناقة', 'كتابة وإبداع', 'طبخ ومطبخ',
];

const CATEGORY_ALIASES = {
  'صحة': 'صحة وطب', 'طب': 'صحة وطب',
  'تطوير ذات': 'تطوير الذات', 'تنمية بشرية': 'تطوير الذات', 'تطور الذات': 'تطوير الذات',
  'علوم': 'علوم وطبيعة', 'طبيعة': 'علوم وطبيعة',
  'سفر': 'سفر وسياحة', 'سياحة': 'سفر وسياحة',
  'ثقافة': 'ثقافة عامة',
  'تعليم': 'تعليم وأكاديميا', 'تربية': 'تربية وأطفال', 'تربية وطفولة': 'تربية وأطفال', 'طفولة': 'تربية وأطفال', 'تربية الأطفال': 'تربية وأطفال',
  'طعام': 'طبخ ومطبخ', 'طبخ': 'طبخ ومطبخ',
  'ترفيه': 'سينما ومسرح', 'سينما': 'سينما ومسرح',
  'سوشيال ميديا': 'إعلام وصحافة', 'إعلام': 'إعلام وصحافة',
  'علم اجتماع': 'مجتمع وأسرة', 'مجتمع': 'مجتمع وأسرة', 'أسرة': 'مجتمع وأسرة',
  'اقتصاد': 'مال وأعمال', 'أعمال': 'مال وأعمال',
  'فن': 'فنون وأدب', 'فنون': 'فنون وأدب',
  'تكنولوجيا طبية': 'تقنية طبية', 'أمن': 'أمن وخصوصية',
  'برمجة': 'برمجة وتطوير', 'ذكاء صناعي': 'ذكاء اصطناعي',
  'فضاء': 'الفضاء والكون', 'بيئة': 'بيئة واستدامة', 'رياضة بدنية': 'لياقة بدنية',
};

function normalizeCategory(cat) {
  const c = String(cat || '').trim();
  if (ALLOWED_CATEGORIES.includes(c)) return c;
  if (CATEGORY_ALIASES[c]) return CATEGORY_ALIASES[c];
  let best = null, bestScore = 0;
  const words = c.split(/\s+/).filter(Boolean);
  for (const allowed of ALLOWED_CATEGORIES) {
    const allowedWords = allowed.split(/\s+/);
    const score = words.filter(w => allowedWords.includes(w)).length || (allowed.includes(c) || c.includes(allowed) ? 1 : 0);
    if (score > bestScore) { bestScore = score; best = allowed; }
  }
  return best || 'ثقافة عامة';
}

const CATEGORY_TO_TEMPLATES = {
  'تكنولوجيا': [1, 16],
  'ذكاء اصطناعي': [1, 16],
  'برمجة وتطوير': [1, 16],
  'أمن وخصوصية': [1, 16],
  'تقنية طبية': [1, 2, 16, 19],
  'الفضاء والكون': [5, 17],
  'علوم وطبيعة': [5, 8, 17],
  'أحياء وجينات': [5, 26],
  'صحة وطب': [2, 19],
  'تغذية وغذاء': [2, 19, 20],
  'صحة نفسية': [2, 12, 19],
  'لياقة بدنية': [2, 7],
  'صحة المرأة': [2, 19, 28],
  'مال وأعمال': [3, 27],
  'استثمار ومال': [3, 27],
  'شركات ناشئة': [3, 27],
  'تسويق وإعلان': [3, 14],
  'اقتصاد كلي': [3, 27],
  'عقارات وإسكان': [3, 21],
  'تصميم جرافيك': [9, 21],
  'تطوير الذات': [12, 14],
  'إنتاجية ووقت': [3, 12],
  'تعليم وأكاديميا': [13],
  'تعلم اللغات': [13],
  'فنون وأدب': [6, 9],
  'ثقافة عامة': [6],
  'موسيقى وفن': [9, 11],
  'سينما ومسرح': [10],
  'تصوير فوتوغرافي': [9, 10],
  'كتابة وإبداع': [6, 9],
  'كتب ومراجعات': [6, 13],
  'رياضة': [7],
  'سفر وسياحة': [4],
  'مغامرة وطبيعة': [4, 8, 26],
  'ألعاب إلكترونية': [23],
  'بيئة واستدامة': [8, 26],
  'طبيعة وحياة برية': [8, 26],
  'محيطات وبحار': [8, 26],
  'طاقة شمسية': [1, 8],
  'زراعة وغذاء': [8, 20, 26],
  'طبخ ومطبخ': [20],
  'قانون وحقوق': [25],
  'مجتمع وأسرة': [6, 30],
  'تربية وأطفال': [30],
  'تاريخ وحضارات': [18, 29],
  'فلسفة وفكر': [22],
  'أبحاث ودراسات': [5, 13],
  'إعلام وصحافة': [15],
  'جغرافيا وخرائط': [4, 18],
  'دين وروحانيات': [12, 22],
  'سياسة': [15],
  'علاقات دولية': [15],
  'جيوسياسة': [15],
  'أسلوب حياة': [14, 28],
  'موضة وأزياء': [14, 28],
  'مجوهرات وأناقة': [14, 28],
  'حيوانات أليفة': [14, 26],
  'سيارات ومركبات': [24]
};

function getTemplateForCategory(category) {
  const norm = normalizeCategory(category);
  const validTemplates = CATEGORY_TO_TEMPLATES[norm];
  if (validTemplates && validTemplates.length > 0) {
    return validTemplates[Math.floor(Math.random() * validTemplates.length)];
  }
  return Math.floor(Math.random() * 30) + 1;
}

// ── Groq Key Pool — loaded from environment variables ─────────────────────────
// Set GROQ_KEY_POOL as a comma-separated list of keys, e.g.:
//   GROQ_KEY_POOL=gsk_key1,gsk_key2,gsk_key3
// Or set a single key via GROQ_API_KEY.
// Do NOT hardcode API keys in source code.
const GROQ_KEY_POOL = (() => {
  const poolEnv = process.env.GROQ_KEY_POOL;
  if (poolEnv) return poolEnv.split(',').map(k => k.trim()).filter(Boolean);
  const single = process.env.GROQ_API_KEY;
  if (single) return [single.trim()];
  return [];
})();

// Per-key health state (resets on process restart)
const POOL_HEALTH = GROQ_KEY_POOL.map((key, idx) => ({
  key, idx, status: 'ok', failCount: 0, successCount: 0,
  inUse: 0, cooldownUntil: 0, lastError: null, lastUsed: 0, articlesGenerated: 0,
}));

function pickPoolKey() {
  const now = Date.now();
  const avail = POOL_HEALTH.filter(h => {
    if (h.status === 'failed') return false;
    if (h.status === 'limited' && h.cooldownUntil > now) return false;
    return true;
  });
  if (!avail.length) {
    // Reset all limited (cooldown may have expired) and retry
    POOL_HEALTH.filter(h => h.status === 'limited').forEach(h => { h.status = 'ok'; h.cooldownUntil = 0; });
    return POOL_HEALTH.find(h => h.status !== 'failed') || null;
  }
  // Load-balance: fewest in-use first, then fewest total articles generated
  return avail.sort((a, b) => a.inUse - b.inUse || a.articlesGenerated - b.articlesGenerated)[0];
}

function poolKeyStart(key) {
  const h = POOL_HEALTH.find(k => k.key === key);
  if (h) { h.inUse++; h.lastUsed = Date.now(); }
}

function poolKeyDone(key, success, statusCode, errMsg) {
  const h = POOL_HEALTH.find(k => k.key === key);
  if (!h) return;
  h.inUse = Math.max(0, h.inUse - 1);
  if (success) {
    h.status = 'ok'; h.successCount++; h.failCount = 0;
    h.lastError = null; h.articlesGenerated++;
  } else {
    h.lastError = String(errMsg || '').slice(0, 200); h.failCount++;
    if (statusCode === 401 || statusCode === 403 || /invalid.api.key|unauthorized|expired/i.test(errMsg || '')) {
      h.status = 'failed'; // permanent — bad key
    } else if (statusCode === 402 || /quota|credit|billing/i.test(errMsg || '')) {
      h.status = 'limited'; h.cooldownUntil = Date.now() + 24 * 60 * 60 * 1000; // 24h cooldown for quota
    } else if (statusCode === 429 || /rate.?limit|too many|tpm/i.test(errMsg || '')) {
      h.status = 'limited'; h.cooldownUntil = Date.now() + 65_000; // 65s cooldown for RPM/TPM
    } else if (h.failCount >= 3) {
      h.status = 'failed';
    }
  }
}

// ── Multi-provider model catalog ───────────────────────────────────────────
// Three free-tier providers; each has its own API key + recommended model list.
const PROVIDERS = {
  gemini: {
    label: 'Google Gemini',
    keyHint: 'AIza...',
    keyUrl: 'https://aistudio.google.com/apikey',
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (موصى به)' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (الأقوى)' },
      { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (الأسرع)' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
      { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (احتياطي)' },
    ],
  },
  groq: {
    label: 'Groq',
    keyHint: 'gsk_...',
    keyUrl: 'https://console.groq.com/keys',
    // Groq free tier has a hard 6000 TPM (tokens-per-minute) cap PER MODEL.
    // Models removed: 'moonshotai/kimi-k2-instruct' & 'meta-llama/llama-4-maverick-17b-128e-instruct'
    // (both return 404 — Groq deprecated them).
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile (موصى به)' },
      { id: 'openai/gpt-oss-120b', label: 'OpenAI GPT-OSS 120B (الأقوى)' },
      { id: 'openai/gpt-oss-20b', label: 'OpenAI GPT-OSS 20B (سريع)' },
      { id: 'qwen/qwen3-32b', label: 'Qwen 3 32B (ممتاز للعربي)' },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant (الأسرع)' },
    ],
  },
  openrouter: {
    label: 'OpenRouter',
    keyHint: 'sk-or-v1-...',
    keyUrl: 'https://openrouter.ai/keys',
    models: [
      { id: 'openai/gpt-oss-120b:free', label: 'OpenAI GPT-OSS 120B (الأقوى — موصى به)' },
      { id: 'qwen/qwen3-next-80b-a3b-instruct:free', label: 'Qwen 3 Next 80B (ممتاز للعربي)' },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B' },
      { id: 'z-ai/glm-4.5-air:free', label: 'GLM 4.5 Air' },
      { id: 'google/gemma-3-27b-it:free', label: 'Google Gemma 3 27B' },
      { id: 'openai/gpt-oss-20b:free', label: 'OpenAI GPT-OSS 20B (سريع)' },
      { id: 'nvidia/nemotron-nano-9b-v2:free', label: 'Nvidia Nemotron Nano 9B (سريع)' },
    ],
  },
};

// Backwards-compat alias (older code paths read FREE_MODELS as a flat list).
const FREE_MODELS = PROVIDERS.groq.models;

// Speed profiles — control prompt depth, output budget, and concurrency.
// recommendedModel is keyed by provider so we can suggest the right model when the user switches.
// NOTE on concurrency: each article = 1 main AI call + 3 translation calls
// (en/fr/es). Free tiers throttle hard (Gemini = 10 RPM, Groq = 6000 TPM).
// We keep concurrency intentionally low so a 20-article batch doesn't
// instantly burn through the per-minute quota and reject 70%+ of articles.
const SPEED_PROFILES = {
  fast: {
    label: '⚡ سريع جداً',
    description: 'مقال ضخم (6-8 أقسام، 300-400 كلمة للقسم)، SEO كامل (7 مهارات)، 4 لغات. محسّن لتفادي حظر الشبكة.',
    recommendedModel: { gemini: 'gemini-2.5-flash-lite', groq: 'llama-3.1-8b-instant', openrouter: 'openai/gpt-oss-20b:free' },
    maxTokens: 8000,
    minSections: 6, maxSections: 8,
    sectionLength: '300-400 كلمة',
    concurrency: 3,
    skillsCount: 7,
    statsCount: 5,
  },
  medium: {
    label: '⚖️ متوسط',
    description: '4-5 أقسام متوازنة، مقال واحد في كل مرة لتوازن الجودة والسرعة',
    recommendedModel: { gemini: 'gemini-2.5-flash', groq: 'llama-3.3-70b-versatile', openrouter: 'openai/gpt-oss-120b:free' },
    maxTokens: 5500,
    minSections: 4, maxSections: 5,
    sectionLength: '150-220 كلمة',
    concurrency: 1,
    skillsCount: 4,
    statsCount: 3,
  },
  thorough: {
    label: '💎 الأفضل',
    description: '5-6 أقسام معمّقة، مقال واحد في كل مرة للجودة القصوى',
    recommendedModel: { gemini: 'gemini-2.5-pro', groq: 'openai/gpt-oss-120b', openrouter: 'openai/gpt-oss-120b:free' },
    maxTokens: 6000,
    minSections: 5, maxSections: 6,
    sectionLength: '200-280 كلمة',
    concurrency: 1,
    skillsCount: 5,
    statsCount: 4,
    timeoutMs: 300000,
    useJsonMode: true,
  },
};

const sessions = new Map();
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const path = require('path');
const fs = require('fs');

const isVercel = !!process.env.VERCEL;
const tmpDir = isVercel ? '/tmp' : __dirname;
const SESSIONS_FILE = path.join(tmpDir, '.admin-sessions.json');
try {
  const raw = fs.readFileSync(SESSIONS_FILE, 'utf8');
  const obj = JSON.parse(raw);
  for (const [k, v] of Object.entries(obj)) sessions.set(k, v);
} catch (e) { }

function saveSessions() {
  try {
    const obj = Object.fromEntries(sessions.entries());
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(obj));
  } catch (e) { }
}

// ── Server-wide generation semaphore ──
// Cap how many `/api/bulk-admin/generate-one` requests can run *inside* this
// server process at any time. Anything beyond the cap waits in a FIFO queue.
// This is the single most important safeguard against the "20 of 20 failed
// with HTTP 502" symptom: without it, a 20-topic batch + the auto-cron
// firing simultaneously creates 30+ in-flight workflows, blows past the
// container's memory budget, and Replit kills the process. With the cap,
// the worst case is "everything finishes more slowly", not "everything fails".
const GENERATION_SLOTS = parseInt(process.env.BULK_ADMIN_MAX_CONCURRENT, 10) || 10;
let generationActive = 0;
const generationQueue = [];
function acquireGenerationSlot() {
  return new Promise((resolve) => {
    const grant = () => {
      generationActive++;
      let released = false;
      resolve(() => {
        if (released) return;
        released = true;
        generationActive = Math.max(0, generationActive - 1);
        const next = generationQueue.shift();
        if (next) next();
      });
    };
    if (generationActive < GENERATION_SLOTS) grant();
    else generationQueue.push(grant);
  });
}

function newSession(email) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { createdAt: Date.now(), email });
  saveSessions();
  return token;
}

function isAuthed(req) {
  // Authentication disabled per user request since the admin panel is already protected.
  return true;
}

function readBody(req, max = 5 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > max) { req.destroy(); reject(new Error('payload too large')); return; }
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function jsonResponse(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function httpsRequestJson({ hostname, path, method = 'GET', headers = {}, body = null, timeout = 60000 }) {
  return new Promise((resolve, reject) => {
    const opts = { hostname, path, method, headers };
    const req = https.request(opts, (r) => {
      const chunks = [];
      r.on('data', c => chunks.push(c));
      r.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf-8');
        let parsed = null;
        try { parsed = JSON.parse(text); } catch (e) { parsed = null; }
        resolve({ status: r.statusCode, headers: r.headers, body: text, json: parsed });
      });
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => { req.destroy(new Error('timeout')); });
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

// ── Raw text/HTML fetch (follows one redirect) — used for RSS/Jina/Wikipedia ──
function httpsGetText(url, { timeout = 12000, headers = {}, _redirects = 0 } = {}) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch (e) { return reject(new Error('invalid url')); }
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DalilekBot/1.0; +https://dalilek.online)', 'Accept': '*/*', ...headers },
    }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && _redirects < 3) {
        r.resume();
        const next = new URL(r.headers.location, url).toString();
        return resolve(httpsGetText(next, { timeout, headers, _redirects: _redirects + 1 }));
      }
      const chunks = [];
      r.on('data', c => chunks.push(c));
      r.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => req.destroy(new Error('timeout')));
    req.end();
  });
}

function decodeXmlEntities(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .trim();
}

// ── Real trending-topic sources ────────────────────────────────────────────
// Implements the pipeline the user asked for: Google News RSS + major site
// RSS feeds + Wikipedia "most read" trending, merged and de-duplicated, so
// topic discovery is grounded in things that are ACTUALLY happening/trending
// right now instead of the AI inventing topics from memory.
async function fetchRssHeadlines(url, source, limit = 15) {
  try {
    const xml = await httpsGetText(url, { timeout: 10000 });
    const items = [];
    const re = /<item[\s\S]*?<\/item>/g;
    let m;
    while ((m = re.exec(xml)) && items.length < limit) {
      const block = m[0];
      const t = /<title>([\s\S]*?)<\/title>/.exec(block);
      const l = /<link>([\s\S]*?)<\/link>/.exec(block);
      const title = t ? decodeXmlEntities(t[1]) : '';
      if (!title) continue;
      items.push({ title, link: l ? decodeXmlEntities(l[1]) : '', source });
    }
    return items;
  } catch (e) {
    console.warn(`[bulk-admin] RSS fetch failed (${source}):`, e.message);
    return [];
  }
}

async function fetchGoogleNewsTopics(limit = 15) {
  return fetchRssHeadlines('https://news.google.com/rss?hl=ar&gl=EG&ceid=EG:ar', 'google-news', limit);
}

// Category-scoped Google News searches — general front-page RSS skews heavily
// toward politics/sports/breaking news, which rarely fits our encyclopedia
// categories. Searching per-category keeps the seed pool actually usable
// (tech/health/business/science headlines) instead of forcing the model to
// invent topics when nothing on the front page qualifies.
const GOOGLE_NEWS_CATEGORY_QUERIES = [
  { q: 'تكنولوجيا', source: 'google-news-tech' },
  { q: 'صحة', source: 'google-news-health' },
  { q: 'اقتصاد', source: 'google-news-business' },
  { q: 'علوم', source: 'google-news-science' },
  { q: 'تعليم', source: 'google-news-education' },
  { q: 'سياحة وسفر', source: 'google-news-travel' },
];

async function fetchGoogleNewsCategory(q, source, limit = 8) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ar&gl=EG&ceid=EG:ar`;
  const items = await fetchRssHeadlines(url, source, limit + 2);
  // First 1-2 items are often the bare query echo ("<q>" - أخبار Google) —
  // filter those out since they aren't real headlines.
  return items.filter(it => !/^"?.*"?\s*-\s*أخبار Google$/.test(it.title) && it.title !== 'أخبار Google').slice(0, limit);
}

const TRENDING_RSS_FEEDS = [
  { url: 'https://feeds.bbci.co.uk/arabic/rss.xml', source: 'bbc-arabic' },
  { url: 'https://www.aljazeera.net/aljazeerarss/a7c186be-1baa-4bd4-9d80-a84db769f779/73d0e1b4-532f-45ef-b135-a75f0d4b5d90', source: 'aljazeera' },
  { url: 'https://www.aitnews.com/feed/', source: 'aitnews-tech' },
  { url: 'https://arabhardware.net/feed', source: 'arabhardware-tech' },
];

async function fetchWikipediaTrending(limit = 10) {
  try {
    const d = new Date(Date.now() - 24 * 3600 * 1000); // yesterday — "most-read" needs a finalized day
    const y = d.getFullYear(), mo = String(d.getMonth() + 1).padStart(2, '0'), da = String(d.getDate()).padStart(2, '0');
    const text = await httpsGetText(`https://ar.wikipedia.org/api/rest_v1/page/most-read/${y}/${mo}/${da}`, { timeout: 10000 });
    const j = JSON.parse(text);
    const arts = (j && j.items && j.items[0] && j.items[0].articles) || [];
    const blacklist = /الصفحة_الرئيسية|خاص:|بوابة:|ويكيبيديا:|Special:|Main_Page/i;
    return arts
      .filter(a => a && a.article && !blacklist.test(a.article))
      .slice(0, limit)
      .map(a => ({
        title: decodeURIComponent(a.article).replace(/_/g, ' '),
        link: `https://ar.wikipedia.org/wiki/${a.article}`,
        source: 'wikipedia-trending',
      }));
  } catch (e) {
    console.warn('[bulk-admin] Wikipedia trending fetch failed:', e.message);
    return [];
  }
}

// Merge Google News + site RSS feeds + Wikipedia trending, de-duplicated by
// normalized title. This is the single entry point discoverTopics('trending')
// uses to ground itself in real current events.
async function collectTrendingSeeds(limit = 40) {
  const settled = await Promise.allSettled([
    fetchGoogleNewsTopics(15),
    ...GOOGLE_NEWS_CATEGORY_QUERIES.map(c => fetchGoogleNewsCategory(c.q, c.source, 8)),
    ...TRENDING_RSS_FEEDS.map(f => fetchRssHeadlines(f.url, f.source, 12)),
    fetchWikipediaTrending(12),
  ]);
  const all = settled.filter(r => r.status === 'fulfilled').flatMap(r => r.value);
  const seen = new Set();
  const out = [];
  for (const it of all) {
    const key = normalizeArabicTitle(it.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out.slice(0, limit);
}

// ── Real content extraction (Jina AI Reader with raw-HTML fallback) ────────
// Pipeline requested by the user: link -> Jina AI Reader (https://r.jina.ai/URL)
// -> if that fails, fall back to a crude readability pass on the raw HTML
// (meta description, then stripped visible text). This grounds article
// generation in real facts from the source instead of pure AI invention.
async function fetchArticleTextViaJina(url, maxChars = 2500) {
  if (!url) return '';
  try {
    const text = await httpsGetText('https://r.jina.ai/' + url, { timeout: 15000 });
    const cleaned = String(text || '').replace(/\n{3,}/g, '\n\n').trim();
    if (cleaned.length < 80) return '';
    return cleaned.slice(0, maxChars);
  } catch (e) {
    return '';
  }
}

async function fallbackExtractText(url, maxChars = 1500) {
  if (!url) return '';
  try {
    const html = await httpsGetText(url, { timeout: 10000 });
    const descMatch = /<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["']/i.exec(html);
    let text = descMatch ? descMatch[1] : '';
    if (!text || text.length < 60) {
      const body = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
      text = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxChars);
    }
    return decodeXmlEntities(text).slice(0, maxChars);
  } catch (e) {
    return '';
  }
}

async function extractSourceText(url) {
  if (!url) return '';
  const jina = await fetchArticleTextViaJina(url);
  if (jina && jina.length > 80) return jina;
  return await fallbackExtractText(url);
}

// ── Verify Supabase user via access_token ───────────────────────────────────
// Returns { user } on success or { error } on failure with a clear reason so
// the caller can surface a specific message to the UI instead of a vague one.
async function verifySupabaseUser(accessToken) {
  if (!SUPABASE_URL) return { error: 'SUPABASE_URL غير مضبوط على الخادم' };
  if (!SUPABASE_KEY) return { error: 'مفتاح Supabase (SERVICE_ROLE_API) غير مضبوط على الخادم' };
  if (!accessToken) return { error: 'access_token مفقود' };
  const host = SUPABASE_URL.replace('https://', '').split('/')[0];
  try {
    const r = await httpsRequestJson({
      hostname: host,
      path: '/auth/v1/user',
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + accessToken,
      },
      timeout: 10000,
    });
    if (r.status === 401 || r.status === 403) {
      console.warn('[bulk-admin] Supabase auth rejected token:', r.status, (r.body || '').slice(0, 200));
      return { error: 'الجلسة منتهية أو التوكن غير صالح. سجّل الدخول من Google من جديد.' };
    }
    if (r.status !== 200 || !r.json) {
      console.warn('[bulk-admin] Supabase /auth/v1/user unexpected:', r.status, (r.body || '').slice(0, 200));
      return { error: `Supabase رجّع ${r.status}. تأكّد أن Google مفعّل في إعدادات Supabase Auth.` };
    }
    if (!r.json.email) {
      return { error: 'تم تسجيل الدخول لكن لم نحصل على البريد. تأكّد أن نطاق "email" مفعّل في موفّر Google.' };
    }
    return {
      user: {
        id: r.json.id,
        email: (r.json.email || '').toLowerCase(),
        provider: r.json.app_metadata?.provider,
        name: r.json.user_metadata?.full_name || r.json.user_metadata?.name,
        avatar: r.json.user_metadata?.avatar_url || r.json.user_metadata?.picture,
      },
    };
  } catch (e) {
    console.error('[bulk-admin] verifySupabaseUser network error:', e.message);
    return { error: 'تعذّر الوصول إلى Supabase: ' + e.message };
  }
}

// ── OpenAI-compatible call (Groq + OpenRouter) ─────────────────────────────
// Both Groq and OpenRouter speak the OpenAI Chat Completions protocol natively,
// so we share one implementation and only swap the host/auth header.
//
// Groq free-tier reality (as of 2026): a hard 6000 TPM (tokens-per-minute) bucket
// PER MODEL that counts BOTH input prompt tokens AND requested max_tokens. So a
// 5500 max_tokens request with a 700-token prompt = 6200 → instant 413. We cap
// max_tokens for Groq below the limit and auto-retry on 413 with smaller budget.
const GROQ_MAX_TOKEN_CAP = 4500;     // safe ceiling that leaves room for prompt
const GROQ_MIN_TOKEN_FLOOR = 1500;   // never shrink below this — output gets useless

async function callOpenAICompat({ provider, apiKey, model, messages, jsonMode = false, maxTokens = 4096, timeoutMs = 180000, temperature = 0.8 }) {
  if (!apiKey) throw new Error(`مفتاح ${provider === 'groq' ? 'Groq' : 'OpenRouter'} مطلوب`);
  const isGroq = provider === 'groq';

  // Cap max_tokens for Groq up-front to avoid the 413 round-trip whenever possible.
  let effectiveMax = isGroq ? Math.min(maxTokens, GROQ_MAX_TOKEN_CAP) : maxTokens;

  const headers = {
    'Authorization': 'Bearer ' + apiKey,
    'Content-Type': 'application/json',
  };
  if (!isGroq) {
    headers['HTTP-Referer'] = process.env.SITE_URL || 'https://dalilek.com';
    headers['X-Title'] = 'Dalilek Bulk Admin';
  }

  // Allow up to 2 in-place retries for 413 (shrink) + 1 retry for 429 with retry-after.
  let attempts = 0;
  const MAX_ATTEMPTS = 4;
  while (true) {
    attempts++;
    const payload = { model, messages, max_tokens: effectiveMax, temperature };
    if (jsonMode) payload.response_format = { type: 'json_object' };

    const r = await httpsRequestJson({
      hostname: isGroq ? 'api.groq.com' : 'openrouter.ai',
      path: isGroq ? '/openai/v1/chat/completions' : '/api/v1/chat/completions',
      method: 'POST',
      headers,
      body: payload,
      timeout: timeoutMs,
    });

    if (r.status === 200) {
      const text = r.json?.choices?.[0]?.message?.content;
      if (!text) throw new Error(`${isGroq ? 'Groq' : 'OpenRouter'} رجّع رد فارغ`);
      return text;
    }

    // 413 = request too large. Try to extract the actual TPM limit from the
    // error message ("Limit 6000, Requested 6235") and shrink max_tokens to fit,
    // then retry the SAME model (much better than bouncing to another model
    // that shares the same per-key TPM pool).
    if (r.status === 413 && attempts < MAX_ATTEMPTS && effectiveMax > GROQ_MIN_TOKEN_FLOOR) {
      const errMsg = (r.json && (r.json.error?.message || r.json.message)) || '';
      const m = errMsg.match(/Limit\s+(\d+)\s*,\s*Requested\s+(\d+)/i);
      if (m) {
        const limit = parseInt(m[1], 10);
        const requested = parseInt(m[2], 10);
        const overage = requested - limit;
        // Drop max_tokens by the overage + 200-token safety margin.
        effectiveMax = Math.max(GROQ_MIN_TOKEN_FLOOR, effectiveMax - overage - 200);
      } else {
        // No parseable limit — just halve and try again.
        effectiveMax = Math.max(GROQ_MIN_TOKEN_FLOOR, Math.floor(effectiveMax / 2));
      }
      console.warn(`[bulk-admin] ${provider}/${model} 413: shrinking max_tokens to ${effectiveMax} and retrying…`);
      continue;
    }

    // 429 = rate-limited. Honor Retry-After if present (Groq sends it in seconds).
    if (r.status === 429 && attempts < MAX_ATTEMPTS) {
      const retryAfter = parseFloat(r.headers['retry-after'] || '0');
      if (retryAfter > 0 && retryAfter <= 30) {
        console.warn(`[bulk-admin] ${provider}/${model} 429: waiting ${retryAfter}s per Retry-After header…`);
        await new Promise(rs => setTimeout(rs, Math.ceil(retryAfter * 1000) + 200));
        continue;
      }
    }

    // Anything else (or exhausted retries) → throw with full context for the caller.
    const msg = (r.json && (r.json.error?.message || r.json.message)) || r.body.slice(0, 300);
    const err = new Error(`${isGroq ? 'Groq' : 'OpenRouter'} ${r.status}: ${msg}`);
    err.status = r.status;
    err.providerBody = r.json;
    throw err;
  }
}

// ── Google Gemini call with auto-fallback ──────────────────────────────────
// Translates the OpenAI-style { role:'system'|'user'|'assistant', content } messages
// into Gemini's { systemInstruction, contents:[{role,parts:[{text}]}] } shape.
function messagesToGemini(messages) {
  const out = { systemInstruction: null, contents: [] };
  for (const m of messages || []) {
    const text = String(m.content || '');
    if (!text) continue;
    if (m.role === 'system') {
      // Gemini supports a single systemInstruction; concatenate multiple system msgs.
      if (!out.systemInstruction) out.systemInstruction = { parts: [{ text }] };
      else out.systemInstruction.parts.push({ text });
    } else {
      const role = m.role === 'assistant' ? 'model' : 'user';
      out.contents.push({ role, parts: [{ text }] });
    }
  }
  return out;
}

async function callGemini({ apiKey, model, messages, jsonMode = false, maxTokens = 4096, timeoutMs = 180000 }) {
  if (!apiKey) throw new Error('مفتاح Gemini API مطلوب');
  const { systemInstruction, contents } = messagesToGemini(messages);
  const payload = {
    contents,
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: maxTokens,
    },
  };
  if (systemInstruction) payload.systemInstruction = systemInstruction;
  if (jsonMode) payload.generationConfig.responseMimeType = 'application/json';

  const r = await httpsRequestJson({
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    timeout: timeoutMs,
  });

  if (r.status !== 200) {
    const msg = (r.json && (r.json.error?.message || r.json.message)) || r.body.slice(0, 300);
    const err = new Error(`Gemini ${r.status}: ${msg}`);
    err.status = r.status;
    err.geminiBody = r.json;
    throw err;
  }

  // Pull text out of the first candidate. If the model was blocked or returned
  // no parts, surface a clear Arabic error rather than silently returning ''.
  const cand = r.json?.candidates?.[0];
  if (!cand) {
    const blockReason = r.json?.promptFeedback?.blockReason;
    throw new Error(blockReason ? `Gemini رفض الطلب (${blockReason})` : 'Gemini رجّع رد فارغ بدون مرشحين');
  }
  const parts = cand.content?.parts || [];
  const text = parts.map(p => p.text || '').join('').trim();
  if (!text) {
    const finish = cand.finishReason || 'unknown';
    throw new Error(`Gemini رجّع رد فارغ (finishReason=${finish})`);
  }
  return text;
}

// Per-process cool-down map: "<provider>:<modelId>" -> epoch ms until it should be skipped.
// Populated when a model returns 429 so we don't keep hammering the same rate-limited one.
const MODEL_COOLDOWN = new Map();
const COOLDOWN_MS = 60_000; // 1 min cool-down on 429

// Single dispatcher: routes to the right per-provider call function.
async function callOneModel({ provider, apiKey, model, messages, jsonMode, maxTokens, timeoutMs, temperature }) {
  if (provider === 'gemini') {
    return await callGemini({ apiKey, model, messages, jsonMode, maxTokens, timeoutMs });
  }
  // groq + openrouter share the same OpenAI-compatible call.
  return await callOpenAICompat({ provider, apiKey, model, messages, jsonMode, maxTokens, timeoutMs, temperature });
}

// ── Groq key-pool aware fallback ────────────────────────────────────────────
// This project runs on Groq ONLY, using a rotating pool of GROQ_KEY_POOL keys
// (loaded once at startup — see top of file). When no explicit apiKey is
// passed we pick a healthy key from the pool, try every Groq model against
// it, and if the whole pool-key is exhausted (permanent failure / all models
// rate-limited) we rotate to the next healthy key. A key that returns
// 401/403 ("bad key") is marked permanently failed and never retried. This
// is what "خلي 11 مفتاح يشتغلوا مع بعض ولا تستخدم اللي يصير فيه غلط" means:
// dead keys drop out of the pool automatically and generation keeps going on
// the remaining healthy ones.
async function callGroqPoolWithFallback({ model, messages, jsonMode, maxTokens, timeoutMs, temperature }) {
  if (!GROQ_KEY_POOL.length) {
    throw new Error('لا يوجد أي مفتاح Groq مضبوط (GROQ_KEY_POOL فارغ)');
  }
  let lastError = null;
  const maxRounds = POOL_HEALTH.length; // at most one attempt per key per call
  for (let round = 0; round < maxRounds; round++) {
    const h = pickPoolKey();
    if (!h) break; // pool fully exhausted (all failed)
    poolKeyStart(h.key);
    try {
      const out = await callAIWithFallback({ provider: 'groq', apiKey: h.key, model, messages, jsonMode, maxTokens, timeoutMs, temperature });
      poolKeyDone(h.key, true);
      return { ...out, poolKeyIndex: h.idx };
    } catch (e) {
      poolKeyDone(h.key, false, e.status, e.message);
      lastError = e;
      console.warn(`[bulk-admin] Groq pool key #${h.idx} failed (${e.status || 'no-status'}: ${(e.message || '').slice(0, 100)}), rotating to next key...`);
      continue;
    }
  }
  throw lastError || new Error('كل مفاتيح Groq في المجموعة فشلت أو مستنفدة مؤقتاً');
}

function groqPoolStatus() {
  return POOL_HEALTH.map(h => ({
    index: h.idx,
    keyPreview: h.key ? `${h.key.slice(0, 8)}…${h.key.slice(-4)}` : '',
    status: h.status,
    successCount: h.successCount,
    failCount: h.failCount,
    articlesGenerated: h.articlesGenerated,
    inUse: h.inUse,
    cooldownUntil: h.cooldownUntil,
    lastError: h.lastError,
    lastUsed: h.lastUsed,
  }));
}

async function callAIWithFallback({ provider = 'groq', apiKey, model, messages, jsonMode, maxTokens, timeoutMs, temperature }) {
  // Force Groq-only: any other provider value is coerced to groq. When no
  // apiKey is supplied, route through the rotating key pool automatically.
  provider = 'groq';
  if (!apiKey) {
    return await callGroqPoolWithFallback({ model, messages, jsonMode, maxTokens, timeoutMs, temperature });
  }
  const prov = PROVIDERS[provider] || PROVIDERS.groq;
  const provName = prov.label;
  // Try requested model first, then the rest of THIS provider's models, skipping any in cool-down.
  const now = Date.now();
  const all = [model, ...prov.models.map(m => m.id).filter(id => id !== model)];
  const cooldownKey = m => `${provider}:${m}`;
  const fresh = all.filter(m => (MODEL_COOLDOWN.get(cooldownKey(m)) || 0) <= now);
  const fallbackOrder = fresh.length ? fresh : all;

  let lastError = null;
  for (let i = 0; i < fallbackOrder.length; i++) {
    const m = fallbackOrder[i];
    try {
      const text = await callOneModel({ provider, apiKey, model: m, messages, jsonMode, maxTokens, timeoutMs, temperature });
      MODEL_COOLDOWN.delete(cooldownKey(m));
      if (m !== model) console.log(`[bulk-admin] ${provider} fallback model used: ${m} (requested: ${model})`);
      return { text, modelUsed: m, providerUsed: provider };
    } catch (e) {
      lastError = e;
      // Bad-key errors → stop immediately (no point trying other models with the same key)
      if (e.status === 400 && /API key not valid|API_KEY_INVALID|Invalid API Key/i.test(e.message || '')) throw e;
      if (e.status === 401 || e.status === 403 || e.status === 402 || /quota|credit|billing/i.test(e.message || '')) throw e;
      if (e.status === 429) {
        MODEL_COOLDOWN.set(cooldownKey(m), Date.now() + COOLDOWN_MS);
        console.warn(`[bulk-admin] ${provider}/${m} rate-limited (429), cooling down 60s, trying next model...`);
      } else {
        console.warn(`[bulk-admin] ${provider}/${m} failed (${e.status || 'no-status'}: ${(e.message || '').slice(0, 120)}), trying next model...`);
      }
      await new Promise(r => setTimeout(r, 200));
      continue;
    }
  }
  throw lastError || new Error(`كل نماذج ${provName} فشلت — تحقق من المفتاح أو جرّب لاحقاً`);
}

// Backwards-compatible alias so older code paths still work.
const callOpenRouterWithFallback = callAIWithFallback;

function tryParse(s) { try { return JSON.parse(s); } catch (e) { return null; } }

// Attempt to "repair" a JSON string truncated by max_tokens by closing strings/arrays/objects.
function repairTruncatedJson(str) {
  if (!str) return null;
  const start = str.indexOf('{');
  if (start < 0) return null;
  let s = str.slice(start);
  // Strip any trailing junk after the last brace if it's actually balanced
  let inStr = false, esc = false, depthArr = 0, depthObj = 0;
  let lastSafe = -1;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') depthObj++;
    else if (ch === '}') { depthObj--; if (depthObj === 0 && depthArr === 0) lastSafe = i; }
    else if (ch === '[') depthArr++;
    else if (ch === ']') depthArr--;
  }
  // Build a repaired version: close open string, then close all open arrays/objects.
  let repaired = s;
  if (inStr) repaired += '"';
  // Remove a trailing comma before adding closers (e.g. `,` inside array/object)
  repaired = repaired.replace(/,\s*$/, '');
  for (let i = 0; i < depthArr; i++) repaired += ']';
  for (let i = 0; i < depthObj; i++) repaired += '}';
  return tryParse(repaired) || (lastSafe > 0 ? tryParse(s.slice(0, lastSafe + 1)) : null);
}

function extractJson(str) {
  if (!str) throw new Error('رد ذكاء اصطناعي فارغ');
  const fence = str.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) {
    const j = tryParse(fence[1]); if (j) return j;
  }
  const direct = tryParse(str); if (direct) return direct;
  const start = str.indexOf('{');
  if (start >= 0) {
    // Try the largest balanced object
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < str.length; i++) {
      const ch = str[i];
      if (inStr) { if (esc) { esc = false; } else if (ch === '\\') { esc = true; } else if (ch === '"') inStr = false; continue; }
      if (ch === '"') { inStr = true; continue; }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--; if (depth === 0) {
          const j = tryParse(str.slice(start, i + 1)); if (j) return j;
          break;
        }
      }
    }
  }
  // Last resort: try to repair a truncated JSON object
  const repaired = repairTruncatedJson(str);
  if (repaired) return repaired;
  throw new Error('فشل تحليل JSON من رد الذكاء الاصطناعي');
}

// ── Topic discovery ────────────────────────────────────────────────────────
// Today's date for "auto" mode prompts so the AI knows what's actually current.
function todayArabic() {
  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const d = new Date();
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

  // Categories the site actually supports — these are the EXACT 58 fine-
  // grained category names rendered as grid cards on /categories in the
  // compiled frontend (assets/index-CdSb2jcH.v4.clean.js, `ua` array). The
  // per-category article count on that page is computed by an exact string
  // match against `articles.category`, so any drift here (even a single
  // missing/extra word, e.g. "صحة" instead of "صحة وطب") makes an article
  // invisible to its category's counter even though the article itself
  // still shows up elsewhere. Keep this list in lockstep with the frontend
  // `ua` array if categories are ever added/renamed there.

async function discoverTopics({ provider = 'groq', apiKey, model, count, mode, category, customSeed, excludeTitles = [] }) {
  // Build a "forbidden" list block to inject into the prompt (works for any mode).
  const exclusionBlock = excludeTitles.length
    ? `\n\nقائمة العناوين الموجودة سابقاً (ممنوع تكرارها أو اقتراح أي موضوع مشابه لها بأي شكل):\n${excludeTitles.slice(0, 100).map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nأي موضوع جديد لازم يكون مختلفاً جوهرياً عن كل العناوين أعلاه — لا تكرر نفس الفكرة بصياغة مختلفة.`
    : '';

  // ── 'trending' mode: ground topics in REAL current events instead of AI
  // invention. Pipeline: Google News RSS (general + per-category search) +
  // BBC/Al-Jazeera/tech-site RSS + Wikipedia "most read" → merged/de-duplicated
  // seed list.
  //
  // IMPORTANT: earlier versions asked the model to "pick N items from this
  // list and echo back which index you picked" — in practice llama-3.3-70b
  // ignored the list entirely and just invented generic topics from its own
  // training data regardless of temperature or how strict the prompt was.
  // So now the SERVER deterministically pre-selects which real seeds to use
  // (diversified across sources/categories, excluding anything that fuzzy-
  // matches an existing article title) and the model's ONLY job per seed is
  // to rephrase it into an encyclopedic Arabic title + assign category/
  // keywords/image_query. This guarantees every trending-mode topic is
  // actually grounded in a real source_url — no reliance on the model
  // "choosing" correctly.
  let trendingSeeds = [];
  let preSelectedSeeds = [];
  if (mode === 'trending' || mode === 'auto') {
    trendingSeeds = await collectTrendingSeeds(Math.max(count * 6, 40));
    const exclusionSetForSeeds = new Set(excludeTitles.map(normalizeArabicTitle).filter(Boolean));
    const bySource = new Map();
    for (const s of trendingSeeds) {
      const key = normalizeArabicTitle(s.title);
      if (!key || exclusionSetForSeeds.has(key)) continue;
      if (!bySource.has(s.source)) bySource.set(s.source, []);
      bySource.get(s.source).push(s);
    }
    // Round-robin across sources so we don't end up with 6 items all from
    // the same feed — keeps category/topic variety.
    const sourceLists = Array.from(bySource.values());
    let si = 0;
    while (preSelectedSeeds.length < count * 2 && sourceLists.some(l => l.length)) {
      const list = sourceLists[si % sourceLists.length];
      if (list.length) preSelectedSeeds.push(list.shift());
      si++;
    }
    preSelectedSeeds = preSelectedSeeds.slice(0, Math.max(count, 1));
  }

  let userPrompt;
  if ((mode === 'trending' || mode === 'auto') && preSelectedSeeds.length > 0) {
    const seedList = preSelectedSeeds.map((s, i) => `${i + 1}. ${s.title}`).join('\n');
    userPrompt = `فيما يلي ${preSelectedSeeds.length} خبر/موضوع حقيقي رائج الآن (من Google News وBBC عربي والجزيرة ومواقع تقنية وويكيبيديا). كل رقم يقابل خبراً واحداً بالترتيب:

${seedList}
${exclusionBlock}

مهمتك: لكل رقم من الأرقام أعلاه (بنفس الترتيب، بدون تخطي أو استبدال أي عنصر)، أنشئ عنصر موضوع واحد في مصفوفة "topics" يقابله بنفس الترتيب تماماً:
- أعد صياغة الخبر ليكون عنوان مقال موسوعي عربي عميق وجذاب (وليس نسخة حرفية من عنوان الخبر، ولا تذكر أنه "خبر").
- حدد الفئة المناسبة من قائمة الفئات المسموحة فقط.
- أعطِ 8-12 كلمة مفتاحية عربية.
- أعطِ image_query إنجليزي وصفي بصرياً (3-6 كلمات).

مهم جداً: يجب أن تعيد بالضبط ${preSelectedSeeds.length} عنصراً في "topics" بنفس ترتيب القائمة أعلاه (العنصر الأول في topics يقابل الرقم 1، الثاني يقابل الرقم 2، وهكذا) — لا تحذف ولا تدمج ولا تعيد ترتيب العناصر.`;
  } else if (mode === 'custom' && customSeed) {
    userPrompt = `أعطني ${count} عناوين فريدة لمقالات معمّقة باللغة العربية مستوحاة من هذا الموضوع/الكلمة المفتاحية: "${customSeed}". لا تكرر العنوان نفسه. كل عنوان لازم يكون جذاب، عملي، ويثير الاهتمام.`;
  } else if (mode === 'category' && category) {
    userPrompt = `أعطني ${count} عناوين فريدة لمقالات الأكثر بحثاً وطلباً عالمياً عام 2026 في فئة "${category}". اختر مواضيع رائجة فعلاً، عملية، مع زاوية حديثة لعام 2026.`;
  } else if (mode === 'auto') {
    // "AI smart pick" mode — let the model itself choose the freshest, hottest,
    // most-clickable mix without any user input. Optimized for SEO + variety.
    const today = todayArabic();
    userPrompt = `اليوم ${today}. أنت مدير تحرير لموسوعة عربية شاملة وخبير عالمي في SEO وتحليل اتجاهات البحث على Google و YouTube و TikTok.

مهمتك: اختَر بنفسك أفضل وأحدث ${count} موضوع لمقالات عربية جديدة كلياً تستحق النشر اليوم. لا تنتظر مني أي توجيه — أنت الخبير.

معايير الاختيار (طبّقها كلها):
1. **حداثة**: المواضيع لازم تكون مرتبطة بأحدث ما يحدث في ${today.split(' ').slice(1).join(' ')} — أدوات جديدة، تطورات فعلية، اتجاهات صاعدة، ليس مواضيع 2023 أو 2024 المستهلكة.
2. **حجم بحث عالٍ**: اختر مواضيع يبحث عنها فعلاً ملايين الناس بالعربية والإنجليزية (لكن أعطها بالعربية).
3. **تنوّع كامل**: وزّع المواضيع على الفئات المسموحة بشكل متوازن، لا تركّز على فئة واحدة.
4. **تنوّع في صيغة العنوان**: امزج بين: "كيف تـ..."، "أفضل X في 2026"، "دليل شامل لـ..."، "X مقابل Y"، "أخطاء شائعة في..."، "أسرار..."، "خطوات عملية لـ..."، عناوين خبرية حصرية، أسئلة يسألها الناس.
5. **زاوية فريدة**: لا تكرر مواضيع مستهلكة. كل عنوان لازم يقدّم زاوية جديدة أو معلومة لم يغطها معظم المواقع العربية بعد.
6. **قيمة عملية**: كل موضوع لازم يحل مشكلة حقيقية للقارئ أو يجاوب سؤاله الفعلي.
7. **عناوين جذّابة**: استخدم أرقام، فضول، فائدة واضحة. اجعل القارئ يضغط فوراً.

ممنوع منعاً باتاً:
- تكرار نفس العنوان أو موضوع مشابه جداً.
- عناوين عامة فضفاضة مثل "كيف تنجح في الحياة".
- مواضيع مستهلكة قديمة بدون زاوية جديدة لـ 2026.

أعطِ كل موضوع: عنوان عربي قوي + الفئة المناسبة + 8-12 كلمة مفتاحية + image_query إنجليزي وصفي بصرياً.${exclusionBlock}`;
  } else {
    userPrompt = `أعطني ${count} عناوين فريدة لأكثر المقالات رواجاً وبحثاً عالمياً في عام 2026 على الإنترنت. غطّ مواضيع متنوعة من الفئات المسموحة. اختر مواضيع يبحث عنها الناس فعلاً، وأعطها زاوية حديثة 2026.${exclusionBlock}`;
  }

  const sys = `أنت محرر تحرير محتوى عربي خبير في SEO وتحليل اتجاهات البحث عالمياً. تُرجع دائماً JSON صالح فقط بدون أي شرح.

التنسيق المطلوب بالضبط:
{
  "topics": [
    { "title": "العنوان بالعربية", "category": "فئة عربية واحدة", "keywords": "كلمة1, كلمة2, كلمة3, ..." },
    ...
  ]
}

الفئات المسموحة (اختر واحدة بالضبط من هذه القائمة فقط لكل مقال — انسخ الاسم حرفياً كما هو مكتوب، لا تخترع فئة جديدة ولا تلخّصها):
${ALLOWED_CATEGORIES.join('، ')}

ملاحظة مهمة: لكل موضوع، أعطِ كذلك حقل "image_query" بالإنجليزية فقط (3-6 كلمات وصفية بصرية) عشان نجلب صورة من Pexels. مثال: "modern home office workspace" أو "person meditation sunset beach". لا تستعمل العربية في image_query.

الشكل النهائي:
{
  "topics": [
    {
      "title": "العنوان بالعربية",
      "category": "فئة عربية من القائمة أعلاه بالضبط",
      "keywords": "كلمة1, كلمة2, ...",
      "image_query": "english visual keywords"
    }
  ]
}`;

  const usingPreSelectedSeeds = (mode === 'trending' || mode === 'auto') && preSelectedSeeds.length > 0;
  const out = await callOpenRouterWithFallback({
    provider, apiKey, model,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: userPrompt },
    ],
    jsonMode: true,
    maxTokens: 4096,
    timeoutMs: 180000,
    // Lower temperature for trending-mode rephrasing — a mechanical
    // rewrite task benefits from less creative drift than free topic
    // invention does.
    temperature: usingPreSelectedSeeds ? 0.4 : 0.8,
  });
  const j = extractJson(out.text);
  const topics = Array.isArray(j.topics) ? j.topics : [];

  // Build a Set of existing-title fingerprints for O(1) duplicate filtering.
  const exclusionSet = new Set(excludeTitles.map(normalizeArabicTitle).filter(Boolean));

  // Fuzzy fallback for the rare case the model drops/merges an item and the
  // positional mapping below shifts out of alignment — recovers the real
  // source by word-overlap against the seed titles instead of leaving it
  // ungrounded.
  function fuzzyMatchSeed(title, pool) {
    if (!pool.length) return null;
    const words = new Set(normalizeArabicTitle(title).split(/\s+/).filter(w => w.length > 2));
    if (!words.size) return null;
    let best = null, bestScore = 0;
    for (const s of pool) {
      const sWords = new Set(normalizeArabicTitle(s.title).split(/\s+/).filter(w => w.length > 2));
      let overlap = 0;
      for (const w of words) if (sWords.has(w)) overlap++;
      const score = overlap / Math.max(1, Math.min(words.size, sWords.size));
      if (score > bestScore) { bestScore = score; best = s; }
    }
    return bestScore >= 0.2 ? best : null;
  }

  const cleaned = topics
    .map((t, i) => {
      // Positional mapping: since we now hand the model exactly N pre-picked
      // seeds and require it to return exactly N topics in the same order,
      // topics[i] corresponds to preSelectedSeeds[i]. Fall back to fuzzy
      // matching only if the model returned a different count (drift).
      let seed = null;
      if (usingPreSelectedSeeds) {
        seed = (i < preSelectedSeeds.length) ? preSelectedSeeds[i] : null;
        if (!seed || fuzzyMatchSeed(t.title || '', [seed]) === null) {
          seed = fuzzyMatchSeed(t.title || '', preSelectedSeeds) || seed;
        }
      }
      return {
        title: String(t.title || '').trim(),
        category: normalizeCategory(t.category),
        keywords: String(t.keywords || '').trim(),
        image_query: String(t.image_query || '').trim(),
        source_url: seed ? seed.link : '',
        source_name: seed ? seed.source : '',
      };
    })
    .filter(t => t.title)
    // Drop anything that fingerprint-matches an existing article title.
    .filter(t => !exclusionSet.has(normalizeArabicTitle(t.title)))
    // Also drop in-batch duplicates.
    .filter((t, i, arr) => arr.findIndex(x => normalizeArabicTitle(x.title) === normalizeArabicTitle(t.title)) === i);

  return {
    modelUsed: out.modelUsed,
    topics: cleaned.slice(0, count),
    duplicates_filtered: topics.length - cleaned.length,
  };
}

// ── Article generation ────────────────────────────────────────────────────
async function generateArticle({ provider = 'groq', apiKey, model, topic, speed = 'medium' }) {
  const profile = SPEED_PROFILES[speed] || SPEED_PROFILES.medium;
  const sys = `أنت كاتب محتوى عربي محترف متخصص في SEO. مهمتك إنشاء مقالات معمّقة وجذابة وعالية الجودة. تُرجع دائماً JSON صالح فقط بدون أي شرح خارجي.

التنسيق المطلوب بالضبط (لا تغيّر أي اسم حقل):
{
  "title": "العنوان النهائي بالعربية (يمكن تعديله ليكون أكثر جاذبية)",
  "slug": "english-kebab-case-slug-without-arabic-letters",
  "intro": "مقدمة جذابة 2-3 أسطر تجيب على سؤال القارئ مباشرة",
  "stats": [
    { "value": "رقم أو نسبة", "label": "وصف قصير" }
  ],
  "sections": [
    {
      "number": "01",
      "title": "عنوان القسم",
      "content": "محتوى القسم كاملاً (${profile.sectionLength}) عملي ومفيد",
      "callout": { "icon": "info", "title": "نصيحة", "text": "نصيحة عملية قصيرة" }
    }
  ],
  "skills": [
    { "number": 1, "title": "مهارة", "description": "وصف قصير" }
  ],
  "conclusion": "خاتمة 2-3 أسطر مع دعوة للعمل",
  "seo_description": "وصف SEO احترافي جداً بصيغة جملة أو جملتين كاملتين ومترابطتين (وليس قائمة كلمات)، 150-160 حرف بالضبط، يتضمن الكلمة المفتاحية الرئيسية في أول 60 حرفاً، مكتوب بلغة جذابة وموثوقة تجعل نسبة النقر (CTR) في نتائج جوجل أعلى من المنافسين، ويخلق فضولاً حقيقياً للنقر",
  "seo_keywords": "12-18 كلمة ومصطلح مفتاحي بالعربية مفصولة الزاماً بفاصلة إنجليزية عادية (,) فقط — ممنوع استخدام الفاصلة العربية (،) أو الفاصلة المنقوطة أو أي فاصل آخر. رتّبها من الأقوى بحثياً إلى الأضعف: ابدأ بالكلمة المفتاحية الرئيسية الدقيقة، ثم كلمات مفتاحية طويلة الذيل (long-tail)، ثم مصطلحات ذات صلة دلالية (LSI) وأسئلة شائعة يبحث عنها الناس، بحيث تكون قوية جداً لمنافسة أول نتيجة في جوجل",
  "image_query": "english search query describing the article's MAIN CONCRETE SUBJECT (a specific named person/place/object/technology if the topic has one, otherwise a precise concrete scene — never a vague mood word) (3-6 words)",
  "video_query": "english search query for stock VIDEOS related to the topic (3-5 words, slightly different angle than image_query)"
}

شروط حرجة:
- seo_keywords يجب أن تُفصل الكلمات فيه بفاصلة إنجليزية عادية "," فقط ولا شيء آخر — هذا حرج جداً لأن الموقع يعرض كل كلمة في صندوق منفصل بالاعتماد على هذا الفاصل بالضبط، وأي فاصل مختلف (كالفاصلة العربية «،») يكسر العرض.
- الـ slug إنجليزي صرف، أحرف صغيرة، شرطات بدل الفراغ، بدون رموز خاصة، بدون أحرف عربية إطلاقاً.
- أنشئ بالضبط ${profile.statsCount} عنصر في stats.
- أنشئ من ${profile.minSections} إلى ${profile.maxSections} أقسام (sections). كل قسم ${profile.sectionLength}. الـcallout اختياري في بعضها (يمكن أن يكون null).
- أنشئ بالضبط ${profile.skillsCount} مهارات (skills).
- المحتوى أصلي ومفيد وليس مكرراً.
- الـ image_query بالإنجليزية فقط، ويُستخدم للبحث في ويكيبيديا وويكيميديا كومنز قبل أي مصدر آخر — لازم يكون اسم كيان محدد (شخص/مكان/شركة/جهاز/تقنية) إن وُجد في الموضوع، وإلا فمشهد ملموس ودقيق (مثال جيد: "electric vehicle charging station"، مثال سيئ جداً: "modern lifestyle" أو "success mindset" لأنها مجردة ولا تُرجع صوراً دقيقة). الـ video_query بالإنجليزية ووصفي بصرياً لمقاطع فيديو (مثل "person working laptop coffee shop").`;

  // If this topic came from a real source (news RSS / Wikipedia trending),
  // ground the article in the actual source text via Jina AI Reader (with a
  // raw-HTML fallback) so the AI writes ORIGINAL encyclopedic content based
  // on real facts instead of inventing them.
  let sourceContext = '';
  if (topic.source_url) {
    const extracted = await extractSourceText(topic.source_url);
    if (extracted) {
      sourceContext = `\n\nمعلومات واقعية من مصدر حقيقي (${topic.source_name || 'مصدر إخباري'}) لاستخدامها كأساس للحقائق — أعد صياغتها بأسلوبك الموسوعي الخاص، لا تنسخها حرفياً، ولا تذكر اسم المصدر داخل المقال:\n"""${extracted}"""`;
    }
  }

  const userPrompt = `الموضوع: "${topic.title}"
الفئة: ${topic.category}
الكلمات المفتاحية المقترحة: ${topic.keywords || 'لا يوجد'}${sourceContext}

أنشئ مقالاً كاملاً عالي الجودة وفق التنسيق المحدد. اجعل المحتوى عملياً ومحدّثاً لعام 2026.${sourceContext ? ' استند إلى الحقائق الواقعية المذكورة أعلاه لكن بصياغة أصلية بالكامل.' : ''}`;

  const useJsonMode = profile.useJsonMode !== false; // default true unless profile explicitly disables it
  const timeoutMs = profile.timeoutMs || 180000;
  const out = await callOpenRouterWithFallback({
    provider, apiKey, model,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: userPrompt },
    ],
    jsonMode: useJsonMode,
    maxTokens: profile.maxTokens,
    timeoutMs,
  });
  return { article: extractJson(out.text), modelUsed: out.modelUsed, profile };
}

// ── Pexels image search (with auto-fallback queries) ──────────────────────
async function _pexelsSearchImages(query, count, page = 1) {
  const q = encodeURIComponent(String(query || '').slice(0, 100));
  if (!q) return [];
  try {
    const r = await httpsRequestJson({
      hostname: 'api.pexels.com',
      path: `/v1/search?query=${q}&per_page=${count}&page=${Math.max(1, page)}&orientation=landscape`,
      method: 'GET',
      headers: { 'Authorization': PEXELS_API_KEY },
      timeout: 15000,
    });
    if (r.status !== 200 || !r.json?.photos) return [];
    return r.json.photos.slice(0, count).map(p => ({
      url: p.src?.large2x || p.src?.large || p.src?.original,
      thumb: p.src?.medium,
      photographer: p.photographer,
      photographer_url: p.photographer_url,
      pexels_url: p.url,
      width: p.width,
      height: p.height,
    })).filter(p => p.url);
  } catch (e) {
    console.warn('Pexels image fetch failed:', e.message);
    return [];
  }
}

// ── Wikimedia Commons + Wikipedia image search ─────────────────────────────
// IMPORTANT: Wikimedia Commons' free-text search ("gsrsearch") is a fuzzy
// full-text search across file descriptions/categories, NOT a semantic image
// match. For generic descriptive queries (e.g. "healthy lifestyle") it very
// often returns wildly unrelated results (old book scans, unrelated diagrams,
// documents) just because a stray word matched somewhere in the metadata.
// It's only reliable when we're looking for a SPECIFIC, named real-world
// entity (a person, place, historical event) — which is why it's gated behind
// `wikiTitle` in fetchGroundedImages below, and why every result is passed
// through a strict relevance + file-type filter before being accepted.
const COMMONS_JUNK_CATEGORY_RE = /(book\s*cover|scanned\s*document|title\s*page|manuscript|map(?!le)|diagram|chart|logo|icon|flag|coat\s*of\s*arms|screenshot|advertisement|postage\s*stamp|banknote|coin)/i;

function _significantWords(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4);
}

// Requires the Commons file's title/description to actually share a
// meaningful word with the query — otherwise the match is coincidental.
function _isRelevantCommonsResult(query, info, pageTitle) {
  const queryWords = _significantWords(query);
  if (queryWords.length === 0) return true;
  const haystack = [
    pageTitle,
    info.extmetadata?.ObjectName?.value,
    info.extmetadata?.ImageDescription?.value,
    info.extmetadata?.Categories?.value,
  ].filter(Boolean).join(' ').toLowerCase();
  if (COMMONS_JUNK_CATEGORY_RE.test(haystack)) return false;
  return queryWords.some(w => haystack.includes(w));
}

async function fetchWikimediaCommonsImages(query, count = 3) {
  const q = String(query || '').trim();
  if (!q) return [];
  try {
    const search = await httpsGetText(
      `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(q)}&gsrlimit=${count * 3}&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=1600&format=json`,
      { timeout: 10000 }
    );
    const j = JSON.parse(search);
    const pages = (j && j.query && j.query.pages) ? Object.values(j.query.pages) : [];
    const out = [];
    for (const p of pages) {
      const info = p.imageinfo && p.imageinfo[0];
      if (!info) continue;
      const url = info.thumburl || info.url;
      if (!url || !/\.(jpe?g|png|webp)(\?.*)?$/i.test(url)) continue;
      if (info.width && info.width < 600) continue; // skip tiny/icon images
      // Skip near-square/portrait "document-like" scans — real photos used for
      // article covers are almost always landscape-ish.
      if (info.width && info.height && (info.height / info.width) > 1.3) continue;
      if (!_isRelevantCommonsResult(q, info, p.title)) continue;
      out.push({
        url,
        thumb: url,
        photographer: (info.extmetadata && info.extmetadata.Artist && info.extmetadata.Artist.value ? String(info.extmetadata.Artist.value).replace(/<[^>]+>/g, '') : 'Wikimedia Commons').slice(0, 100),
        source: 'wikimedia-commons',
      });
      if (out.length >= count) break;
    }
    return out;
  } catch (e) {
    console.warn('[bulk-admin] Wikimedia Commons fetch failed:', e.message);
    return [];
  }
}

async function fetchWikipediaThumbnail(title, lang = 'ar') {
  const t = String(title || '').trim();
  if (!t) return null;
  try {
    const text = await httpsGetText(
      `https://${lang}.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=original&titles=${encodeURIComponent(t)}&format=json&redirects=1`,
      { timeout: 10000 }
    );
    const j = JSON.parse(text);
    const pages = (j && j.query && j.query.pages) ? Object.values(j.query.pages) : [];
    const page = pages.find(p => p.original && p.original.source);
    if (!page) return null;
    return { url: page.original.source, thumb: page.original.source, photographer: 'Wikipedia', source: 'wikipedia' };
  } catch (e) {
    return null;
  }
}

// Finds the actual, human-curated Wikipedia article that best matches a
// (usually English) descriptive query. Searching Wikipedia's own full-text
// index and then taking THAT article's title is far more reliable than
// running the query directly against Wikimedia Commons: Commons' raw
// full-text search across millions of loosely-tagged files often surfaces
// coincidental keyword matches (a rare medical illustration just because it
// mentions "heart", a scanned book because it mentions "health"). Resolving
// to a real Wikipedia article title first anchors the image search on an
// actual, well-defined topic instead of a loose bag of words.
async function resolveWikipediaTitle(query, lang = 'en') {
  const q = String(query || '').trim();
  if (!q) return null;
  try {
    const text = await httpsGetText(
      `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=1&format=json`,
      { timeout: 10000 }
    );
    const j = JSON.parse(text);
    const hit = j?.query?.search?.[0];
    return hit ? hit.title : null;
  } catch (e) {
    return null;
  }
}

// Wikipedia/Wikimedia Commons is the primary image source for every article
// (per the requested pipeline: Wikipedia API is a first-class, free, precise
// source). To keep matches topically accurate — rather than just keyword-
// coincidental — we first resolve the descriptive query to a real Wikipedia
// article (see resolveWikipediaTitle above), then pull that article's own
// lead image plus Commons images scoped to that specific, resolved title.
// Every Commons result still passes the strict relevance filter (rejects
// book covers/scans/diagrams/maps, requires an actual keyword match).
// Pexels only fills in whatever Wikipedia/Commons couldn't cover.
async function fetchGroundedImages(query, count, fallbackQueries, wikiTitle, opts = {}) {
  const { avoidUrls = null, pexelsOnly = false, pexelsPage = 1 } = opts;
  const avoid = avoidUrls instanceof Set ? avoidUrls : new Set(avoidUrls || []);
  const collected = [];
  const seen = new Set(avoid);
  const pushAll = (arr) => { for (const im of arr) if (im && im.url && !seen.has(im.url)) { collected.push(im); seen.add(im.url); } };

  // "Pexels only" reroll — user explicitly wants a fresh Pexels pick, skip
  // Wikipedia/Commons entirely (those are deterministic and would just hand
  // back the same handful of images every time).
  if (pexelsOnly) {
    if (PEXELS_API_KEY) {
      const pexelsFallbacks = (fallbackQueries || []).filter(Boolean);
      pushAll(await fetchPexelsImages(query, count, pexelsFallbacks, avoid, pexelsPage));
    }
    return collected.slice(0, count);
  }

  if (wikiTitle) {
    // We already know the exact entity (e.g. a trending Arabic Wikipedia topic).
    const [wikiThumb, commons] = await Promise.all([
      fetchWikipediaThumbnail(wikiTitle, 'ar'),
      fetchWikimediaCommonsImages(wikiTitle, count),
    ]);
    if (wikiThumb) pushAll([wikiThumb]);
    pushAll(commons);
    // Also try English Wikipedia for the same title if still short.
    // For Arabic titles we must first resolve to the English article name.
    if (collected.length < count) {
      const enTitle = await resolveWikipediaTitle(wikiTitle, 'en');
      if (enTitle) {
        const [enThumb, enCommons] = await Promise.all([
          fetchWikipediaThumbnail(enTitle, 'en'),
          fetchWikimediaCommonsImages(enTitle, count - collected.length),
        ]);
        if (enThumb) pushAll([enThumb]);
        pushAll(enCommons);
      }
    }
  } else {
    // Strategy 1: Resolve the full query to a real Wikipedia article title.
    const resolvedTitle = await resolveWikipediaTitle(query, 'en');
    if (resolvedTitle) {
      const [wikiThumb, commons] = await Promise.all([
        fetchWikipediaThumbnail(resolvedTitle, 'en'),
        fetchWikimediaCommonsImages(resolvedTitle, count),
      ]);
      if (wikiThumb) pushAll([wikiThumb]);
      pushAll(commons);
    }

    // Strategy 2: Raw Commons search on the full query.
    if (collected.length < count) {
      const more = await fetchWikimediaCommonsImages(query, count - collected.length);
      pushAll(more);
    }

    // Strategy 3: Shorter query (first 3 words) often improves Commons matches.
    if (collected.length < count) {
      const shortQuery = query.split(/\s+/).slice(0, 3).join(' ');
      if (shortQuery && shortQuery !== query) {
        const resolvedShort = await resolveWikipediaTitle(shortQuery, 'en');
        if (resolvedShort && resolvedShort !== resolvedTitle) {
          const [st, sc] = await Promise.all([
            fetchWikipediaThumbnail(resolvedShort, 'en'),
            fetchWikimediaCommonsImages(resolvedShort, count - collected.length),
          ]);
          if (st) pushAll([st]);
          pushAll(sc);
        }
        if (collected.length < count) {
          pushAll(await fetchWikimediaCommonsImages(shortQuery, count - collected.length));
        }
      }
    }

    // Strategy 4: Category-based fallback queries.
    for (const fb of (fallbackQueries || [])) {
      if (collected.length >= count) break;
      if (!fb || fb === query) continue;
      pushAll(await fetchWikimediaCommonsImages(fb, count - collected.length));
    }
  }

  // Strategy 5: Pexels automatic fallback — kicks in whenever Wikipedia/Commons
  // didn't deliver enough images, so articles never end up with blank slots.
  if (collected.length < count && PEXELS_API_KEY) {
    const pexelsFallbacks = (fallbackQueries || []).filter(Boolean);
    const pexelsResults = await fetchPexelsImages(query, count - collected.length, pexelsFallbacks, avoid, pexelsPage);
    pushAll(pexelsResults);
  }

  return collected.slice(0, count);
}

async function fetchPexelsImages(query, count = 3, fallbackQueries = [], avoidUrls = null, page = 1) {
  if (!PEXELS_API_KEY) return [];
  const avoid = avoidUrls instanceof Set ? avoidUrls : new Set(avoidUrls || []);
  // Fetch extra so we still have `count` left after filtering out avoided URLs.
  let images = (await _pexelsSearchImages(query, count + avoid.size, page)).filter(i => !avoid.has(i.url));
  // If too few results, try fallback queries (e.g. category-based, or generic)
  for (const fb of fallbackQueries) {
    if (images.length >= count) break;
    if (!fb) continue;
    const more = (await _pexelsSearchImages(fb, count - images.length + avoid.size, page)).filter(i => !avoid.has(i.url));
    // Dedupe by URL
    const seen = new Set(images.map(i => i.url));
    for (const m of more) if (!seen.has(m.url)) { images.push(m); seen.add(m.url); }
  }
  // Still short (e.g. every result on page 1 was avoided)? try a later page of the same query.
  if (images.length < count && page === 1) {
    const nextPage = (await _pexelsSearchImages(query, count, 2)).filter(i => !avoid.has(i.url));
    const seen = new Set(images.map(i => i.url));
    for (const m of nextPage) if (!seen.has(m.url)) { images.push(m); seen.add(m.url); }
  }
  return images.slice(0, count);
}

// ── Pexels video search ────────────────────────────────────────────────────
// Returns one video object suitable for HTML <video src=...>
async function _pexelsSearchVideo(query) {
  const q = encodeURIComponent(String(query || '').slice(0, 100));
  if (!q) return null;
  try {
    const r = await httpsRequestJson({
      hostname: 'api.pexels.com',
      path: `/videos/search?query=${q}&per_page=8&orientation=landscape`,
      method: 'GET',
      headers: { 'Authorization': PEXELS_API_KEY },
      timeout: 15000,
    });
    if (r.status !== 200 || !Array.isArray(r.json?.videos) || r.json.videos.length === 0) return null;

    // Prefer videos with reasonable duration (5-30 sec, not too long)
    const candidates = r.json.videos
      .filter(v => v.duration >= 5 && v.duration <= 30)
      .sort((a, b) => Math.abs(15 - a.duration) - Math.abs(15 - b.duration));
    const video = candidates[0] || r.json.videos[0];
    if (!video) return null;

    // Pick best mp4 file: HD (around 1280px wide), not too huge
    const mp4Files = (video.video_files || []).filter(f => f.file_type === 'video/mp4' && f.link);
    if (mp4Files.length === 0) return null;
    // Sort by closeness to 1280px width (sweet spot for web)
    mp4Files.sort((a, b) => Math.abs(1280 - (a.width || 0)) - Math.abs(1280 - (b.width || 0)));
    const file = mp4Files[0];

    return {
      url: file.link,
      poster: video.image || video.video_pictures?.[0]?.picture || null,
      duration: video.duration,
      width: file.width,
      height: file.height,
      photographer: video.user?.name,
      photographer_url: video.user?.url,
      pexels_url: video.url,
    };
  } catch (e) {
    console.warn('Pexels video fetch failed:', e.message);
    return null;
  }
}

async function fetchPexelsVideo(query, fallbackQueries = []) {
  if (!PEXELS_API_KEY) return null;
  let v = await _pexelsSearchVideo(query);
  for (const fb of fallbackQueries) {
    if (v) break;
    if (!fb) continue;
    v = await _pexelsSearchVideo(fb);
  }
  return v;
}

// Map Arabic categories to safe English Pexels keywords as a final fallback.
const CATEGORY_FALLBACK_QUERIES = {
  'تكنولوجيا': 'technology innovation',
  'صحة': 'healthy lifestyle',
  'مال وأعمال': 'business finance',
  'تطوير ذات': 'personal growth',
  'ثقافة': 'culture art',
  'علوم': 'science laboratory',
  'أسلوب حياة': 'lifestyle modern',
  'طعام': 'food cooking',
  'رياضة': 'sports fitness',
  'تعليم': 'education learning',
  'سفر': 'travel destination',
  'ترفيه': 'entertainment fun',
};

// ── Slug normalization + uniqueness ─────────────────────────────────────────
// Normalizes an SEO keywords string so the frontend's `.split(",")` always
// produces one pill per keyword. AI models sometimes separate keywords with
// the Arabic comma "،" or Arabic semicolon "؛" or newlines instead of a plain
// "," — when that happens the whole string renders as ONE giant pill instead
// of many. This forces a single canonical separator and also dedupes/trims.
function normalizeKeywords(raw) {
  if (!raw) return '';
  const parts = String(raw)
    .replace(/[،؛]/g, ',')       // Arabic comma/semicolon -> comma
    .split(/[,\n]+/)
    .map(k => k.trim())
    .filter(Boolean);
  const seen = new Set();
  const deduped = [];
  for (const k of parts) {
    const key = k.toLowerCase();
    if (!seen.has(key)) { seen.add(key); deduped.push(k); }
  }
  return deduped.join(', ');
}

function normalizeSlug(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120) || 'article';
}

async function findUniqueSlug(base) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return base;
  const host = SUPABASE_URL.replace('https://', '').split('/')[0];
  let candidate = base;
  let n = 1;
  while (n < 50) {
    const r = await httpsRequestJson({
      hostname: host,
      path: `/rest/v1/articles?slug=eq.${encodeURIComponent(candidate)}&select=slug&limit=1`,
      method: 'GET',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY },
      timeout: 10000,
    });
    if (r.status === 200 && Array.isArray(r.json) && r.json.length === 0) return candidate;
    n++;
    candidate = `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}

async function insertArticle(record) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase not configured');
  const host = SUPABASE_URL.replace('https://', '').split('/')[0];
  const r = await httpsRequestJson({
    hostname: host,
    path: '/rest/v1/articles',
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: record,
    timeout: 30000,
  });
  if (r.status >= 200 && r.status < 300 && Array.isArray(r.json) && r.json.length > 0) {
    const inserted = r.json[0];
    // Fire-and-forget: notify search engines via IndexNow about the new URL.
    // We push the canonical + 4-language URLs so all variants get crawled.
    try {
      if (insertArticle._app && typeof insertArticle._app.submitIndexNow === 'function' && inserted.slug) {
        const urls = insertArticle._app.articleUrlsForIndexNow(inserted.slug);
        insertArticle._app.submitIndexNow(urls).catch(() => { });
        if (typeof insertArticle._app.submitGoogleIndexingAPI === 'function') {
          insertArticle._app.submitGoogleIndexingAPI(urls).catch(() => { });
        }
      }
    } catch (e) { }
    return inserted;
  }
  const msg = (r.json && (r.json.message || r.json.hint || r.json.details)) || r.body.slice(0, 300);
  const err = new Error(`Supabase insert ${r.status}: ${msg}`);
  err.status = r.status;
  err.body = msg;
  throw err;
}

// Fetch recent article titles + slugs so we can tell the AI not to suggest
// duplicates and so we can filter overlap server-side too.
async function fetchRecentArticles(limit = 100) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  const host = SUPABASE_URL.replace('https://', '').split('/')[0];
  try {
    const r = await httpsRequestJson({
      hostname: host,
      path: `/rest/v1/articles?select=title,slug&order=id.desc&limit=${limit}`,
      method: 'GET',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY },
      timeout: 10000,
    });
    if (r.status === 200 && Array.isArray(r.json)) {
      return r.json.map(a => ({ title: String(a.title || '').trim(), slug: String(a.slug || '').trim() }))
        .filter(a => a.title || a.slug);
    }
  } catch (e) {
    console.warn('[bulk-admin] fetchRecentArticles failed:', e.message);
  }
  return [];
}

// Loose Arabic title comparison: strip diacritics + common prefixes + spaces.
function normalizeArabicTitle(s) {
  return String(s || '')
    .replace(/[\u064B-\u065F\u0670]/g, '')   // strip tashkeel
    .replace(/[إأآا]/g, 'ا')                  // unify alef
    .replace(/ى/g, 'ي').replace(/ة/g, 'ه')   // unify ya/ta-marbuta
    .replace(/[^\u0600-\u06FFa-z0-9]/gi, '')  // keep only letters/digits
    .toLowerCase();
}

// Translate a finished Arabic article into another language.
// Returns { title, intro, sections, skills, conclusion, seo_description, seo_keywords }
//
// On Groq we deliberately route translations to a DIFFERENT model than the one
// used for article generation, because each Groq model has its OWN per-key
// 6000-TPM bucket. Sharing the bucket = guaranteed 429 storm; using a separate
// model = each translation runs in its own clean budget.
async function translateArticle({ provider = 'groq', apiKey, model, article, targetLang }) {
  const langName = { en: 'English', fr: 'French', es: 'Spanish' }[targetLang] || targetLang;
  const sys = `You are a professional translator and SEO copywriter. Translate the given Arabic article into NATURAL, fluent ${langName}. Preserve the structure exactly. Do NOT translate brand names or numbers. Return ONLY valid JSON, no commentary.

Required JSON shape (keep exact field names, same array lengths as input):
{
  "title": "translated title in ${langName}",
  "intro": "translated intro in ${langName}",
  "stats": [ { "value": "same number/percent", "label": "translated label in ${langName}" } ],
  "sections": [
    {
      "number": "01",
      "title": "translated section title",
      "content": "translated full section content (same length, same paragraphs)",
      "callout": { "icon": "info", "title": "translated callout title", "text": "translated callout text" }
    }
  ],
  "skills": [ { "number": 1, "title": "translated skill", "description": "translated description" } ],
  "conclusion": "translated conclusion",
  "seo_description": "an extremely strong, professional ${langName} SEO meta description written as one or two complete, compelling sentences (NOT a keyword list, NOT a literal translation) — 150-160 characters exactly, front-loads the primary keyword in the first 60 characters, and is written to beat competitors for the #1 Google ranking with a high click-through rate",
  "seo_keywords": "12-18 powerful ${langName} SEO keywords AND long-tail phrases, ordered from strongest primary keyword to related LSI terms and common search questions, separated ONLY by a plain comma \",\" — CRITICAL: do not use any other separator (no semicolons, no bullet points, no newlines), since the site renders each keyword as its own tag based on this exact comma"
}`;

  const sourcePayload = {
    title: article.title,
    intro: article.intro,
    stats: article.stats || [],
    sections: article.sections || [],
    skills: article.skills || [],
    conclusion: article.conclusion,
    seo_description: article.seo_description || '',
  };

  // Pick a translation model that doesn't share the article model's TPM bucket on Groq.
  let translationModel = model;
  if (provider === 'groq') {
    translationModel = (model === 'llama-3.1-8b-instant') ? 'openai/gpt-oss-20b' : 'llama-3.1-8b-instant';
  }
  // Translations are short → small token budget keeps us well under any TPM cap
  // and means a single 413/429 retry cycle resolves cleanly.
  const translationMaxTokens = provider === 'groq' ? 3000 : 4000;

  const out = await callOpenRouterWithFallback({
    provider, apiKey, model: translationModel,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: 'Arabic source article:\n' + JSON.stringify(sourcePayload) + `\n\nTranslate every text field into ${langName}. Keep arrays the same length. Output JSON only.` },
    ],
    jsonMode: false,
    maxTokens: translationMaxTokens,
    timeoutMs: 240000,
  });
  return extractJson(out.text);
}

// Wraps translateArticle with a retry-on-failure loop. The inner call already
// iterates through every model on the provider (callAIWithFallback), so most
// failures we see at this layer are transient network/TPM issues that clear
// within a few seconds. We keep retries short so a single flaky language
// doesn't add 30+ seconds to every article in a bulk run.
async function translateArticleWithRetry(opts, { attempts = 3, baseDelayMs = 4000 } = {}) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await translateArticle(opts);
      if (res && res.title && res.intro) return res;
      lastErr = new Error('translateArticle returned empty/invalid payload');
    } catch (e) {
      lastErr = e;
    }
    if (i < attempts - 1) {
      // Short backoff: 4s, 8s. Long enough for a transient 429/timeout to clear
      // but short enough that bulk runs stay fast.
      const delay = baseDelayMs * (i + 1);
      console.warn(`[bulk-admin] translation ${opts.targetLang} failed (${(lastErr.message || '').slice(0, 80)}), retrying in ${delay / 1000}s…`);
      await new Promise(rs => setTimeout(rs, delay));
    }
  }
  console.error(`[bulk-admin] translation ${opts.targetLang} EXHAUSTED ${attempts} attempts: ${lastErr?.message}`);
  return null;
}

function buildLangContent(translated, media) {
  return {
    title: translated.title || '',
    intro: translated.intro || '',
    stats: Array.isArray(translated.stats) ? translated.stats : [],
    sections: Array.isArray(translated.sections) ? translated.sections : [],
    skills: Array.isArray(translated.skills) ? translated.skills : [],
    conclusion: translated.conclusion || '',
    seo_description: translated.seo_description || '',
    seo_keywords: normalizeKeywords(translated.seo_keywords) || '',
    cover_image: media.cover_image,
    cover: media.cover_image,
    images: media.images,
    video: media.video,
  };
}

async function generateAndPublish({ provider = 'groq', apiKey, model, topic, templateId, speed = 'medium' }) {
  const { article, modelUsed, profile } = await generateArticle({ provider, apiKey, model, topic, speed });
  if (!article || (!article.title && !topic.title)) {
    throw new Error('AI رجّع بنية مقال غير صالحة (لا عنوان)');
  }

  // Resilience: backfill missing fields from the topic so a partially-broken AI
  // response still produces a publishable article instead of dying outright.
  if (!article.title) article.title = topic.title;
  if (!article.intro) article.intro = `مقال شامل حول ${article.title}.`;
  if (!Array.isArray(article.sections) || article.sections.length === 0) {
    throw new Error('AI رجّع مقال بدون أقسام');
  }

  // Slug fallback chain: AI's slug → image_query → topic.image_query →
  // keywords-as-slug → timestamp slug. Anything but throwing.
  let rawSlug = article.slug
    || article.image_query
    || topic.image_query
    || (article.seo_keywords || topic.keywords || '').split(',')[0]
    || `article-${Date.now()}`;
  const slugBase = normalizeSlug(rawSlug) || `article-${Date.now()}`;
  const slugAsQuery = slugBase.replace(/-/g, ' ').trim().slice(0, 100);

  // Fetch images AND video in parallel. Order of fallbacks matters:
  // 1) AI-provided English image_query (from generation)
  // 2) topic.image_query (set by discover-topics, also English)
  // 3) the slug words (always English, derived from the topic)
  // 4) category-based generic English query
  // 5) ultra-generic safety net
  const categoryFallback = CATEGORY_FALLBACK_QUERIES[topic.category] || 'modern abstract background';
  const imageQuery = article.image_query || topic.image_query || slugAsQuery || categoryFallback;
  const videoQuery = article.video_query || article.image_query || topic.image_query || slugAsQuery || categoryFallback;
  const imageFallbacks = [topic.image_query, slugAsQuery, categoryFallback, 'business workspace', 'modern abstract'].filter(Boolean);
  const videoFallbacks = [topic.image_query, slugAsQuery, categoryFallback, 'business workspace'].filter(Boolean);

  // Pexels media is always parallel (different host, no AI quota involved).
  // Translations: parallelize on Gemini/OpenRouter (separate per-key buckets handle it),
  // but SERIALIZE on Groq because Groq's free tier shares ONE 6000-TPM bucket per
  // model — firing 3 translations at once guarantees 429s and lost articles.
  // Images: Wikimedia Commons + Wikipedia first (free, high-quality, precise),
  // Pexels only fills in whatever's still missing. Video stays Pexels-only
  // since Wikimedia rarely has usable short-form video for these topics.
  // If the user previewed/rerolled images or video on the topics screen before
  // hitting "generate", honour those exact picks instead of silently refetching
  // something different — the whole point of showing a preview is that what
  // you see is what gets published.
  //
  // _images  = array of up to 3 image objects set by the preview/reroll UI
  // _image   = legacy single-image field (fallback for older topic objects)
  // _video   = the single video object set by the preview UI
  const previewImages = Array.isArray(topic._images)
    ? topic._images.filter(im => im && im.url)
    : (topic._image && topic._image.url ? [topic._image] : []);
  const selectedVideo = topic._video && topic._video.url ? topic._video : null;

  const wikiTitle = topic.source_name === 'wikipedia-trending' ? topic.title : '';
  // How many extra images do we still need beyond what the user already picked?
  const extraNeeded = Math.max(0, 3 - previewImages.length);
  const mediaPromises = Promise.allSettled([
    extraNeeded > 0
      ? fetchGroundedImages(imageQuery, extraNeeded, imageFallbacks, wikiTitle)
      : Promise.resolve([]),
    selectedVideo ? Promise.resolve(null) : fetchPexelsVideo(videoQuery, videoFallbacks),
  ]);

  let enRes, frRes, esRes;
  if (provider === 'groq') {
    // Sequential on Groq + retry-with-backoff per language. Translations now
    // route to a different model (separate TPM bucket) so a short breather is
    // plenty between languages instead of the 30+ seconds we'd need otherwise.
    const langs = ['en', 'fr', 'es'];
    const results = [];
    for (const lang of langs) {
      const r = await Promise.allSettled([
        translateArticleWithRetry({ provider, apiKey, model, article, targetLang: lang }),
      ]);
      results.push(r[0]);
      await new Promise(rs => setTimeout(rs, 600));
    }
    [enRes, frRes, esRes] = results;
  } else {
    [enRes, frRes, esRes] = await Promise.allSettled([
      translateArticleWithRetry({ provider, apiKey, model, article, targetLang: 'en' }),
      translateArticleWithRetry({ provider, apiKey, model, article, targetLang: 'fr' }),
      translateArticleWithRetry({ provider, apiKey, model, article, targetLang: 'es' }),
    ]);
  }

  const [imagesResult, videoResult] = await mediaPromises;

  // Start with the user's pre-picked preview images (what they saw on screen),
  // then append any freshly-fetched extras to fill remaining slots, deduped by URL.
  const extraImages = imagesResult.status === 'fulfilled' ? (imagesResult.value || []) : [];
  const previewUrls = new Set(previewImages.map(i => i.url));
  const dedupedExtras = extraImages.filter(i => i && i.url && !previewUrls.has(i.url));
  let images = [...previewImages, ...dedupedExtras].slice(0, 3);
  let video = selectedVideo || (videoResult.status === 'fulfilled' ? videoResult.value : null);
  const media = { cover_image: images[0]?.url || null, images, video };

  const arContent = {
    title: article.title,
    intro: article.intro,
    stats: Array.isArray(article.stats) ? article.stats.slice(0, profile.statsCount) : [],
    sections: Array.isArray(article.sections) ? article.sections.slice(0, profile.maxSections) : [],
    skills: Array.isArray(article.skills) ? article.skills.slice(0, profile.skillsCount) : [],
    conclusion: article.conclusion,
    seo_description: article.seo_description || '',
    seo_keywords: normalizeKeywords(article.seo_keywords) || '',
    image_query: article.image_query || null,
    video_query: article.video_query || null,
    cover_image: media.cover_image,
    cover: media.cover_image,
    images: media.images,
    video: media.video,
  };

  // If a translation failed, fall back to the Arabic content for that language so the
  // article record stays valid (better than missing the language entirely).
  const enContent = enRes.status === 'fulfilled' && enRes.value ? buildLangContent(enRes.value, media) : arContent;
  const frContent = frRes.status === 'fulfilled' && frRes.value ? buildLangContent(frRes.value, media) : arContent;
  const esContent = esRes.status === 'fulfilled' && esRes.value ? buildLangContent(esRes.value, media) : arContent;

  const translationsOk = {
    en: enRes.status === 'fulfilled' && !!enRes.value,
    fr: frRes.status === 'fulfilled' && !!frRes.value,
    es: esRes.status === 'fulfilled' && !!esRes.value,
  };

  // Build SPA-compatible top-level fields. The pre-built React SPA reads
  // content.images as an array of URL STRINGS (not objects) and content.video
  // as { url, title }. Without these, the article hero falls back to a plain
  // gradient even when media is fetched correctly.
  const topLevelImages = (media.images || []).map(im => im?.url).filter(Boolean);
  const topLevelVideo = media.video?.url ? { url: media.video.url, title: media.video.photographer || '' } : null;

  const content = {
    // top-level fields the SPA card mapper reads first
    intro: arContent.intro || '',
    stats: arContent.stats || [],
    sections: arContent.sections || [],
    skills: arContent.skills || [],
    conclusion: arContent.conclusion || '',
    images: topLevelImages,
    video: topLevelVideo,
    cover_image: topLevelImages[0] || null,
    cover: topLevelImages[0] || null,
    // full multilingual content
    languages: { ar: arContent, en: enContent, fr: frContent, es: esContent },
  };
  const slug = await findUniqueSlug(slugBase);
  const tpl = templateId || getTemplateForCategory(topic.category);

  // Build a multilingual SEO description/keywords payload for the SEO refresh.
  const seoDescriptionMultilingual = {
    ar: arContent.seo_description || '',
    en: enContent.seo_description || arContent.seo_description || '',
    fr: frContent.seo_description || arContent.seo_description || '',
    es: esContent.seo_description || arContent.seo_description || '',
  };
  const seoKeywordsMultilingual = {
    ar: normalizeKeywords(arContent.seo_keywords || topic.keywords || ''),
    en: normalizeKeywords(enContent.seo_keywords || arContent.seo_keywords || ''),
    fr: normalizeKeywords(frContent.seo_keywords || arContent.seo_keywords || ''),
    es: normalizeKeywords(esContent.seo_keywords || arContent.seo_keywords || ''),
  };

  // Store multilingual titles so the SEO server can serve per-language titles
  const titleMultilingual = {
    ar: arContent.title || article.title,
    en: enContent.title || article.title,
    fr: frContent.title || article.title,
    es: esContent.title || article.title,
  };

  const record = {
    title: article.title,
    slug,
    content: JSON.stringify(content),
    template_id: tpl,
    seo_keywords: normalizeKeywords(article.seo_keywords || topic.keywords || ''),
    category: topic.category,
    seo_description: article.seo_description || '',
    seo_keywords_multilingual: seoKeywordsMultilingual,
    seo_description_multilingual: seoDescriptionMultilingual,
    title_multilingual: titleMultilingual,
    views: 0,
  };

  let inserted;
  async function tryInsert(rec) {
    try {
      return await insertArticle(rec);
    } catch (e) {
      const msg = e.message || '';
      // Some Supabase schemas don't have the *_multilingual columns; retry without them.
      if (/seo_(keywords|description)_multilingual|title_multilingual/i.test(msg)) {
        delete rec.seo_keywords_multilingual;
        delete rec.seo_description_multilingual;
        delete rec.title_multilingual;
        return await insertArticle(rec);
      }
      // Race condition: slug got taken between findUniqueSlug and insert.
      // Append a timestamp suffix and retry once.
      if (/duplicate key|unique constraint|already exists|23505/i.test(msg) && /slug/i.test(msg)) {
        rec.slug = `${rec.slug}-${Date.now().toString(36)}`;
        return await insertArticle(rec);
      }
      throw e;
    }
  }
  inserted = await tryInsert(record);
  return {
    id: inserted.id,
    slug: inserted.slug,
    title: inserted.title,
    category: inserted.category,
    cover_image: arContent.cover_image,
    images_count: images.length,
    has_video: !!video,
    languages: ['ar', ...Object.keys(translationsOk).filter(k => translationsOk[k])],
    translations_ok: translationsOk,
    model_used: modelUsed,
    speed_used: speed,
  };
}

// ── Auto-Generator (cron) ───────────────────────────────────────────────────
// Persistent state lives in two JSON files (gitignored). They store the user's
// settings + an API key so an external cron service (e.g. cron-job.org) can
// trigger generation without a logged-in browser session.

const CRON_CONFIG_PATH = path.join(tmpDir, '.cron-config.json');
const CRON_LOG_PATH = path.join(tmpDir, '.cron-log.json');
const CRON_LOG_MAX = 50;

// Translate a raw provider error into a clear Arabic explanation that an
// end-user can act on, without having to read English/JSON tracebacks. Mirrors
// the explainError helper in bulk-admin.html so logs and UI speak the same
// language.
function friendlyAiError(rawMsg, provider) {
  const msg = String(rawMsg || '');
  const m = msg.toLowerCase();
  const providerLabel = provider === 'gemini' ? 'Gemini' : provider === 'groq' ? 'Groq' : 'OpenRouter';
  if (/429|rate[- ]?limit|too many/.test(m)) {
    return `تجاوز حد المعدّل لـ ${providerLabel} (طلبات/دقيقة). خفّض عدد المقالات لكل دفعة (مثلاً 3) أو استخدم مزوّداً آخر.`;
  }
  if (/quota|exhausted|الحد اليومي|الحد الشهري|daily limit/.test(m)) {
    return `تم استهلاك حصة مفتاح ${providerLabel} لليوم. انتظر حتى الغد أو استخدم مفتاحاً/مزوّداً آخر.`;
  }
  if (/unauthorized|invalid api key|401|api key/.test(m)) {
    return `مفتاح ${providerLabel} غير صالح أو منتهي. أعد إدخاله في إعدادات التوليد التلقائي.`;
  }
  if (/timeout|aborted|تجاوز الوقت/.test(m)) {
    return `انتهت مهلة الاتصال بـ ${providerLabel}. سيُعاد المحاولة في الدفعة التالية.`;
  }
  if (/blocked|safety|رفض|منع/.test(m)) {
    return `${providerLabel} رفض الموضوع لأسباب أمان/محتوى. غيّر الموضوع.`;
  }
  if (/empty|فارغ|finishreason/.test(m)) {
    return `${providerLabel} رجّع رداً فارغاً. جرّب نموذجاً مختلفاً.`;
  }
  if (/json|parse|تحليل|بنية مقال|بدون أقسام/.test(m)) {
    return `${providerLabel} رجّع تنسيقاً غير صالح. جرّب وضع "الأفضل".`;
  }
  if (/supabase|insert|duplicate|unique|slug/.test(m)) {
    return `فشل حفظ المقال (ربما العنوان مكرر).`;
  }
  if (/network|fetch|enotfound|econn/.test(m)) {
    return `مشكلة شبكة مع ${providerLabel}. تحقّق من الاتصال.`;
  }
  // Fallback: keep first 140 chars of the original so the user has SOME signal.
  return msg.length > 140 ? msg.slice(0, 140) + '…' : msg;
}

function defaultCronConfig() {
  return {
    enabled: false,
    secret: crypto.randomBytes(24).toString('hex'),
    provider: 'groq',
    model: PROVIDERS.groq.models[0].id,
    apiKey: '',
    speed: 'fast',
    count: 5,
    mode: 'trending',
    category: '',
    customSeed: '',
    dailyLimit: 50,
    todayDate: '',
    todayCount: 0,
    lastRunAt: 0,
    lastRunStatus: '',
  };
}

function loadCronConfig() {
  try {
    const raw = fs.readFileSync(CRON_CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return Object.assign(defaultCronConfig(), parsed);
  } catch (e) {
    const cfg = defaultCronConfig();
    saveCronConfig(cfg);
    return cfg;
  }
}

function saveCronConfig(cfg) {
  try {
    fs.writeFileSync(CRON_CONFIG_PATH, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  } catch (e) {
    console.error('[bulk-admin] saveCronConfig failed:', e.message);
  }
}

function loadCronLog() {
  try {
    const raw = fs.readFileSync(CRON_LOG_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function appendCronLog(entry) {
  const log = loadCronLog();
  log.unshift(entry);
  while (log.length > CRON_LOG_MAX) log.pop();
  try {
    fs.writeFileSync(CRON_LOG_PATH, JSON.stringify(log, null, 2));
  } catch (e) {
    console.error('[bulk-admin] appendCronLog failed:', e.message);
  }
}

// Mask API key before sending config to the browser.
function maskApiKey(k) {
  if (!k) return '';
  if (k.length <= 10) return '••••••';
  return k.slice(0, 6) + '••••' + k.slice(-4);
}

// In-memory lock so two cron pings can't double-trigger a batch.
let cronInFlight = false;

// Core auto-generator: discovers topics, generates them sequentially, and logs
// the result. Designed to be called either by the public cron endpoint or by
// the admin "run-now" button. Returns a summary even on partial failure.
async function runCronBatch({ trigger = 'cron' } = {}) {
  if (cronInFlight) {
    return { skipped: 'busy', message: 'دفعة سابقة لا تزال تُنفَّذ' };
  }
  cronInFlight = true;
  const cfg = loadCronConfig();
  const startedAt = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  // Reset daily counter on date roll-over.
  if (cfg.todayDate !== today) {
    cfg.todayDate = today;
    cfg.todayCount = 0;
  }

  try {
    if (!GROQ_KEY_POOL.length) throw new Error('لا يوجد أي مفتاح Groq صالح في GROQ_KEY_POOL');
    if (cfg.todayCount >= cfg.dailyLimit) {
      const summary = { skipped: 'daily-limit', message: `تم بلوغ الحد اليومي (${cfg.dailyLimit})`, todayCount: cfg.todayCount };
      cfg.lastRunAt = startedAt;
      cfg.lastRunStatus = 'skipped: daily limit';
      saveCronConfig(cfg);
      appendCronLog({ startedAt, finishedAt: Date.now(), trigger, ...summary, articles: [], errors: [] });
      return summary;
    }

    const remaining = cfg.dailyLimit - cfg.todayCount;
    const count = Math.max(1, Math.min(cfg.count, remaining));

    // 1) Discover topics, excluding the last 100 articles.
    const recent = await fetchRecentArticles(100);
    const excludeTitles = recent.map(a => a.title).filter(Boolean);
    const disc = await discoverTopics({
      provider: cfg.provider, apiKey: cfg.apiKey, model: cfg.model,
      count, mode: cfg.mode || 'auto', category: cfg.category || '',
      customSeed: cfg.customSeed || '', excludeTitles,
    });
    const topics = disc.topics || [];
    if (topics.length === 0) throw new Error('لم يتم اكتشاف أي مواضيع');

    // 2) Generate sequentially with a cool-down between articles. Sequential
    // is intentional here: we're running unattended in the background, so
    // reliability beats raw speed. The cool-down gives the per-minute quota
    // (Groq 6000 TPM, Gemini 10 RPM) time to refill between articles —
    // without it, articles 3..N reliably hit 429 on free tiers.
    const articles = [];
    const errors = [];
    // Each article fires 4 calls (1 main + 3 translations). Wait long enough
    // that the per-minute window has rolled over before the next article.
    const COOLDOWN_MS = 4000; // Groq pool has 11 keys — a short breather between articles is enough.
    let consecutiveRateLimits = 0;
    for (let idx = 0; idx < topics.length; idx++) {
      const topic = topics[idx];
      try {
        const out = await generateAndPublish({
          provider: cfg.provider, apiKey: cfg.apiKey, model: cfg.model,
          topic, speed: cfg.speed || 'fast',
        });
        articles.push({ title: out.title, slug: out.slug, url: out.url, translations_ok: out.translations_ok });
        cfg.todayCount += 1;
        consecutiveRateLimits = 0;
      } catch (e) {
        errors.push(`${topic.title}: ${friendlyAiError(e.message, cfg.provider)}`);
        // If we keep hitting 429 back-to-back, pause longer to let the
        // per-minute / per-hour quota fully reset. Avoid burning the
        // remaining topics on errors that can't possibly succeed yet.
        if (/429|rate[- ]?limit|too many|الحصة|الحد/i.test(e.message || '')) {
          consecutiveRateLimits++;
          if (consecutiveRateLimits >= 2) {
            const longWait = Math.min(60000, 30000 * consecutiveRateLimits);
            console.warn(`[cron] ${consecutiveRateLimits} consecutive rate limits, pausing ${longWait / 1000}s before next article`);
            await new Promise(r => setTimeout(r, longWait));
          }
        } else {
          consecutiveRateLimits = 0;
        }
      }
      // Cool-down between articles, but skip after the last one.
      if (idx < topics.length - 1) {
        await new Promise(r => setTimeout(r, COOLDOWN_MS));
      }
    }

    const finishedAt = Date.now();
    const summary = {
      ok: true, trigger,
      startedAt, finishedAt, durationMs: finishedAt - startedAt,
      requested: count, succeeded: articles.length, failed: errors.length,
      todayCount: cfg.todayCount, dailyLimit: cfg.dailyLimit,
      modelUsed: disc.modelUsed, articles, errors,
    };
    cfg.lastRunAt = startedAt;
    cfg.lastRunStatus = `${articles.length}/${count} نجح`;
    saveCronConfig(cfg);
    appendCronLog(summary);
    return summary;
  } catch (e) {
    const finishedAt = Date.now();
    const summary = {
      ok: false, trigger, startedAt, finishedAt, durationMs: finishedAt - startedAt,
      error: e.message, articles: [], errors: [e.message],
    };
    cfg.lastRunAt = startedAt;
    cfg.lastRunStatus = 'فشل: ' + friendlyAiError(e.message, cfg.provider).slice(0, 140);
    saveCronConfig(cfg);
    appendCronLog(summary);
    return summary;
  } finally {
    cronInFlight = false;
  }
}

// ── HTTP router ─────────────────────────────────────────────────────────────
async function handle(req, res) {
  // Expose server-side helpers (IndexNow, SEO cache) to insertArticle so it
  // can fire-and-forget IndexNow pings on every successful publish without
  // tightly coupling modules.
  if (req.app) insertArticle._app = req.app;

  const urlPath = req.url.split('?')[0];

  // ── PUBLIC cron trigger (no session, secret-protected) ───────────────────
  // Called by an external scheduler (cron-job.org, GitHub Actions, etc).
  // Responds within 1s with {started:true} and runs the batch in the
  // background so we never trip the scheduler's 30s timeout.
  // Accepts both GET and POST: cron-job.org defaults to GET, and the user
  // can also click the URL in a browser to manually verify it works.
  if (urlPath === '/api/cron/generate-batch' && (req.method === 'POST' || req.method === 'GET')) {
    const cfg = loadCronConfig();
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?') + 1) : '';
    const keyMatch = qs.match(/(?:^|&)key=([^&]*)/);
    const provided = keyMatch ? decodeURIComponent(keyMatch[1]) : (req.headers['x-cron-key'] || '');
    if (!provided || provided !== cfg.secret) {
      return jsonResponse(res, 401, { error: 'invalid key' });
    }
    if (!cfg.enabled) {
      return jsonResponse(res, 200, { skipped: 'disabled', message: 'التوليد التلقائي موقوف' });
    }
    if (cronInFlight) {
      return jsonResponse(res, 200, { skipped: 'busy', message: 'دفعة سابقة لا تزال تُنفَّذ' });
    }
    // Fire and forget. Log result via appendCronLog inside runCronBatch.
    runCronBatch({ trigger: 'cron' }).catch(e => {
      console.error('[bulk-admin] runCronBatch background error:', e.message);
    });
    return jsonResponse(res, 200, { started: true, message: 'تم بدء الدفعة في الخلفية' });
  }

  if (urlPath === '/api/bulk-admin/models' && req.method === 'GET') {
    const profiles = Object.fromEntries(Object.entries(SPEED_PROFILES).map(([k, v]) => [k, {
      label: v.label, description: v.description, recommendedModel: v.recommendedModel, concurrency: v.concurrency,
    }]));
    // Groq-only now: no provider switcher needed, the pool is managed server-side.
    const providers = { groq: { id: 'groq', label: PROVIDERS.groq.label, keyHint: PROVIDERS.groq.keyHint, keyUrl: PROVIDERS.groq.keyUrl, models: PROVIDERS.groq.models } };
    return jsonResponse(res, 200, { providers, models: FREE_MODELS, speedProfiles: profiles, allowedEmail: ALLOWED_EMAIL, groqPoolSize: GROQ_KEY_POOL.length });
  }

  if (urlPath === '/api/bulk-admin/groq-pool-status' && req.method === 'GET') {
    return jsonResponse(res, 200, groqPoolStatus());
  }

  if (urlPath === '/api/bulk-admin/public-config' && req.method === 'GET') {
    return jsonResponse(res, 200, publicConfig());
  }

  // Auth via Supabase Google session: client sends access_token, server verifies email
  if (urlPath === '/api/bulk-admin/auth-google' && req.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(req)) || '{}');
      const accessToken = body.accessToken;
      if (!accessToken) return jsonResponse(res, 400, { error: 'accessToken مطلوب' });
      const result = await verifySupabaseUser(accessToken);
      if (!result || result.error) {
        return jsonResponse(res, 401, { error: result?.error || 'فشل التحقق من الجلسة' });
      }
      const user = result.user;
      if (user.email !== ALLOWED_EMAIL) {
        return jsonResponse(res, 403, { error: `هذه اللوحة محصورة بالحساب ${ALLOWED_EMAIL} فقط. أنت داخل بـ ${user.email}.` });
      }
      const token = newSession(user.email);
      return jsonResponse(res, 200, { token, ttlMs: SESSION_TTL_MS, user: { email: user.email, name: user.name, avatar: user.avatar } });
    } catch (e) {
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  // ── Admin: delete article (PUBLIC route — auth via accessToken inside) ───
  // The admin SPA calls Supabase REST directly with the user's anon-key
  // session, which fails on DELETE when RLS blocks writes. We verify the
  // session belongs to ALLOWED_EMAIL then delete via the service role key.
  if (urlPath === '/api/admin/articles/delete' && req.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(req)) || '{}');
      const accessToken = body.accessToken;
      const id = body.id;
      if (!accessToken) return jsonResponse(res, 400, { error: 'accessToken مطلوب' });
      if (!id) return jsonResponse(res, 400, { error: 'id مطلوب' });

      const result = await verifySupabaseUser(accessToken);
      if (!result || result.error) return jsonResponse(res, 401, { error: result?.error || 'جلسة غير صالحة' });
      const user = result.user;
      if (user.email !== ALLOWED_EMAIL) {
        return jsonResponse(res, 403, { error: `الحذف محصور بالحساب ${ALLOWED_EMAIL}` });
      }
      if (!SUPABASE_URL || !SUPABASE_KEY) {
        return jsonResponse(res, 500, { error: 'إعدادات Supabase ناقصة على الخادم' });
      }
      const host = SUPABASE_URL.replace('https://', '').split('/')[0];
      const r = await httpsRequestJson({
        hostname: host,
        path: `/rest/v1/articles?id=eq.${encodeURIComponent(id)}`,
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Prefer': 'return=representation',
        },
        timeout: 15000,
      });
      if (r.status >= 200 && r.status < 300) {
        // Best-effort cache refresh so deleted articles disappear from /seo-data.json.
        try {
          const refresh = req.app && req.app.refreshSeoFromSupabase;
          if (typeof refresh === 'function') refresh();
        } catch (e) { }
        return jsonResponse(res, 200, { ok: true, deleted: r.json });
      }
      return jsonResponse(res, r.status || 500, { error: r.body || 'فشل الحذف' });
    } catch (e) {
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  if (!isAuthed(req)) return jsonResponse(res, 401, { error: 'انتهت الجلسة، أعد التحميل' });

  if (urlPath === '/api/bulk-admin/discover-topics' && req.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(req)) || '{}');
      const provider = 'groq';
      const apiKey = ''; // always use the rotating GROQ_KEY_POOL, never a client-supplied key
      const model = body.model || PROVIDERS[provider].models[0].id;
      const count = Math.max(1, Math.min(150, parseInt(body.count, 10) || 10));
      const mode = body.mode || 'trending';
      const category = body.category || '';
      const customSeed = body.customSeed || '';

      // For ALL modes, pull the last 100 article titles so the AI never
      // re-suggests something already in the encyclopedia. Cheap and high-impact.
      const recent = await fetchRecentArticles(100);
      const excludeTitles = recent.map(a => a.title).filter(Boolean);

      const out = await discoverTopics({ provider, apiKey, model, count, mode, category, customSeed, excludeTitles });
      return jsonResponse(res, 200, { ...out, excluded_count: excludeTitles.length });
    } catch (e) {
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  if (urlPath === '/api/bulk-admin/generate-one' && req.method === 'POST') {
    let parsedBody = null;
    let releaseSlot = null;
    try {
      parsedBody = JSON.parse((await readBody(req)) || '{}');
      const provider = 'groq';
      const apiKey = ''; // always use the rotating GROQ_KEY_POOL, never a client-supplied key
      const model = parsedBody.model || PROVIDERS[provider].models[0].id;
      const topic = parsedBody.topic;
      const templateId = parsedBody.templateId || null;
      const speed = parsedBody.speed || 'medium';
      if (!topic || !topic.title) return jsonResponse(res, 400, { error: 'topic.title مطلوب' });

      // ── Server-side concurrency gate ──
      // Why this exists: when the user hits "Generate" on 20 topics, the
      // browser fires up to N parallel POSTs to this endpoint. Each one then
      // does 1 article + 3 translation calls + image fetches + DB writes.
      // Without a gate the server's memory footprint balloons (open sockets,
      // pending promises, retry timers) and Replit's container kills the
      // process — which the user sees as "HTTP 502" on every subsequent
      // request. The gate lets through GENERATION_SLOTS workers at a time;
      // anyone else waits in line. Way better than crashing.
      releaseSlot = await acquireGenerationSlot();

      // Article-level retry: if every model hit 429/timeout/transient error,
      // wait a real cool-down (long enough for the per-minute quota to reset)
      // and try once more before giving up.
      let out, lastErr;
      const ATTEMPTS = 3;
      for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        try {
          out = await generateAndPublish({ provider, apiKey, model, topic, templateId, speed });
          break;
        } catch (e) {
          lastErr = e;
          const msg = (e.message || '').toLowerCase();
          // Don't retry permanent errors (bad key, quota exhausted for the day, validation).
          const transient = e.status === 429 || e.status === 408 || e.status === 500 || e.status === 502 || e.status === 503 || e.status === 504
            || /timeout|temporarily|rate[- ]?limit|too many|overloaded|empty|truncat|json|parse|بنية مقال|بدون أقسام|رجّع رد فارغ/i.test(msg);
          if (!transient || attempt === ATTEMPTS) throw e;
          const waitMs = 20000 * attempt; // 20s, 40s
          console.warn(`[bulk-admin] article attempt ${attempt}/${ATTEMPTS} failed (${(e.message || '').slice(0, 100)}), retrying in ${waitMs / 1000}s…`);
          await new Promise(rs => setTimeout(rs, waitMs));
        }
      }
      return jsonResponse(res, 200, { article: out });
    } catch (e) {
      const topicTitle = parsedBody?.topic?.title || '(no topic)';
      console.error('[bulk-admin] generate-one failed for topic:', topicTitle);
      console.error('[bulk-admin] error message:', e.message);
      if (e.geminiBody) console.error('[bulk-admin] gemini body:', JSON.stringify(e.geminiBody).slice(0, 500));
      if (e.providerBody) console.error('[bulk-admin] provider body:', JSON.stringify(e.providerBody).slice(0, 500));
      if (e.stack) console.error('[bulk-admin] stack:', e.stack.split('\n').slice(0, 5).join('\n'));
      return jsonResponse(res, 500, { error: e.message });
    } finally {
      if (releaseSlot) releaseSlot();
    }
  }

  // Preview Pexels/Wikimedia media (1 image + 1 video) for a list of topics, in parallel.
  // Used both for the initial batch preview under the discovered-topics list,
  // and for a single-topic "get me a different one" reroll (pass avoid_image_url /
  // avoid_video_url so we don't just hand back the same picture/clip).
  // Body: { topics: [{ title, category, image_query?, avoid_image_url?, avoid_video_url? }] }
  // Returns: { previews: [{ index, image_query, image, video }] }
  if (urlPath === '/api/bulk-admin/preview-media' && req.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(req)) || '{}');
      const topics = Array.isArray(body.topics) ? body.topics : [];
      if (topics.length === 0) return jsonResponse(res, 400, { error: 'topics فارغة' });

      // Build a guaranteed-English query per topic. Priority: explicit image_query > category fallback.
      // Images: Wikipedia/Wikimedia Commons first (same pipeline as real generation),
      // Pexels tops up if nothing relevant was found. Video stays Pexels-only.
      const previews = await Promise.all(topics.map(async (t, idx) => {
        const cat = t.category || '';
        const query = (t.image_query && t.image_query.trim())
          || CATEGORY_FALLBACK_QUERIES[cat]
          || 'modern abstract background';
        const fallbacks = [CATEGORY_FALLBACK_QUERIES[cat], 'business workspace', 'modern abstract'].filter(Boolean);
        const wikiTitle = t.source_name === 'wikipedia-trending' ? t.title : '';
        const avoidImg = t.avoid_image_url || null;
        const avoidVid = t.avoid_video_url || null;
        // "reroll all" sends every currently-shown image URL so the fresh
        // fetch can't just hand back the same deterministic Wikipedia/Commons
        // set again — without this, rerolling all 3 slots at once looked like
        // it did nothing because the query resolves to the same top results.
        const avoidImgUrls = Array.isArray(t.avoid_image_urls) ? t.avoid_image_urls : (avoidImg ? [avoidImg] : []);
        const pexelsOnly = !!t.pexels_only;
        const pexelsPage = Math.floor(Math.random() * 5) + 1; // vary results across reroll clicks

        const [imgs, vid] = await Promise.allSettled([
          fetchGroundedImages(query, 3, fallbacks, wikiTitle, { avoidUrls: avoidImgUrls, pexelsOnly, pexelsPage }),
          fetchPexelsVideo(query, fallbacks),
        ]);
        let imgList = imgs.status === 'fulfilled' && Array.isArray(imgs.value) ? imgs.value : [];
        const imgObjs = imgList.slice(0, 3).map(im => ({ url: im.url, thumb: im.thumb || im.url, photographer: im.photographer || '' }));
        let video = vid.status === 'fulfilled' && vid.value ? vid.value : null;
        // If a reroll landed on the exact same video, try once more with a fallback query.
        if (avoidVid && video && video.url === avoidVid) {
          const retry = await fetchPexelsVideo(fallbacks[0] || query, fallbacks.slice(1));
          if (retry && retry.url !== avoidVid) video = retry;
        }
        return {
          index: idx,
          image_query: query,
          images: imgObjs,
          image: imgObjs[0] || null,
          video: video ? { url: video.url, poster: video.poster, duration: video.duration, photographer: video.photographer || '' } : null,
        };
      }));
      return jsonResponse(res, 200, { previews });
    } catch (e) {
      console.error('[bulk-admin] preview-media failed:', e.message);
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  // ── Article image management (view / regenerate / replace) ────────────────
  // Shared shape-builder so the list endpoint and the single-article endpoint
  // (used right after generating an article) always return identical media
  // shapes for images AND video.
  function buildArticleMediaSummary(row) {
    let content = {};
    try { content = JSON.parse(row.content || '{}'); } catch (e) { content = {}; }
    const images = Array.isArray(content.images) ? content.images.filter(Boolean) : [];
    const arImages = content.languages && content.languages.ar && Array.isArray(content.languages.ar.images)
      ? content.languages.ar.images : [];
    const video = content.video || (content.languages && content.languages.ar && content.languages.ar.video) || null;
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      category: row.category,
      image_query: (content.languages && content.languages.ar && content.languages.ar.image_query) || null,
      images: images.map((url, i) => ({
        url,
        thumb: (arImages[i] && arImages[i].thumb) || url,
        photographer: (arImages[i] && arImages[i].photographer) || '',
        source: (arImages[i] && arImages[i].source) || '',
      })),
      video: video && video.url ? {
        url: video.url,
        poster: video.poster || null,
        duration: video.duration || null,
        photographer: video.photographer || video.title || '',
      } : null,
    };
  }

  // GET one article's media (images + video) by id — used right after
  // publishing so the "create" flow can show/manage media without a search.
  if (urlPath === '/api/bulk-admin/article-media' && req.method === 'GET') {
    try {
      if (!SUPABASE_URL || !SUPABASE_KEY) return jsonResponse(res, 500, { error: 'إعدادات Supabase ناقصة' });
      const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?') + 1) : '';
      const params = new URLSearchParams(qs);
      const id = params.get('id');
      if (!id) return jsonResponse(res, 400, { error: 'id مطلوب' });
      const host = SUPABASE_URL.replace('https://', '').split('/')[0];
      const r = await httpsRequestJson({
        hostname: host,
        path: `/rest/v1/articles?id=eq.${encodeURIComponent(id)}&select=id,title,slug,category,content`,
        method: 'GET',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY },
        timeout: 15000,
      });
      if (r.status !== 200 || !Array.isArray(r.json) || r.json.length === 0) {
        return jsonResponse(res, 404, { error: 'المقال غير موجود' });
      }
      return jsonResponse(res, 200, { article: buildArticleMediaSummary(r.json[0]) });
    } catch (e) {
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  // Regenerate an article's video (Pexels is the only video source).
  // Body: { id }
  if (urlPath === '/api/bulk-admin/regenerate-video' && req.method === 'POST') {
    try {
      if (!SUPABASE_URL || !SUPABASE_KEY) return jsonResponse(res, 500, { error: 'إعدادات Supabase ناقصة' });
      const body = JSON.parse((await readBody(req)) || '{}');
      const id = body.id;
      if (!id) return jsonResponse(res, 400, { error: 'id مطلوب' });

      const host = SUPABASE_URL.replace('https://', '').split('/')[0];
      const getR = await httpsRequestJson({
        hostname: host,
        path: `/rest/v1/articles?id=eq.${encodeURIComponent(id)}&select=id,title,category,content`,
        method: 'GET',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY },
        timeout: 15000,
      });
      if (getR.status !== 200 || !Array.isArray(getR.json) || getR.json.length === 0) {
        return jsonResponse(res, 404, { error: 'المقال غير موجود' });
      }
      const row = getR.json[0];
      let content;
      try { content = JSON.parse(row.content || '{}'); } catch (e) { content = {}; }
      if (!content.languages) content.languages = {};

      const arLang = content.languages.ar || {};
      const query = (arLang.video_query && String(arLang.video_query).trim())
        || (arLang.image_query && String(arLang.image_query).trim())
        || CATEGORY_FALLBACK_QUERIES[row.category]
        || row.title;
      const fallbacks = [CATEGORY_FALLBACK_QUERIES[row.category], 'business workspace'].filter(Boolean);
      const currentUrl = (content.video && content.video.url) || null;

      // Try a couple of times so a repeated "get new video" click doesn't
      // just hand back the exact same clip.
      let picked = null;
      for (let attempt = 0; attempt < 3 && !picked; attempt++) {
        const v = await fetchPexelsVideo(query, fallbacks);
        if (v && v.url && v.url !== currentUrl) picked = v;
        else if (v && !picked) picked = v; // last resort: same clip is still better than none
      }
      if (!picked) return jsonResponse(res, 502, { error: 'ما لقينا فيديو مناسب، جرب مرة ثانية' });

      const topLevelVideo = { url: picked.url, poster: picked.poster || null, duration: picked.duration || null, title: picked.photographer || '' };
      content.video = topLevelVideo;
      for (const lang of ['ar', 'en', 'fr', 'es']) {
        if (!content.languages[lang]) continue;
        content.languages[lang].video = topLevelVideo;
      }

      const patchR = await httpsRequestJson({
        hostname: host,
        path: `/rest/v1/articles?id=eq.${encodeURIComponent(id)}`,
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: { content: JSON.stringify(content) },
        timeout: 20000,
      });
      if (patchR.status < 200 || patchR.status >= 300) {
        return jsonResponse(res, patchR.status || 500, { error: patchR.body || 'فشل الحفظ' });
      }
      try {
        const refresh = req.app && req.app.refreshSeoFromSupabase;
        if (typeof refresh === 'function') refresh();
      } catch (e) { }
      return jsonResponse(res, 200, {
        ok: true,
        video: { url: picked.url, poster: picked.poster || null, duration: picked.duration || null, photographer: picked.photographer || '' },
      });
    } catch (e) {
      console.error('[bulk-admin] regenerate-video failed:', e.message);
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  // GET list of articles with their current images, optional ?search= filter by title.
  if (urlPath === '/api/bulk-admin/articles-list' && req.method === 'GET') {
    try {
      if (!SUPABASE_URL || !SUPABASE_KEY) return jsonResponse(res, 500, { error: 'إعدادات Supabase ناقصة' });
      const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?') + 1) : '';
      const params = new URLSearchParams(qs);
      const search = (params.get('search') || '').trim();
      const limit = Math.max(1, Math.min(100, parseInt(params.get('limit'), 10) || 30));
      const offset = Math.max(0, parseInt(params.get('offset'), 10) || 0);
      const host = SUPABASE_URL.replace('https://', '').split('/')[0];
      let path = `/rest/v1/articles?select=id,title,slug,category,content&order=id.desc&limit=${limit}&offset=${offset}`;
      if (search) path += `&title=ilike.*${encodeURIComponent(search)}*`;
      const r = await httpsRequestJson({
        hostname: host,
        path,
        method: 'GET',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY },
        timeout: 15000,
      });
      if ((r.status !== 200 && r.status !== 206) || !Array.isArray(r.json)) {
        return jsonResponse(res, r.status || 500, { error: r.body || 'فشل جلب المقالات' });
      }
      const articles = r.json.map(row => buildArticleMediaSummary(row));
      return jsonResponse(res, 200, { articles });
    } catch (e) {
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  // Regenerate one article's images. body: { id, mode: 'auto'|'pexels', slot: 'all' | <index 0..2> }
  if (urlPath === '/api/bulk-admin/regenerate-images' && req.method === 'POST') {
    try {
      if (!SUPABASE_URL || !SUPABASE_KEY) return jsonResponse(res, 500, { error: 'إعدادات Supabase ناقصة' });
      const body = JSON.parse((await readBody(req)) || '{}');
      const id = body.id;
      const mode = body.mode === 'pexels' ? 'pexels' : 'auto';
      const slot = body.slot;
      if (!id) return jsonResponse(res, 400, { error: 'id مطلوب' });

      const host = SUPABASE_URL.replace('https://', '').split('/')[0];
      const getR = await httpsRequestJson({
        hostname: host,
        path: `/rest/v1/articles?id=eq.${encodeURIComponent(id)}&select=id,title,category,content`,
        method: 'GET',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY },
        timeout: 15000,
      });
      if (getR.status !== 200 || !Array.isArray(getR.json) || getR.json.length === 0) {
        return jsonResponse(res, 404, { error: 'المقال غير موجود' });
      }
      const row = getR.json[0];
      let content;
      try { content = JSON.parse(row.content || '{}'); } catch (e) { content = {}; }
      if (!content.languages) content.languages = {};

      const arLang = content.languages.ar || {};
      const query = (arLang.image_query && String(arLang.image_query).trim()) || CATEGORY_FALLBACK_QUERIES[row.category] || row.title;
      const fallbacks = [CATEGORY_FALLBACK_QUERIES[row.category], 'business workspace', 'modern abstract'].filter(Boolean);

      const existingUrls = Array.isArray(content.images) ? content.images.filter(Boolean) : [];

      let newImages;
      if (slot === 'all' || slot === undefined || slot === null) {
        newImages = mode === 'pexels'
          ? await fetchPexelsImages(query, 3, fallbacks)
          : await fetchGroundedImages(query, 3, fallbacks, null);
        if (!newImages || newImages.length === 0) {
          return jsonResponse(res, 502, { error: 'ما لقينا صور مناسبة، جرب مرة ثانية' });
        }
      } else {
        const idx = parseInt(String(slot), 10);
        if (isNaN(idx) || idx < 0 || idx > 2) return jsonResponse(res, 400, { error: 'slot غير صالح' });

        // Get candidates — first from the requested source, then auto-fallback.
        let candidates = mode === 'pexels'
          ? await fetchPexelsImages(query, 6, fallbacks)
          : await fetchGroundedImages(query, 6, fallbacks, null);
        if (!candidates || candidates.length === 0) {
          candidates = await fetchPexelsImages(query, 6, fallbacks);
        }

        // Build a strict canonical 3-slot array.
        // Only use arLang.images if every entry is a proper {url} object.
        // Otherwise reconstruct from the flat top-level URL array so we never
        // corrupt slot semantics with raw strings or unexpected array sizes.
        const isRichArray = Array.isArray(arLang.images)
          && arLang.images.length === 3
          && arLang.images.every(im => im && typeof im === 'object' && typeof im.url === 'string');
        const canonical = isRichArray
          ? arLang.images.slice()
          : (() => {
              const base = Array.from({ length: 3 }, (_, i) =>
                existingUrls[i] ? { url: existingUrls[i] } : null
              );
              return base;
            })();

        // Pick a candidate not already used in any other slot (strict uniqueness).
        const otherUrls = new Set(
          canonical.filter((im, i) => i !== idx && im && im.url).map(im => im.url)
        );
        const pick = (candidates || []).find(im => im && im.url && !otherUrls.has(im.url)) || null;
        if (!pick) return jsonResponse(res, 502, { error: 'ما لقينا صورة بديلة مناسبة، جرب مرة ثانية' });

        canonical[idx] = pick;
        newImages = canonical; // strict 3-slot array, nulls handled below
      }

      // Normalize — keep null slots in place so slot indices are preserved,
      // but filter them out for the flat images / cover arrays.
      const safeImages = newImages.map(im => im && im.url ? im : null);
      const topLevelImages = safeImages.filter(Boolean).map(im => im.url);
      const richImages = safeImages.map(im =>
        im ? { url: im.url, thumb: im.thumb || im.url, photographer: im.photographer || '', source: im.source || '' } : null
      );
      content.images = topLevelImages;
      content.cover_image = topLevelImages[0] || null;
      content.cover = topLevelImages[0] || null;
      for (const lang of ['ar', 'en', 'fr', 'es']) {
        if (!content.languages[lang]) continue;
        content.languages[lang].images = richImages;
        content.languages[lang].cover_image = topLevelImages[0] || null;
        content.languages[lang].cover = topLevelImages[0] || null;
      }

      const patchR = await httpsRequestJson({
        hostname: host,
        path: `/rest/v1/articles?id=eq.${encodeURIComponent(id)}`,
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: { content: JSON.stringify(content) },
        timeout: 20000,
      });
      if (patchR.status < 200 || patchR.status >= 300) {
        return jsonResponse(res, patchR.status || 500, { error: patchR.body || 'فشل الحفظ' });
      }
      try {
        const refresh = req.app && req.app.refreshSeoFromSupabase;
        if (typeof refresh === 'function') refresh();
      } catch (e) { }
      return jsonResponse(res, 200, {
        ok: true,
        images: safeImages.filter(Boolean).map(im => ({ url: im.url, thumb: im.thumb || im.url, photographer: im.photographer || '', source: im.source || '' })),
      });
    } catch (e) {
      console.error('[bulk-admin] regenerate-images failed:', e.message);
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  // ── Auto-generator admin routes ──────────────────────────────────────────
  if (urlPath === '/api/bulk-admin/cron-config' && req.method === 'GET') {
    const cfg = loadCronConfig();
    const log = loadCronLog();
    const baseUrl = getPublicBaseUrl(req);
    return jsonResponse(res, 200, {
      config: { ...cfg, apiKey: maskApiKey(cfg.apiKey), hasApiKey: !!cfg.apiKey },
      cronUrl: `${baseUrl}/api/cron/generate-batch?key=${cfg.secret}`,
      log,
      inFlight: cronInFlight,
    });
  }

  if (urlPath === '/api/bulk-admin/cron-config' && req.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(req)) || '{}');
      const cfg = loadCronConfig();
      // Provider is always Groq (rotating pool) — never accept provider/apiKey
      // from the client anymore. Only these fields are client-configurable.
      const allowed = ['enabled', 'speed', 'count', 'mode', 'category', 'customSeed', 'dailyLimit'];
      for (const k of allowed) if (k in body) cfg[k] = body[k];
      cfg.provider = 'groq';
      cfg.model = PROVIDERS.groq.models[0].id;
      cfg.apiKey = '';
      // Coerce numerics + clamp to sane ranges.
      cfg.count = Math.max(1, Math.min(20, parseInt(cfg.count, 10) || 5));
      cfg.dailyLimit = Math.max(1, Math.min(500, parseInt(cfg.dailyLimit, 10) || 50));
      saveCronConfig(cfg);
      return jsonResponse(res, 200, { ok: true, config: { ...cfg, apiKey: maskApiKey(cfg.apiKey), hasApiKey: !!cfg.apiKey } });
    } catch (e) {
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  if (urlPath === '/api/bulk-admin/cron-regenerate-secret' && req.method === 'POST') {
    const cfg = loadCronConfig();
    cfg.secret = crypto.randomBytes(24).toString('hex');
    saveCronConfig(cfg);
    const baseUrl = getPublicBaseUrl(req);
    return jsonResponse(res, 200, { secret: cfg.secret, cronUrl: `${baseUrl}/api/cron/generate-batch?key=${cfg.secret}` });
  }

  if (urlPath === '/api/bulk-admin/cron-run-now' && req.method === 'POST') {
    const cfg = loadCronConfig();
    if (!GROQ_KEY_POOL.length) return jsonResponse(res, 400, { error: 'لا يوجد أي مفتاح Groq صالح في GROQ_KEY_POOL' });
    if (cronInFlight) return jsonResponse(res, 200, { skipped: 'busy', message: 'دفعة قيد التنفيذ' });
    runCronBatch({ trigger: 'manual' }).catch(e => console.error('[bulk-admin] manual run error:', e.message));
    return jsonResponse(res, 200, { started: true });
  }

  if (urlPath === '/api/bulk-admin/cron-status' && req.method === 'GET') {
    return jsonResponse(res, 200, { inFlight: cronInFlight, log: loadCronLog().slice(0, 10) });
  }

  // ── IndexNow: status + bulk resubmit of ALL articles ───────────────────────
  if (urlPath === '/api/bulk-admin/indexnow-status' && req.method === 'GET') {
    const app = req.app || {};
    const cache = app.seoDataCache || {};
    const slugs = Object.keys(cache);
    return jsonResponse(res, 200, {
      key: app.INDEXNOW_KEY || null,
      keyUrl: (app.INDEXNOW_KEY && app.SITE_URL) ? `${app.SITE_URL}/${app.INDEXNOW_KEY}.txt` : null,
      articleCount: slugs.length,
      totalUrlsIfResubmit: slugs.length * 5,
    });
  }

  if (urlPath === '/api/bulk-admin/indexnow-resubmit-all' && req.method === 'POST') {
    const app = req.app || {};
    if (typeof app.submitIndexNow !== 'function') {
      return jsonResponse(res, 500, { error: 'IndexNow غير متاح' });
    }
    const slugs = Object.keys(app.seoDataCache || {});
    if (slugs.length === 0) return jsonResponse(res, 200, { ok: true, sent: 0, message: 'الكاش فارغ' });

    // Collect every URL (canonical + 4 langs) for every article + key static pages.
    const langs = ['ar', 'en', 'fr', 'es'];
    const urls = [];
    const staticPaths = ['/', '/articles', '/categories', '/about'];
    for (const p of staticPaths) {
      urls.push(`${app.SITE_URL}${p}`);
      for (const l of langs) urls.push(`${app.SITE_URL}/${l}${p === '/' ? '/' : p}`);
    }
    for (const slug of slugs) urls.push(...app.articleUrlsForIndexNow(slug));

    // IndexNow accepts up to 10k URLs per request — chunk to be safe.
    const chunks = [];
    for (let i = 0; i < urls.length; i += 1000) chunks.push(urls.slice(i, i + 1000));
    const results = [];
    for (const chunk of chunks) {
      const r = await app.submitIndexNow(chunk);
      if (typeof app.submitGoogleIndexingAPI === 'function') {
        await app.submitGoogleIndexingAPI(chunk).catch(()=>{});
      }
      results.push({ count: chunk.length, status: r.status, ok: r.ok });
    }
    return jsonResponse(res, 200, { ok: true, totalUrls: urls.length, batches: results });
  }

  if (urlPath === '/api/bulk-admin/refresh-cache' && req.method === 'POST') {
    try {
      const refresh = req.app && req.app.refreshSeoFromSupabase;
      if (typeof refresh === 'function') await refresh();
      return jsonResponse(res, 200, { ok: true });
    } catch (e) {
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  return jsonResponse(res, 404, { error: 'Not found' });
}

// Public bootstrap config (used by HTML page before login)
function publicConfig() {
  return {
    supabaseUrl: SUPABASE_URL || '',
    allowedEmail: ALLOWED_EMAIL,
  };
}

// Build the public-facing base URL for cron links and similar.
// Priority: SITE_URL → REPLIT_DOMAINS → REPLIT_DEV_DOMAIN → request Host header → localhost.
// Without this, the cron URL would point to localhost:5000 (useless to an external scheduler).
function getPublicBaseUrl(req) {
  const env = process.env;
  if (env.SITE_URL && /^https?:\/\//i.test(env.SITE_URL)) {
    return env.SITE_URL.replace(/\/+$/, '');
  }
  if (env.REPLIT_DOMAINS) {
    const dom = env.REPLIT_DOMAINS.split(',')[0].trim();
    if (dom) return 'https://' + dom;
  }
  if (env.REPLIT_DEV_DOMAIN) {
    return 'https://' + env.REPLIT_DEV_DOMAIN;
  }
  if (req && req.headers && req.headers.host) {
    const host = req.headers.host;
    const proto = req.headers['x-forwarded-proto']
      || (host.includes('localhost') || host.startsWith('127.') ? 'http' : 'https');
    return `${proto}://${host}`;
  }
  return 'http://localhost:5000';
}

module.exports = { handle, FREE_MODELS, publicConfig };
