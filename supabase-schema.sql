-- ============================================================
-- Gym Tracker — schema Supabase
-- Esegui questo script nell'SQL Editor del tuo progetto Supabase
-- ============================================================

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_date date not null default current_date,
  exercise_name text not null,
  category text not null default 'Altro',
  sets integer,
  reps integer,
  weight_kg numeric,
  duration_min numeric,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists workouts_user_date_idx
  on public.workouts (user_id, workout_date desc);

alter table public.workouts enable row level security;

-- ------------------------------------------------------------
-- Permessi espliciti sulla Data API.
-- Necessari se nel tuo progetto "Automatically expose new tables"
-- (Project Settings -> Data API) è disattivato: senza questi GRANT,
-- supabase-js riceverebbe un errore di permessi anche con RLS configurata.
-- La sicurezza reale resta comunque garantita dalle policy RLS qui sotto:
-- questi GRANT permettono solo di "bussare alla porta", le policy
-- decidono quali righe ogni utente può vedere o modificare.
-- ------------------------------------------------------------
grant select, insert, update, delete on public.workouts to authenticated;
-- Non concediamo nulla a "anon": l'app richiede sempre il login.

-- Ogni utente vede e gestisce solo le proprie righe
create policy "Users can view their own workouts"
  on public.workouts for select
  using (auth.uid() = user_id);

create policy "Users can insert their own workouts"
  on public.workouts for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own workouts"
  on public.workouts for update
  using (auth.uid() = user_id);

create policy "Users can delete their own workouts"
  on public.workouts for delete
  using (auth.uid() = user_id);
