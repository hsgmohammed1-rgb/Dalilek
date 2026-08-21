const fs = require('fs');
let content = fs.readFileSync('assets/index-CdSb2jcH.v5.1c55cef1.js', 'utf8');
let matches = [];
let re = /name:"([^"]+)"([^}]*?)articleCount:(\d+)/g;
let m;
while(m = re.exec(content)) {
  matches.push(m[1] + ' -> ' + m[3]);
}
console.log(matches.slice(0, 10));
