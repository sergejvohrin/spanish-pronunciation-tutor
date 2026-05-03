import { Translation } from "@/types/translation";

export interface LanguageWordRecord {
  id: number;
  category: string;
  category_order: number;
  category_position: number;
  global_position: number;
  english_word: string;
  spanish_word: string;
  catalan_word: string;
  english_phrase: string;
  spanish_phrase: string;
  catalan_phrase: string;
  published_to: string;
  published_post_at?: string | null;
  published_story_at?: string | null;
}

export function toTranslation(record: LanguageWordRecord): Translation {
  return {
    english: {
      word: record.english_word,
      phrase: record.english_phrase
    },
    spanish: {
      word: record.spanish_word,
      phrase: record.spanish_phrase
    },
    catalan: {
      word: record.catalan_word,
      phrase: record.catalan_phrase
    }
  };
}
