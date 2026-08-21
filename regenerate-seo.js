const fs = require('fs');
const path = require('path');
const {
  buildMultilingualKeywords,
  buildMultilingualDescription,
} = require('./seo-generator.js');

const SEO_DATA_PATH = path.join(__dirname, 'seo-data.json');
const BACKUP_PATH = path.join(__dirname, 'seo-data-backup.json');

const existing = JSON.parse(fs.readFileSync(SEO_DATA_PATH, 'utf-8'));
fs.writeFileSync(BACKUP_PATH, JSON.stringify(existing, null, 2));
console.log(`Backup saved to seo-data-backup.json (${Object.keys(existing).length} articles)`);

const fresh = {};
for (const [slug, article] of Object.entries(existing)) {
  const input = {
    slug,
    title: article.title || '',
    category: article.category || '',
    seo_keywords: article.keywords ? article.keywords.ar || '' : '',
    seo_description: article.description ? article.description.ar || '' : '',
  };

  const keywords = buildMultilingualKeywords(input);
  const description = buildMultilingualDescription(input);

  fresh[slug] = {
    id: article.id,
    title: article.title,
    category: article.category,
    keywords,
    description,
  };

  if (Object.keys(fresh).length % 100 === 0) {
    console.log(`Processed ${Object.keys(fresh).length} articles...`);
  }
}

fs.writeFileSync(SEO_DATA_PATH, JSON.stringify(fresh, null, 2));
console.log(`Done! Regenerated SEO data for ${Object.keys(fresh).length} articles.`);
