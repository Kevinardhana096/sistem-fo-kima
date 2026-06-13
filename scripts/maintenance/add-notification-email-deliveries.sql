-- Delivery log for role-scoped email notifications.
-- Safe to rerun.

CREATE TABLE IF NOT EXISTS public.notification_email_deliveries (
  id BIGSERIAL PRIMARY KEY,
  notification_key TEXT NOT NULL,
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_role TEXT NOT NULL,
  notification_type TEXT,
  notification_code TEXT,
  severity TEXT,
  target_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT,
  provider_message_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (notification_key, recipient_user_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_email_deliveries_recipient
ON public.notification_email_deliveries (recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_email_deliveries_status
ON public.notification_email_deliveries (status, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_email_deliveries_notification_key
ON public.notification_email_deliveries (notification_key);

ALTER TABLE public.notification_email_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read notification email deliveries" ON public.notification_email_deliveries;
DROP POLICY IF EXISTS "Users read own notification email deliveries" ON public.notification_email_deliveries;

CREATE POLICY "Admins read notification email deliveries"
ON public.notification_email_deliveries
FOR SELECT
USING ((auth.jwt() -> 'user_metadata' ->> 'role') IN ('super_admin', 'admin'));

CREATE POLICY "Users read own notification email deliveries"
ON public.notification_email_deliveries
FOR SELECT
USING (recipient_user_id = auth.uid());

COMMENT ON TABLE public.notification_email_deliveries IS
'Tracks email notification delivery per notification key and auth user to prevent duplicate sends.';
