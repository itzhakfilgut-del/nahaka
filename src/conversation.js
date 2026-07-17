import { clearSession, getSession, saveSession } from "./storage.js";
import { getAreas, getCities, getCoordinator } from "./sheets.js";
import { sendImage, sendMainMenu, sendText } from "./whatsapp.js";

const PAGE_SIZE = 9;

export async function handleMessage(phone, input, env) {
  const value = String(input || "").trim();

  if (isRestart(value)) {
    await clearSession(phone, env);
    await showWelcome(phone, env);
    return;
  }

  const session = await getSession(phone, env);

  if (!session) {
    await showWelcome(phone, env);
    return;
  }

  if (
    value === "main_register" ||
    (session.step === "MAIN_MENU" && value === "1")
  ) {
    await showAreas(phone, 0, env);
    return;
  }

  if (
    value === "main_open" ||
    (session.step === "MAIN_MENU" && value === "2")
  ) {
    await sendText(
      phone,
      [
        "🚌 פתיחת הסעה חדשה",
        "",
        "אנא השיבו בהודעה אחת עם:",
        "• שם פרטי",
        "• שם משפחה",
        "• יישוב",
        "",
        "לדוגמה:",
        "ישראל ישראלי, אשקלון"
      ].join("\n"),
      env
    );

    await saveSession(
      phone,
      { step: "WAITING_NEW_RIDE_DETAILS" },
      env
    );

    return;
  }

  if (
    value === "main_details" ||
    (session.step === "MAIN_MENU" && value === "3")
  ) {
    await sendText(
      phone,
      env.MORE_DETAILS_MESSAGE || "פרטים נוספים יפורסמו כאן בקרוב.",
      env
    );

    await sendText(
      phone,
      'לחזרה לתפריט כתבו "התחל".',
      env
    );

    await saveSession(
      phone,
      { step: "MAIN_MENU" },
      env
    );

    return;
  }

  if (session.step === "WAITING_NEW_RIDE_DETAILS") {
    if (value.length < 5) {
      await sendText(
        phone,
        [
          "לא הצלחתי לזהות את כל הפרטים.",
          "",
          "אנא שלחו בהודעה אחת:",
          "שם פרטי, שם משפחה ויישוב.",
          "",
          "לדוגמה:",
          "ישראל ישראלי, אשקלון"
        ].join("\n"),
        env
      );

      return;
    }

    await sendText(
      phone,
      [
        "✅ תודה!",
        "",
        "קיבלנו את הפרטים.",
        "נציג יחזור אליכם בקרוב.",
        "",
        'לחזרה לתפריט כתבו "התחל".'
      ].join("\n"),
      env
    );

    await saveSession(
      phone,
      { step: "MAIN_MENU" },
      env
    );

    return;
  }

  if (session.step === "CHOOSING_AREA") {
    await handleAreaChoice(phone, value, session, env);
    return;
  }

  if (session.step === "CHOOSING_CITY") {
    await handleCityChoice(phone, value, session, env);
    return;
  }

  await sendText(
    phone,
    'לא זיהיתי את הבחירה. כתבו "התחל" כדי לחזור לתפריט.',
    env
  );
}

async function showWelcome(phone, env) {
  if (env.WELCOME_IMAGE_URL) {
    await sendImage(
      phone,
      env.WELCOME_IMAGE_URL,
      "ברוכים הבאים",
      env
    );
  }

  await sendMainMenu(phone, env);

  await saveSession(
    phone,
    { step: "MAIN_MENU" },
    env
  );
}

async function showAreas(phone, page, env) {
  const areas = await getAreas(env);

  if (!areas.length) {
    await sendText(
      phone,
      "לא נמצאו אזורים בגיליון. נסו שוב מאוחר יותר.",
      env
    );

    return;
  }

  const safePage = clampPage(page, areas.length);

  await sendNumberedPage(
    phone,
    "בחרו אזור:",
    areas,
    safePage,
    env
  );

  await saveSession(
    phone,
    {
      step: "CHOOSING_AREA",
      page: safePage,
      options: pageItems(areas, safePage)
    },
    env
  );
}

async function handleAreaChoice(phone, value, session, env) {
  if (value === "0") {
    await showWelcome(phone, env);
    return;
  }

  if (value === "10") {
    await showAreas(phone, session.page + 1, env);
    return;
  }

  if (value === "11") {
    await showAreas(phone, session.page - 1, env);
    return;
  }

  const area = chooseOption(value, session.options);

  if (!area) {
    await sendText(
      phone,
      "יש לבחור מספר שמופיע ברשימה.",
      env
    );

    return;
  }

  const cities = await getCities(env, area);

  if (!cities.length) {
    await sendText(
      phone,
      "לא נמצאו יישובים באזור הזה.",
      env
    );

    await showAreas(phone, 0, env);
    return;
  }

  await showCities(phone, area, cities, 0, env);
}

async function showCities(phone, area, cities, page, env) {
  const safePage = clampPage(page, cities.length);

  await sendNumberedPage(
    phone,
    `בחרו יישוב באזור ${area}:`,
    cities,
    safePage,
    env
  );

  await saveSession(
    phone,
    {
      step: "CHOOSING_CITY",
      area,
      page: safePage,
      options: pageItems(cities, safePage)
    },
    env
  );
}

async function handleCityChoice(phone, value, session, env) {
  if (value === "0") {
    await showAreas(phone, 0, env);
    return;
  }

  const cities = await getCities(env, session.area);

  if (value === "10") {
    await showCities(
      phone,
      session.area,
      cities,
      session.page + 1,
      env
    );

    return;
  }

  if (value === "11") {
    await showCities(
      phone,
      session.area,
      cities,
      session.page - 1,
      env
    );

    return;
  }

  const city = chooseOption(value, session.options);

  if (!city) {
    await sendText(
      phone,
      "יש לבחור מספר שמופיע ברשימה.",
      env
    );

    return;
  }

  const coordinator = await getCoordinator(
    env,
    session.area,
    city
  );

  if (!coordinator) {
    await sendText(
      phone,
      "לא נמצאו פרטי אחראי ליישוב הזה.",
      env
    );

    return;
  }

  const phoneForLink = toInternationalDigits(
    coordinator.phone
  );

  const messageText = encodeURIComponent(
    `שלום, אני רוצה להירשם להסעה מהיישוב ${city}.`
  );

  const link = phoneForLink
    ? `https://wa.me/${phoneForLink}?text=${messageText}`
    : "";

  const message = [
    `האחראי להסעה ביישוב ${city}:`,
    "",
    `👤 ${coordinator.name}`,
    `📞 ${formatPhone(coordinator.phone)}`,
    link ? `💬 ${link}` : "",
    "",
    'לחזרה לתפריט כתבו "התחל".'
  ]
    .filter(Boolean)
    .join("\n");

  await sendText(
    phone,
    message,
    env,
    true
  );

  await saveSession(
    phone,
    { step: "MAIN_MENU" },
    env
  );
}

async function sendNumberedPage(
  phone,
  title,
  allItems,
  page,
  env
) {
  const items = pageItems(allItems, page);
  const totalPages = Math.ceil(
    allItems.length / PAGE_SIZE
  );

  const lines = items.map(
    (item, index) => `${index + 1}. ${item}`
  );

  if (page < totalPages - 1) {
    lines.push("10. לעמוד הבא");
  }

  if (page > 0) {
    lines.push("11. לעמוד הקודם");
  }

  lines.push("0. חזרה");

  await sendText(
    phone,
    [
      title,
      "",
      lines.join("\n"),
      "",
      `עמוד ${page + 1} מתוך ${totalPages}`
    ].join("\n"),
    env
  );
}

function pageItems(items, page) {
  const start = page * PAGE_SIZE;
  return items.slice(start, start + PAGE_SIZE);
}

function clampPage(page, itemCount) {
  const max = Math.max(
    0,
    Math.ceil(itemCount / PAGE_SIZE) - 1
  );

  return Math.min(
    Math.max(Number(page) || 0, 0),
    max
  );
}

function chooseOption(value, options = []) {
  const index = Number(value) - 1;

  return Number.isInteger(index) && index >= 0
    ? options[index] || null
    : null;
}

function isRestart(value) {
  return [
    "התחל",
    "התחלה",
    "תפריט",
    "menu",
    "start"
  ].includes(value.toLowerCase());
}

function toInternationalDigits(phone) {
  let digits = String(phone || "")
    .replace(/\D/g, "");

  if (/^05\d{8}$/.test(digits)) {
    digits = `972${digits.slice(1)}`;
  }

  if (/^5\d{8}$/.test(digits)) {
    digits = `972${digits}`;
  }

  return /^9725\d{8}$/.test(digits)
    ? digits
    : "";
}

function formatPhone(phone) {
  const digits = String(phone || "")
    .replace(/\D/g, "");

  if (/^05\d{8}$/.test(digits)) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return phone;
}
