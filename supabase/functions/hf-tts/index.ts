const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
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

function toBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, Math.min(index + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function synthesizeSpeech(
  text: string,
  token: string
): Promise<{ audioDataUrl: string; contentType: string }> {
  const modelCandidates = [
    Deno.env.get("HF_TTS_MODEL"),
    "facebook/mms-tts-spa",
    "facebook/mms-tts-spa-female"
  ].filter((value): value is string => Boolean(value && value.trim()));

  const safeText = text.trim().slice(0, 120);
  const errorMessages: string[] = [];

  for (const model of modelCandidates) {
    const hfResponse = await fetch(
      `https://router.huggingface.co/hf-inference/models/${encodeURIComponent(model)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "audio/wav"
        },
        body: JSON.stringify({
          inputs: safeText
        })
      }
    );

    if (hfResponse.ok) {
      const contentType = hfResponse.headers.get("content-type") ?? "audio/wav";
      const bytes = new Uint8Array(await hfResponse.arrayBuffer());
      const base64 = toBase64(bytes);
      return {
        audioDataUrl: `data:${contentType};base64,${base64}`,
        contentType
      };
    }

    const errorBody = await hfResponse.text();
    errorMessages.push(`${model}: ${hfResponse.status} ${errorBody}`);
  }

  throw new Error(`Hugging Face TTS request failed for all candidate models. ${errorMessages.join(" | ")}`);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const hfApiToken = Deno.env.get("HF_API_TOKEN");
  if (!hfApiToken) {
    return jsonResponse({ error: "Missing HF_API_TOKEN secret in function environment." }, 500);
  }

  try {
    const payload = (await request.json()) as { text?: string };
    const text = (payload.text ?? "").trim();

    if (!text) {
      return jsonResponse({ error: "Missing 'text'." }, 400);
    }

    const result = await synthesizeSpeech(text, hfApiToken);
    return jsonResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown backend error";
    return jsonResponse({ error: message }, 500);
  }
});

