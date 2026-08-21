const fs = require('fs');
const path = require('path');
const files = fs.readdirSync('assets').filter(f => f.startsWith('index-CdSb2jcH') && f.endsWith('.js'));

files.forEach(f => {
  let fp = path.join('assets', f);
  let c = fs.readFileSync(fp, 'utf8');
  let original = c;

  // Replace text instances of hsg-new.vercel.app with mohhsg.vercel.app
  c = c.replace(/children:\["hsg-new\.vercel\.app"/g, 'children:["mohhsg.vercel.app"');
  c = c.replace(/children:\["hsg-new\.vercel\.app "/g, 'children:["mohhsg.vercel.app "');

  if (c !== original) {
    fs.writeFileSync(fp, c);
    console.log(f + ' patched successfully');
  } else {
    console.log(f + ' no changes needed');
  }
});
