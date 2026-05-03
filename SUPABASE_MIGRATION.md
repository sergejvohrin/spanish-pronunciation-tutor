# Supabase migration checklist

This repo is meant to be linked to its own Supabase project so it does not share secrets, tables, or functions with your other apps.

## 1) Create a new Supabase project

- Create a new project in the Supabase dashboard.
- Copy the project ref, project URL, and `anon` (publishable) key.

For your dedicated project:

- Project ref: `dwcluddjjximecioomwu`
- Project URL: `https://dwcluddjjximecioomwu.supabase.co`

## 2) Create local config file

Copy the template and fill in values:

```bash
cp .env.example .env.local
```

Set at least:

- `VITE_SUPABASE_URL` (use `https://dwcluddjjximecioomwu.supabase.co`)
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_PROJECT_REF` (use `dwcluddjjximecioomwu`)
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
supabase functions deploy hf-tts --no-verify-jwt
```

## 6) Set Supabase secrets (server-side)

If you are only using the tutor, you only need Hugging Face TTS:

```bash
supabase secrets set \
  HF_API_TOKEN="$HF_API_TOKEN" \
  HF_TTS_MODEL="$HF_TTS_MODEL"
```

## 7) Update GitHub repo variables/secrets

In GitHub for `spanish-pronunciation-tutor`:

Repository variables:

- `VITE_SUPABASE_URL` (set to `https://dwcluddjjximecioomwu.supabase.co`)
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_PROJECT_REF` (set to `dwcluddjjximecioomwu`)
- `HF_TTS_MODEL` (optional, defaults to `facebook/mms-tts-spa` fallback)

Repository secrets:

- `SUPABASE_ACCESS_TOKEN`
- `HF_API_TOKEN`
