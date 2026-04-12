-- OCR row storage + denormalized AI analysis fields + timeline junction provenance
-- Note: per-page OCR rows were moved to `extracted_texts` in migration 022; `ocr_results` is dropped there.

do $$ begin
  alter type public.extraction_method add value 'ocr';
exception
  when duplicate_object then null;
end $$;

create table if not exists public.ocr_results (
  id uuid primary key default gen_random_uuid(),
  evidence_file_id uuid not null references public.evidence_files (id) on delete cascade,
  page_number integer,
  frame_ref text,
  extracted_text text not null default '',
  confidence real,
  raw_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ocr_results_evidence on public.ocr_results (evidence_file_id);
create index if not exists idx_ocr_results_created on public.ocr_results (created_at desc);

comment on table public.ocr_results is
  'Per-page or per-frame OCR output (e.g. Tesseract). Search primarily flows through extracted_texts.raw_text.';

alter table public.ocr_results enable row level security;

drop policy if exists "ocr_results select" on public.ocr_results;
create policy "ocr_results select" on public.ocr_results for select using (
  exists (
    select 1 from public.evidence_files e
    where e.id = ocr_results.evidence_file_id
      and (
        e.uploaded_by = auth.uid()
        or (e.case_id is not null and public.is_case_member(e.case_id, auth.uid()))
      )
  )
);

drop policy if exists "ocr_results write" on public.ocr_results;
create policy "ocr_results write" on public.ocr_results for all using (
  exists (
    select 1 from public.evidence_files e
    where e.id = ocr_results.evidence_file_id
      and (
        e.uploaded_by = auth.uid()
        or (e.case_id is not null and public.can_write_case(e.case_id, auth.uid()))
      )
  )
) with check (
  exists (
    select 1 from public.evidence_files e
    where e.id = ocr_results.evidence_file_id
      and (
        e.uploaded_by = auth.uid()
        or (e.case_id is not null and public.can_write_case(e.case_id, auth.uid()))
      )
  )
);

-- Denormalized finding fields + full JSON snapshot for querying without re-parsing structured jsonb
alter table public.ai_analyses add column if not exists analysis_kind text not null default 'evidence_file';
alter table public.ai_analyses add column if not exists inquiry_prompt text;
alter table public.ai_analyses add column if not exists full_response_json jsonb;
alter table public.ai_analyses add column if not exists finding_answer text;
alter table public.ai_analyses add column if not exists confidence_label text;
alter table public.ai_analyses add column if not exists classification text;
alter table public.ai_analyses add column if not exists reasoning text;
alter table public.ai_analyses add column if not exists limitations text;
alter table public.ai_analyses add column if not exists suggested_next_steps text;

comment on column public.ai_analyses.analysis_kind is
  'evidence_file | dashboard_chat | api — distinguishes default evidence analysis vs other inquiry surfaces.';
comment on column public.ai_analyses.full_response_json is
  'Structured analysis snapshot (same semantic content as structured) for cheap reuse without re-running the model.';

create index if not exists idx_ai_analyses_classification on public.ai_analyses (classification);
create index if not exists idx_ai_analyses_confidence_label on public.ai_analyses (confidence_label);

-- Optional provenance on evidence↔timeline junction (which analysis run asserted the link)
alter table public.timeline_event_evidence add column if not exists ai_analysis_id uuid references public.ai_analyses (id) on delete set null;
alter table public.timeline_event_evidence add column if not exists link_role text;

comment on column public.timeline_event_evidence.ai_analysis_id is
  'Analysis run that produced or reinforced this evidence link for the timeline event.';
comment on column public.timeline_event_evidence.link_role is
  'Optional: primary | supporting | contextual';
