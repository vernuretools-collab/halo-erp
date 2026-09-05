# Deprecated Firebase Cloud Functions

This clone uses **Supabase Edge Functions** in `../supabase/functions/`:

- `create-user` — admin creates client/employee/admin without switching session
- `ask-admin-assistant` — Gemini assistant
- `send-workflow-email` — workflow SMTP/Resend (wire a Database Webhook on `workflow_runs`)

SQL triggers replace `onUserCreated`, `onLeadWon`, announcement fan-out, and `aggregateHealthScores` (enable pg_cron using `00002_cron_health_scores.sql`).
