// bulk-admin.js — AI-powered bulk article generator for Dalilek
// Routes mounted under /api/bulk-admin/*
const https = require('https');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const ADMIN_PASSWORD = process.env.BULK_ADMIN_PASSWORD;

const FREE_MODELS = [
  { id: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash (مجاني — موصى به)' },
  { id: 'deepseek/deepseek-chat-v3.1:free', label: 'DeepSeek V3.1 (مجاني)' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (مجاني)' },
  { id: 'qwen/qwen-2.5-72b-instruct:free', label: 'Qwen 2.5 72B (مجاني)' },
  { id: 'mistralai/mistral-small-3.1-24b-instruct:free', label: 'Mistral Small 3.1 (مجاني)' },
  { id: 'nvidia/nemotron-nano-9b-v2:free', label: 'Nvidia Nemotron Nano 9B (مجاني)' },
];

const sessions = new Map();
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

function newSession() {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { createdAt: Date.now() });
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

// ── OpenRouter call ─────────────────────────────────────────────────────────
async function callOpenRouter({ apiKey, model, messages, jsonMode = false, maxTokens = 4096 }) {
  if (!apiKey) throw new Error('OpenRouter API key is required');
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
    timeout: 120000,
  });
  if (r.status !== 200) {
    const msg = (r.json && (r.json.error?.message || r.json.message)) || r.body.slice(0, 300);
    throw new Error(`OpenRouter ${r.status}: ${msg}`);
  }
  const text = r.json?.choices?.[0]?.message?.content;
  if (!text) throw new Error('OpenRouter returned empty content');
  return text;
}

function extractJson(str) {
  if (!str) throw new Error('empty AI response');
  // Prefer fenced JSON
  const fence = str.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) {
    try { return JSON.parse(fence[1]); } catch (e) {}
  }
  // Try direct parse
  try { return JSON.parse(str); } catch (e) {}
  // Fallback: locate first {...} balanced block
  const start = str.indexOf('{');
  if (start >= 0) {
    let depth = 0;
    for (let i = start; i < str.length; i++) {
      if (str[i] === '{') depth++;
      else if (str[i] === '}') { depth--; if (depth === 0) {
        try { return JSON.parse(str.slice(start, i + 1)); } catch (e) {}
        break;
      }}
    }
  }
  throw new Error('Could not parse JSON from AI response');
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

الفئات المسموحة (اختر واحدة فقط لكل مقال): تكنولوجيا، صحة، مال وأعمال، تطوير ذات، ثقافة، علوم، أسلوب حياة، طعام، رياضة، تعليم، سفر، ترفيه.`;

  const text = await callOpenRouter({
    apiKey, model,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: userPrompt },
    ],
    jsonMode: true,
    maxTokens: 4096,
  });
  const j = extractJson(text);
  const topics = Array.isArray(j.topics) ? j.topics : [];
  return topics.slice(0, count).map(t => ({
    title: String(t.title || '').trim(),
    category: String(t.category || 'ثقافة').trim(),
    keywords: String(t.keywords || '').trim(),
  })).filter(t => t.title);
}

// ── Article generation ────────────────────────────────────────────────────
async function generateArticle({ apiKey, model, topic }) {
  const sys = `أنت كاتب محتوى عربي محترف متخصص في SEO. مهمتك إنشاء مقالات معمّقة وجذابة وعالية الجودة. تُرجع دائماً JSON صالح فقط بدون أي شرح خارجي.

التنسيق المطلوب بالضبط (لا تغيّر أي اسم حقل):
{
  "title": "العنوان النهائي بالعربية (يمكن تعديله ليكون أكثر جاذبية)",
  "slug": "english-kebab-case-slug-without-arabic-letters",
  "intro": "مقدمة جذابة 2-3 أسطر تجيب على سؤال القارئ مباشرة",
  "stats": [
    { "value": "رقم أو نسبة", "label": "وصف قصير" },
    { "value": "رقم أو نسبة", "label": "وصف قصير" },
    { "value": "رقم أو نسبة", "label": "وصف قصير" }
  ],
  "sections": [
    {
      "number": "01",
      "title": "عنوان القسم",
      "content": "محتوى القسم كاملاً (150-250 كلمة) عملي ومفيد",
      "callout": { "icon": "info", "title": "نصيحة", "text": "نصيحة عملية قصيرة" }
    }
    // أنشئ من 4 إلى 6 أقسام، الـcallout اختياري في بعضها (يمكن أن يكون null)
  ],
  "skills": [
    { "number": 1, "title": "مهارة", "description": "وصف قصير" },
    { "number": 2, "title": "مهارة", "description": "وصف قصير" },
    { "number": 3, "title": "مهارة", "description": "وصف قصير" },
    { "number": 4, "title": "مهارة", "description": "وصف قصير" }
  ],
  "conclusion": "خاتمة 2-3 أسطر مع دعوة للعمل",
  "seo_description": "وصف SEO باللغة العربية 150-160 حرف",
  "seo_keywords": "كلمة1, كلمة2, كلمة3, ... (10-15 كلمة مفصولة بفواصل)",
  "image_query": "english search query for stock photos describing the article topic visually (3-6 words)"
}

شروط حرجة:
- الـ slug إنجليزي صرف، أحرف صغيرة، شرطات بدل الفراغ، بدون رموز خاصة، بدون أحرف عربية إطلاقاً.
- المحتوى أصلي ومفيد وليس مكرراً.
- الـ image_query بالإنجليزية فقط ووصفي بصرياً (مثل "modern home office workspace" وليس اسم المقال حرفياً).`;

  const userPrompt = `الموضوع: "${topic.title}"
الفئة: ${topic.category}
الكلمات المفتاحية المقترحة: ${topic.keywords || 'لا يوجد'}

أنشئ مقالاً كاملاً عالي الجودة وفق التنسيق المحدد. اجعل المحتوى عملياً ومحدّثاً لعام 2026.`;

  const text = await callOpenRouter({
    apiKey, model,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: userPrompt },
    ],
    jsonMode: true,
    maxTokens: 6000,
  });
  return extractJson(text);
}

// ── Pexels image search ────────────────────────────────────────────────────
async function fetchPexelsImages(query, count = 3) {
  if (!PEXELS_API_KEY) return [];
  const q = encodeURIComponent(query.slice(0, 100));
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
}

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

// ── Insert into Supabase ───────────────────────────────────────────────────
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

// ── End-to-end: generate + images + insert ─────────────────────────────────
async function generateAndPublish({ apiKey, model, topic, templateId }) {
  const article = await generateArticle({ apiKey, model, topic });
  if (!article || !article.title || !article.slug) {
    throw new Error('AI returned invalid article structure');
  }

  // Fetch images from Pexels
  let images = [];
  try {
    const q = article.image_query || article.title;
    images = await fetchPexelsImages(q, 3);
  } catch (e) {
    console.warn('Pexels fetch failed:', e.message);
  }

  // Build content JSON in the existing schema (Arabic primary)
  const arContent = {
    title: article.title,
    intro: article.intro,
    stats: Array.isArray(article.stats) ? article.stats.slice(0, 3) : [],
    sections: Array.isArray(article.sections) ? article.sections.slice(0, 6) : [],
    skills: Array.isArray(article.skills) ? article.skills.slice(0, 4) : [],
    conclusion: article.conclusion,
    cover_image: images[0]?.url || null,
    images: images,
    image_query: article.image_query || null,
  };

  const content = { languages: { ar: arContent } };

  // Unique slug
  const slug = await findUniqueSlug(normalizeSlug(article.slug));

  // Pick template (round-robin or stick with provided)
  const tpl = templateId || (Math.floor(Math.random() * 14) + 1);

  const record = {
    title: article.title,
    slug,
    content: JSON.stringify(content),
    template_id: tpl,
    seo_keywords: article.seo_keywords || topic.keywords || '',
    category: topic.category,
    seo_description: article.seo_description || '',
    views: 0,
  };

  const inserted = await insertArticle(record);
  return {
    id: inserted.id,
    slug: inserted.slug,
    title: inserted.title,
    category: inserted.category,
    cover_image: arContent.cover_image,
    images_count: images.length,
  };
}

// ── HTTP router ─────────────────────────────────────────────────────────────
async function handle(req, res) {
  const urlPath = req.url.split('?')[0];

  // Public: list available models
  if (urlPath === '/api/bulk-admin/models' && req.method === 'GET') {
    return jsonResponse(res, 200, { models: FREE_MODELS });
  }

  // Login
  if (urlPath === '/api/bulk-admin/login' && req.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(req)) || '{}');
      if (!ADMIN_PASSWORD) return jsonResponse(res, 500, { error: 'Server password not configured' });
      if (!body.password || body.password !== ADMIN_PASSWORD) {
        return jsonResponse(res, 401, { error: 'كلمة السر غير صحيحة' });
      }
      const token = newSession();
      return jsonResponse(res, 200, { token, ttlMs: SESSION_TTL_MS });
    } catch (e) {
      return jsonResponse(res, 400, { error: 'Invalid request' });
    }
  }

  // All routes below require auth
  if (!isAuthed(req)) return jsonResponse(res, 401, { error: 'Unauthorized — please login again' });

  if (urlPath === '/api/bulk-admin/discover-topics' && req.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(req)) || '{}');
      const apiKey = body.apiKey;
      const model = body.model || FREE_MODELS[0].id;
      const count = Math.max(1, Math.min(150, parseInt(body.count, 10) || 10));
      const mode = body.mode || 'trending';
      const category = body.category || '';
      const customSeed = body.customSeed || '';
      const topics = await discoverTopics({ apiKey, model, count, mode, category, customSeed });
      return jsonResponse(res, 200, { topics });
    } catch (e) {
      return jsonResponse(res, 500, { error: e.message });
    }
  }

  if (urlPath === '/api/bulk-admin/generate-one' && req.method === 'POST') {
    try {
      const body = JSON.parse((await readBody(req)) || '{}');
      const apiKey = body.apiKey;
      const model = body.model || FREE_MODELS[0].id;
      const topic = body.topic;
      const templateId = body.templateId || null;
      if (!topic || !topic.title) return jsonResponse(res, 400, { error: 'topic.title required' });
      const out = await generateAndPublish({ apiKey, model, topic, templateId });
      return jsonResponse(res, 200, { article: out });
    } catch (e) {
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

module.exports = { handle, FREE_MODELS };
