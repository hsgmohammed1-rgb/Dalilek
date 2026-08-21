const fs = require('fs');
const content = fs.readFileSync('assets/index-CdSb2jcH.v5.1c55cef1.js', 'utf8');

// Looking for `y=BI[t]||"articles"` which we saw earlier!
// In that same component, we saw `{data:u={},isLoading:h}=yI()`
// Let's find the full text of that component
const index = content.indexOf('y=BI[t]||"articles"');
if (index !== -1) {
    const start = Math.max(0, index - 300);
    const end = Math.min(content.length, index + 700);
    console.log(content.substring(start, end));
} else {
    console.log('Not found');
}
