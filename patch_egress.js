const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// 1. Fix refreshSeoFromSupabase
const oldSeoSelect = '/rest/v1/articles?select=id,title,slug,category,seo_keywords,seo_description,seo_keywords_multilingual,seo_description_multilingual,title_multilingual,content';
const newSeoSelect = '/rest/v1/articles?select=id,title,slug,category,seo_keywords,seo_description,seo_keywords_multilingual,seo_description_multilingual,title_multilingual';

if (code.includes(oldSeoSelect)) {
  code = code.replace(oldSeoSelect, newSeoSelect);
  console.log('Fixed refreshSeoFromSupabase egress');
} else {
  console.log('oldSeoSelect not found');
}

// 2. Fix getArticleList
const oldListSelect = '/rest/v1/articles?select=id,title,slug,category,created_at,views,content&order=created_at.desc&limit=1000';
const newListSelect = '/rest/v1/articles?select=id,title,slug,category,created_at,views,title_multilingual,seo_description_multilingual&order=created_at.desc&limit=1000';

if (code.includes(oldListSelect)) {
  code = code.replace(oldListSelect, newListSelect);
  console.log('Fixed getArticleList select egress');
} else {
  console.log('oldListSelect not found');
}

// Now patch the mapping block in getArticleList
const oldMapBlock = `          const slim = arts.map(a => {
            let slimContent = '{}';
            try {
              const c = JSON.parse(a.content || '{}');
              const langs = {};
              const HAS_ARABIC = /[\\u0600-\\u06FF]/;
              for (const l of LANG_KEYS) {
                const ld = c.languages?.[l];
                if (!ld?.title) continue;
                // If a non-Arabic language slot still contains Arabic-script text,
                // the article was never actually translated — treat it as untranslated.
                if (l !== 'ar' && HAS_ARABIC.test(ld.title)) continue;
                langs[l] = {
                  title: ld.title,
                  intro: String(ld.intro || c.intro || '').split('.').slice(0, 2).join('.').trim().slice(0, 200),
                };
              }
              slimContent = JSON.stringify({
                languages: langs,
                images: c.images ? [c.images[0]] : [],
                intro: String(c.intro || '').split('.').slice(0, 2).join('.').trim().slice(0, 200),
              });
            } catch {}
            return { id: a.id, title: a.title, slug: a.slug, category: a.category, created_at: a.created_at, views: a.views || 0, content: slimContent };
          });`;

const newMapBlock = `          const slim = arts.map(a => {
            const langs = {};
            const HAS_ARABIC = /[\\u0600-\\u06FF]/;
            for (const l of LANG_KEYS) {
               const title = (a.title_multilingual && a.title_multilingual[l]) || a.title;
               const intro = (a.seo_description_multilingual && a.seo_description_multilingual[l]) || a.seo_description || '';
               if (l !== 'ar' && HAS_ARABIC.test(title)) continue; // skip untranslated
               langs[l] = { title, intro: String(intro).slice(0, 200) };
            }
            const slimContent = JSON.stringify({
               languages: langs,
               images: [],
               intro: String((a.seo_description_multilingual && a.seo_description_multilingual.ar) || a.seo_description || '').slice(0, 200)
            });
            return { id: a.id, title: a.title, slug: a.slug, category: a.category, created_at: a.created_at, views: a.views || 0, content: slimContent };
          });`;

if (code.includes(oldMapBlock)) {
  code = code.replace(oldMapBlock, newMapBlock);
  console.log('Fixed getArticleList map block');
} else {
  console.log('oldMapBlock not found');
}

fs.writeFileSync('server.js', code);
console.log('Done.');
