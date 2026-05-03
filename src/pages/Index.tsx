import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateAiSpainBackgroundImage } from "@/services/huggingFaceImageService";
import { getAdjacentWord, getNextUnpublishedWord, getWordByPosition } from "@/services/languageWordsService";
import { publishGeneratedImageToInstagram } from "@/services/mediaPipelineService";
import { LanguageWordRecord, toTranslation } from "@/types/languageWord";
import { Translation } from "@/types/translation";
import { generateTranslationPostImage } from "@/utils/canvasUtils";

const FALLBACK_BACKGROUND_IMAGE = "https://images.pexels.com/photos/457882/pexels-photo-457882.jpeg";

function buildCaption(translation: Translation): string {
  return [
    `EN: ${translation.english.word} - ${translation.english.phrase}`,
    `ES: ${translation.spanish.word} - ${translation.spanish.phrase}`,
    `CA: ${translation.catalan.word} - ${translation.catalan.phrase}`,
    "#languages #english #spanish #catalan"
  ].join("\n");
}

function formatPublishedTo(publishedTo: string): string {
  const value = publishedTo.trim();
  if (!value) {
    return "Not published yet";
  }

  return value
    .split("|")
    .map((part) => {
      const trimmed = part.trim();
      const separatorIndex = trimmed.indexOf(":");
      if (separatorIndex === -1) {
        return trimmed;
      }

      const channel = trimmed.slice(0, separatorIndex);
      const isoDate = trimmed.slice(separatorIndex + 1);

      const parsed = new Date(isoDate);
      if (Number.isNaN(parsed.getTime())) {
        return trimmed;
      }

      const label =
        channel === "story"
          ? "Story"
          : channel === "post"
            ? "Post"
            : channel.charAt(0).toUpperCase() + channel.slice(1);

      return `${label}: ${parsed.toLocaleString()}`;
    })
    .join(" | ");
}

export function IndexPage() {
  const [currentWord, setCurrentWord] = useState<LanguageWordRecord | null>(null);
  const [previewImage, setPreviewImage] = useState("");
  const [isLoadingWord, setIsLoadingWord] = useState(true);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isPostingStory, setIsPostingStory] = useState(false);
  const [isPostingPost, setIsPostingPost] = useState(false);
  const [isPostingStoryAndPost, setIsPostingStoryAndPost] = useState(false);
  const [hasPreviousWord, setHasPreviousWord] = useState(false);
  const [hasNextWord, setHasNextWord] = useState(false);

  const translation = useMemo(() => (currentWord ? toTranslation(currentWord) : null), [currentWord]);
  const isBusy = isLoadingWord || isGeneratingImage || isPostingStory || isPostingPost || isPostingStoryAndPost;

  const refreshNavigationState = async (globalPosition: number) => {
    const [previousWord, nextWord] = await Promise.all([
      getAdjacentWord(globalPosition, "previous"),
      getAdjacentWord(globalPosition, "next")
    ]);
    setHasPreviousWord(Boolean(previousWord));
    setHasNextWord(Boolean(nextWord));
  };

  const buildGeneratedImage = async (value: Translation): Promise<string> => {
    let backgroundImage = FALLBACK_BACKGROUND_IMAGE;

    try {
      backgroundImage = await generateAiSpainBackgroundImage(value.english.word);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI background generation failed.";
      toast.error(`${message} Using fallback background image.`);
    }

    return generateTranslationPostImage(value, backgroundImage);
  };

  const loadWord = async (loader: () => Promise<LanguageWordRecord>) => {
    setIsLoadingWord(true);
    try {
      const record = await loader();
      setCurrentWord(record);
      await refreshNavigationState(record.global_position);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load word.";
      toast.error(message);
    } finally {
      setIsLoadingWord(false);
    }
  };

  useEffect(() => {
    void loadWord(getNextUnpublishedWord);
  }, []);

  useEffect(() => {
    if (!translation) {
      return;
    }

    let isActive = true;
    setIsGeneratingImage(true);

    void buildGeneratedImage(translation)
      .then((image) => {
        if (isActive) {
          setPreviewImage(image);
        }
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Failed to generate preview image.";
        if (isActive) {
          toast.error(message);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsGeneratingImage(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [translation]);

  const handleNavigate = async (direction: "previous" | "next") => {
    if (!currentWord) {
      return;
    }

    const adjacentWord = await getAdjacentWord(currentWord.global_position, direction);
    if (!adjacentWord) {
      toast.error(direction === "previous" ? "No prior word available." : "No next word available.");
      return;
    }

    await loadWord(() => Promise.resolve(adjacentWord));
  };

  const handlePublish = async (mode: "story" | "post" | "story_post") => {
    if (!translation || !currentWord) {
      return;
    }

    const setters = {
      story: setIsPostingStory,
      post: setIsPostingPost,
      story_post: setIsPostingStoryAndPost
    };

    setters[mode](true);

    try {
      const image = previewImage || (await buildGeneratedImage(translation));
      if (!previewImage) {
        setPreviewImage(image);
      }

      const result = await publishGeneratedImageToInstagram(
        image,
        buildCaption(translation),
        translation,
        mode,
        currentWord.global_position
      );

      const refreshedWord = await getWordByPosition(currentWord.global_position);
      setCurrentWord(refreshedWord);

      if (mode === "story") {
        toast.success(`Story published${result.storyId ? ` (${result.storyId})` : ""}.`);
      } else if (mode === "post") {
        toast.success(`Post published${result.postId ? ` (${result.postId})` : ""}.`);
      } else {
        toast.success("Post and story published.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Instagram publish failed.";
      toast.error(message);
    } finally {
      setters[mode](false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Daily Language Publishing Queue</CardTitle>
          <CardDescription>Next unpublished word from Supabase.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-md border bg-slate-50 p-3 text-sm text-slate-700">
            {currentWord ? (
              <>
                <div className="font-semibold">{currentWord.category.replace(/_/g, " ")} | #{currentWord.global_position}</div>
              </>
            ) : (
              "Loading word from database..."
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Preview</p>
            <div className="overflow-hidden rounded-lg border bg-slate-200">
              {previewImage ? (
                <img
                  src={previewImage}
                  alt="Generated translation post preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-[640px] items-center justify-center text-sm text-slate-600">
                  {isLoadingWord || isGeneratingImage ? "Generating image..." : "Preview not available."}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-md border bg-white p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Published</p>
            <p className="mt-1">{currentWord ? formatPublishedTo(currentWord.published_to) : "Loading..."}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void handleNavigate("previous")} disabled={isBusy || !hasPreviousWord} variant="secondary">
              Prior Word
            </Button>
            <Button onClick={() => void handleNavigate("next")} disabled={isBusy || !hasNextWord} variant="secondary">
              Next Word
            </Button>
            <Button onClick={() => void handlePublish("story")} disabled={isBusy || !currentWord}>
              {isPostingStory ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Posting Story...
                </>
              ) : (
                "Post Story"
              )}
            </Button>
            <Button onClick={() => void handlePublish("post")} disabled={isBusy || !currentWord}>
              {isPostingPost ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Posting Post...
                </>
              ) : (
                "Post Post"
              )}
            </Button>
            <Button onClick={() => void handlePublish("story_post")} disabled={isBusy || !currentWord}>
              {isPostingStoryAndPost ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Posting Both...
                </>
              ) : (
                "Post Post and Story"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
