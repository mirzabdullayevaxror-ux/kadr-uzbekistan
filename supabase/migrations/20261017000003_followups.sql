-- Follow-up migrations applied after the initial schema (kept in sync with the live project).

-- Legal consent log
create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agreement_type text not null check (agreement_type in ('terms','privacy','role_specific')),
  document_version text not null default '1.0',
  accepted_at timestamptz not null default now(),
  source text
);
alter table public.legal_acceptances enable row level security;
create policy "own consents read" on public.legal_acceptances for select using (user_id = auth.uid() or public.is_admin());
create policy "own consents insert" on public.legal_acceptances for insert with check (user_id = auth.uid());

-- Owner notifications on moderation decisions
create or replace function public.notify_review()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid; title text; key text;
begin
  if tg_table_name = 'accounts' then
    if new.status is not distinct from old.status then return new; end if;
    select a.owner_id into owner from public.accounts a where a.id = new.id;
    title := 'Akkaunt holati: ' || new.status::text;
    key := 'acc:' || new.id || ':' || new.status::text || ':' || coalesce(new.updated_at::text, '');
    insert into public.notifications (user_id, type, title, body, link, dedupe_key)
    values (owner, 'account_review', title, new.reject_reason, '#/dashboard', key)
    on conflict (dedupe_key) do nothing;
  elsif tg_table_name = 'vacancies' then
    if new.status is not distinct from old.status then return new; end if;
    select a.owner_id into owner from public.accounts a where a.id = new.account_id;
    title := 'E’lon holati: ' || new.status::text || ' — ' || new.title;
    key := 'vac:' || new.id || ':' || new.status::text || ':' || coalesce(new.updated_at::text, '');
    insert into public.notifications (user_id, type, title, body, link, dedupe_key)
    values (owner, 'vacancy_review', title, new.reject_reason, '#/dashboard', key)
    on conflict (dedupe_key) do nothing;
  end if;
  return new;
end $$;
create trigger accounts_notify after update of status on public.accounts for each row execute function public.notify_review();
create trigger vacancies_notify after update of status on public.vacancies for each row execute function public.notify_review();
revoke execute on function public.notify_review() from public, anon, authenticated;
revoke execute on function public.touch_conversation() from public, anon, authenticated;
revoke execute on function public.guard_account() from public, anon, authenticated;
revoke execute on function public.guard_vacancy() from public, anon, authenticated;
revoke execute on function public.account_contacts_init() from public, anon, authenticated;

-- RLS policies evaluate these helpers for anon too (they only return booleans)
grant execute on function public.is_admin() to anon;
grant execute on function public.is_participant(uuid, uuid) to anon;

-- Privileged-write flag is reset at the end of each RPC (was leaking across statements in one transaction)
create or replace function public.submit_account(p_account uuid)
returns void language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not exists (select 1 from public.accounts where id = p_account and owner_id = auth.uid()) then
    raise exception 'Ruxsat yo''q' using errcode = '42501';
  end if;
  perform set_config('app.privileged', 'on', true);
  update public.accounts set status = 'submitted'
   where id = p_account and status in ('draft','needs_info','rejected') and kind <> 'mijoz';
  get diagnostics n = row_count;
  perform set_config('app.privileged', 'off', true);
  if n = 0 then raise exception 'Akkaunt hozir yuborilmaydi'; end if;
end $$;

create or replace function public.submit_vacancy(p_vacancy uuid)
returns void language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not exists (select 1 from public.vacancies v join public.accounts a on a.id = v.account_id
                 where v.id = p_vacancy and a.owner_id = auth.uid()) then
    raise exception 'Ruxsat yo''q' using errcode = '42501';
  end if;
  perform set_config('app.privileged', 'on', true);
  update public.vacancies set status = 'submitted'
   where id = p_vacancy and status in ('draft','needs_info','rejected');
  get diagnostics n = row_count;
  perform set_config('app.privileged', 'off', true);
  if n = 0 then raise exception 'E''lon hozir yuborilmaydi'; end if;
end $$;

create or replace function public.admin_review_account(p_account uuid, p_status public.account_status, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare old_s public.account_status;
begin
  if not public.is_admin() then raise exception 'Faqat admin' using errcode = '42501'; end if;
  if p_status in ('rejected','needs_info') and coalesce(btrim(p_reason), '') = '' then
    raise exception 'Sabab majburiy';
  end if;
  select status into old_s from public.accounts where id = p_account for update;
  if old_s is null then raise exception 'Akkaunt topilmadi'; end if;
  perform set_config('app.privileged', 'on', true);
  update public.accounts set status = p_status,
         reject_reason = case when p_status in ('rejected','needs_info') then p_reason else null end
   where id = p_account;
  perform set_config('app.privileged', 'off', true);
  insert into public.audit_log (actor_id, action, entity, entity_id, old_status, new_status, reason)
  values (auth.uid(), 'review_account', 'account', p_account::text, old_s::text, p_status::text, p_reason);
end $$;

create or replace function public.admin_review_vacancy(p_vacancy uuid, p_status public.vacancy_status, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare old_s public.vacancy_status;
begin
  if not public.is_admin() then raise exception 'Faqat admin' using errcode = '42501'; end if;
  if p_status in ('rejected','needs_info') and coalesce(btrim(p_reason), '') = '' then
    raise exception 'Sabab majburiy';
  end if;
  select status into old_s from public.vacancies where id = p_vacancy for update;
  if old_s is null then raise exception 'E''lon topilmadi'; end if;
  perform set_config('app.privileged', 'on', true);
  update public.vacancies set status = p_status,
         reject_reason = case when p_status in ('rejected','needs_info') then p_reason else null end
   where id = p_vacancy;
  perform set_config('app.privileged', 'off', true);
  insert into public.audit_log (actor_id, action, entity, entity_id, old_status, new_status, reason)
  values (auth.uid(), 'review_vacancy', 'vacancy', p_vacancy::text, old_s::text, p_status::text, p_reason);
end $$;
