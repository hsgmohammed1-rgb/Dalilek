const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'assets');

// Process only the active v5 file
const targetFiles = [
    'index-CdSb2jcH.v5.1c55cef1.js'
];

targetFiles.forEach(file => {
    const filePath = path.join(assetsDir, file);
    if (!fs.existsSync(filePath)) {
        console.log(`Skipping ${file} - not found`);
        return;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 1. Replace `function GI(){` to add useState for visible count
    // OLD: function GI(){const{id:e}=wd(),{t,lang:s}=ct(),...const{data:o=[],isLoading:c}=xI(r.name,s);return
    // NEW: function GI(){const{id:e}=wd(),{t,lang:s}=ct(),...const{data:o=[],isLoading:c}=xI(r.name,s);const[WA,QA]=N.useState(24);return
    
    const oldInit = 'const{data:o=[],isLoading:c}=xI(r.name,s);return';
    const newInit = 'const{data:o=[],isLoading:c}=xI(r.name,s);const[WA,QA]=N.useState(24);return';
    
    if (content.includes(oldInit)) {
        content = content.replace(oldInit, newInit);
        console.log(`[${file}] Added useState for visible count`);
    } else {
        console.log(`[${file}] Could not find oldInit pattern`);
    }
    
    // 2. Replace the grid mapping to use slice
    // OLD: o.map((u,h)=>i.jsx(Z.div,...
    // NEW: o.slice(0,WA).map((u,h)=>i.jsx(Z.div,...
    // But we need to be precise - only in the GI component grid
    
    const oldGrid = 'gap-5 sm:gap-6",children:o.map((u,h)=>';
    const newGrid = 'gap-5 sm:gap-6",children:o.slice(0,WA).map((u,h)=>';
    
    if (content.includes(oldGrid)) {
        content = content.replace(oldGrid, newGrid);
        console.log(`[${file}] Replaced o.map with o.slice(0,WA).map`);
    } else {
        console.log(`[${file}] Could not find oldGrid pattern`);
    }
    
    // 3. Add Load More button after the grid, before the footer
    // Find the closing of the grid section and the footer
    // OLD: },u.id))})}),i.jsx(Gt,{})
    // We need to add a load more button between the grid and footer
    
    // The pattern after the grid articles mapping ends with: },u.id))})}),i.jsx(Gt,{})
    // We replace it with: },u.id))})}),WA<o.length&&i.jsx("div",{...load more button...})),i.jsx(Gt,{})
    
    const oldAfterGrid = '},u.id))})}),i.jsx(Gt,{})';
    const loadMoreButton = `},u.id))})}),WA<o.length&&i.jsx("div",{className:"flex justify-center mt-10 mb-6",children:i.jsxs("button",{onClick:()=>QA(p=>p+24),className:"group relative inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-base text-white transition-all duration-300 hover:scale-105 hover:shadow-2xl active:scale-95",style:{background:"linear-gradient(135deg, "+r.color+" 0%, "+(r.color||"#14b8a6")+" 100%)",boxShadow:"0 4px 20px "+(r.color||"#14b8a6")+"40"},children:[i.jsx("span",{children:t.allArticles.loadMore||"\\u0639\\u0631\\u0636 \\u0627\\u0644\\u0645\\u0632\\u064a\\u062f"}),i.jsxs("span",{className:"text-sm opacity-80",children:["(",o.length-WA," ",t.categoriesPage.articles||"\\u0645\\u0642\\u0627\\u0644",")"]})]})})`;
    
    if (content.includes(oldAfterGrid)) {
        content = content.replace(oldAfterGrid, loadMoreButton + ',i.jsx(Gt,{})');
        console.log(`[${file}] Added Load More button`);
    } else {
        console.log(`[${file}] Could not find oldAfterGrid pattern`);
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[${file}] Saved!`);
});
