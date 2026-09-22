-- LDRBOOTH — Supabase PostgreSQL schema
-- Run this in the Supabase SQL editor (or via the CLI) on a fresh project.
-- Keep it simple: this stores durable business/session records.
-- Live/ephemeral state (who's ready, capture progress, socket ids) lives in
-- the backend's in-memory room store, not here.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- users: one row per person who has ever created or joined a booth.
-- We don't do accounts/auth — this just remembers a name+email pairing.
-- ---------------------------------------------------------------------------
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  username    text not null,
  email       text not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- booths: one row per photobooth session/room.
-- ---------------------------------------------------------------------------
create table if not exists booths (
  id               uuid primary key default gen_random_uuid(),
  room_code        text not null unique,          -- e.g. LDR-8KQ2M
  creator_user_id  uuid references users(id),
  status           text not null default 'lobby',  -- lobby | format | ready | capturing | selecting | layout | style | payment | delivered | expired
  format           text,                            -- classic-strip | memory-card | four-frame | double-frame
  total_shots      integer not null default 10,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default (now() + interval '3 hours')
);

create index if not exists idx_booths_room_code on booths(room_code);

-- ---------------------------------------------------------------------------
-- participants: the (max 2) people inside a booth.
-- ---------------------------------------------------------------------------
create table if not exists participants (
  id          uuid primary key default gen_random_uuid(),
  booth_id    uuid not null references booths(id) on delete cascade,
  user_id     uuid references users(id),
  username    text not null,
  email       text not null,
  role        text not null default 'joiner',      -- creator | joiner
  joined_at   timestamptz not null default now()
);

create index if not exists idx_participants_booth on participants(booth_id);

-- ---------------------------------------------------------------------------
-- photo_sessions: tracks the synchronized capture round for a booth.
-- ---------------------------------------------------------------------------
create table if not exists photo_sessions (
  id             uuid primary key default gen_random_uuid(),
  booth_id       uuid not null references booths(id) on delete cascade,
  total_shots    integer not null default 10,
  current_shot   integer not null default 0,
  status         text not null default 'pending',  -- pending | in-progress | complete
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- shots: the individual captured frames (canonical image per round).
-- Stored as a Supabase Storage path in the temp bucket (not the final bucket).
-- ---------------------------------------------------------------------------
create table if not exists shots (
  id           uuid primary key default gen_random_uuid(),
  booth_id     uuid not null references booths(id) on delete cascade,
  shot_index   integer not null,
  pose_name    text,
  storage_path text,                                -- e.g. shots/<booth_id>/<shot_index>.jpg
  created_at   timestamptz not null default now(),
  unique (booth_id, shot_index)
);

-- ---------------------------------------------------------------------------
-- photo_selections: each participant's chosen shot indices for a booth.
-- ---------------------------------------------------------------------------
create table if not exists photo_selections (
  id               uuid primary key default gen_random_uuid(),
  booth_id         uuid not null references booths(id) on delete cascade,
  participant_id   uuid not null references participants(id) on delete cascade,
  selected_shots   integer[] not null default '{}',
  updated_at       timestamptz not null default now(),
  unique (booth_id, participant_id)
);

-- ---------------------------------------------------------------------------
-- layouts: the final photo order + format + style chosen for the booth.
-- ---------------------------------------------------------------------------
create table if not exists layouts (
  id           uuid primary key default gen_random_uuid(),
  booth_id     uuid not null references booths(id) on delete cascade unique,
  photo_order  integer[] not null default '{}',
  format       text,
  style        text,
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- templates: named style presets (seeded, rarely edited at runtime).
-- ---------------------------------------------------------------------------
create table if not exists templates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  filter_config jsonb not null default '{}',
  frame_config  jsonb not null default '{}'
);

insert into templates (name, filter_config, frame_config) values
  ('natural', '{"filter":"none"}', '{"border":"cream"}'),
  ('warm',    '{"filter":"sepia(0.15) saturate(1.2) contrast(1.05)"}', '{"border":"rose"}'),
  ('film',    '{"filter":"contrast(1.1) saturate(0.9) brightness(1.02)"}', '{"border":"charcoal"}'),
  ('dreamy',  '{"filter":"brightness(1.08) saturate(0.85) blur(0.2px)"}', '{"border":"blush"}'),
  ('vintage', '{"filter":"sepia(0.35) contrast(0.95) saturate(0.8)"}', '{"border":"gold"}'),
  ('mono',    '{"filter":"grayscale(1) contrast(1.1)"}', '{"border":"charcoal"}')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- payments: server-authoritative payment state.
-- ---------------------------------------------------------------------------
create table if not exists payments (
  id           uuid primary key default gen_random_uuid(),
  booth_id     uuid not null references booths(id) on delete cascade,
  paid_by      uuid references participants(id),
  status       text not null default 'pending',    -- pending | processing | success | failed
  reference    text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- deliveries: expiring, per-participant download records.
-- One row per participant so each person gets their own private link/email.
-- ---------------------------------------------------------------------------
create table if not exists deliveries (
  id              uuid primary key default gen_random_uuid(),
  booth_id        uuid not null references booths(id) on delete cascade,
  participant_id  uuid not null references participants(id) on delete cascade,
  storage_path    text not null,                    -- e.g. final-photos/<booth_id>/final.jpg
  download_token  text not null unique,
  expires_at      timestamptz not null,
  email_status    text not null default 'pending',  -- pending | sent | failed
  created_at      timestamptz not null default now()
);

create index if not exists idx_deliveries_token on deliveries(download_token);

-- ---------------------------------------------------------------------------
-- Row Level Security: the backend talks to Supabase using the service-role
-- key (server-side only, never exposed to the browser), so it bypasses RLS.
-- We still enable RLS on every table and deny anonymous access by default,
-- in case the anon/public key is ever used for a read-only dashboard later.
-- ---------------------------------------------------------------------------
alter table users             enable row level security;
alter table booths            enable row level security;
alter table participants      enable row level security;
alter table photo_sessions    enable row level security;
alter table shots             enable row level security;
alter table photo_selections  enable row level security;
alter table layouts           enable row level security;
alter table templates         enable row level security;
alter table payments          enable row level security;
alter table deliveries        enable row level security;

-- No policies are created, which means: no access via the anon key.
-- Only the service-role key (used exclusively by the backend) can read/write.
