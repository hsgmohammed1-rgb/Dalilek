const fs = require('fs');
const v4 = fs.readFileSync('assets/index-CdSb2jcH.v4.js', 'utf8');

// Find the hero star - search for the specific pattern
// The hero star is in a condition with w&&
const heroIdx = v4.indexOf('w&&i.jsxs("div"');
if (heroIdx >= 0) {
  const ctx = v4.substring(heroIdx, heroIdx + 300);
  console.log('Hero rating section:');
  console.log(ctx);
} else {
  // Try without "div"
  const heroIdx2 = v4.indexOf('w&&i.jsx');
  if (heroIdx2 >= 0) {
    const ctx = v4.substring(heroIdx2, heroIdx2 + 400);
    console.log('w&&i.jsx section:');
    console.log(ctx);
  }
}
