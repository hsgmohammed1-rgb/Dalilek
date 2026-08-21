const fs = require('fs');
const content = fs.readFileSync('assets/index-CdSb2jcH.v5.1c55cef1.js', 'utf8');

// Find the category page component - search for /category/ route handling
const idx = content.indexOf('ilike("category"');
if (idx !== -1) {
    const start = Math.max(0, idx - 500);
    const end = Math.min(content.length, idx + 500);
    console.log('=== AROUND ilike("category") ===');
    console.log(content.substring(start, end));
}

console.log('\n\n=== SEARCHING FOR CATEGORY PAGE COMPONENT ===');
// Find the component that uses the category articles query
const idx2 = content.indexOf('categoryArticles');
if (idx2 !== -1) {
    const start = Math.max(0, idx2 - 300);
    const end = Math.min(content.length, idx2 + 500);
    console.log(content.substring(start, end));
} else {
    // Try alternative search
    const idx3 = content.indexOf('"category",e');
    if (idx3 !== -1) {
        const start = Math.max(0, idx3 - 300);
        const end = Math.min(content.length, idx3 + 500);
        console.log(content.substring(start, end));
    }
}
