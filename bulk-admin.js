// bulk-admin.js — AI-powered bulk article generator for Dalilek
// Routes mounted under /api/bulk-admin/*
const https = require('https');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const ALLOWED_EMAIL = (process.env.BULK_ADMIN_EMAIL || 'cpshzt@gmail.com').toLowerCase();

// Verified working free models on OpenRouter (queried 2026-04)
const FREE_MODELS = [
  { id: 'openai/gpt-oss-120b:free',                          label: 'OpenAI GPT-OSS 120B (الأقوى — موصى به)' },
  { id: 'qwen/qwen3-next-80b-a3b-instruct:free',             label: 'Qwen 3 Next 80B (ممتاز للعربي)' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free',            label: 'Llama 3.3 70B' },
  { id: 'z-ai/glm-4.5-air:free',                             label: 'GLM 4.5 Air' },
  { id: 'nvidia/nemotron-3-super-120b-a12b:free',            label: 'Nvidia Nemotron Super 120B' },
  { id: 'google/gemma-3-27b-it:free',                        label: 'Google Gemma 3 27B' },
  { id: 'openai/gpt-oss-20b:free',                           label: 'OpenAI GPT-OSS 20B (سريع)' },
  { id: 'nvidia/nemotron-nano-9b-v2:free',                   label: 'Nvidia Nemotron Nano 9B (سريع)' },
];

// Speed profiles — control prompt depth, output budget, and concurrency
const SPEED_PROFILES = {
  fast: {
    label: '⚡ سريع',
    description: 'نموذج خفيف، 3-4 أقسام مختصرة، مقالان بالتوازي (مع 4 لغات لكل واحد)',
    recommendedModel: 'nvidia/nemotron-nano-9b-v2:free',
    maxTokens: 3500,
    minSections: 3, maxSections: 4,
    sectionLength: '100-150 كلمة',
    concurrency: 2,
    skillsCount: 4,
    statsCount: 3,
  },
  medium: {
    label: '⚖️ متوسط',
    description: 'نموذج قوي، 4-5 أقسام متوازنة، مقال واحد كل مرة (مع 4 لغات)',
    recommendedModel: 'openai/gpt-oss-120b:free',
    maxTokens: 5500,
    minSections: 4, maxSections: 5,
    sectionLength: '150-220 كلمة',
    concurrency: 1,
    skillsCount: 4,
    statsCount: 3,
  },
  thorough: {
    label: '💎 الأفضل',
    description: 'نموذج ضخم، 5-6 أقسام معمّقة، توليد تسلسلي للجودة القصوى',
    recommendedModel: 'openai/gpt-oss-120b:free',
    maxTokens: 6000,
    minSections: 5, maxSections: 6,
    sectionLength: '200-280 كلمة',
    concurrency: 1,
    skillsCount: 5,
    statsCount: 4,
    timeoutMs: 300000,
    useJsonMode: false,
  },
};

const sessions = new Map();
const SESSION_TTL_MS = 4 * 60 * 60 * 1000;

function newSession(email) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { createdAt: Date.now(), email });
  return token;
}

function isAuthed(req) {
  const token = (req.headers['x-bulk-admin-token'] || '').trim();
  if (!token) return false;
  const s = sessions.get(token);
  if (!s) return false;
  if (Date.now() - s.createdAt > SESSION_TTL_MS) {
    sessions.delete(token);
    return false;
  }
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

// ── Verify Supabase user via access_token ───────────────────────────────────
async function verifySupabaseUser(accessToken) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !accessToken) return null;
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
    if (r.status !== 200 || !r.json) return null;
    return {
      id: r.json.id,
      email: (r.json.email || '').toLowerCase(),
      provider: r.json.app_metadata?.provider,
      name: r.json.user_metadata?.full_name || r.json.user_metadata?.name,
      avatar: r.json.user_metadata?.avatar_url || r.json.user_metadata?.picture,
    };
  } catch (e) {
    return null;
  }
}

// ── OpenRouter call with auto-fallback ─────────────────────────────────────
async function callOpenRouter({ apiKey, model, messages, jsonMode = false, maxTokens = 4096, timeoutMs = 180000 }) {
  if (!apiKey) throw new Error('مفتاح OpenRouter مطلوب');
  const payload = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature: 0.8,
  };
  if (jsonMode) payload.response_format = { type: 'json_object' };
  const r = await httpsRequestJson({
    hostname: 'openrouter.ai',
    path: '/api/v1/chat/completions',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.SITE_URL || 'https://dalilek.com',
      'X-Title': 'Dalilek Bulk Admin',
    },
    body: payload,
    timeout: timeoutMs,
  });
  if (r.status !== 200) {
    const msg = (r.json && (r.json.error?.message || r.json.message)) || r.body.slice(0, 300);
    const err = new Error(`OpenRouter ${r.status}: ${msg}`);
    err.status = r.status;
    err.openRouterBody = r.json;
    throw err;
  }
  const text = r.json?.choices?.[0]?.message?.content;
  if (!text) throw new Error('OpenRouter رجّع رد فارغ');
  return text;
}

async function callOpenRouterWithFallback({ apiKey, model, messages, jsonMode, maxTokens, timeoutMs }) {
  // Try the requested model first; if it 404s/errors, try fallbacks
  const fallbackOrder = [model, ...FREE_MODELS.map(m => m.id).filter(id => id !== model)];
  let lastError = null;
  for (const m of fallbackOrder.slice(0, 4)) {
    try {
      return { text: await callOpenRouter({ apiKey, model: m, messages, jsonMode, maxTokens, timeoutMs }), modelUsed: m };
    } catch (e) {
      lastError = e;
      // If 401/403 (bad key), don't try fallbacks
      if (e.status === 401 || e.status === 403) throw e;
      // For 404 (model not available), 429 (rate limit), 5xx, timeouts — try next
      continue;
    }
  }
  throw lastError || new Error('كل النماذج فشلت');
}

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
      else if (ch === '}') { depth--; if (depth === 0) {
        const j = tryParse(str.slice(start, i + 1)); if (j) return j;
        break;
      }}
    }
  }
  // Last resort: try to repair a truncated JSON object
  const repaired = repairTruncatedJson(str);
  if (repaired) return repaired;
  throw new Error('فشل تحليل JSON من رد الذكاء الاصطناعي');
}

// ── Topic discovery ────────────────────────────────────────────────────────
async function discoverTopics({ apiKey, model, count, mode, category, customSeed }) {
  let userPrompt;
  if (mode === 'custom' && customSeed) {
    userPrompt = `أعطني ${count} عناوين فريدة لمقالات معمّقة باللغة العربية مستوحاة من هذا الموضوع/الكلمة المفتاحية: "${customSeed}". لا تكرر العنوان نفسه. كل عنوان لازم يكون جذاب، عملي، ويثير الاهتمام.`;
  } else if (mode === 'category' && category) {
    userPrompt = `أعطني ${count} عناوين فريدة لمقالات الأكثر بحثاً وطلباً عالمياً عام 2026 في فئة "${category}". اختر مواضيع رائجة فعلاً، عملية، مع زاوية حديثة لعام 2026.`;
  } else {
    userPrompt = `أعطني ${count} عناوين فريدة لأكثر المقالات رواجاً وبحثاً عالمياً في عام 2026 على الإنترنت. غطّ مواضيع متنوعة (تكنولوجيا، صحة، مال، تطوير ذات، ثقافة، علوم، أسلوب حياة). اختر مواضيع يبحث عنها الناس فعلاً، وأعطها زاوية حديثة 2026.`;
  }

  const sys = `أنت محرر تحرير محتوى عربي خبير في SEO وتحليل اتجاهات البحث عالمياً. تُرجع دائماً JSON صالح فقط بدون أي شرح.

التنسيق المطلوب بالضبط:
{
  "topics": [
    { "title": "العنوان بالعربية", "category": "فئة عربية واحدة", "keywords": "كلمة1, كلمة2, كلمة3, ..." },
    ...
  ]
}

الفئات المسموحة (اختر واحدة فقط لكل مقال): تكنولوجيا، صحة، مال وأعمال، تطوير ذات، ثقافة، علوم، أسلوب حياة، طعام، رياضة، تعليم، سفر، ترفيه.

ملاحظة مهمة: لكل موضوع، أعطِ كذلك حقل "image_query" بالإنجليزية فقط (3-6 كلمات وصفية بصرية) عشان نجلب صورة من Pexels. مثال: "modern home office workspace" أو "person meditation sunset beach". لا تستعمل العربية في image_query.

الشكل النهائي:
{
  "topics": [
    {
      "title": "العنوان بالعربية",
      "category": "فئة عربية",
      "keywords": "كلمة1, كلمة2, ...",
      "image_query": "english visual keywords"
    }
  ]
}`;

  const out = await callOpenRouterWithFallback({
    apiKey, model,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: userPrompt },
    ],
    jsonMode: true,
    maxTokens: 4096,
    timeoutMs: 180000,
  });
  const j = extractJson(out.text);
  const topics = Array.isArray(j.topics) ? j.topics : [];
  return {
    modelUsed: out.modelUsed,
    topics: topics.slice(0, count).map(t => ({
      title: String(t.title || '').trim(),
      category: String(t.category || 'ثقافة').trim(),
      keywords: String(t.keywords || '').trim(),
      image_query: String(t.image_query || '').trim(),
    })).filter(t => t.title),
  };
}

// ── Article generation ────────────────────────────────────────────────────
async function generateArticle({ apiKey, model, topic, speed = 'medium' }) {
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
  "seo_description": "وصف SEO باللغة العربية 150-160 حرف",
  "seo_keywords": "كلمة1, كلمة2, كلمة3, ... (10-15 كلمة مفصولة بفواصل)",
  "image_query": "english search query for stock photos describing the article topic visually (3-6 words)",
  "video_query": "english search query for stock VIDEOS related to the topic (3-5 words, slightly different angle than image_query)"
}

شروط حرجة:
- الـ slug إنجليزي صرف، أحرف صغيرة، شرطات بدل الفراغ، بدون رموز خاصة، بدون أحرف عربية إطلاقاً.
- أنشئ بالضبط ${profile.statsCount} عنصر في stats.
- أنشئ من ${profile.minSections} إلى ${profile.maxSections} أقسام (sections). كل قسم ${profile.sectionLength}. الـcallout اختياري في بعضها (يمكن أن يكون null).
- أنشئ بالضبط ${profile.skillsCount} مهارات (skills).
- المحتوى أصلي ومفيد وليس مكرراً.
- الـ image_query والـ video_query بالإنجليزية فقط ووصفي بصرياً (مثل "modern home office workspace" و "person working laptop coffee shop").`;

  const userPrompt = `الموضوع: "${topic.title}"
الفئة: ${topic.category}
الكلمات المفتاحية المقترحة: ${topic.keywords || 'لا يوجد'}

أنشئ مقالاً كاملاً عالي الجودة وفق التنسيق المحدد. اجعل المحتوى عملياً ومحدّثاً لعام 2026.`;

  const useJsonMode = profile.useJsonMode !== false; // default true unless profile explicitly disables it
  const timeoutMs = profile.timeoutMs || 180000;
  const out = await callOpenRouterWithFallback({
    apiKey, model,
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
async function _pexelsSearchImages(query, count) {
  const q = encodeURIComponent(String(query || '').slice(0, 100));
  if (!q) return [];
  try {
    const r = await httpsRequestJson({
      hostname: 'api.pexels.com',
      path: `/v1/search?query=${q}&per_page=${count}&orientation=landscape`,
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

async function fetchPexelsImages(query, count = 3, fallbackQueries = []) {
  if (!PEXELS_API_KEY) return [];
  let images = await _pexelsSearchImages(query, count);
  // If too few results, try fallback queries (e.g. category-based, or generic)
  for (const fb of fallbackQueries) {
    if (images.length >= count) break;
    if (!fb) continue;
    const more = await _pexelsSearchImages(fb, count - images.length);
    // Dedupe by URL
    const seen = new Set(images.map(i => i.url));
    for (const m of more) if (!seen.has(m.url)) { images.push(m); seen.add(m.url); }
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
  if (r.status >= 200 && r.status < 300 && Array.isArray(r.json) && r.json.length > 0) return r.json[0];
  const msg = (r.json && (r.json.message || r.json.hint || r.json.details)) || r.body.slice(0, 300);
  throw new Error(`Supabase insert ${r.status}: ${msg}`);
}

// Translate a finished Arabic article into another language.
// Returns { title, intro, sections, skills, conclusion, seo_description, seo_keywords }
async function translateArticle({ apiKey, model, article, targetLang }) {
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
  "seo_description": "natural ${langName} SEO description, 150-160 chars, NOT a literal translation but optimized for ${langName} search",
  "seo_keywords": "10-15 ${langName} SEO keywords separated by commas"
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

  const out = await callOpenRouterWithFallback({
    apiKey, model,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: 'Arabic source article:\n' + JSON.stringify(sourcePayload) + `\n\nTranslate every text field into ${langName}. Keep arrays the same length. Output JSON only.` },
    ],
    jsonMode: false,
    maxTokens: 6000,
    timeoutMs: 240000,
  });
  return extractJson(out.text);
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
    seo_keywords: translated.seo_keywords || '',
    cover_image: media.cover_image,
    cover: media.cover_image,
    images: media.images,
    video: media.video,
  };
}

async function generateAndPublish({ apiKey, model, topic, templateId, speed = 'medium' }) {
  const { article, modelUsed, profile } = await generateArticle({ apiKey, model, topic, speed });
  if (!article || !article.title || !article.slug) {
    throw new Error('AI رجّع بنية مقال غير صالحة');
  }

  // Normalize slug now so we can use it as a guaranteed-English Pexels fallback.
  const slugBase = normalizeSlug(article.slug);
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

  // Run media fetch in parallel with the 3 translations to shave latency.
  const [imagesResult, videoResult, enRes, frRes, esRes] = await Promise.allSettled([
    fetchPexelsImages(imageQuery, 3, imageFallbacks),
    fetchPexelsVideo(videoQuery, videoFallbacks),
    translateArticle({ apiKey, model, article, targetLang: 'en' }),
    translateArticle({ apiKey, model, article, targetLang: 'fr' }),
    translateArticle({ apiKey, model, article, targetLang: 'es' }),
  ]);

  const images = imagesResult.status === 'fulfilled' ? (imagesResult.value || []) : [];
  const video = videoResult.status === 'fulfilled' ? videoResult.value : null;
  const media = { cover_image: images[0]?.url || null, images, video };

  const arContent = {
    title: article.title,
    intro: article.intro,
    stats: Array.isArray(article.stats) ? article.stats.slice(0, profile.statsCount) : [],
    sections: Array.isArray(article.sections) ? article.sections.slice(0, profile.maxSections) : [],
    skills: Array.isArray(article.skills) ? article.skills.slice(0, profile.skillsCount) : [],
    conclusion: article.conclusion,
    seo_description: article.seo_description || '',
    seo_keywords: article.seo_keywords || '',
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
  const tpl = templateId || (Math.floor(Math.random() * 14) + 1);

  // Build a multilingual SEO description/keywords payload for the SEO refresh.
  const seoDescriptionMultilingual = {
    ar: arContent.seo_description || '',
    en: enContent.seo_description || arContent.seo_description || '',
    fr: frContent.seo_description || arContent.seo_description || '',
    es: esContent.seo_description || arContent.seo_description || '',
  };
  const seoKeywordsMultilingual = {
    ar: arContent.seo_keywords || topic.keywords || '',
    en: enContent.seo_keywords || arContent.seo_keywords || '',
    fr: frContent.seo_keywords || arContent.seo_keywords || '',
    es: esContent.seo_keywords || arContent.seo_keywords || '',
  };

  const record = {
    title: article.title,
    slug,
    content: JSON.stringify(content),
    template_id: tpl,
    seo_keywords: article.seo_keywords || topic.keywords || '',
    category: topic.category,
    seo_description: article.seo_description || '',
    seo_keywords_multilingual: seoKeywordsMultilingual,
    seo_description_multilingual: seoDescriptionMultilingual,
    views: 0,
  };

  let inserted;
  try {
    inserted = await insertArticle(record);
  } catch (e) {
    // Some Supabase schemas don't have the *_multilingual columns; retry without them.
    if (/seo_(keywords|description)_multilingual/i.test(e.message)) {
      delete record.seo_keywords_multilingual;
      delete record.seo_description_multilingual;
      inserted = await insertArticle(record);
    } else {
      throw e;
    }
  }
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

// ── HTTP router ─────────────────────────────────────────────────────────────
async function handle(req, res) {
  const urlPath = req.url.split('?')[0];

  if (urlPath === '/api/bulk-admin/models' && req.method === 'GET') {
    const profiles = Object.fromEntries(Object.entries(SPEED_PROFILES).map(([k, v]) => [k, {
      label: v.label, description: v.description, recommendedModel: v.recommendedModel, concurrency: v.concurrency,
    }]));
    return jsonResponse(res, 200, { models: FREE_MODELS, speedProfiles: profiles, allowedEmail: ALLOWED_EMAIL });
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
      const user = await verifySupabaseUser(accessToken);
      if (!user) return jsonResponse(res, 401, { error: 'فشل التحقق من جلسة Supabase. الرجاء تسجيل الدخول من لوحة الإدارة الرئيسية أولاً.' });
      if (user.email !== ALLOWED_EMAIL) {
        return jsonResponse(res, 403, { error: `هذه اللوحة محصورة بالحساب ${ALLOWED_EMAIL} فقط. أنت داخل بـ ${user.email}.` });
      }
      const token = newSession(user.email);
      return jsonResponse(res, 200, { token, ttlMs: SESSION_TTL_MS, user: { email: user.email, name: user.name, avatar: user.avatar } });
    } catch (e) {
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  if (!isAuthed(req)) return jsonResponse(res, 401, { error: 'انتهت الجلسة، أعد التحميل' });

  if (urlPath === '/api/bulk-admin/discover-topics' && req.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(req)) || '{}');
      const apiKey = body.apiKey;
      const model = body.model || FREE_MODELS[0].id;
      const count = Math.max(1, Math.min(150, parseInt(body.count, 10) || 10));
      const mode = body.mode || 'trending';
      const category = body.category || '';
      const customSeed = body.customSeed || '';
      const out = await discoverTopics({ apiKey, model, count, mode, category, customSeed });
      return jsonResponse(res, 200, out);
    } catch (e) {
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  if (urlPath === '/api/bulk-admin/generate-one' && req.method === 'POST') {
    let parsedBody = null;
    try {
      parsedBody = JSON.parse((await readBody(req)) || '{}');
      const apiKey = parsedBody.apiKey;
      const model = parsedBody.model || FREE_MODELS[0].id;
      const topic = parsedBody.topic;
      const templateId = parsedBody.templateId || null;
      const speed = parsedBody.speed || 'medium';
      if (!topic || !topic.title) return jsonResponse(res, 400, { error: 'topic.title مطلوب' });
      const out = await generateAndPublish({ apiKey, model, topic, templateId, speed });
      return jsonResponse(res, 200, { article: out });
    } catch (e) {
      const topicTitle = parsedBody?.topic?.title || '(no topic)';
      console.error('[bulk-admin] generate-one failed for topic:', topicTitle);
      console.error('[bulk-admin] error message:', e.message);
      if (e.openRouterBody) console.error('[bulk-admin] openrouter body:', JSON.stringify(e.openRouterBody).slice(0, 500));
      if (e.stack) console.error('[bulk-admin] stack:', e.stack.split('\n').slice(0, 5).join('\n'));
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  // Preview Pexels media (1 image thumb + 1 video thumb) for a list of topics, in parallel.
  // Body: { topics: [{ title, category, image_query? }] }
  // Returns: { previews: [{ index, image_query, image, video }] }
  if (urlPath === '/api/bulk-admin/preview-media' && req.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(req)) || '{}');
      const topics = Array.isArray(body.topics) ? body.topics : [];
      if (!PEXELS_API_KEY) return jsonResponse(res, 500, { error: 'مفتاح PEXELS_API_KEY غير مضبوط على الخادم' });
      if (topics.length === 0) return jsonResponse(res, 400, { error: 'topics فارغة' });

      // Build a guaranteed-English query per topic. Priority: explicit image_query > category fallback.
      // (We never use the Arabic title as a Pexels query — it returns 0 results.)
      const previews = await Promise.all(topics.map(async (t, idx) => {
        const cat = t.category || '';
        const query = (t.image_query && t.image_query.trim())
          || CATEGORY_FALLBACK_QUERIES[cat]
          || 'modern abstract background';
        const fallbacks = [CATEGORY_FALLBACK_QUERIES[cat], 'business workspace', 'modern abstract'].filter(Boolean);
        const [imgs, vid] = await Promise.allSettled([
          fetchPexelsImages(query, 1, fallbacks),
          fetchPexelsVideo(query, fallbacks),
        ]);
        const img = imgs.status === 'fulfilled' && imgs.value && imgs.value[0] ? imgs.value[0] : null;
        const video = vid.status === 'fulfilled' && vid.value ? vid.value : null;
        return {
          index: idx,
          image_query: query,
          image: img ? { url: img.url, thumb: img.thumb || img.url, photographer: img.photographer || '' } : null,
          video: video ? { url: video.url, poster: video.poster, duration: video.duration } : null,
        };
      }));
      return jsonResponse(res, 200, { previews });
    } catch (e) {
      console.error('[bulk-admin] preview-media failed:', e.message);
      return jsonResponse(res, 500, { error: e.message });
    }
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

module.exports = { handle, FREE_MODELS, publicConfig };
