const fs = require('fs');
const content = fs.readFileSync('assets/index-CdSb2jcH.v5.1c55cef1.js', 'utf8');

// Check that all 3 changes are present
const checks = [
    { name: 'useState for WA', pattern: 'const[WA,QA]=N.useState(24)' },
    { name: 'slice(0,WA)', pattern: 'o.slice(0,WA).map' },
    { name: 'Load More button', pattern: 'WA<o.length' },
    { name: 'Load More onClick', pattern: 'QA(p=>p+24)' },
    { name: 'loadMore text', pattern: 'allArticles.loadMore' },
];

checks.forEach(c => {
    const found = content.includes(c.pattern);
    console.log(`${found ? '✓' : '✗'} ${c.name}: ${found ? 'FOUND' : 'NOT FOUND'}`);
});

// Show the modified GI function area
const idx = content.indexOf('function GI()');
if (idx !== -1) {
    console.log('\n=== GI FUNCTION (first 500 chars) ===');
    console.log(content.substring(idx, idx + 300));
}

// Show the grid + load more area
const gridIdx = content.indexOf('o.slice(0,WA).map');
if (gridIdx !== -1) {
    console.log('\n=== GRID + LOAD MORE ===');
    console.log(content.substring(gridIdx, gridIdx + 800));
}
