# Business OS (Supabase clone)

This folder is a **Supabase** copy of the live Firebase ERP in `../new-crm`. Do not deploy Firebase from here. Employees keep using the Firebase app until you cut over.

## Stack

- React + Vite portals (root, `admin-portal`, `employee-portal`, `client-portal`)
- Supabase Auth, Postgres (`data jsonb` tables), Storage, Edge Functions
- Shared Firestore-shaped client in `shared/supabase/` (Vite aliases `firebase/*`)

## Setup

1. Create a Supabase project (or `npx supabase start` locally).
2. `npx supabase db push` / `npx supabase migration up` to apply `supabase/migrations`.
3. Copy `.env.example` to each portal `.env` / `.env.development` and set:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

4. `npm install` in the repo root and in each portal.
5. Deploy functions: `npx supabase functions deploy create-user ask-admin-assistant send-workflow-email`
6. Set secrets: `GEMINI_API_KEY`, optional `RESEND_API_KEY` / SMTP vars.
7. Database webhook (Dashboard): `workflow_runs` INSERT → `send-workflow-email`.
8. Enable Google provider in Auth if you use Google login.

## Run

```
npm run dev                 # root (default Vite port)
cd admin-portal && npm run dev      # :3001
cd employee-portal && npm run dev   # :3002
cd client-portal && npm run dev     # :3003
```

## Import live Firebase data

See [scripts/migrate/README.md](scripts/migrate/README.md). One-way copy only.

## FCM

Push via FCM is not ported. In-app notifications still write to `notification_items`.
