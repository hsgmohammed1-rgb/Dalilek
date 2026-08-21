var fs=require('fs');
var v3=fs.readFileSync('assets/index-CdSb2jcH.v3.js','utf8');
var ai=v3.indexOf('function Ai(');
var parenEnd=v3.indexOf(')', ai+10);
var bodyStart=v3.indexOf('{', parenEnd);
console.log('Ai starts at:', ai, 'body at:', bodyStart);

// Count braces properly: find the matching close brace
var bc=1; // we've entered body at bodyStart
for(var i=bodyStart+1;i<v3.length;i++){
  if(v3[i]==='{') bc++;
  else if(v3[i]==='}') bc--;
  if(bc===0){
    console.log('End at:', i, 'length:', i-ai+1);
    console.log('Last 100 chars:', v3.substring(i-99, i+1));
    fs.writeFileSync('ai_component.txt', v3.substring(ai,i+1));
    break;
  }
}
