# Spanish Pronunciation Tutor (Video MVP)

A React + TypeScript app that previews an AI-generated Spanish tutor and generates an Instagram-style vertical video clip for pronouncing:

- Hola
- Como estas
- Gracias

## Tech Stack

- React + TypeScript
- Tailwind CSS
- shadcn/ui-style components
- Canvas API (video frame renderer)
- Axios
- Sonner (toast notifications)
- Supabase Edge Functions (optional, for Hugging Face TTS)

## Project Structure

- `src/pages/PronunciationTutor.tsx` - tutor UI + video export
- `src/services/huggingFaceTtsService.ts` - calls Supabase Edge Function for TTS
- `supabase/functions/hf-tts/index.ts` - backend Hugging Face text-to-speech (Spanish audio)

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

## GitHub Pages Preview

This repo includes a GitHub Actions workflow that deploys the Vite build to GitHub Pages on every push to `main`.

## Cloud-Ready Checklist

- Supabase schema is versioned in `supabase/migrations/`.
- Frontend runtime config is env-driven (`.env.example`).
- Local secret files are git-ignored (`.env.local`, `.env.*`).
- Hugging Face keys are expected in Supabase Edge Function secrets.
- Vercel deployment config is included (`vercel.json`).

## Runtime Credentials (Security)

- No user-facing credential entry is required in production.
- No `localStorage` persistence.
- No hardcoded API keys.
- Hugging Face credentials are backend-only via Supabase function secrets.

Use `.env.example` as your single config template. Copy to `.env.local` and fill values:

```bash
cp .env.example .env.local
```

Then link the repo to your new Supabase project and push backend secrets to Supabase:

```bash
supabase link --project-ref "$SUPABASE_PROJECT_REF"

supabase secrets set \
  HF_API_TOKEN="$HF_API_TOKEN" \
  --project-ref "$SUPABASE_PROJECT_REF"
```

## Backend Flow

1. The frontend renders the tutor preview and lesson cards.
2. Supabase `hf-tts` generates Spanish speech audio via Hugging Face.
3. The frontend exports a vertical WebM video using Canvas + MediaRecorder (with audio if available).

## Supabase Setup

Deploy the edge functions and set secrets in Supabase:

```bash
supabase login
supabase link --project-ref "$SUPABASE_PROJECT_REF"
supabase secrets set HF_API_TOKEN=your_huggingface_token
supabase functions deploy hf-tts --no-verify-jwt
```

The frontend calls these endpoints:

- `POST https://<project-ref>.supabase.co/functions/v1/hf-tts`

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
supabase secrets set INSTAGRAM_ACCESS_TOKEN="$INSTAGRAM_ACCESS_TOKEN" --project-ref "$SUPABASE_PROJECT_REF"
```

8. In the app, use `Check Instagram Setup`.
   - If it succeeds, publishing is ready.
   - If it fails, the token still does not resolve the linked Page / IG business account.

## Notes

- The backend no longer depends on a public CORS proxy for production publishing.
- Keep long-lived tokens and API keys in Supabase secrets, not in the frontend.
- Rotate any secret key that was ever placed in local files or chat history.
