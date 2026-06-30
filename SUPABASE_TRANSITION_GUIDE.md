# Lovedogs 360 Supabase Transition Guide

This guide moves Lovedogs 360 away from Railway in controlled phases.

## Current Architecture

- The mobile app calls a REST API through `EXPO_PUBLIC_API_URL`.
- `EXPO_PUBLIC_API_URL` now points to the Supabase Edge Function API.
- Supabase Postgres stores the fresh-start app data.
- Images are uploaded from the app to organized Supabase Storage buckets.
- The old FastAPI backend in `backend/main.py` remains as the migration reference until every endpoint is ported.

## Recommended Migration Order

1. Move the database from Railway Postgres to Supabase Postgres. Done for the fresh-start project.
2. Move image uploads to organized Supabase Storage buckets. Done.
3. Point the app at the Supabase Edge Function API. Done locally.
4. Rewrite the FastAPI endpoints as Supabase Edge Functions in stages. In progress.
5. Rebuild the Android `.aab` after the required production flows are migrated and verified.

## What I Need From You

Provide these values privately, not in Git:

- Supabase Project URL, for example `https://your-project-ref.supabase.co`
- Supabase anon or publishable key
- Supabase pooled database connection string
- Supabase service role key, only for backend/server-side operations
- Railway database export, or the Railway database connection string so we can export it. If starting fresh, skip this.
- Final API endpoint that the app should call after Railway is removed

## Supabase Database Setup

In Supabase:

1. Open **Project Settings > Database**.
2. Copy the pooled connection string.
3. Set it as backend `DATABASE_URL`.

Expected shape:

```text
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@<supabase-pooler-host>:6543/postgres?sslmode=require
```

For this new project, you confirmed we can start fresh. The first fresh-start migrations are in `supabase/migrations/`.

## Data Migration

Export from Railway:

```bash
pg_dump "$RAILWAY_DATABASE_URL" --no-owner --no-acl --format=custom --file=lovedogs360-railway.dump
```

Restore to Supabase:

```bash
pg_restore --clean --if-exists --no-owner --no-acl --dbname "$SUPABASE_DATABASE_URL" lovedogs360-railway.dump
```

After restore, verify these core tables have data:

- `users`
- `dogs`
- `services`
- `orders`
- `events`
- `registrations`
- `case_reports`
- `community_messages`
- `scorecard_questions`
- `scorecard_surveys`

Skip this section when starting fresh.

## Storage Setup

Run [supabase/storage_buckets.sql](supabase/storage_buckets.sql) in the Supabase SQL Editor.

The app is configured for these buckets:

- `pet-identity`
- `case-evidence`
- `service-images`
- `event-images`
- `support-attachments`

Important: the current app uploads directly with the public anon key. The included policies allow this for compatibility. Later, we should tighten this by moving uploads through backend or Edge Function endpoints.

## Frontend Build Variables

Set these before web/native builds:

```text
EXPO_PUBLIC_API_URL=https://your-api-domain.example.com
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_or_publishable_key
EXPO_PUBLIC_SUPABASE_PET_IDENTITY_BUCKET=pet-identity
EXPO_PUBLIC_SUPABASE_CASE_EVIDENCE_BUCKET=case-evidence
EXPO_PUBLIC_SUPABASE_SERVICE_IMAGES_BUCKET=service-images
EXPO_PUBLIC_SUPABASE_EVENT_IMAGES_BUCKET=event-images
EXPO_PUBLIC_SUPABASE_SUPPORT_ATTACHMENTS_BUCKET=support-attachments
```

For a future full Supabase Edge Functions migration, `EXPO_PUBLIC_API_URL` can become:

```text
https://<project-ref>.functions.supabase.co/api
```

For this project:

```text
EXPO_PUBLIC_API_URL=https://dnuwenqsyurjgmyurttj.functions.supabase.co/api
```

## Edge Function Variables

Set these in Supabase Edge Function secrets. Supabase reserves names that begin with `SUPABASE_`, so this repo uses `LD_SUPABASE_*` aliases for manually uploaded project keys:

```text
LD_SUPABASE_URL=https://your-project-ref.supabase.co
LD_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
LD_SUPABASE_SECRET_KEY=your_supabase_secret_or_service_role_key
GOOGLE_CLIENT_ID=<web client id>
GOOGLE_IOS_CLIENT_ID=<ios client id>
GOOGLE_ANDROID_CLIENT_ID=<android client id>
PESAPAL_CONSUMER_KEY=<pesapal key>
PESAPAL_CONSUMER_SECRET=<pesapal secret>
PESAPAL_CALLBACK_URL=https://your-api-domain.example.com/pesapal/callback
PESAPAL_IPN_URL=https://your-api-domain.example.com/pesapal/ipn
```

## Edge Functions Status

The migrated API is here:

```text
supabase/functions/api/index.ts
```

Stage 1 endpoints:

- `GET /health`
- `POST /register`
- `POST /token`
- `POST /auth/google`
- `GET /users/me`
- `PUT /users/me`
- `DELETE /users/me`

Stage 2 endpoints:

- dogs and health records
- service/product listing, creation, editing, and form fields
- basic order creation, my orders, wallet summary
- cases, comments, likes, and safe empty match responses
- events, registrations, saved events, and safe empty form/response responses
- support tickets
- announcements, notifications, spotlight
- community messages, direct messages, online users, heartbeat
- exchange rates and app version defaults

Stage 3 endpoints:

- Pesapal marketplace payment initiation, callback, IPN, and status polling
- Pesapal event registration payment initiation and status polling
- free event registration ticket generation
- admin ticket verification and check-in
- admin users, orders, withdrawals, services, approvals, dogs, events, support, community, pins, analytics
- admin notification campaign options, preview, send, and history
- seller withdrawal request/listing and admin payout completion

Still not fully migrated:

- receipt PDF generation
- scorecards/reporting
- AI pet matching and wellness advisor logic
- CSV export
- live observations/program journey details

Important payment note: Pesapal endpoints are deployed, but a real low-value live checkout should be tested in Supabase before publishing a production `.aab`.

Deploy commands after Supabase CLI login:

```bash
npm run supabase:link
npm run supabase:db:push
npm run supabase:functions:deploy
```

The CLI must be authenticated first:

```bash
npx supabase login
```

Alternatively, set `SUPABASE_ACCESS_TOKEN` in your shell before running the commands.

## Verification Checklist

Before building the `.aab`, verify:

- Login with email works.
- Google login works.
- User profile loads.
- Pet identity image upload works.
- Case report image upload works.
- Service/product image upload works.
- Event poster upload works.
- Support ticket attachment upload works.
- Marketplace, events, cases, community, admin dashboard, and scorecard pages load.
- Pesapal callback/IPN URLs point to the new API host, not Railway.
- `EXPO_PUBLIC_API_URL` does not contain a Railway URL.

## Android Build

After the API and Supabase values are final:

```bash
cd frontend
eas build --platform android --profile production
```

Upload the resulting `.aab` to Google Play.
