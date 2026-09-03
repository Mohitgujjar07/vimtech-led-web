'use client';

import { useState, useEffect } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { createBrowserClient } from '@/lib/supabase';
import { LabSession, LabEntry } from '@/lib/types';

export default function ExportPage() {
  const [sessions, setSessions] = useState<LabSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterFaculty, setFilterFaculty] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Available filter options
  const [sections, setSections] = useState<string[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [faculties, setFaculties] = useState<string[]>([]);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const supabase = createBrowserClient();
    const { data } = await supabase
      .from('lab_sessions')
      .select('*')
      .order('session_date', { ascending: false });

    if (data) {
      setSessions(data);
      setSections([...new Set(data.map((s) => s.section).filter(Boolean) as string[])]);
      setClasses([...new Set(data.map((s) => s.class_name).filter(Boolean) as string[])]);
      setFaculties([...new Set(data.map((s) => s.faculty_name).filter(Boolean) as string[])]);
    }
    setLoading(false);
  };

  const filteredSessions = sessions.filter((s) => {
    if (dateFrom && s.session_date < dateFrom) return false;
    if (dateTo && s.session_date > dateTo) return false;
    if (filterSection && s.section !== filterSection) return false;
    if (filterClass && s.class_name !== filterClass) return false;
    if (filterFaculty && s.faculty_name !== filterFaculty) return false;
    return true;
  });

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

      // Fetch entries for all selected sessions
      const sessionsWithEntries = await Promise.all(
        toExport.map(async (session) => {
          const { data: entries } = await supabase
            .from('lab_entries')
            .select('*, student:students(*)')
            .eq('session_id', session.id)
            .order('sl_no', { ascending: true });
          return { session, entries: entries || [] };
        })
      );

      if (format === 'excel') {
        const { generateDateRangeExcel, downloadExcel } = await import(
          '@/lib/export-excel'
        );
        const wb = generateDateRangeExcel(sessionsWithEntries);
        downloadExcel(wb, `lab-sessions-export.xlsx`);
        toast.success(`Exported ${toExport.length} sessions as Excel`);
      } else {
        // Fetch logo as base64
        let logoBase64: string | undefined;
        try {
          const logoRes = await fetch('/logo.png');
          const blob = await logoRes.blob();
          logoBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        } catch {
          // Continue without logo if fetch fails
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
      toast.error('Export failed');
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
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Filter className="h-4 w-4" />
          Filters
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
            <label className="label">Section</label>
            <select
              value={filterSection}
              onChange={(e) => setFilterSection(e.target.value)}
              className="input"
            >
              <option value="">All sections</option>
              {sections.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Class</label>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="input"
            >
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Faculty</label>
            <select
              value={filterFaculty}
              onChange={(e) => setFilterFaculty(e.target.value)}
              className="input"
            >
              <option value="">All faculty</option>
              {faculties.map((f) => (
                <option key={f} value={f}>{f}</option>
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
            <div className="flex gap-2">
              <button onClick={selectAll} className="btn-secondary text-xs">
                {selectedIds.size === filteredSessions.length
                  ? 'Deselect All'
                  : 'Select All'}
              </button>
            </div>
          </div>

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
        </div>
      )}

      {/* Export buttons */}
      <div className="sticky bottom-0 mt-6 border-t border-gray-200 bg-gray-50 px-4 py-4 sm:flex sm:gap-3">
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
