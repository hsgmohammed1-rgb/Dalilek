const fs = require('fs');
const v4 = fs.readFileSync('assets/index-CdSb2jcH.v4.js', 'utf8');

// Find the Nz function and extract just the variable declarations (first few hundred chars)
const nzStart = v4.indexOf('function Nz');
const braceOpen = v4.indexOf('{', nzStart);
const declArea = v4.substring(braceOpen + 1, braceOpen + 800);
console.log('=== Nz declarations (first 800 chars inside function) ===');
console.log(declArea);

// Find what 's' is - search for '=s' or '=s,' or similar
const sDef = declArea.match(/[a-z]+\s*=\s*s\b/);
if (sDef) {
  console.log('\ns is defined as: ' + sDef[0]);
}

// Find the article state setter - look for patterns like ,...=N.useState(null)
// The article data is stored in some state
const useStateNull = declArea.match(/,\[(\w+),(\w+)\]=N\.useState\(null\)/);
if (useStateNull) {
  console.log('\nArticle state: [' + useStateNull[1] + ', ' + useStateNull[2] + ']');
}
