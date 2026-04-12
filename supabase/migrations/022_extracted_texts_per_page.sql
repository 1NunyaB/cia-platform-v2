-- Per-page rows in extracted_texts (text layer = page 0; OCR = pages 1..N).
-- Replaces separate ocr_results table; upsert strategy is delete+insert per evidence_file_id in app.

alter table public.extracted_texts
  add column if not exists page_number integer not null default 0,
  add column if not exists confidence real;

comment on column public.extracted_texts.page_number is
  '0 = full-document text layer (plain text or PDF with extractable text). 1..N = per-page OCR (image = 1; scanned PDF = page index).';
comment on column public.extracted_texts.confidence is
  'Optional OCR confidence for that page when extraction_method = ocr.';

-- Remove legacy one-row-per-file constraint (name may vary by Postgres version)
do $$
begin
  alter table public.extracted_texts drop constraint extracted_texts_evidence_file_id_key;
exception
  when undefined_object then null;
end $$;

create unique index if not exists extracted_texts_evidence_page_unique
  on public.extracted_texts (evidence_file_id, page_number);

-- ocr_results superseded by extracted_texts (021); safe to drop if present
drop table if exists public.ocr_results cascade;
