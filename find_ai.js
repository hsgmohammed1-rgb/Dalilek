var fs=require('fs');
var v3=fs.readFileSync('assets/index-CdSb2jcH.v3.js','utf8');
// Find ALL occurrences of Ai
var pos=0,count=0;
while((pos=v3.indexOf('function Ai(',pos))!==-1){
  console.log('Found at:', pos, 'context:', v3.substring(pos, Math.min(pos+60, v3.length)));
  pos+=10;
  count++;
  if(count>5)break;
}
// Also search for Ai= and Ai =
pos=0;
while((pos=v3.indexOf('Ai=',pos))!==-1){
  console.log('Ai= at:', pos, 'context:', v3.substring(pos, pos+50));
  pos+=3;
  if(pos>v3.indexOf('function Sz(')) break;
}
