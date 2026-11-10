-- JobHunt schema. Run once in the Supabase SQL editor.
-- Safe to re-run: every statement uses IF NOT EXISTS / OR REPLACE.

create extension if not exists pgcrypto;

-- 1. Search profiles: what to look for ----------------------------------------
create table if not exists search_profiles (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique,
  title_keywords    text[] not null default '{}',
  skill_keywords    text[] not null default '{}',
  industry_keywords text[] not null default '{}',
  exclude_keywords  text[] not null default '{}',
  job_types         text[] not null default '{}',
  alert_score    int not null default 80 check (alert_score between 0 and 100),
  save_score     int not null default 50 check (save_score between 0 and 100),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

-- 2. Companies whose job boards the workflow reads -----------------------------
create table if not exists companies (
  id       uuid primary key default gen_random_uuid(),
  name     text not null,
  ats      text not null check (ats in ('greenhouse', 'lever', 'ashby')),
  slug     text not null,
  enabled  boolean not null default true,
  unique (ats, slug)
);

-- 3. Jobs found by the workflow ------------------------------------------------
-- url is UNIQUE: the same job is stored once, so re-runs never duplicate it
-- and never reset a status you changed.
create table if not exists jobs (
  id                uuid primary key default gen_random_uuid(),
  search_profile_id uuid references search_profiles(id) on delete set null,
  url               text not null unique,
  title             text not null,
  company           text,
  location          text,
  location_scope    text not null default 'unknown'
                    check (location_scope in ('worldwide', 'region', 'restricted', 'unknown')),
  description       text,
  source            text not null,
  posted_at         timestamptz,
  found_at          timestamptz not null default now(),
  match_score       int not null default 0 check (match_score between 0 and 100),
  score_breakdown   jsonb not null default '{}'::jsonb,
  status            text not null default 'new'
                    check (status in ('new', 'saved', 'applied', 'interview', 'offer', 'rejected', 'skipped')),
  applied_at        timestamptz,
  notes             text
);
create index if not exists jobs_status_idx   on jobs (status);
create index if not exists jobs_found_at_idx on jobs (found_at desc);
create index if not exists jobs_score_idx    on jobs (match_score desc);

-- 4. Jobs you apply to yourself (not from the workflow) ------------------------
create table if not exists manual_applications (
  id             uuid primary key default gen_random_uuid(),
  company        text not null,
  role_title     text not null,
  platform       text not null
                 check (platform in ('LinkedIn', 'Upwork', 'Indeed', 'company site', 'referral', 'other')),
  job_url        text,
  date_applied   date not null default current_date,
  status         text not null default 'applied'
                 check (status in ('applied', 'viewed', 'interview', 'offer', 'rejected', 'ghosted', 'withdrawn')),
  pay_or_rate    text,
  contact_name   text,
  contact_email  text,
  cv_version     text,
  follow_up_date date,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists manual_applications_updated_at on manual_applications;
create trigger manual_applications_updated_at
  before update on manual_applications
  for each row execute function set_updated_at();

-- 5. One row per workflow run --------------------------------------------------
create table if not exists runs (
  id                   uuid primary key default gen_random_uuid(),
  started_at           timestamptz not null default now(),
  search_profile_id    uuid references search_profiles(id) on delete set null,
  jobs_fetched         int not null default 0,
  jobs_new             int not null default 0,
  good_matches         int not null default 0,
  rejected_by_location int not null default 0,
  errors               jsonb not null default '[]'::jsonb
);
create index if not exists runs_started_at_idx on runs (started_at desc);

-- 6. Source ranking ------------------------------------------------------------
-- Workflow sources (jobs.source) and your own platforms (manual_applications.platform)
-- in one list. "interviews" counts interview + offer (an offer means you got an interview).
-- good_matches = jobs scoring at or above their profile's alert_score (80 if the profile was deleted).
-- source_points = good_matches + 3 * interviews + 10 * offers.
create or replace view source_ranking with (security_invoker = true) as
with workflow as (
  select
    j.source                                                           as source,
    'workflow'::text                                                   as kind,
    count(*)                                                           as total_jobs,
    count(*) filter (where j.match_score >= coalesce(p.alert_score, 80)) as good_matches,
    round(avg(j.match_score), 1)                                       as average_score,
    count(*) filter (where j.status in ('applied', 'interview', 'offer', 'rejected')) as applied,
    count(*) filter (where j.status in ('interview', 'offer'))         as interviews,
    count(*) filter (where j.status = 'offer')                         as offers
  from jobs j
  left join search_profiles p on p.id = j.search_profile_id
  group by j.source
),
manual as (
  select
    m.platform                                                         as source,
    'manual'::text                                                     as kind,
    count(*)                                                           as total_jobs,
    0::bigint                                                          as good_matches,
    null::numeric                                                      as average_score,
    count(*)                                                           as applied,
    count(*) filter (where m.status in ('interview', 'offer'))         as interviews,
    count(*) filter (where m.status = 'offer')                         as offers
  from manual_applications m
  group by m.platform
),
combined as (
  select * from workflow
  union all
  select * from manual
)
select
  rank() over (order by (good_matches + 3 * interviews + 10 * offers) desc, total_jobs desc) as rank,
  source,
  kind,
  total_jobs,
  good_matches,
  average_score,
  applied,
  interviews,
  offers,
  case when applied > 0 then round(100.0 * interviews / applied, 1) else 0 end as interview_rate,
  good_matches + 3 * interviews + 10 * offers                                  as source_points
from combined
order by source_points desc, total_jobs desc;

-- 7. Security ------------------------------------------------------------------
-- RLS on everywhere. Logged-in users (the dashboard) can read and write.
-- Not-logged-in visitors (anon key) get nothing. n8n uses the service role key,
-- which bypasses RLS.
-- IMPORTANT: "any signed-in user" is only safe for a single-user app if nobody else can
-- create an account. In Supabase: Authentication -> Sign In / Providers -> turn OFF
-- "Allow new users to sign up", then create your one user by hand (Authentication -> Users).
do $$
declare t text;
begin
  foreach t in array array['search_profiles', 'companies', 'jobs', 'manual_applications', 'runs'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "signed in users only" on %I', t);
    execute format(
      'create policy "signed in users only" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
