const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'assets');
const files = fs.readdirSync(assetsDir);

// The target file
const targetFile = 'index-CdSb2jcH.v5.1c55cef1.js';
const content = fs.readFileSync(path.join(assetsDir, targetFile), 'utf8');

// Find the current GI component - it renders all articles at once without pagination
// We need to replace it with a version that has a "Load More" button

// The old component code (the key part we need to replace):
// The articles grid directly maps all: o.map((u,h)=>...)
// We need to add useState for visible count + load more button

// OLD pattern to find:
const oldPattern = 'function GI(){const{id:e}=wd(),{t,lang:s}=ct(),r=ua.find(u=>u.id===e)||ua.find(u=>u.name===e||u.nameEn===e);if(!r)return i.jsx(P0,{});const{data:o=[],isLoading:c}=xI(r.name,s);return';

const oldPatternEscaped = 'function GI(){const{id:e}=wd(),{t,lang:s}=ct(),r=ua.find(u=\u003eu.id===e)||ua.find(u=\u003eu.name===e||u.nameEn===e);if(!r)return i.jsx(P0,{});const{data:o=[],isLoading:c}=xI(r.name,s);return';

// Check both escape styles
let idx = content.indexOf(oldPattern);
if (idx === -1) idx = content.indexOf(oldPatternEscaped);

if (idx !== -1) {
    console.log('Found GI function at index:', idx);
} else {
    console.log('Could not find GI function - trying alternative search');
    const idx2 = content.indexOf('function GI()');
    console.log('function GI() at:', idx2);
    if (idx2 !== -1) {
        console.log(content.substring(idx2, idx2 + 200));
    }
}

// Now find the old grid rendering part
const oldGrid = 'i.jsx("div",{className:"grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6",children:o.map((u,h)=>';
const oldGridEscaped = 'i.jsx("div",{className:"grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6",children:o.map((u,h)=\u003e';

let gridIdx = content.indexOf(oldGrid);
if (gridIdx === -1) gridIdx = content.indexOf(oldGridEscaped);

if (gridIdx !== -1) {
    console.log('\nFound grid at index:', gridIdx);
    console.log(content.substring(gridIdx, gridIdx + 400));
} else {
    console.log('Grid not found');
}
