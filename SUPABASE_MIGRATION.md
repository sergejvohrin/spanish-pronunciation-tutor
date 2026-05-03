# Supabase migration checklist

This repo is meant to be linked to its own Supabase project so it does not share secrets, tables, or functions with your other apps.

## 1) Create a new Supabase project

- Create a new project in the Supabase dashboard.
- Copy the project ref, project URL, and `anon` (publishable) key.

## 2) Create local config file

Copy the template and fill in values:

```bash
cp .env.example .env.local
```

Set at least:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_ACCESS_TOKEN`

Optional (only if you need direct DB access for scripts/tools):

- `DATABASE_URL`

## 3) Link this repo to the new project

```bash
supabase login
supabase link --project-ref "$SUPABASE_PROJECT_REF"
```

## 4) Apply database migrations

```bash
supabase db push
```

## 5) Deploy edge functions

```bash
supabase functions deploy hf-translation --no-verify-jwt
supabase functions deploy hf-image --no-verify-jwt
supabase functions deploy hf-tts --no-verify-jwt
supabase functions deploy media-pipeline --no-verify-jwt
supabase functions deploy refresh-instagram-token --no-verify-jwt
supabase functions deploy backend-health --no-verify-jwt
```

## 6) Set Supabase secrets (server-side)

Set what you actually use (you can omit Instagram/ImgBB if you are only using the tutor):

```bash
supabase secrets set \
  HF_API_TOKEN="$HF_API_TOKEN" \
  HF_MODEL="$HF_MODEL" \
  HF_IMAGE_MODEL="$HF_IMAGE_MODEL" \
  HF_TTS_MODEL="$HF_TTS_MODEL" \
  IMGBB_API_KEY="$IMGBB_API_KEY" \
  INSTAGRAM_ACCESS_TOKEN="$INSTAGRAM_ACCESS_TOKEN" \
  INSTAGRAM_BUSINESS_ACCOUNT_ID="$INSTAGRAM_BUSINESS_ACCOUNT_ID" \
  META_APP_ID="$META_APP_ID" \
  META_APP_SECRET="$META_APP_SECRET" \
  TOKEN_ROTATION_SECRET="$TOKEN_ROTATION_SECRET"
```

## 7) Update GitHub repo variables/secrets

In GitHub for `spanish-pronunciation-tutor`:

Repository variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_PROJECT_REF`

Repository secrets:

- `SUPABASE_ACCESS_TOKEN`
- `TOKEN_ROTATION_SECRET`

