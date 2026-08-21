const fs = require('fs');
let v4 = fs.readFileSync('assets/index-CdSb2jcH.v4.js', 'utf8');
const lines = v4.split('\n');
console.log('Number of lines: ' + lines.length);

// Find line 102 (index 101)
const lineIdx = 101;
const line = lines[lineIdx];
console.log('Line 102 (index 101) length: ' + line.length);

// Check line ending by looking at the character between lines 101 and 102
const line101 = lines[100];
const line102 = lines[101];

// The line break between line 101 and 102
const lineBreakLen = v4.indexOf(line102) - (v4.indexOf(line101) + line101.length);
console.log('Line break length between lines 101-102: ' + lineBreakLen);
console.log('Index of line 101: ' + v4.indexOf(line101));
console.log('Index of line 102: ' + v4.indexOf(line102));

// The actual byte position of column 4586 in line 102
const bytePosInFile = v4.indexOf(line102) + 4586;
console.log('Byte position of col 4586: ' + bytePosInFile);
console.log('Char at that position: "' + v4[bytePosInFile] + '"');

// Now do the replacement correctly
v4 = v4.substring(0, bytePosInFile) + ')' + v4.substring(bytePosInFile + 1);
console.log('After replacement, char at same pos: "' + v4[bytePosInFile] + '"');

// Test with acorn
const acorn = require('acorn');
try {
  acorn.parse(v4, {ecmaVersion: 2022, sourceType: 'module'});
  console.log('PARSE OK!');
} catch(e) {
  console.log('Still fails at line ' + e.loc.line + ', col ' + e.loc.column);
}
