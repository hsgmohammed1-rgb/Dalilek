const fs = require('fs');
const bundlePath = 'C:\\Users\\MOH\\Documents\\GG\\Dalilek\\zip-repl-2-5zipzip\\assets\\index-CdSb2jcH.v4.clean.js';
let bundle = fs.readFileSync(bundlePath, 'utf8');

const templates = [
  { id: 16, name: "تقنية – سايبر المستقبل", category: "تكنولوجيا", theme: "cyber-ai", accent: "#00F0FF", bg: "from-[#0A0E17] to-[#05070A] via-[#000000]" },
  { id: 17, name: "فضاء – سديم كوني", category: "فلك وكون", theme: "cosmos-space", accent: "#FFD700", bg: "from-[#1B0B3A] to-[#0D051A] via-[#000000]" },
  { id: 18, name: "تاريخ – أثر عتيق", category: "تاريخ", theme: "history-heritage", accent: "#4A3525", bg: "from-[#F4ECE1] to-[#E3D5C5] via-[#E8E0D1]" },
  { id: 19, name: "طب – عناية وشغف", category: "صحة وطب", theme: "health-medical", accent: "#00B894", bg: "from-[#F8F9FA] to-[#E9ECEF] via-[#F1F3F5]" },
  { id: 20, name: "طهي – نكهات العالم", category: "طبخ وتغذية", theme: "gastronomy-food", accent: "#C0392B", bg: "from-[#FDF2E9] to-[#FADBD8] via-[#F8E0D7]" },
  { id: 21, name: "عمارة – مخطط استراتيجي", category: "هندسة", theme: "architecture-build", accent: "#1B365D", bg: "from-[#E2E8F0] to-[#CBD5E1] via-[#F1F5F9]" },
  { id: 22, name: "فلسفة – حكمة العقول", category: "فلسفة", theme: "philosophy-thought", accent: "#2C3A2E", bg: "from-[#BDC3C7] to-[#95A5A6] via-[#ECF0F1]" },
  { id: 23, name: "ألعاب – جيل الـ RGB", category: "ألعاب إلكترونية", theme: "gaming-esports", accent: "#2ECC71", bg: "from-[#1A1A1D] to-[#0D0D0E] via-[#000000]" },
  { id: 24, name: "محركات – كربون وسرعة", category: "سيارات", theme: "automotive-speed", accent: "#E74C3C", bg: "from-[#121212] to-[#000000] via-[#0A0A0A]" },
  { id: 25, name: "قانون – ميزان الحق", category: "قانون", theme: "law-justice", accent: "#D4AF37", bg: "from-[#0C2340] to-[#040C17] via-[#000000]" },
  { id: 26, name: "أحياء – مملكة الطبيعة", category: "حيوانات وعلم الأحياء", theme: "zoology-nature", accent: "#D35400", bg: "from-[#1E4620] to-[#0E2110] via-[#142F15]" },
  { id: 27, name: "استثمار – كربتو واقتصاد", category: "اقتصاد وتداول", theme: "crypto-finance", accent: "#FDCB6E", bg: "from-[#022A21] to-[#00100C] via-[#000000]" },
  { id: 28, name: "موضة – أنثوي وعصري", category: "موضة وجمال", theme: "fashion-style", accent: "#B76E79", bg: "from-[#111111] to-[#000000] via-[#0A0A0A]" },
  { id: 29, name: "أساطير – خيال غامض", category: "أساطير وفلكلور", theme: "mythology-folklore", accent: "#95A5A6", bg: "from-[#2D132C] to-[#150914] via-[#000000]" },
  { id: 30, name: "طفولة – عالم البراءة", category: "تربية وطفولة", theme: "kids-parenting", accent: "#F1C40F", bg: "from-[#E3F2FD] to-[#BBDEFB] via-[#E1F5FE]" }
];
const icons = ['kd', 'ma', 'ya', 'dn', 'Dd', 'Rd', 'Bl', 'Pd', 'Hl', 'Ad', '', 'zl', 'Cd', 'zg', 'Vl'];

// 1. Color Map
let bStr = '15:"#64748b"';
for (const t of templates) bStr += ,:"";
bundle = bundle.replace('15:"#64748b"}', bStr + '}');

// 2. Icon Map
let ubStr = '15:Vl';
for (let i = 0; i < templates.length; i++) ubStr += ,:;
bundle = bundle.replace('15:Vl}', ubStr + '}');

// 3. Name Map
let pbStr = '15:"أخبار — صحافة سريعة"';
for (const t of templates) pbStr += ,:"";
bundle = bundle.replace('15:"أخبار — صحافة سريعة"}', pbStr + '}');

// 4. Admin List
let alEnd = 'layout:"hero-press"}]';
let alStr = 'layout:"hero-press"}';
for (let i = 0; i < templates.length; i++) {
  const t = templates[i];
  alStr += ,{id:,name:"",category:"",icon:,theme:"",accent:"",bg:""};
}
alStr += ']';
bundle = bundle.replace(alEnd, alStr);

// 5. System prompt replacements
bundle = bundle.replace(/1-15/g, '1-30'); 

fs.writeFileSync(bundlePath, bundle, 'utf8');
console.log('Patched bundle successfully.');
