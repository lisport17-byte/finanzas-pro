-- =====================================================
-- FASE 1: Notificaciones Web Push — FinanzasPro
-- Ejecutar en Supabase → SQL Editor (una sola vez)
-- =====================================================

-- Tabla de suscripciones push (un registro por dispositivo)
CREATE TABLE IF NOT EXISTS public.push_suscripciones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  dispositivo TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_user ON public.push_suscripciones(user_id);

-- RLS: cada usuario solo ve/gestiona sus propias suscripciones
ALTER TABLE public.push_suscripciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_select" ON public.push_suscripciones
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "push_insert" ON public.push_suscripciones
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_update" ON public.push_suscripciones
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "push_delete" ON public.push_suscripciones
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- CRON: ejecutar la Edge Function todos los días 8:00 am
-- (hora Venezuela = 12:00 UTC)
-- REEMPLAZA 'TU_CRON_SECRET' por el mismo secreto que
-- configures en la Edge Function (paso 3 de la guía).
-- =====================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'recordatorios-diarios',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://qrevajldlzskbigjebmo.supabase.co/functions/v1/enviar-recordatorios',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'TU_CRON_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Para verificar que quedó programado:
-- SELECT * FROM cron.job;
-- Para borrarlo si algo sale mal:
-- SELECT cron.unschedule('recordatorios-diarios');
