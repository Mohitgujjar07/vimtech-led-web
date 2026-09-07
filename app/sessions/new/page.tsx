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
  Check,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { createBrowserClient } from '@/lib/supabase';
import PhotoUpload from '@/components/PhotoUpload';
import {
  DEGREE_TYPES,
  getSemesterOptions,
  getSectionsForSemester,
  getFacultyForDegree,
  buildClassName,
} from '@/lib/constants';

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
  const [mode, setMode] = useState<'photo' | 'manual'>('photo');
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Session header
  const [sessionDate, setSessionDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [degree, setDegree] = useState('');
  const [semester, setSemester] = useState('');
  const [section, setSection] = useState('');
  const [facultyName, setFacultyName] = useState('');
  const [freeTextTopic, setFreeTextTopic] = useState(''); // For TRAINING/WORKSHOP

  // Derived values
  const semesterOptions = degree ? getSemesterOptions(degree) : [];
  const sectionOptions = degree && semester ? getSectionsForSemester(degree, semester) : [];
  const facultyOptions = degree ? getFacultyForDegree(degree) : [];
  const hasSemesters = degree === 'BCA' || degree === 'PUC';
  const hasSections = degree === 'BCA' && semester !== '';
  const isFreeForm = degree === 'TRAINING' || degree === 'WORKSHOP';

  // Cascade reset handlers
  const handleDegreeChange = (val: string) => {
    setDegree(val);
    setSemester('');
    setSection('');
    setFacultyName('');
    setFreeTextTopic('');
  };

  const handleSemesterChange = (val: string) => {
    setSemester(val);
    setSection('');
  };

  // Manual entries
  const [entries, setEntries] = useState<ManualEntry[]>([
    { sl_no: 1, name: '', ucms_no: '', system_no: '', signature_present: true, remarks: '' },
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
        signature_present: true,
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
      const computedClassName = buildClassName(degree, semester);
      const computedSection = isFreeForm ? freeTextTopic : section;

      const { data: session, error: sessionError } = await supabase
        .from('lab_sessions')
        .insert({
          session_date: sessionDate,
          section: computedSection || null,
          class_name: computedClassName || null,
          faculty_name: facultyName || null,
          total_system_count: validEntries.length,
        })
        .select()
        .single();

      if (sessionError || !session) {
        throw new Error(sessionError?.message || 'Failed to create session');
      }

      // Fetch enrolled students to link student_id if matched
      const { data: rosterStudents, error: rosterError } = await supabase.from('students').select('id, name, ucms_no');
      if (rosterError) {
        throw new Error(`Failed to fetch student roster: ${rosterError.message}`);
      }
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
        await supabase.from('lab_sessions').delete().eq('id', session.id);
        throw new Error(`Failed to insert entries: ${entriesError.message}`);
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
          const maxDim = 1800;
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

          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
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
          section: (isFreeForm ? freeTextTopic : section) || null,
          className: buildClassName(degree, semester) || null,
          facultyName: facultyName || null,
        }),
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let errorMessage = 'OCR processing failed';

        if (contentType.includes('application/json')) {
          const errorData = await response.json().catch(() => ({}));
          errorMessage = errorData.error || errorMessage;
        } else {
          const text = await response.text().catch(() => '');
          if (response.status === 413) {
            errorMessage = 'Photos too large for upload. Please select fewer pages or lower resolution.';
          } else if (response.status === 504) {
            errorMessage = 'AI extraction timed out. Please retry.';
          } else {
            errorMessage = `Server error (${response.status})${text ? `: ${text.slice(0, 100)}` : ''}`;
          }
        }
        throw new Error(errorMessage);
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
    <div className="mx-auto max-w-3xl space-y-4 pb-12">
      {/* ────────────────── Mode Segmented Control ────────────────── */}
      <div className="flex rounded-2xl bg-gray-200/80 p-1.5 shadow-2xs">
        <button
          type="button"
          onClick={() => setMode('photo')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all ${
            mode === 'photo'
              ? 'bg-white text-brand-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Camera className="h-4 w-4 stroke-[2.5]" />
          <span>📸 Snap Ledger (AI OCR)</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all ${
            mode === 'manual'
              ? 'bg-white text-brand-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Keyboard className="h-4 w-4 stroke-[2.5]" />
          <span>⌨️ Manual Typing</span>
        </button>
      </div>

      {/* ────────────────── Session Metadata Card ────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700">
            Session Details
          </h2>
          <span className="text-xs text-brand-700 font-medium">Auto-saved to records</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Date */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Date *</label>
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="input py-2 text-sm font-medium"
              required
            />
          </div>

          {/* Class / Degree */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Class / Degree *</label>
            <select
              value={degree}
              onChange={(e) => handleDegreeChange(e.target.value)}
              className="input py-2 text-sm font-medium"
            >
              <option value="">— Select Program —</option>
              {DEGREE_TYPES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Semester / Year (only for BCA and PUC) */}
          {hasSemesters && (
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">
                {degree === 'BCA' ? 'Semester' : 'Year'}
              </label>
              <select
                value={semester}
                onChange={(e) => handleSemesterChange(e.target.value)}
                className="input py-2 text-sm font-medium"
              >
                <option value="">— Select {degree === 'BCA' ? 'Semester' : 'Year'} —</option>
                {semesterOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Section (only for BCA with a semester selected) */}
          {hasSections && sectionOptions.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Section</label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="input py-2 text-sm font-medium"
              >
                <option value="">— Select Section —</option>
                {sectionOptions.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Free-text Topic (for TRAINING / WORKSHOP) */}
          {isFreeForm && (
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">
                Batch / Topic
              </label>
              <input
                type="text"
                value={freeTextTopic}
                onChange={(e) => setFreeTextTopic(e.target.value)}
                placeholder={`e.g. ${degree === 'TRAINING' ? 'Python Batch 1' : 'AI/ML Workshop'}`}
                className="input py-2 text-sm font-medium"
              />
            </div>
          )}

          {/* Faculty In-Charge */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Faculty In-Charge</label>
            {degree ? (
              <select
                value={facultyName}
                onChange={(e) => setFacultyName(e.target.value)}
                className="input py-2 text-sm font-medium"
              >
                <option value="">— Select Faculty —</option>
                {facultyOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            ) : (
              <select disabled className="input py-2 text-sm font-medium text-gray-400">
                <option>Select a program first</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* ────────────────── Photo Mode ────────────────── */}
      {mode === 'photo' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
            <PhotoUpload onPhotosReady={setPhotos} />
          </div>

          <button
            onClick={handlePhotoProcess}
            disabled={processing || photos.length === 0}
            className="btn-primary w-full text-base py-3.5 rounded-2xl shadow-lg transition-all active:scale-98"
          >
            {processing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Processing with Gemini AI...
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

      {/* ────────────────── Manual Mode (Adaptive) ────────────────── */}
      {mode === 'manual' && (
        <div className="space-y-3">
          {/* Mobile Card List (< sm) */}
          <div className="block sm:hidden space-y-2.5">
            {entries.map((entry, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-xs space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-50 font-mono text-xs font-bold text-brand-700">
                      {entry.sl_no}
                    </span>
                    <input
                      type="text"
                      value={entry.name}
                      onChange={(e) => updateManualEntry(idx, 'name', e.target.value)}
                      placeholder="Student Name *"
                      className="input py-1 text-sm font-semibold flex-1 min-w-0"
                    />
                  </div>
                  {entries.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeManualRow(idx)}
                      className="shrink-0 rounded p-1 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-0.5">UUCMS Roll</label>
                    <input
                      type="text"
                      value={entry.ucms_no}
                      onChange={(e) => updateManualEntry(idx, 'ucms_no', e.target.value)}
                      placeholder="e.g. U11YB24S..."
                      className="input py-1 font-mono text-xs uppercase"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-0.5">System No</label>
                    <input
                      type="text"
                      value={entry.system_no}
                      onChange={(e) => updateManualEntry(idx, 'system_no', e.target.value)}
                      placeholder="Sys #"
                      className="input py-1 text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => updateManualEntry(idx, 'signature_present', !entry.signature_present)}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                      entry.signature_present
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                        : 'bg-gray-100 text-gray-500 border border-gray-200'
                    }`}
                  >
                    {entry.signature_present ? (
                      <>
                        <Check className="h-3 w-3 stroke-[3]" />
                        <span>Signed</span>
                      </>
                    ) : (
                      <>
                        <X className="h-3 w-3" />
                        <span>Unsigned</span>
                      </>
                    )}
                  </button>

                  <input
                    type="text"
                    value={entry.remarks}
                    onChange={(e) => updateManualEntry(idx, 'remarks', e.target.value)}
                    placeholder="Remarks (optional)"
                    className="input py-1 text-xs flex-1"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table (>= sm) */}
          <div className="hidden sm:block overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50/80">
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600 w-12">SL</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Name *</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">UUCMS No</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600 w-24">Sys #</th>
                  <th className="px-3 py-2.5 text-center font-semibold text-gray-600 w-20">Signed</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Remarks</th>
                  <th className="px-3 py-2.5 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2 text-gray-400 font-mono text-xs">{entry.sl_no}</td>
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
                        className="input py-1 font-mono text-xs uppercase"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={entry.system_no}
                        onChange={(e) => updateManualEntry(idx, 'system_no', e.target.value)}
                        placeholder="e.g. 1"
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
                    <td className="px-3 py-2 text-center">
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

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={addManualRow}
              className="btn-secondary py-2.5 text-xs font-semibold"
            >
              <Plus className="h-4 w-4" />
              Add Student
            </button>
            <button
              type="button"
              onClick={handleManualSave}
              disabled={saving}
              className="btn-primary flex-1 py-2.5 text-xs font-bold"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Session ({entries.filter((e) => e.name.trim()).length} Students)
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
