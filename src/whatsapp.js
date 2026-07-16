function apiUrl(env) {
  const version = env.GRAPH_API_VERSION || "v23.0";
  return `https://graph.facebook.com/${version}/${env.PHONE_NUMBER_ID}/messages`;
}

async function send(payload, env) {
  const response = await fetch(apiUrl(env), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload })
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("WhatsApp API error", response.status, body);
    throw new Error(`WhatsApp API returned ${response.status}`);
  }

  return response.json();
}

export function sendText(to, body, env, previewUrl = false) {
  return send(
    {
      to,
      type: "text",
      text: { body, preview_url: previewUrl }
    },
    env
  );
}

export function sendImage(to, imageUrl, caption, env) {
  return send(
    {
      to,
      type: "image",
      image: { link: imageUrl, ...(caption ? { caption } : {}) }
    },
    env
  );
}

export function sendMainMenu(to, env) {
  return send(
    {
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: "שלום וברוכים הבאים 🚍\nמה תרצו לעשות?" },
        action: {
          buttons: [
            {
              type: "reply",
              reply: { id: "main_register", title: "להירשם להסעה" }
            },
            {
              type: "reply",
              reply: { id: "main_open", title: "לפתוח רישום" }
            },
            {
              type: "reply",
              reply: { id: "main_details", title: "פרטים נוספים" }
            }
          ]
        }
      }
    },
    env
  );
}
