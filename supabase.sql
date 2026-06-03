-- ============================================================
-- LA SCALONETTA - Base de datos (Supabase)
-- Pegá TODO esto en: Supabase > tu proyecto > SQL Editor > New query > Run
-- ============================================================

-- Tabla simple clave-valor. Replica el storage del artifact pero en una DB real.
create table if not exists kv (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- Activamos RLS (Row Level Security)
alter table kv enable row level security;

-- Política abierta: cualquiera con la clave pública puede leer y escribir.
-- IMPORTANTE: esto es una barrera social entre amigos, NO seguridad real.
-- Las contraseñas quedan accesibles. Que nadie use una contraseña real.
drop policy if exists "scalonetta_all" on kv;
create policy "scalonetta_all"
  on kv
  for all
  using (true)
  with check (true);
