export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const kv = env.CONCIERGE_TICKETS; // Bind this in wrangler.toml/jsonc
    const origin = request.headers.get("origin") || "*";

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        }
      });
    }

    // POST /api/ticket  (Web or SMS)
    if (request.method === "POST" && url.pathname === "/api/ticket") {
      const data = await request.json();
      // Example {text, phone, fileUrl, fromSms}
      const id = Date.now().toString() + Math.random().toString(16).slice(2);
      await kv.put(id, JSON.stringify({ ...data, id, status: "open", date: new Date().toISOString() }));

      // TODO: Add call to sendNotification (email, push, sms)
      return new Response(JSON.stringify({ ok: true, id }), {
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Content-Type": "application/json"
        }
      });
    }

    // GET /api/tickets
    if (request.method === "GET" && url.pathname === "/api/tickets") {
      const list = await kv.list();
      const tickets = [];
      for (const key of list.keys)
        tickets.push(JSON.parse(await kv.get(key.name)));
      tickets.sort((a, b) => b.date.localeCompare(a.date)); // Latest first
      return new Response(JSON.stringify(tickets), {
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Content-Type": "application/json"
        }
      });
    }

    // POST /api/sms (webhook for SMS-in via Verizon/post)
    if (request.method === "POST" && url.pathname === "/api/sms") {
      // Body parsing (adjust key based on Verizon payload)
      const sms = await request.json();
      const text = sms.text || sms.Body || sms.message || "No message";
      const phone = sms.from || sms.From || sms.phoneNumber || "Unknown";
      const ticket = { text, phone, fromSms: true };
      const id = Date.now().toString() + Math.random().toString(16).slice(2);
      await kv.put(id, JSON.stringify({ ...ticket, id, status: "open", date: new Date().toISOString() }));

      // TODO: Add call to sendNotification
      return new Response("ok", { headers: { "Access-Control-Allow-Origin": origin } });
    }

    // 404 fallback
    return new Response("Not found", { status: 404, headers: { "Access-Control-Allow-Origin": origin } });
  }
}
