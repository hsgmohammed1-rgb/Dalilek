const fs = require('fs');
const v2 = fs.readFileSync('assets/index-CdSb2jcH.v2.js', 'utf8');
const v4 = fs.readFileSync('assets/index-CdSb2jcH.v4.js', 'utf8');

// Find all diff regions
let i = 0;
const diffs = [];
const minlen = Math.min(v2.length, v4.length);
while (i < minlen) {
  if (v2[i] !== v4[i]) {
    const start = i;
    while (i < minlen && v2[i] !== v4[i]) i++;
    diffs.push({ start, end: i, len: i - start });
  }
  i++;
}
console.log('Number of diff regions:', diffs.length);
for (const d of diffs) {
  const s = Math.max(0, d.start - 30);
  const e = Math.min(v4.length, d.end + 80);
  console.log('---');
  console.log('Region start:', d.start, 'end:', d.end, 'length:', d.len);
  console.log('v4 region: "' + v4.substring(d.start, Math.min(v4.length, d.end)) + '"');
  console.log('v2 region: "' + v2.substring(d.start, Math.min(v2.length, d.end)) + '"');
}
