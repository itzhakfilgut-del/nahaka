import { handleMessage } from "./conversation.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // בדיקה שה-Worker פעיל
    if (request.method === "GET" && url.pathname === "/") {
      return new Response("GREEN-API WhatsApp bot is running", {
        status: 200
      });
    }

    // Webhook של GREEN-API
    if (request.method === "POST" && url.pathname === "/green-webhook") {
      let body;

      try {
        body = await request.json();
      } catch (error) {
        console.error("Invalid webhook JSON", error);
        return new Response("Invalid JSON", { status: 400 });
      }
      
      console.log(JSON.stringify(body));
      console.log(JSON.stringify(body.messageData, null, 2));
      // מטפלים רק בהודעות נכנסות
      if (body?.typeWebhook !== "incomingMessageReceived") {
        return new Response("OK", { status: 200 });
      }

      const chatId =
        body?.senderData?.chatId ||
        body?.senderData?.sender;

      const input = extractInput(body?.messageData);

      if (!chatId) {
        console.error("Webhook received without chatId");
        return new Response("OK", { status: 200 });
      }

      ctx.waitUntil(
        handleMessage(chatId, input, env).catch((error) => {
          console.error("Message handling failed", error);
        })
      );

      return new Response("OK", { status: 200 });
    }

    return new Response("Not found", { status: 404 });
  }
};

/**
 * חילוץ הטקסט מתוך הודעת GREEN-API.
 */
function extractInput(messageData) {
  if (!messageData) return "";

  const text =
    messageData?.textMessageData?.textMessage ||
    messageData?.extendedTextMessageData?.text ||

    // המבנה שבפועל GREEN-API שולחת אצלך
    messageData?.selectedId ||
    messageData?.selectedButtonId ||
    messageData?.selectedDisplayText ||

    // מבנים חלופיים
    messageData?.interactiveButtonsResponse?.selectedId ||
    messageData?.interactiveButtonsResponse?.selectedDisplayText ||
    messageData?.templateButtonReplyMessage?.selectedId ||
    messageData?.templateButtonReplyMessage?.selectedDisplayText ||
    messageData?.buttonsResponseMessage?.selectedButtonId ||
    messageData?.buttonsResponseMessage?.selectedDisplayText ||
    "";

  const value = String(text).trim();

  if (value === "main_register" || value === "להירשם להסעה") return "1";
  if (value === "main_open" || value === "לפתוח רישום") return "2";
  if (value === "main_details" || value === "פרטים נוספים") return "3";

  return value;
}
