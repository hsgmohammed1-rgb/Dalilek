const fs = require('fs');
const content = fs.readFileSync('assets/index-CdSb2jcH.v5.1c55cef1.js', 'utf8');

const match = content.match(/function\s+(\w+)\([^)]*\)\s*\{\s*return\s+\w+\(\{\s*queryKey:\s*\["categoryArticles"/);
if (match) {
    const fnName = match[1];
    console.log(`Function name: ${fnName}`);
    
    // Find where it's used
    const re = new RegExp(`.{0,100}${fnName}\\(.{0,100}`, 'g');
    const usages = content.match(re);
    console.log('Usages:', usages ? usages.join('\n---\n') : 'None');
} else {
    console.log('Not found');
}
