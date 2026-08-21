const fs = require('fs');
const v2 = fs.readFileSync('assets/index-CdSb2jcH.v2.js', 'utf8');
const v4 = fs.readFileSync('assets/index-CdSb2jcH.v4.js', 'utf8');

// Find the useEffect that fetches the article in both files
// It should contain "Oe.from(\"articles\").select"
const v2EffectStart = v2.indexOf('Oe.from("articles").select("*")');
const v4EffectStart = v4.indexOf('Oe.from("articles").select("*")');

if (v2EffectStart >= 0) {
  const v2EffectEnd = v2.indexOf(',[e])', v2EffectStart) + 6;
  const v2Effect = v2.substring(v2EffectStart, v2EffectEnd);
  console.log('v2 useEffect:');
  console.log(v2Effect.substring(0, 500));
  console.log('...');
  console.log('Has /api/rate:', v2Effect.includes('/api/rate'));
  console.log('Has avg_rating:', v2Effect.includes('avg_rating'));
}

console.log('---');

if (v4EffectStart >= 0) {
  const v4EffectEnd = v4.indexOf(',[e])', v4EffectStart) + 6;
  const v4Effect = v4.substring(v4EffectStart, v4EffectEnd);
  console.log('v4 useEffect:');
  console.log(v4Effect.substring(0, 500));
  console.log('...');
  console.log('Has /api/rate:', v4Effect.includes('/api/rate'));
  console.log('Has avg_rating:', v4Effect.includes('avg_rating'));
}
