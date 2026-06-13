-- Activity logs audit trail
-- Run this in Supabase SQL Editor after RLS helper functions exist.

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  entity_name TEXT,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
ON public.activity_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_user_id
ON public.activity_logs (actor_user_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_action
ON public.activity_logs (action);

CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_type
ON public.activity_logs (entity_type);

CREATE INDEX IF NOT EXISTS idx_activity_logs_entity
ON public.activity_logs (entity_type, entity_id);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read all activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Authenticated insert own activity_logs" ON public.activity_logs;

CREATE POLICY "Admin read all activity_logs"
ON public.activity_logs
FOR SELECT
USING (public.get_user_role() IN ('super_admin', 'admin'));

CREATE POLICY "Authenticated insert own activity_logs"
ON public.activity_logs
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND actor_user_id = auth.uid());
