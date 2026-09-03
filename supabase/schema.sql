-- Computer Lab Ledger - Database Schema
-- Run this in Supabase SQL Editor before using the app

create extension if not exists pg_trgm;

-- Students roster table
create table students (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  ucms_no      text unique not null,
  section      text,
  created_at   timestamptz default now()
);
create index students_name_trgm on students using gin (name gin_trgm_ops);
create index students_ucms_trgm on students using gin (ucms_no gin_trgm_ops);

-- Lab sessions (one per class/date)
create table lab_sessions (
  id                    uuid primary key default gen_random_uuid(),
  session_date          date not null,
  section               text,
  class_name            text,
  faculty_name          text,
  total_system_count    int,
  total_mouse_count     int,
  total_keyboard_count  int,
  faculty_confirmed     boolean default false,
  remarks               text,
  created_at            timestamptz default now()
);

-- Photos of ledger pages
create table session_photos (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid references lab_sessions(id) on delete cascade,
  photo_url    text not null,
  page_number  int default 1,
  archived     boolean default false,
  created_at   timestamptz default now()
);

-- Individual student entries per session
create table lab_entries (
  id                 uuid primary key default gen_random_uuid(),
  session_id         uuid references lab_sessions(id) on delete cascade,
  sl_no              int,
  raw_name_ocr       text,
  raw_ucms_ocr       text,
  student_id         uuid references students(id),
  system_no          text,
  signature_present  boolean default false,
  signature_crop_url text,
  ocr_confidence     numeric,
  matched            boolean default false,
  remarks            text,
  created_at         timestamptz default now()
);
create index lab_entries_session_idx on lab_entries (session_id);
create index lab_entries_student_idx on lab_entries (student_id);

-- Fuzzy match function
create or replace function match_student(ocr_name text, ocr_ucms text)
returns table (student_id uuid, confidence numeric)
language sql stable
as $$
  select id,
         greatest(similarity(name, ocr_name), similarity(ucms_no, ocr_ucms)) as confidence
  from students
  order by confidence desc
  limit 1;
$$;

-- Storage bucket for session photos (run separately or via dashboard)
-- insert into storage.buckets (id, name, public) values ('session-photos', 'session-photos', true);
