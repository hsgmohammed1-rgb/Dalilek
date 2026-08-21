const fs = require('fs');
let code = fs.readFileSync('bulk-admin.js', 'utf8');

if (!code.includes('submitGoogleIndexingAPI')) {
  code = code.replace(
    /insertArticle\._app\.submitIndexNow\(urls\)\.catch\(\(\) => \{ \}\);/g,
    `insertArticle._app.submitIndexNow(urls).catch(() => { });
        if (typeof insertArticle._app.submitGoogleIndexingAPI === 'function') {
          insertArticle._app.submitGoogleIndexingAPI(urls).catch(() => { });
        }`
  );
  
  // There is another place where indexnow is triggered:
  code = code.replace(
    /const r = await app\.submitIndexNow\(chunk\);/g,
    `const r = await app.submitIndexNow(chunk);
      if (typeof app.submitGoogleIndexingAPI === 'function') {
        await app.submitGoogleIndexingAPI(chunk).catch(()=>{});
      }`
  );

  fs.writeFileSync('bulk-admin.js', code);
  console.log('Patched bulk-admin.js');
}
