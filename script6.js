const fs = require('fs');
const bundle = fs.readFileSync('C:\\Users\\MOH\\Documents\\GG\\Dalilek\\zip-repl-2-5zipzip\\assets\\index-CdSb2jcH.v4.clean.js', 'utf8');

const alRegex = /([a-zA-Z0-9$]+)=\[\{id:1,name:".*?layout:"hero-press"\}\]/;
const match = bundle.match(alRegex);
if (match) {
  console.log('Found Admin List variable name:', match[1]);
  console.log('Length:', match[0].length);
  console.log('Ends with:', match[0].substring(match[0].length - 100));
} else {
  console.log('al not found!');
}
