const fs = require('fs');
const v4 = fs.readFileSync('assets/index-CdSb2jcH.v4.js', 'utf8');

// Find the area after author card and before share div
const authorRoleIdx = v4.indexOf('g.article.authorRole');
if (authorRoleIdx === -1) {
  console.log('Could not find authorRole');
  process.exit(1);
}

// From authorRole, skip forward past the author card closing
// The author card ends with }]}), and then our stars section, then the share div
const searchStart = authorRoleIdx;
const shareBtnStart = v4.indexOf('i.jsxs("button",{onClick:()=>navigator.share', searchStart);
if (shareBtnStart === -1) {
  console.log('Could not find share button');
  process.exit(1);
}

// Show everything between authorRole and share button
const section = v4.substring(searchStart, shareBtnStart);
console.log('Section length: ' + section.length);
console.log('START---');
console.log(section);
console.log('---END');

// Now count bracket balance of this section
let brace = 0, paren = 0;
for (const c of section) {
  if (c === '{') brace++;
  else if (c === '}') brace--;
  else if (c === '(') paren++;
  else if (c === ')') paren--;
}
console.log('Section balance: brace=' + brace + ' paren=' + paren);
