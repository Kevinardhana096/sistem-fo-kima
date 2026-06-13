-- Notification read/resolved state per user
-- Run this in Supabase SQL Editor after RLS helper functions exist.

CREATE TABLE IF NOT EXISTS public.notification_states (
  id BIGSERIAL PRIMARY KEY,
  notification_key TEXT NOT NULL,
  actor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (notification_key, actor_user_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_states_actor_user_id
ON public.notification_states (actor_user_id);

CREATE INDEX IF NOT EXISTS idx_notification_states_notification_key
ON public.notification_states (notification_key);

CREATE INDEX IF NOT EXISTS idx_notification_states_resolved_at
ON public.notification_states (resolved_at);

ALTER TABLE public.notification_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own notification_states" ON public.notification_states;
DROP POLICY IF EXISTS "Admin read all notification_states" ON public.notification_states;

CREATE POLICY "Users manage own notification_states"
ON public.notification_states
FOR ALL
USING (actor_user_id = auth.uid())
WITH CHECK (actor_user_id = auth.uid());

CREATE POLICY "Admin read all notification_states"
ON public.notification_states
FOR SELECT
USING (public.get_user_role() IN ('super_admin', 'admin'));
