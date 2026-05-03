import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateSpanishTtsAudio } from "@/services/huggingFaceTtsService";

type PhraseLesson = {
  phrase: string;
  sayLike: string;
  tips: string[];
};

const LESSONS: PhraseLesson[] = [
  {
    phrase: "Hola",
    sayLike: "OH-lah",
    tips: ["H is silent in Spanish.", "Keep O short and clean.", "Open A like 'ah'."]
  },
  {
    phrase: "Como estas",
    sayLike: "KOH-moh es-TAHS",
    tips: ["C before O sounds like K.", "Stress is usually even; lean on 'tas'.", "Keep vowels pure (no sliding)."]
  },
  {
    phrase: "Gracias",
    sayLike: "GRAH-syahs",
    tips: ["GRA is one beat, not 'gruh-A'.", "C before I sounds like S in Latin American Spanish.", "End with 'syas' (soft 'y' sound)."]
  }
];

function pickSpanishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const preferred = voices.filter((voice) => {
    const lang = (voice.lang || "").toLowerCase();
    return lang.startsWith("es");
  });

  const esEs = preferred.find((voice) => (voice.lang || "").toLowerCase() === "es-es");
  return esEs ?? preferred[0] ?? null;
}

function speakPhrase(voice: SpeechSynthesisVoice | null, phrase: string, rate: number) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(phrase);
  utterance.lang = voice?.lang || "es-ES";
  utterance.voice = voice ?? null;
  utterance.rate = rate;
  utterance.pitch = 1;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
}

function pickBestRecorderMimeType(): string | undefined {
  if (typeof window === "undefined" || !("MediaRecorder" in window)) {
    return undefined;
  }

  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];

  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = src;
  await image.decode();
  return image;
}

function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64Index = dataUrl.indexOf("base64,");
  if (base64Index === -1) {
    throw new Error("Invalid data URL.");
  }
  const base64 = dataUrl.slice(base64Index + "base64,".length);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#0f172a");
  gradient.addColorStop(1, "#7f1d1d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.beginPath();
  ctx.arc(width * 0.15, height * 0.2, 220, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(width * 0.85, height * 0.35, 260, 0, Math.PI * 2);
  ctx.fill();
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
) {
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  const r = 32;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawLessonFrame(
  ctx: CanvasRenderingContext2D,
  avatar: HTMLImageElement,
  lesson: PhraseLesson,
  width: number,
  height: number,
  progress: number,
  segmentIndex: number,
  segmentCount: number
) {
  drawBackground(ctx, width, height);

  const padding = 64;
  const cardX = padding;
  const cardY = 460;
  const cardW = width - padding * 2;
  const cardH = height - cardY - 180;
  drawCard(ctx, cardX, cardY, cardW, cardH);

  const avatarSize = 320;
  const avatarX = padding;
  const avatarY = padding;
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
  ctx.restore();

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "700 56px Inter, system-ui, -apple-system, sans-serif";
  ctx.fillText("Spanish pronunciation", avatarX + avatarSize + 28, avatarY + 92);

  ctx.font = "500 34px Inter, system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fillText(`Clip ${segmentIndex + 1} of ${segmentCount}`, avatarX + avatarSize + 28, avatarY + 146);

  ctx.fillStyle = "#0f172a";
  ctx.font = "800 120px Inter, system-ui, -apple-system, sans-serif";
  ctx.fillText(lesson.phrase, cardX + 56, cardY + 160);

  ctx.fillStyle = "#334155";
  ctx.font = "700 44px Inter, system-ui, -apple-system, sans-serif";
  ctx.fillText(`Say like: ${lesson.sayLike}`, cardX + 56, cardY + 230);

  ctx.font = "500 40px Inter, system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#334155";
  let lineY = cardY + 320;
  for (const tip of lesson.tips) {
    ctx.fillText(`- ${tip}`, cardX + 56, lineY);
    lineY += 64;
  }

  const barX = cardX;
  const barY = height - 110;
  const barW = cardW;
  const barH = 18;
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(barX, barY, barW * Math.min(Math.max(progress, 0), 1), barH);
}

export function PronunciationTutorPage() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [rate, setRate] = useState<"slow" | "normal">("normal");
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>("");

  const selectedVoice = useMemo(() => pickSpanishVoice(voices), [voices]);
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
  const canRecordVideo = typeof window !== "undefined" && "MediaRecorder" in window && "AudioContext" in window;

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  const actualRate = rate === "slow" ? 0.72 : 0.95;

  const handleGenerateInstagramVideo = async () => {
    if (!canRecordVideo) {
      toast.error("Video export is not supported in this browser.");
      return;
    }

    const mimeType = pickBestRecorderMimeType();
    if (!mimeType) {
      toast.error("MediaRecorder does not support WebM on this device.");
      return;
    }

    setIsGeneratingVideo(true);
    setVideoUrl("");

    try {
      const width = 1080;
      const height = 1920;
      const fps = 30;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Canvas is not supported.");
      }

      const avatar = await loadImage("/spanish-tutor.png");

      const audioContext = new AudioContext();
      await audioContext.resume();
      const destination = audioContext.createMediaStreamDestination();

      let audioBuffers: AudioBuffer[] = [];
      let audioEnabled = true;
      try {
        audioBuffers = await Promise.all(
          LESSONS.map(async (lesson) => {
            const audioDataUrl = await generateSpanishTtsAudio(lesson.phrase);
            const buffer = dataUrlToArrayBuffer(audioDataUrl);
            return audioContext.decodeAudioData(buffer.slice(0));
          })
        );
      } catch (error) {
        audioEnabled = false;
        const message = error instanceof Error ? error.message : "TTS failed.";
        toast.error(`${message} Exporting a silent video instead.`);
        audioBuffers = LESSONS.map(() => {
          const silentSeconds = 1.2;
          return audioContext.createBuffer(1, Math.ceil(audioContext.sampleRate * silentSeconds), audioContext.sampleRate);
        });
      }

      const paddingSeconds = 0.65;
      const segmentStarts: number[] = [];
      let totalDuration = 0;
      for (const buffer of audioBuffers) {
        segmentStarts.push(totalDuration);
        totalDuration += buffer.duration + paddingSeconds;
      }

      const canvasStream = canvas.captureStream(fps);
      const stream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...destination.stream.getAudioTracks()
      ]);

      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      const stopped = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: mimeType }));
        };
      });

      recorder.start(250);

      const startAt = audioContext.currentTime + 0.05;
      if (audioEnabled) {
        for (let i = 0; i < audioBuffers.length; i += 1) {
          const source = audioContext.createBufferSource();
          source.buffer = audioBuffers[i];
          source.connect(destination);
          source.start(startAt + segmentStarts[i]);
        }
      }

      const startPerf = performance.now();
      const totalMs = totalDuration * 1000;

      const render = () => {
        const elapsedMs = performance.now() - startPerf;
        const elapsedSec = elapsedMs / 1000;

        let segmentIndex = 0;
        for (let i = 0; i < segmentStarts.length; i += 1) {
          const start = segmentStarts[i];
          const end = start + audioBuffers[i].duration + paddingSeconds;
          if (elapsedSec >= start && elapsedSec < end) {
            segmentIndex = i;
            break;
          }
          if (elapsedSec >= end) {
            segmentIndex = Math.min(i + 1, segmentStarts.length - 1);
          }
        }

        const segStart = segmentStarts[segmentIndex];
        const segDuration = audioBuffers[segmentIndex].duration + paddingSeconds;
        const segProgress = segDuration > 0 ? (elapsedSec - segStart) / segDuration : 0;

        drawLessonFrame(
          ctx,
          avatar,
          LESSONS[segmentIndex],
          width,
          height,
          segProgress,
          segmentIndex,
          LESSONS.length
        );

        if (elapsedMs < totalMs) {
          requestAnimationFrame(render);
          return;
        }

        recorder.stop();
      };

      requestAnimationFrame(render);

      const blob = await stopped;
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      toast.success("Video generated. Download and upload to Instagram.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Video generation failed.";
      toast.error(message);
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Spanish Pronunciation Tutor</CardTitle>
          <CardDescription>
            An AI-generated tutor avatar plus quick pronunciation guides and a built-in voice player.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-[220px_1fr]">
            <div className="overflow-hidden rounded-lg border bg-white">
              <img
                src="/spanish-tutor.png"
                alt="AI generated Spanish tutor"
                className="h-full w-full object-cover"
              />
            </div>

            <div className="space-y-3">
              <div className="rounded-md border bg-white p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Voice settings</p>
                <p className="mt-1">
                  Voice: {selectedVoice ? `${selectedVoice.name} (${selectedVoice.lang})` : canSpeak ? "Loading..." : "Not supported"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={rate === "normal" ? "default" : "secondary"}
                    onClick={() => setRate("normal")}
                  >
                    Normal speed
                  </Button>
                  <Button
                    type="button"
                    variant={rate === "slow" ? "default" : "secondary"}
                    onClick={() => setRate("slow")}
                  >
                    Slow speed
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => (canSpeak ? window.speechSynthesis.cancel() : undefined)}
                    disabled={!canSpeak}
                  >
                    Stop
                  </Button>
                </div>
                {!canSpeak ? (
                  <p className="mt-3 text-xs text-slate-500">
                    Your browser does not support speech synthesis. Try Chrome, Edge, or Safari.
                  </p>
                ) : null}
              </div>

              <div className="rounded-md border bg-white p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Instagram video export (MVP)</p>
                <p className="mt-1">
                  Generates a vertical WebM clip with TTS audio for your 3 phrases.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" onClick={() => void handleGenerateInstagramVideo()} disabled={isGeneratingVideo}>
                    {isGeneratingVideo ? "Generating video..." : "Generate video"}
                  </Button>
                  {videoUrl ? (
                    <a
                      className="inline-flex h-10 items-center justify-center rounded-md bg-slate-200 px-4 text-sm font-medium text-slate-900 hover:bg-slate-300"
                      href={videoUrl}
                      download="spanish-pronunciation.webm"
                    >
                      Download .webm
                    </a>
                  ) : null}
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Note: Instagram prefers MP4/H.264. If needed, convert the downloaded WebM to MP4 before uploading.
                </p>
              </div>
            </div>
          </div>

          {videoUrl ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Video preview</p>
              <div className="mx-auto max-w-[360px] overflow-hidden rounded-lg border bg-slate-200">
                <video
                  className="h-full w-full"
                  src={videoUrl}
                  controls
                  playsInline
                  preload="metadata"
                />
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            {LESSONS.map((lesson) => (
              <Card key={lesson.phrase} className="bg-white">
                <CardHeader>
                  <CardTitle className="text-lg">{lesson.phrase}</CardTitle>
                  <CardDescription>Say like: {lesson.sayLike}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1 text-sm text-slate-700">
                    {lesson.tips.map((tip) => (
                      <p key={tip}>{tip}</p>
                    ))}
                  </div>
                  <Button
                    type="button"
                    onClick={() => speakPhrase(selectedVoice, lesson.phrase, actualRate)}
                    disabled={!canSpeak}
                  >
                    Play pronunciation
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
