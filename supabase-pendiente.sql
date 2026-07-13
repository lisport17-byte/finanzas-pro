-- ============================================================
-- MIGRACIÓN PENDIENTE — FinanzasPro (facturación + WhatsApp + abonos)
-- Cómo ejecutar:
--   1. https://supabase.com/dashboard → tu proyecto
--   2. Menú lateral → SQL Editor → New query
--   3. Pegar TODO este archivo → botón RUN
-- Es idempotente: se puede ejecutar varias veces sin dañar nada.
-- ============================================================

-- 1) WhatsApp del cliente (envío de facturas por wa.me)
alter table clientes add column if not exists whatsapp text;
comment on column clientes.whatsapp is 'Número de WhatsApp en formato internacional (ej: +584121234567)';

-- 2) Abonos (pagos parciales) en notas de pago
alter table notas_pago add column if not exists abonado numeric not null default 0;
comment on column notas_pago.abonado is 'Monto ya abonado (pagos parciales). La nota pasa a pagada cuando abonado >= monto.';

-- 3) Verificación: debe devolver las 2 columnas nuevas
select table_name, column_name, data_type
from information_schema.columns
where (table_name = 'clientes' and column_name = 'whatsapp')
   or (table_name = 'notas_pago' and column_name = 'abonado');
