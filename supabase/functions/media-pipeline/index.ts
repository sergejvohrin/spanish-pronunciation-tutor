const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

interface SaveRequest {
  action: "save";
  imageDataUrl: string;
  storyImageDataUrl?: string;
  postImageDataUrl?: string;
  imgbbApiKey?: string;
  caption?: string;
  translation?: TranslationPayload;
}

interface PublishRequest {
  action: "publish_story" | "publish_post" | "publish_story_post";
  imageDataUrl: string;
  storyImageDataUrl?: string;
  postImageDataUrl?: string;
  caption: string;
  imgbbApiKey?: string;
  instagramAccessToken?: string;
  translation?: TranslationPayload;
  globalPosition?: number;
}

interface ReadinessRequest {
  action: "readiness_check";
  instagramAccessToken?: string;
}

interface TranslationPayload {
  english: { word: string; phrase: string };
  spanish: { word: string; phrase: string };
  catalan: { word: string; phrase: string };
}

type RequestBody = SaveRequest | PublishRequest | ReadinessRequest;

class PipelineError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json"
    }
  });
}

function stripDataUrlPrefix(base64Image: string): string {
  return base64Image.replace(/^data:image\/[a-zA-Z]+;base64,/, "");
}

function getSupabaseRestConfig(): { url: string; key: string } | null {
  const url = (Deno.env.get("SUPABASE_URL") ?? "").trim();
  const key = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "").trim();

  if (!url || !key) {
    return null;
  }

  return { url, key };
}

async function logPostEvent(params: {
  translation?: TranslationPayload;
  caption?: string;
  imageUrl?: string;
  instagramMediaId?: string;
  status: string;
  errorMessage?: string;
}): Promise<void> {
  if (!params.translation) {
    return;
  }

  const config = getSupabaseRestConfig();
  if (!config) {
    return;
  }

  const payload = {
    en_word: params.translation.english.word,
    es_word: params.translation.spanish.word,
    ca_word: params.translation.catalan.word,
    caption: params.caption ?? "",
    image_url: params.imageUrl ?? null,
    instagram_media_id: params.instagramMediaId ?? null,
    status: params.status,
    error_message: params.errorMessage ?? null
  };

  const response = await fetch(`${config.url}/rest/v1/post_logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      Prefer: "return=minimal"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`post_logs insert failed: ${response.status} ${body}`);
  }
}

async function updateLanguageWordPublication(globalPosition: number | undefined, publicationLabel: string): Promise<void> {
  if (!globalPosition) {
    return;
  }

  const config = getSupabaseRestConfig();
  if (!config) {
    return;
  }

  const existingResponse = await fetch(
    `${config.url}/rest/v1/language_words?select=published_to&global_position=eq.${globalPosition}&limit=1`,
    {
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`
      }
    }
  );

  if (!existingResponse.ok) {
    const body = await existingResponse.text();
    console.error(`language_words fetch failed: ${existingResponse.status} ${body}`);
    return;
  }

  const existingPayload = (await existingResponse.json()) as Array<{ published_to?: string }>;
  const previousValue = (existingPayload[0]?.published_to ?? "").trim();
  const nextValue = previousValue ? `${previousValue} | ${publicationLabel}` : publicationLabel;

  const updateResponse = await fetch(`${config.url}/rest/v1/language_words?global_position=eq.${globalPosition}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      published_to: nextValue
    })
  });

  if (!updateResponse.ok) {
    const body = await updateResponse.text();
    console.error(`language_words update failed: ${updateResponse.status} ${body}`);
  }
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
    throw new PipelineError(payload.error?.message ?? "ImgBB upload failed.", 400);
  }

  return payload.data.url;
}

async function createInstagramContainer(
  igUserId: string,
  token: string,
  imageUrl: string,
  caption: string,
  mediaType: "IMAGE" | "STORIES"
): Promise<string> {
  const payload: Record<string, string> = {
    image_url: imageUrl,
    access_token: token
  };

  if (mediaType === "STORIES") {
    payload.media_type = "STORIES";
  } else {
    payload.caption = caption;
  }

  const response = await fetch(`https://graph.facebook.com/v18.0/${igUserId}/media`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = (await response.json()) as { id?: string; error?: { message?: string } };
  if (!response.ok || !data.id) {
    throw new PipelineError(data.error?.message ?? "Instagram media container creation failed.", 400);
  }

  return data.id;
}

async function publishInstagramContainerForUser(
  igUserId: string,
  token: string,
  creationId: string
): Promise<string> {
  const response = await fetch(`https://graph.facebook.com/v18.0/${igUserId}/media_publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      creation_id: creationId,
      access_token: token
    })
  });

  const data = (await response.json()) as { id?: string; error?: { message?: string } };
  if (!response.ok || !data.id) {
    throw new PipelineError(data.error?.message ?? "Instagram publish failed.", 400);
  }

  return data.id;
}

async function inspectInstagramPublishingTarget(token: string): Promise<{ igUserId: string; pagesCount: number }> {
  const configuredId = (Deno.env.get("INSTAGRAM_BUSINESS_ACCOUNT_ID") ?? "").trim();
  if (configuredId) {
    return { igUserId: configuredId, pagesCount: 0 };
  }

  const pagesResponse = await fetch(
    `https://graph.facebook.com/v18.0/me/accounts?access_token=${encodeURIComponent(token)}`
  );
  const pagesData = (await pagesResponse.json()) as {
    data?: Array<{ id?: string }>;
    error?: { message?: string };
  };

  if (!pagesResponse.ok) {
    throw new PipelineError(pagesData.error?.message ?? "Failed to load Facebook pages.", 400);
  }

  const pages = pagesData.data ?? [];
  for (const page of pages) {
    if (!page.id) {
      continue;
    }

    const pageResponse = await fetch(
      `https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${encodeURIComponent(
        token
      )}`
    );
    const pagePayload = (await pageResponse.json()) as {
      instagram_business_account?: { id?: string };
    };

    const igId = pagePayload.instagram_business_account?.id;
    if (igId) {
      return { igUserId: igId, pagesCount: pages.length };
    }
  }

  throw new PipelineError(
    "No Instagram business account found for this token. Ensure your Instagram Professional account is linked to a Facebook Page and the token has pages_show_list + instagram_content_publish."
    ,
    400
  );
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = (await request.json()) as RequestBody;
    const fallbackInstagramToken = Deno.env.get("INSTAGRAM_ACCESS_TOKEN") ?? "";
    const instagramToken =
      "instagramAccessToken" in body ? (body.instagramAccessToken ?? fallbackInstagramToken).trim() : fallbackInstagramToken;

    if (body.action === "readiness_check") {
      if (!instagramToken) {
        return jsonResponse({ error: "Missing INSTAGRAM_ACCESS_TOKEN secret." }, 400);
      }

      const target = await inspectInstagramPublishingTarget(instagramToken);
      return jsonResponse({
        ready: true,
        igUserId: target.igUserId,
        pagesCount: target.pagesCount,
        message: "Instagram publishing is correctly configured."
      });
    }

    if (!body.imageDataUrl?.startsWith("data:image/")) {
      return jsonResponse({ error: "Invalid image payload." }, 400);
    }

    const fallbackImgBbKey = Deno.env.get("IMGBB_API_KEY") ?? "";
    const imgbbApiKey = (body.imgbbApiKey ?? fallbackImgBbKey).trim();
    if (!imgbbApiKey) {
      return jsonResponse({ error: "Missing IMGBB_API_KEY secret (or runtime key)." }, 400);
    }

    if (body.action === "save") {
      const imageUrl = await uploadToImgBB(body.imageDataUrl, imgbbApiKey);
      await logPostEvent({
        translation: body.translation,
        caption: body.caption,
        imageUrl,
        status: "saved_to_imgbb"
      });
      return jsonResponse({ imageUrl });
    }

    if (!instagramToken) {
      return jsonResponse({ error: "Missing INSTAGRAM_ACCESS_TOKEN secret (or runtime token)." }, 400);
    }

    const caption = body.caption ?? "";

    try {
      const target = await inspectInstagramPublishingTarget(instagramToken);
      const igUserId = target.igUserId;
      let postId: string | undefined;
      let storyId: string | undefined;
      const publicationTimestamp = new Date().toISOString();
      let responseImageUrl = "";

      if (body.action === "publish_post" || body.action === "publish_story_post") {
        const postImageUrl = await uploadToImgBB(body.postImageDataUrl ?? body.imageDataUrl, imgbbApiKey);
        const postCreationId = await createInstagramContainer(igUserId, instagramToken, postImageUrl, caption, "IMAGE");
        postId = await publishInstagramContainerForUser(igUserId, instagramToken, postCreationId);
        await updateLanguageWordPublication(body.globalPosition, `post:${publicationTimestamp}`);
        responseImageUrl = postImageUrl;
      }

      if (body.action === "publish_story" || body.action === "publish_story_post") {
        const storyImageUrl = await uploadToImgBB(body.storyImageDataUrl ?? body.imageDataUrl, imgbbApiKey);
        const storyCreationId = await createInstagramContainer(igUserId, instagramToken, storyImageUrl, "", "STORIES");
        storyId = await publishInstagramContainerForUser(igUserId, instagramToken, storyCreationId);
        await updateLanguageWordPublication(body.globalPosition, `story:${publicationTimestamp}`);
        if (!responseImageUrl) {
          responseImageUrl = storyImageUrl;
        }
      }

      await logPostEvent({
        translation: body.translation,
        caption,
        imageUrl: responseImageUrl,
        instagramMediaId: [postId ? `post:${postId}` : "", storyId ? `story:${storyId}` : ""].filter(Boolean).join(";"),
        status: "publish_succeeded"
      });

      return jsonResponse({
        imageUrl: responseImageUrl,
        postId,
        storyId
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Instagram publish failed.";
      await logPostEvent({
        translation: body.translation,
        caption,
        imageUrl: undefined,
        status: "publish_failed",
        errorMessage: message
      });
      throw error;
    }
  } catch (error) {
    const maybeStatus =
      typeof error === "object" && error !== null && "status" in error
        ? (error as { status?: unknown }).status
        : undefined;
    if (typeof maybeStatus === "number") {
      const message =
        typeof (error as { message?: unknown }).message === "string"
          ? (error as { message: string }).message
          : "Request failed.";
      return jsonResponse({ error: message }, maybeStatus);
    }
    const message = error instanceof Error ? error.message : "Unknown backend error";
    return jsonResponse({ error: message }, 500);
  }
});
