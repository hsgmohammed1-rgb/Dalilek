const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// 1. JSON-LD datePublished & dateModified
if (!code.includes('"datePublished":')) {
  code = code.replace(
    /"articleSection": article.category,/,
    `"articleSection": article.category,
    "datePublished": article.created_at || new Date().toISOString(),
    "dateModified": article.created_at || new Date().toISOString(),`
  );
  console.log('Added datePublished to JSON-LD');
}

// 2. Canonical URL fix
if (code.includes('const canonicalUrl = `${SITE_URL}/articles/${slug}`;')) {
  code = code.replace(
    /const canonicalUrl = `\$\{SITE_URL\}\/articles\/\$\{slug\}`;/,
    `const canonicalUrl = pageLang === 'ar' ? \`\${SITE_URL}/articles/\${slug}\` : \`\${SITE_URL}/\${pageLang}/articles/\${slug}\`;`
  );
  console.log('Fixed Canonical URL');
}

// 3. Hreflang Tags
if (!code.includes('hreflangTags')) {
  code = code.replace(
    /const dir = pageLang === 'ar' \? 'rtl' : 'ltr';/,
    `const dir = pageLang === 'ar' ? 'rtl' : 'ltr';
  const hreflangs = ['ar', 'en', 'fr', 'es'].map(l => \`<link rel="alternate" hreflang="\${l}" href="\${l === 'ar' ? \`\${SITE_URL}/articles/\${slug}\` : \`\${SITE_URL}/\${l}/articles/\${slug}\`}" />\`).join('\\n    ');
  const hreflangTags = hreflangs + \`\\n    <link rel="alternate" hreflang="x-default" href="\${SITE_URL}/articles/\${slug}" />\`;`
  );
  
  // Inject into HTML
  code = code.replace(
    /\.replace\(\/<title>\[\^<\]\*<\/title>\/, `<title>\$\{fullTitle\}<\/title>`\)/,
    `.replace(/<title>[^<]*<\\/title>/, \`<title>\${fullTitle}</title>\\n    \${hreflangTags}\`)`
  );
  console.log('Added hreflang tags');
}

// 4. Google Indexing API integration stub
if (!code.includes('function submitGoogleIndexingAPI(')) {
  const googleApiCode = `
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
`;

  code = code.replace(
    /function submitIndexNow\(urls\) \{/,
    `${googleApiCode}
function submitIndexNow(urls) {`
  );
  
  // Also add it to req.app exports
  code = code.replace(
    /submitIndexNow, articleUrlsForIndexNow/g,
    'submitIndexNow, submitGoogleIndexingAPI, articleUrlsForIndexNow'
  );
  console.log('Added submitGoogleIndexingAPI stub');
}

fs.writeFileSync('server.js', code);
console.log('Done!');
