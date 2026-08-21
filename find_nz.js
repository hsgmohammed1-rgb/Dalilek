var fs=require('fs');
var v3=fs.readFileSync('assets/index-CdSb2jcH.v3.js','utf8');
// Find Nz component
var nz=v3.indexOf('function Nz(');
var parenEnd=v3.indexOf(')', nz+10);
var bodyStart=v3.indexOf('{', parenEnd);
console.log('Nz body at:', bodyStart);
var bc=1;
for(var i=bodyStart+1;i<v3.length;i++){
  if(v3[i]==='{') bc++;
  else if(v3[i]==='}') bc--;
  if(bc===0){
    console.log('Nz ends at:', i);
    // Save to file
    fs.writeFileSync('nz_component.txt', v3.substring(nz,i+1));
    break;
  }
}
// Find where ratings-related text appears in Nz
var nzSec=v3.substring(nz, Math.min(nz+15000, v3.length));
var idx=nzSec.indexOf('className:"min-h-screen');
console.log('min-h-screen at:', idx, 'in Nz');
console.log('Context:', nzSec.substring(idx, idx+200));
