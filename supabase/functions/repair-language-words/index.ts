import postgres from "npm:postgres@3.4.5";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-seed-secret"
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json"
    }
  });
}

function getDatabaseUrl(): string {
  const connectionString = (Deno.env.get("DATABASE_POOLER_URL") ?? "").trim();
  if (!connectionString) {
    throw new Error("Missing DATABASE_POOLER_URL secret.");
  }
  return connectionString;
}

type RowRecord = {
  global_position: number;
  published_to: string | null;
};

function extractTimestamp(value: string, channel: "post" | "story"): string | null {
  const entries = value
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  for (const entry of entries) {
    if (!entry.startsWith(`${channel}:`)) {
      continue;
    }
    return entry.slice(channel.length + 1).trim() || null;
  }

  return null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const expectedSecret = (Deno.env.get("TOKEN_ROTATION_SECRET") ?? "").trim();
  const providedSecret = (request.headers.get("x-seed-secret") ?? "").trim();
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const sql = postgres(getDatabaseUrl(), {
    ssl: "require",
    prepare: false,
    max: 1,
    idle_timeout: 5
  });

  try {
    await sql.begin(async (tx) => {
      await tx`alter table public.language_words add column if not exists published_post_at timestamptz null`;
      await tx`alter table public.language_words add column if not exists published_story_at timestamptz null`;

      const rows = (await tx<RowRecord[]>`
        select global_position, published_to
        from public.language_words
      `) as unknown as RowRecord[];

      for (const row of rows) {
        const publishedTo = (row.published_to ?? "").trim();
        if (!publishedTo) {
          continue;
        }

        const postAt = extractTimestamp(publishedTo, "post");
        const storyAt = extractTimestamp(publishedTo, "story");

        await tx`
          update public.language_words
          set
            published_post_at = coalesce(published_post_at, ${postAt}),
            published_story_at = coalesce(published_story_at, ${storyAt})
          where global_position = ${row.global_position}
        `;
      }
    });

    return jsonResponse({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown repair error";
    return jsonResponse({ error: message }, 500);
  } finally {
    await sql.end({ timeout: 5 }).catch(() => undefined);
  }
});
