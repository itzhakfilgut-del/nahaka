import { handleMessage } from "./conversation.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return new Response("WhatsApp transport bot is running");
    }

    if (request.method === "GET" && url.pathname === "/webhook") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token === env.VERIFY_TOKEN) {
        return new Response(challenge || "", { status: 200 });
      }
      return new Response("Verification failed", { status: 403 });
    }

    if (request.method === "POST" && url.pathname === "/webhook") {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response("Invalid JSON", { status: 400 });
      }

      const value = body?.entry?.[0]?.changes?.[0]?.value;
      const messages = value?.messages || [];

      for (const message of messages) {
        const phone = message.from;
        const input = extractInput(message);
        if (phone) {
          ctx.waitUntil(
            handleMessage(phone, input, env).catch((error) =>
              console.error("Message handling failed", error)
            )
          );
        }
      }

      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    return new Response("Not found", { status: 404 });
  }
};

function extractInput(message) {
  if (message.type === "text") return message.text?.body || "";
  if (message.type === "interactive") {
    return (
      message.interactive?.button_reply?.id ||
      message.interactive?.list_reply?.id ||
      ""
    );
  }
  return "";
}
