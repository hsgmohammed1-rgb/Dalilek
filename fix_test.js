const acorn = require('acorn');
const fs = require('fs');
const v4 = fs.readFileSync('assets/index-CdSb2jcH.v4.js', 'utf8');

try {
  acorn.parse(v4, { ecmaVersion: 2022, sourceType: 'module' });
  console.log('Parse OK');
} catch (e) {
  const lines = v4.split('\n');
  const lineIdx = e.loc.line - 1;
  const col = e.loc.column;
  const line = lines[lineIdx];
  
  const start = Math.max(0, col - 50);
  const end = Math.min(line.length, col + 50);
  console.log('Error at line ' + e.loc.line + ', col ' + col);
  console.log('Around error: "' + line.substring(start, end) + '"');
  console.log('Char at error: "' + line[col] + '"');
  
  const errStart = Math.max(0, col - 200);
  const errEnd = Math.min(line.length, col + 200);
  console.log('Full context at error:');
  const ctx = line.substring(errStart, errEnd);
  console.log(ctx);
  
  // Try replacing the expected char and re-parse
  // Test removing the ]
  const test1 = v4.substring(0, col - start) + v4.substring(col - start + 1);
  const bytePos = lines.slice(0, lineIdx).join('\n').length + lineIdx + col;
  
  // Try different fixes
  const fixes = [
    { name: 'replace ] with )', fn: () => v4.substring(0, bytePos) + ')' + v4.substring(bytePos + 1) },
    { name: 'remove ]', fn: () => v4.substring(0, bytePos) + v4.substring(bytePos + 1) },
  ];
  
  for (const fix of fixes) {
    try {
      const result = fix.fn();
      acorn.parse(result, { ecmaVersion: 2022, sourceType: 'module' });
      console.log('Fix "' + fix.name + '" works!');
    } catch (e2) {
      console.log('Fix "' + fix.name + '" still fails: ' + e2.message.substring(0, 100));
    }
  }
}
