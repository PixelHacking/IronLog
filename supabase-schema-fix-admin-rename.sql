-- ============================================================
-- Iron Log — fix: rinomina la funzione che elenca i profili
-- per evitare la parola "admin" nell'URL della richiesta
-- (alcuni filtri di rete/DNS bloccano gli URL con questa parola,
-- causando l'errore ERR_NAME_NOT_RESOLVED visto nel browser).
-- Esegui questo script NUOVO nell'SQL Editor di Supabase.
-- ============================================================

drop function if exists public.admin_list_profiles();

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
