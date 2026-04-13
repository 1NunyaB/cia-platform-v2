-- Align legacy rows with extraction_status semantics introduced in 033.

-- Placeholder-only extracted text → retry
update public.evidence_files ef
set extraction_status = 'retry_needed'
where ef.processing_status = 'complete'
  and ef.extraction_status = 'pending'
  and exists (
    select 1
    from public.extracted_texts et
    where et.evidence_file_id = ef.id
      and et.raw_text is not null
      and et.raw_text like '[No text extracted%'
  );

-- Complete but no extraction rows → retry
update public.evidence_files ef
set extraction_status = 'retry_needed'
where ef.processing_status = 'complete'
  and ef.extraction_status = 'pending'
  and not exists (
    select 1 from public.extracted_texts et where et.evidence_file_id = ef.id
  );

-- Remaining complete + pending → treat as extracted OK
update public.evidence_files
set extraction_status = 'ok'
where processing_status = 'complete'
  and extraction_status = 'pending';
