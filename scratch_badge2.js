const fs = require('fs');
const content = fs.readFileSync('assets/index-CdSb2jcH.v5.1c55cef1.js', 'utf8');

const index = content.indexOf('y=BI[t]||"articles"');
if (index !== -1) {
    const start = index + 100;
    const end = start + 800;
    console.log(content.substring(start, end));
} else {
    console.log('Not found');
}
