# Firebase → Supabase data copy

This folder copies **from** the live Firebase project `new-crm-8165a` **into** Supabase. It never writes back to Firebase.

## Prerequisites

1. Firebase service account JSON (Project settings → Service accounts). Save it outside git.
2. Supabase project URL + **service role** key.
3. Apply SQL migrations (`supabase db push` or `supabase start` then `db reset`).

```bash
cd scripts/migrate
npm install
set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\serviceAccount.json
set FIREBASE_PROJECT_ID=new-crm-8165a
set FIREBASE_STORAGE_BUCKET=new-crm-8165a.firebasestorage.app
set SUPABASE_URL=https://YOUR-PROJECT.supabase.co
set SUPABASE_SERVICE_ROLE_KEY=eyJ...
node export-and-import.mjs --auth --storage
```

Omit `--auth` or `--storage` to skip those steps. Firestore import runs unless `--skip-firestore` is passed.

## Auth passwords

`admin.createUser` does not copy Firebase password hashes. After `--auth`, users should reset passwords **or** follow [Supabase Firebase Auth import (scrypt)](https://supabase.com/docs/guides/resources/migrating-to-supabase/firebase-auth) using `firebase auth:export`.

Document IDs (employee ids, `documents/{uid}`, etc.) stay as the original Firebase UIDs. `profiles.auth_id` stores the new Supabase Auth UUID.

`scryptHashToSupabase` in the script is unused leftover for a future hash import; use the official Supabase importer for production passwords.
