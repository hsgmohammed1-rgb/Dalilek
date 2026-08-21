const fs = require('fs');
const lines = fs.readFileSync('bulk-admin.js', 'utf8').split('\n');

// We need to delete lines 972 to 1037 (which is index 971 to 1036)
lines.splice(971, 1037 - 972 + 1);

fs.writeFileSync('bulk-admin.js', lines.join('\n'));
console.log('Fixed syntax error');
