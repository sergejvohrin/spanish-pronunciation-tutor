import { supabase } from "@/lib/supabase";
import { LanguageWordRecord } from "@/types/languageWord";

const LANGUAGE_WORD_COLUMNS =
  "id,category,category_order,category_position,global_position,english_word,spanish_word,catalan_word,english_phrase,spanish_phrase,catalan_phrase,published_to,published_post_at,published_story_at";

export async function getNextUnpublishedWord(): Promise<LanguageWordRecord> {
  const { data, error } = await supabase
    .from("language_words")
    .select(LANGUAGE_WORD_COLUMNS)
    .or("published_post_at.is.null,published_story_at.is.null")
    .order("global_position", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (data) {
    return data;
  }

  const fallback = await supabase
    .from("language_words")
    .select(LANGUAGE_WORD_COLUMNS)
    .order("global_position", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fallback.error) {
    throw new Error(fallback.error.message);
  }

  if (!fallback.data) {
    throw new Error("No words found in language_words.");
  }

  return fallback.data;
}

export async function getWordByPosition(globalPosition: number): Promise<LanguageWordRecord> {
  const { data, error } = await supabase
    .from("language_words")
    .select(LANGUAGE_WORD_COLUMNS)
    .eq("global_position", globalPosition)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getAdjacentWord(
  globalPosition: number,
  direction: "previous" | "next"
): Promise<LanguageWordRecord | null> {
  const query =
    direction === "previous"
      ? supabase
          .from("language_words")
          .select(LANGUAGE_WORD_COLUMNS)
          .lt("global_position", globalPosition)
          .order("global_position", { ascending: false })
      : supabase
          .from("language_words")
          .select(LANGUAGE_WORD_COLUMNS)
          .gt("global_position", globalPosition)
          .order("global_position", { ascending: true });

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
