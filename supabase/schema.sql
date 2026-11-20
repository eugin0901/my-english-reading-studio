-- Run once in the Supabase SQL editor. All data is private to its owner.
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text, created_at timestamptz not null default now()
);
create table if not exists public.messages (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('user','assistant')), content text not null, created_at timestamptz not null default now()
);
create index if not exists messages_user_created on public.messages(user_id,created_at desc);
create table if not exists public.terms (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 expression text not null, meaning text not null, kind text not null, example text not null,
 wrong_count integer not null default 0, created_at timestamptz not null default now(),
 unique(user_id,expression)
);
create index if not exists terms_user_created on public.terms(user_id,created_at desc);
create table if not exists public.quizzes (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 week_key date not null, title text not null, questions jsonb not null,
 created_at timestamptz not null default now(), unique(user_id,week_key)
);
create table if not exists public.attempts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 quiz_id uuid not null references public.quizzes(id) on delete cascade,
 answers jsonb not null, score integer not null check(score between 0 and 100),
 wrong_expressions jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now(), unique(user_id,quiz_id)
);
-- The app uses server-side user verification and a private secret key.
-- RLS blocks direct client access; no public data policies are defined.
alter table public.profiles enable row level security;
alter table public.messages enable row level security;
alter table public.terms enable row level security;
alter table public.quizzes enable row level security;
alter table public.attempts enable row level security;
