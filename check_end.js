const fs = require('fs');
const v4 = fs.readFileSync('assets/index-CdSb2jcH.v4.js', 'utf8');

// Check the last 200 chars
console.log('Last 200 chars:');
console.log(v4.substring(v4.length - 200));

// Check the first 200 chars
console.log('\nFirst 200 chars:');
console.log(v4.substring(0, 200));

// Check if the file exports anything at the end
const lastLine = v4.split('\n').pop();
console.log('\nLast line:', lastLine);

// Check for the createRoot pattern
const hasCreateRoot = v4.includes('createRoot');
const hasRender = v4.includes('.render(');
console.log('\nHas createRoot:', hasCreateRoot);
console.log('Has render:', hasRender);

// Check if the file starts with an import
const startsWithImport = v4.trim().startsWith('import');
console.log('Starts with import:', startsWithImport);

// Count import statements
const imports = v4.match(/^import\s/gm);
console.log('Number of import statements:', imports ? imports.length : 0);
