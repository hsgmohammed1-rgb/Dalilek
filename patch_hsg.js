const fs = require('fs');
const path = require('path');
const files = fs.readdirSync('assets').filter(f => f.startsWith('index-CdSb2jcH') && f.endsWith('.js'));

files.forEach(f => {
  let fp = path.join('assets', f);
  let c = fs.readFileSync(fp, 'utf8');
  let original = c;

  // 1. Change contact info: "الشركة" / "HSG" -> "المطور" / "Mohammed Ziyad"
  c = c.replace(/label:"الشركة",value:"HSG"/g, 'label:"المطور",value:"Mohammed Ziyad"');

  // 2. Change email from cpshzt@gmail.com
  // Keep the same email for now (it's the contact email)

  // 3. Change phone/whatsapp link
  c = c.replace(/href:"tel:\+14167377776"/g, 'href:"https://wa.me/message/4TYV7IWEUNAXN1"');
  c = c.replace(/\+1 \(416\) 737-7776/g, 'واتساب');

  // 4. Change about page HSG references
  c = c.replace(/"text-white font-black text-2xl",children:"HSG"/g, '"text-white font-black text-2xl",children:"Mohammed Ziyad"');
  c = c.replace(/"text-white font-black text-xl",children:"HSG"/g, '"text-white font-black text-xl",children:"Mohammed Ziyad"');
  c = c.replace(/"text-slate-400 text-sm",children:"Tech Company"/g, '"text-slate-400 text-sm",children:"Full-Stack Developer"');

  // 5. Change HSG logo to new logo
  c = c.replace(/https:\/\/hsg-new\.vercel\.app\/assets\/880o868973_1764355143132-DmkKtir2\.png/g, '/assets/mz-logo.png');

  // 6. Change HSG website link to Mohammed's website
  c = c.replace(/href:"https:\/\/hsg-new\.vercel\.app\/"/g, 'href:"https://mohhsg.vercel.app/"');

  // 7. In the terms/legal text, replace HSG with Mohammed Ziyad
  c = c.replace(/أو شركة HSG/g, 'أو Mohammed Ziyad');

  if (c !== original) {
    fs.writeFileSync(fp, c);
    console.log(f + ' patched successfully');
  } else {
    console.log(f + ' no changes needed');
  }
});
