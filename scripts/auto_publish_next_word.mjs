import sharp from "sharp";

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;
const POST_WIDTH = 1080;
const POST_HEIGHT = 1350;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function getConfig() {
  return {
    supabaseUrl: requireEnv("VITE_SUPABASE_URL").replace(/\/$/, ""),
    publishableKey: requireEnv("VITE_SUPABASE_PUBLISHABLE_KEY"),
    pipelineSecret: requireEnv("TOKEN_ROTATION_SECRET")
  };
}

function getHeaders() {
  const { publishableKey, pipelineSecret } = getConfig();
  return {
    "Content-Type": "application/json",
    apikey: publishableKey,
    Authorization: `Bearer ${publishableKey}`,
    "x-pipeline-secret": pipelineSecret
  };
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }

  return data;
}

async function getNextUnpublishedWord() {
  const { supabaseUrl } = getConfig();
  const url =
    `${supabaseUrl}/rest/v1/language_words` +
    "?select=id,category,category_order,category_position,global_position,english_word,spanish_word,catalan_word,english_phrase,spanish_phrase,catalan_phrase,published_to,published_post_at,published_story_at" +
    "&or=(published_post_at.is.null,published_story_at.is.null)" +
    "&order=global_position.asc" +
    "&limit=1";

  const data = await fetchJson(url, {
    headers: getHeaders()
  });

  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  return data[0];
}

async function generateBackground(word) {
  const { supabaseUrl } = getConfig();
  const data = await fetchJson(`${supabaseUrl}/functions/v1/hf-image`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ word })
  });

  if (!data.imageDataUrl) {
    throw new Error("hf-image returned no imageDataUrl");
  }

  return data.imageDataUrl;
}

function dataUrlToBuffer(dataUrl) {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid data URL");
  }

  return Buffer.from(match[2], "base64");
}

function buildCaption(record) {
  return [
    `🇬🇧 ${record.english_word}. ${record.english_phrase}`,
    `🇪🇸 ${record.spanish_word}. ${record.spanish_phrase}`,
    `🔴🟡 ${record.catalan_word}. ${record.catalan_phrase}`,
    "#languages #english #spanish #catalan #barcelona #digital_nomads #keeplearning #madrid"
  ].join("\n");
}

function getPublishMode(record) {
  const missingPost = !record.published_post_at;
  const missingStory = !record.published_story_at;

  if (missingPost && missingStory) {
    return "story_post";
  }

  if (missingPost) {
    return "post";
  }

  if (missingStory) {
    return "story";
  }

  return null;
}

function layoutFor(mode) {
  if (mode === "story") {
    return {
      width: STORY_WIDTH,
      height: STORY_HEIGHT,
      contentWidth: 820,
      sectionHeight: 208,
      gap: 44,
      topOffset: -20,
      titleSize: 38,
      titleOffset: -56,
      wordSize: 72,
      phraseSize: 32,
      phraseOffset: 62,
      boxOpacity: 0.18,
      overlayOpacity: 0.5
    };
  }

  return {
    width: POST_WIDTH,
    height: POST_HEIGHT,
    contentWidth: 860,
    sectionHeight: 188,
    gap: 38,
    topOffset: -12,
    titleSize: 38,
    titleOffset: -50,
    wordSize: 68,
    phraseSize: 32,
    phraseOffset: 58,
    boxOpacity: 0.18,
    overlayOpacity: 0.5
  };
}

function escapeXml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildOverlaySvg(record, mode) {
  const layout = layoutFor(mode);
  const centerX = layout.width / 2;
  const contentX = (layout.width - layout.contentWidth) / 2;
  const totalHeight = layout.sectionHeight * 3 + layout.gap * 2;
  const startY = (layout.height - totalHeight) / 2 + layout.topOffset;

  const sections = [
    { title: "ENGLISH", word: record.english_word.toLowerCase(), phrase: record.english_phrase },
    { title: "SPANISH", word: record.spanish_word.toLowerCase(), phrase: record.spanish_phrase },
    { title: "CATALAN", word: record.catalan_word.toLowerCase(), phrase: record.catalan_phrase }
  ];

  const boxes = sections
    .map((section, index) => {
      const y = startY + index * (layout.sectionHeight + layout.gap);
      const centerY = y + layout.sectionHeight / 2;

      return `
        <rect x="${contentX}" y="${y}" width="${layout.contentWidth}" height="${layout.sectionHeight}" fill="rgba(140,140,140,${layout.boxOpacity})" />
        <text x="${centerX}" y="${centerY + layout.titleOffset}" text-anchor="middle" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="${layout.titleSize}" font-weight="700">${escapeXml(section.title)}</text>
        <text x="${centerX}" y="${centerY}" text-anchor="middle" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="${layout.wordSize}" font-weight="800">${escapeXml(section.word)}</text>
        <text x="${centerX}" y="${centerY + layout.phraseOffset}" text-anchor="middle" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="${layout.phraseSize}" font-weight="500">${escapeXml(section.phrase)}</text>
      `;
    })
    .join("");

  return `
    <svg width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${layout.width}" height="${layout.height}" fill="rgba(0,0,0,${layout.overlayOpacity})" />
      ${boxes}
    </svg>
  `;
}

async function renderImage(backgroundDataUrl, record, mode) {
  const layout = layoutFor(mode);
  const backgroundBuffer = dataUrlToBuffer(backgroundDataUrl);
  const overlaySvg = Buffer.from(buildOverlaySvg(record, mode));

  return sharp(backgroundBuffer)
    .resize(layout.width, layout.height, {
      fit: "cover",
      position: "center"
    })
    .composite([{ input: overlaySvg, top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toBuffer();
}

async function publishAssets(record, storyBuffer, postBuffer) {
  const { supabaseUrl } = getConfig();
  const publishMode = getPublishMode(record);

  if (!publishMode) {
    return {
      skipped: true,
      reason: "already_fully_published"
    };
  }

  const data = await fetchJson(`${supabaseUrl}/functions/v1/media-pipeline`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      action:
        publishMode === "story"
          ? "publish_story"
          : publishMode === "post"
            ? "publish_post"
            : "publish_story_post",
      imageDataUrl: `data:image/jpeg;base64,${storyBuffer.toString("base64")}`,
      storyImageDataUrl: `data:image/jpeg;base64,${storyBuffer.toString("base64")}`,
      postImageDataUrl: `data:image/jpeg;base64,${postBuffer.toString("base64")}`,
      caption: buildCaption(record),
      translation: {
        english: { word: record.english_word, phrase: record.english_phrase },
        spanish: { word: record.spanish_word, phrase: record.spanish_phrase },
        catalan: { word: record.catalan_word, phrase: record.catalan_phrase }
      },
      globalPosition: record.global_position
    })
  });

  return {
    publishMode,
    ...data
  };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const record = await getNextUnpublishedWord();

  if (!record) {
    console.log(JSON.stringify({ ok: true, skipped: true, reason: "no_unpublished_words" }));
    return;
  }

  const background = await generateBackground(record.english_word);
  const [storyBuffer, postBuffer] = await Promise.all([
    renderImage(background, record, "story"),
    renderImage(background, record, "post")
  ]);

  if (dryRun) {
    const publishMode = getPublishMode(record);
    console.log(
      JSON.stringify({
        ok: true,
        dryRun: true,
        globalPosition: record.global_position,
        englishWord: record.english_word,
        publishMode,
        storyBytes: storyBuffer.length,
        postBytes: postBuffer.length
      })
    );
    return;
  }

  const result = await publishAssets(record, storyBuffer, postBuffer);
  console.log(
    JSON.stringify({
      ok: true,
      globalPosition: record.global_position,
      englishWord: record.english_word,
      result
    })
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
