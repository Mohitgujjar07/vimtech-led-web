'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  Monitor,
  AlertTriangle,
  Users,
  Search,
  ChevronRight,
  ChevronLeft,
  CalendarDays,
  Layers,
  Loader2,
  BarChart3,
  Calendar,
  UserSearch,
  X,
  CheckCircle,
  Clock,
  Plus,
  TrendingUp,
  PieChart,
  CheckCircle2,
  Wrench,
  ShieldCheck,
  GraduationCap,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { createBrowserClient } from '@/lib/supabase';
import { LabSession, Student } from '@/lib/types';
import { normalizeAcademicSection, isHardwareDefectRemark } from '@/lib/constants';

interface ResolvedSystemRecord {
  system_no: string;
  resolved_at: string;
  resolution_notes?: string;
  resolved_by?: string;
}

interface FlaggedSystem {
  system_no: string;
  session_count: number;
  incident_count: number;
  sessions: { session_id?: string; session_date?: string; section?: string; remark?: string }[];
  remarks: string[];
  is_resolved?: boolean;
  resolved_at?: string;
  resolution_notes?: string;
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

const STORAGE_KEY = 'vimtech_resolved_systems_v1';

function getLocalResolvedSystems(): Record<string, ResolvedSystemRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalResolvedSystems(records: Record<string, ResolvedSystemRecord>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {}
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'systems' | 'students'>('overview');

  // Overview stats
  const [totalSessions, setTotalSessions] = useState(0);
  const [confirmedSessions, setConfirmedSessions] = useState(0);
  const [enrolledStudents, setEnrolledStudents] = useState(0);
  const [totalAttendances, setTotalAttendances] = useState(0);
  const [avgAttendance, setAvgAttendance] = useState(0);
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
  const [sectionTurnout, setSectionTurnout] = useState<{
    section: string;
    degree: string;
    semester: string | null;
    year: string | null;
    sessionsCount: number;
    totalAttendance: number;
    avgAttendance: number;
    badgeLabel: string;
    badgeVariant: 'purple' | 'blue' | 'emerald' | 'amber' | 'gray';
  }[]>([]);
  const [academicProgramFilter, setAcademicProgramFilter] = useState<'ALL' | 'BCA' | 'PUC' | 'SPECIAL'>('ALL');

  // Calendar & Time-Series Analytics State
  const [timeHorizon, setTimeHorizon] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  const [dailyTimeline, setDailyTimeline] = useState<{
    dateStr: string;
    label: string;
    fullDateLabel: string;
    sessionsCount: number;
    totalAttendance: number;
    avgOccupancyPct: number;
    sessions: LabSession[];
  }[]>([]);

  const [weeklyTimeline, setWeeklyTimeline] = useState<{
    weekKey: string;
    label: string;
    sessionsCount: number;
    totalAttendance: number;
    avgAttendance: number;
    avgOccupancyPct: number;
  }[]>([]);

  const [monthlyTimeline, setMonthlyTimeline] = useState<{
    monthKey: string;
    label: string;
    sessionsCount: number;
    totalAttendance: number;
    avgAttendance: number;
    avgOccupancyPct: number;
  }[]>([]);

  const [capacityTiers, setCapacityTiers] = useState({
    high: 0,
    moderate: 0,
    low: 0,
    total: 0,
  });

  // Flagged systems & Resolution state
  const [flaggedSystems, setFlaggedSystems] = useState<FlaggedSystem[]>([]);
  const [resolvedMap, setResolvedMap] = useState<Record<string, ResolvedSystemRecord>>({});
  const [systemsFilter, setSystemsFilter] = useState<'active' | 'resolved' | 'all'>('active');
  const [systemToResolve, setSystemToResolve] = useState<FlaggedSystem | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolvingLoading, setResolvingLoading] = useState(false);

  // Student history
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentHistory, setStudentHistory] = useState<StudentHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchingStudents, setSearchingStudents] = useState(false);

  const [sessions, setSessions] = useState<LabSession[]>([]);

  // Debounce timer for student search
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadOverview();
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  const loadOverview = async () => {
    const supabase = createBrowserClient();

    const [sessionsRes, entriesRes, studentsCountRes] = await Promise.all([
      supabase.from('lab_sessions').select('*').order('session_date', { ascending: false }),
      supabase.from('lab_entries').select('session_id, system_no, raw_ucms_ocr, raw_name_ocr, signature_present, remarks, created_at'),
      supabase.from('students').select('id', { count: 'exact', head: true }),
    ]);

    const allSessions = sessionsRes.data || [];
    setSessions(allSessions);
    setTotalSessions(allSessions.length);
    setConfirmedSessions(allSessions.filter((s) => s.faculty_confirmed).length);

    const entryRows = entriesRes.data || [];
    setTotalAttendances(entryRows.length);
    setAvgAttendance(allSessions.length > 0 ? Math.round(entryRows.length / allSessions.length) : 0);

    // Official enrolled student count from roster (fallback to 60 if null or 0)
    const rosterCount = studentsCountRes.count;
    setEnrolledStudents(rosterCount && rosterCount > 0 ? rosterCount : 60);

    // Load local resolved records
    const localResolved = getLocalResolvedSystems();
    setResolvedMap(localResolved);

    // Map sessions by ID
    const sessionLookup = new Map<string, LabSession>();
    for (const s of allSessions) {
      sessionLookup.set(s.id, s);
    }

    // Build counts, hardware categories & smart defect detection
    try {
      const countMap = new Map<string, number>();
      let mouseCount = 0;
      let keyboardCount = 0;
      let displayCount = 0;
      let otherCount = 0;
      let signedCount = 0;
      let unsignedCount = 0;

      const systemIncidentsMap = new Map<
        string,
        {
          sessions: { session_id?: string; session_date?: string; section?: string; remark?: string }[];
          remarks: string[];
        }
      >();

      for (const row of entryRows) {
        if (row.session_id) {
          countMap.set(row.session_id, (countMap.get(row.session_id) || 0) + 1);
        }

        if (row.signature_present) {
          signedCount++;
        } else {
          unsignedCount++;
        }

        const sysNo = (row.system_no || '').trim();
        const rem = (row.remarks || '').trim();

        // Only process legitimate hardware defects (filter out student names)
        if (rem && isHardwareDefectRemark(rem)) {
          const remLower = rem.toLowerCase();
          if (remLower.includes('mouse') || remLower.includes('scroll') || remLower.includes('cursor') || remLower.includes('click')) {
            mouseCount++;
          } else if (remLower.includes('keyboard') || remLower.includes('key') || remLower.includes('space')) {
            keyboardCount++;
          } else if (remLower.includes('monitor') || remLower.includes('screen') || remLower.includes('display') || remLower.includes('flicker')) {
            displayCount++;
          } else {
            otherCount++;
          }

          if (sysNo) {
            const sess = row.session_id ? sessionLookup.get(row.session_id) : undefined;
            const existing = systemIncidentsMap.get(sysNo) || { sessions: [], remarks: [] };
            existing.remarks.push(rem);
            existing.sessions.push({
              session_id: row.session_id,
              session_date: sess?.session_date || 'N/A',
              section: sess?.section || 'General',
              remark: rem,
            });
            systemIncidentsMap.set(sysNo, existing);
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

      // ── Daily Timeline Aggregation ──
      const dateMap = new Map<string, { sessions: LabSession[]; attendees: number }>();
      for (const s of allSessions) {
        if (!s.session_date) continue;
        const count = countMap.get(s.id) || s.total_system_count || 0;
        const existing = dateMap.get(s.session_date) || { sessions: [], attendees: 0 };
        existing.sessions.push(s);
        existing.attendees += count;
        dateMap.set(s.session_date, existing);
      }

      const sortedDates = Array.from(dateMap.keys()).sort();
      const daily = sortedDates.map((dateStr) => {
        const item = dateMap.get(dateStr)!;
        let shortLabel = dateStr;
        let fullLabel = dateStr;
        try {
          const d = new Date(dateStr + 'T00:00:00');
          shortLabel = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
          fullLabel = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        } catch {}

        const cap = item.sessions.length * 60;
        const pct = Math.min(100, Math.round((item.attendees / Math.max(1, cap)) * 100));

        return {
          dateStr,
          label: shortLabel,
          fullDateLabel: fullLabel,
          sessionsCount: item.sessions.length,
          totalAttendance: item.attendees,
          avgOccupancyPct: pct,
          sessions: item.sessions,
        };
      });
      setDailyTimeline(daily);

      // ── Weekly Timeline Aggregation ──
      const weekMap = new Map<string, { sessions: LabSession[]; attendees: number; startDate: Date; label: string }>();
      for (const s of allSessions) {
        if (!s.session_date) continue;
        try {
          const d = new Date(s.session_date + 'T00:00:00');
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday of week
          const monday = new Date(d.getFullYear(), d.getMonth(), diff);
          const weekKey = `${monday.getFullYear()}-W${String(Math.ceil((monday.getDate() + 6) / 7)).padStart(2, '0')}-${monday.getMonth()}`;
          const weekLabel = `Week of ${monday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;

          const count = countMap.get(s.id) || s.total_system_count || 0;
          const existing = weekMap.get(weekKey) || { sessions: [], attendees: 0, startDate: monday, label: weekLabel };
          existing.sessions.push(s);
          existing.attendees += count;
          weekMap.set(weekKey, existing);
        } catch {}
      }

      const weekly = Array.from(weekMap.entries()).map(([weekKey, item]) => {
        const cap = item.sessions.length * 60;
        return {
          weekKey,
          label: item.label,
          sessionsCount: item.sessions.length,
          totalAttendance: item.attendees,
          avgAttendance: Math.round(item.attendees / Math.max(1, item.sessions.length)),
          avgOccupancyPct: Math.min(100, Math.round((item.attendees / Math.max(1, cap)) * 100)),
        };
      });
      setWeeklyTimeline(weekly);

      // ── Monthly Timeline Aggregation ──
      const monthMap = new Map<string, { sessions: LabSession[]; attendees: number }>();
      for (const s of allSessions) {
        if (!s.session_date) continue;
        const mKey = s.session_date.slice(0, 7);
        const count = countMap.get(s.id) || s.total_system_count || 0;
        const existing = monthMap.get(mKey) || { sessions: [], attendees: 0 };
        existing.sessions.push(s);
        existing.attendees += count;
        monthMap.set(mKey, existing);
      }

      const sortedMonths = Array.from(monthMap.keys()).sort();
      const monthly = sortedMonths.map((mKey) => {
        const item = monthMap.get(mKey)!;
        let label = mKey;
        try {
          const d = new Date(mKey + '-01T00:00:00');
          label = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
        } catch {}

        const cap = item.sessions.length * 60;
        return {
          monthKey: mKey,
          label,
          sessionsCount: item.sessions.length,
          totalAttendance: item.attendees,
          avgAttendance: Math.round(item.attendees / Math.max(1, item.sessions.length)),
          avgOccupancyPct: Math.min(100, Math.round((item.attendees / Math.max(1, cap)) * 100)),
        };
      });
      setMonthlyTimeline(monthly);

      // ── Capacity Tiers Distribution ──
      let highCap = 0;
      let modCap = 0;
      let lowCap = 0;
      for (const s of allSessions) {
        const occupied = countMap.get(s.id) || s.total_system_count || 0;
        const cap = s.total_system_count || Math.max(60, occupied);
        const pct = Math.round((occupied / Math.max(1, cap)) * 100);
        if (pct >= 85) highCap++;
        else if (pct >= 60) modCap++;
        else lowCap++;
      }
      setCapacityTiers({
        high: highCap,
        moderate: modCap,
        low: lowCap,
        total: allSessions.length,
      });

      // ── Initialize Calendar Focus to latest session month ──
      if (allSessions.length > 0) {
        const latestDate = allSessions[0].session_date;
        try {
          const d = new Date(latestDate + 'T00:00:00');
          if (!isNaN(d.getTime())) {
            setCalendarMonth(new Date(d.getFullYear(), d.getMonth(), 1));
            setSelectedCalendarDate(latestDate);
          }
        } catch {}
      }

      // Section turnout aggregation structured by academic program
      const academicSectionMap = new Map<string, { count: number; attendees: number; sampleClass: string | null }>();
      for (const s of allSessions) {
        const academic = normalizeAcademicSection(s.section, s.class_name);
        const key = academic.section;
        const attendees = countMap.get(s.id) || s.total_system_count || 0;
        const existing = academicSectionMap.get(key) || { count: 0, attendees: 0, sampleClass: s.class_name };
        academicSectionMap.set(key, {
          count: existing.count + 1,
          attendees: existing.attendees + attendees,
          sampleClass: existing.sampleClass || s.class_name,
        });
      }

      const turnout = Array.from(academicSectionMap.entries()).map(([section, data]) => {
        const academic = normalizeAcademicSection(section, data.sampleClass);
        return {
          section,
          degree: academic.degree,
          semester: academic.semester,
          year: academic.year,
          sessionsCount: data.count,
          totalAttendance: data.attendees,
          avgAttendance: data.count > 0 ? Math.round(data.attendees / data.count) : 0,
          badgeLabel: academic.badgeLabel,
          badgeVariant: academic.badgeVariant,
        };
      });

      // Sort turnout by Degree, Year, and Semester
      turnout.sort((a, b) => {
        if (a.degree !== b.degree) return a.degree.localeCompare(b.degree);
        if (a.year !== b.year) return (a.year || '').localeCompare(b.year || '');
        return (a.semester || '').localeCompare(b.semester || '');
      });
      setSectionTurnout(turnout);

      // Build flagged systems list
      const allSystemNos = new Set<string>([
        ...Array.from(systemIncidentsMap.keys()),
        ...Object.keys(localResolved),
      ]);

      const builtFlaggedSystems: FlaggedSystem[] = [];
      for (const sysNo of allSystemNos) {
        const data = systemIncidentsMap.get(sysNo) || { sessions: [], remarks: [] };
        const res = localResolved[sysNo];
        const isResolved = !!res;

        builtFlaggedSystems.push({
          system_no: sysNo,
          session_count: data.sessions.length,
          incident_count: data.remarks.length,
          sessions: data.sessions,
          remarks: data.remarks.length > 0 ? data.remarks : [res?.resolution_notes || 'Resolved issue'],
          is_resolved: isResolved,
          resolved_at: res?.resolved_at,
          resolution_notes: res?.resolution_notes,
        });
      }

      builtFlaggedSystems.sort((a, b) => {
        if (a.is_resolved !== b.is_resolved) {
          return a.is_resolved ? 1 : -1;
        }
        return b.incident_count - a.incident_count;
      });

      setFlaggedSystems(builtFlaggedSystems);
    } catch {
      setCountMismatches([]);
    }

    setLoading(false);
  };

  const handleConfirmSolve = async () => {
    if (!systemToResolve) return;
    setResolvingLoading(true);
    const updated = { ...resolvedMap };
    const note = resolutionNotes.trim() || 'Hardware inspected and verified operational';
    updated[systemToResolve.system_no] = {
      system_no: systemToResolve.system_no,
      resolved_at: new Date().toISOString(),
      resolution_notes: note,
      resolved_by: 'Faculty / Lab In-Charge',
    };
    saveLocalResolvedSystems(updated);
    setResolvedMap(updated);

    // Optional background sync to Supabase table
    try {
      const supabase = createBrowserClient();
      await supabase.from('system_maintenance').insert({
        system_no: systemToResolve.system_no,
        issue_description: systemToResolve.remarks.join('; '),
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: 'Faculty / Admin',
        resolution_notes: note,
      });
    } catch {
      // Graceful fallback
    }

    const solvedSysNo = systemToResolve.system_no;
    setSystemToResolve(null);
    setResolutionNotes('');
    setResolvingLoading(false);
    toast.success(`System #${solvedSysNo} marked as solved!`);
    loadOverview();
  };

  const handleReopenSystem = (systemNo: string) => {
    const updated = { ...resolvedMap };
    delete updated[systemNo];
    saveLocalResolvedSystems(updated);
    setResolvedMap(updated);
    toast.info(`System #${systemNo} reopened and marked active`);
    loadOverview();
  };

  const handleDismissFlag = (systemNo: string) => {
    const updated = { ...resolvedMap };
    updated[systemNo] = {
      system_no: systemNo,
      resolved_at: new Date().toISOString(),
      resolution_notes: 'Dismissed (non-hardware remark)',
      resolved_by: 'Faculty / Admin',
    };
    saveLocalResolvedSystems(updated);
    setResolvedMap(updated);
    toast.success(`System #${systemNo} flag dismissed`);
    loadOverview();
  };

  const loadFlaggedSystems = async () => {
    await loadOverview();
  };

  const getCalendarDays = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const sessionDateMap = new Map<string, LabSession[]>();
    for (const s of sessions) {
      if (s.session_date) {
        const list = sessionDateMap.get(s.session_date) || [];
        list.push(s);
        sessionDateMap.set(s.session_date, list);
      }
    }

    const days: {
      dayNumber: number | null;
      dateStr: string | null;
      sessions: LabSession[];
      hasSessions: boolean;
      totalAttendees: number;
    }[] = [];

    for (let i = 0; i < firstDayIndex; i++) {
      days.push({
        dayNumber: null,
        dateStr: null,
        sessions: [],
        hasSessions: false,
        totalAttendees: 0,
      });
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const daySessions = sessionDateMap.get(dateStr) || [];
      const totalAttendees = daySessions.reduce((acc, s) => acc + (s.total_system_count || 0), 0);
      days.push({
        dayNumber: d,
        dateStr,
        sessions: daySessions,
        hasSessions: daySessions.length > 0,
        totalAttendees,
      });
    }

    return days;
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
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
          Analytics Dashboard
        </h1>
        <p className="mt-0.5 text-xs sm:text-sm text-gray-500">
          Hardware tracking, signature compliance, and lab usage cross-checks
        </p>
      </div>

      {/* Responsive Tabs Segmented Bar */}
      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-gray-200/80 p-1 no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'systems' && flaggedSystems.length === 0) loadFlaggedSystems();
              }}
              className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-brand-700 shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Stats cards */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                {/* 1. Total Sessions */}
                <div className="card p-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50">
                      <Calendar className="h-4 w-4 text-brand-700" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-gray-900 leading-tight">{totalSessions}</p>
                      <p className="text-[11px] text-gray-500">Total Sessions</p>
                      <p className="text-[10px] text-brand-700 font-medium">{confirmedSessions} confirmed</p>
                    </div>
                  </div>
                </div>

                {/* 2. Enrolled Students in Official Roster */}
                <div className="card p-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                      <GraduationCap className="h-4 w-4 text-blue-700" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-gray-900 leading-tight">{enrolledStudents}</p>
                      <p className="text-[11px] text-gray-500">Enrolled Students</p>
                      <p className="text-[10px] text-blue-600 font-medium">BCA &amp; PUC Roster</p>
                    </div>
                  </div>
                </div>

                {/* 3. Total Attendances Logged */}
                <div className="card p-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                      <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-gray-900 leading-tight">{totalAttendances}</p>
                      <p className="text-[11px] text-gray-500">Total Attendances</p>
                      <p className="text-[10px] text-emerald-700 font-medium">~{avgAttendance} avg / session</p>
                    </div>
                  </div>
                </div>

                {/* 4. Count Mismatches */}
                <div className="card p-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${countMismatches.length > 0 ? 'bg-rose-50' : 'bg-green-50'}`}>
                      <AlertTriangle className={`h-4 w-4 ${countMismatches.length > 0 ? 'text-rose-700' : 'text-green-700'}`} />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-gray-900 leading-tight">{countMismatches.length}</p>
                      <p className="text-[11px] text-gray-500">Audit Discrepancies</p>
                      <p className={`text-[10px] font-medium ${countMismatches.length > 0 ? 'text-rose-600' : 'text-green-700'}`}>
                        {countMismatches.length > 0 ? 'Header vs Row count' : 'All matched'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 5. Lab Hardware Status */}
                <div
                  onClick={() => setActiveTab('systems')}
                  className="card p-3.5 cursor-pointer transition-all hover:border-amber-300 hover:shadow-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      flaggedSystems.filter((s) => !s.is_resolved).length > 0 ? 'bg-amber-50' : 'bg-emerald-50'
                    }`}>
                      <Monitor className={`h-4 w-4 ${
                        flaggedSystems.filter((s) => !s.is_resolved).length > 0 ? 'text-amber-700' : 'text-emerald-700'
                      }`} />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-gray-900 leading-tight">
                        {flaggedSystems.filter((s) => !s.is_resolved).length}
                      </p>
                      <p className="text-[11px] text-gray-500">Active Lab Defects</p>
                      <p className="text-[10px] text-amber-700 font-medium">
                        {flaggedSystems.filter((s) => s.is_resolved).length} resolved
                      </p>
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

              {/* Flagged Systems Overview Widget */}
              {flaggedSystems.length > 0 && (
                <div className="card">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                      <Wrench className="h-4 w-4 text-amber-600" />
                      Hardware Maintenance &amp; Defect Tracking
                    </h3>
                    <button
                      onClick={() => setActiveTab('systems')}
                      className="text-xs font-semibold text-brand-700 hover:underline"
                    >
                      Manage Systems →
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Verified machine issues (mouse, keyboard, display, power) extracted from student remarks
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {flaggedSystems.slice(0, 6).map((sys) => {
                      const count = sys.incident_count ?? sys.session_count ?? (sys.remarks?.length || 0);
                      const latestRemark = sys.sessions?.[0]?.remark ?? sys.remarks?.[0] ?? 'Recurring defect';
                      return (
                        <div
                          key={sys.system_no}
                          onClick={() => setActiveTab('systems')}
                          className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-colors ${
                            sys.is_resolved
                              ? 'border-emerald-100 bg-emerald-50/40 hover:bg-emerald-50'
                              : 'border-amber-200 bg-amber-50/50 hover:bg-amber-100/60'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-gray-900">PC #{sys.system_no}</p>
                              {sys.is_resolved && (
                                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                                  Solved
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 truncate max-w-[180px]">{latestRemark}</p>
                          </div>
                          <span className={sys.is_resolved ? 'badge-success text-[10px]' : 'badge-warning text-[10px]'}>
                            {sys.is_resolved ? 'Operational' : `${count} flag${count !== 1 ? 's' : ''}`}
                          </span>
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
                    {sessions.slice(0, 10).map((session) => {
                      const academic = normalizeAcademicSection(session.section, session.class_name);
                      return (
                        <Link
                          key={session.id}
                          href={`/sessions/${session.id}`}
                          className="flex items-center justify-between p-3.5 transition-colors hover:bg-gray-50/80"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
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
                                <span
                                  className={`rounded-md px-2 py-0.5 text-[11px] font-bold border ${
                                    academic.badgeVariant === 'purple'
                                      ? 'bg-purple-50 text-purple-800 border-purple-200'
                                      : academic.badgeVariant === 'blue'
                                      ? 'bg-blue-50 text-blue-800 border-blue-200'
                                      : academic.badgeVariant === 'emerald'
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : academic.badgeVariant === 'amber'
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : 'bg-gray-50 text-gray-700 border-gray-200'
                                  }`}
                                >
                                  {academic.badgeLabel}
                                </span>
                                {session.faculty_confirmed ? (
                                  <span className="badge-success text-[10px]">Confirmed</span>
                                ) : (
                                  <span className="badge-warning text-[10px]">Draft (Needs Review)</span>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
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
                      );
                    })}
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
          {/* Header Summary & Time Horizon Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Lab Activity &amp; Utilization Intelligence</h2>
              <p className="text-xs text-gray-500">
                Time-series attendance trends, monthly calendar activity, and system capacity distribution
              </p>
            </div>

            {/* Time Horizon Segmented Control (Daily / Weekly / Monthly) */}
            <div className="flex rounded-2xl bg-gray-200/80 p-1 text-xs font-semibold self-start sm:self-auto">
              <button
                onClick={() => setTimeHorizon('daily')}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition-all ${
                  timeHorizon === 'daily'
                    ? 'bg-white text-brand-700 shadow-2xs font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                <span>Daily</span>
              </button>
              <button
                onClick={() => setTimeHorizon('weekly')}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition-all ${
                  timeHorizon === 'weekly'
                    ? 'bg-white text-brand-700 shadow-2xs font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Weekly</span>
              </button>
              <button
                onClick={() => setTimeHorizon('monthly')}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition-all ${
                  timeHorizon === 'monthly'
                    ? 'bg-white text-brand-700 shadow-2xs font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>Monthly</span>
              </button>
            </div>
          </div>

          {/* Period Summary Metric Cards (4 Balanced Cards) */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="card p-3.5">
              <p className="text-[11px] text-gray-500">
                {timeHorizon === 'daily' ? 'Active Lab Days' : timeHorizon === 'weekly' ? 'Active Weeks' : 'Active Months'}
              </p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">
                {timeHorizon === 'daily' ? dailyTimeline.length : timeHorizon === 'weekly' ? weeklyTimeline.length : monthlyTimeline.length}
              </p>
              <p className="text-[10px] text-brand-700 font-medium">
                {totalSessions} total sessions
              </p>
            </div>

            <div className="card p-3.5">
              <p className="text-[11px] text-gray-500">Total Attendees Logged</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{totalAttendances}</p>
              <p className="text-[10px] text-blue-600 font-medium">
                ~{avgAttendance} per session
              </p>
            </div>

            <div className="card p-3.5">
              <p className="text-[11px] text-gray-500">Optimal Lab Usage</p>
              <p className="text-xl font-bold text-emerald-700 mt-0.5">
                {capacityTiers.total > 0
                  ? Math.round(((capacityTiers.high + capacityTiers.moderate) / capacityTiers.total) * 100)
                  : 100}%
              </p>
              <p className="text-[10px] text-emerald-600 font-medium">
                {capacityTiers.high} full sessions (≥85%)
              </p>
            </div>

            <div className="card p-3.5">
              <p className="text-[11px] text-gray-500">Signature Compliance</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{signatureStats.pct}%</p>
              <p className="text-[10px] text-green-700 font-medium">
                {signatureStats.signed} verified signatures
              </p>
            </div>
          </div>

          {/* Main Feature: Interactive Lab Activity Calendar & Day Inspector */}
          <div className="card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Lab Activity Calendar</h3>
                  <p className="text-xs text-gray-500">
                    Tap any day to inspect ledger sessions, enrolled sections, and faculty
                  </p>
                </div>
              </div>

              {/* Month Navigator Controls */}
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-xl border border-gray-200 bg-white p-0.5 shadow-2xs">
                  <button
                    onClick={() => {
                      setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
                    }}
                    className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 transition-colors"
                    title="Previous Month"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="min-w-[120px] text-center text-xs font-bold text-gray-800">
                    {calendarMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    onClick={() => {
                      setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
                    }}
                    className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 transition-colors"
                    title="Next Month"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* Reset to Today / Latest */}
                {sessions.length > 0 && (
                  <button
                    onClick={() => {
                      try {
                        const d = new Date(sessions[0].session_date + 'T00:00:00');
                        setCalendarMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                        setSelectedCalendarDate(sessions[0].session_date);
                      } catch {}
                    }}
                    className="rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 transition-all"
                  >
                    Latest Session
                  </button>
                )}
              </div>
            </div>

            {/* Calendar Matrix & Day Detail Split Grid */}
            <div className="grid gap-5 lg:grid-cols-12">
              {/* Calendar Grid (7 columns, 8 of 12 columns on desktop) */}
              <div className="lg:col-span-7 xl:col-span-8">
                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-gray-400 mb-1.5 uppercase tracking-wider">
                  <span>Sun</span>
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                </div>

                {/* Calendar Cells */}
                <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                  {getCalendarDays().map((day, idx) => {
                    if (!day.dayNumber) {
                      return (
                        <div
                          key={`empty-${idx}`}
                          className="h-14 sm:h-16 rounded-xl bg-gray-50/40 border border-transparent"
                        />
                      );
                    }

                    const isSelected = selectedCalendarDate === day.dateStr;
                    return (
                      <button
                        key={day.dateStr}
                        onClick={() => setSelectedCalendarDate(day.dateStr)}
                        className={`h-14 sm:h-16 rounded-xl border p-1 sm:p-1.5 text-left transition-all flex flex-col justify-between relative ${
                          isSelected
                            ? 'border-brand-600 bg-brand-50/70 ring-2 ring-brand-600/30 shadow-xs'
                            : day.hasSessions
                            ? 'border-brand-200 bg-white hover:border-brand-400 hover:shadow-2xs'
                            : 'border-gray-100 bg-gray-50/30 text-gray-400 hover:bg-gray-50 hover:border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs font-bold leading-none ${
                              isSelected
                                ? 'text-brand-800'
                                : day.hasSessions
                                ? 'text-gray-900 font-extrabold'
                                : 'text-gray-400'
                            }`}
                          >
                            {day.dayNumber}
                          </span>
                          {day.hasSessions && (
                            <span className="h-1.5 w-1.5 rounded-full bg-brand-600 sm:hidden" />
                          )}
                        </div>

                        {day.hasSessions ? (
                          <div className="space-y-0.5">
                            <span className="hidden sm:inline-block rounded-md bg-brand-100/90 px-1 py-0.5 text-[9px] font-bold text-brand-800 truncate max-w-full">
                              {day.sessions.length} sess • {day.totalAttendees}
                            </span>
                            <span className="sm:hidden text-[9px] font-bold text-brand-700">
                              {day.totalAttendees}p
                            </span>
                          </div>
                        ) : (
                          <span className="text-[9px] text-gray-300 select-none">&nbsp;</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Day Inspector Panel (4 of 12 columns on desktop) */}
              <div className="lg:col-span-5 xl:col-span-4 rounded-xl border border-gray-100 bg-gray-50/60 p-3.5 flex flex-col justify-between">
                {(() => {
                  const daySessions = selectedCalendarDate
                    ? sessions.filter((s) => s.session_date === selectedCalendarDate)
                    : [];
                  const formattedSelected = selectedCalendarDate
                    ? (() => {
                        try {
                          return new Date(selectedCalendarDate + 'T00:00:00').toLocaleDateString('en-IN', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          });
                        } catch {
                          return selectedCalendarDate;
                        }
                      })()
                    : 'Select a Date';

                  return (
                    <div>
                      <div className="flex items-center justify-between border-b border-gray-200/80 pb-2.5">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                            Daily Inspector
                          </p>
                          <h4 className="text-sm font-bold text-gray-900 leading-tight">
                            {formattedSelected}
                          </h4>
                        </div>
                        {daySessions.length > 0 && (
                          <span className="badge-info text-xs">
                            {daySessions.length} session{daySessions.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      <div className="mt-3 space-y-2 max-h-[260px] overflow-y-auto pr-1">
                        {daySessions.length === 0 ? (
                          <div className="py-8 text-center text-gray-400">
                            <Clock className="mx-auto h-7 w-7 text-gray-300" />
                            <p className="mt-2 text-xs">No sessions conducted on this date</p>
                            <Link
                              href="/sessions/new"
                              className="btn-secondary mt-3 inline-flex text-xs py-1 px-2.5"
                            >
                              Log Session
                            </Link>
                          </div>
                        ) : (
                          daySessions.map((session) => {
                            const academic = normalizeAcademicSection(session.section, session.class_name);
                            return (
                              <Link
                                key={session.id}
                                href={`/sessions/${session.id}`}
                                className="block rounded-xl border border-gray-200 bg-white p-2.5 shadow-2xs transition-all hover:border-brand-300 hover:shadow-xs group"
                              >
                                <div className="flex items-start justify-between gap-1.5">
                                  <span
                                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold border ${
                                      academic.badgeVariant === 'purple'
                                        ? 'bg-purple-50 text-purple-800 border-purple-200'
                                        : academic.badgeVariant === 'blue'
                                        ? 'bg-blue-50 text-blue-800 border-blue-200'
                                        : academic.badgeVariant === 'emerald'
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                        : academic.badgeVariant === 'amber'
                                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                                        : 'bg-gray-50 text-gray-700 border-gray-200'
                                    }`}
                                  >
                                    {academic.badgeLabel}
                                  </span>
                                  <span
                                    className={
                                      session.faculty_confirmed
                                        ? 'badge-success text-[9px]'
                                        : 'badge-warning text-[9px]'
                                    }
                                  >
                                    {session.faculty_confirmed ? 'Confirmed' : 'Draft'}
                                  </span>
                                </div>

                                <div className="mt-1.5 flex items-center justify-between text-xs text-gray-600">
                                  <span>{session.faculty_name || 'Faculty: Not specified'}</span>
                                  <span className="font-bold text-gray-900">
                                    {session.total_system_count ?? '—'} PCs
                                  </span>
                                </div>
                              </Link>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Chart Row 1: Time Horizon Dynamic Bar Chart */}
          <div className="card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <TrendingUp className="h-4 w-4 text-brand-600" />
                  {timeHorizon === 'daily'
                    ? 'Daily Attendance & Lab Utilization'
                    : timeHorizon === 'weekly'
                    ? 'Weekly Aggregated Lab Turnout'
                    : 'Monthly Lab Session Volume'}
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  {timeHorizon === 'daily'
                    ? 'Student count and percentage of lab capacity utilized per active day'
                    : timeHorizon === 'weekly'
                    ? 'Week-over-week attendance volume and average turnout per session'
                    : 'Month-over-month attendance records and peak utilization'}
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

            {/* Dynamic Rendering of Timeline Bars */}
            {(() => {
              const currentList =
                timeHorizon === 'daily'
                  ? dailyTimeline.slice(-10)
                  : timeHorizon === 'weekly'
                  ? weeklyTimeline
                  : monthlyTimeline;

              if (currentList.length === 0) {
                return (
                  <div className="py-12 text-center text-xs text-gray-400">
                    No session records available for {timeHorizon} timeline
                  </div>
                );
              }

              return (
                <div className="pt-2">
                  <div className="flex h-56 items-end gap-2 sm:gap-4 border-b border-gray-200 pb-3 pt-4 px-2">
                    {currentList.map((item, idx) => {
                      const pct = item.avgOccupancyPct;
                      const barColor =
                        pct >= 85
                          ? 'bg-emerald-500 hover:bg-emerald-600'
                          : pct >= 60
                          ? 'bg-amber-500 hover:bg-amber-600'
                          : 'bg-rose-500 hover:bg-rose-600';

                      return (
                        <div
                          key={idx}
                          className="group relative flex flex-1 flex-col items-center h-full justify-end cursor-pointer"
                          onClick={() => {
                            if ('dateStr' in item && item.dateStr) {
                              setSelectedCalendarDate(item.dateStr);
                            }
                          }}
                        >
                          {/* Hover Tooltip */}
                          <div className="pointer-events-none absolute -top-14 z-20 hidden rounded-lg bg-gray-900 px-2.5 py-1.5 text-center text-[11px] font-medium text-white shadow-md group-hover:block whitespace-nowrap">
                            <span className="font-bold">{item.label}</span>
                            <br />
                            {item.totalAttendance} student attendees ({pct}% fill)
                            <br />
                            {item.sessionsCount} session{item.sessionsCount !== 1 ? 's' : ''}
                          </div>

                          {/* Top Metric */}
                          <span className="mb-1 text-[10px] sm:text-[11px] font-bold text-gray-700">
                            {item.totalAttendance}
                          </span>

                          {/* Bar */}
                          <div className="w-full max-w-[48px] rounded-t-md bg-gray-100 flex flex-col justify-end h-full">
                            <div
                              style={{ height: `${Math.max(10, pct)}%` }}
                              className={`w-full rounded-t-md transition-all duration-300 ${barColor}`}
                            />
                          </div>

                          {/* Bottom Label */}
                          <span className="mt-2 text-[10px] font-medium text-gray-500 truncate max-w-[55px] sm:max-w-[70px]">
                            {item.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Symmetrical Grid Row 1: Academic Turnout & Capacity Intelligence */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Card A1: Academic Turnout by Program */}
            <div className="card flex flex-col justify-between space-y-4">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <PieChart className="h-4 w-4 text-purple-600" />
                      Academic Turnout by Program &amp; Semester
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Average attendance volume and capacity utilization per section
                    </p>
                  </div>

                  <div className="flex rounded-xl bg-gray-100 p-0.5 text-xs font-semibold">
                    {(['ALL', 'BCA', 'PUC', 'SPECIAL'] as const).map((prog) => (
                      <button
                        key={prog}
                        onClick={() => setAcademicProgramFilter(prog)}
                        className={`rounded-lg px-2 py-1 transition-all ${
                          academicProgramFilter === prog
                            ? 'bg-white text-brand-700 shadow-2xs font-bold'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {prog === 'ALL' ? 'All' : prog === 'SPECIAL' ? 'Workshops' : prog}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {sectionTurnout
                    .filter((sec) => {
                      if (academicProgramFilter === 'ALL') return true;
                      if (academicProgramFilter === 'BCA') return sec.degree === 'BCA';
                      if (academicProgramFilter === 'PUC') return sec.degree === 'PUC';
                      return sec.degree !== 'BCA' && sec.degree !== 'PUC';
                    })
                    .map((sec) => {
                      const fillRate = Math.min(100, Math.round((sec.avgAttendance / 60) * 100));
                      return (
                        <div
                          key={sec.section}
                          className="rounded-xl border border-gray-100 bg-gray-50/50 p-3 transition-colors hover:bg-gray-50"
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`rounded-md px-2 py-0.5 text-[11px] font-bold border ${
                                sec.badgeVariant === 'purple'
                                  ? 'bg-purple-50 text-purple-800 border-purple-200'
                                  : sec.badgeVariant === 'blue'
                                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                                  : sec.badgeVariant === 'emerald'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : sec.badgeVariant === 'amber'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-gray-50 text-gray-700 border-gray-200'
                              }`}
                            >
                              {sec.badgeLabel}
                            </span>
                            <span className="text-xs font-bold text-gray-700">
                              ~{sec.avgAttendance} students <span className="font-normal text-gray-400">({sec.sessionsCount} sess)</span>
                            </span>
                          </div>
                          <div className="mt-2 h-2 w-full rounded-full bg-gray-200/80 overflow-hidden">
                            <div
                              style={{ width: `${fillRate}%` }}
                              className={`h-full rounded-full ${
                                fillRate >= 80 ? 'bg-emerald-500' : fillRate >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>Lab Capacity Benchmark: 60 Systems</span>
                <span className="font-semibold text-brand-700">{sectionTurnout.length} Tracked Sections</span>
              </div>
            </div>

            {/* Card A2: Lab Capacity Utilization Breakdown */}
            <div className="card flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <Layers className="h-4 w-4 text-emerald-600" />
                      Lab Capacity Utilization Breakdown
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Distribution of sessions by seat efficiency relative to 60 capacity
                    </p>
                  </div>
                  <span className="badge-info text-xs">{totalSessions} Sessions</span>
                </div>

                <div className="mt-5 space-y-4">
                  {/* High Capacity */}
                  <div>
                    <div className="flex justify-between text-xs font-medium text-gray-700 mb-1">
                      <span className="flex items-center gap-1.5 font-bold text-emerald-800">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        Full Capacity (≥85% Filled)
                      </span>
                      <span>
                        {capacityTiers.high} sessions (
                        {capacityTiers.total > 0
                          ? Math.round((capacityTiers.high / capacityTiers.total) * 100)
                          : 0}
                        %)
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div
                        style={{
                          width: `${
                            capacityTiers.total > 0
                              ? (capacityTiers.high / capacityTiers.total) * 100
                              : 0
                          }%`,
                        }}
                        className="h-full bg-emerald-500 rounded-full transition-all"
                      />
                    </div>
                  </div>

                  {/* Moderate Usage */}
                  <div>
                    <div className="flex justify-between text-xs font-medium text-gray-700 mb-1">
                      <span className="flex items-center gap-1.5 font-bold text-amber-800">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                        Moderate Usage (60–84% Filled)
                      </span>
                      <span>
                        {capacityTiers.moderate} sessions (
                        {capacityTiers.total > 0
                          ? Math.round((capacityTiers.moderate / capacityTiers.total) * 100)
                          : 0}
                        %)
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div
                        style={{
                          width: `${
                            capacityTiers.total > 0
                              ? (capacityTiers.moderate / capacityTiers.total) * 100
                              : 0
                          }%`,
                        }}
                        className="h-full bg-amber-500 rounded-full transition-all"
                      />
                    </div>
                  </div>

                  {/* Light Usage */}
                  <div>
                    <div className="flex justify-between text-xs font-medium text-gray-700 mb-1">
                      <span className="flex items-center gap-1.5 font-bold text-rose-800">
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                        Light Usage (&lt;60% Filled)
                      </span>
                      <span>
                        {capacityTiers.low} sessions (
                        {capacityTiers.total > 0
                          ? Math.round((capacityTiers.low / capacityTiers.total) * 100)
                          : 0}
                        %)
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div
                        style={{
                          width: `${
                            capacityTiers.total > 0
                              ? (capacityTiers.low / capacityTiers.total) * 100
                              : 0
                          }%`,
                        }}
                        className="h-full bg-rose-500 rounded-full transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-emerald-50/60 p-3 border border-emerald-100 text-xs text-emerald-900 flex items-center justify-between">
                <span className="font-medium">Lab Efficiency Score</span>
                <span className="font-bold text-emerald-800">
                  {capacityTiers.total > 0
                    ? Math.round(((capacityTiers.high + capacityTiers.moderate) / capacityTiers.total) * 100)
                    : 100}
                  % Optimal Utilization
                </span>
              </div>
            </div>
          </div>

          {/* Symmetrical Grid Row 2: Compliance & Hardware Diagnostics */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Card B1: Physical Signature Compliance */}
            <div className="card flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Physical Ledger Signature Compliance
                  </h3>
                  <span className="badge-info text-xs">{signatureStats.total} entries</span>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  Audit compliance rate of students physically signing the paper register
                </p>

                {/* Circular SVG Gauge */}
                <div className="my-5 flex flex-col items-center justify-center">
                  <div className="relative flex h-32 w-32 items-center justify-center">
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

            {/* Card B2: Hardware Defect Classification */}
            <div className="card flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <Wrench className="h-4 w-4 text-amber-600" />
                      Hardware Defect Classification
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Automated classification of authentic machine defect remarks
                    </p>
                  </div>
                  <span className="badge-warning text-xs">
                    {hardwareCategories.total} issues logged
                  </span>
                </div>

                <div className="mt-5 space-y-3.5">
                  {/* Mouse */}
                  <div>
                    <div className="flex justify-between text-xs font-medium text-gray-700 mb-1">
                      <span>🖱️ Mouse &amp; Pointing Devices</span>
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
                      <span>⌨️ Keyboards &amp; Keys</span>
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
                      <span>🖥️ Monitors &amp; Displays</span>
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

                  {/* Other / Power */}
                  <div>
                    <div className="flex justify-between text-xs font-medium text-gray-700 mb-1">
                      <span>⚡ Power, Network &amp; Other</span>
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
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {flaggedSystems.filter((s) => !s.is_resolved).length} active defects
                </span>
                <button
                  onClick={() => setActiveTab('systems')}
                  className="text-xs font-semibold text-brand-700 hover:underline"
                >
                  Manage Flagged Systems →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Flagged Systems Tab */}
      {activeTab === 'systems' && (
        <div className="mt-6 space-y-4">
          {/* Header & Sub-filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Lab Hardware &amp; System Defect Tracking</h2>
              <p className="text-xs text-gray-500">
                Extracted machine defect remarks with resolution notes and operational status
              </p>
            </div>

            {/* Active / Resolved Filter Tabs */}
            <div className="flex rounded-xl bg-gray-200/80 p-1 text-xs font-semibold">
              <button
                onClick={() => setSystemsFilter('active')}
                className={`rounded-lg px-3 py-1.5 transition-all ${
                  systemsFilter === 'active'
                    ? 'bg-white text-amber-800 shadow-2xs font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Active Issues ({flaggedSystems.filter((s) => !s.is_resolved).length})
              </button>
              <button
                onClick={() => setSystemsFilter('resolved')}
                className={`rounded-lg px-3 py-1.5 transition-all ${
                  systemsFilter === 'resolved'
                    ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Resolved ({flaggedSystems.filter((s) => s.is_resolved).length})
              </button>
              <button
                onClick={() => setSystemsFilter('all')}
                className={`rounded-lg px-3 py-1.5 transition-all ${
                  systemsFilter === 'all'
                    ? 'bg-white text-brand-700 shadow-2xs font-bold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All ({flaggedSystems.length})
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
            </div>
          ) : flaggedSystems.filter((s) => {
              if (systemsFilter === 'active') return !s.is_resolved;
              if (systemsFilter === 'resolved') return s.is_resolved;
              return true;
            }).length === 0 ? (
            <div className="card text-center py-12">
              <Monitor className="mx-auto h-10 w-10 text-emerald-400" />
              <p className="mt-3 text-sm font-semibold text-gray-800">
                {systemsFilter === 'active'
                  ? 'All lab systems are operational! No active hardware issues flagged.'
                  : systemsFilter === 'resolved'
                  ? 'No systems currently marked as resolved.'
                  : 'No hardware defects logged across sessions.'}
              </p>
              <p className="mt-1 text-xs text-gray-500 max-w-sm mx-auto">
                Legitimate hardware defects mentioned by students during sessions are automatically grouped here.
              </p>
            </div>
          ) : (
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {flaggedSystems
                .filter((s) => {
                  if (systemsFilter === 'active') return !s.is_resolved;
                  if (systemsFilter === 'resolved') return s.is_resolved;
                  return true;
                })
                .map((sys) => {
                  const count = sys.incident_count ?? sys.session_count ?? (sys.remarks?.length || 0);
                  return (
                    <div
                      key={sys.system_no}
                      className={`card flex flex-col justify-between transition-all ${
                        sys.is_resolved
                          ? 'border-emerald-200 bg-emerald-50/20'
                          : 'border-amber-200 bg-white'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                sys.is_resolved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              <Monitor className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 leading-tight">
                                System #{sys.system_no}
                              </p>
                              <p className="text-[11px] text-gray-500">
                                {count} defect incident{count !== 1 ? 's' : ''} logged
                              </p>
                            </div>
                          </div>

                          <span
                            className={
                              sys.is_resolved
                                ? 'badge-success text-[10px]'
                                : 'badge-warning text-[10px]'
                            }
                          >
                            {sys.is_resolved ? 'Operational' : 'Needs Repair'}
                          </span>
                        </div>

                        {/* Resolution info if resolved */}
                        {sys.is_resolved && (
                          <div className="mt-3 rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-900 border border-emerald-100">
                            <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              <span>Solved &amp; Verified</span>
                            </div>
                            <p className="mt-1 text-[11px] text-emerald-700">
                              {sys.resolution_notes || 'Hardware verified operational.'}
                            </p>
                            {sys.resolved_at && (
                              <p className="mt-0.5 text-[10px] text-emerald-600">
                                Logged: {new Date(sys.resolved_at).toLocaleDateString('en-IN')}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Recent Defect Remarks */}
                        <div className="mt-3 space-y-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            Reported Defects
                          </p>
                          {sys.sessions && sys.sessions.length > 0
                            ? sys.sessions.map((s, idx) => (
                                <Link
                                  key={idx}
                                  href={s.session_id ? `/sessions/${s.session_id}` : '#'}
                                  className="flex items-center justify-between rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs transition-colors hover:bg-gray-100"
                                >
                                  <span className="font-semibold text-gray-700">{s.session_date}</span>
                                  <span className="text-amber-800 font-medium truncate max-w-[150px]">
                                    {s.remark}
                                  </span>
                                </Link>
                              ))
                            : sys.remarks && sys.remarks.length > 0
                            ? sys.remarks.map((r, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs"
                                >
                                  <span className="font-medium text-gray-600">Incident #{idx + 1}</span>
                                  <span className="text-amber-800 font-medium truncate max-w-[150px]">{r}</span>
                                </div>
                              ))
                            : null}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                        {sys.is_resolved ? (
                          <button
                            onClick={() => handleReopenSystem(sys.system_no)}
                            className="btn-secondary text-xs py-1 px-2.5 text-gray-600 hover:text-gray-900"
                          >
                            Reopen Issue
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleDismissFlag(sys.system_no)}
                              className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1"
                              title="Dismiss if not a real hardware defect"
                            >
                              Dismiss
                            </button>
                            <button
                              onClick={() => {
                                setSystemToResolve(sys);
                                setResolutionNotes('');
                              }}
                              className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Mark as Solved
                            </button>
                          </>
                        )}
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
                const value = e.target.value;
                setStudentSearch(value);
                // Debounce: wait 300ms before firing DB query
                if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                searchDebounceRef.current = setTimeout(() => {
                  searchStudentsForHistory(value);
                }, 300);
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

      {/* Mark as Solved Modal Dialog */}
      {systemToResolve && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-gray-100">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Mark System #{systemToResolve.system_no} as Solved
                  </h3>
                  <p className="text-xs text-gray-500">
                    Document maintenance action taken and mark operational
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSystemToResolve(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 border border-amber-200/60">
              <p className="font-bold text-amber-800">Reported Defects / Remarks:</p>
              <ul className="mt-1 list-disc list-inside text-amber-700 space-y-0.5">
                {systemToResolve.remarks.slice(0, 3).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>

            <div className="mt-4 space-y-1.5">
              <label className="block text-xs font-semibold text-gray-700">
                Resolution Notes / Action Taken
              </label>
              <textarea
                rows={3}
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="e.g. Replaced mouse with new optical unit; tested and verified operational."
                className="input w-full resize-none py-2 text-xs"
              />
            </div>

            {/* Quick resolution chips */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                'Replaced mouse with new unit',
                'Replaced keyboard',
                'Screen/HDMI cable fixed',
                'RAM reseated & tested',
                'Software/OS fixed',
                'Inspected & operational',
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setResolutionNotes(chip)}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-medium text-gray-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800 transition-colors"
                >
                  + {chip}
                </button>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSystemToResolve(null)}
                className="btn-secondary text-xs py-2 px-3.5"
                disabled={resolvingLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSolve}
                disabled={resolvingLoading}
                className="btn-primary flex items-center gap-1.5 text-xs py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              >
                {resolvingLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                <span>Confirm &amp; Solve</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
