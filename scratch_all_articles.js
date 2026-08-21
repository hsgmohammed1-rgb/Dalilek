const fs = require('fs');
const content = fs.readFileSync('assets/index-CdSb2jcH.v5.1c55cef1.js', 'utf8');

// Check if there's an "all articles" page that also has a limit issue
// Look for the allArticles component
const match = content.match(/function\s+\w+\([^)]*\)\s*\{[^{}]*allArticles[^{}]*\{/g);
console.log('allArticles components:', match ? match.slice(0, 3) : 'none');

// Check if the allArticles page also uses .limit()
const match2 = content.match(/.{0,60}allArticles.{0,60}/g);
console.log('\nallArticles usages:');
if (match2) {
    match2.slice(0, 5).forEach(m => console.log(m));
}

// Check what articles query the allArticles page uses
const match3 = content.match(/function\s+(\w+)\([^)]*\)\s*\{[^}]*queryKey:\s*\[\s*"articles"\s*,\s*"all"/);
if (match3) {
    console.log('\nAll articles query function:', match3[1]);
    const idx = content.indexOf(match3[0]);
    console.log(content.substring(idx, idx + 300));
}

// Look for the allArticles loadMore rendering
const allArticlesIdx = content.indexOf('allArticles:{');
if (allArticlesIdx !== -1) {
    console.log('\n=== allArticles translations ===');
    console.log(content.substring(allArticlesIdx, allArticlesIdx + 300));
}
