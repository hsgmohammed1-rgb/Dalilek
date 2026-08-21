const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const targetStr = '<lastmod>${today}</lastmod>';
if (code.includes(targetStr)) {
  code = code.replace(
    /<lastmod>\$\{today\}<\/lastmod>/g,
    `<lastmod>\${(article.created_at || new Date().toISOString()).split('T')[0]}</lastmod>`
  );
  fs.writeFileSync('server.js', code);
  console.log('Fixed sitemap lastmod');
}
