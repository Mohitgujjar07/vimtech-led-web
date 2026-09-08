'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
  Calendar,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { createBrowserClient } from '@/lib/supabase';
import { LabSession } from '@/lib/types';
import { getAllSections, BCA_SEMESTERS, DEGREE_TYPES } from '@/lib/constants';

export default function ExportPage() {
  const [sessions, setSessions] = useState<LabSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Available filter options
  const [sections, setSections] = useState<string[]>([]);
  const [classes, setClasses] = useState<string[]>([]);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const supabase = createBrowserClient();
    const [sessionsRes, studentsRes] = await Promise.all([
      supabase.from('lab_sessions').select('*').order('session_date', { ascending: false }),
      supabase.from('students').select('section').not('section', 'is', null),
    ]);

    if (sessionsRes.error) {
      toast.error(`Failed to load sessions: ${sessionsRes.error.message}`);
    } else if (sessionsRes.data) {
      const data = sessionsRes.data;
      setSessions(data);

      // Collect all sections from:
      // 1. Enrolled student roster in DB (e.g. 'I', 'III', 'V')
      // 2. Institutional standard sections from constants
      // 3. Any sections currently present in recorded sessions
      const studentSections = (studentsRes.data || []).map((s) => s.section).filter(Boolean) as string[];
      const sessionSections = data.map((s) => s.section).filter(Boolean) as string[];
      const combinedSections = Array.from(
        new Set(['I', 'III', 'V', ...getAllSections(), ...studentSections, ...sessionSections])
      ).filter(Boolean).sort();

      setSections(combinedSections);

      // Collect all classes from:
      // 1. DEGREE_TYPES ('BCA', 'PUC', 'TRAINING', 'WORKSHOP')
      // 2. BCA Semesters ('1st Sem', '2nd Sem', etc.)
      // 3. Existing sessions data
      const sessionClasses = data.map((s) => s.class_name).filter(Boolean) as string[];
      const standardClasses = [
        ...DEGREE_TYPES,
        ...BCA_SEMESTERS.map((s) => s.label),
        ...BCA_SEMESTERS.map((s) => `BCA ${s.label}`),
      ];
      const combinedClasses = Array.from(
        new Set([...standardClasses, ...sessionClasses])
      ).filter(Boolean).sort();

      setClasses(combinedClasses);
    }
    setLoading(false);
  };

  const filteredSessions = useMemo(
    () =>
      sessions.filter((s) => {
        if (dateFrom && s.session_date < dateFrom) return false;
        if (dateTo && s.session_date > dateTo) return false;
        if (filterSection && s.section !== filterSection) return false;
        if (filterClass && s.class_name !== filterClass) return false;
        return true;
      }),
    [sessions, dateFrom, dateTo, filterSection, filterClass]
  );

  const toggleSession = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredSessions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSessions.map((s) => s.id)));
    }
  };

  const exportSelected = async (format: 'excel' | 'pdf') => {
    const toExport = selectedIds.size > 0
      ? filteredSessions.filter((s) => selectedIds.has(s.id))
      : filteredSessions;

    if (toExport.length === 0) {
      toast.error('No sessions to export');
      return;
    }

    setExporting(true);
    try {
      const supabase = createBrowserClient();

      // Single batch query instead of N+1 individual queries
      const sessionIds = toExport.map((s) => s.id);
      const { data: allEntries, error: entriesError } = await supabase
        .from('lab_entries')
        .select('*, student:students(*)')
        .in('session_id', sessionIds)
        .order('sl_no', { ascending: true });

      if (entriesError) {
        throw new Error(`Failed to load entries: ${entriesError.message}`);
      }

      // Group entries by session_id
      const entriesBySession = new Map<string, typeof allEntries>();
      for (const entry of allEntries || []) {
        const sid = entry.session_id;
        if (!entriesBySession.has(sid)) entriesBySession.set(sid, []);
        entriesBySession.get(sid)!.push(entry);
      }

      const sessionsWithEntries = toExport.map((session) => ({
        session,
        entries: entriesBySession.get(session.id) || [],
      }));

      if (format === 'excel') {
        const { generateDateRangeExcel, downloadExcel } = await import(
          '@/lib/export-excel'
        );
        const wb = await generateDateRangeExcel(sessionsWithEntries);
        await downloadExcel(wb, `lab-sessions-export.xlsx`);
        toast.success(`Exported ${toExport.length} sessions as Excel`);
      } else {
        // Fetch logo as base64 safely
        let logoBase64: string | undefined;
        try {
          const logoRes = await fetch('/logo.png');
          if (logoRes.ok) {
            const blob = await logoRes.blob();
            if (blob.type.startsWith('image/')) {
              logoBase64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
            }
          }
        } catch (logoErr) {
          console.warn('PDF logo fetch failed, proceeding without logo:', logoErr);
        }

        const { pdf } = await import('@react-pdf/renderer');
        const { MultiSessionPdfDocument } = await import('@/lib/export-pdf');
        const blob = await pdf(
          MultiSessionPdfDocument({
            sessions: sessionsWithEntries,
            logoBase64,
          })
        ).toBlob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateTag = dateFrom ? `${dateFrom}-to-${dateTo || 'now'}` : 'all-sessions';
        a.download = `lab-ledger-export-${dateTag}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Exported ${sessionsWithEntries.length} sessions to PDF`);
      }
    } catch (err: unknown) {
      console.error('Export failed:', err);
      const message = err instanceof Error ? err.message : 'Export failed';
      toast.error(message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Export Data</h1>
      <p className="mt-1 text-sm text-gray-500">
        Filter and export lab sessions as Excel or PDF.
      </p>

      {/* Filters */}
      <div className="card mt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Filter className="h-4 w-4 text-brand-600" />
            <span>Filters</span>
          </div>
          {(dateFrom || dateTo || filterSection || filterClass) && (
            <button
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setFilterSection('');
                setFilterClass('');
              }}
              className="flex items-center gap-1 text-xs text-brand-700 hover:text-brand-900 font-semibold transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">Section / Year</label>
            <select
              value={filterSection}
              onChange={(e) => setFilterSection(e.target.value)}
              className="input font-medium"
            >
              <option value="">All sections</option>
              {sections.map((s) => (
                <option key={s} value={s}>
                  {['I', 'III', 'V'].includes(s) ? `Semester ${s}` : s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Class / Degree</label>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="input font-medium"
            >
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Session list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      ) : (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''}
              {selectedIds.size > 0 && ` (${selectedIds.size} selected)`}
            </p>
            {filteredSessions.length > 0 && (
              <div className="flex gap-2">
                <button onClick={selectAll} className="btn-secondary text-xs">
                  {selectedIds.size === filteredSessions.length
                    ? 'Deselect All'
                    : 'Select All'}
                </button>
              </div>
            )}
          </div>

          {filteredSessions.length === 0 ? (
            <div className="card mt-3 py-12 text-center text-gray-400">
              <Calendar className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-3 text-sm font-semibold text-gray-800">
                {sessions.length === 0 ? 'No sessions available to export' : 'No matching sessions found'}
              </p>
              <p className="mt-1 text-xs text-gray-500 max-w-sm mx-auto">
                {sessions.length === 0
                  ? 'Conduct and record lab sessions to export comprehensive Excel workbooks and attendance PDFs.'
                  : 'Try clearing your filters or date range.'}
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {filteredSessions.map((session) => (
              <label
                key={session.id}
                className={`card flex cursor-pointer items-center gap-4 transition-shadow hover:shadow-md ${
                  selectedIds.has(session.id) ? 'ring-2 ring-brand-500' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(session.id)}
                  onChange={() => toggleSession(session.id)}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600"
                />
                <Calendar className="h-5 w-5 text-gray-400" />
                <div className="flex-1">
                  <span className="font-medium text-gray-900">
                    {new Date(session.session_date + 'T00:00:00').toLocaleDateString('en-IN', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <div className="flex gap-3 text-xs text-gray-500">
                    {session.section && <span>Section: {session.section}</span>}
                    {session.class_name && <span>Class: {session.class_name}</span>}
                    {session.faculty_name && <span>{session.faculty_name}</span>}
                  </div>
                </div>
                {session.faculty_confirmed ? (
                  <span className="badge-success text-xs">Confirmed</span>
                ) : (
                  <span className="badge-warning text-xs">Draft</span>
                )}
              </label>
            ))}
          </div>
          )}
        </div>
      )}

      {/* Export buttons */}
      <div className="sticky bottom-16 md:bottom-0 z-30 mt-6 border-t border-gray-200 bg-white/95 backdrop-blur-xs px-4 py-3 sm:flex sm:gap-3 shadow-md md:shadow-none rounded-t-xl md:rounded-none">
        <button
          onClick={() => exportSelected('excel')}
          disabled={exporting || filteredSessions.length === 0}
          className="btn-primary w-full sm:w-auto"
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-4 w-4" />
          )}
          Download Excel
        </button>
        <button
          onClick={() => exportSelected('pdf')}
          disabled={exporting || filteredSessions.length === 0}
          className="btn-secondary mt-2 w-full sm:mt-0 sm:w-auto"
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          Download PDF
        </button>
      </div>
    </div>
  );
}
