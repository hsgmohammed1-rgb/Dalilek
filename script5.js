const fs = require('fs');
const bundlePath = 'C:\\Users\\MOH\\Documents\\GG\\Dalilek\\zip-repl-2-5zipzip\\assets\\index-CdSb2jcH.v4.clean.js';
let bundle = fs.readFileSync(bundlePath, 'utf8');

// 1. Color map  (starts with 1:"#00e6c8", ends with 15:"#64748b"})
const colorMapRegex = /([a-zA-Z0-9$]+)=\{1:"#00e6c8".*?15:"#64748b"\}/;
let match = bundle.match(colorMapRegex);
if (match) {
  console.log('Found Color Map:', match[0]);
}

// 2. Icon map UB (15:Vl})
const iconMapRegex = /([a-zA-Z0-9$]+)=\{1:kd,.*?15:Vl\}/;
match = bundle.match(iconMapRegex);
if (match) {
  console.log('Found Icon Map:', match[0]);
}

// 3. Name map PB (ends with 15:"أخبار — صحافة سريعة"})
// Since Arabic in Regex via PowerShell might fail, we will search via generic text
const nameMapRegex = /([a-zA-Z0-9$]+)=\{1:"[^"]+".*?15:"[^"]+"\}/g;
let matches = [...bundle.matchAll(nameMapRegex)];
for (const m of matches) {
  if (m[0].includes('أخبار')) {
    console.log('Found Name Map:', m[0]);
  }
}

// 4. Admin list al (starts with [{id:1,name:..., ends with layout:"hero-press"}])
const alRegex = /([a-zA-Z0-9$]+)=\[\{id:1,name:".*?layout:"hero-press"\}\];/;
match = bundle.match(alRegex);
if (match) {
  console.log('Found Admin List length:', match[0].length);
}
