const acorn = require('acorn');
const fs = require('fs');
let v4 = fs.readFileSync('assets/index-CdSb2jcH.v4.js', 'utf8');

// Check the specific position
const lines = v4.split('\n');
const line = lines[101]; // line 102 (0-indexed)
console.log('Line 102 length: ' + line.length);
console.log('Char at col 4585: "' + line[4585] + '"');
console.log('Char at col 4586: "' + line[4586] + '"');
console.log('Char at col 4587: "' + line[4587] + '"');
console.log('Char at col 4588: "' + line[4588] + '"');
console.log('Char at col 4589: "' + line[4589] + '"');
console.log('Context col 4570-4600: "' + line.substring(4570, 4600) + '"');

// Count ALL ] characters in the error region
const errRegion = line.substring(4550, 4650);
console.log('Error region chars: "' + errRegion + '"');
for (let i = 0; i < errRegion.length; i++) {
  if (errRegion[i] === ']') {
    console.log('  Found ] at relative pos ' + i + ' (abs ' + (4550 + i) + ')');
  }
}
