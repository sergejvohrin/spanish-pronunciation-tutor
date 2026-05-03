import axios from "axios";

interface GenerateVideoResponse {
  videoDataUrl?: string;
  contentType?: string;
  provider?: string;
  model?: string;
}

export async function generateSpanishTutorVideo(prompt: string): Promise<GenerateVideoResponse> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    throw new Error("Missing Supabase URL or publishable key.");
  }

  try {
    const response = await axios.post<GenerateVideoResponse>(
      `${supabaseUrl}/functions/v1/hf-video`,
      { prompt },
      {
        headers: {
          "Content-Type": "application/json",
          apikey: publishableKey,
          Authorization: `Bearer ${publishableKey}`
        }
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const backendError = error.response?.data as { error?: string } | undefined;
      if (backendError?.error) {
        throw new Error(backendError.error);
      }
    }
    throw error;
  }
}
