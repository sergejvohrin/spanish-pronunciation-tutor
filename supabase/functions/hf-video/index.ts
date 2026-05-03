const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

type ProviderMapping = Record<
  string,
  {
    status?: string;
    providerId?: string;
    task?: string;
  }
>;

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

async function getModelProviderMapping(model: string, token: string): Promise<ProviderMapping> {
  // Hugging Face model IDs are path-like (org/model). Encode each segment but keep the slash.
  const encodedModelPath = model
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  const response = await fetch(
    `https://huggingface.co/api/models/${encodedModelPath}?expand[]=inferenceProviderMapping`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Hugging Face provider mapping (${response.status}).`);
  }

  const payload = (await response.json()) as { inferenceProviderMapping?: ProviderMapping };
  return payload.inferenceProviderMapping ?? {};
}

async function tryProviderRoute(
  provider: string,
  providerModelId: string,
  prompt: string,
  token: string
): Promise<{ videoDataUrl: string; contentType: string; provider: string } | null> {
  const response = await fetch(
    `https://router.huggingface.co/${provider}/models/${encodeURIComponent(providerModelId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "video/mp4"
      },
      body: JSON.stringify({
        inputs: prompt
      })
    }
  );

  if (!response.ok) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as {
      video?: string;
      url?: string;
      output?: string;
      data?: Array<{ url?: string }>;
    };

    const remoteUrl = payload.video ?? payload.url ?? payload.output ?? payload.data?.[0]?.url;
    if (!remoteUrl) {
      return null;
    }

    return {
      videoDataUrl: remoteUrl,
      contentType: "url",
      provider
    };
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0) {
    return null;
  }

  return {
    videoDataUrl: `data:${contentType || "video/mp4"};base64,${toBase64(bytes)}`,
    contentType: contentType || "video/mp4",
    provider
  };
}

async function tryHfInferenceFallback(
  model: string,
  prompt: string,
  token: string
): Promise<{ videoDataUrl: string; contentType: string; provider: string } | null> {
  const response = await fetch(
    `https://router.huggingface.co/hf-inference/models/${encodeURIComponent(model)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "video/mp4"
      },
      body: JSON.stringify({
        inputs: prompt
      })
    }
  );

  if (!response.ok) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "video/mp4";
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0) {
    return null;
  }

  return {
    videoDataUrl: `data:${contentType};base64,${toBase64(bytes)}`,
    contentType,
    provider: "hf-inference"
  };
}

async function generateVideo(
  prompt: string,
  model: string,
  token: string
): Promise<{ videoDataUrl: string; contentType: string; provider: string; model: string }> {
  const mapping = await getModelProviderMapping(model, token);
  const errors: string[] = [];

  for (const [provider, providerInfo] of Object.entries(mapping)) {
    if (providerInfo.status !== "live") {
      continue;
    }
    if (providerInfo.task !== "text-to-video") {
      continue;
    }

    const providerModelId = providerInfo.providerId || model;
    const result = await tryProviderRoute(provider, providerModelId, prompt, token);
    if (result) {
      return {
        ...result,
        model
      };
    }
    errors.push(`provider-route failed for ${provider}:${providerModelId}`);
  }

  const fallbackResult = await tryHfInferenceFallback(model, prompt, token);
  if (fallbackResult) {
    return {
      ...fallbackResult,
      model
    };
  }

  throw new Error(
    `Video generation failed for model '${model}'. ` +
      `No compatible provider returned video output. ${errors.join(" | ")}`
  );
}

async function pickWorkingVideoModel(token: string): Promise<string> {
  const configuredModel = (Deno.env.get("HF_TTS_MODEL") ?? "").trim();
  if (!configuredModel) {
    throw new Error("Missing HF_TTS_MODEL. Set it in Supabase Edge Function secrets.");
  }

  const candidates = [
    configuredModel,
    "Wan-AI/Wan2.1-T2V-1.3B"
  ].filter((value): value is string => Boolean(value && value.trim()));

  for (const candidate of candidates) {
    const mapping = await getModelProviderMapping(candidate, token);
    const hasLiveVideoProvider = Object.values(mapping).some(
      (providerInfo) =>
        providerInfo.status === "live" &&
        providerInfo.task === "text-to-video"
    );
    if (hasLiveVideoProvider) {
      return candidate;
    }
  }

  throw new Error("No compatible Hugging Face text-to-video model is live for this token.");
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
    const payload = (await request.json()) as { prompt?: string };
    const prompt = (payload.prompt ?? "").trim();

    if (!prompt) {
      return jsonResponse({ error: "Missing 'prompt'." }, 400);
    }

    const model = await pickWorkingVideoModel(hfApiToken);

    const result = await generateVideo(prompt.slice(0, 500), model, hfApiToken);
    return jsonResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown backend error";
    return jsonResponse({ error: message }, 500);
  }
});
