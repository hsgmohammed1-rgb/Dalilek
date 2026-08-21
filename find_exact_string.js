const fs = require('fs');
const v4 = fs.readFileSync('assets/index-CdSb2jcH.v4.js', 'utf8');
const idx = v4.indexOf('children:Y})]},Y)}');
console.log('Found at index:', idx);
if (idx >= 0) {
  const full = v4.substring(idx, idx + 30);
  console.log('Full match: "' + full + '"');
  console.log('Chars: ' + full.split('').map(c => c.charCodeAt(0)).join(','));
}
// Also check after the Y
const idx2 = v4.indexOf('children:Y})]');
console.log('Found shorter at index:', idx2);
if (idx2 >= 0) {
  const full2 = v4.substring(idx2, idx2 + 40);
  console.log('Shorter match: "' + full2 + '"');
}
