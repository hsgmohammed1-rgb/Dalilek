const fs = require('fs');
const content = fs.readFileSync('assets/index-CdSb2jcH.v5.1c55cef1.js', 'utf8');

// Looking for logic that concatenates length with the "مقال" label or uses `length` in Category Page
const re1 = /length[^>]*?['"`]\s*مقال/g;
const match1 = content.match(re1);
console.log('match1:', match1);

// Look for rendering the category page header where it might use data.length
// e.g. `{f?.length||0} ${y}`  where y = "articles"
const re2 = /\{[^{}]*\.length\|\|0\}\s*\{[^{}]*\}/g;
const match2 = content.match(re2);
console.log('match2:', match2);

const re3 = /\{.*length.*?\}/g;
let results = [];
let m;
while((m = re3.exec(content)) !== null) {
  if (m[0].includes('||0') || m[0].includes('|| 0')) {
     results.push(m[0]);
  }
}
console.log('match3:', results.slice(0, 10));

