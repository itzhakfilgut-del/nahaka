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

      console.log("GREEN-API webhook:", JSON.stringify(body));

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

  const type = messageData.typeMessage;

  // הודעת טקסט רגילה
  if (type === "textMessage") {
    return messageData.textMessageData?.textMessage || "";
  }

  // הודעת טקסט מורחבת / הודעה עם קישור
  if (type === "extendedTextMessage") {
    return (
      messageData.extendedTextMessageData?.text ||
      messageData.extendedTextMessageData?.description ||
      ""
    );
  }

  // בחירה מתוך רשימה
  if (type === "listMessage") {
    return (
      messageData.listMessageData?.singleSelectReply?.selectedRowId ||
      messageData.listMessageData?.selectedRowId ||
      messageData.listMessageData?.title ||
      ""
    );
  }

  // לחיצה על כפתור
  if (type === "buttonsResponseMessage") {
    return (
      messageData.buttonsResponseMessageData?.selectedButtonId ||
      messageData.buttonsResponseMessageData?.selectedDisplayText ||
      ""
    );
  }

  // פורמטים נוספים של כפתורים
  if (type === "templateButtonReplyMessage") {
    return (
      messageData.templateButtonReplyMessageData?.selectedId ||
      messageData.templateButtonReplyMessageData?.selectedDisplayText ||
      ""
    );
  }

  return "";
}
