-- Security hardening: private contacts split, RLS on regions, minimal EXECUTE grants

alter table public.regions enable row level security;
create policy "regions read all" on public.regions for select using (true);

-- Private contact data lives in its own table (never exposed directly)
create table public.account_contacts (
  account_id uuid primary key references public.accounts(id) on delete cascade,
  phone text,
  email text,
  telegram text,
  birth_date date,                       -- private; only computed age is ever shown
  contact_visibility jsonb not null default '{"phone":false,"email":false,"telegram":true}'::jsonb
);
insert into public.account_contacts (account_id, phone, email, telegram, birth_date, contact_visibility)
select id, phone, email, telegram, birth_date, contact_visibility from public.accounts;

-- Legacy columns on accounts are kept (no destructive DDL); access is revoked at column level.
revoke select, insert, update on public.accounts from anon, authenticated;
grant select on public.accounts to anon, authenticated;
revoke select on public.accounts from anon, authenticated;
grant select (id, owner_id, kind, username, display_name, about, avatar_url, cover_url, professions, profile_data,
              region_code, city, address, lat, lng, instagram, website, status, reject_reason, is_verified,
              pro_tier, pro_until, created_at, updated_at) on public.accounts to anon, authenticated;
grant insert (owner_id, kind, username, display_name, about, avatar_url, cover_url, professions, profile_data,
              region_code, city, address, lat, lng, instagram, website) on public.accounts to authenticated;
grant update (username, display_name, about, avatar_url, cover_url, professions, profile_data,
              region_code, city, address, lat, lng, instagram, website, status, reject_reason, is_verified,
              pro_tier, pro_until) on public.accounts to authenticated;
drop view if exists public.public_accounts;

alter table public.account_contacts enable row level security;
create policy "contacts owner or admin" on public.account_contacts for all
  using (exists (select 1 from public.accounts a where a.id = account_id and a.owner_id = auth.uid()) or public.is_admin())
  with check (exists (select 1 from public.accounts a where a.id = account_id and a.owner_id = auth.uid()) or public.is_admin());

create or replace function public.account_contacts_init()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.account_contacts (account_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger accounts_contacts_init after insert on public.accounts
  for each row execute function public.account_contacts_init();

-- Public contact projection: respects visibility toggles, returns age not birth date
create or replace function public.get_public_contact(p_account uuid)
returns table (phone text, email text, telegram text, public_age int)
language sql stable security definer set search_path = public as $$
  select
    case when (c.contact_visibility->>'phone')::boolean then c.phone end,
    case when (c.contact_visibility->>'email')::boolean then c.email end,
    case when (c.contact_visibility->>'telegram')::boolean then c.telegram end,
    case when c.birth_date is not null then extract(year from age(c.birth_date))::int end
  from public.accounts a
  join public.account_contacts c on c.account_id = a.id
  where a.id = p_account and a.status = 'approved';
$$;

-- Reduce EXECUTE surface
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_participant(uuid, uuid) to authenticated;
grant execute on function public.get_public_contact(uuid) to anon, authenticated;
grant execute on function public.submit_account(uuid) to authenticated;
grant execute on function public.admin_review_account(uuid, public.account_status, text) to authenticated;
grant execute on function public.submit_vacancy(uuid) to authenticated;
grant execute on function public.admin_review_vacancy(uuid, public.vacancy_status, text) to authenticated;
grant execute on function public.start_conversation(uuid, uuid, text, uuid) to authenticated;
grant execute on function public.respond_offer(uuid, text, numeric, text) to authenticated;
