-- Remove duplicate cases with the same title, keeping the row with the smallest id (UUID sort).
-- Dependent rows cascade per FK on public.cases.

delete from public.cases a
using public.cases b
where a.id > b.id
  and a.title = b.title;
