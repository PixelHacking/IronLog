-- ============================================================
-- Iron Log — upgrade: sistema "Pro" dopo 365 giorni + admin
-- Esegui questo script NUOVO nell'SQL Editor di Supabase
-- (è aggiuntivo: non tocca la tabella workouts già esistente)
--
-- ✅ Email admin già impostata: marcopazienza2013@gmail.com
-- (deve coincidere con window.ADMIN_EMAIL in js/config.js)
-- ============================================================

-- 1) Tabella profili: un profilo per utente, con data di creazione
--    account e flag per l'attivazione manuale del Pro.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  pro_manual boolean not null default false,
  pro_manual_set_at timestamptz
);

alter table public.profiles enable row level security;

-- Ogni utente vede solo il proprio profilo
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

grant select on public.profiles to authenticated;
-- Nota: non concediamo INSERT/UPDATE diretti agli utenti.
-- La creazione del profilo avviene tramite trigger automatico,
-- l'attivazione del Pro tramite la funzione admin qui sotto.

-- 2) Trigger: alla registrazione di un nuovo utente, crea
--    automaticamente la sua riga in profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, created_at)
  values (new.id, new.email, new.created_at)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3) Backfill: crea il profilo anche per gli utenti che si sono
--    già registrati PRIMA di eseguire questo script.
insert into public.profiles (id, email, created_at)
select id, email, created_at from auth.users
on conflict (id) do nothing;

-- 4) Funzione admin: attiva/disattiva il Pro per un utente.
--    Solo la tua email può eseguirla con successo.
create or replace function public.set_pro_status(target_user_id uuid, pro boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select email from auth.users where id = auth.uid()) <> 'marcopazienza2013@gmail.com' then
    raise exception 'Non autorizzato';
  end if;

  update public.profiles
  set pro_manual = pro,
      pro_manual_set_at = now()
  where id = target_user_id;
end;
$$;

grant execute on function public.set_pro_status(uuid, boolean) to authenticated;

-- 5) Funzione admin: elenca tutti i profili (email, data di
--    creazione, stato Pro). Solo la tua email può leggerla.
--    (Il nome evita la parola "admin": alcuni filtri di rete/DNS
--    bloccano gli URL che la contengono, causando errori di fetch.)
create or replace function public.secure_list_profiles()
returns table (
  id uuid,
  email text,
  created_at timestamptz,
  pro_manual boolean,
  pro_manual_set_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select email from auth.users where id = auth.uid()) <> 'marcopazienza2013@gmail.com' then
    raise exception 'Non autorizzato';
  end if;

  return query
    select p.id, p.email, p.created_at, p.pro_manual, p.pro_manual_set_at
    from public.profiles p
    order by p.created_at desc;
end;
$$;

grant execute on function public.secure_list_profiles() to authenticated;
