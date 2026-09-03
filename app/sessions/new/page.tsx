'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save,
  Camera,
  Keyboard,
  Plus,
  Trash2,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { createBrowserClient } from '@/lib/supabase';
import PhotoUpload from '@/components/PhotoUpload';

interface ManualEntry {
  sl_no: number;
  name: string;
  ucms_no: string;
  system_no: string;
  signature_present: boolean;
  remarks: string;
}

export default function NewSessionPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'manual' | 'photo'>('photo');
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Session header
  const [sessionDate, setSessionDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [section, setSection] = useState('');
  const [className, setClassName] = useState('');
  const [facultyName, setFacultyName] = useState('');

  // Manual entries
  const [entries, setEntries] = useState<ManualEntry[]>([
    { sl_no: 1, name: '', ucms_no: '', system_no: '', signature_present: false, remarks: '' },
  ]);

  // Photo uploads
  const [photos, setPhotos] = useState<{ file: File; pageNumber: number }[]>([]);

  const addManualRow = () => {
    setEntries([
      ...entries,
      {
        sl_no: entries.length + 1,
        name: '',
        ucms_no: '',
        system_no: '',
        signature_present: false,
        remarks: '',
      },
    ]);
  };

  const removeManualRow = (idx: number) => {
    const updated = entries
      .filter((_, i) => i !== idx)
      .map((e, i) => ({ ...e, sl_no: i + 1 }));
    setEntries(updated);
  };

  const updateManualEntry = (
    idx: number,
    field: keyof ManualEntry,
    value: string | boolean | number
  ) => {
    const updated = [...entries];
    updated[idx] = { ...updated[idx], [field]: value };
    setEntries(updated);
  };

  const handleManualSave = async () => {
    if (!sessionDate) {
      toast.error('Please enter a session date');
      return;
    }
    const validEntries = entries.filter((e) => e.name.trim());
    if (validEntries.length === 0) {
      toast.error('Please add at least one entry');
      return;
    }

    setSaving(true);
    try {
      const supabase = createBrowserClient();

      // Create session
      const { data: session, error: sessionError } = await supabase
        .from('lab_sessions')
        .insert({
          session_date: sessionDate,
          section: section || null,
          class_name: className || null,
          faculty_name: facultyName || null,
          total_system_count: validEntries.length,
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Fetch enrolled students to link student_id if matched
      const { data: rosterStudents } = await supabase.from('students').select('id, name, ucms_no');
      const studentMap = new Map<string, string>();
      for (const s of rosterStudents || []) {
        if (s.ucms_no) studentMap.set(s.ucms_no.trim().toLowerCase(), s.id);
        if (s.name) studentMap.set(s.name.trim().toLowerCase(), s.id);
      }

      const entriesToInsert = validEntries.map((e) => {
        const matchedId =
          (e.ucms_no && studentMap.get(e.ucms_no.trim().toLowerCase())) ||
          (e.name && studentMap.get(e.name.trim().toLowerCase())) ||
          null;

        return {
          session_id: session.id,
          sl_no: e.sl_no,
          raw_name_ocr: e.name,
          raw_ucms_ocr: e.ucms_no,
          system_no: e.system_no || null,
          signature_present: e.signature_present,
          remarks: e.remarks || null,
          student_id: matchedId,
          matched: !!matchedId,
          ocr_confidence: matchedId ? 1.0 : null,
        };
      });

      // Insert entries
      const { error: entriesError } = await supabase
        .from('lab_entries')
        .insert(entriesToInsert);

      if (entriesError) {
        // Rollback created session so empty orphaned sessions aren't left behind
        await supabase.from('lab_sessions').delete().eq('id', session.id);
        throw entriesError;
      }

      toast.success('Session created successfully!');
      router.push(`/sessions/${session.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const compressPhoto = async (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const maxDim = 1200;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            const raw = (e.target?.result as string).split(',')[1];
            return resolve({ base64: raw, mimeType: file.type || 'image/jpeg' });
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL('image/jpeg', 0.70);
          resolve({
            base64: dataUrl.split(',')[1],
            mimeType: 'image/jpeg',
          });
        };
        img.onerror = () => {
          const raw = (e.target?.result as string).split(',')[1];
          resolve({ base64: raw, mimeType: file.type || 'image/jpeg' });
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        resolve({ base64: '', mimeType: 'image/jpeg' });
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoProcess = async () => {
    if (photos.length === 0) {
      toast.error('Please upload at least one photo');
      return;
    }

    setProcessing(true);
    toast.loading('Optimizing photos for fast AI processing...', { id: 'ocr-toast' });

    try {
      // Compress and optimize photos to high-res, lightweight payloads
      const photoData = await Promise.all(
        photos.map(async (p) => {
          const { base64, mimeType } = await compressPhoto(p.file);
          return {
            base64,
            mimeType,
            pageNumber: p.pageNumber,
          };
        })
      );

      toast.loading('Extracting handwriting with Gemini AI...', { id: 'ocr-toast' });

      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photos: photoData,
          sessionDate,
          section: section || null,
          className: className || null,
          facultyName: facultyName || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'OCR processing failed');
      }

      const { sessionId, totalEntries, matchedEntries } = await response.json();
      toast.success(`Extracted ${totalEntries} entries (${matchedEntries} matched to roster)!`, {
        id: 'ocr-toast',
      });
      router.push(`/sessions/${sessionId}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Processing failed';
      toast.error(message, { id: 'ocr-toast' });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900">New Lab Session</h1>
      <p className="mt-1 text-sm text-gray-500">
        Create a new session by entering data manually or uploading photos.
      </p>

      {/* Session Header */}
      <div className="card mt-6">
        <h2 className="text-lg font-semibold text-gray-900">Session Details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Date *</label>
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">Section</label>
            <input
              type="text"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="e.g. A, B, C"
              className="input"
            />
          </div>
          <div>
            <label className="label">Class</label>
            <input
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="e.g. BCA 3rd Sem"
              className="input"
            />
          </div>
          <div>
            <label className="label">Faculty Name</label>
            <input
              type="text"
              value={facultyName}
              onChange={(e) => setFacultyName(e.target.value)}
              placeholder="e.g. Dr. Sharma"
              className="input"
            />
          </div>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="mt-6 flex gap-2">
        <button
          onClick={() => setMode('photo')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            mode === 'photo'
              ? 'bg-brand-700 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Camera className="h-4 w-4" />
          Upload Photos (OCR)
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            mode === 'manual'
              ? 'bg-brand-700 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Keyboard className="h-4 w-4" />
          Manual Entry
        </button>
      </div>

      {/* Photo mode */}
      {mode === 'photo' && (
        <div className="mt-6 space-y-4">
          <div className="card">
            <PhotoUpload onPhotosReady={setPhotos} />
          </div>
          <button
            onClick={handlePhotoProcess}
            disabled={processing || photos.length === 0}
            className="btn-primary w-full text-base py-3"
          >
            {processing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Processing with AI...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Extract Data with AI ({photos.length} photo{photos.length !== 1 ? 's' : ''})
              </>
            )}
          </button>
        </div>
      )}

      {/* Manual mode */}
      {mode === 'manual' && (
        <div className="mt-6 space-y-4">
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">SL</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Name</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">UUCMS No</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">System No</th>
                  <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Signed</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Remarks</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2 text-gray-400">{entry.sl_no}</td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={entry.name}
                        onChange={(e) => updateManualEntry(idx, 'name', e.target.value)}
                        placeholder="Student name"
                        className="input py-1 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={entry.ucms_no}
                        onChange={(e) => updateManualEntry(idx, 'ucms_no', e.target.value)}
                        placeholder="UUCMS number"
                        className="input py-1 font-mono text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={entry.system_no}
                        onChange={(e) => updateManualEntry(idx, 'system_no', e.target.value)}
                        placeholder="Sys #"
                        className="input w-20 py-1 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={entry.signature_present}
                        onChange={(e) => updateManualEntry(idx, 'signature_present', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={entry.remarks}
                        onChange={(e) => updateManualEntry(idx, 'remarks', e.target.value)}
                        placeholder="—"
                        className="input py-1 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      {entries.length > 1 && (
                        <button
                          onClick={() => removeManualRow(idx)}
                          className="p-1 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button onClick={addManualRow} className="btn-secondary">
              <Plus className="h-4 w-4" />
              Add Row
            </button>
            <button
              onClick={handleManualSave}
              disabled={saving}
              className="btn-primary flex-1"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Session
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
