const { google } = require('googleapis');
const fs = require('fs');

// ضع مسار ملف المفتاح الخاص بك هنا
// احصل عليه من Google Cloud Platform -> Service Accounts
const KEY_FILE = './service-account.json';

// تأكد من تثبيت المكتبة عبر تشغيل:
// npm install googleapis

if (!fs.existsSync(KEY_FILE)) {
  console.error("خطأ: يرجى وضع ملف 'service-account.json' في نفس المجلد.");
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_FILE,
  scopes: ['https://www.googleapis.com/auth/indexing'],
});

async function indexUrls(urls) {
  const authClient = await auth.getClient();
  const indexing = google.indexing({
    version: 'v3',
    auth: authClient,
  });

  console.log(`بدء طلب فهرسة لـ ${urls.length} رابط...`);
  
  for (const url of urls) {
    try {
      const response = await indexing.urlNotifications.publish({
        requestBody: {
          url: url,
          type: 'URL_UPDATED', // استخدم URL_DELETED لحذف رابط
        },
      });
      console.log(`✅ تم الإرسال بنجاح: ${url}`);
    } catch (error) {
      console.error(`❌ خطأ في إرسال ${url}:`, error.message);
    }
    
    // الانتظار ثانية واحدة لتجنب حظر جوجل للطلبات السريعة جدًا
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// ----------------------------------------------------
// طريقة الاستخدام: ضع الروابط التي تريد فهرستها هنا
// ----------------------------------------------------
const urlsToIndex = [
  "https://dalilek.online/articles/quick-easy-lunch-recipes",
  "https://dalilek.online/articles/ai-for-profit-online",
  // يمكنك إضافة المزيد من الروابط هنا...
];

indexUrls(urlsToIndex).then(() => {
  console.log('انتهت العملية!');
});
