-- Schedule role-scoped notification emails via Supabase Cron.
-- Safe to rerun. The cron job name is stable and cron.schedule upserts it.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- Project URL is not secret, but keeping it in Vault keeps the cron command
-- portable and avoids hardcoding values inside cron.job command text.
SELECT vault.create_secret('https://jkzjqzskrzcdmahrikwm.supabase.co', 'kima_project_url')
WHERE NOT EXISTS (
  SELECT 1 FROM vault.decrypted_secrets WHERE name = 'kima_project_url'
);

-- IMPORTANT:
-- Do not commit EMAIL_JOB_SECRET into this file.
-- Before running this schedule script, create the Vault secret manually in
-- Supabase SQL Editor with your actual EMAIL_JOB_SECRET:
--
-- SELECT vault.create_secret('PASTE_EMAIL_JOB_SECRET_HERE', 'kima_email_job_secret');
--
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'kima_email_job_secret'
  ) THEN
    RAISE EXCEPTION 'Missing Vault secret kima_email_job_secret. Create it first with vault.create_secret(...).';
  END IF;
END $$;

SELECT cron.schedule(
  'send-kima-notification-emails',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'kima_project_url')
      || '/functions/v1/send-notification-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-email-job-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'kima_email_job_secret')
    ),
    body := jsonb_build_object('limit', 100),
    timeout_milliseconds := 30000
  );
  $$
);
