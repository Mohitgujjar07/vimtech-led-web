'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Save,
  CheckCircle,
  Loader2,
  Download,
  ArrowLeft,
  Image as ImageIcon,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { createBrowserClient } from '@/lib/supabase';
import { LabSession, LabEntry, SessionPhoto } from '@/lib/types';
import SessionTable from '@/components/SessionTable';

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<LabSession | null>(null);
  const [entries, setEntries] = useState<LabEntry[]>([]);
  const [photos, setPhotos] = useState<SessionPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sessionRemarks, setSessionRemarks] = useState('');
  const [showPhotos, setShowPhotos] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const savedEntriesRef = useRef<LabEntry[]>([]);

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    const supabase = createBrowserClient();

    const [sessionRes, entriesRes, photosRes] = await Promise.all([
      supabase.from('lab_sessions').select('*').eq('id', sessionId).single(),
      supabase
        .from('lab_entries')
        .select('*')
        .eq('session_id', sessionId)
        .order('sl_no', { ascending: true }),
      supabase
        .from('session_photos')
        .select('*')
        .eq('session_id', sessionId)
        .order('page_number', { ascending: true }),
    ]);

    if (sessionRes.data) {
      setSession(sessionRes.data);
      setSessionRemarks(sessionRes.data.remarks || '');
    }
    if (entriesRes.data) {
      setEntries(entriesRes.data);
      savedEntriesRef.current = entriesRes.data;
    }
    if (photosRes.data) setPhotos(photosRes.data);
    setLoading(false);
  };

  const handleSaveEntries = async () => {
    setSaving(true);
    try {
      const supabase = createBrowserClient();

      // Split into existing entries (update) and new entries (insert)
      const existingEntries = entries.filter((e) => !e.id.startsWith('temp-'));
      const newEntries = entries.filter((e) => e.id.startsWith('temp-'));

      // Delete entries removed from the table
      const currentIds = new Set(existingEntries.map((e) => e.id));
      const deletedIds = savedEntriesRef.current
        .map((e) => e.id)
        .filter((id) => !currentIds.has(id));

      if (deletedIds.length > 0) {
        await supabase.from('lab_entries').delete().in('id', deletedIds);
      }

      // Only update modified entries (avoids dozens of redundant DB writes)
      const modifiedEntries = existingEntries.filter((curr) => {
        const prev = savedEntriesRef.current.find((s) => s.id === curr.id);
        if (!prev) return true;
        return (
          prev.raw_name_ocr !== curr.raw_name_ocr ||
          prev.raw_ucms_ocr !== curr.raw_ucms_ocr ||
          prev.system_no !== curr.system_no ||
          prev.signature_present !== curr.signature_present ||
          prev.remarks !== curr.remarks ||
          prev.student_id !== curr.student_id ||
          prev.matched !== curr.matched
        );
      });

      if (modifiedEntries.length > 0) {
        await Promise.all(
          modifiedEntries.map((entry) =>
            supabase
              .from('lab_entries')
              .update({
                raw_name_ocr: entry.raw_name_ocr,
                raw_ucms_ocr: entry.raw_ucms_ocr,
                system_no: entry.system_no,
                signature_present: entry.signature_present,
                remarks: entry.remarks,
                student_id: entry.student_id,
                matched: entry.matched,
              })
              .eq('id', entry.id)
          )
        );
      }

      // Insert new entries
      if (newEntries.length > 0) {
        await supabase.from('lab_entries').insert(
          newEntries.map((entry) => ({
            session_id: sessionId,
            sl_no: entry.sl_no,
            raw_name_ocr: entry.raw_name_ocr || null,
            raw_ucms_ocr: entry.raw_ucms_ocr || null,
            system_no: entry.system_no || null,
            signature_present: entry.signature_present,
            remarks: entry.remarks || null,
            student_id: entry.student_id || null,
            matched: entry.matched,
          }))
        );
      }

      // Update session remarks
      await supabase
        .from('lab_sessions')
        .update({ remarks: sessionRemarks || null })
        .eq('id', sessionId);

      toast.success('Changes saved');
      await loadSession();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };



  const handleConfirm = async () => {
    const proceed = confirm(
      'Confirm this lab session? Once confirmed, records will be officially saved.'
    );
    if (!proceed) return;

    setConfirming(true);
    try {
      await handleSaveEntries();

      const supabase = createBrowserClient();
      await supabase
        .from('lab_sessions')
        .update({ faculty_confirmed: true })
        .eq('id', sessionId);

      setSession((prev) => (prev ? { ...prev, faculty_confirmed: true } : prev));
      toast.success('Session confirmed!');
      await loadSession();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Confirm failed';
      toast.error(message);
    } finally {
      setConfirming(false);
    }
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const { generateSessionExcel, downloadExcel } = await import('@/lib/export-excel');
      const wb = generateSessionExcel(session!, entries);
      const filename = `lab-session-${session!.session_date}-${session!.section || 'all'}.xlsx`;
      downloadExcel(wb, filename);
      toast.success('Excel downloaded');
    } catch (err: unknown) {
      toast.error('Export failed');
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
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
      const { SessionPdfDocument } = await import('@/lib/export-pdf');
      const blob = await pdf(
        SessionPdfDocument({ session: session!, entries, logoBase64 })
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lab-session-${session!.session_date}-${session!.section || 'all'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch (err: unknown) {
      toast.error('PDF export failed');
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="py-20 text-center">
        <p className="text-gray-500">Session not found</p>
        <button onClick={() => router.push('/sessions')} className="btn-primary mt-4">
          Back to Sessions
        </button>
      </div>
    );
  }

  const totalCount = entries.length;
  const signedCount = entries.filter((e) => e.signature_present).length;

  return (
    <div>
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/sessions')}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">
              {new Date(session.session_date + 'T00:00:00').toLocaleDateString('en-IN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </h1>
            {session.faculty_confirmed ? (
              <span className="badge-success">
                <CheckCircle className="mr-1 h-3 w-3" />
                Confirmed
              </span>
            ) : (
              <span className="badge-warning">Draft</span>
            )}
          </div>
          <div className="mt-0.5 flex gap-4 text-sm text-gray-500">
            {session.section && <span>Section: {session.section}</span>}
            {session.class_name && <span>Class: {session.class_name}</span>}
            {session.faculty_name && <span>Faculty: {session.faculty_name}</span>}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="mt-4 flex flex-wrap gap-3">
        <div className="badge-info">
          {totalCount} entries logged
        </div>
        <div className="badge-success">
          {signedCount} signed
        </div>
        {photos.length > 0 && (
          <button
            onClick={() => setShowPhotos(!showPhotos)}
            className="badge-info cursor-pointer hover:bg-brand-100"
          >
            <ImageIcon className="mr-1 h-3 w-3" />
            {photos.length} photo{photos.length !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Photos */}
      {showPhotos && photos.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo) => (
            <a
              key={photo.id}
              href={photo.photo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="overflow-hidden rounded-lg border border-gray-200 shadow-sm transition-shadow hover:shadow-md"
            >
              <img
                src={photo.photo_url}
                alt={`Page ${photo.page_number}`}
                className="aspect-[3/4] w-full object-cover"
              />
              <div className="bg-gray-50 px-2 py-1 text-center text-xs text-gray-500">
                Page {photo.page_number}
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Entry table */}
      <div className="mt-6">
        <SessionTable
          entries={entries}
          sessionId={sessionId}
          editable={!session.faculty_confirmed}
          onEntriesChange={setEntries}
        />
      </div>



      {/* Session remarks */}
      {!session.faculty_confirmed && (
        <div className="card mt-4">
          <label className="label">Session Remarks (optional)</label>
          <textarea
            value={sessionRemarks}
            onChange={(e) => setSessionRemarks(e.target.value)}
            placeholder="Any general remarks? Leave blank if none."
            rows={2}
            className="input"
          />
        </div>
      )}

      {session.faculty_confirmed && session.remarks && (
        <div className="card mt-4">
          <p className="text-sm font-medium text-gray-700">Session Remarks</p>
          <p className="mt-1 text-sm text-gray-500">{session.remarks}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-6 flex flex-wrap gap-3">
        {!session.faculty_confirmed && (
          <>
            <button
              onClick={handleSaveEntries}
              disabled={saving}
              className="btn-secondary"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </button>
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="btn-primary"
            >
              {confirming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Confirm Session
            </button>
          </>
        )}
        <button
          onClick={handleExportExcel}
          disabled={exportingExcel}
          className="btn-secondary"
        >
          {exportingExcel ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-4 w-4" />
          )}
          Excel
        </button>
        <button
          onClick={handleExportPdf}
          disabled={exportingPdf}
          className="btn-secondary"
        >
          {exportingPdf ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          PDF
        </button>
      </div>
    </div>
  );
}
