-- ============================================================
-- Abonos (pagos parciales) en notas de pago
-- Ejecutar UNA VEZ en Supabase: SQL Editor → pegar → Run
-- ============================================================

alter table notas_pago add column if not exists abonado numeric not null default 0;

comment on column notas_pago.abonado is 'Monto ya abonado (pagos parciales). La nota pasa a pagada cuando abonado >= monto.';
