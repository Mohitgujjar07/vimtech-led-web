'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  Users,
  Plus,
  Upload,
  Search,
  Trash2,
  Loader2,
  FileSpreadsheet,
  X,
  Download,
  CalendarCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { createBrowserClient } from '@/lib/supabase';
import { Student } from '@/lib/types';
import { getAllSections } from '@/lib/constants';

const RosterUpload = dynamic(() => import('@/components/RosterUpload'), {
  loading: () => (
    <div className="flex justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
    </div>
  ),
});

interface AttendanceData {
  attended: number;
  totalSessions: number;
  percentage: number;
  status: 'good' | 'warning' | 'defaulter';
}

export default function RosterPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Map<string, AttendanceData>>(new Map());
  const [totalConfirmedSessions, setTotalConfirmedSessions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'roster' | 'attendance'>('roster');
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [defaulterOnly, setDefaulterOnly] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [exportingDefaulters, setExportingDefaulters] = useState(false);

  // New student form
  const [newName, setNewName] = useState('');
  const [newUcms, setNewUcms] = useState('');
  const [newSection, setNewSection] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadStudentsAndAttendance();
  }, []);

  const loadStudentsAndAttendance = async () => {
    setLoading(true);
    try {
      const supabase = createBrowserClient();

      const [studentsRes, sessionsRes, entriesRes] = await Promise.all([
        supabase.from('students').select('*').order('name', { ascending: true }),
        supabase.from('lab_sessions').select('id, section').eq('faculty_confirmed', true),
        supabase.from('lab_entries').select('student_id, raw_ucms_ocr, session_id, signature_present').eq('signature_present', true),
      ]);

      if (studentsRes.error) throw new Error(`Failed to load students: ${studentsRes.error.message}`);
      if (sessionsRes.error) throw new Error(`Failed to load sessions: ${sessionsRes.error.message}`);
      if (entriesRes.error) throw new Error(`Failed to load entries: ${entriesRes.error.message}`);

      const studentList = studentsRes.data || [];
      setStudents(studentList);

      const confirmedSessions = sessionsRes.data || [];
      setTotalConfirmedSessions(confirmedSessions.length);

      // Section to session count map
      const sectionSessionCount = new Map<string, number>();
      for (const s of confirmedSessions) {
        const sec = (s.section || '').trim().toLowerCase();
        if (sec) {
          sectionSessionCount.set(sec, (sectionSessionCount.get(sec) || 0) + 1);
        }
      }

      // Map of student attendance count (by student_id or raw_ucms_ocr)
      const studentAttendedMap = new Map<string, Set<string>>();
      for (const e of entriesRes.data || []) {
        const key = e.student_id || (e.raw_ucms_ocr || '').trim().toLowerCase();
        if (key && e.session_id) {
          if (!studentAttendedMap.has(key)) {
            studentAttendedMap.set(key, new Set());
          }
          studentAttendedMap.get(key)!.add(e.session_id);
        }
      }

      // Build attendance stats map per student
      const statsMap = new Map<string, AttendanceData>();
      for (const s of studentList) {
        const studentSec = (s.section || '').trim().toLowerCase();
        // Sessions held for this section, or total if section unspecified
        const total = (studentSec && sectionSessionCount.get(studentSec)) || confirmedSessions.length || 1;

        // Count unique confirmed sessions attended by this student
        const attendedByUUID = studentAttendedMap.get(s.id)?.size || 0;
        const attendedByRoll = studentAttendedMap.get(s.ucms_no.trim().toLowerCase())?.size || 0;
        const attended = Math.max(attendedByUUID, attendedByRoll);

        const pct = total > 0 ? Math.round((attended / total) * 100) : 100;
        let status: 'good' | 'warning' | 'defaulter' = 'good';
        if (pct < 75) status = 'defaulter';
        else if (pct < 85) status = 'warning';

        statsMap.set(s.id, {
          attended,
          totalSessions: total,
          percentage: pct,
          status,
        });
      }

      setAttendanceMap(statsMap);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load students';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newUcms.trim()) {
      toast.error('Student Name and UUCMS No are required');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.from('students').insert({
        name: newName.trim(),
        ucms_no: newUcms.trim().toUpperCase(),
        section: newSection.trim() || null,
      });

      if (error) throw new Error(`Failed to add student: ${error.message}`);

      toast.success(`Student ${newName.trim()} added successfully!`);
      setNewName('');
      setNewUcms('');
      setNewSection('');
      setShowAddModal(false);
      await loadStudentsAndAttendance();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add student';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStudent = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} from the roster?`)) return;

    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) throw new Error(`Failed to delete student: ${error.message}`);

      toast.success(`${name} removed from roster`);
      setStudents((prev) => prev.filter((s) => s.id !== id));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete student';
      toast.error(msg);
    }
  };

  const sections = useMemo(
    () =>
      Array.from(
        new Set(students.map((s) => s.section).filter(Boolean) as string[])
      ).sort(),
    [students]
  );

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.ucms_no.toLowerCase().includes(search.toLowerCase());
      const matchesSection = sectionFilter ? s.section === sectionFilter : true;

      if (!matchesSearch || !matchesSection) return false;

      if (activeTab === 'attendance' && defaulterOnly) {
        const stats = attendanceMap.get(s.id);
        return stats && stats.percentage < 75;
      }

      return true;
    });
  }, [students, search, sectionFilter, activeTab, defaulterOnly, attendanceMap]);

  const defaultersCount = useMemo(() => {
    let count = 0;
    attendanceMap.forEach((stats) => {
      if (stats.percentage < 75) count++;
    });
    return count;
  }, [attendanceMap]);

  const handleExportDefaulters = async () => {
    setExportingDefaulters(true);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      const defaultersList = students
        .filter((s) => {
          const stats = attendanceMap.get(s.id);
          const matchesSec = sectionFilter ? s.section === sectionFilter : true;
          return matchesSec && stats && stats.percentage < 75;
        })
        .map((s, idx) => {
          const stats = attendanceMap.get(s.id)!;
          return [
            idx + 1,
            s.name,
            s.ucms_no,
            s.section || 'General',
            stats.attended,
            stats.totalSessions,
            `${stats.percentage}%`,
            'ATTENDANCE SHORTAGE (< 75%)',
          ];
        });

      const headerData = [
        ['VIMTECH - COMPUTER LAB ATTENDANCE DEFAULTER LIST'],
        [`Generated: ${new Date().toLocaleDateString('en-IN')}`, '', `Section: ${sectionFilter || 'All'}`],
        [],
        ['SL NO', 'STUDENT NAME', 'UUCMS NO', 'SECTION', 'ATTENDED', 'TOTAL SESSIONS', 'ATTENDANCE %', 'ELIGIBILITY REMARK'],
        ...defaultersList,
      ];

      const ws = XLSX.utils.aoa_to_sheet(headerData);
      ws['!cols'] = [
        { wch: 8 },
        { wch: 28 },
        { wch: 18 },
        { wch: 12 },
        { wch: 10 },
        { wch: 14 },
        { wch: 14 },
        { wch: 30 },
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Defaulters');
      const filename = `vimtech-lab-defaulters-${sectionFilter || 'all'}-${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success(`Exported ${defaultersList.length} defaulters to Excel`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to export defaulter list';
      toast.error(msg);
    } finally {
      setExportingDefaulters(false);
    }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* ────────────────── Header & Actions ────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
            Student Roster & Attendance
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-gray-500">
            {students.length} students enrolled • {defaultersCount} students with &lt;75% lab attendance
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'attendance' && defaultersCount > 0 && (
            <button
              onClick={handleExportDefaulters}
              disabled={exportingDefaulters}
              className="btn-secondary py-2 px-3 text-xs sm:text-sm font-semibold border-red-200 text-red-700 hover:bg-red-50"
            >
              {exportingDefaulters ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4 text-red-600" />
              )}
              <span>Export Defaulters (<span className="font-bold">{defaultersCount}</span>)</span>
            </button>
          )}

          <button
            onClick={() => setShowUpload(!showUpload)}
            className="btn-secondary py-2 px-3 text-xs sm:text-sm flex-1 sm:flex-initial"
          >
            <Upload className="h-4 w-4" />
            <span>{showUpload ? 'Close Batch' : 'Batch Upload'}</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary py-2 px-3 text-xs sm:text-sm shadow-sm"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* ────────────────── Mode Segmented Tabs ────────────────── */}
      <div className="flex rounded-2xl bg-gray-200/80 p-1 shadow-2xs">
        <button
          onClick={() => setActiveTab('roster')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2 text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'roster'
              ? 'bg-white text-brand-700 shadow-xs'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Student Directory ({students.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2 text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'attendance'
              ? 'bg-white text-brand-700 shadow-xs'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <CalendarCheck className="h-4 w-4 text-brand-600" />
          <span>Attendance Compliance &amp; Defaulters</span>
          {defaultersCount > 0 && (
            <span className="rounded-full bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 font-bold">
              {defaultersCount}
            </span>
          )}
        </button>
      </div>

      {/* ────────────────── Batch Ingestion Drawer ────────────────── */}
      {showUpload && (
        <div className="rounded-2xl border-2 border-brand-200 bg-brand-50/25 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between border-b border-brand-100 pb-2.5">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-brand-700" />
              <h2 className="text-sm font-bold text-gray-900">Batch Roster Ingestion</h2>
            </div>
            <button
              onClick={() => setShowUpload(false)}
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <RosterUpload
            onUploadComplete={() => {
              loadStudentsAndAttendance();
              setShowUpload(false);
            }}
          />
        </div>
      )}

      {/* ────────────────── Compact Metric Strip ────────────────── */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-2xs">
          <p className="text-[11px] font-medium text-gray-500">Total Enrolled</p>
          <p className="text-lg sm:text-xl font-bold text-gray-900">{students.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-2xs">
          <p className="text-[11px] font-medium text-gray-500">Confirmed Sessions</p>
          <p className="text-lg sm:text-xl font-bold text-gray-900">{totalConfirmedSessions}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-2xs">
          <p className="text-[11px] font-medium text-gray-500">Defaulters (&lt; 75%)</p>
          <p className={`text-lg sm:text-xl font-bold ${defaultersCount > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
            {defaultersCount} students
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-2xs">
          <p className="text-[11px] font-medium text-gray-500">Active Sections</p>
          <p className="text-lg sm:text-xl font-bold text-brand-700">
            {sections.length} Sections
          </p>
        </div>
      </div>

      {/* ────────────────── Search & Section Filter ────────────────── */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student name or UUCMS roll..."
            className="input pl-9 py-2 text-sm bg-white"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          {activeTab === 'attendance' && (
            <button
              onClick={() => setDefaulterOnly(!defaulterOnly)}
              className={`rounded-xl px-3 py-1.5 font-semibold shrink-0 transition-all ${
                defaulterOnly
                  ? 'bg-red-600 text-white shadow-2xs'
                  : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
              }`}
            >
              {defaulterOnly ? '✓ Showing Defaulters Only' : 'Show Defaulters (<75%)'}
            </button>
          )}

          <button
            onClick={() => setSectionFilter('')}
            className={`rounded-xl px-3 py-1.5 font-semibold shrink-0 transition-all ${
              !sectionFilter
                ? 'bg-brand-700 text-white shadow-2xs'
                : 'bg-white border border-gray-200 text-gray-600'
            }`}
          >
            All Sections
          </button>
          {sections.map((sec) => (
            <button
              key={sec}
              onClick={() => setSectionFilter(sectionFilter === sec ? '' : sec)}
              className={`rounded-xl px-3 py-1.5 font-semibold shrink-0 transition-all ${
                sectionFilter === sec
                  ? 'bg-brand-700 text-white shadow-2xs'
                  : 'bg-white border border-gray-200 text-gray-600'
              }`}
            >
              Sec {sec}
            </button>
          ))}
        </div>
      </div>

      {/* ────────────────── Main Display ────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Users className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-base font-bold text-gray-800">
              {students.length === 0
                ? 'No students in roster'
                : defaulterOnly
                ? 'Great! No students with attendance shortages found'
                : 'No matching students found'}
            </p>
            <p className="mt-1 text-xs text-gray-500 max-w-sm">
              {students.length === 0
                ? 'Upload a CSV or Excel roster with Name and UUCMS No to enable instant AI recognition.'
                : 'Try adjusting your search terms or section filter.'}
            </p>
          </div>
        ) : activeTab === 'roster' ? (
          /* ────────────────── Roster Tab ────────────────── */
          <>
            {/* Mobile Cards */}
            <div className="block md:hidden divide-y divide-gray-100">
              {filteredStudents.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-3.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-800 text-xs font-bold shadow-2xs">
                      {getInitials(student.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-gray-900 truncate">
                        {student.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-xs font-bold text-brand-700">
                          {student.ucms_no}
                        </span>
                        {student.section && (
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                            Sec {student.section}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteStudent(student.id, student.name)}
                    className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors ml-2"
                    title="Delete student"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50/90">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 w-14">#</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Student Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">UUCMS No.</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Section</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Enrolled On</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600 w-20">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredStudents.map((student, idx) => (
                    <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs font-mono text-gray-400">{idx + 1}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{student.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-brand-700 font-bold">
                        {student.ucms_no}
                      </td>
                      <td className="px-4 py-3">
                        {student.section ? (
                          <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                            Section {student.section}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {student.created_at
                          ? new Date(student.created_at).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleDeleteStudent(student.id, student.name)}
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Delete student"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          /* ────────────────── Attendance Compliance & Defaulters Tab ────────────────── */
          <>
            {/* Mobile Cards */}
            <div className="block md:hidden divide-y divide-gray-100">
              {filteredStudents.map((student) => {
                const stats = attendanceMap.get(student.id) || {
                  attended: 0,
                  totalSessions: totalConfirmedSessions,
                  percentage: 0,
                  status: 'defaulter',
                };
                return (
                  <div key={student.id} className="p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm text-gray-900 truncate">{student.name}</p>
                        <p className="font-mono text-xs text-brand-700 font-semibold">{student.ucms_no}</p>
                      </div>
                      <span
                        className={`badge text-[11px] font-bold ${
                          stats.percentage >= 85
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
                            : stats.percentage >= 75
                            ? 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20'
                            : 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
                        }`}
                      >
                        {stats.percentage}%
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-gray-500">
                        <span>Attended {stats.attended} of {stats.totalSessions} sessions</span>
                        <span className="font-semibold">
                          {stats.percentage >= 75 ? 'Eligible' : 'Shortage (< 75%)'}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                        <div
                          style={{ width: `${Math.min(100, stats.percentage)}%` }}
                          className={`h-full rounded-full transition-all ${
                            stats.percentage >= 85
                              ? 'bg-emerald-500'
                              : stats.percentage >= 75
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50/90">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 w-14">#</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Student Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">UUCMS Roll</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Section</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600 w-28">Attended</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 min-w-[180px]">Compliance</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600 w-32">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredStudents.map((student, idx) => {
                    const stats = attendanceMap.get(student.id) || {
                      attended: 0,
                      totalSessions: totalConfirmedSessions,
                      percentage: 0,
                      status: 'defaulter',
                    };
                    return (
                      <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-xs font-mono text-gray-400">{idx + 1}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{student.name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-brand-700 font-bold">
                          {student.ucms_no}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {student.section ? `Sec ${student.section}` : 'General'}
                        </td>
                        <td className="px-4 py-3 text-center text-xs font-bold text-gray-800">
                          {stats.attended} / {stats.totalSessions}
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-gray-600">{stats.percentage}%</span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                              <div
                                style={{ width: `${Math.min(100, stats.percentage)}%` }}
                                className={`h-full rounded-full transition-all ${
                                  stats.percentage >= 85
                                    ? 'bg-emerald-500'
                                    : stats.percentage >= 75
                                    ? 'bg-amber-500'
                                    : 'bg-red-500'
                                }`}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {stats.percentage >= 85 ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                              ✓ Good (≥85%)
                            </span>
                          ) : stats.percentage >= 75 ? (
                            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                              ⚠ At Risk
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">
                              🚨 Defaulter (&lt;75%)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ────────────────── Add Single Student Modal ────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-brand-700" />
                <h3 className="text-lg font-bold text-gray-900">Add Student to Roster</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddStudent} className="mt-4 space-y-4">
              <div>
                <label className="label">Student Name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="input"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="label">UUCMS / Roll Number *</label>
                <input
                  type="text"
                  value={newUcms}
                  onChange={(e) => setNewUcms(e.target.value)}
                  placeholder="e.g. U11YB24S0001"
                  className="input font-mono uppercase"
                  required
                />
              </div>

              <div>
                <label className="label">Section (optional)</label>
                <select
                  value={newSection}
                  onChange={(e) => setNewSection(e.target.value)}
                  className="input"
                >
                  <option value="">— No Section —</option>
                  {getAllSections().map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Add Student
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
