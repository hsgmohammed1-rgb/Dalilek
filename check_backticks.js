const fs = require('fs');
const v4 = fs.readFileSync('assets/index-CdSb2jcH.v4.js', 'utf8');
const idx = v4.indexOf('201 Lormont');
console.log('Found at index: ' + idx);
const ctx = v4.substring(Math.max(0, idx - 100), Math.min(v4.length, idx + 500));
console.log(ctx);
console.log('---');
let backticks = 0;
for (let i = 0; i < v4.length; i++) {
  if (v4[i] === '`') backticks++;
}
console.log('Backtick count: ' + backticks + ' (should be even)');
// Also check v2
const v2 = fs.readFileSync('assets/index-CdSb2jcH.v2.js', 'utf8');
let b2 = 0;
for (let i = 0; i < v2.length; i++) {
  if (v2[i] === '`') b2++;
}
console.log('v2 backtick count: ' + b2);
