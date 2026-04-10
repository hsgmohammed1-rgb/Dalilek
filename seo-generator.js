require('dotenv').config();
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
// CRITICAL: Prefer JWT keys for REST API calls. sb_publishable_* keys do NOT work with PostgREST.
const SUPABASE_KEY = process.env.SERVICE_ROLE_API || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ANON_PUBLIC || process.env.SUPABASE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('CRITICAL: Supabase credentials missing from .env'); process.exit(1); }

async function supabaseFetch(path, method = 'GET', body = null) {
  const host = SUPABASE_URL.replace('https://', '').split('/')[0];
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: host,
      path: '/rest/v1/' + path,
      method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Prefer': 'return=representation',
      },
    };
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const CATEGORY_KEYWORDS = {
  'تكنولوجيا': {
    ar: 'تكنولوجيا, ذكاء اصطناعي, برمجة, أجهزة ذكية, إنترنت, تطبيقات, ابتكار, مستقبل رقمي, تحول رقمي, أمن معلومات, سحابة, بيانات ضخمة, روبوتات, تعلم آلي',
    en: 'technology, artificial intelligence, programming, smart devices, internet, apps, innovation, digital future, digital transformation, cybersecurity, cloud computing, big data, robotics, machine learning',
    fr: 'technologie, intelligence artificielle, programmation, appareils intelligents, internet, applications, innovation, avenir numérique, transformation numérique, cybersécurité, cloud, big data, robotique, apprentissage automatique',
    es: 'tecnología, inteligencia artificial, programación, dispositivos inteligentes, internet, aplicaciones, innovación, futuro digital, transformación digital, ciberseguridad, nube, big data, robótica, aprendizaje automático',
  },
  'صحة': {
    ar: 'صحة, طب, علاج, وقاية, غذاء صحي, رياضة, نصائح صحية, جسم سليم, صحة نفسية, مناعة, نوم, تغذية, أمراض, أدوية, صحة عامة',
    en: 'health, medicine, treatment, prevention, healthy food, fitness, wellness tips, healthy body, mental health, immunity, sleep, nutrition, diseases, medications, public health',
    fr: 'santé, médecine, traitement, prévention, alimentation saine, remise en forme, conseils santé, corps sain, santé mentale, immunité, sommeil, nutrition, maladies, médicaments',
    es: 'salud, medicina, tratamiento, prevención, alimentación saludable, fitness, consejos de salud, cuerpo sano, salud mental, inmunidad, sueño, nutrición, enfermedades, medicamentos',
  },
  'رياضة': {
    ar: 'رياضة, لياقة بدنية, كرة القدم, تمارين, صحة جسدية, بطولة, رياضيون, تدريب, أولمبياد, كرة السلة, سباحة, ركض, رياضة احترافية, إنجازات رياضية',
    en: 'sports, fitness, football, exercises, physical health, championship, athletes, training, olympics, basketball, swimming, running, professional sports, sporting achievements',
    fr: 'sport, fitness, football, exercices, santé physique, championnat, athlètes, entraînement, olympiades, basketball, natation, course à pied, sport professionnel',
    es: 'deporte, fitness, fútbol, ejercicios, salud física, campeonato, atletas, entrenamiento, olimpiadas, baloncesto, natación, running, deporte profesional',
  },
  'ثقافة': {
    ar: 'ثقافة, فنون, أدب, تراث, حضارة, إبداع, مجتمع, هوية, موسيقى, سينما, مسرح, شعر, روايات, تقاليد, تاريخ',
    en: 'culture, arts, literature, heritage, civilization, creativity, society, identity, music, cinema, theater, poetry, novels, traditions, history',
    fr: 'culture, arts, littérature, patrimoine, civilisation, créativité, société, identité, musique, cinéma, théâtre, poésie, romans, traditions, histoire',
    es: 'cultura, artes, literatura, patrimonio, civilización, creatividad, sociedad, identidad, música, cine, teatro, poesía, novelas, tradiciones, historia',
  },
  'أعمال': {
    ar: 'أعمال, ريادة الأعمال, استثمار, إدارة, شركات, مال, اقتصاد, نجاح مهني, تسويق, مبيعات, تجارة إلكترونية, إدارة مشاريع, قيادة, تخطيط مالي',
    en: 'business, entrepreneurship, investment, management, companies, finance, economy, career success, marketing, sales, e-commerce, project management, leadership, financial planning',
    fr: 'affaires, entrepreneuriat, investissement, gestion, entreprises, finance, économie, succès professionnel, marketing, ventes, e-commerce, gestion de projets, leadership',
    es: 'negocios, emprendimiento, inversión, gestión, empresas, finanzas, economía, éxito profesional, marketing, ventas, comercio electrónico, gestión de proyectos, liderazgo',
  },
  'علوم': {
    ar: 'علوم, بحث علمي, فيزياء, كيمياء, أحياء, اكتشافات, مختبر, نظريات, فضاء, طبيعة, بيئة, تطور, جينات, رياضيات, علم الأعصاب',
    en: 'science, research, physics, chemistry, biology, discoveries, laboratory, theories, space, nature, environment, evolution, genetics, mathematics, neuroscience',
    fr: 'sciences, recherche, physique, chimie, biologie, découvertes, laboratoire, théories, espace, nature, environnement, évolution, génétique, mathématiques',
    es: 'ciencias, investigación, física, química, biología, descubrimientos, laboratorio, teorías, espacio, naturaleza, medio ambiente, evolución, genética, matemáticas',
  },
  'تعليم': {
    ar: 'تعليم, تعلم, مدارس, جامعات, مناهج, مهارات, معرفة, طلاب, تعليم عن بعد, مدرسون, أساليب تدريس, أطفال, تنمية, قراءة, كتابة',
    en: 'education, learning, schools, universities, curriculum, skills, knowledge, students, remote learning, teachers, teaching methods, children, development, reading, writing',
    fr: 'éducation, apprentissage, écoles, universités, curriculum, compétences, connaissances, étudiants, apprentissage à distance, enseignants, méthodes pédagogiques',
    es: 'educación, aprendizaje, escuelas, universidades, currículo, habilidades, conocimientos, estudiantes, aprendizaje remoto, docentes, métodos de enseñanza',
  },
  'علم نفس وتطوير ذات': {
    ar: 'تطوير الذات, علم النفس, تحفيز, شخصية, مهارات, ثقة بالنفس, إدارة مشاعر, صحة نفسية, سعادة, تفكير إيجابي, تحقيق الأهداف, قوة الإرادة, عادات, نمو شخصي, تحول',
    en: 'self development, psychology, motivation, personality, skills, self confidence, emotional management, mental health, happiness, positive thinking, goal achievement, willpower, habits, personal growth, transformation',
    fr: 'développement personnel, psychologie, motivation, personnalité, compétences, confiance en soi, gestion des émotions, santé mentale, bonheur, pensée positive, atteinte des objectifs, force de volonté, habitudes',
    es: 'desarrollo personal, psicología, motivación, personalidad, habilidades, autoconfianza, gestión emocional, salud mental, felicidad, pensamiento positivo, logro de metas, fuerza de voluntad, hábitos',
  },
  'بيئة': {
    ar: 'بيئة, طبيعة, تغير مناخي, استدامة, تلوث, غابات, محيطات, طاقة متجددة, حفاظ على البيئة, تنوع حيوي, نباتات, حيوانات, مياه, هواء',
    en: 'environment, nature, climate change, sustainability, pollution, forests, oceans, renewable energy, environmental conservation, biodiversity, plants, animals, water, air',
    fr: 'environnement, nature, changement climatique, durabilité, pollution, forêts, océans, énergie renouvelable, conservation, biodiversité, plantes, animaux, eau, air',
    es: 'medio ambiente, naturaleza, cambio climático, sostenibilidad, contaminación, bosques, océanos, energía renovable, conservación ambiental, biodiversidad, plantas, animales, agua',
  },
  'فنون': {
    ar: 'فنون, رسم, تصوير, موسيقى, نحت, فن معاصر, معارض, فنانون, إبداع, تصميم, خط عربي, ألوان, فن تشكيلي, أفلام, مسرح',
    en: 'arts, drawing, photography, music, sculpture, contemporary art, exhibitions, artists, creativity, design, calligraphy, colors, visual art, films, theater',
    fr: 'arts, dessin, photographie, musique, sculpture, art contemporain, expositions, artistes, créativité, design, calligraphie, couleurs, art visuel',
    es: 'artes, dibujo, fotografía, música, escultura, arte contemporáneo, exposiciones, artistas, creatividad, diseño, caligrafía, colores, arte visual',
  },
};

const DEFAULT_KEYWORDS = {
  ar: 'دليلك, موسوعة عربية, مقالات, معرفة, ثقافة, تعليم, بحث, اكتشاف, معلومات, عالم',
  en: 'Dalilek, Arabic encyclopedia, articles, knowledge, culture, education, research, discovery, information, world',
  fr: 'Dalilek, encyclopédie arabe, articles, connaissance, culture, éducation, recherche, découverte, information',
  es: 'Dalilek, enciclopedia árabe, artículos, conocimiento, cultura, educación, investigación, descubrimiento, información',
};

function normalizeKeywords(str) {
  if (!str) return '';
  return str.replace(/[،؛]/g, ',').replace(/,+/g, ',').replace(/,\s*/g, ', ').trim().replace(/^,\s*/, '').replace(/,\s*$/, '');
}

function buildMultilingualKeywords(article) {
  const catKw = CATEGORY_KEYWORDS[article.category] || DEFAULT_KEYWORDS;

  const baseKw = article.seo_keywords
    ? article.seo_keywords.replace(/[،,؛]+/g, ',').split(',').map(k => k.trim()).filter(Boolean)
    : [];

  const arBase = baseKw.filter(k => /[\u0600-\u06FF]/.test(k)).join(', ');

  const arFull = normalizeKeywords([arBase, catKw.ar || DEFAULT_KEYWORDS.ar].filter(Boolean).join(', '));
  const enFull = normalizeKeywords(catKw.en || DEFAULT_KEYWORDS.en);
  const frFull = normalizeKeywords(catKw.fr || DEFAULT_KEYWORDS.fr);
  const esFull = normalizeKeywords(catKw.es || DEFAULT_KEYWORDS.es);

  return {
    ar: arFull,
    en: enFull,
    fr: frFull,
    es: esFull,
  };
}

function buildMultilingualDescription(article) {
  const titleAr = article.title || 'مقال';
  const cat = article.category || '';

  const descAr = article.seo_description
    ? article.seo_description
    : `اقرأ مقال "${titleAr}" في دليلك — الموسوعة العربية الشاملة. اكتشف أعمق المعلومات في مجال ${cat}، مع مصادر موثوقة ومحتوى متخصص.`;

  const descEn = `Read "${titleAr}" on Dalilek — the comprehensive Arabic encyclopedia. Explore in-depth, trusted content on ${cat || 'knowledge and culture'}.`;
  const descFr = `Lisez "${titleAr}" sur Dalilek — l'encyclopédie arabe complète. Découvrez des articles approfondis et fiables sur ${cat || 'la culture et les sciences'}.`;
  const descEs = `Lea "${titleAr}" en Dalilek — la enciclopedia árabe integral. Explore contenido confiable y detallado sobre ${cat || 'conocimiento y cultura'}.`;

  return { ar: descAr, en: descEn, fr: descFr, es: descEs };
}

async function updateArticleSeo(article) {
  const kw = buildMultilingualKeywords(article);
  const desc = buildMultilingualDescription(article);

  const update = {
    seo_keywords_multilingual: kw,
    seo_description_multilingual: desc,
  };

  if (!article.seo_description) {
    update.seo_description = desc.ar;
  }

  try {
    await supabaseFetch(
      `articles?id=eq.${article.id}`,
      'PATCH',
      update
    );
    console.log(`Updated SEO for: ${article.slug}`);
  } catch (e) {
    console.error(`Failed for ${article.slug}:`, e.message);
  }
}

async function generateSeoForAllArticles() {
  console.log('Fetching all articles...');
  const articles = await supabaseFetch('articles?select=id,title,slug,category,seo_keywords,seo_description');
  console.log(`Found ${articles.length} articles`);
  for (const article of articles) {
    await updateArticleSeo(article);
  }
  console.log('Done!');
}

module.exports = {
  supabaseFetch,
  buildMultilingualKeywords,
  buildMultilingualDescription,
  generateSeoForAllArticles,
};
