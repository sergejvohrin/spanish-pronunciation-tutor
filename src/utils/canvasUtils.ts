import { Translation } from "@/types/translation";

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1080;

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

export async function generateTranslationPostImage(
  translation: Translation,
  backgroundUrl: string
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas is not supported in this browser.");
  }

  const image = await loadImage(backgroundUrl);

  ctx.drawImage(image, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Global dim layer for readability.
  ctx.fillStyle = "rgba(0, 0, 0, 0.46)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const contentWidth = 890;
  const contentX = (CANVAS_WIDTH - contentWidth) / 2;
  const sectionHeight = 196;
  const gap = 26;
  const totalHeight = sectionHeight * 3 + gap * 2;
  const startY = (CANVAS_HEIGHT - totalHeight) / 2 - 12;

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
    const y = startY + index * (sectionHeight + gap);
    const centerX = CANVAS_WIDTH / 2;
    const centerY = y + sectionHeight / 2;

    // Grey translucent box behind each language block.
    ctx.fillStyle = "rgba(150, 150, 150, 0.26)";
    ctx.fillRect(contentX, y, contentWidth, sectionHeight);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "700 46px Inter, sans-serif";
    ctx.fillText(section.title, centerX, centerY - 56);

    drawFittedText(ctx, section.word, centerX, centerY + 2, contentWidth - 120, 82, 56, 800);

    drawFittedText(ctx, section.phrase, centerX, centerY + 68, contentWidth - 120, 48, 32, 500);
  });

  return toJpegDataUrl(canvas);
}
