const fs = require('fs');
const v2 = fs.readFileSync('assets/index-CdSb2jcH.v2.js', 'utf8');
const v4 = fs.readFileSync('assets/index-CdSb2jcH.v4.js', 'utf8');

// Find first diff anywhere in file
const minlen = Math.min(v2.length, v4.length);
for (let i = 0; i < minlen; i++) {
  if (v2[i] !== v4[i]) {
    const s = Math.max(0, i - 50);
    const e = Math.min(v4.length, i + 200);
    console.log('First diff at byte index:', i);
    console.log('Line number estimate:', v4.substring(0, i).split('\n').length);
    console.log('v2: ...' + v2.substring(s, e) + '...');
    console.log('v4: ...' + v4.substring(s, e) + '...');
    process.exit(0);
  }
}
console.log('Files are identical');
