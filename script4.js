const fs = require('fs');
const bundle = fs.readFileSync('C:\\Users\\MOH\\Documents\\GG\\Dalilek\\zip-repl-2-5zipzip\\assets\\index-CdSb2jcH.v4.clean.js', 'utf8');

const nameMap = bundle.match(/[a-zA-Z0-9$]+=\{1:"???? — ???? ?????".*?(15:".*?")\}/);
if (nameMap) console.log('Name map:', nameMap[0]);

const colorMap = bundle.match(/[a-zA-Z0-9$]+=\{1:"#00e6c8".*?(15:".*?")\}/);
if (colorMap) console.log('Color map:', colorMap[0]);
