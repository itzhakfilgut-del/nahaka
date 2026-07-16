const CACHE_TTL_SECONDS = 300;

export async function getRows(env) {
  const cache = caches.default;
  const cacheKey = new Request(
    `https://sheet-cache.internal/${encodeURIComponent(env.SHEET_ID)}/${encodeURIComponent(env.SHEET_GID || "0")}`
  );

  const cached = await cache.match(cacheKey);
  if (cached) return cached.json();

  const url = new URL(
    `https://docs.google.com/spreadsheets/d/${env.SHEET_ID}/gviz/tq`
  );
  url.searchParams.set("tqx", "out:csv");
  url.searchParams.set("gid", env.SHEET_GID || "0");

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": "Cloudflare-Worker" }
  });

  if (!response.ok) {
    throw new Error(`Google Sheets returned ${response.status}`);
  }

  const csv = await response.text();
  const records = normalizeRows(parseCsv(csv));

  const cacheResponse = new Response(JSON.stringify(records), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`
    }
  });
  await cache.put(cacheKey, cacheResponse.clone());

  return records;
}

export async function getAreas(env) {
  const rows = await getRows(env);
  return uniqueSorted(rows.map((row) => row.area));
}

export async function getCities(env, area) {
  const rows = await getRows(env);
  return uniqueSorted(
    rows.filter((row) => row.area === area).map((row) => row.city)
  );
}

export async function getCoordinator(env, area, city) {
  const rows = await getRows(env);
  return rows.find((row) => row.area === area && row.city === city) || null;
}

function normalizeRows(table) {
  if (!table.length) return [];

  const headers = table[0].map(normalizeHeader);
  const areaIndex = findHeader(headers, ["אזור"]);
  const cityIndex = findHeader(headers, ["יישוב", "ישוב", "עיר"]);
  const nameIndex = findHeader(headers, ["שם אחראי", "אחראי"]);
  const phoneIndex = findHeader(headers, ["מספר טלפון", "טלפון"]);

  if ([areaIndex, cityIndex, nameIndex, phoneIndex].some((x) => x === -1)) {
    throw new Error(
      "Missing required headers. Expected: אזור, יישוב, שם אחראי, מספר טלפון"
    );
  }

  return table
    .slice(1)
    .map((row) => ({
      area: clean(row[areaIndex]),
      city: clean(row[cityIndex]),
      name: clean(row[nameIndex]),
      phone: normalizePhone(row[phoneIndex])
    }))
    .filter((row) => row.area && row.city && row.name && row.phone);
}

function findHeader(headers, options) {
  return headers.findIndex((header) =>
    options.some((option) => header === normalizeHeader(option))
  );
}

function normalizeHeader(value) {
  return clean(value).replace(/\s+/g, " ");
}

function clean(value) {
  return String(value ?? "").replace(/^\uFEFF/, "").trim();
}

function normalizePhone(value) {
  let phone = clean(value).replace(/[^\d+]/g, "");
  if (!phone) return "";

  // מספרים שנשמרו בשיטס בלי 0 בתחילת המספר.
  if (/^5\d{8}$/.test(phone)) phone = `0${phone}`;

  // 972XXXXXXXXX -> 0XXXXXXXXX לצורך הצגה וקישור wa.me.
  if (/^9725\d{8}$/.test(phone)) phone = `0${phone.slice(3)}`;
  if (/^\+9725\d{8}$/.test(phone)) phone = `0${phone.slice(4)}`;

  return phone;
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "he")
  );
}

// מפענח CSV תקין, כולל פסיקים ומרכאות בתוך תאים.
function parseCsv(csv) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    const next = csv[i + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}
