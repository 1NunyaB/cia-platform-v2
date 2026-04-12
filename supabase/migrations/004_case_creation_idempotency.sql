-- Prevent duplicate case rows when the same client retries POST /api/cases with the same idempotency key.

create table if not exists public.case_creation_idempotency (
  user_id uuid not null references public.profiles (id) on delete cascade,
  idempotency_key text not null,
  case_id uuid not null references public.cases (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, idempotency_key)
);

create index if not exists idx_case_creation_idem_case on public.case_creation_idempotency (case_id);
