-- =====================================================
-- FINANZASPRO - Schema de Base de Datos
-- Ejecuta este SQL en Supabase -> SQL Editor
-- =====================================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLA: clientes
-- =====================================================
CREATE TABLE IF NOT EXISTS public.clientes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre        TEXT NOT NULL,
  email         TEXT,
  telefono      TEXT,
  empresa       TEXT,
  pais          TEXT DEFAULT 'Venezuela',
  notas         TEXT,
  estado        TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'suspendido', 'inactivo')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- =====================================================
-- TABLA: tipos_servicio (catálogo)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.tipos_servicio (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre          TEXT NOT NULL,
  descripcion     TEXT,
  precio_base     DECIMAL(10,2) DEFAULT 0,
  moneda          TEXT DEFAULT 'USD',
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar tipos de servicio predeterminados (se insertarán al primer login)
-- Página Web, Bot, Agente IA, Software, Automatización

-- =====================================================
-- TABLA: servicios_clientes
-- =====================================================
CREATE TABLE IF NOT EXISTS public.servicios_clientes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id        UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo_servicio_id  UUID REFERENCES public.tipos_servicio(id) ON DELETE SET NULL,
  nombre_servicio   TEXT NOT NULL,
  descripcion       TEXT,
  precio            DECIMAL(10,2) NOT NULL DEFAULT 0,
  moneda            TEXT DEFAULT 'USD' CHECK (moneda IN ('USD', 'BS')),
  tipo_renovacion   TEXT NOT NULL DEFAULT 'mensual' CHECK (tipo_renovacion IN ('mensual', 'anual')),
  fecha_inicio      DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_renovacion  DATE NOT NULL,
  estado            TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'suspendido', 'cancelado')),
  alerta_dias       INTEGER DEFAULT 5, -- días antes de vencimiento para alertar
  notas             TEXT,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: notas_pago (cuentas por cobrar)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.notas_pago (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero              TEXT, -- número de nota ej: NP-2025-001
  cliente_id          UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  servicio_cliente_id UUID REFERENCES public.servicios_clientes(id) ON DELETE SET NULL,
  concepto            TEXT NOT NULL,
  monto               DECIMAL(10,2) NOT NULL,
  moneda              TEXT DEFAULT 'USD' CHECK (moneda IN ('USD', 'BS')),
  fecha_emision       DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento   DATE NOT NULL,
  estado              TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagada', 'vencida', 'anulada')),
  notas               TEXT,
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: ingresos
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ingresos (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id        UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  nota_pago_id      UUID REFERENCES public.notas_pago(id) ON DELETE SET NULL,
  concepto          TEXT NOT NULL,
  monto             DECIMAL(10,2) NOT NULL,
  moneda            TEXT DEFAULT 'USD' CHECK (moneda IN ('USD', 'BS')),
  tasa_cambio       DECIMAL(10,4), -- tasa BCV si pagó en Bs
  monto_usd         DECIMAL(10,2), -- equivalente en USD
  fecha_pago        DATE NOT NULL DEFAULT CURRENT_DATE,
  metodo_pago       TEXT DEFAULT 'transferencia', -- transferencia, zelle, efectivo, paypal, crypto
  referencia        TEXT, -- número de referencia bancaria
  notas             TEXT,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: gastos
-- =====================================================
CREATE TABLE IF NOT EXISTS public.gastos (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre        TEXT NOT NULL, -- Servidor, Claude API, VPN, Dominio, etc.
  categoria     TEXT DEFAULT 'tecnologia' CHECK (categoria IN ('tecnologia', 'servicios', 'oficina', 'impuestos', 'personal', 'otro')),
  monto         DECIMAL(10,2) NOT NULL,
  moneda        TEXT DEFAULT 'USD' CHECK (moneda IN ('USD', 'BS')),
  mes           INTEGER CHECK (mes BETWEEN 1 AND 12),
  anio          INTEGER,
  dia_vence     INTEGER CHECK (dia_vence BETWEEN 1 AND 31), -- día del mes que vence
  es_recurrente BOOLEAN DEFAULT TRUE,
  estado        TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado')),
  proveedor     TEXT,
  notas         TEXT,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABLA: configuracion (parámetros del sistema)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.configuracion (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clave         TEXT NOT NULL,
  valor         TEXT,
  descripcion   TEXT,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clave, user_id)
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) - Seguridad por usuario
-- =====================================================

ALTER TABLE public.clientes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_servicio    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicios_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_pago        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingresos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion     ENABLE ROW LEVEL SECURITY;

-- Políticas: solo el dueño puede ver/modificar sus datos
CREATE POLICY "clientes_owner" ON public.clientes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "tipos_servicio_owner" ON public.tipos_servicio
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "servicios_clientes_owner" ON public.servicios_clientes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "notas_pago_owner" ON public.notas_pago
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "ingresos_owner" ON public.ingresos
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "gastos_owner" ON public.gastos
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "configuracion_owner" ON public.configuracion
  FOR ALL USING (auth.uid() = user_id);

-- =====================================================
-- ÍNDICES para mejor performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_servicios_clientes_cliente ON public.servicios_clientes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_servicios_clientes_renovacion ON public.servicios_clientes(fecha_renovacion);
CREATE INDEX IF NOT EXISTS idx_notas_pago_cliente ON public.notas_pago(cliente_id);
CREATE INDEX IF NOT EXISTS idx_notas_pago_estado ON public.notas_pago(estado);
CREATE INDEX IF NOT EXISTS idx_ingresos_fecha ON public.ingresos(fecha_pago);
CREATE INDEX IF NOT EXISTS idx_gastos_mes_anio ON public.gastos(mes, anio);

-- =====================================================
-- FUNCIÓN: actualizar updated_at automáticamente
-- =====================================================
CREATE OR REPLACE FUNCTION public.actualizar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.actualizar_updated_at();

CREATE TRIGGER trg_servicios_clientes_updated_at
  BEFORE UPDATE ON public.servicios_clientes
  FOR EACH ROW EXECUTE FUNCTION public.actualizar_updated_at();

CREATE TRIGGER trg_notas_pago_updated_at
  BEFORE UPDATE ON public.notas_pago
  FOR EACH ROW EXECUTE FUNCTION public.actualizar_updated_at();

CREATE TRIGGER trg_gastos_updated_at
  BEFORE UPDATE ON public.gastos
  FOR EACH ROW EXECUTE FUNCTION public.actualizar_updated_at();

-- =====================================================
-- VISTA: resumen financiero del mes
-- =====================================================
CREATE OR REPLACE VIEW public.resumen_mes AS
SELECT
  EXTRACT(YEAR FROM fecha_pago)::INTEGER  AS anio,
  EXTRACT(MONTH FROM fecha_pago)::INTEGER AS mes,
  SUM(CASE WHEN moneda = 'USD' THEN monto ELSE monto_usd END) AS total_ingresos_usd,
  COUNT(*) AS cantidad_pagos
FROM public.ingresos
WHERE user_id = auth.uid()
GROUP BY 1, 2;

-- =====================================================
-- FIN DEL SCHEMA
-- =====================================================
