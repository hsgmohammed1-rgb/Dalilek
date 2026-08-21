const fs = require('fs');
const code = fs.readFileSync('C:\\Users\\MOH\\Documents\\GG\\Dalilek\\zip-repl-2-5zipzip\\bulk-admin.js', 'utf8');

const allowedMatches = code.match(/const ALLOWED_CATEGORIES = \[([^\]]+)\]/);
let allowedStr = allowedMatches[1].replace(/'/g, '').replace(/,/g, '').split(/\s+/).filter(Boolean);

const mapMatches = code.match(/const CATEGORY_TO_TEMPLATES = {([^}]+)}/);
let mapStr = mapMatches[1];
const mapKeys = [];
const regex = /'([^']+)'\s*:/g;
let m;
while ((m = regex.exec(mapStr)) !== null) {
  mapKeys.push(m[1]);
}

const missing = allowedStr.filter(cat => !mapKeys.includes(cat));
console.log('Missing categories in mapping:', missing);
