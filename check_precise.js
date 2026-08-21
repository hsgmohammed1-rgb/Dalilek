const fs = require('fs');
let v4 = fs.readFileSync('assets/index-CdSb2jcH.v4.js', 'utf8');

// Find the exact closing of the stars section
// Find a unique string around the stars area
const marker = 'gap-1 sm:gap-3 my-10';
const starIdx = v4.indexOf(marker);
if (starIdx >= 0) {
  // Find what comes after the stars div
  const afterStars = v4.indexOf('sm:flex-row', starIdx);
  if (afterStars >= 0) {
    const section = v4.substring(starIdx, afterStars);
    console.log('Section from stars start to share end:');
    // Find the last 50 chars
    console.log('Section length:', section.length);
    console.log('Last 100 chars:');
    console.log(section.substring(section.length - 100));
    console.log('---');
    
    // Find the closing of the stars div (after the last map close)
    const childrenYIdx = v4.lastIndexOf('children:Y', afterStars);
    if (childrenYIdx >= 0) {
      const closingSection = v4.substring(childrenYIdx, childrenYIdx + 40);
      console.log('Closing section:');
      console.log(closingSection);
      console.log('Chars:');
      for (let i = 0; i < closingSection.length; i++) {
        console.log('  [' + i + '] "' + closingSection[i] + '" (' + closingSection.charCodeAt(i) + ')');
      }
    }
  }
}
