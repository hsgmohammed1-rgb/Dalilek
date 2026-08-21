const fs = require('fs');
let code = fs.readFileSync('bulk-admin.js', 'utf8');

const startMarker = '  // Categories the site actually supports';
const endMarker = '  }'; // The end of getTemplateForCategory

const startIdx = code.indexOf(startMarker);
if (startIdx === -1) {
    console.error('start marker not found');
    process.exit(1);
}
// Find getTemplateForCategory definition
const funcStart = code.indexOf('function getTemplateForCategory', startIdx);
const funcEnd = code.indexOf('}', funcStart) + 1;

// The block to extract is from startIdx to funcEnd
const blockToMove = code.substring(startIdx, funcEnd);

// Remove the block from its current location
code = code.substring(0, startIdx) + code.substring(funcEnd);

// Insert the block just before discoverTopics
const insertPoint = code.indexOf('async function discoverTopics');
code = code.substring(0, insertPoint) + blockToMove + '\n\n' + code.substring(insertPoint);

fs.writeFileSync('bulk-admin.js', code);
console.log('Successfully moved categories to global scope.');
