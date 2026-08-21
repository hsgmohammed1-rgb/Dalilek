const fs = require('fs');
const content = fs.readFileSync('assets/index-CdSb2jcH.v5.1c55cef1.js', 'utf8');

// Find the full GI component
const idx = content.indexOf('function GI(){');
if (idx !== -1) {
    // Get a large chunk of the component
    const end = Math.min(content.length, idx + 5000);
    console.log(content.substring(idx, end));
}
