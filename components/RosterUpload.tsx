'use client';

import { useState, useRef, useMemo } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader2, Layers, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { createBrowserClient } from '@/lib/supabase';

export interface RosterRow {
  name: string;
  ucms_no: string;
  section?: string;
  sheetSource?: string;
}

interface SheetRoster {
  sheetName: string;
  rows: RosterRow[];
  errorCount: number;
}

interface RosterUploadProps {
  onUploadComplete: () => void;
}

export default function RosterUpload({ onUploadComplete }: RosterUploadProps) {
  const [sheets, setSheets] = useState<SheetRoster[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState<number | 'all'>('all');
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseRowsFromData = (
    data: Record<string, unknown>[],
    sheetName: string
  ): { parsed: RosterRow[]; errs: string[] } => {
    const errs: string[] = [];
    const parsed: RosterRow[] = [];

    if (data.length === 0) {
      return { parsed, errs };
    }

    const sampleKeys = Object.keys(data[0] || {});
    const findCol = (patterns: string[]) =>
      sampleKeys.find((k) =>
        patterns.some((p) => k.toLowerCase().trim().includes(p))
      );

    const nameCol = findCol(['name', 'student', 'candidate', 'student name']);
    const ucmsCol = findCol(['ucms', 'uucms', 'roll', 'reg', 'register', 'id', 'enrollment', 'hall ticket']);
    const sectionCol = findCol(['section', 'sec', 'class', 'sem', 'semester', 'year', 'branch']);

    if (!nameCol) errs.push(`[${sheetName}] Could not find a "Name" column.`);
    if (!ucmsCol) errs.push(`[${sheetName}] Could not find a "UUCMS / Roll No" column.`);

    if (!nameCol || !ucmsCol) {
      return { parsed, errs };
    }

    data.forEach((row, idx) => {
      const rawName = String(row[nameCol] || '').trim();
      const rawUcms = String(row[ucmsCol] || '').trim().toUpperCase();

      if (!rawName && !rawUcms) {
        // Empty row, skip
        return;
      }

      if (!rawName || !rawUcms) {
        errs.push(`[${sheetName}] Row ${idx + 2}: Missing ${!rawName ? 'Student Name' : 'UUCMS Roll No'}`);
        return;
      }

      let rowSection: string | undefined = undefined;
      if (sectionCol && row[sectionCol]) {
        rowSection = String(row[sectionCol]).trim();
      }

      // If no explicit section column in the row, default to sheet name if descriptive
      if (!rowSection && sheetName && sheetName !== 'Sheet1' && sheetName !== 'CSV Roster') {
        rowSection = sheetName.trim();
      }

      parsed.push({
        name: rawName,
        ucms_no: rawUcms,
        section: rowSection,
        sheetSource: sheetName,
      });
    });

    return { parsed, errs };
  };

  const parseFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    setErrors([]);

    if (ext === 'csv' || ext === 'txt') {
      try {
        const Papa = (await import('papaparse')).default;
        Papa.parse<Record<string, unknown>>(file, {
          header: true,
          skipEmptyLines: 'greedy',
          complete: (result) => {
            const { parsed, errs } = parseRowsFromData(result.data, 'CSV Roster');
            if (parsed.length === 0) {
              setErrors(errs.length > 0 ? errs : ['No valid student rows found in CSV.']);
              return;
            }
            setSheets([{ sheetName: 'CSV Roster', rows: parsed, errorCount: errs.length }]);
            setActiveSheetIndex('all');
            setErrors(errs);
            setPreview(true);
          },
          error: (err) => {
            setErrors([`CSV parse error: ${err.message}`]);
          },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to parse CSV';
        setErrors([msg]);
      }
    } else if (ext === 'xlsx' || ext === 'xls') {
      try {
        const XLSX = await import('xlsx');
        const reader = new FileReader();

        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });

            if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
              setErrors(['The uploaded Excel workbook contains no sheets.']);
              return;
            }

            const parsedSheets: SheetRoster[] = [];
            const collectedErrors: string[] = [];

            for (const sheetName of workbook.SheetNames) {
              const sheet = workbook.Sheets[sheetName];
              if (!sheet) continue;

              const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
                defval: '',
                raw: false,
              });

              if (jsonData.length === 0) continue;

              const { parsed, errs } = parseRowsFromData(jsonData, sheetName);
              if (parsed.length > 0) {
                parsedSheets.push({
                  sheetName,
                  rows: parsed,
                  errorCount: errs.length,
                });
              }
              collectedErrors.push(...errs);
            }

            if (parsedSheets.length === 0) {
              setErrors(
                collectedErrors.length > 0
                  ? collectedErrors
                  : ['No valid student records found in any sheets. Ensure columns include "Name" and "UUCMS".']
              );
              return;
            }

            setSheets(parsedSheets);
            setActiveSheetIndex(parsedSheets.length > 1 ? 'all' : 0);
            setErrors(collectedErrors);
            setPreview(true);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to parse Excel workbook';
            setErrors([`Excel parsing error: ${msg}`]);
          }
        };

        reader.onerror = () => {
          setErrors(['Failed to read file from local disk']);
        };

        reader.readAsArrayBuffer(file);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load Excel parser';
        setErrors([msg]);
      }
    } else {
      setErrors(['Please upload an Excel (.xlsx / .xls) or CSV file.']);
    }
  };

  // Aggregated or sheet-specific rows for display
  const displayedRows = useMemo(() => {
    if (sheets.length === 0) return [];
    if (activeSheetIndex === 'all') {
      return sheets.flatMap((s) => s.rows);
    }
    return sheets[activeSheetIndex]?.rows || [];
  }, [sheets, activeSheetIndex]);

  const totalStudentsCount = useMemo(() => {
    return sheets.reduce((acc, s) => acc + s.rows.length, 0);
  }, [sheets]);

  const handleUpload = async () => {
    // Ingest all parsed sheets
    const allRowsToUpload = sheets.flatMap((s) => s.rows);
    if (allRowsToUpload.length === 0) return;

    setUploading(true);

    try {
      const supabase = createBrowserClient();

      // Deduplicate rows by UUCMS in case of duplicates across sheets
      const dedupMap = new Map<string, RosterRow>();
      for (const r of allRowsToUpload) {
        const key = r.ucms_no.trim().toUpperCase();
        if (key) {
          dedupMap.set(key, r);
        }
      }

      const deduplicatedRows = Array.from(dedupMap.values());

      // Upsert students (on conflict ucms_no, update name/section)
      const { error } = await supabase.from('students').upsert(
        deduplicatedRows.map((r) => ({
          name: r.name,
          ucms_no: r.ucms_no,
          section: r.section || null,
        })),
        { onConflict: 'ucms_no' }
      );

      if (error) throw new Error(`Database error: ${error.message}`);

      toast.success(
        `Successfully enrolled ${deduplicatedRows.length} students across ${sheets.length} sheet${
          sheets.length !== 1 ? 's' : ''
        }!`
      );
      setSheets([]);
      setPreview(false);
      onUploadComplete();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {!preview ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand-300 bg-white p-8 transition-all hover:border-brand-500 hover:bg-brand-50/40 shadow-xs"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 mb-3 shadow-2xs">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <p className="text-sm font-bold text-gray-900">
            Click to upload Master Student Roster
          </p>
          <p className="mt-1 text-xs text-gray-500 text-center max-w-sm">
            Supports multi-sheet Excel workbooks (e.g. 1st Year, 2nd Year, 3rd Year) or standard CSV files with Name &amp; UUCMS No.
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-100/70 px-2.5 py-1 text-[11px] font-semibold text-brand-800">
            <Layers className="h-3.5 w-3.5" />
            <span>Auto-detects all sheets &amp; sections</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])}
            className="hidden"
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Header & Switchers */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-200/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <CheckCircle className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 leading-tight">
                  {totalStudentsCount} Students Detected
                </h3>
                <p className="text-xs text-gray-500">
                  Ready to import across {sheets.length} workbook sheet{sheets.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setPreview(false);
                setSheets([]);
                setErrors([]);
              }}
              className="btn-secondary text-xs py-1.5 px-3 self-start sm:self-auto"
            >
              Choose different file
            </button>
          </div>

          {/* Sheet Selector Tabs (if multiple sheets found) */}
          {sheets.length > 1 && (
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1.5">
                Workbook Sheets ({sheets.length} Year/Section Tabs)
              </label>
              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setActiveSheetIndex('all')}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all shrink-0 min-h-[44px] flex items-center gap-1.5 ${
                    activeSheetIndex === 'all'
                      ? 'bg-brand-700 text-white shadow-2xs'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>All Sheets ({totalStudentsCount})</span>
                </button>
                {sheets.map((sheet, idx) => (
                  <button
                    key={sheet.sheetName}
                    type="button"
                    onClick={() => setActiveSheetIndex(idx)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all shrink-0 min-h-[44px] flex items-center gap-1.5 ${
                      activeSheetIndex === idx
                        ? 'bg-brand-700 text-white shadow-2xs font-bold'
                        : 'bg-white border border-gray-200 text-gray-700 hover:border-brand-300'
                    }`}
                  >
                    <span>{sheet.sheetName}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                        activeSheetIndex === idx ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {sheet.rows.length}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Warnings & Notices */}
          {errors.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>{errors.length} parsing note{errors.length !== 1 ? 's' : ''} / skipped rows</span>
              </div>
              <ul className="mt-1.5 list-inside list-disc text-[11px] text-amber-800 space-y-0.5 max-h-24 overflow-y-auto">
                {errors.slice(0, 4).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {errors.length > 4 && (
                  <li className="font-semibold">...and {errors.length - 4} more notes</li>
                )}
              </ul>
            </div>
          )}

          {/* Student Preview Table */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-2xs">
            <div className="max-h-60 overflow-y-auto">
              <table className="min-w-full text-xs">
                <thead className="sticky top-0 bg-gray-50/95 border-b border-gray-200 backdrop-blur-xs">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold text-gray-600 w-12">#</th>
                    <th className="px-3 py-2 text-left font-bold text-gray-600">Student Name</th>
                    <th className="px-3 py-2 text-left font-bold text-gray-600">UUCMS Roll No.</th>
                    <th className="px-3 py-2 text-left font-bold text-gray-600">Section / Year</th>
                    {sheets.length > 1 && (
                      <th className="px-3 py-2 text-left font-bold text-gray-600">Source Sheet</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayedRows.slice(0, 30).map((row, idx) => (
                    <tr key={`${row.ucms_no}-${idx}`} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-3 py-1.5 text-gray-400 font-mono">{idx + 1}</td>
                      <td className="px-3 py-1.5 font-bold text-gray-900">{row.name}</td>
                      <td className="px-3 py-1.5 font-mono font-bold text-brand-700">{row.ucms_no}</td>
                      <td className="px-3 py-1.5 text-gray-600">
                        {row.section ? (
                          <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                            {row.section}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      {sheets.length > 1 && (
                        <td className="px-3 py-1.5 text-gray-500 text-[10px]">
                          {row.sheetSource}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {displayedRows.length > 30 && (
              <div className="border-t border-gray-100 bg-gray-50/60 px-3 py-1.5 text-center text-[11px] font-medium text-gray-500">
                ...and {displayedRows.length - 30} more students
              </div>
            )}
          </div>

          {/* Action Button */}
          <button
            onClick={handleUpload}
            disabled={uploading || totalStudentsCount === 0}
            className="btn-primary w-full py-3 text-sm min-h-[44px] flex items-center justify-center gap-2 shadow-sm active:scale-[0.99]"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Ingesting Master Student Roster...</span>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                <span>
                  Enroll All {totalStudentsCount} Students ({sheets.length} Sheet{sheets.length !== 1 ? 's' : ''})
                </span>
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
