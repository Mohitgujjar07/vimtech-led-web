-- VIMTECH Computer Lab Ledger: Hardware Maintenance & Resolution Migration
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)

-- 1. Create table for hardware issues and maintenance status
create table if not exists system_maintenance (
  id uuid primary key default gen_random_uuid(),
  system_no text not null,
  issue_description text,
  component text default 'other',
  status text not null default 'active',
  reported_at timestamptz default now(),
  resolved_at timestamptz,
  resolved_by text,
  resolution_notes text,
  created_at timestamptz default now()
);

create index if not exists idx_system_maintenance_system_no on system_maintenance(system_no);
create index if not exists idx_system_maintenance_status on system_maintenance(status);

alter table system_maintenance enable row level security;

create policy "Allow all operations on system_maintenance"
  on system_maintenance for all
  using (true) with check (true);

-- 2. Stored Procedure: Active flagged systems
create or replace function flagged_systems(min_occurrences int default 1)
returns table (system_no text, incident_count bigint, remarks text[])
language sql stable
as $$
  select e.system_no,
         count(*) as incident_count,
         array_agg(e.remarks) filter (where e.remarks is not null) as remarks
  from lab_entries e
  where e.system_no is not null
    and e.remarks is not null
    and e.remarks <> ''
    and (
      e.remarks ~* '(not work|broken|damage|fault|mouse|keyboard|monitor|screen|display|power|stuck|hang|slow|boot|cpu|cable|loose|off|dead|click|repair|replace|restart|shut|flicker|error|jam|issue|problem|defect|wire|port|usb)'
    )
    and not exists (
      select 1 from system_maintenance sm
      where sm.system_no = e.system_no
        and sm.status = 'resolved'
        and (sm.resolved_at is null or sm.resolved_at >= e.created_at)
    )
  group by e.system_no
  having count(*) >= min_occurrences
  order by incident_count desc;
$$;
