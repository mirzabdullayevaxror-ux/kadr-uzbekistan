-- KADR O'ZBEKISTON: core schema, moderation, RLS
create extension if not exists pgcrypto;

-- ---------- enums ----------
create type public.app_role as enum ('mutaxassis','mijoz','kompaniya','sotuvchi','oquv_markazi','admin');
create type public.account_status as enum ('draft','submitted','in_review','approved','needs_info','rejected','blocked');
create type public.vacancy_status as enum ('draft','submitted','in_review','approved','needs_info','rejected','closed');
create type public.application_status as enum ('pending','shortlisted','accepted','rejected');
create type public.offer_status as enum ('pending','accepted','rejected','countered','cancelled');
create type public.ticket_status as enum ('new','in_progress','answered','closed');

-- ---------- regions (shared taxonomy) ----------
create table public.regions (
  code text primary key,
  name_uz text not null,
  sort int not null default 0
);
insert into public.regions (code, name_uz, sort) values
  ('tashkent_city','Toshkent shahri',1),
  ('tashkent_region','Toshkent viloyati',2),
  ('andijan','Andijon',3),
  ('bukhara','Buxoro',4),
  ('fergana','Farg‘ona',5),
  ('jizzakh','Jizzax',6),
  ('namangan','Namangan',7),
  ('navoiy','Navoiy',8),
  ('kashkadarya','Qashqadaryo',9),
  ('samarkand','Samarqand',10),
  ('syrdarya','Sirdaryo',11),
  ('surkhandarya','Surxondaryo',12),
  ('khorezm','Xorazm',13),
  ('karakalpakstan','Qoraqalpog‘iston Respublikasi',14);

-- ---------- user roles (admin is a role too) ----------
create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);
alter table public.user_roles enable row level security;

-- ---------- helpers ----------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin');
$$;
create policy "own roles read" on public.user_roles for select using (user_id = auth.uid() or public.is_admin());

-- ---------- accounts (Mijoz, Mutaxassis, Kompaniya, Sotuvchi, O'quv markazi) ----------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind public.app_role not null check (kind <> 'admin'),
  username text not null check (username ~ '^[a-z0-9][a-z0-9_-]{2,39}$'),
  display_name text not null check (char_length(display_name) between 2 and 120),
  about text check (char_length(about) <= 4000),
  avatar_url text,
  cover_url text,
  professions text[] not null default '{}',
  profile_data jsonb not null default '{}'::jsonb,
  birth_date date,                       -- PRIVATE: never exposed publicly, only public_age
  region_code text references public.regions(code),
  city text,
  address text,
  lat double precision,
  lng double precision,
  phone text,
  email text,
  telegram text,
  instagram text,
  website text,
  contact_visibility jsonb not null default '{"phone":false,"email":false,"telegram":true}'::jsonb,
  status public.account_status not null default 'draft',
  reject_reason text,
  is_verified boolean not null default false,
  pro_tier text not null default 'FREE' check (pro_tier in ('FREE','PRO','PRO+','PRO MAX')),
  pro_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (username),
  unique (owner_id, kind)
);
create index accounts_status_kind_idx on public.accounts (status, kind);
create index accounts_region_idx on public.accounts (region_code);
create index accounts_professions_idx on public.accounts using gin (professions);

alter table public.accounts enable row level security;
create policy "accounts read own or approved or admin" on public.accounts for select
  using (owner_id = auth.uid() or status = 'approved' or public.is_admin());
create policy "accounts insert own" on public.accounts for insert
  with check (owner_id = auth.uid());
create policy "accounts update own" on public.accounts for update
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());
create policy "accounts delete own" on public.accounts for delete
  using (owner_id = auth.uid() or public.is_admin());

-- Guard: owners cannot set privileged fields; initial status is server-decided
create or replace function public.guard_account()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  privileged boolean := public.is_admin() or coalesce(current_setting('app.privileged', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    if not privileged then
      new.status := case when new.kind = 'mijoz' then 'approved'::public.account_status else 'draft'::public.account_status end;
      new.is_verified := false;
      new.pro_tier := 'FREE';
      new.pro_until := null;
      new.reject_reason := null;
    end if;
    return new;
  end if;

  if not privileged then
    if new.status is distinct from old.status
       or new.is_verified is distinct from old.is_verified
       or new.pro_tier is distinct from old.pro_tier
       or new.pro_until is distinct from old.pro_until
       or new.reject_reason is distinct from old.reject_reason
       or new.owner_id is distinct from old.owner_id
       or new.kind is distinct from old.kind then
      raise exception 'Bu maydonni faqat admin o''zgartira oladi' using errcode = '42501';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger accounts_guard before insert or update on public.accounts
  for each row execute function public.guard_account();

-- Public-safe projection: never exposes birth_date, raw email, or hidden contacts
create or replace view public.public_accounts with (security_invoker = false) as
select
  a.id, a.kind, a.username, a.display_name, a.about, a.avatar_url, a.cover_url,
  a.professions, a.profile_data, a.region_code, a.city, a.address, a.lat, a.lng,
  case when (a.contact_visibility->>'phone')::boolean then a.phone end as phone,
  case when (a.contact_visibility->>'email')::boolean then a.email end as email,
  case when (a.contact_visibility->>'telegram')::boolean then a.telegram end as telegram,
  a.instagram, a.website, a.is_verified, a.pro_tier, a.created_at,
  case when a.birth_date is not null
       then extract(year from age(a.birth_date))::int end as public_age
from public.accounts a
where a.status = 'approved';
grant select on public.public_accounts to anon, authenticated;

-- Talent-specific (Mutaxassis / Brand Face) availability
-- stored in profile_data.availability: 'ready' | 'busy' | 'unavailable'

-- ---------- vacancies & castings (free, admin-moderated) ----------
create table public.vacancies (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  kind text not null check (kind in ('vacancy','casting')),
  title text not null check (char_length(title) between 3 and 150),
  category text not null,
  description text not null check (char_length(description) between 10 and 6000),
  employment_type text check (employment_type in ('full','part','project','freelance','internship')),
  work_mode text check (work_mode in ('office','remote','hybrid')),
  region_code text references public.regions(code),
  city text,
  salary_min integer check (salary_min is null or salary_min >= 0),
  salary_max integer check (salary_max is null or salary_max >= 0),
  deadline date,
  details jsonb not null default '{}'::jsonb,   -- casting: age_range, gender, requirements...
  status public.vacancy_status not null default 'draft',
  reject_reason text,
  telegram_posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vacancies_public_idx on public.vacancies (status, kind, created_at desc);

alter table public.vacancies enable row level security;
create policy "vacancies read approved or own or admin" on public.vacancies for select
  using (status = 'approved' or public.is_admin()
         or exists (select 1 from public.accounts a where a.id = account_id and a.owner_id = auth.uid()));
create policy "vacancies insert own" on public.vacancies for insert
  with check (exists (select 1 from public.accounts a where a.id = account_id and a.owner_id = auth.uid() and a.kind in ('mijoz','kompaniya')));
create policy "vacancies update own" on public.vacancies for update
  using (exists (select 1 from public.accounts a where a.id = account_id and a.owner_id = auth.uid()) or public.is_admin())
  with check (true);
create policy "vacancies delete own" on public.vacancies for delete
  using (exists (select 1 from public.accounts a where a.id = account_id and a.owner_id = auth.uid()) or public.is_admin());

create or replace function public.guard_vacancy()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  privileged boolean := public.is_admin() or coalesce(current_setting('app.privileged', true), '') = 'on';
begin
  if tg_op = 'INSERT' and not privileged then
    new.status := 'draft';
    new.reject_reason := null;
    new.telegram_posted_at := null;
  elsif tg_op = 'UPDATE' and not privileged then
    if new.status is distinct from old.status or new.reject_reason is distinct from old.reject_reason
       or new.telegram_posted_at is distinct from old.telegram_posted_at
       or new.account_id is distinct from old.account_id then
      raise exception 'Holatni faqat admin o''zgartira oladi' using errcode = '42501';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger vacancies_guard before insert or update on public.vacancies
  for each row execute function public.guard_vacancy();

-- ---------- applications ----------
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  vacancy_id uuid not null references public.vacancies(id) on delete cascade,
  applicant_account_id uuid not null references public.accounts(id) on delete cascade,
  message text check (char_length(message) <= 2000),
  status public.application_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (vacancy_id, applicant_account_id)
);
alter table public.applications enable row level security;
create policy "applications read parties" on public.applications for select
  using (exists (select 1 from public.accounts a where a.id = applicant_account_id and a.owner_id = auth.uid())
         or exists (select 1 from public.vacancies v join public.accounts a on a.id = v.account_id
                    where v.id = vacancy_id and a.owner_id = auth.uid())
         or public.is_admin());
create policy "applications insert talent" on public.applications for insert
  with check (
    exists (select 1 from public.accounts a where a.id = applicant_account_id and a.owner_id = auth.uid()
            and a.kind = 'mutaxassis' and a.status = 'approved')
    and exists (select 1 from public.vacancies v where v.id = vacancy_id and v.status = 'approved'));
create policy "applications update by vacancy owner" on public.applications for update
  using (exists (select 1 from public.vacancies v join public.accounts a on a.id = v.account_id
                 where v.id = vacancy_id and a.owner_id = auth.uid()))
  with check (status in ('pending','shortlisted','accepted','rejected'));

-- ---------- offers ----------
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  from_account_id uuid not null references public.accounts(id) on delete cascade,
  to_account_id uuid not null references public.accounts(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 150),
  description text check (char_length(description) <= 4000),
  event_date date,
  event_time time,
  region_code text references public.regions(code),
  location text,
  service text,
  budget numeric(14,2) check (budget is null or budget >= 0),
  note text check (char_length(note) <= 2000),
  status public.offer_status not null default 'pending',
  parent_offer_id uuid references public.offers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_account_id <> to_account_id)
);
alter table public.offers enable row level security;
create policy "offers read parties" on public.offers for select
  using (exists (select 1 from public.accounts a where a.id in (from_account_id, to_account_id) and a.owner_id = auth.uid())
         or public.is_admin());
create policy "offers insert by sender" on public.offers for insert
  with check (exists (select 1 from public.accounts a where a.id = from_account_id and a.owner_id = auth.uid())
              and exists (select 1 from public.accounts b where b.id = to_account_id and b.status = 'approved'));
-- status changes only via respond_offer()

-- ---------- chat ----------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  context_type text,
  context_id uuid,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, account_id)
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_account_id uuid not null references public.accounts(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index messages_conv_idx on public.messages (conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

create or replace function public.is_participant(p_conv uuid, p_account uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversation_participants where conversation_id = p_conv and account_id = p_account);
$$;

create policy "conv read participants" on public.conversations for select
  using (exists (select 1 from public.conversation_participants cp join public.accounts a on a.id = cp.account_id
                 where cp.conversation_id = id and a.owner_id = auth.uid()));
create policy "participants read own rows" on public.conversation_participants for select
  using (exists (select 1 from public.accounts a where a.id = account_id and a.owner_id = auth.uid()));
create policy "messages read participants" on public.messages for select
  using (exists (select 1 from public.conversation_participants cp join public.accounts a on a.id = cp.account_id
                 where cp.conversation_id = messages.conversation_id and a.owner_id = auth.uid()));
create policy "messages insert participants" on public.messages for insert
  with check (exists (select 1 from public.accounts a where a.id = sender_account_id and a.owner_id = auth.uid())
              and public.is_participant(conversation_id, sender_account_id));

-- Create (or reuse) a 1:1 conversation between two accounts I own/target
create or replace function public.start_conversation(p_from uuid, p_to uuid, p_context_type text default null, p_context_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare conv uuid;
begin
  if not exists (select 1 from public.accounts where id = p_from and owner_id = auth.uid()) then
    raise exception 'Bu akkaunt sizga tegishli emas' using errcode = '42501';
  end if;
  if not exists (select 1 from public.accounts where id = p_to and status = 'approved') then
    raise exception 'Qabul qiluvchi akkaunt faol emas';
  end if;
  select c.id into conv from public.conversations c
   where (select count(*) from public.conversation_participants cp where cp.conversation_id = c.id) = 2
     and exists (select 1 from public.conversation_participants x where x.conversation_id = c.id and x.account_id = p_from)
     and exists (select 1 from public.conversation_participants x where x.conversation_id = c.id and x.account_id = p_to)
   limit 1;
  if conv is null then
    insert into public.conversations (context_type, context_id) values (p_context_type, p_context_id) returning id into conv;
    insert into public.conversation_participants (conversation_id, account_id) values (conv, p_from), (conv, p_to);
  end if;
  return conv;
end $$;

create or replace function public.touch_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = now() where id = new.conversation_id;
  return new;
end $$;
create trigger messages_touch after insert on public.messages
  for each row execute function public.touch_conversation();

-- ---------- support ----------
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('account','verification','payment','market','vacancy_casting','complaint','technical','other')),
  subject text not null check (char_length(subject) between 3 and 150),
  status public.ticket_status not null default 'new',
  assignee_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  is_staff boolean not null default false,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
create policy "tickets own or admin" on public.support_tickets for select
  using (owner_id = auth.uid() or public.is_admin());
create policy "tickets insert own" on public.support_tickets for insert
  with check (owner_id = auth.uid());
create policy "tickets admin update" on public.support_tickets for update
  using (public.is_admin()) with check (public.is_admin());
create policy "support msgs read" on public.support_messages for select
  using (public.is_admin() or exists (select 1 from public.support_tickets t where t.id = ticket_id and t.owner_id = auth.uid()));
create policy "support msgs insert" on public.support_messages for insert
  with check (author_id = auth.uid() and (
    public.is_admin() or (not is_staff and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.owner_id = auth.uid()))));

-- ---------- notifications ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  dedupe_key text unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
create policy "notifications own" on public.notifications for select using (user_id = auth.uid());
create policy "notifications mark read" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- audit log (append-only via RPC) ----------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text not null,
  old_status text,
  new_status text,
  reason text,
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
create policy "audit admin read" on public.audit_log for select using (public.is_admin());

-- ---------- RPCs: submission & moderation ----------
create or replace function public.submit_account(p_account uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.accounts where id = p_account and owner_id = auth.uid()) then
    raise exception 'Ruxsat yo''q' using errcode = '42501';
  end if;
  perform set_config('app.privileged', 'on', true);
  update public.accounts set status = 'submitted'
   where id = p_account and status in ('draft','needs_info','rejected') and kind <> 'mijoz';
  if not found then raise exception 'Akkaunt hozir yuborilmaydi'; end if;
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
  insert into public.audit_log (actor_id, action, entity, entity_id, old_status, new_status, reason)
  values (auth.uid(), 'review_account', 'account', p_account::text, old_s::text, p_status::text, p_reason);
end $$;

create or replace function public.submit_vacancy(p_vacancy uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.vacancies v join public.accounts a on a.id = v.account_id
                 where v.id = p_vacancy and a.owner_id = auth.uid()) then
    raise exception 'Ruxsat yo''q' using errcode = '42501';
  end if;
  perform set_config('app.privileged', 'on', true);
  update public.vacancies set status = 'submitted'
   where id = p_vacancy and status in ('draft','needs_info','rejected');
  if not found then raise exception 'E''lon hozir yuborilmaydi'; end if;
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
  insert into public.audit_log (actor_id, action, entity, entity_id, old_status, new_status, reason)
  values (auth.uid(), 'review_vacancy', 'vacancy', p_vacancy::text, old_s::text, p_status::text, p_reason);
end $$;

-- Offer response: only parties; counter creates a child offer
create or replace function public.respond_offer(p_offer uuid, p_action text, p_budget numeric default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare o public.offers; new_id uuid; mine_to boolean; mine_from boolean;
begin
  select * into o from public.offers where id = p_offer for update;
  if o.id is null then raise exception 'Taklif topilmadi'; end if;
  mine_to := exists (select 1 from public.accounts where id = o.to_account_id and owner_id = auth.uid());
  mine_from := exists (select 1 from public.accounts where id = o.from_account_id and owner_id = auth.uid());
  if o.status <> 'pending' then raise exception 'Taklif allaqachon yakunlangan'; end if;

  if p_action = 'accept' and mine_to then
    update public.offers set status = 'accepted', updated_at = now() where id = p_offer;
  elsif p_action = 'reject' and mine_to then
    update public.offers set status = 'rejected', updated_at = now() where id = p_offer;
  elsif p_action = 'counter' and mine_to then
    if p_budget is null then raise exception 'Qarshi narx kiriting'; end if;
    update public.offers set status = 'countered', updated_at = now() where id = p_offer;
    insert into public.offers (from_account_id, to_account_id, title, description, event_date, event_time,
                               region_code, location, service, budget, note, parent_offer_id)
    values (o.to_account_id, o.from_account_id, o.title, o.description, o.event_date, o.event_time,
            o.region_code, o.location, o.service, p_budget, p_note, o.id)
    returning id into new_id;
    return new_id;
  elsif p_action = 'cancel' and mine_from then
    update public.offers set status = 'cancelled', updated_at = now() where id = p_offer;
  else
    raise exception 'Bu amal sizga ruxsat etilmagan' using errcode = '42501';
  end if;
  return p_offer;
end $$;

grant execute on function public.submit_account(uuid) to authenticated;
grant execute on function public.admin_review_account(uuid, public.account_status, text) to authenticated;
grant execute on function public.submit_vacancy(uuid) to authenticated;
grant execute on function public.admin_review_vacancy(uuid, public.vacancy_status, text) to authenticated;
grant execute on function public.start_conversation(uuid, uuid, text, uuid) to authenticated;
grant execute on function public.respond_offer(uuid, text, numeric, text) to authenticated;
