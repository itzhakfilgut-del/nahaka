/**
 * מחזיר את כתובת הבסיס של GREEN-API ללא "/" בסוף.
 */
function getApiBaseUrl(env) {
  const url = String(env.GREEN_API_URL || "").trim();

  if (!url) {
    throw new Error("Missing GREEN_API_URL");
  }

  return url.replace(/\/+$/, "");
}

/**
 * בודק שכל פרטי GREEN-API קיימים.
 */
function validateConfig(env) {
  console.log("ENV:", env);
  console.log("INSTANCE:", env.GREEN_INSTANCE_ID);
  console.log("URL:", env.GREEN_API_URL);
  console.log("TOKEN EXISTS:", !!env.GREEN_API_TOKEN);

  if (!env.GREEN_INSTANCE_ID) {
    throw new Error("Missing GREEN_INSTANCE_ID");
  }

  if (!env.GREEN_API_TOKEN) {
    throw new Error("Missing GREEN_API_TOKEN");
  }
}

/**
 * בונה כתובת API לפעולה מסוימת.
 */
function apiUrl(method, env) {
  validateConfig(env);

  return (
    `${getApiBaseUrl(env)}` +
    `/waInstance${env.GREEN_INSTANCE_ID}` +
    `/${method}` +
    `/${env.GREEN_API_TOKEN}`
  );
}

/**
 * שליחת בקשה ל-GREEN-API.
 */
async function send(method, payload, env) {
  const response = await fetch(apiUrl(method, env), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const responseBody = await response.text();

  if (!response.ok) {
    console.error(
      "GREEN-API error:",
      response.status,
      responseBody
    );

    throw new Error(
      `GREEN-API returned status ${response.status}: ${responseBody}`
    );
  }

  try {
    return JSON.parse(responseBody);
  } catch {
    return responseBody;
  }
}

/**
 * הופך מספר טלפון או מזהה צ'אט למזהה GREEN-API.
 *
 * דוגמאות:
 * 972501234567      -> 972501234567@c.us
 * 972501234567@c.us -> נשאר ללא שינוי
 */
function toChatId(value) {
  const input = String(value || "").trim();

  if (!input) {
    throw new Error("Missing destination chatId");
  }

  // כבר מזהה צ'אט תקין
  if (input.includes("@")) {
    return input;
  }

  let digits = input.replace(/\D/g, "");

  // מספר ישראלי בפורמט 05XXXXXXXX
  if (/^05\d{8}$/.test(digits)) {
    digits = `972${digits.slice(1)}`;
  }

  // מספר ישראלי ללא אפס
  if (/^5\d{8}$/.test(digits)) {
    digits = `972${digits}`;
  }

  if (!digits) {
    throw new Error(`Invalid destination: ${input}`);
  }

  return `${digits}@c.us`;
}

/**
 * שליחת הודעת טקסט.
 */
export function sendText(to, body, env, previewUrl = false) {
  return send(
    "sendMessage",
    {
      chatId: toChatId(to),
      message: String(body || ""),
      linkPreview: Boolean(previewUrl)
    },
    env
  );
}

/**
 * שליחת תמונה באמצעות כתובת אינטרנט.
 */
export function sendImage(to, imageUrl, caption, env) {
  const url = String(imageUrl || "").trim();

  if (!url) {
    throw new Error("Missing image URL");
  }

  return send(
    "sendFileByUrl",
    {
      chatId: toChatId(to),
      urlFile: url,
      fileName: getFileName(url),
      ...(caption ? { caption: String(caption) } : {})
    },
    env
  );
}

/**
 * ב-GREEN-API נשלח תפריט ממוספר כהודעת טקסט.
 */
export function sendMainMenu(to, env) {
  return send(
    "sendInteractiveButtonsReply",
    {
      chatId: toChatId(to),
      header: "צעדת האלפים לעזה",
      body: "שלום וברוכים הבאים 🇮🇱\nמה תרצו לעשות?",
      footer: "בחרו אחת מהאפשרויות",
      buttons: [
        {
          buttonId: "main_register",
          buttonText: "להירשם להסעה"
        },
        {
          buttonId: "main_open",
          buttonText: "לפתוח רישום"
        },
        {
          buttonId: "main_details",
          buttonText: "פרטים נוספים"
        }
      ]
    },
    env
  );
}

/**
 * יוצר שם קובץ תקין לתמונה.
 */
function getFileName(imageUrl) {
  try {
    const parsedUrl = new URL(imageUrl);
    const lastPart = parsedUrl.pathname.split("/").pop() || "";
    const decodedName = decodeURIComponent(lastPart);

    if (/\.[a-zA-Z0-9]{2,5}$/.test(decodedName)) {
      return decodedName;
    }
  } catch {
    // במקרה שהכתובת אינה ניתנת לניתוח, נשתמש בשם ברירת מחדל
  }

  return "welcome.jpg";
}
