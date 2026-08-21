const acorn = require('acorn');
const fs = require('fs');
let v4 = fs.readFileSync('assets/index-CdSb2jcH.v4.js', 'utf8');

// Find the exact position of the ] that acorn reports as unexpected
try {
  acorn.parse(v4, {ecmaVersion: 2022, sourceType: 'module'});
} catch(e) {
  const lines = v4.split('\n');
  const lineIdx = e.loc.line - 1;
  const line = lines[lineIdx];
  const bytePosInLine = e.loc.column;
  console.log('Error char: "' + line[bytePosInLine] + '"');
  
  // Show 50 chars around it
  console.log('Context: "' + line.substring(Math.max(0, bytePosInLine - 30), bytePosInLine + 30) + '"');
  
  // Now try replacing ] with ) at this exact byte position
  const bytePosInFile = lines.slice(0, lineIdx).join('\n').length + lineIdx + bytePosInLine;
  console.log('File byte position: ' + bytePosInFile);
  
  // Make the fix
  v4 = v4.substring(0, bytePosInFile) + ')' + v4.substring(bytePosInFile + 1);
  
  // Try again
  try {
    acorn.parse(v4, {ecmaVersion: 2022, sourceType: 'module'});
    console.log('Fix: replaced ] with ) → PARSE OK!');
  } catch(e2) {
    console.log('Fix: replaced ] with ) → still fails at line ' + e2.loc.line + ', col ' + e2.loc.column);
    const lines2 = v4.split('\n');
    const line2 = lines2[e2.loc.line - 1];
    console.log('New error char: "' + line2[e2.loc.column] + '"');
    console.log('New context: "' + line2.substring(Math.max(0, e2.loc.column - 30), e2.loc.column + 30) + '"');
  }
}
