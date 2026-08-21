const fs = require('fs');
const bundle = fs.readFileSync('C:\\Users\\MOH\\Documents\\GG\\Dalilek\\zip-repl-2-5zipzip\\assets\\index-CdSb2jcH.v4.clean.js', 'utf8');

// Find color map which contains #00e6c8 (Template 1 accent)
const accentMatch = bundle.match(/[a-zA-Z0-9$]+=\{.*?"#00e6c8".*?(15:".*?")\}/);
if (accentMatch) {
  console.log('Accent object end:', accentMatch[1]);
  console.log('Accent object name:', bundle.substring(accentMatch.index, accentMatch.index + 10));
}

// Find UB equivalent
const ubMatch = bundle.match(/[a-zA-Z0-9$]+=\{1:[a-zA-Z0-9]+,2:[a-zA-Z0-9]+.*?15:[a-zA-Z0-9]+\}/);
if (ubMatch) {
  console.log('Icon object:', ubMatch[0]);
}

