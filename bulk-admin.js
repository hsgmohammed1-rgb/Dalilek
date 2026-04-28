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

// ── Multi-provider model catalog ───────────────────────────────────────────
// Three free-tier providers; each has its own API key + recommended model list.
const PROVIDERS = {
  gemini: {
    label: 'Google Gemini',
    keyHint: 'AIza...',
    keyUrl: 'https://aistudio.google.com/apikey',
    models: [
      { id: 'gemini-2.5-flash',       label: 'Gemini 2.5 Flash (موصى به)' },
      { id: 'gemini-2.5-pro',         label: 'Gemini 2.5 Pro (الأقوى)' },
      { id: 'gemini-2.5-flash-lite',  label: 'Gemini 2.5 Flash Lite (الأسرع)' },
      { id: 'gemini-2.0-flash',       label: 'Gemini 2.0 Flash' },
      { id: 'gemini-2.0-flash-lite',  label: 'Gemini 2.0 Flash Lite' },
      { id: 'gemini-1.5-flash',       label: 'Gemini 1.5 Flash (احتياطي)' },
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
      { id: 'llama-3.3-70b-versatile',  label: 'Llama 3.3 70B Versatile (موصى به)' },
      { id: 'openai/gpt-oss-120b',      label: 'OpenAI GPT-OSS 120B (الأقوى)' },
      { id: 'openai/gpt-oss-20b',       label: 'OpenAI GPT-OSS 20B (سريع)' },
      { id: 'qwen/qwen3-32b',           label: 'Qwen 3 32B (ممتاز للعربي)' },
      { id: 'llama-3.1-8b-instant',     label: 'Llama 3.1 8B Instant (الأسرع)' },
    ],
  },
  openrouter: {
    label: 'OpenRouter',
    keyHint: 'sk-or-v1-...',
    keyUrl: 'https://openrouter.ai/keys',
    models: [
      { id: 'openai/gpt-oss-120b:free',              label: 'OpenAI GPT-OSS 120B (الأقوى — موصى به)' },
      { id: 'qwen/qwen3-next-80b-a3b-instruct:free', label: 'Qwen 3 Next 80B (ممتاز للعربي)' },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B' },
      { id: 'z-ai/glm-4.5-air:free',                 label: 'GLM 4.5 Air' },
      { id: 'google/gemma-3-27b-it:free',            label: 'Google Gemma 3 27B' },
      { id: 'openai/gpt-oss-20b:free',               label: 'OpenAI GPT-OSS 20B (سريع)' },
      { id: 'nvidia/nemotron-nano-9b-v2:free',       label: 'Nvidia Nemotron Nano 9B (سريع)' },
    ],
  },
};

// Backwards-compat alias (older code paths read FREE_MODELS as a flat list).
const FREE_MODELS = PROVIDERS.gemini.models;

// Speed profiles — control prompt depth, output budget, and concurrency.
// recommendedModel is keyed by provider so we can suggest the right model when the user switches.
// NOTE on concurrency: each article = 1 main AI call + 3 translation calls
// (en/fr/es). Free tiers throttle hard (Gemini = 10 RPM, Groq = 6000 TPM).
// We keep concurrency intentionally low so a 20-article batch doesn't
// instantly burn through the per-minute quota and reject 70%+ of articles.
const SPEED_PROFILES = {
  fast: {
    label: '⚡ سريع',
    description: '3-4 أقسام مختصرة، مقالان بالتوازي مع 4 لغات لكل واحد',
    recommendedModel: { gemini: 'gemini-2.5-flash-lite', groq: 'llama-3.1-8b-instant', openrouter: 'nvidia/nemotron-nano-9b-v2:free' },
    maxTokens: 3500,
    minSections: 3, maxSections: 4,
    sectionLength: '100-150 كلمة',
    concurrency: 2,
    skillsCount: 4,
    statsCount: 3,
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

async function callOpenAICompat({ provider, apiKey, model, messages, jsonMode = false, maxTokens = 4096, timeoutMs = 180000 }) {
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
    const payload = { model, messages, max_tokens: effectiveMax, temperature: 0.8 };
    if (jsonMode) payload.response_format = { type: 'json_object' };

    const r = await httpsRequestJson({
      hostname: isGroq ? 'api.groq.com' : 'openrouter.ai',
      path:     isGroq ? '/openai/v1/chat/completions' : '/api/v1/chat/completions',
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
async function callOneModel({ provider, apiKey, model, messages, jsonMode, maxTokens, timeoutMs }) {
  if (provider === 'gemini') {
    return await callGemini({ apiKey, model, messages, jsonMode, maxTokens, timeoutMs });
  }
  // groq + openrouter share the same OpenAI-compatible call.
  return await callOpenAICompat({ provider, apiKey, model, messages, jsonMode, maxTokens, timeoutMs });
}

async function callAIWithFallback({ provider = 'gemini', apiKey, model, messages, jsonMode, maxTokens, timeoutMs }) {
  const prov = PROVIDERS[provider] || PROVIDERS.gemini;
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
      const text = await callOneModel({ provider, apiKey, model: m, messages, jsonMode, maxTokens, timeoutMs });
      MODEL_COOLDOWN.delete(cooldownKey(m));
      if (m !== model) console.log(`[bulk-admin] ${provider} fallback model used: ${m} (requested: ${model})`);
      return { text, modelUsed: m, providerUsed: provider };
    } catch (e) {
      lastError = e;
      // Bad-key errors → stop immediately (no point trying other models with the same key)
      if (e.status === 400 && /API key not valid|API_KEY_INVALID|Invalid API Key/i.test(e.message || '')) throw e;
      if (e.status === 401 || e.status === 403) throw e;
      if (e.status === 429) {
        MODEL_COOLDOWN.set(cooldownKey(m), Date.now() + COOLDOWN_MS);
        console.warn(`[bulk-admin] ${provider}/${m} rate-limited (429), cooling down 60s, trying next model...`);
      } else {
        console.warn(`[bulk-admin] ${provider}/${m} failed (${e.status || 'no-status'}: ${(e.message||'').slice(0,120)}), trying next model...`);
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
// Today's date for "auto" mode prompts so the AI knows what's actually current.
function todayArabic() {
  const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const d = new Date();
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

async function discoverTopics({ provider = 'gemini', apiKey, model, count, mode, category, customSeed, excludeTitles = [] }) {
  // Build a "forbidden" list block to inject into the prompt (works for any mode).
  const exclusionBlock = excludeTitles.length
    ? `\n\nقائمة العناوين الموجودة سابقاً (ممنوع تكرارها أو اقتراح أي موضوع مشابه لها بأي شكل):\n${excludeTitles.slice(0, 100).map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nأي موضوع جديد لازم يكون مختلفاً جوهرياً عن كل العناوين أعلاه — لا تكرر نفس الفكرة بصياغة مختلفة.`
    : '';

  let userPrompt;
  if (mode === 'custom' && customSeed) {
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
3. **تنوّع كامل**: وزّع المواضيع على كل الفئات التالية بشكل متوازن: تكنولوجيا، صحة، مال وأعمال، تطوير ذات، ثقافة، علوم، أسلوب حياة، طعام، رياضة، تعليم، سفر، ترفيه. لا تركّز على فئة واحدة.
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
    userPrompt = `أعطني ${count} عناوين فريدة لأكثر المقالات رواجاً وبحثاً عالمياً في عام 2026 على الإنترنت. غطّ مواضيع متنوعة (تكنولوجيا، صحة، مال، تطوير ذات، ثقافة، علوم، أسلوب حياة). اختر مواضيع يبحث عنها الناس فعلاً، وأعطها زاوية حديثة 2026.${exclusionBlock}`;
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
    provider, apiKey, model,
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

  // Build a Set of existing-title fingerprints for O(1) duplicate filtering.
  const exclusionSet = new Set(excludeTitles.map(normalizeArabicTitle).filter(Boolean));

  const cleaned = topics
    .map(t => ({
      title: String(t.title || '').trim(),
      category: String(t.category || 'ثقافة').trim(),
      keywords: String(t.keywords || '').trim(),
      image_query: String(t.image_query || '').trim(),
    }))
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
async function generateArticle({ provider = 'gemini', apiKey, model, topic, speed = 'medium' }) {
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
  if (r.status >= 200 && r.status < 300 && Array.isArray(r.json) && r.json.length > 0) {
    const inserted = r.json[0];
    // Fire-and-forget: notify search engines via IndexNow about the new URL.
    // We push the canonical + 4-language URLs so all variants get crawled.
    try {
      if (insertArticle._app && typeof insertArticle._app.submitIndexNow === 'function' && inserted.slug) {
        const urls = insertArticle._app.articleUrlsForIndexNow(inserted.slug);
        insertArticle._app.submitIndexNow(urls).catch(() => {});
      }
    } catch (e) {}
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
async function translateArticle({ provider = 'gemini', apiKey, model, article, targetLang }) {
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
      console.warn(`[bulk-admin] translation ${opts.targetLang} failed (${(lastErr.message||'').slice(0,80)}), retrying in ${delay/1000}s…`);
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
    seo_keywords: translated.seo_keywords || '',
    cover_image: media.cover_image,
    cover: media.cover_image,
    images: media.images,
    video: media.video,
  };
}

async function generateAndPublish({ provider = 'gemini', apiKey, model, topic, templateId, speed = 'medium' }) {
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
  const mediaPromises = Promise.allSettled([
    fetchPexelsImages(imageQuery, 3, imageFallbacks),
    fetchPexelsVideo(videoQuery, videoFallbacks),
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
  async function tryInsert(rec) {
    try {
      return await insertArticle(rec);
    } catch (e) {
      const msg = e.message || '';
      // Some Supabase schemas don't have the *_multilingual columns; retry without them.
      if (/seo_(keywords|description)_multilingual/i.test(msg)) {
        delete rec.seo_keywords_multilingual;
        delete rec.seo_description_multilingual;
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
const fs = require('fs');
const path = require('path');
const CRON_CONFIG_PATH = path.join(__dirname, '.cron-config.json');
const CRON_LOG_PATH = path.join(__dirname, '.cron-log.json');
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
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    apiKey: '',
    speed: 'fast',
    count: 5,
    mode: 'auto',
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
    if (!cfg.apiKey) throw new Error('API key غير مضبوط في إعدادات التوليد التلقائي');
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
    const COOLDOWN_MS = (cfg.provider === 'gemini') ? 15000 : 12000;
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
            console.warn(`[cron] ${consecutiveRateLimits} consecutive rate limits, pausing ${longWait/1000}s before next article`);
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
    // New shape: providers map ({id,label,keyHint,keyUrl,models[]}) so the UI can render a provider switcher.
    // Also keep `models` (Gemini list) for any older clients that haven't refreshed.
    const providers = Object.fromEntries(Object.entries(PROVIDERS).map(([k, v]) => [k, {
      id: k, label: v.label, keyHint: v.keyHint, keyUrl: v.keyUrl, models: v.models,
    }]));
    return jsonResponse(res, 200, { providers, models: FREE_MODELS, speedProfiles: profiles, allowedEmail: ALLOWED_EMAIL });
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
        } catch (e) {}
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
      const provider = (body.provider && PROVIDERS[body.provider]) ? body.provider : 'gemini';
      const apiKey = body.apiKey;
      const model = body.model || PROVIDERS[provider].models[0].id;
      const count = Math.max(1, Math.min(150, parseInt(body.count, 10) || 10));
      const mode = body.mode || 'auto';
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
    try {
      parsedBody = JSON.parse((await readBody(req)) || '{}');
      const provider = (parsedBody.provider && PROVIDERS[parsedBody.provider]) ? parsedBody.provider : 'gemini';
      const apiKey = parsedBody.apiKey;
      const model = parsedBody.model || PROVIDERS[provider].models[0].id;
      const topic = parsedBody.topic;
      const templateId = parsedBody.templateId || null;
      const speed = parsedBody.speed || 'medium';
      if (!topic || !topic.title) return jsonResponse(res, 400, { error: 'topic.title مطلوب' });

      // Article-level retry: if every model hit 429/timeout/transient error,
      // wait a real cool-down (long enough for the per-minute quota to reset)
      // and try once more before giving up. This is the difference between
      // "14/20 rejected" and "20/20 succeeded" on free tiers.
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
          console.warn(`[bulk-admin] article attempt ${attempt}/${ATTEMPTS} failed (${(e.message||'').slice(0,100)}), retrying in ${waitMs/1000}s…`);
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
      // Whitelist updatable fields. Only overwrite apiKey when a non-empty
      // new value is provided (so saving without re-typing keeps the old one).
      const allowed = ['enabled', 'provider', 'model', 'speed', 'count', 'mode', 'category', 'customSeed', 'dailyLimit'];
      for (const k of allowed) if (k in body) cfg[k] = body[k];
      if (typeof body.apiKey === 'string' && body.apiKey.trim() && !body.apiKey.includes('•')) {
        cfg.apiKey = body.apiKey.trim();
      }
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
    if (!cfg.apiKey) return jsonResponse(res, 400, { error: 'API key غير مضبوط' });
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
