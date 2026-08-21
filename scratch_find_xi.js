const fs = require('fs');
const content = fs.readFileSync('assets/index-CdSb2jcH.v5.1c55cef1.js', 'utf8');

// Find where xI (the category articles query) is called in a component
const re = /=\s*xI\(/g;
let m;
while ((m = re.exec(content)) !== null) {
    const start = Math.max(0, m.index - 200);
    const end = Math.min(content.length, m.index + 1500);
    console.log('=== USAGE OF xI() at index', m.index, '===');
    console.log(content.substring(start, end));
    console.log('\n\n');
}
