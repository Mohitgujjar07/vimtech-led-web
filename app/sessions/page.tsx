'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Calendar, CheckCircle, Clock, ChevronRight, Loader2 } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase';
import { LabSession } from '@/lib/types';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<LabSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const supabase = createBrowserClient();
    const { data, error } = await supabase
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
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lab Sessions</h1>
          <p className="mt-1 text-sm text-gray-500">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} recorded
          </p>
        </div>
        <Link href="/sessions/new" className="btn-primary">
          <Plus className="h-4 w-4" />
          New Session
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="mt-12 text-center">
          <Calendar className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-gray-500">No sessions yet</p>
          <Link href="/sessions/new" className="btn-primary mt-4 inline-flex">
            <Plus className="h-4 w-4" />
            Create your first session
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {sessions.map((session) => (
            <Link
              key={session.id}
              href={`/sessions/${session.id}`}
              className="card flex items-center justify-between transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
                  <Calendar className="h-5 w-5 text-brand-700" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">
                      {formatDate(session.session_date)}
                    </span>
                    {session.faculty_confirmed ? (
                      <span className="badge-success">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Confirmed
                      </span>
                    ) : (
                      <span className="badge-warning">
                        <Clock className="mr-1 h-3 w-3" />
                        Draft
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex gap-3 text-xs text-gray-500">
                    {session.section && <span>Section: {session.section}</span>}
                    {session.class_name && <span>Class: {session.class_name}</span>}
                    {session.faculty_name && <span>Faculty: {session.faculty_name}</span>}
                  </div>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
