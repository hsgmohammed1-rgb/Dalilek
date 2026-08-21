const fs = require('fs');
const v4 = fs.readFileSync('assets/index-CdSb2jcH.v4.js', 'utf8');
const idx = v4.indexOf('avg_rating');
if (idx >= 0) {
  const ctx = v4.substring(idx - 80, idx + 150);
  console.log('Hero rating context:');
  console.log(ctx);
}
// Also check the hero star
const starIdx = v4.indexOf('toFixed');
if (starIdx >= 0) {
  const ctx = v4.substring(starIdx, starIdx + 200);
  console.log('Hero star context:');
  console.log(ctx);
}
