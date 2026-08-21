const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'assets');
const files = fs.readdirSync(assetsDir);

// Process all index-CdSb2jcH*.js files EXCEPT v5 (already done)
const targetFiles = files.filter(f => f.startsWith('index-CdSb2jcH') && f.endsWith('.js') && !f.includes('v5'));

targetFiles.forEach(file => {
    const filePath = path.join(assetsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Check if this file has the GI function
    if (!content.includes('function GI()')) {
        console.log(`[${file}] No GI function found, skipping`);
        return;
    }
    
    // 1. Add useState for visible count
    const oldInit = 'const{data:o=[],isLoading:c}=xI(r.name,s);return';
    const newInit = 'const{data:o=[],isLoading:c}=xI(r.name,s);const[WA,QA]=N.useState(24);return';
    
    if (content.includes(oldInit) && !content.includes(newInit)) {
        content = content.replace(oldInit, newInit);
        modified = true;
        console.log(`[${file}] Added useState`);
    }
    
    // 2. Replace grid mapping with slice
    const oldGrid = 'gap-5 sm:gap-6",children:o.map((u,h)=>';
    const newGrid = 'gap-5 sm:gap-6",children:o.slice(0,WA).map((u,h)=>';
    
    if (content.includes(oldGrid) && !content.includes(newGrid)) {
        content = content.replace(oldGrid, newGrid);
        modified = true;
        console.log(`[${file}] Replaced grid`);
    }
    
    // 3. Add Load More button
    const oldAfterGrid = '},u.id))})}),i.jsx(Gt,{})';
    const loadMoreButton = `},u.id))})}),WA<o.length&&i.jsx("div",{className:"flex justify-center mt-10 mb-6",children:i.jsxs("button",{onClick:()=>QA(p=>p+24),className:"group relative inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-base text-white transition-all duration-300 hover:scale-105 hover:shadow-2xl active:scale-95",style:{background:"linear-gradient(135deg, "+r.color+" 0%, "+(r.color||"#14b8a6")+" 100%)",boxShadow:"0 4px 20px "+(r.color||"#14b8a6")+"40"},children:[i.jsx("span",{children:t.allArticles.loadMore||"\\u0639\\u0631\\u0636 \\u0627\\u0644\\u0645\\u0632\\u064a\\u062f"}),i.jsxs("span",{className:"text-sm opacity-80",children:["(",o.length-WA," ",t.categoriesPage.articles||"\\u0645\\u0642\\u0627\\u0644",")"]})]})})`;
    
    if (content.includes(oldAfterGrid) && !content.includes('WA<o.length')) {
        content = content.replace(oldAfterGrid, loadMoreButton + '),i.jsx(Gt,{})');
        modified = true;
        console.log(`[${file}] Added Load More`);
    }
    
    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`[${file}] SAVED`);
    } else {
        console.log(`[${file}] No changes needed or patterns not found`);
    }
});
