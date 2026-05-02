const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-rotation-secret"
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json"
    }
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const expectedSecret = (Deno.env.get("TOKEN_ROTATION_SECRET") ?? "").trim();
  const providedSecret = (request.headers.get("x-rotation-secret") ?? "").trim();

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const appId = (Deno.env.get("META_APP_ID") ?? "").trim();
  const appSecret = (Deno.env.get("META_APP_SECRET") ?? "").trim();
  const currentToken = (Deno.env.get("INSTAGRAM_ACCESS_TOKEN") ?? "").trim();

  if (!appId || !appSecret || !currentToken) {
    return jsonResponse(
      {
        error: "Missing META_APP_ID, META_APP_SECRET, or INSTAGRAM_ACCESS_TOKEN in function secrets."
      },
      500
    );
  }

  const url = new URL("https://graph.facebook.com/v18.0/oauth/access_token");
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", currentToken);

  const response = await fetch(url.toString(), { method: "GET" });
  const payload = (await response.json()) as {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
    error?: { message?: string; code?: number; error_subcode?: number };
  };

  if (!response.ok || !payload.access_token) {
    return jsonResponse(
      {
        error: payload.error?.message ?? "Token refresh failed.",
        code: payload.error?.code ?? null,
        error_subcode: payload.error?.error_subcode ?? null
      },
      400
    );
  }

  return jsonResponse({
    access_token: payload.access_token,
    token_type: payload.token_type ?? "bearer",
    expires_in: payload.expires_in ?? null
  });
});
