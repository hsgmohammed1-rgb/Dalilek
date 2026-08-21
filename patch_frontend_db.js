const fs = require('fs');
const path = require('path');
const files = fs.readdirSync('assets').filter(f => f.startsWith('index-CdSb2jcH') && f.endsWith('.js'));

files.forEach(f => {
  let fp = path.join('assets', f);
  let c = fs.readFileSync(fp, 'utf8');
  let original = c;

  // Replace OLD host with NEW host
  c = c.replace(/pbebygpwujbtlwuhatmm\.supabase\.co/g, 'llslymirrsvwaoxwpvnx.supabase.co');
  
  // Replace OLD key with NEW key
  c = c.replace(/sb_publishable_3-K38RffYjPB0a2FVeoLxQ__OCcfpxt/g, 'sb_publishable_0N4MItJPCrEc502BK7jutQ_JGbSlZZE');

  if (c !== original) {
    fs.writeFileSync(fp, c);
    console.log(f + ' patched database to NEW');
  }
});
