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
    // MODULE A: SMILEY AI PROXY ROUTER
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
