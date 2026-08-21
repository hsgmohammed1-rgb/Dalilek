const fs = require('fs');
const bundle = fs.readFileSync('C:\\Users\\MOH\\Documents\\GG\\Dalilek\\zip-repl-2-5zipzip\\assets\\index-CdSb2jcH.v4.clean.js', 'utf8');

const alRegex = /al=\[\{.*?\}\]/;
const match = bundle.match(alRegex);
if (match) {
  console.log('al array length in chars:', match[0].length);
  console.log('Contains 16:', match[0].includes('id:16'));
} else {
  console.log('al not found!');
}
