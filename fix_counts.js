const fs = require('fs');
const path = require('path');

const seoData = JSON.parse(fs.readFileSync('seo-data.json', 'utf8'));
const counts = {};
Object.values(seoData).forEach(a => {
  if (a.category) {
    counts[a.category] = (counts[a.category] || 0) + 1;
  }
});
const totalArticles = Object.values(seoData).length;

const assetsDir = path.join(__dirname, 'assets');
const files = fs.readdirSync(assetsDir);

files.forEach(file => {
  if (file.startsWith('index-') && file.endsWith('.js')) {
    let content = fs.readFileSync(path.join(assetsDir, file), 'utf8');
    
    // Replace all articleCount values based on the category name
    let modified = false;
    content = content.replace(/name:"([^"]+)"([^}]*?)articleCount:(\d+)/g, (match, name, middle, oldNum) => {
      if (counts[name] !== undefined) {
        if (counts[name] !== parseInt(oldNum)) modified = true;
        return `name:"${name}"${middle}articleCount:${counts[name]}`;
      }
      return match;
    });

    // Replace the 767 total count
    content = content.replace(/767/g, () => {
      modified = true;
      return totalArticles.toString();
    });

    if (modified) {
      fs.writeFileSync(path.join(assetsDir, file), content, 'utf8');
      console.log(`Updated ${file}`);
    }
  }
});
console.log('Total articles:', totalArticles);
console.log('Counts per category:', counts);
