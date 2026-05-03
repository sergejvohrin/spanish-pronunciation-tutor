const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-pipeline-secret"
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

function stripDataUrlPrefix(base64Image: string): string {
  return base64Image.replace(/^data:image\/[a-zA-Z]+;base64,/, "");
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return text.slice(start, end + 1);
}

async function getPostLogsPreview(): Promise<unknown> {
  const url = (Deno.env.get("SUPABASE_URL") ?? "").trim();
  const key = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const response = await fetch(`${url}/rest/v1/post_logs?select=id,created_at,status&order=id.desc&limit=1`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`
    }
  });

  if (!response.ok) {
    throw new Error(`post_logs request failed (${response.status}).`);
  }

  const payload = (await response.json()) as unknown[];
  return payload[0] ?? {};
}

async function generateTranslation(word: string, token: string): Promise<unknown> {
  const modelCandidates = [
    Deno.env.get("HF_MODEL"),
    "Qwen/Qwen2.5-Coder-7B-Instruct",
    "Qwen/Qwen2.5-7B-Instruct",
    "deepseek-ai/DeepSeek-R1:fastest"
  ].filter((value): value is string => Boolean(value && value.trim()));
  let model = modelCandidates[0];

  const modelListResponse = await fetch("https://router.huggingface.co/v1/models", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!modelListResponse.ok) {
    throw new Error(`Failed to list Hugging Face models (${modelListResponse.status}).`);
  }

  const modelList = (await modelListResponse.json()) as { data?: Array<{ id: string }> };
  const availableModels = new Set((modelList.data ?? []).map((entry) => entry.id));
  model = modelCandidates.find((candidate) => availableModels.has(candidate)) ?? modelList.data?.[0]?.id ?? model;

  if (!model) {
    throw new Error("No available Hugging Face chat model found.");
  }

  const prompt = [
    "Return only valid JSON without markdown or explanation.",
    '{"english":{"word":"","phrase":""},"spanish":{"word":"","phrase":""},"catalan":{"word":"","phrase":""}}',
    `Input word: ${word}`,
    "Task: Translate the word and generate one short, natural example phrase in each language."
  ].join("\n");

  const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 320,
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`hf-translation failed (${response.status}): ${body}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = payload.choices?.[0]?.message?.content ?? "";
  const extracted = extractJsonObject(content);
  if (!extracted) {
    throw new Error("hf-translation returned no JSON payload.");
  }

  return JSON.parse(extracted);
}

async function generateImage(word: string, token: string): Promise<string> {
  const model = (Deno.env.get("HF_IMAGE_MODEL") ?? "black-forest-labs/FLUX.1-schnell").trim();
  const prompt = `realistic photo like image that would be in a theme of Spain and related to ${word}`;

  const response = await fetch(
    `https://router.huggingface.co/hf-inference/models/${encodeURIComponent(model)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "image/jpeg"
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          guidance_scale: 3.5,
          num_inference_steps: 6,
          width: 1024,
          height: 1024
        }
      })
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`hf-image failed (${response.status}): ${body}`);
  }

  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  const bytes = new Uint8Array(await response.arrayBuffer());
  return `data:${contentType};base64,${toBase64(bytes)}`;
}

async function uploadToImgBB(base64Image: string, apiKey: string): Promise<string> {
  const body = new URLSearchParams();
  body.append("key", apiKey);
  body.append("image", stripDataUrlPrefix(base64Image));

  const response = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  const payload = (await response.json()) as {
    success?: boolean;
    data?: { url?: string };
    error?: { message?: string };
  };

  if (!response.ok || !payload.success || !payload.data?.url) {
    throw new Error(payload.error?.message ?? "ImgBB upload failed.");
  }

  return payload.data.url;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const expectedSecret = (Deno.env.get("TOKEN_ROTATION_SECRET") ?? "").trim();
  const providedSecret = (request.headers.get("x-pipeline-secret") ?? "").trim();
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const hfApiToken = (Deno.env.get("HF_API_TOKEN") ?? "").trim();
    const imgbbApiKey = (Deno.env.get("IMGBB_API_KEY") ?? "").trim();

    if (!hfApiToken || !imgbbApiKey) {
      throw new Error("Missing HF_API_TOKEN or IMGBB_API_KEY.");
    }

    const postLogsPreview = await getPostLogsPreview();
    const translation = await generateTranslation("journey", hfApiToken);
    const imageDataUrl = await generateImage("journey", hfApiToken);
    const imageUrl = await uploadToImgBB(imageDataUrl, imgbbApiKey);

    return jsonResponse({
      ok: true,
      postLogsPreview,
      translation,
      imageUrl
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown backend-health error";
    return jsonResponse({ error: message }, 500);
  }
});
