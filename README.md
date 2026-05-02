# Multilingual Word Translation Instagram Post Generator

A React + TypeScript app that generates square translation posts (English, Spanish, Catalan), previews them using Canvas in-memory, uploads to ImgBB, and publishes to Instagram.

## Tech Stack

- React + TypeScript
- Tailwind CSS
- shadcn/ui-style components
- Canvas API
- Axios
- Sonner (toast notifications)
- Supabase Edge Functions (backend secret handling for Hugging Face)

## Project Structure

- `src/services/translationService.ts` - random translation data
- `src/services/huggingFaceService.ts` - calls Supabase Edge Function for AI translation generation
- `src/services/mediaPipelineService.ts` - save/publish/readiness calls through Supabase Edge Function
- `src/utils/canvasUtils.ts` - Canvas image composition
- `src/pages/Index.tsx` - main UI page
- `supabase/functions/hf-translation/index.ts` - backend Hugging Face translation integration
- `supabase/functions/hf-image/index.ts` - backend Hugging Face image generation
- `supabase/functions/media-pipeline/index.ts` - backend ImgBB upload, Instagram publish, readiness check, Supabase logging

## Local Run

1. Install dependencies:

```bash
npm install
```

2. Start dev server:

```bash
npm run dev
```

3. Open app URL from Vite output.

## Cloud-Ready Checklist

- Supabase schema is versioned in `supabase/migrations/20260225_create_post_logs.sql`.
- Frontend runtime config is env-driven (`.env.example`).
- Local secret files are git-ignored (`.env.local`, `.env.*`).
- Instagram, ImgBB, and Hugging Face keys are expected in Supabase Edge Function secrets.
- Vercel deployment config is included (`vercel.json`).

## Runtime Credentials (Security)

- No user-facing credential entry is required in production.
- No `localStorage` persistence.
- No hardcoded API keys.
- Hugging Face, ImgBB, and Instagram credentials are backend-only via Supabase function secrets.

Use `.env.example` as your single config template. Copy to `.env.local` and fill values:

```bash
cp .env.example .env.local
```

Then push backend secrets to Supabase:

```bash
supabase secrets set \
  HF_API_TOKEN="$HF_API_TOKEN" \
  HF_MODEL="$HF_MODEL" \
  HF_IMAGE_MODEL="$HF_IMAGE_MODEL" \
  IMGBB_API_KEY="$IMGBB_API_KEY" \
  INSTAGRAM_ACCESS_TOKEN="$INSTAGRAM_ACCESS_TOKEN" \
  INSTAGRAM_BUSINESS_ACCOUNT_ID="$INSTAGRAM_BUSINESS_ACCOUNT_ID" \
  META_APP_ID="$META_APP_ID" \
  META_APP_SECRET="$META_APP_SECRET" \
  TOKEN_ROTATION_SECRET="$TOKEN_ROTATION_SECRET" \
  --project-ref rfaaaszgeuljjczzdrcz
```

`INSTAGRAM_BUSINESS_ACCOUNT_ID` is optional. If it is set, the backend skips Facebook Page discovery and publishes directly to that IG business account.

## Backend Flow

1. The frontend generates the preview image locally with Canvas.
2. Supabase Edge Functions generate AI translations and AI Spain-themed images.
3. Supabase `media-pipeline` uploads the final image to ImgBB.
4. Supabase `media-pipeline` checks Instagram readiness or publishes story + feed post.
5. Save and publish events are logged to `public.post_logs`.

## Supabase Setup

Deploy the edge functions and set secrets in Supabase:

```bash
supabase login
supabase link --project-ref rfaaaszgeuljjczzdrcz
supabase secrets set HF_API_TOKEN=your_huggingface_token HF_MODEL=google/flan-t5-base HF_IMAGE_MODEL=black-forest-labs/FLUX.1-schnell IMGBB_API_KEY=your_imgbb_api_key INSTAGRAM_ACCESS_TOKEN=your_long_lived_instagram_token
supabase functions deploy hf-translation --no-verify-jwt
supabase functions deploy hf-image --no-verify-jwt
supabase functions deploy media-pipeline --no-verify-jwt
supabase functions deploy refresh-instagram-token --no-verify-jwt
```

The frontend calls these endpoints:

- `POST https://<project-ref>.supabase.co/functions/v1/hf-translation`
- `POST https://<project-ref>.supabase.co/functions/v1/hf-image`
- `POST https://<project-ref>.supabase.co/functions/v1/media-pipeline`
- `POST https://<project-ref>.supabase.co/functions/v1/refresh-instagram-token`

## Automatic Instagram Token Rotation

Meta does not provide a truly never-expiring user token for this publishing flow. The supported hands-off path is to keep a valid long-lived token in Supabase and refresh it automatically before it expires.

This repo now uses:

1. Supabase function `refresh-instagram-token`
   - reads `INSTAGRAM_ACCESS_TOKEN`, `META_APP_ID`, and `META_APP_SECRET` from Supabase secrets
   - requests a fresh long-lived token from Meta

2. GitHub Actions workflow `refresh-instagram-token.yml`
   - runs every Monday at 05:00 UTC
   - calls the refresh function with `TOKEN_ROTATION_SECRET`
   - writes the returned token back into Supabase secret `INSTAGRAM_ACCESS_TOKEN`

Required GitHub repository secret:

- `TOKEN_ROTATION_SECRET`

Required GitHub repository secret already used by the workflow:

- `SUPABASE_ACCESS_TOKEN`

Required GitHub repository variables already used by the workflow:

- `SUPABASE_PROJECT_REF`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## Image Composition

Canvas generates JPEG (`quality: 0.9`) in-memory from:
- Pexels background image
- Black overlay: `rgba(0, 0, 0, 0.4)`
- Centered white text, bold Inter 48px, line-height 60

## Instagram Setup You Still Need To Complete

This cannot be finished from code alone. The publishing token must resolve a Facebook Page that is linked to the Instagram Professional account.

1. Open your Meta apps dashboard:
   - [https://developers.facebook.com/apps](https://developers.facebook.com/apps)
2. Open your Facebook Page list:
   - [https://www.facebook.com/pages](https://www.facebook.com/pages)
3. On the correct Facebook Page, click:
   - `Settings`
   - `Linked accounts`
   - `Instagram`
   - `Connect account`
4. In the Instagram mobile app, confirm:
   - `Settings and privacy`
   - `Account type and tools`
   - account type is `Business` or `Creator`
5. Generate a fresh user token in Graph API Explorer:
   - [https://developers.facebook.com/tools/explorer/](https://developers.facebook.com/tools/explorer/)
   - select your app
   - click `Generate Access Token`
   - include `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `business_management`
6. Exchange that token for a long-lived token:

```bash
curl -G "https://graph.facebook.com/v18.0/oauth/access_token" \
  --data-urlencode "grant_type=fb_exchange_token" \
  --data-urlencode "client_id=$META_APP_ID" \
  --data-urlencode "client_secret=$META_APP_SECRET" \
  --data-urlencode "fb_exchange_token=$INSTAGRAM_SHORT_LIVED_TOKEN"
```

7. Save the long-lived token into Supabase:

```bash
supabase secrets set INSTAGRAM_ACCESS_TOKEN="$INSTAGRAM_ACCESS_TOKEN" --project-ref rfaaaszgeuljjczzdrcz
```

8. In the app, use `Check Instagram Setup`.
   - If it succeeds, publishing is ready.
   - If it fails, the token still does not resolve the linked Page / IG business account.

## Notes

- The backend no longer depends on a public CORS proxy for production publishing.
- Keep long-lived tokens and API keys in Supabase secrets, not in the frontend.
- Rotate any secret key that was ever placed in local files or chat history.
