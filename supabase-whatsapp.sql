-- ============================================================
-- Campo WhatsApp en clientes (envío de facturas por wa.me)
-- Ejecutar UNA VEZ en Supabase: SQL Editor → pegar → Run
-- ============================================================

alter table clientes add column if not exists whatsapp text;

comment on column clientes.whatsapp is 'Número de WhatsApp en formato internacional (ej: +584121234567)';
