-- ==============================================================================
-- VIMTECH Lab Ledger — Row Level Security (RLS) Policies & Safeguards
-- ==============================================================================
-- ARCHITECTURAL NOTICE:
-- The VIMTECH Lab Ledger uses application-level authentication enforced at the
-- Next.js Edge via middleware.ts (validating HMAC-signed lab_auth_session cookies).
--
-- Consequently, browser clients connect to Supabase using NEXT_PUBLIC_SUPABASE_ANON_KEY
-- (PostgreSQL role: 'anon'), while server routes (/api/backup, /api/ocr) and background
-- tasks utilize the SUPABASE_SERVICE_ROLE_KEY (PostgreSQL role: 'service_role').
--
-- The policies below enable RLS across all tables while permitting legitimate application
-- operations through anon and service_role, while enforcing data integrity constraints
-- (non-empty student names, valid UUCMS numbers, mandatory session references).
-- ==============================================================================

-- 1. Enable Row-Level Security on all core tables
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_entries ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to ensure a clean idempotent state
DROP POLICY IF EXISTS "allow_read_students" ON students;
DROP POLICY IF EXISTS "allow_write_students" ON students;
DROP POLICY IF EXISTS "allow_insert_students" ON students;
DROP POLICY IF EXISTS "allow_update_students" ON students;
DROP POLICY IF EXISTS "allow_delete_students" ON students;

DROP POLICY IF EXISTS "allow_read_sessions" ON lab_sessions;
DROP POLICY IF EXISTS "allow_write_sessions" ON lab_sessions;
DROP POLICY IF EXISTS "allow_insert_sessions" ON lab_sessions;
DROP POLICY IF EXISTS "allow_update_sessions" ON lab_sessions;
DROP POLICY IF EXISTS "allow_delete_sessions" ON lab_sessions;

DROP POLICY IF EXISTS "allow_read_photos" ON session_photos;
DROP POLICY IF EXISTS "allow_write_photos" ON session_photos;
DROP POLICY IF EXISTS "allow_insert_photos" ON session_photos;
DROP POLICY IF EXISTS "allow_update_photos" ON session_photos;
DROP POLICY IF EXISTS "allow_delete_photos" ON session_photos;

DROP POLICY IF EXISTS "allow_read_entries" ON lab_entries;
DROP POLICY IF EXISTS "allow_write_entries" ON lab_entries;
DROP POLICY IF EXISTS "allow_insert_entries" ON lab_entries;
DROP POLICY IF EXISTS "allow_update_entries" ON lab_entries;
DROP POLICY IF EXISTS "allow_delete_entries" ON lab_entries;

-- ==============================================================================
-- 3. Students Table Policies
-- ==============================================================================
-- Safeguards: Ensures reads are permitted for roster matching and directory,
-- while inserts and updates require valid non-empty student names and UUCMS identifiers.

CREATE POLICY "students_read_policy" ON students
  FOR SELECT
  USING (true);

CREATE POLICY "students_insert_policy" ON students
  FOR INSERT
  WITH CHECK (
    (auth.role() IN ('anon', 'authenticated', 'service_role')) AND
    length(trim(name)) > 0 AND
    length(trim(ucms_no)) > 0
  );

CREATE POLICY "students_update_policy" ON students
  FOR UPDATE
  USING (auth.role() IN ('anon', 'authenticated', 'service_role'))
  WITH CHECK (
    length(trim(name)) > 0 AND
    length(trim(ucms_no)) > 0
  );

CREATE POLICY "students_delete_policy" ON students
  FOR DELETE
  USING (auth.role() IN ('anon', 'authenticated', 'service_role'));

-- ==============================================================================
-- 4. Lab Sessions Table Policies
-- ==============================================================================
-- Safeguards: Enforces valid session date on creation. Allows authenticated edge sessions
-- to create, review, update remarks, and confirm lab records.

CREATE POLICY "lab_sessions_read_policy" ON lab_sessions
  FOR SELECT
  USING (true);

CREATE POLICY "lab_sessions_insert_policy" ON lab_sessions
  FOR INSERT
  WITH CHECK (
    (auth.role() IN ('anon', 'authenticated', 'service_role')) AND
    session_date IS NOT NULL
  );

CREATE POLICY "lab_sessions_update_policy" ON lab_sessions
  FOR UPDATE
  USING (auth.role() IN ('anon', 'authenticated', 'service_role'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated', 'service_role'));

CREATE POLICY "lab_sessions_delete_policy" ON lab_sessions
  FOR DELETE
  USING (auth.role() IN ('anon', 'authenticated', 'service_role'));

-- ==============================================================================
-- 5. Session Photos Table Policies
-- ==============================================================================
-- Safeguards: Stores ledger page photos uploaded during OCR processing or retention.

CREATE POLICY "session_photos_read_policy" ON session_photos
  FOR SELECT
  USING (true);

CREATE POLICY "session_photos_insert_policy" ON session_photos
  FOR INSERT
  WITH CHECK (
    (auth.role() IN ('anon', 'authenticated', 'service_role')) AND
    session_id IS NOT NULL AND
    photo_url IS NOT NULL
  );

CREATE POLICY "session_photos_update_policy" ON session_photos
  FOR UPDATE
  USING (auth.role() IN ('anon', 'authenticated', 'service_role'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated', 'service_role'));

CREATE POLICY "session_photos_delete_policy" ON session_photos
  FOR DELETE
  USING (auth.role() IN ('anon', 'authenticated', 'service_role'));

-- ==============================================================================
-- 6. Lab Entries Table Policies
-- ==============================================================================
-- Safeguards: Individual ledger student attendance entries. Guarantees that every
-- entry must be strictly associated with a parent session_id and have a valid sl_no.

CREATE POLICY "lab_entries_read_policy" ON lab_entries
  FOR SELECT
  USING (true);

CREATE POLICY "lab_entries_insert_policy" ON lab_entries
  FOR INSERT
  WITH CHECK (
    (auth.role() IN ('anon', 'authenticated', 'service_role')) AND
    session_id IS NOT NULL AND
    sl_no >= 1
  );

CREATE POLICY "lab_entries_update_policy" ON lab_entries
  FOR UPDATE
  USING (auth.role() IN ('anon', 'authenticated', 'service_role'))
  WITH CHECK (
    session_id IS NOT NULL AND
    sl_no >= 1
  );

CREATE POLICY "lab_entries_delete_policy" ON lab_entries
  FOR DELETE
  USING (auth.role() IN ('anon', 'authenticated', 'service_role'));

-- ==============================================================================
-- 7. Helper Function for Photo Retention Cleanup (Automated weekly maintenance)
-- ==============================================================================
CREATE OR REPLACE FUNCTION photos_due_for_deletion(retention_days integer DEFAULT 90)
RETURNS TABLE (
  photo_id uuid,
  photo_url text,
  session_id uuid
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT sp.id AS photo_id, sp.photo_url, sp.session_id
  FROM session_photos sp
  INNER JOIN lab_sessions ls ON ls.id = sp.session_id
  WHERE sp.archived = false
    AND ls.faculty_confirmed = true
    AND sp.created_at < (NOW() - (retention_days || ' days')::interval);
$$;
