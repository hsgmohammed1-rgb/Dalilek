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
  'صحة وطب': {
    ar: 'صحة, طب, علاج, أمراض, تشخيص, أدوية, مستشفى, جراحة, وقاية, صحة عامة, رعاية صحية, طب حديث',
    en: 'health, medicine, treatment, diseases, diagnosis, medications, hospital, surgery, prevention, public health, healthcare, modern medicine',
    fr: 'santé, médecine, traitement, maladies, diagnostic, médicaments, hôpital, chirurgie, prévention, santé publique, soins de santé',
    es: 'salud, medicina, tratamiento, enfermedades, diagnóstico, medicamentos, hospital, cirugía, prevención, salud pública, atención médica',
  },
  'مال وأعمال': {
    ar: 'مال, أعمال, استثمار, اقتصاد, شركات, تمويل, أسواق, تجارة, ريادة أعمال, أرباح, ميزانية, إدارة مالية',
    en: 'finance, business, investment, economy, companies, funding, markets, trade, entrepreneurship, profits, budget, financial management',
    fr: 'finance, affaires, investissement, économie, entreprises, financement, marchés, commerce, entrepreneuriat, profits, budget, gestion financière',
    es: 'finanzas, negocios, inversión, economía, empresas, financiación, mercados, comercio, emprendimiento, ganancias, presupuesto, gestión financiera',
  },
  'تعليم وأكاديميا': {
    ar: 'تعليم, أكاديميا, جامعة, مدرسة, بحث علمي, مناهج, طلاب, دراسات عليا, شهادات, تدريس, تعلم, معرفة',
    en: 'education, academia, university, school, research, curriculum, students, graduate studies, degrees, teaching, learning, knowledge',
    fr: 'éducation, académie, université, école, recherche, programmes, étudiants, études supérieures, diplômes, enseignement, apprentissage, connaissances',
    es: 'educación, academia, universidad, escuela, investigación, planes de estudio, estudiantes, estudios de posgrado, títulos, enseñanza, aprendizaje, conocimiento',
  },
  'تطوير الذات': {
    ar: 'تطوير الذات, تحفيز, مهارات, إنتاجية, نجاح, أهداف, عادات, ثقة, شخصية, تفكير, إيجابية, نمو شخصي',
    en: 'self development, motivation, skills, productivity, success, goals, habits, confidence, personality, thinking, positivity, personal growth',
    fr: 'développement personnel, motivation, compétences, productivité, succès, objectifs, habitudes, confiance, personnalité, réflexion, positivité, croissance personnelle',
    es: 'desarrollo personal, motivación, habilidades, productividad, éxito, metas, hábitos, confianza, personalidad, pensamiento, positividad, crecimiento personal',
  },
  'صحة نفسية': {
    ar: 'صحة نفسية, علم نفس, مشاعر, علاج نفسي, قلق, اكتئاب, سعادة, وعي, استشارة, توازن, راحة, سلام داخلي',
    en: 'mental health, psychology, emotions, therapy, anxiety, depression, happiness, mindfulness, counseling, balance, peace, well-being',
    fr: 'santé mentale, psychologie, émotions, thérapie, anxiété, dépression, bonheur, pleine conscience, counseling, équilibre, paix, bien-être',
    es: 'salud mental, psicología, emociones, terapia, ansiedad, depresión, felicidad, atención plena, consejería, equilibrio, paz, bienestar',
  },
  'ثقافة عامة': {
    ar: 'ثقافة عامة, معلومات, معرفة, علوم إنسانية, مجتمع, تراث, عادات, تقاليد, تنوع, فكر, وعي, إثراء',
    en: 'general culture, information, knowledge, humanities, society, heritage, customs, traditions, diversity, thought, awareness, enrichment',
    fr: 'culture générale, information, connaissances, sciences humaines, société, patrimoine, coutumes, traditions, diversité, pensée, conscience, enrichissement',
    es: 'cultura general, información, conocimiento, humanidades, sociedad, patrimonio, costumbres, tradiciones, diversidad, pensamiento, conciencia, enriquecimiento',
  },
  'سفر وسياحة': {
    ar: 'سفر, سياحة, وجهات, رحلات, فنادق, عطلات, استكشاف, مغامرات, حجز, سفراء, جواز, ثقافات',
    en: 'travel, tourism, destinations, trips, hotels, vacations, exploration, adventures, booking, travel tips, passport, cultures',
    fr: 'voyage, tourisme, destinations, voyages, hôtels, vacances, exploration, aventures, réservation, conseils voyage, passeport, cultures',
    es: 'viajes, turismo, destinos, viajes, hoteles, vacaciones, exploración, aventuras, reservas, consejos de viaje, pasaporte, culturas',
  },
  'أسلوب حياة': {
    ar: 'أسلوب حياة, نمط حياة, روتين, عادات, صحة, سعادة, توازن, تحسين, جودة حياة, يومي, بسيط, عصري',
    en: 'lifestyle, way of life, routine, habits, health, happiness, balance, improvement, quality of life, daily, simple, modern',
    fr: 'mode de vie, routine, habitudes, santé, bonheur, équilibre, amélioration, qualité de vie, quotidien, simple, moderne',
    es: 'estilo de vida, rutina, hábitos, salud, felicidad, equilibrio, mejora, calidad de vida, diario, simple, moderno',
  },
  'استثمار ومال': {
    ar: 'استثمار, مال, أسهم, سندات, محفظة, عائد, مخاطرة, تداول, بورصة, أصول, تنويع, نمو مالي',
    en: 'investment, finance, stocks, bonds, portfolio, returns, risk, trading, stock market, assets, diversification, financial growth',
    fr: 'investissement, finance, actions, obligations, portefeuille, rendements, risque, trading, bourse, actifs, diversification, croissance financière',
    es: 'inversión, finanzas, acciones, bonos, cartera, rendimientos, riesgo, trading, bolsa, activos, diversificación, crecimiento financiero',
  },
  'طاقة شمسية': {
    ar: 'طاقة شمسية, ألواح شمسية, طاقة متجددة, كهرباء, خلايا شمسية, استدامة, بيئة, توليد, توفير, بطاريات, نظافة, مستقبل',
    en: 'solar energy, solar panels, renewable energy, electricity, solar cells, sustainability, environment, generation, savings, batteries, clean energy, future',
    fr: 'énergie solaire, panneaux solaires, énergie renouvelable, électricité, cellules solaires, durabilité, environnement, production, économies, batteries, énergie propre',
    es: 'energía solar, paneles solares, energía renovable, electricidad, celdas solares, sostenibilidad, medio ambiente, generación, ahorro, baterías, energía limpia',
  },
  'تعلم اللغات': {
    ar: 'تعلم اللغات, لغة, إنجليزية, فرنسية, إسبانية, ترجمة, محادثة, قواعد, مفردات, استماع, قراءة, كتابة',
    en: 'language learning, language, English, French, Spanish, translation, conversation, grammar, vocabulary, listening, reading, writing',
    fr: 'apprentissage des langues, langue, anglais, français, espagnol, traduction, conversation, grammaire, vocabulaire, écoute, lecture, écriture',
    es: 'aprendizaje de idiomas, idioma, inglés, francés, español, traducción, conversación, gramática, vocabulario, escucha, lectura, escritura',
  },
  'إنتاجية ووقت': {
    ar: 'إنتاجية, وقت, تنظيم, إدارة وقت, مهام, تركيز, انضباط, أهداف, كفاءة, إنجاز, جدول, أولويات',
    en: 'productivity, time, organization, time management, tasks, focus, discipline, goals, efficiency, achievement, schedule, priorities',
    fr: 'productivité, temps, organisation, gestion du temps, tâches, concentration, discipline, objectifs, efficacité, accomplissement, emploi du temps',
    es: 'productividad, tiempo, organización, gestión del tiempo, tareas, concentración, disciplina, metas, eficiencia, logros, horario, prioridades',
  },
  'بيئة واستدامة': {
    ar: 'بيئة, استدامة, طبيعة, مناخ, تلوث, تدوير, موارد, كوكب, أخضر, محميات, كربون, وعي بيئي',
    en: 'environment, sustainability, nature, climate, pollution, recycling, resources, planet, green, reserves, carbon, environmental awareness',
    fr: 'environnement, durabilité, nature, climat, pollution, recyclage, ressources, planète, verte, réserves, carbone, conscience environnementale',
    es: 'medio ambiente, sostenibilidad, naturaleza, clima, contaminación, reciclaje, recursos, planeta, verde, reservas, carbono, conciencia ambiental',
  },
  'أمن وخصوصية': {
    ar: 'أمن, خصوصية, حماية, تشفير, بيانات, اختراق, أمان, فيروسات, إنترنت, كلمة مرور, قرصنة, سيبراني',
    en: 'security, privacy, protection, encryption, data, hacking, safety, viruses, internet, password, cybersecurity, digital',
    fr: 'sécurité, vie privée, protection, cryptage, données, piratage, sûreté, virus, internet, mot de passe, cybersécurité, numérique',
    es: 'seguridad, privacidad, protección, cifrado, datos, pirateo, seguridad, virus, internet, contraseña, ciberseguridad, digital',
  },
  'طبخ ومطبخ': {
    ar: 'طبخ, مطبخ, وصفات, أطباق, طعام, مكونات, نكهات, مطاعم, خبز, حلويات, مقبلات, مشروبات',
    en: 'cooking, kitchen, recipes, dishes, food, ingredients, flavors, restaurants, baking, desserts, appetizers, beverages',
    fr: 'cuisine, gastronomie, recettes, plats, alimentation, ingrédients, saveurs, restaurants, pâtisserie, desserts, entrées, boissons',
    es: 'cocina, gastronomía, recetas, platos, comida, ingredientes, sabores, restaurantes, repostería, postres, entrantes, bebidas',
  },
  'تاريخ وحضارات': {
    ar: 'تاريخ, حضارات, قديم, حديث, أحداث, شخصيات, تراث, آثار, تطور, حروب, ثورات, إنجازات',
    en: 'history, civilizations, ancient, modern, events, figures, heritage, archaeology, evolution, wars, revolutions, achievements',
    fr: 'histoire, civilisations, ancien, moderne, événements, personnages, patrimoine, archéologie, évolution, guerres, révolutions, réalisations',
    es: 'historia, civilizaciones, antiguo, moderno, eventos, personajes, patrimonio, arqueología, evolución, guerras, revoluciones, logros',
  },
  'لياقة بدنية': {
    ar: 'لياقة بدنية, تمارين, رياضة, كمال أجسام, شد, عضلات, حرق دهون, جري, وزن, صحة, مرونة, تحمل',
    en: 'fitness, exercise, sports, bodybuilding, toning, muscles, fat burning, running, weight, health, flexibility, endurance',
    fr: 'fitness, exercice, sport, musculation, tonification, muscles, brûlage de graisses, course, poids, santé, flexibilité, endurance',
    es: 'fitness, ejercicio, deportes, musculación, tonificación, músculos, quema de grasa, correr, peso, salud, flexibilidad, resistencia',
  },
  'الفضاء والكون': {
    ar: 'الفضاء, الكون, كواكب, نجوم, مجرات, رحلات فضائية, رواد فضاء, ناسا, استكشاف, فلك, أقمار, شمس',
    en: 'space, universe, planets, stars, galaxies, space travel, astronauts, NASA, exploration, astronomy, moons, sun',
    fr: 'espace, univers, planètes, étoiles, galaxies, voyages spatiaux, astronautes, NASA, exploration, astronomie, lunes, soleil',
    es: 'espacio, universo, planetas, estrellas, galaxias, viajes espaciales, astronautas, NASA, exploración, astronomía, lunas, sol',
  },
  'تغذية وغذاء': {
    ar: 'تغذية, غذاء, طعام, فيتامينات, معادن, بروتين, نظام غذائي, حمية, سعرات, صحة, أكل صحي, وجبات',
    en: 'nutrition, food, diet, vitamins, minerals, protein, meal plan, healthy eating, calories, health, superfoods, meals',
    fr: 'nutrition, alimentation, régime, vitamines, minéraux, protéines, plan de repas, alimentation saine, calories, santé, superaliments',
    es: 'nutrición, alimentación, dieta, vitaminas, minerales, proteínas, plan de comidas, alimentación saludable, calorías, salud, superalimentos',
  },
  'سياسة': {
    ar: 'سياسة, حكومة, دبلوماسية, انتخابات, قوانين, برلمان, أحزاب, قرارات, علاقات دولية, إصلاح, قيادة, دولة',
    en: 'politics, government, diplomacy, elections, laws, parliament, parties, decisions, international relations, reform, leadership, state',
    fr: 'politique, gouvernement, diplomatie, élections, lois, parlement, partis, décisions, relations internationales, réforme, leadership, état',
    es: 'política, gobierno, diplomacia, elecciones, leyes, parlamento, partidos, decisiones, relaciones internacionales, reforma, liderazgo, estado',
  },
  'تسويق وإعلان': {
    ar: 'تسويق, إعلان, دعاية, علامة تجارية, إستراتيجية, حملات, إعلانات, تواصل, جمهور, مبيعات, ترويج, سوشيال ميديا',
    en: 'marketing, advertising, promotion, branding, strategy, campaigns, ads, communication, audience, sales, publicity, social media',
    fr: 'marketing, publicité, promotion, image de marque, stratégie, campagnes, annonces, communication, public, ventes, relations publiques',
    es: 'marketing, publicidad, promoción, marca, estrategia, campañas, anuncios, comunicación, audiencia, ventas, relaciones públicas',
  },
  'سينما ومسرح': {
    ar: 'سينما, مسرح, أفلام, تمثيل, مخرج, نقد, مهرجانات, عروض, مسرحيات, إخراج, سيناريو, جمهور',
    en: 'cinema, theater, films, acting, director, criticism, festivals, shows, plays, directing, screenplay, audience',
    fr: 'cinéma, théâtre, films, acting, réalisateur, critique, festivals, spectacles, pièces, mise en scène, scénario, public',
    es: 'cine, teatro, películas, actuación, director, crítica, festivales, espectáculos, obras, dirección, guión, público',
  },
  'ذكاء اصطناعي': {
    ar: 'ذكاء اصطناعي, تعلم آلي, تعلم عميق, روبوتات, خوارزميات, بيانات, أتمتة, مستقبل, تقنية, ابتكار, برمجة, نماذج',
    en: 'artificial intelligence, machine learning, deep learning, robotics, algorithms, data, automation, future, technology, innovation, programming, models',
    fr: 'intelligence artificielle, apprentissage automatique, apprentissage profond, robotique, algorithmes, données, automatisation, futur, technologie',
    es: 'inteligencia artificial, aprendizaje automático, aprendizaje profundo, robótica, algoritmos, datos, automatización, futuro, tecnología',
  },
  'موسيقى وفن': {
    ar: 'موسيقى, فن, غناء, آلات, ألحان, أغاني, فنانين, حفلات, إيقاع, تأليف, توزيع, عزف',
    en: 'music, art, singing, instruments, melodies, songs, artists, concerts, rhythm, composition, arrangement, performance',
    fr: 'musique, art, chant, instruments, mélodies, chansons, artistes, concerts, rythme, composition, arrangement, interprétation',
    es: 'música, arte, canto, instrumentos, melodías, canciones, artistas, conciertos, ritmo, composición, arreglo, interpretación',
  },
  'محيطات وبحار': {
    ar: 'محيطات, بحار, محيط, بحر, ماء, حياة بحرية, أسماك, شعب مرجانية, أعماق, موج, مد وجزر, بيئة بحرية',
    en: 'oceans, seas, ocean, sea, water, marine life, fish, coral reefs, depths, waves, tides, marine environment',
    fr: 'océans, mers, océan, mer, eau, vie marine, poissons, récifs coralliens, profondeurs, vagues, marées, environnement marin',
    es: 'océanos, mares, océano, mar, agua, vida marina, peces, arrecifes de coral, profundidades, olas, mareas, ambiente marino',
  },
  'أحياء وجينات': {
    ar: 'أحياء, جينات, خلايا, DNA, تطور, كائنات, بيولوجيا, وراثة, جينوم, كروموسومات, بروتينات, حمض نووي',
    en: 'biology, genetics, cells, DNA, evolution, organisms, life science, heredity, genome, chromosomes, proteins, nucleic acid',
    fr: 'biologie, génétique, cellules, ADN, évolution, organismes, sciences de la vie, hérédité, génome, chromosomes, protéines, acide nucléique',
    es: 'biología, genética, células, ADN, evolución, organismos, ciencias de la vida, herencia, genoma, cromosomas, proteínas, ácido nucleico',
  },
  'سوشيال ميديا': {
    ar: 'سوشيال ميديا, تواصل اجتماعي, فيسبوك, تويتر, إنستغرام, تيك توك, يوتيوب, منصات, تفاعل, محتوى, متابعون, تسويق',
    en: 'social media, Facebook, Twitter, Instagram, TikTok, YouTube, platforms, engagement, content, followers, marketing, digital',
    fr: 'médias sociaux, Facebook, Twitter, Instagram, TikTok, YouTube, plateformes, engagement, contenu, abonnés, marketing, numérique',
    es: 'redes sociales, Facebook, Twitter, Instagram, TikTok, YouTube, plataformas, interacción, contenido, seguidores, marketing, digital',
  },
  'كتب ومراجعات': {
    ar: 'كتب, مراجعات, قراءة, روايات, أدب, كتب, قراء, مراجعة, ملخصات, مؤلفون, نشر, ثقافة',
    en: 'books, reviews, reading, novels, literature, writing, readers, book review, summaries, authors, publishing, culture',
    fr: 'livres, critiques, lecture, romans, littérature, écriture, lecteurs, critique de livre, résumés, auteurs, édition, culture',
    es: 'libros, reseñas, lectura, novelas, literatura, escritura, lectores, reseña de libros, resúmenes, autores, publicación, cultura',
  },
  'زراعة وغذاء': {
    ar: 'زراعة, غذاء, محاصيل, مزارع, تربة, ري, بذور, حصاد, إنتاج, عضوي, مستدام, أمن غذائي',
    en: 'agriculture, food, crops, farms, soil, irrigation, seeds, harvest, production, organic, sustainable, food security',
    fr: 'agriculture, alimentation, cultures, fermes, sol, irrigation, semences, récolte, production, biologique, durable, sécurité alimentaire',
    es: 'agricultura, alimentos, cultivos, granjas, suelo, riego, semillas, cosecha, producción, orgánico, sostenible, seguridad alimentaria',
  },
  'مجتمع وأسرة': {
    ar: 'مجتمع, أسرة, عائلة, علاقات, زواج, أطفال, تربية, أبوة, أمومة, تواصل, تماسك, قيم',
    en: 'society, family, relationships, marriage, children, parenting, fatherhood, motherhood, communication, cohesion, values',
    fr: 'société, famille, relations, mariage, enfants, éducation parentale, paternité, maternité, communication, cohésion, valeurs',
    es: 'sociedad, familia, relaciones, matrimonio, hijos, crianza, paternidad, maternidad, comunicación, cohesión, valores',
  },
  'ألعاب إلكترونية': {
    ar: 'ألعاب إلكترونية, ألعاب فيديو, جيمنج, بلايستيشن, إكس بوكس, نينتندو, كمبيوتر, ستيم, أونلاين, تحكم, رسومات, منافسة',
    en: 'gaming, video games, PlayStation, Xbox, Nintendo, PC, Steam, online, controllers, graphics, competitive, esports',
    fr: 'jeux vidéo, gaming, PlayStation, Xbox, Nintendo, PC, Steam, en ligne, manettes, graphismes, compétitif, esports',
    es: 'videojuegos, gaming, PlayStation, Xbox, Nintendo, PC, Steam, en línea, controles, gráficos, competitivo, esports',
  },
  'دين وروحانيات': {
    ar: 'دين, روحانيات, إيمان, عقيدة, عبادة, تأمل, صلاة, زكاة, صوم, حج, أخلاق, تسامح',
    en: 'religion, spirituality, faith, belief, worship, meditation, prayer, charity, fasting, pilgrimage, ethics, tolerance',
    fr: 'religion, spiritualité, foi, croyance, culte, méditation, prière, charité, jeûne, pèlerinage, éthique, tolérance',
    es: 'religión, espiritualidad, fe, creencia, culto, meditación, oración, caridad, ayuno, peregrinación, ética, tolerancia',
  },
  'إعلام وصحافة': {
    ar: 'إعلام, صحافة, أخبار, تقارير, تغطية, مراسلين, صحف, مجلات, قنوات, إذاعة, مقال, تحرير',
    en: 'media, journalism, news, reports, coverage, correspondents, newspapers, magazines, channels, radio, article, editing',
    fr: 'médias, journalisme, actualités, reportages, couverture, correspondants, journaux, magazines, chaînes, radio, article, rédaction',
    es: 'medios, periodismo, noticias, reportajes, cobertura, corresponsales, periódicos, revistas, canales, radio, artículo, edición',
  },
  'قانون وحقوق': {
    ar: 'قانون, حقوق, محاماة, قضاء, تشريع, دستور, عدالة, محكمة, عقود, دعوى, استشارات, نظام',
    en: 'law, rights, legal, justice, legislation, constitution, court, contracts, litigation, consulting, system, regulation',
    fr: 'droit, droits, juridique, justice, législation, constitution, tribunal, contrats, litige, consultation, système, réglementation',
    es: 'derecho, derechos, legal, justicia, legislación, constitución, tribunal, contratos, litigio, consultoría, sistema, regulación',
  },
  'فنون وأدب': {
    ar: 'فنون, أدب, شعر, نثر, رواية, قصة, إبداع, كتابة, أديب, فنان, إبداع أدبي, ثقافة',
    en: 'arts, literature, poetry, prose, novel, story, creativity, writing, author, artist, literary creativity, culture',
    fr: 'arts, littérature, poésie, prose, roman, histoire, créativité, écriture, auteur, artiste, création littéraire, culture',
    es: 'artes, literatura, poesía, prosa, novela, cuento, creatividad, escritura, autor, artista, creación literaria, cultura',
  },
  'شركات ناشئة': {
    ar: 'شركات ناشئة, ريادة أعمال, شركات, استثمار, مبتكر, تمويل, نمو, نجاح, تقنية, أفكار, تطوير, مشاريع',
    en: 'startups, entrepreneurship, companies, investment, innovation, funding, growth, success, technology, ideas, development, projects',
    fr: 'startups, entrepreneuriat, entreprises, investissement, innovation, financement, croissance, succès, technologie, idées, développement',
    es: 'startups, emprendimiento, empresas, inversión, innovación, financiación, crecimiento, éxito, tecnología, ideas, desarrollo',
  },
  'اقتصاد كلي': {
    ar: 'اقتصاد كلي, اقتصاد, ناتج محلي, تضخم, بطالة, سياسة نقدية, نمو اقتصادي, أسواق, مالية, مؤشرات, ركود, انتعاش',
    en: 'macroeconomics, economy, GDP, inflation, unemployment, monetary policy, economic growth, markets, finance, indicators, recession, recovery',
    fr: 'macroéconomie, économie, PIB, inflation, chômage, politique monétaire, croissance économique, marchés, finance, indicateurs',
    es: 'macroeconomía, economía, PIB, inflación, desempleo, política monetaria, crecimiento económico, mercados, finanzas, indicadores',
  },
  'تقنية طبية': {
    ar: 'تقنية طبية, أجهزة طبية, طب, تشخيص, علاج, تكنولوجيا طبية, مستشفى, رعاية, صحة, ابتكار, معدات, فحص',
    en: 'medical technology, medical devices, medicine, diagnosis, treatment, health tech, hospital, care, health, innovation, equipment',
    fr: 'technologie médicale, dispositifs médicaux, médecine, diagnostic, traitement, technologies de la santé, hôpital, soins, santé',
    es: 'tecnología médica, dispositivos médicos, medicina, diagnóstico, tratamiento, tecnología sanitaria, hospital, cuidados, salud',
  },
  'برمجة وتطوير': {
    ar: 'برمجة, تطوير, كود, برمجيات, تطبيقات, مواقع, ويب, موبايل, برامج, لغات, جافا, بايثون, جافا سكريبت, سي شارب',
    en: 'programming, development, code, software, applications, websites, web, mobile, programs, languages, Java, Python, JavaScript, C#',
    fr: 'programmation, développement, code, logiciels, applications, sites web, web, mobile, programmes, langages, Java, Python, JavaScript',
    es: 'programación, desarrollo, código, software, aplicaciones, sitios web, web, móvil, programas, lenguajes, Java, Python, JavaScript',
  },
  'أبحاث ودراسات': {
    ar: 'أبحاث, دراسات, بحث, تحليل, نتائج, منهجية, تجارب, استقصاء, استنتاج, إحصاء, بيانات, علمي',
    en: 'research, studies, analysis, results, methodology, experiments, investigation, conclusions, statistics, data, scientific',
    fr: 'recherche, études, analyse, résultats, méthodologie, expériences, enquête, conclusions, statistiques, données, scientifique',
    es: 'investigación, estudios, análisis, resultados, metodología, experimentos, investigación, conclusiones, estadística, datos, científico',
  },
  'تصوير فوتوغرافي': {
    ar: 'تصوير فوتوغرافي, تصوير, كاميرا, صور, فوتوغرافيا, عدسات, إضاءة, تصحيح, فوتوشوب, مناظر, بورتريه, احترافي',
    en: 'photography, camera, photos, lenses, lighting, editing, Photoshop, landscapes, portrait, professional, composition, shutter',
    fr: 'photographie, appareil photo, photos, objectifs, éclairage, retouche, Photoshop, paysages, portrait, professionnel, composition',
    es: 'fotografía, cámara, fotos, lentes, iluminación, edición, Photoshop, paisajes, retrato, profesional, composición, obturador',
  },
};

function slugToEnglish(slug) {
  if (!slug) return '';
  return slug
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function getCategoryTranslation(cat, lang) {
  const CAT_TRANSLATIONS = {
    'تكنولوجيا': { en: 'Technology', fr: 'Technologie', es: 'Tecnología' },
    'صحة': { en: 'Health', fr: 'Santé', es: 'Salud' },
    'صحة وطب': { en: 'Health & Medicine', fr: 'Santé et Médecine', es: 'Salud y Medicina' },
    'رياضة': { en: 'Sports', fr: 'Sport', es: 'Deportes' },
    'ثقافة': { en: 'Culture', fr: 'Culture', es: 'Cultura' },
    'ثقافة عامة': { en: 'General Culture', fr: 'Culture Générale', es: 'Cultura General' },
    'أعمال': { en: 'Business', fr: 'Affaires', es: 'Negocios' },
    'مال وأعمال': { en: 'Finance & Business', fr: 'Finance et Affaires', es: 'Finanzas y Negocios' },
    'علوم': { en: 'Science', fr: 'Sciences', es: 'Ciencias' },
    'علوم وطبيعة': { en: 'Science & Nature', fr: 'Sciences et Nature', es: 'Ciencias y Naturaleza' },
    'تعليم': { en: 'Education', fr: 'Éducation', es: 'Educación' },
    'تعليم وأكاديميا': { en: 'Education & Academia', fr: 'Éducation et Académie', es: 'Educación y Academia' },
    'فنون': { en: 'Arts', fr: 'Arts', es: 'Artes' },
    'بيئة': { en: 'Environment', fr: 'Environnement', es: 'Medio Ambiente' },
    'بيئة واستدامة': { en: 'Environment & Sustainability', fr: 'Environnement et Durabilité', es: 'Medio Ambiente y Sostenibilidad' },
    'علم نفس وتطوير ذات': { en: 'Psychology & Self Development', fr: 'Psychologie et Développement Personnel', es: 'Psicología y Desarrollo Personal' },
    'تطوير الذات': { en: 'Self Development', fr: 'Développement Personnel', es: 'Desarrollo Personal' },
    'صحة نفسية': { en: 'Mental Health', fr: 'Santé Mentale', es: 'Salud Mental' },
    'سفر وسياحة': { en: 'Travel & Tourism', fr: 'Voyage et Tourisme', es: 'Viajes y Turismo' },
    'أسلوب حياة': { en: 'Lifestyle', fr: 'Mode de Vie', es: 'Estilo de Vida' },
    'استثمار ومال': { en: 'Investment & Finance', fr: 'Investissement et Finance', es: 'Inversión y Finanzas' },
    'طاقة شمسية': { en: 'Solar Energy', fr: 'Énergie Solaire', es: 'Energía Solar' },
    'تعلم اللغات': { en: 'Language Learning', fr: 'Apprentissage des Langues', es: 'Aprendizaje de Idiomas' },
    'إنتاجية ووقت': { en: 'Productivity & Time', fr: 'Productivité et Temps', es: 'Productividad y Tiempo' },
    'أمن وخصوصية': { en: 'Security & Privacy', fr: 'Sécurité et Vie Privée', es: 'Seguridad y Privacidad' },
    'طبخ ومطبخ': { en: 'Cooking & Kitchen', fr: 'Cuisine et Gastronomie', es: 'Cocina y Gastronomía' },
    'تاريخ وحضارات': { en: 'History & Civilizations', fr: 'Histoire et Civilisations', es: 'Historia y Civilizaciones' },
    'لياقة بدنية': { en: 'Fitness', fr: 'Fitness', es: 'Fitness' },
    'سياسة': { en: 'Politics', fr: 'Politique', es: 'Política' },
    'الفضاء والكون': { en: 'Space & Universe', fr: 'Espace et Univers', es: 'Espacio y Universo' },
    'تغذية وغذاء': { en: 'Nutrition & Food', fr: 'Nutrition et Alimentation', es: 'Nutrición y Alimentación' },
    'تسويق وإعلان': { en: 'Marketing & Advertising', fr: 'Marketing et Publicité', es: 'Marketing y Publicidad' },
    'سينما ومسرح': { en: 'Cinema & Theater', fr: 'Cinéma et Théâtre', es: 'Cine y Teatro' },
    'ذكاء اصطناعي': { en: 'Artificial Intelligence', fr: 'Intelligence Artificielle', es: 'Inteligencia Artificial' },
    'موسيقى وفن': { en: 'Music & Art', fr: 'Musique et Art', es: 'Música y Arte' },
    'محيطات وبحار': { en: 'Oceans & Seas', fr: 'Océans et Mers', es: 'Océanos y Mares' },
    'أحياء وجينات': { en: 'Biology & Genetics', fr: 'Biologie et Génétique', es: 'Biología y Genética' },
    'سوشيال ميديا': { en: 'Social Media', fr: 'Médias Sociaux', es: 'Redes Sociales' },
    'كتب ومراجعات': { en: 'Books & Reviews', fr: 'Livres et Critiques', es: 'Libros y Reseñas' },
    'زراعة وغذاء': { en: 'Agriculture & Food', fr: 'Agriculture et Alimentation', es: 'Agricultura y Alimentación' },
    'مجتمع وأسرة': { en: 'Society & Family', fr: 'Société et Famille', es: 'Sociedad y Familia' },
    'ألعاب إلكترونية': { en: 'Gaming', fr: 'Jeux Vidéo', es: 'Videojuegos' },
    'دين وروحانيات': { en: 'Religion & Spirituality', fr: 'Religion et Spiritualité', es: 'Religión y Espiritualidad' },
    'إعلام وصحافة': { en: 'Media & Journalism', fr: 'Médias et Journalisme', es: 'Medios y Periodismo' },
    'قانون وحقوق': { en: 'Law & Rights', fr: 'Droit et Droits', es: 'Derecho y Derechos' },
    'فنون وأدب': { en: 'Arts & Literature', fr: 'Arts et Littérature', es: 'Artes y Literatura' },
    'شركات ناشئة': { en: 'Startups', fr: 'Startups', es: 'Startups' },
    'اقتصاد كلي': { en: 'Macroeconomics', fr: 'Macroéconomie', es: 'Macroeconomía' },
    'تقنية طبية': { en: 'Medical Technology', fr: 'Technologie Médicale', es: 'Tecnología Médica' },
    'برمجة وتطوير': { en: 'Programming & Development', fr: 'Programmation et Développement', es: 'Programación y Desarrollo' },
    'أبحاث ودراسات': { en: 'Research & Studies', fr: 'Recherche et Études', es: 'Investigación y Estudios' },
    'تصوير فوتوغرافي': { en: 'Photography', fr: 'Photographie', es: 'Fotografía' },
  };
  const entry = CAT_TRANSLATIONS[cat];
  return entry ? (entry[lang] || cat) : cat;
}

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

function generateSlugKeywords(slug) {
  if (!slug) return '';
  return slug
    .replace(/[-_]/g, ', ')
    .replace(/\b\w/g, c => c.toLowerCase());
}

function buildMultilingualKeywords(article) {
  // Prefer AI-generated multilingual keywords stored in DB
  const stored = article.seo_keywords_multilingual;
  if (stored && typeof stored === 'object') {
    const hasRealContent = Object.values(stored).some(v => v && v.length > 10);
    if (hasRealContent) {
      // Enrich each language with category keywords if the stored value is short
      const catKw = CATEGORY_KEYWORDS[article.category] || DEFAULT_KEYWORDS;
      const enrich = (lang, base) => {
        const baseKws = (base || '').split(',').map(k => k.trim()).filter(Boolean);
        const catKws = (catKw[lang] || '').split(',').map(k => k.trim()).filter(Boolean);
        // Deduplicate: article keywords first, then fill from category up to 18 total
        const merged = [...baseKws];
        for (const kw of catKws) {
          if (merged.length >= 18) break;
          if (!merged.some(existing => existing.toLowerCase() === kw.toLowerCase())) merged.push(kw);
        }
        return normalizeKeywords(merged.join(', '));
      };
      return {
        ar: enrich('ar', stored.ar),
        en: enrich('en', stored.en),
        fr: enrich('fr', stored.fr),
        es: enrich('es', stored.es),
      };
    }
  }

  // Fallback: generate from category defaults + slug
  const catKw = CATEGORY_KEYWORDS[article.category] || DEFAULT_KEYWORDS;
  const slugKw = generateSlugKeywords(article.slug);

  const baseKw = article.seo_keywords
    ? article.seo_keywords.replace(/[،,؛]+/g, ',').split(',').map(k => k.trim()).filter(Boolean)
    : [];

  const arBase = baseKw.filter(k => /[\u0600-\u06FF]/.test(k)).join(', ');

  const arFull = normalizeKeywords([arBase, catKw.ar || DEFAULT_KEYWORDS.ar].filter(Boolean).join(', '));
  const enFull = normalizeKeywords([slugKw, catKw.en || DEFAULT_KEYWORDS.en].filter(Boolean).join(', '));
  const frFull = normalizeKeywords([slugKw, catKw.fr || DEFAULT_KEYWORDS.fr].filter(Boolean).join(', '));
  const esFull = normalizeKeywords([slugKw, catKw.es || DEFAULT_KEYWORDS.es].filter(Boolean).join(', '));

  return {
    ar: arFull,
    en: enFull,
    fr: frFull,
    es: esFull,
  };
}

function buildMultilingualDescription(article) {
  // Prefer AI-generated multilingual descriptions stored in DB
  const stored = article.seo_description_multilingual;
  if (stored && typeof stored === 'object') {
    const hasRealContent = Object.values(stored).some(v => v && v.length > 30);
    if (hasRealContent) {
      const titleAr = article.title || 'مقال';
      const cat = article.category || '';
      const englishTitle = slugToEnglish(article.slug) || titleAr;
      const catEn = getCategoryTranslation(cat, 'en');
      const catFr = getCategoryTranslation(cat, 'fr');
      const catEs = getCategoryTranslation(cat, 'es');
      // Use stored description if it exists and is non-trivial, else generate
      return {
        ar: stored.ar && stored.ar.length > 30 ? stored.ar : (article.seo_description || `اقرأ مقال "${titleAr}" في دليلك — الموسوعة العربية الشاملة. اكتشف أعمق المعلومات في مجال ${cat}، مع مصادر موثوقة ومحتوى متخصص.`),
        en: stored.en && stored.en.length > 30 ? stored.en : `Learn about ${englishTitle} on Dalilek — the comprehensive Arabic encyclopedia. Explore in-depth ${catEn} articles, trusted information, and expert insights.`,
        fr: stored.fr && stored.fr.length > 30 ? stored.fr : `Découvrez ${englishTitle} sur Dalilek — l'encyclopédie arabe complète. Explorez des articles approfondis sur ${catFr}, des informations fiables et des analyses d'experts.`,
        es: stored.es && stored.es.length > 30 ? stored.es : `Conozca ${englishTitle} en Dalilek — la enciclopedia árabe integral. Explore artículos detallados sobre ${catEs}, información confiable y perspectivas de expertos.`,
      };
    }
  }

  // Fallback: generate from title + category
  const titleAr = article.title || 'مقال';
  const cat = article.category || '';
  const englishTitle = slugToEnglish(article.slug) || titleAr;

  const catEn = getCategoryTranslation(cat, 'en');
  const catFr = getCategoryTranslation(cat, 'fr');
  const catEs = getCategoryTranslation(cat, 'es');

  const descAr = article.seo_description
    ? article.seo_description
    : `اقرأ مقال "${titleAr}" في دليلك — الموسوعة العربية الشاملة. اكتشف أعمق المعلومات في مجال ${cat}، مع مصادر موثوقة ومحتوى متخصص.`;

  const descEn = `Learn about ${englishTitle} on Dalilek — the comprehensive Arabic encyclopedia. Explore in-depth ${catEn} articles, trusted information, and expert insights.`;
  const descFr = `Découvrez ${englishTitle} sur Dalilek — l'encyclopédie arabe complète. Explorez des articles approfondis sur ${catFr}, des informations fiables et des analyses d'experts.`;
  const descEs = `Conozca ${englishTitle} en Dalilek — la enciclopedia árabe integral. Explore artículos detallados sobre ${catEs}, información confiable y perspectivas de expertos.`;

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
