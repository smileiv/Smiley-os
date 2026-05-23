```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("origin") || "*";

    // 1. CORS Preflight (Handles ALL routes)
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

    // ==========================================
    // MODULE A: CONCIERGE TICKETING SYSTEM
    // ==========================================
    const kv = env.CONCIERGE_TICKETS;

    // POST /api/ticket (Web or SMS)
    if (request.method === "POST" && url.pathname === "/api/ticket") {
      const data = await request.json();
      const id = Date.now().toString() + Math.random().toString(16).slice(2);
      await kv.put(id, JSON.stringify({ ...data, id, status: "open", date: new Date().toISOString() }));

      return new Response(JSON.stringify({ ok: true, id }), {
        headers: { "Access-Control-Allow-Origin": origin, "Content-Type": "application/json" }
      });
    }

    // GET /api/tickets
    if (request.method === "GET" && url.pathname === "/api/tickets") {
      const list = await kv.list();
      const tickets = [];
      for (const key of list.keys) {
        const item = await kv.get(key.name);
        if (item) tickets.push(JSON.parse(item));
      }
      tickets.sort((a, b) => b.date.localeCompare(a.date)); // Latest first
      return new Response(JSON.stringify(tickets), {
        headers: { "Access-Control-Allow-Origin": origin, "Content-Type": "application/json" }
      });
    }

    // POST /api/sms (Webhook for SMS-in via Verizon/post)
    if (request.method === "POST" && url.pathname === "/api/sms") {
      const sms = await request.json();
      const text = sms.text || sms.Body || sms.message || "No message";
      const phone = sms.from || sms.From || sms.phoneNumber || "Unknown";
      const ticket = { text, phone, fromSms: true };
      const id = Date.now().toString() + Math.random().toString(16).slice(2);
      await kv.put(id, JSON.stringify({ ...ticket, id, status: "open", date: new Date().toISOString() }));

      return new Response("ok", { headers: { "Access-Control-Allow-Origin": origin } });
    }

    // ==========================================
    // MODULE B: SMILEY AI PROXY ROUTER
    // ==========================================
    // Catching the root "/" for the Smiley OS frontend AI calls
    if (request.method === "POST" && url.pathname === "/") {
      try {
        const body = await request.json();
        const modelName = body.modelName;

        if (!modelName) {
          return new Response(JSON.stringify({ error: "modelName is required" }), {
            status: 400,
            headers: { "Access-Control-Allow-Origin": origin, "Content-Type": "application/json" }
          });
        }

        const isCloudflareModel = modelName.startsWith("@cf/");
        let data;

        if (isCloudflareModel) {
          // Workers AI Engine
          data = await env.AI.run(modelName, { messages: body.messages });
        } else {
          // Google Gemini Engine
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${env.GEMINI_API_KEY}`;
          const response = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body.geminiPayload)
          });
          data = await response.json();
        }

        return new Response(JSON.stringify(data), {
          headers: { "Access-Control-Allow-Origin": origin, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { "Access-Control-Allow-Origin": origin, "Content-Type": "application/json" }
        });
      }
    }

    // ==========================================
    // FALLBACK
    // ==========================================
    return new Response("Not found", { 
      status: 404, 
      headers: { "Access-Control-Allow-Origin": origin } 
    });
  }
}

```
