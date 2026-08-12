-- ============================================================
-- MIGRACIÓN PENDIENTE — FinanzasPro
-- (WhatsApp + abonos + módulo de Créditos/Financiamiento)
--
-- Cómo ejecutar:
--   1. https://supabase.com/dashboard → tu proyecto
--   2. Menú lateral → SQL Editor → New query
--   3. Pegar TODO este archivo → botón RUN
-- Es idempotente: se puede ejecutar varias veces sin dañar nada.
-- ============================================================

-- 1) WhatsApp del cliente (envío de facturas por wa.me)
alter table public.clientes add column if not exists whatsapp text;

-- 2) Abonos (pagos parciales) en notas de pago
--    Sin esta columna, el botón "Confirmar pago" de CXC falla.
alter table public.notas_pago add column if not exists abonado numeric not null default 0;

-- 3) Nueva categoría de gastos: financiamiento (cuotas de créditos)
alter table public.gastos drop constraint if exists gastos_categoria_check;
alter table public.gastos add constraint gastos_categoria_check
  check (categoria in ('tecnologia', 'servicios', 'oficina', 'impuestos', 'personal', 'financiamiento', 'otro'));

-- 4) Módulo de Créditos: giros de tarjeta, préstamos bancarios y de personas
create table if not exists public.creditos (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null default 'tarjeta' check (tipo in ('tarjeta', 'banco', 'persona', 'otro')),
  acreedor       text not null,
  descripcion    text,
  monto_total    decimal(12,2) not null,
  moneda         text default 'USD' check (moneda in ('USD', 'BS')),
  num_cuotas     integer not null default 1 check (num_cuotas >= 1),
  monto_cuota    decimal(12,2),
  tasa_interes   decimal(6,2),
  fecha_inicio   date not null default current_date,
  dia_pago       integer check (dia_pago between 1 and 31),
  abonado        decimal(12,2) not null default 0,
  cuotas_pagadas integer not null default 0,
  estado         text default 'activo' check (estado in ('activo', 'pagado', 'cancelado')),
  notas          text,
  user_id        uuid references auth.users(id) on delete cascade,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create table if not exists public.creditos_pagos (
  id           uuid primary key default gen_random_uuid(),
  credito_id   uuid not null references public.creditos(id) on delete cascade,
  numero_cuota integer,
  monto        decimal(12,2) not null,
  moneda       text default 'USD',
  fecha_pago   date not null default current_date,
  metodo_pago  text,
  referencia   text,
  gasto_id     uuid references public.gastos(id) on delete set null,
  user_id      uuid references auth.users(id) on delete cascade,
  created_at   timestamptz default now()
);

-- RLS: cada usuario solo ve sus créditos
alter table public.creditos enable row level security;
alter table public.creditos_pagos enable row level security;

drop policy if exists "creditos_owner" on public.creditos;
create policy "creditos_owner" on public.creditos
  for all using (auth.uid() = user_id);

drop policy if exists "creditos_pagos_owner" on public.creditos_pagos;
create policy "creditos_pagos_owner" on public.creditos_pagos
  for all using (auth.uid() = user_id);

-- Índices y trigger de updated_at
create index if not exists idx_creditos_estado on public.creditos(estado);
create index if not exists idx_creditos_pagos_credito on public.creditos_pagos(credito_id);

drop trigger if exists trg_creditos_updated_at on public.creditos;
create trigger trg_creditos_updated_at
  before update on public.creditos
  for each row execute function public.actualizar_updated_at();

-- 5) Refrescar el caché de PostgREST (evita "column not found in schema cache")
notify pgrst, 'reload schema';

-- 6) Verificación: debe devolver 4 filas
select table_name, column_name
from information_schema.columns
where (table_name = 'clientes' and column_name = 'whatsapp')
   or (table_name = 'notas_pago' and column_name = 'abonado')
   or (table_name = 'creditos' and column_name = 'id')
   or (table_name = 'creditos_pagos' and column_name = 'id');
