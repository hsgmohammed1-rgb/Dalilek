const fs = require('fs');
const bundle = fs.readFileSync('C:\\Users\\MOH\\Documents\\GG\\Dalilek\\zip-repl-2-5zipzip\\assets\\index-CdSb2jcH.v4.clean.js', 'utf8');

console.log('---  ---');
console.log(bundle.match(/\=\{.*?(14:.*?,?15:.*?)\}/)?.[1]);

console.log('--- UB ---');
console.log(bundle.match(/UB=\{.*?(14:.*?,?15:.*?)\}/)?.[1]);

console.log('--- al ---');
console.log(bundle.match(/al=\[.*?(id:15.*?)\}/)?.[1]);
