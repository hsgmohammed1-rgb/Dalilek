var fs=require('fs');
var v3=fs.readFileSync('assets/index-CdSb2jcH.v3.js','utf8');
var ai=v3.indexOf('function Ai(');
var bc=0,started=false;
for(var i=ai;i<v3.length;i++){
  if(v3[i]==='{'){bc++;started=true;}
  else if(v3[i]==='}'){bc--;}
  if(started&&bc===0){
    fs.writeFileSync('ai_component.txt', v3.substring(ai,i+1));
    console.log('Saved. Length:', i+1-ai);
    break;
  }
}
