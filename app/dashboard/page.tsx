'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Monitor,
  AlertTriangle,
  Users,
  Search,
  ChevronRight,
  Loader2,
  BarChart3,
  Calendar,
  UserSearch,
  History,
  X,
  CheckCircle,
  Clock,
  Plus,
  TrendingUp,
  PieChart,
  Activity,
  CheckCircle2,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { createBrowserClient } from '@/lib/supabase';
import { LabSession, Student } from '@/lib/types';

interface FlaggedSystem {
  system_no: string;
  session_count?: number;
  incident_count?: number;
  sessions?: { session_id?: string; session_date?: string; remark?: string }[];
  remarks?: string[];
}

interface StudentHistoryEntry {
  session_id?: string;
  session_date: string;
  section: string | null;
  class_name?: string | null;
  system_no: string | null;
  remarks: string | null;
  signature_present?: boolean;
}

interface SessionWithCounts extends LabSession {
  entry_count?: number;
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'systems' | 'students'>('overview');

  // Overview stats
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [confirmedSessions, setConfirmedSessions] = useState(0);
  const [countMismatches, setCountMismatches] = useState<SessionWithCounts[]>([]);
  const [loading, setLoading] = useState(true);

  // Analytics & Visual Chart metrics
  const [hardwareCategories, setHardwareCategories] = useState({
    mouse: 0,
    keyboard: 0,
    display: 0,
    other: 0,
    total: 0,
  });
  const [signatureStats, setSignatureStats] = useState({
    signed: 0,
    unsigned: 0,
    total: 0,
    pct: 100,
  });
  const [occupancyData, setOccupancyData] = useState<{
    id: string;
    label: string;
    section: string;
    occupied: number;
    capacity: number;
    pct: number;
  }[]>([]);
  const [sectionTurnout, setSectionTurnout] = useState<{
    section: string;
    sessionsCount: number;
    totalAttendance: number;
  }[]>([]);

  // Flagged systems
  const [flaggedSystems, setFlaggedSystems] = useState<FlaggedSystem[]>([]);
  const [loadingSystems, setLoadingSystems] = useState(false);

  // Student history
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentHistory, setStudentHistory] = useState<StudentHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchingStudents, setSearchingStudents] = useState(false);

  const [sessions, setSessions] = useState<LabSession[]>([]);

  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    const supabase = createBrowserClient();

    const [sessionsRes, distinctEntriesRes] = await Promise.all([
      supabase.from('lab_sessions').select('*').order('session_date', { ascending: false }),
      supabase.from('lab_entries').select('raw_ucms_ocr, raw_name_ocr'),
    ]);

    const allSessions = sessionsRes.data || [];
    setSessions(allSessions);
    setTotalSessions(allSessions.length);
    setConfirmedSessions(allSessions.filter((s) => s.faculty_confirmed).length);

    // Unique students recorded from physical ledger entries
    const uniqueKeys = new Set(
      (distinctEntriesRes.data || [])
        .map((e) => (e.raw_ucms_ocr || e.raw_name_ocr || '').trim().toLowerCase())
        .filter(Boolean)
    );
    setTotalStudents(uniqueKeys.size);

    // Query entries to compute counts, hardware categories, signature stats & occupancy
    try {
      const { data: entryRows } = await supabase
        .from('lab_entries')
        .select('session_id, signature_present, remarks');

      const countMap = new Map<string, number>();
      let mouseCount = 0;
      let keyboardCount = 0;
      let displayCount = 0;
      let otherCount = 0;
      let signedCount = 0;
      let unsignedCount = 0;

      for (const row of entryRows || []) {
        if (row.session_id) {
          countMap.set(row.session_id, (countMap.get(row.session_id) || 0) + 1);
        }

        if (row.signature_present) {
          signedCount++;
        } else {
          unsignedCount++;
        }

        const rem = (row.remarks || '').trim().toLowerCase();
        if (rem) {
          if (rem.includes('mouse') || rem.includes('scroll') || rem.includes('cursor')) {
            mouseCount++;
          } else if (rem.includes('keyboard') || rem.includes('key') || rem.includes('space')) {
            keyboardCount++;
          } else if (rem.includes('monitor') || rem.includes('screen') || rem.includes('display')) {
            displayCount++;
          } else {
            otherCount++;
          }
        }
      }

      const totalIssues = mouseCount + keyboardCount + displayCount + otherCount;
      setHardwareCategories({
        mouse: mouseCount,
        keyboard: keyboardCount,
        display: displayCount,
        other: otherCount,
        total: totalIssues,
      });

      const totalSignatures = signedCount + unsignedCount;
      setSignatureStats({
        signed: signedCount,
        unsigned: unsignedCount,
        total: totalSignatures,
        pct: totalSignatures > 0 ? Math.round((signedCount / totalSignatures) * 100) : 100,
      });

      // Count mismatches
      const sessionsToCheck = allSessions.filter((s) => s.total_system_count != null);
      const mismatchedSessions: SessionWithCounts[] = [];
      for (const session of sessionsToCheck) {
        const actualCount = countMap.get(session.id) || 0;
        if (session.total_system_count != null && actualCount !== session.total_system_count) {
          mismatchedSessions.push({ ...session, entry_count: actualCount });
        }
      }
      setCountMismatches(mismatchedSessions);

      // Occupancy data for latest sessions (chronological order)
      const recent = allSessions.slice(0, 8).reverse();
      const occupancy = recent.map((s) => {
        const occupied = countMap.get(s.id) || s.total_system_count || 0;
        const capacity = s.total_system_count || Math.max(60, occupied);
        const pct = Math.min(100, Math.round((occupied / Math.max(1, capacity)) * 100));
        let shortDate = s.session_date;
        try {
          const d = new Date(s.session_date + 'T00:00:00');
          shortDate = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        } catch {}

        return {
          id: s.id,
          label: shortDate,
          section: s.section || 'General',
          occupied,
          capacity,
          pct,
        };
      });
      setOccupancyData(occupancy);

      // Section turnout aggregation
      const sectionMap = new Map<string, { count: number; attendees: number }>();
      for (const s of allSessions) {
        const sec = s.section || 'Unassigned';
        const attendees = countMap.get(s.id) || s.total_system_count || 0;
        const existing = sectionMap.get(sec) || { count: 0, attendees: 0 };
        sectionMap.set(sec, {
          count: existing.count + 1,
          attendees: existing.attendees + attendees,
        });
      }

      const turnout = Array.from(sectionMap.entries()).map(([section, data]) => ({
        section,
        sessionsCount: data.count,
        totalAttendance: data.attendees,
      }));
      setSectionTurnout(turnout);
    } catch {
      setCountMismatches([]);
    }

    try {
      const { data: flaggedData } = await supabase.rpc('flagged_systems');
      if (flaggedData) setFlaggedSystems(flaggedData);
    } catch {
      // Non-fatal
    }
    setLoading(false);
  };

  const loadFlaggedSystems = async () => {
    setLoadingSystems(true);
    const supabase = createBrowserClient();
    const { data, error } = await supabase.rpc('flagged_systems');
    if (error) {
      toast.error('Failed to load flagged systems');
    } else {
      setFlaggedSystems(data || []);
    }
    setLoadingSystems(false);
  };

  const searchStudentsForHistory = async (query: string) => {
    if (query.length < 2) {
      setStudentResults([]);
      return;
    }
    setSearchingStudents(true);
    const supabase = createBrowserClient();
    const { data } = await supabase
      .from('lab_entries')
      .select('raw_name_ocr, raw_ucms_ocr')
      .or(`raw_name_ocr.ilike.%${query}%,raw_ucms_ocr.ilike.%${query}%`)
      .limit(30);

    const map = new Map<string, { id: string; name: string; ucms_no: string; section?: string }>();
    for (const row of data || []) {
      const key = (row.raw_ucms_ocr || row.raw_name_ocr || '').trim().toLowerCase();
      if (key && !map.has(key)) {
        map.set(key, {
          id: key,
          name: row.raw_name_ocr || 'Unknown',
          ucms_no: row.raw_ucms_ocr || '—',
        });
      }
    }
    setStudentResults(Array.from(map.values()) as unknown as Student[]);
    setSearchingStudents(false);
  };

  const loadStudentHistory = async (student: Student) => {
    setSelectedStudent(student);
    setStudentResults([]);
    setStudentSearch('');
    setLoadingHistory(true);
    const supabase = createBrowserClient();

    let query = supabase
      .from('lab_entries')
      .select('session_id, system_no, remarks, signature_present, lab_sessions(session_date, section, class_name)');

    if (student.ucms_no && student.ucms_no !== '—') {
      query = query.eq('raw_ucms_ocr', student.ucms_no);
    } else {
      query = query.ilike('raw_name_ocr', student.name);
    }

    const { data, error } = await query;
    if (error) {
      toast.error('Failed to load student history');
    } else {
      interface RawEntrySession {
        session_id: string;
        system_no: string | null;
        remarks: string | null;
        signature_present: boolean;
        lab_sessions: { session_date?: string; section?: string; class_name?: string } | null;
      }
      const formatted: StudentHistoryEntry[] = ((data as unknown as RawEntrySession[]) || []).map((row) => ({
        session_id: row.session_id,
        session_date: row.lab_sessions?.session_date || 'N/A',
        section: row.lab_sessions?.section || null,
        class_name: row.lab_sessions?.class_name || null,
        system_no: row.system_no,
        remarks: row.remarks,
        signature_present: row.signature_present,
      }));
      setStudentHistory(formatted);
    }
    setLoadingHistory(false);
  };

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { id: 'analytics' as const, label: 'Analytics & Charts', icon: TrendingUp },
    { id: 'systems' as const, label: 'Flagged Systems', icon: Monitor },
    { id: 'students' as const, label: 'Student History', icon: UserSearch },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">
        Analytics, tracking, and cross-checks
      </p>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'systems' && flaggedSystems.length === 0) loadFlaggedSystems();
              }}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-brand-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="mt-6 space-y-6">
          {/* Stats cards */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="card">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
                      <Calendar className="h-5 w-5 text-brand-700" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{totalSessions}</p>
                      <p className="text-xs text-gray-500">Total Sessions</p>
                    </div>
                  </div>
                </div>
                <div className="card">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
                      <History className="h-5 w-5 text-green-700" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{confirmedSessions}</p>
                      <p className="text-xs text-gray-500">Confirmed</p>
                    </div>
                  </div>
                </div>
                <div className="card">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                      <Users className="h-5 w-5 text-blue-700" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{totalStudents}</p>
                      <p className="text-xs text-gray-500">Students Recorded</p>
                    </div>
                  </div>
                </div>
                <div className="card">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${countMismatches.length > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                      <AlertTriangle className={`h-5 w-5 ${countMismatches.length > 0 ? 'text-red-700' : 'text-green-700'}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{countMismatches.length}</p>
                      <p className="text-xs text-gray-500">Count Mismatches</p>
                    </div>
                  </div>
                </div>
                <div
                  onClick={() => setActiveTab('systems')}
                  className="card cursor-pointer transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${flaggedSystems.length > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
                      <Monitor className={`h-5 w-5 ${flaggedSystems.length > 0 ? 'text-amber-700' : 'text-gray-500'}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{flaggedSystems.length}</p>
                      <p className="text-xs text-gray-500">Flagged Systems</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Count mismatches detail */}
              {countMismatches.length > 0 && (
                <div className="card">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-red-700">
                    <AlertTriangle className="h-4 w-4" />
                    Sessions with Count Mismatches
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Faculty&apos;s manual total count doesn&apos;t match actual row count
                  </p>
                  <div className="mt-3 space-y-2">
                    {countMismatches.map((session) => (
                      <Link
                        key={session.id}
                        href={`/sessions/${session.id}`}
                        className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50/50 px-4 py-3 transition-colors hover:bg-red-50"
                      >
                        <div>
                          <span className="font-medium text-gray-900">
                            {new Date(session.session_date + 'T00:00:00').toLocaleDateString('en-IN', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                          <span className="ml-2 text-xs text-gray-500">
                            {session.section && `Section ${session.section}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-red-600">
                            Expected: {session.total_system_count} | Actual: {session.entry_count}
                          </span>
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Flagged Systems Widget */}
              {flaggedSystems.length > 0 && (
                <div className="card">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                      <Monitor className="h-4 w-4 text-amber-600" />
                      Recurring System Issues (Damage & Incidents)
                    </h3>
                    <button
                      onClick={() => setActiveTab('systems')}
                      className="text-xs font-medium text-brand-700 hover:underline"
                    >
                      View All Details →
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Machines with remarks across 2+ sessions — may need maintenance or hardware checks
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {flaggedSystems.slice(0, 6).map((sys) => {
                      const count = sys.incident_count ?? sys.session_count ?? (sys.remarks?.length || 0);
                      const latestRemark = sys.sessions?.[0]?.remark ?? sys.remarks?.[0] ?? 'Recurring issue';
                      return (
                        <div
                          key={sys.system_no}
                          onClick={() => setActiveTab('systems')}
                          className="flex cursor-pointer items-center justify-between rounded-lg border border-amber-100 bg-amber-50/40 p-3 transition-colors hover:bg-amber-50"
                        >
                          <div>
                            <p className="text-sm font-semibold text-gray-900">System #{sys.system_no}</p>
                            <p className="text-xs text-gray-500 truncate max-w-[180px]">{latestRemark}</p>
                          </div>
                          <span className="badge-warning">{count} flags</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recent Sessions List on Dashboard */}
              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">Recent Lab Sessions</h3>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Latest ledger sessions and attendance uploaded
                    </p>
                  </div>
                  <Link
                    href="/sessions/new"
                    className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New Session
                  </Link>
                </div>

                {sessions.length === 0 ? (
                  <div className="py-8 text-center text-gray-400">
                    <Calendar className="mx-auto h-8 w-8 text-gray-300" />
                    <p className="mt-2 text-sm">No sessions recorded yet</p>
                    <Link href="/sessions/new" className="btn-secondary mt-3 inline-flex text-xs">
                      Upload Your First Ledger Page
                    </Link>
                  </div>
                ) : (
                  <div className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-100">
                    {sessions.slice(0, 10).map((session) => (
                      <Link
                        key={session.id}
                        href={`/sessions/${session.id}`}
                        className="flex items-center justify-between p-3.5 transition-colors hover:bg-gray-50/80"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                              session.faculty_confirmed ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {session.faculty_confirmed ? (
                              <CheckCircle className="h-5 w-5" />
                            ) : (
                              <Clock className="h-5 w-5" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-gray-900">
                                {new Date(session.session_date + 'T00:00:00').toLocaleDateString('en-IN', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </span>
                              {session.section && (
                                <span className="badge-info text-[10px]">
                                  Sec {session.section}
                                </span>
                              )}
                              {session.faculty_confirmed ? (
                                <span className="badge-success text-[10px]">Confirmed</span>
                              ) : (
                                <span className="badge-warning text-[10px]">Draft (Needs Review)</span>
                              )}
                            </div>
                            <div className="mt-0.5 flex gap-3 text-xs text-gray-500">
                              {session.class_name && <span>Class: {session.class_name}</span>}
                              {session.faculty_name && <span>Faculty: {session.faculty_name}</span>}
                              <span>{session.total_system_count ?? '—'} systems logged</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-brand-700">Open →</span>
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Analytics & Charts Tab */}
      {activeTab === 'analytics' && (
        <div className="mt-6 space-y-6">
          {/* Header Summary */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Lab Utilization &amp; Incident Intelligence</h2>
              <p className="text-xs text-gray-500">
                Visual charts and statistics generated from ledger records and hardware logs
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge-info text-xs">
                {totalSessions} sessions logged
              </span>
              <span className="badge-success text-xs">
                {signatureStats.pct}% attendance verified
              </span>
            </div>
          </div>

          {/* Chart Row 1: Lab System Occupancy & Utilization Trend */}
          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <TrendingUp className="h-4 w-4 text-brand-600" />
                  Lab System Occupancy Trend (Recent Sessions)
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  Percentage of lab capacity utilized per session
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> High (≥85%)
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Moderate (60-84%)
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> Low (&lt;60%)
                </span>
              </div>
            </div>

            {occupancyData.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">
                No session occupancy data available yet
              </div>
            ) : (
              <div className="mt-6">
                {/* Responsive Bar Chart */}
                <div className="flex h-56 items-end gap-3 sm:gap-6 border-b border-gray-200 pb-3 pt-4 px-2">
                  {occupancyData.map((item) => {
                    const barColor =
                      item.pct >= 85
                        ? 'bg-emerald-500 hover:bg-emerald-600'
                        : item.pct >= 60
                        ? 'bg-amber-500 hover:bg-amber-600'
                        : 'bg-rose-500 hover:bg-rose-600';

                    return (
                      <div
                        key={item.id}
                        className="group relative flex flex-1 flex-col items-center h-full justify-end"
                      >
                        {/* Tooltip on hover */}
                        <div className="pointer-events-none absolute -top-12 z-20 hidden rounded-md bg-gray-900 px-2 py-1 text-center text-[11px] font-medium text-white shadow-md group-hover:block whitespace-nowrap">
                          {item.label} ({item.section})
                          <br />
                          {item.occupied} / {item.capacity} systems ({item.pct}%)
                        </div>

                        {/* Top Label */}
                        <span className="mb-1.5 text-[11px] font-semibold text-gray-600">
                          {item.pct}%
                        </span>

                        {/* Bar */}
                        <div className="w-full max-w-[48px] rounded-t-md bg-gray-100 flex flex-col justify-end h-full">
                          <div
                            style={{ height: `${Math.max(8, item.pct)}%` }}
                            className={`w-full rounded-t-md transition-all duration-300 ${barColor}`}
                          />
                        </div>

                        {/* Bottom X-axis label */}
                        <span className="mt-2 text-[10px] font-medium text-gray-500 truncate max-w-[60px]">
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Chart Row 2: Grid with Hardware Issue Categories & Signature Verification Gauge */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Hardware Incident Breakdown */}
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Wrench className="h-4 w-4 text-amber-600" />
                    Hardware Issues by Category
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Automated classification of per-student remarks
                  </p>
                </div>
                <span className="badge-warning text-xs">
                  {hardwareCategories.total} total flags
                </span>
              </div>

              <div className="mt-5 space-y-3.5">
                {/* Mouse */}
                <div>
                  <div className="flex justify-between text-xs font-medium text-gray-700 mb-1">
                    <span className="flex items-center gap-1.5">
                      🖱️ Mouse &amp; Pointing Devices
                    </span>
                    <span>
                      {hardwareCategories.mouse} (
                      {hardwareCategories.total > 0
                        ? Math.round((hardwareCategories.mouse / hardwareCategories.total) * 100)
                        : 0}
                      %)
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      style={{
                        width: `${
                          hardwareCategories.total > 0
                            ? (hardwareCategories.mouse / hardwareCategories.total) * 100
                            : 0
                        }%`,
                      }}
                      className="h-full bg-blue-500 rounded-full transition-all"
                    />
                  </div>
                </div>

                {/* Keyboard */}
                <div>
                  <div className="flex justify-between text-xs font-medium text-gray-700 mb-1">
                    <span className="flex items-center gap-1.5">
                      ⌨️ Keyboards &amp; Keys
                    </span>
                    <span>
                      {hardwareCategories.keyboard} (
                      {hardwareCategories.total > 0
                        ? Math.round((hardwareCategories.keyboard / hardwareCategories.total) * 100)
                        : 0}
                      %)
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      style={{
                        width: `${
                          hardwareCategories.total > 0
                            ? (hardwareCategories.keyboard / hardwareCategories.total) * 100
                            : 0
                        }%`,
                      }}
                      className="h-full bg-amber-500 rounded-full transition-all"
                    />
                  </div>
                </div>

                {/* Display */}
                <div>
                  <div className="flex justify-between text-xs font-medium text-gray-700 mb-1">
                    <span className="flex items-center gap-1.5">
                      🖥️ Monitors &amp; Displays
                    </span>
                    <span>
                      {hardwareCategories.display} (
                      {hardwareCategories.total > 0
                        ? Math.round((hardwareCategories.display / hardwareCategories.total) * 100)
                        : 0}
                      %)
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      style={{
                        width: `${
                          hardwareCategories.total > 0
                            ? (hardwareCategories.display / hardwareCategories.total) * 100
                            : 0
                        }%`,
                      }}
                      className="h-full bg-purple-500 rounded-full transition-all"
                    />
                  </div>
                </div>

                {/* Other/Power */}
                <div>
                  <div className="flex justify-between text-xs font-medium text-gray-700 mb-1">
                    <span className="flex items-center gap-1.5">
                      ⚡ Power, Network &amp; Other
                    </span>
                    <span>
                      {hardwareCategories.other} (
                      {hardwareCategories.total > 0
                        ? Math.round((hardwareCategories.other / hardwareCategories.total) * 100)
                        : 0}
                      %)
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      style={{
                        width: `${
                          hardwareCategories.total > 0
                            ? (hardwareCategories.other / hardwareCategories.total) * 100
                            : 0
                        }%`,
                      }}
                      className="h-full bg-emerald-500 rounded-full transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
                <button
                  onClick={() => setActiveTab('systems')}
                  className="text-xs font-medium text-brand-600 hover:underline"
                >
                  View Affected PC List →
                </button>
              </div>
            </div>

            {/* Attendance & Physical Signature Verification Gauge */}
            <div className="card flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Physical Signature Verification Rate
                  </h3>
                  <span className="badge-info text-xs">{signatureStats.total} entries</span>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  Compliance rate of students physically signing the paper ledger
                </p>
              </div>

              {/* Circular Gauge */}
              <div className="my-6 flex flex-col items-center justify-center">
                <div className="relative flex h-36 w-36 items-center justify-center">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-gray-100"
                      strokeWidth="3.8"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-emerald-500 transition-all duration-1000 ease-out"
                      strokeDasharray={`${signatureStats.pct}, 100`}
                      strokeWidth="3.8"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-bold text-gray-900">
                      {signatureStats.pct}%
                    </span>
                    <span className="text-[10px] text-gray-400">Signed</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-3 text-center">
                <div className="rounded-lg bg-green-50/60 p-2">
                  <p className="text-sm font-bold text-green-700">{signatureStats.signed}</p>
                  <p className="text-[10px] text-green-800">Verified Signed</p>
                </div>
                <div className="rounded-lg bg-rose-50/60 p-2">
                  <p className="text-sm font-bold text-rose-700">{signatureStats.unsigned}</p>
                  <p className="text-[10px] text-rose-800">Unsigned / Blank</p>
                </div>
              </div>
            </div>
          </div>

          {/* Chart Row 3: Section Distribution & Lab Turnout */}
          <div className="card">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <PieChart className="h-4 w-4 text-purple-600" />
              Section Turnout &amp; Lab Sessions Conducted
            </h3>
            <p className="mt-0.5 text-xs text-gray-500">
              Total sessions and student attendance recorded by class section
            </p>

            {sectionTurnout.length === 0 ? (
              <p className="mt-4 text-center text-xs text-gray-400 py-6">
                No section distribution data yet
              </p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {sectionTurnout.map((sec) => (
                  <div
                    key={sec.section}
                    className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 transition-all hover:bg-brand-50/40 hover:border-brand-100"
                  >
                    <span className="badge-info text-xs font-semibold">
                      Section {sec.section}
                    </span>
                    <div className="mt-3 flex items-baseline justify-between">
                      <div>
                        <p className="text-xl font-bold text-gray-900">{sec.sessionsCount}</p>
                        <p className="text-[11px] text-gray-500">Sessions Held</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-semibold text-brand-700">
                          {sec.totalAttendance}
                        </p>
                        <p className="text-[11px] text-gray-500">Total Attendees</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Flagged Systems Tab */}
      {activeTab === 'systems' && (
        <div className="mt-6">
          {loadingSystems ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
            </div>
          ) : flaggedSystems.length === 0 ? (
            <div className="card text-center py-12">
              <Monitor className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">
                No systems flagged — no system has remarks across 2+ sessions
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Systems with remarks across 2+ sessions — may need attention
              </p>
              {flaggedSystems.map((sys) => {
                const count = sys.incident_count ?? sys.session_count ?? (sys.remarks?.length || 0);
                return (
                  <div key={sys.system_no} className="card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
                          <Monitor className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            System #{sys.system_no}
                          </p>
                          <p className="text-xs text-gray-500">
                            Flagged in {count} sessions
                          </p>
                        </div>
                      </div>
                      <span className="badge-danger">{count} incidents</span>
                    </div>
                    <div className="mt-3 space-y-1">
                      {sys.sessions && sys.sessions.length > 0
                        ? sys.sessions.map((s, idx) => (
                            <Link
                              key={idx}
                              href={s.session_id ? `/sessions/${s.session_id}` : '#'}
                              className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs transition-colors hover:bg-gray-100"
                            >
                              <span className="font-medium text-gray-700">{s.session_date || 'Session'}</span>
                              <span className="text-gray-500">{s.remark}</span>
                            </Link>
                          ))
                        : sys.remarks && sys.remarks.length > 0
                        ? sys.remarks.map((r, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs"
                            >
                              <span className="font-medium text-gray-700">Incident #{idx + 1}</span>
                              <span className="text-gray-500">{r}</span>
                            </div>
                          ))
                        : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Student History Tab */}
      {activeTab === 'students' && (
        <div className="mt-6 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => {
                setStudentSearch(e.target.value);
                searchStudentsForHistory(e.target.value);
              }}
              placeholder="Search student by name or UUCMS..."
              className="input pl-10"
            />
            {searchingStudents && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
            )}
          </div>

          {/* Search results dropdown */}
          {studentResults.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-lg">
              {studentResults.map((s) => (
                <button
                  key={s.id}
                  onClick={() => loadStudentHistory(s)}
                  className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left text-sm transition-colors last:border-0 hover:bg-brand-50"
                >
                  <Users className="h-4 w-4 text-gray-400" />
                  <div>
                    <div className="font-medium text-gray-900">{s.name}</div>
                    <div className="font-mono text-xs text-gray-400">
                      {s.ucms_no} {s.section && `• Section ${s.section}`}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Selected student history */}
          {selectedStudent && (
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedStudent.name}</h3>
                  <p className="font-mono text-xs text-gray-500">
                    {selectedStudent.ucms_no} {selectedStudent.section && `• Section ${selectedStudent.section}`}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedStudent(null);
                    setStudentHistory([]);
                  }}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {loadingHistory ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
                </div>
              ) : studentHistory.length === 0 ? (
                <p className="mt-4 text-center text-sm text-gray-400">
                  No session history found
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Date</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Section</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Class</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">System</th>
                        <th className="px-3 py-2 text-center font-medium text-gray-600">Signed</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {studentHistory.map((entry, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            {entry.session_id ? (
                              <Link
                                href={`/sessions/${entry.session_id}`}
                                className="text-brand-600 hover:underline"
                              >
                                {entry.session_date}
                              </Link>
                            ) : (
                              <span className="font-medium text-gray-900">{entry.session_date}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-500">{entry.section || '—'}</td>
                          <td className="px-3 py-2 text-gray-500">{entry.class_name || '—'}</td>
                          <td className="px-3 py-2">{entry.system_no || '—'}</td>
                          <td className="px-3 py-2 text-center">
                            {entry.signature_present != null ? (
                              entry.signature_present ? (
                                <span className="badge-success">Yes</span>
                              ) : (
                                <span className="badge-danger">No</span>
                              )
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500">
                            {entry.remarks || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-2 text-right text-xs text-gray-400">
                    {studentHistory.length} session{studentHistory.length !== 1 ? 's' : ''} total
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}


    </div>
  );
}
