var fs=require('fs');
var v3=fs.readFileSync('assets/index-CdSb2jcH.v3.js','utf8');
var ai=v3.indexOf('function Ai(');
var bodyStart=v3.indexOf('{', ai+10); // Find the first { after 'function Ai('
// Actually, the pattern is: function Ai(...params...){
// So find the ) before {
var parenEnd=v3.indexOf(')', ai+10);
bodyStart=v3.indexOf('{', parenEnd);
console.log('Body starts at:', bodyStart);
console.log('First 100 chars of body:', v3.substring(bodyStart, bodyStart+100));
var bc=1,started=false;
for(var i=bodyStart+1;i<v3.length;i++){
  if(v3[i]==='{' && !started){
    bc++;
  } else if(v3[i]==='}'){
    bc--;
    if(bc===0){
      console.log('Component ends at:', i);
      console.log('Length:', i-bodyStart+1);
      fs.writeFileSync('ai_component.txt', v3.substring(ai,i+1));
      break;
    }
  }
  started=true;
}
