'use client';

import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createBrowserClient } from '@/lib/supabase';
import Papa from 'papaparse';

interface RosterRow {
  name: string;
  ucms_no: string;
  section?: string;
}

interface RosterUploadProps {
  onUploadComplete: () => void;
}

export default function RosterUpload({ onUploadComplete }: RosterUploadProps) {
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv' || ext === 'txt') {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          processRows(result.data);
        },
        error: (err) => {
          setErrors([`Parse error: ${err.message}`]);
        },
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      // Dynamic import xlsx for browser
      import('xlsx').then((XLSX) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(firstSheet);
          processRows(jsonData);
        };
        reader.readAsArrayBuffer(file);
      });
    } else {
      setErrors(['Please upload a CSV or Excel (.xlsx) file']);
    }
  };

  const processRows = (data: Record<string, string>[]) => {
    const errs: string[] = [];
    const parsed: RosterRow[] = [];

    // Auto-detect column names (case-insensitive)
    const sampleKeys = data.length > 0 ? Object.keys(data[0]) : [];
    const findCol = (patterns: string[]) =>
      sampleKeys.find((k) =>
        patterns.some((p) => k.toLowerCase().includes(p))
      );

    const nameCol = findCol(['name', 'student']);
    const ucmsCol = findCol(['ucms', 'roll', 'id', 'enrollment']);
    const sectionCol = findCol(['section', 'sec', 'class']);

    if (!nameCol) errs.push('Could not find a "Name" column');
    if (!ucmsCol) errs.push('Could not find a "UCMS No" column');

    if (errs.length > 0) {
      setErrors(errs);
      return;
    }

    data.forEach((row, idx) => {
      const name = String(row[nameCol!] || '').trim();
      const ucms = String(row[ucmsCol!] || '').trim();
      if (!name || !ucms) {
        errs.push(`Row ${idx + 2}: Missing name or UCMS`);
        return;
      }
      parsed.push({
        name,
        ucms_no: ucms,
        section: sectionCol ? String(row[sectionCol] || '').trim() : undefined,
      });
    });

    setRows(parsed);
    setErrors(errs);
    setPreview(true);
  };

  const handleUpload = async () => {
    if (rows.length === 0) return;
    setUploading(true);

    try {
      const supabase = createBrowserClient();

      // Upsert students (on conflict ucms_no, update name/section)
      const { error } = await supabase.from('students').upsert(
        rows.map((r) => ({
          name: r.name,
          ucms_no: r.ucms_no,
          section: r.section || null,
        })),
        { onConflict: 'ucms_no' }
      );

      if (error) throw error;

      toast.success(`Successfully uploaded ${rows.length} students`);
      setRows([]);
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
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 transition-colors hover:border-brand-400 hover:bg-brand-50/30"
        >
          <FileSpreadsheet className="mb-3 h-10 w-10 text-gray-400" />
          <p className="mb-1 text-sm font-medium text-gray-700">
            Upload student roster
          </p>
          <p className="text-xs text-gray-500">
            CSV or Excel with Name, UCMS No, and optionally Section columns
          </p>
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
          {/* Preview header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-gray-700">
                {rows.length} students parsed
              </span>
            </div>
            <button
              onClick={() => {
                setPreview(false);
                setRows([]);
                setErrors([]);
              }}
              className="btn-secondary text-xs"
            >
              Choose different file
            </button>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                <AlertCircle className="h-4 w-4" />
                {errors.length} warning{errors.length !== 1 ? 's' : ''}
              </div>
              <ul className="mt-1 list-inside list-disc text-xs text-amber-700">
                {errors.slice(0, 5).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {errors.length > 5 && (
                  <li>...and {errors.length - 5} more</li>
                )}
              </ul>
            </div>
          )}

          {/* Preview table */}
          <div className="max-h-64 overflow-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">#</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Name</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">UCMS No</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Section</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.slice(0, 20).map((row, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-1.5 text-gray-400">{idx + 1}</td>
                    <td className="px-3 py-1.5">{row.name}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{row.ucms_no}</td>
                    <td className="px-3 py-1.5">{row.section || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 20 && (
              <div className="border-t bg-gray-50 px-3 py-2 text-center text-xs text-gray-500">
                ...and {rows.length - 20} more rows
              </div>
            )}
          </div>

          {/* Upload button */}
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="btn-primary w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload {rows.length} Students
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
