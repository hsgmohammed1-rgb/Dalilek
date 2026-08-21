const fs = require('fs');
const v4 = fs.readFileSync('assets/index-CdSb2jcH.v4.js', 'utf8');

const nzStart = v4.indexOf('function Nz');
const nzEnd = v4.indexOf('const lj=', nzStart);
const nzBody = v4.substring(nzStart, nzEnd);

// Write just the Nz function to a temp file and check it
fs.writeFileSync('nz_check.js', 'function Nz(){' + nzBody.split('{').slice(1).join('{').slice(0, -1) + '}');

// Actually that's complex. Let me just find the issue differently.
// Extract lines 101-103 of the original file
const lines = v4.split('\n');
for (let i = 100; i <= 104; i++) {
  if (i < lines.length) {
    console.log('Line ' + (i+1) + ': ' + lines[i].substring(0, 200) + '...');
  }
}

// Check the exact boundary of Nz
const nzParamIdx = nzBody.indexOf('{');
const nzParamStr = nzBody.substring(11, nzParamIdx); // "function Nz" is 11 chars
console.log('Nz param string: "' + nzParamStr + '"');

// Count braces in param string
let pCount = 0;
for (const c of nzParamStr) {
  if (c === '(') pCount++;
  if (c === ')') pCount--;
}
console.log('Param paren balance: ' + pCount);

// Check if function Nz is properly closed
const afterNz = v4.substring(nzEnd);
console.log('After Nz (first 50 chars): ' + afterNz.substring(0, 50));

// Read the actual stars section to verify the `])})` fix is in place
const authorCardEnd = v4.indexOf('g.article.authorRole');
if (authorCardEnd !== -1) {
  const ctx = v4.substring(authorCardEnd, authorCardEnd + 800);
  console.log('Author card + after context:');
  console.log(ctx.substring(0, 800));
}
