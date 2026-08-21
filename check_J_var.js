const fs = require('fs');
const v4 = fs.readFileSync('assets/index-CdSb2jcH.v4.js', 'utf8');

// Find the Nz function declarations
const nzStart = v4.indexOf('function Nz');
const braceOpen = v4.indexOf('{', nzStart);

// Get a larger view of the declarations (first 2000 chars)
const declArea = v4.substring(braceOpen + 1, braceOpen + 2000);
console.log('=== Nz declarations (first 2000 chars) ===');
console.log(declArea);

// Search for where J (uppercase) is defined in Nz
const jDef = declArea.match(/[=(,]\s*J\s*=/);
if (jDef) {
  console.log('\nJ defined as: ' + jDef[0]);
}

// Check what variables are defined in the first const
const constMatch = declArea.match(/^const\s+(.+?);/);
if (constMatch) {
  console.log('\nFirst const statements:');
  console.log(constMatch[1].substring(0, 500));
}

// Look for J in the article variable context
// Maybe J comes from useParams or somewhere
const inNz = v4.substring(nzStart, v4.indexOf('const lj=', nzStart));
const jUses = inNz.match(/\bJ\b/g);
if (jUses) {
  console.log('\nJ appears ' + jUses.length + ' times in Nz');
  // Show the first few J usages with context
  let idx = 0;
  let count = 0;
  while ((idx = inNz.indexOf('J', idx)) !== -1 && count < 10) {
    const ctx = inNz.substring(Math.max(0, idx - 20), Math.min(inNz.length, idx + 30));
    console.log('  J at offset ' + idx + ': ...' + ctx + '...');
    idx++;
    count++;
  }
}
