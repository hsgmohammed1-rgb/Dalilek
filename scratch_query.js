const fs = require('fs');
const content = fs.readFileSync('assets/index-CdSb2jcH.v5.1c55cef1.js', 'utf8');
const match = content.match(/\.from\(['"`](.*?)['"`]\)/g);
console.log(match ? Array.from(new Set(match)).slice(0, 10) : 'none');
