const fs = require('fs');
const path = 'C:\\Users\\MOH\\.gemini\\antigravity\\brain\\4caa1714-5b3b-4a63-943f-813ac13d08c4\\.system_generated\\logs\\transcript_full.jsonl';
const lines = fs.readFileSync(path, 'utf-8').split('\n');
let maxContent = '';
for (const line of lines) {
  if (!line) continue;
  try {
    const obj = JSON.parse(line);
    if (obj.type === 'USER_INPUT' && obj.content && obj.content.length > maxContent.length && !obj.content.includes('CHECKPOINT')) {
      maxContent = obj.content;
    }
  } catch(e) {}
}
fs.writeFileSync('C:\\Users\\MOH\\.gemini\\antigravity\\brain\\4caa1714-5b3b-4a63-943f-813ac13d08c4\\scratch\\longest_prompt.txt', maxContent);
console.log('Saved longest prompt of length ' + maxContent.length);
