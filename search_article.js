const fs = require('fs');
const content = fs.readFileSync('assets/index-CdSb2jcH.v3.js', 'utf-8');

const str = 'startsWith("/articles';
const idx = content.indexOf(str);
if (idx !== -1) {
  console.log(content.substring(idx - 100, idx + 100));
} else {
  console.log("Not found");
}

const str2 = 'h.startsWith("/articles/';
const idx2 = content.indexOf(str2);
if (idx2 !== -1) {
  console.log(content.substring(idx2 - 100, idx2 + 100));
} else {
  console.log("Not found 2");
}
