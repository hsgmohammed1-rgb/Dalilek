const fs = require('fs');
const content = fs.readFileSync('assets/index-CdSb2jcH.v5.1c55cef1.js', 'utf8');
const match = content.match(/\.from\(['"`]articles['"`]\).*?\.limit\(\d+\)/g);
console.log(match);
