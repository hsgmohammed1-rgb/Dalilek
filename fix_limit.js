const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'assets');
const files = fs.readdirSync(assetsDir);

files.forEach(file => {
  if (file.startsWith('index-') && file.endsWith('.js')) {
    let content = fs.readFileSync(path.join(assetsDir, file), 'utf8');
    
    // Replace .limit(24) with .limit(1000)
    let modified = false;
    if (content.includes('.limit(24)')) {
      content = content.replace(/\.limit\(24\)/g, '.limit(1000)');
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(path.join(assetsDir, file), content, 'utf8');
      console.log(`Updated limit in ${file}`);
    }
  }
});
