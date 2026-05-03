import axios from "axios";

interface GenerateTtsResponse {
  audioDataUrl: string;
  contentType: string;
}

export async function generateSpanishTtsAudio(text: string): Promise<string> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    throw new Error("Missing Supabase URL or publishable key.");
  }

  const response = await axios.post<GenerateTtsResponse>(
    `${supabaseUrl}/functions/v1/hf-tts`,
    { text },
    {
      headers: {
        "Content-Type": "application/json",
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`
      }
    }
  );

  if (!response.data.audioDataUrl?.startsWith("data:audio/")) {
    throw new Error("Hugging Face TTS failed.");
  }

  return response.data.audioDataUrl;
}

