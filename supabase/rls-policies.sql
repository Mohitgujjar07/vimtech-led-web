-- Phase 7: Row Level Security Policies
-- This enables RLS while allowing the Next.js app client to query data
-- (Next.js middleware.ts strictly gates access behind faculty login)

-- Enable RLS on all tables
alter table students enable row level security;
alter table lab_sessions enable row level security;
alter table session_photos enable row level security;
alter table lab_entries enable row level security;

-- Drop previous restrictive policies
drop policy if exists "Authenticated users can read students" on students;
drop policy if exists "Authenticated users can insert students" on students;
drop policy if exists "Authenticated users can update students" on students;
drop policy if exists "Authenticated users can delete students" on students;
drop policy if exists "faculty only" on students;
drop policy if exists "faculty access students" on students;
drop policy if exists "app_access_students" on students;

drop policy if exists "Authenticated users can read lab_sessions" on lab_sessions;
drop policy if exists "Authenticated users can insert lab_sessions" on lab_sessions;
drop policy if exists "Authenticated users can update lab_sessions" on lab_sessions;
drop policy if exists "Authenticated users can delete lab_sessions" on lab_sessions;
drop policy if exists "faculty only" on lab_sessions;
drop policy if exists "faculty access lab_sessions" on lab_sessions;
drop policy if exists "app_access_lab_sessions" on lab_sessions;

drop policy if exists "Authenticated users can read session_photos" on session_photos;
drop policy if exists "Authenticated users can insert session_photos" on session_photos;
drop policy if exists "Authenticated users can delete session_photos" on session_photos;
drop policy if exists "faculty only" on session_photos;
drop policy if exists "faculty access session_photos" on session_photos;
drop policy if exists "app_access_session_photos" on session_photos;

drop policy if exists "Authenticated users can read lab_entries" on lab_entries;
drop policy if exists "Authenticated users can insert lab_entries" on lab_entries;
drop policy if exists "Authenticated users can update lab_entries" on lab_entries;
drop policy if exists "Authenticated users can delete lab_entries" on lab_entries;
drop policy if exists "faculty only" on lab_entries;
drop policy if exists "faculty access lab_entries" on lab_entries;
drop policy if exists "app_access_lab_entries" on lab_entries;

-- Hardened Row-Level Security Policies for VIMTECH Lab Ledger
-- Allows reads for legitimate application UI while guarding against anonymous wipe/truncate attacks.
-- Critical mutations can also be executed via server-side service role client.

-- Students
create policy "allow_read_students" on students for select using (true);
create policy "allow_write_students" on students for all using (
  auth.role() = 'authenticated' or auth.role() = 'service_role'
) with check (
  auth.role() = 'authenticated' or auth.role() = 'service_role'
);

-- Lab Sessions
create policy "allow_read_sessions" on lab_sessions for select using (true);
create policy "allow_write_sessions" on lab_sessions for all using (
  auth.role() = 'authenticated' or auth.role() = 'service_role'
) with check (
  auth.role() = 'authenticated' or auth.role() = 'service_role'
);

-- Session Photos
create policy "allow_read_photos" on session_photos for select using (true);
create policy "allow_write_photos" on session_photos for all using (
  auth.role() = 'authenticated' or auth.role() = 'service_role'
) with check (
  auth.role() = 'authenticated' or auth.role() = 'service_role'
);

-- Lab Entries
create policy "allow_read_entries" on lab_entries for select using (true);
create policy "allow_write_entries" on lab_entries for all using (
  auth.role() = 'authenticated' or auth.role() = 'service_role'
) with check (
  auth.role() = 'authenticated' or auth.role() = 'service_role'
);
