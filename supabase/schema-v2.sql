-- Phase 6: Dashboard & Maintenance SQL functions
-- Run this in Supabase SQL Editor after the initial schema

-- Add archived column to session_photos if not already added
alter table session_photos add column if not exists archived boolean default false;

-- Drop previous versions to allow safe return type updates
drop function if exists flagged_systems() cascade;
drop function if exists flagged_systems(int) cascade;
drop function if exists student_history(uuid) cascade;
drop function if exists section_mismatches(uuid) cascade;
drop function if exists photos_due_for_deletion() cascade;
drop function if exists photos_due_for_deletion(int) cascade;

-- 1. Damage/incident tracking:
-- Flag any system number that shows up with 2+ non-empty remarks across sessions
create or replace function flagged_systems(min_occurrences int default 2)
returns table (system_no text, incident_count bigint, remarks text[])
language sql stable
as $$
  select system_no,
         count(*) as incident_count,
         array_agg(remarks) filter (where remarks is not null) as remarks
  from lab_entries
  where remarks is not null and remarks <> ''
  group by system_no
  having count(*) >= min_occurrences
  order by incident_count desc;
$$;

-- 2. Student session history:
-- Look up every session a given student has appeared in
create or replace function student_history(p_student_id uuid)
returns table (session_date date, section text, system_no text, remarks text)
language sql stable
as $$
  select s.session_date, s.section, e.system_no, e.remarks
  from lab_entries e
  join lab_sessions s on s.id = e.session_id
  where e.student_id = p_student_id
  order by s.session_date desc;
$$;

-- 3. Attendance cross-check:
-- Flag entries where matched student's roster section doesn't match session section
create or replace function section_mismatches(p_session_id uuid)
returns table (entry_id uuid, student_name text, roster_section text, session_section text)
language sql stable
as $$
  select e.id, st.name, st.section, s.section
  from lab_entries e
  join students st on st.id = e.student_id
  join lab_sessions s on s.id = e.session_id
  where e.session_id = p_session_id
    and st.section is distinct from s.section;
$$;

-- 4. 90-day rolling photo retention:
-- Find photos from confirmed sessions older than 90 days
create or replace function photos_due_for_deletion(retention_days int default 90)
returns table (photo_id uuid, photo_url text, session_id uuid)
language sql stable
as $$
  select sp.id, sp.photo_url, sp.session_id
  from session_photos sp
  join lab_sessions s on s.id = sp.session_id
  where sp.archived = false
    and s.faculty_confirmed = true
    and sp.created_at < now() - (retention_days || ' days')::interval;
$$;
