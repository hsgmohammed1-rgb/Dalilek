const fs = require('fs');
const v4 = fs.readFileSync('assets/index-CdSb2jcH.v4.js', 'utf8');

// Try to find the syntax error by splitting at specific boundaries
// Find function Nz and check just that area
const nzStart = v4.indexOf('function Nz');
const nzEnd = v4.indexOf('const lj=', nzStart);
const nzBody = v4.substring(nzStart, nzEnd);

// Check Nz body syntax
try {
  new Function(nzBody);
  console.log('Nz body syntax OK');
} catch(e) {
  console.log('Nz body syntax ERROR: ' + e.message);
}

// Check surrounding context
const beforeNz = v4.substring(0, nzStart);
const afterNz = v4.substring(nzEnd);

// Check around the Nz boundary
const boundary = v4.substring(nzStart - 200, nzEnd + 200);
// Find the exact paren/brace balance at the boundary
let brace = 0, paren = 0;
for (let i = 0; i < boundary.length; i++) {
  const c = boundary[i];
  if (c === '{') brace++;
  else if (c === '}') brace--;
  else if (c === '(') paren++;
  else if (c === ')') paren--;
}
console.log('At boundary (200 before to 200 after Nz): brace=' + brace + ' paren=' + paren);

// Check the full file up to the error line
// The error says line 102, let's find what's at that position
const lines = v4.split('\n');
console.log('File has ' + lines.length + ' lines');
if (lines.length >= 102) {
  console.log('Line 102 length: ' + lines[101].length);
  console.log('Line 102 first 100 chars: ' + lines[101].substring(0, 100));
  console.log('Line 102 last 100 chars: ' + lines[101].substring(lines[101].length - 100));
}

// Check for any odd characters around our edits
const starIdx = v4.indexOf('\\u2605');
console.log('Found \\u2605 at index: ' + starIdx);
if (starIdx !== -1) {
  const ctx = v4.substring(Math.max(0, starIdx - 50), Math.min(v4.length, starIdx + 50));
  console.log('Context: ' + ctx);
}

// Check the exact star character (★ vs ?)
const rawStar = v4.indexOf('★');
console.log('Found raw ★ at index: ' + rawStar);
const questionStar = v4.indexOf('?', Math.max(0, rawStar - 5));
console.log('Found ? near star at index: ' + questionStar);

// Check the ratings-related code specifically
const dlkIdx = v4.indexOf('dlk_s');
console.log('dlk_s at index: ' + dlkIdx);
const ctx2 = v4.substring(Math.max(0, dlkIdx - 10), Math.min(v4.length, dlkIdx + 200));
console.log('dlk_s context: ' + ctx2);
