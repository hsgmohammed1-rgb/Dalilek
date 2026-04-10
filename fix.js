const fs = require('fs');
['sitemap.xml', 'sitemap-ar.xml', 'sitemap-en.xml', 'sitemap-fr.xml', 'sitemap-es.xml'].forEach(file => {
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace(/https:\/\/dalilek\.online\/(ar|en|fr|es)\/(?=([<"\s]))/g, 'https://dalilek.online/$1');
  fs.writeFileSync(file, content);
});
