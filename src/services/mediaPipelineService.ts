import axios from "axios";
import { Translation } from "@/types/translation";

interface SaveResponse {
  imageUrl: string;
}

interface PublishResponse {
  imageUrl: string;
  postId?: string;
  storyId?: string;
}

interface ReadinessResponse {
  ready: boolean;
  igUserId: string;
  pagesCount: number;
  message: string;
}

function getSupabaseConfig() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    throw new Error("Missing Supabase URL or publishable key.");
  }

  return { supabaseUrl, publishableKey };
}

function getHeaders(publishableKey: string) {
  return {
    "Content-Type": "application/json",
    apikey: publishableKey,
    Authorization: `Bearer ${publishableKey}`
  };
}

export async function saveGeneratedImageToImgBB(
  imageDataUrl: string,
  translation: Translation,
  caption: string
): Promise<SaveResponse> {
  const { supabaseUrl, publishableKey } = getSupabaseConfig();

  const response = await axios.post<SaveResponse | { error: string }>(
    `${supabaseUrl}/functions/v1/media-pipeline`,
    {
      action: "save",
      imageDataUrl,
      translation,
      caption
    },
    {
      headers: getHeaders(publishableKey)
    }
  );

  if ("error" in response.data) {
    throw new Error(response.data.error);
  }

  return response.data;
}

export async function publishGeneratedImageToInstagram(
  imageDataUrl: string,
  caption: string,
  translation: Translation,
  publishMode: "story" | "post" | "story_post",
  globalPosition: number
): Promise<PublishResponse> {
  const { supabaseUrl, publishableKey } = getSupabaseConfig();

  const action =
    publishMode === "story"
      ? "publish_story"
      : publishMode === "post"
        ? "publish_post"
        : "publish_story_post";

  const response = await axios.post<PublishResponse | { error: string }>(
    `${supabaseUrl}/functions/v1/media-pipeline`,
    {
      action,
      imageDataUrl,
      caption,
      translation,
      globalPosition
    },
    {
      headers: getHeaders(publishableKey)
    }
  );

  if ("error" in response.data) {
    throw new Error(response.data.error);
  }

  return response.data;
}

export async function checkInstagramPublishingReadiness(): Promise<ReadinessResponse> {
  const { supabaseUrl, publishableKey } = getSupabaseConfig();

  const response = await axios.post<ReadinessResponse | { error: string }>(
    `${supabaseUrl}/functions/v1/media-pipeline`,
    {
      action: "readiness_check"
    },
    {
      headers: getHeaders(publishableKey)
    }
  );

  if ("error" in response.data) {
    throw new Error(response.data.error);
  }

  return response.data;
}
