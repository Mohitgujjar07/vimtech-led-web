'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Plus,
  Calendar,
  CheckCircle,
  Clock,
  ChevronRight,
  Loader2,
  Search,
  Monitor,
  X,
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase';
import { LabSession } from '@/lib/types';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<LabSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'confirmed'>('all');
  const [sectionFilter, setSectionFilter] = useState<string>('all');

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const supabase = createBrowserClient();
    const { data } = await supabase
      .from('lab_sessions')
      .select('*')
      .order('session_date', { ascending: false });

    if (data) setSessions(data);
    setLoading(false);
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const sections = useMemo(() => {
    return Array.from(
      new Set(sessions.map((s) => s.section).filter(Boolean) as string[])
    ).sort();
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      // Status filter
      if (statusFilter === 'draft' && s.faculty_confirmed) return false;
      if (statusFilter === 'confirmed' && !s.faculty_confirmed) return false;

      // Section filter
      if (sectionFilter !== 'all' && s.section !== sectionFilter) return false;

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchDate = (s.session_date || '').toLowerCase().includes(q);
        const matchSec = (s.section || '').toLowerCase().includes(q);
        const matchClass = (s.class_name || '').toLowerCase().includes(q);
        const matchFac = (s.faculty_name || '').toLowerCase().includes(q);
        if (!matchDate && !matchSec && !matchClass && !matchFac) return false;
      }

      return true;
    });
  }, [sessions, statusFilter, sectionFilter, search]);

  const draftCount = sessions.filter((s) => !s.faculty_confirmed).length;
  const confirmedCount = sessions.filter((s) => s.faculty_confirmed).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ────────────────── Header & Actions ────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
            Lab Sessions
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-gray-500">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} logged • {draftCount} needing review
          </p>
        </div>

        <Link
          href="/sessions/new"
          className="btn-primary py-2 px-3.5 text-xs sm:text-sm shadow-sm"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>New Session</span>
        </Link>
      </div>

      {/* ────────────────── Search Bar ────────────────── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by date, section, class, or faculty..."
          className="input pl-9.5 py-2 text-sm bg-white"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ────────────────── Horizontal Filter Pills (Scrollable) ────────────────── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
        {/* Status Filters */}
        <button
          onClick={() => setStatusFilter('all')}
          className={`rounded-xl px-3 py-1.5 font-semibold shrink-0 transition-all ${
            statusFilter === 'all'
              ? 'bg-brand-700 text-white shadow-2xs'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          All ({sessions.length})
        </button>
        {draftCount > 0 && (
          <button
            onClick={() => setStatusFilter('draft')}
            className={`rounded-xl px-3 py-1.5 font-semibold shrink-0 transition-all ${
              statusFilter === 'draft'
                ? 'bg-amber-500 text-white shadow-2xs'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            ⏳ Needs Review ({draftCount})
          </button>
        )}
        <button
          onClick={() => setStatusFilter('confirmed')}
          className={`rounded-xl px-3 py-1.5 font-semibold shrink-0 transition-all ${
            statusFilter === 'confirmed'
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          ✓ Confirmed ({confirmedCount})
        </button>

        {/* Section divider & pills */}
        {sections.length > 0 && (
          <>
            <span className="w-px h-6 bg-gray-200 shrink-0 self-center mx-1" />
            {sections.map((sec) => (
              <button
                key={sec}
                onClick={() => setSectionFilter(sectionFilter === sec ? 'all' : sec)}
                className={`rounded-xl px-3 py-1.5 font-semibold shrink-0 transition-all ${
                  sectionFilter === sec
                    ? 'bg-brand-700 text-white shadow-2xs'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Sec {sec}
              </button>
            ))}
          </>
        )}
      </div>

      {/* ────────────────── Sessions List / Cards ────────────────── */}
      {filteredSessions.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-xs">
          <Calendar className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p className="text-base font-bold text-gray-800">
            {sessions.length === 0 ? 'No sessions recorded yet' : 'No matching sessions found'}
          </p>
          <p className="mt-1 text-xs text-gray-500 max-w-sm mx-auto">
            {sessions.length === 0
              ? 'Snap a photo of your paper ledger or enter student entries to get started.'
              : 'Try clearing your search terms or filters.'}
          </p>
          <Link
            href="/sessions/new"
            className="btn-primary mt-4 inline-flex items-center gap-1.5 text-xs py-2 px-4 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Create Session</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredSessions.map((session) => (
            <Link
              key={session.id}
              href={`/sessions/${session.id}`}
              className="group block rounded-2xl border border-gray-200 bg-white p-4 shadow-xs transition-all hover:border-brand-200 hover:shadow-md active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 group-hover:bg-brand-100 transition-colors">
                    <Calendar className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-gray-900 leading-tight">
                        {formatDate(session.session_date)}
                      </span>
                      {session.section && (
                        <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">
                          Sec {session.section}
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                      {session.class_name && <span>{session.class_name}</span>}
                      {session.faculty_name && <span>• {session.faculty_name}</span>}
                      <span className="flex items-center gap-1 text-gray-600 font-medium">
                        <Monitor className="h-3 w-3 text-gray-400" />
                        {session.total_system_count ?? '—'} PCs
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {session.faculty_confirmed ? (
                    <span className="badge-success text-[10px] py-1 px-2">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Confirmed
                    </span>
                  ) : (
                    <span className="badge-warning text-[10px] py-1 px-2">
                      <Clock className="mr-1 h-3 w-3" />
                      Draft
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
