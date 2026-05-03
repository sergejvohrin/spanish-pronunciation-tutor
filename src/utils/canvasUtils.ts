import { Translation } from "@/types/translation";

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;
const POST_WIDTH = 1080;
const POST_HEIGHT = 1350;

type LayoutMode = "story" | "post";

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load background image."));
    img.src = url;
  });
}

function toJpegDataUrl(canvas: HTMLCanvasElement): string {
  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  if (!dataUrl.startsWith("data:image/jpeg;base64,")) {
    throw new Error("Image generation failed. Please try again.");
  }
  return dataUrl;
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  targetWidth: number,
  targetHeight: number
): void {
  const scale = Math.max(targetWidth / image.width, targetHeight / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const offsetX = (targetWidth - drawWidth) / 2;
  const offsetY = (targetHeight - drawHeight) / 2;

  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

function drawFittedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  initialSize: number,
  minSize: number,
  weight: number
): void {
  let size = initialSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px Inter, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) {
      break;
    }
    size -= 2;
  }
  ctx.fillText(text, x, y);
}

function getLayout(mode: LayoutMode) {
  if (mode === "story") {
    return {
      width: STORY_WIDTH,
      height: STORY_HEIGHT,
      overlayOpacity: 0.5,
      contentWidth: 820,
      sectionHeight: 208,
      gap: 44,
      topOffset: -20,
      titleSize: 34,
      titleOffset: -56,
      wordSize: 66,
      wordMinSize: 54,
      wordOffset: 0,
      phraseSize: 28,
      phraseMinSize: 22,
      phraseOffset: 62,
      sidePadding: 210,
      boxOpacity: 0.18
    };
  }

  return {
    width: POST_WIDTH,
    height: POST_HEIGHT,
    overlayOpacity: 0.5,
    contentWidth: 860,
    sectionHeight: 188,
    gap: 38,
    topOffset: -12,
    titleSize: 34,
    titleOffset: -50,
    wordSize: 62,
    wordMinSize: 52,
    wordOffset: 0,
    phraseSize: 28,
    phraseMinSize: 22,
    phraseOffset: 58,
    sidePadding: 210,
    boxOpacity: 0.18
  };
}

async function generateTranslationImage(
  translation: Translation,
  backgroundUrl: string,
  mode: LayoutMode
): Promise<string> {
  const layout = getLayout(mode);
  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas is not supported in this browser.");
  }

  const image = await loadImage(backgroundUrl);

  drawCoverImage(ctx, image, layout.width, layout.height);

  ctx.fillStyle = `rgba(0, 0, 0, ${layout.overlayOpacity})`;
  ctx.fillRect(0, 0, layout.width, layout.height);

  const contentX = (layout.width - layout.contentWidth) / 2;
  const totalHeight = layout.sectionHeight * 3 + layout.gap * 2;
  const startY = (layout.height - totalHeight) / 2 + layout.topOffset;

  const sections = [
    {
      title: "ENGLISH",
      word: translation.english.word.toLowerCase(),
      phrase: translation.english.phrase
    },
    {
      title: "SPANISH",
      word: translation.spanish.word.toLowerCase(),
      phrase: translation.spanish.phrase
    },
    {
      title: "CATALAN",
      word: translation.catalan.word.toLowerCase(),
      phrase: translation.catalan.phrase
    }
  ];

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  sections.forEach((section, index) => {
    const y = startY + index * (layout.sectionHeight + layout.gap);
    const centerX = layout.width / 2;
    const centerY = y + layout.sectionHeight / 2;

    ctx.fillStyle = `rgba(140, 140, 140, ${layout.boxOpacity})`;
    ctx.fillRect(contentX, y, layout.contentWidth, layout.sectionHeight);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = `700 ${layout.titleSize}px Inter, sans-serif`;
    ctx.fillText(section.title, centerX, centerY + layout.titleOffset);

    drawFittedText(
      ctx,
      section.word,
      centerX,
      centerY + layout.wordOffset,
      layout.contentWidth - layout.sidePadding,
      layout.wordSize,
      layout.wordMinSize,
      800
    );

    drawFittedText(
      ctx,
      section.phrase,
      centerX,
      centerY + layout.phraseOffset,
      layout.contentWidth - layout.sidePadding,
      layout.phraseSize,
      layout.phraseMinSize,
      500
    );
  });

  return toJpegDataUrl(canvas);
}

export async function generateTranslationStoryImage(
  translation: Translation,
  backgroundUrl: string
): Promise<string> {
  return generateTranslationImage(translation, backgroundUrl, "story");
}

export async function generateTranslationPostImage(
  translation: Translation,
  backgroundUrl: string
): Promise<string> {
  return generateTranslationImage(translation, backgroundUrl, "post");
}
