# בוט WhatsApp לרישום להסעות

## לפני הפריסה

הגיליון חייב להיות משותף לקריאה באמצעות הקישור: "כל מי שיש לו קישור — צופה".
הכותרות הנדרשות הן:

- אזור
- יישוב
- שם אחראי
- מספר טלפון

שורות שחסרה בהן אחת מארבע העמודות אינן מוצגות בבוט.

## פריסה

```bash
npm install
npx wrangler login
npm run deploy
```

בפריסה הראשונה Cloudflare אמור ליצור אוטומטית KV בשם הקשור ל-Worker, מפני שבקובץ ההגדרות ה-binding הוגדר ללא id.

הוסף Secrets:

```bash
npx wrangler secret put WHATSAPP_TOKEN
npx wrangler secret put PHONE_NUMBER_ID
```

לאחר שינוי Secret יש לבצע Deploy לפי ההנחיות שמופיעות ב-Wrangler.

## משתנים להשלמה ב-wrangler.jsonc

- VERIFY_TOKEN — טקסט אקראי שתעתיק גם להגדרת ה-Webhook ב-Meta.
- WELCOME_IMAGE_URL — קישור HTTPS ציבורי לתמונת הפתיחה; אפשר להשאיר ריק.
- REGISTRATION_OWNER_PHONE — המספר שאליו תועבר אפשרות 2.
- MORE_DETAILS_MESSAGE — ההודעה של אפשרות 3.
- SHEET_GID — מזהה לשונית הגיליון. עבור הלשונית הראשונה בדרך כלל 0.

## Webhook ב-Meta

כתובת ה-Callback:

```text
https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/webhook
```

Verify token: אותו ערך שהוגדר ב-VERIFY_TOKEN.

יש להירשם לאירוע messages עבור מספר ה-WhatsApp.

## בדיקה

```bash
npm run check
npm run dev
```
