'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Save,
  CheckCircle,
  Loader2,
  ArrowLeft,
  Image as ImageIcon,
  FileSpreadsheet,
  FileText,
  Clock,
  X,
  Eye,
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
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const savedEntriesRef = useRef<LabEntry[]>([]);

  const loadSession = useCallback(async () => {
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

    if (sessionRes.error) {
      toast.error(`Failed to load session: ${sessionRes.error.message}`);
    } else if (sessionRes.data) {
      setSession(sessionRes.data);
      setSessionRemarks(sessionRes.data.remarks || '');
    }

    if (entriesRes.error) {
      toast.error(`Failed to load entries: ${entriesRes.error.message}`);
    } else if (entriesRes.data) {
      setEntries(entriesRes.data);
      savedEntriesRef.current = entriesRes.data;
    }

    if (photosRes.error) {
      toast.error(`Failed to load photos: ${photosRes.error.message}`);
    } else if (photosRes.data) {
      setPhotos(photosRes.data);
    }

    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

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
        const { error: delErr } = await supabase.from('lab_entries').delete().in('id', deletedIds);
        if (delErr) {
          throw new Error(`Failed to delete entries: ${delErr.message}`);
        }
      }

      // Only update modified entries
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
          modifiedEntries.map(async (entry) => {
            const { error: updErr } = await supabase
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
              .eq('id', entry.id);
            if (updErr) {
              throw new Error(`Failed to update entry ${entry.sl_no}: ${updErr.message}`);
            }
          })
        );
      }

      // Insert new entries
      if (newEntries.length > 0) {
        const { error: insErr } = await supabase.from('lab_entries').insert(
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
        if (insErr) {
          throw new Error(`Failed to insert new entries: ${insErr.message}`);
        }
      }

      // Update session remarks
      const { error: remarksErr } = await supabase
        .from('lab_sessions')
        .update({ remarks: sessionRemarks || null })
        .eq('id', sessionId);
      if (remarksErr) {
        throw new Error(`Failed to update session remarks: ${remarksErr.message}`);
      }

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
      const { error: confirmErr } = await supabase
        .from('lab_sessions')
        .update({ faculty_confirmed: true })
        .eq('id', sessionId);
      if (confirmErr) {
        throw new Error(`Failed to confirm session: ${confirmErr.message}`);
      }

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
      const wb = await generateSessionExcel(session!, entries);
      const filename = `lab-session-${session!.session_date}-${session!.section || 'all'}.xlsx`;
      await downloadExcel(wb, filename);
      toast.success('Excel downloaded');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Export failed';
      toast.error(message);
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
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
      const message = err instanceof Error ? err.message : 'PDF export failed';
      toast.error(message);
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
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
  const signaturePct = totalCount > 0 ? Math.round((signedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      {/* ────────────────── Header Card ────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <button
              onClick={() => router.push('/sessions')}
              className="mt-0.5 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 active:scale-95 shrink-0"
              title="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">
                  {new Date(session.session_date + 'T00:00:00').toLocaleDateString('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </h1>
                {session.faculty_confirmed ? (
                  <span className="badge-success text-xs">
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Confirmed
                  </span>
                ) : (
                  <span className="badge-warning text-xs">
                    <Clock className="mr-1 h-3 w-3" />
                    Draft
                  </span>
                )}
              </div>

              {/* Class, Section, Faculty tags */}
              <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-gray-600">
                {session.section && (
                  <span className="rounded bg-brand-50 px-2 py-0.5 font-medium text-brand-700">
                    Sec {session.section}
                  </span>
                )}
                {session.class_name && (
                  <span className="rounded bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
                    {session.class_name}
                  </span>
                )}
                {session.faculty_name && (
                  <span className="text-gray-500">Faculty: {session.faculty_name}</span>
                )}
              </div>
            </div>
          </div>

          {/* Desktop Export Buttons */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportExcel}
              disabled={exportingExcel}
              className="btn-secondary py-1.5 px-3 text-xs"
            >
              {exportingExcel ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-3.5 w-3.5" />
              )}
              Excel
            </button>
            <button
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="btn-secondary py-1.5 px-3 text-xs"
            >
              {exportingPdf ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              PDF
            </button>
          </div>
        </div>

        {/* ────────────────── Quick Metrics Strip ────────────────── */}
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3">
          <div className="rounded-xl bg-gray-50/80 p-2.5 text-center">
            <p className="text-xs text-gray-500">Students</p>
            <p className="text-base font-bold text-gray-900">{totalCount}</p>
          </div>
          <div className="rounded-xl bg-emerald-50/80 p-2.5 text-center">
            <p className="text-xs text-emerald-800">Signed</p>
            <p className="text-base font-bold text-emerald-700">{signedCount} ({signaturePct}%)</p>
          </div>
          <div
            onClick={() => photos.length > 0 && setShowPhotos(!showPhotos)}
            className={`rounded-xl p-2.5 text-center transition-all ${
              photos.length > 0
                ? 'cursor-pointer bg-brand-50/80 hover:bg-brand-100/80 text-brand-800'
                : 'bg-gray-50 text-gray-400'
            }`}
          >
            <p className="text-xs flex items-center justify-center gap-1">
              <ImageIcon className="h-3 w-3" />
              Photos
            </p>
            <p className="text-base font-bold">{photos.length}</p>
          </div>
        </div>
      </div>

      {/* ────────────────── Ledger Photos Carousel ────────────────── */}
      {showPhotos && photos.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <ImageIcon className="h-4 w-4 text-brand-600" />
              Captured Ledger Pages ({photos.length})
            </h3>
            <span className="text-xs text-gray-400">Tap photo to enlarge</span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {photos.map((photo) => (
              <div
                key={photo.id}
                onClick={() => setPreviewPhotoUrl(photo.photo_url)}
                className="group relative cursor-pointer overflow-hidden rounded-xl border border-gray-200 shadow-2xs hover:shadow-md transition-all"
              >
                <img
                  src={photo.photo_url}
                  alt={`Page ${photo.page_number}`}
                  className="aspect-[3/4] w-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">
                    Page {photo.page_number}
                  </span>
                  <Eye className="h-3.5 w-3.5 text-white/80" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ────────────────── Full Screen Photo Lightbox ────────────────── */}
      {previewPhotoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-xs"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <button
            onClick={() => setPreviewPhotoUrl(null)}
            className="absolute top-4 right-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/40"
            title="Close"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={previewPhotoUrl}
            alt="Enlarged ledger page"
            className="max-h-[90vh] max-w-[95vw] rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* ────────────────── Adaptive Entry Table / Cards ────────────────── */}
      <div>
        <SessionTable
          entries={entries}
          sessionId={sessionId}
          editable={!session.faculty_confirmed}
          onEntriesChange={setEntries}
        />
      </div>

      {/* ────────────────── Session Remarks ────────────────── */}
      {!session.faculty_confirmed ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
            General Session Remarks (optional)
          </label>
          <textarea
            value={sessionRemarks}
            onChange={(e) => setSessionRemarks(e.target.value)}
            placeholder="Any lab incidents, general attendance or system remarks..."
            rows={2}
            className="input text-xs"
          />
        </div>
      ) : session.remarks ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Session Remarks</p>
          <p className="mt-1 text-sm text-gray-700">{session.remarks}</p>
        </div>
      ) : null}

      {/* ────────────────── Desktop Actions Row ────────────────── */}
      <div className="hidden sm:flex items-center gap-3 pt-2">
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
      </div>

      {/* ────────────────── Mobile Sticky Bottom Action Bar ────────────────── */}
      <div className="fixed bottom-16 left-0 right-0 z-40 sm:hidden border-t border-gray-200 bg-white/95 px-4 py-2.5 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
        {!session.faculty_confirmed ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveEntries}
              disabled={saving}
              className="btn-secondary flex-1 py-2 text-xs"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save
            </button>
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="btn-primary flex-1 py-2 text-xs"
            >
              {confirming ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle className="h-3.5 w-3.5" />
              )}
              Confirm
            </button>
            <button
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="rounded-lg border border-gray-300 p-2 text-gray-700 hover:bg-gray-50"
              title="Download PDF"
            >
              <FileText className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="btn-primary flex-1 py-2 text-xs"
            >
              <FileText className="h-3.5 w-3.5" />
              Download PDF
            </button>
            <button
              onClick={handleExportExcel}
              disabled={exportingExcel}
              className="btn-secondary flex-1 py-2 text-xs"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Download Excel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
