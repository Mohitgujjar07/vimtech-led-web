'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Check,
  X,
  AlertTriangle,
  Trash2,
  Plus,
} from 'lucide-react';
import { LabEntry } from '@/lib/types';

interface SessionTableProps {
  entries: LabEntry[];
  sessionId: string;
  editable?: boolean;
  onEntriesChange?: (entries: LabEntry[]) => void;
}

export default function SessionTable({
  entries: initialEntries,
  sessionId,
  editable = true,
  onEntriesChange,
}: SessionTableProps) {
  const [entries, setEntries] = useState<LabEntry[]>(initialEntries);

  const lastEmittedRef = useRef<LabEntry[]>(initialEntries);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only update local state if initialEntries changed externally (e.g. from server or added row)
    if (initialEntries !== lastEmittedRef.current) {
      setEntries(initialEntries);
      lastEmittedRef.current = initialEntries;
    }
  }, [initialEntries]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const notifyParent = useCallback(
    (updated: LabEntry[]) => {
      lastEmittedRef.current = updated;
      onEntriesChange?.(updated);
    },
    [onEntriesChange]
  );

  const updateEntry = (index: number, field: keyof LabEntry, value: unknown) => {
    const updated = [...entries];
    updated[index] = { ...updated[index], [field]: value };
    setEntries(updated);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      notifyParent(updated);
    }, 200);
  };

  const deleteEntry = (index: number) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    const updated = entries.filter((_, i) => i !== index);
    setEntries(updated);
    notifyParent(updated);
  };

  const addRow = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    const newEntry: LabEntry = {
      id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      session_id: sessionId,
      sl_no: entries.length + 1,
      raw_name_ocr: '',
      raw_ucms_ocr: '',
      student_id: null,
      system_no: '',
      signature_present: false,
      signature_crop_url: null,
      ocr_confidence: null,
      matched: true,
      remarks: '',
      student: null,
      created_at: new Date().toISOString(),
    };
    const updated = [...entries, newEntry];
    setEntries(updated);
    notifyParent(updated);
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-3 py-3 text-left font-semibold text-gray-600 w-12">SL</th>
            <th className="px-3 py-3 text-left font-semibold text-gray-600 min-w-[180px]">Student Name</th>
            <th className="px-3 py-3 text-left font-semibold text-gray-600 min-w-[140px]">UUCMS No.</th>
            <th className="px-3 py-3 text-left font-semibold text-gray-600 min-w-[100px]">System No</th>
            <th className="px-3 py-3 text-center font-semibold text-gray-600 min-w-[70px]">Signed</th>
            <th className="px-3 py-3 text-left font-semibold text-gray-600 min-w-[180px]">Remarks</th>
            {editable && <th className="px-3 py-3 text-center font-semibold text-gray-600 w-16">Action</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map((entry, idx) => (
            <tr
              key={entry.id || idx}
              className="hover:bg-gray-50 transition-colors"
            >
              {/* SL No */}
              <td className="px-3 py-2 text-gray-500 font-mono text-xs">{entry.sl_no}</td>

              {/* Student Name */}
              <td className="px-3 py-2">
                {editable ? (
                  <input
                    type="text"
                    value={entry.raw_name_ocr || ''}
                    onChange={(e) =>
                      updateEntry(idx, 'raw_name_ocr', e.target.value)
                    }
                    placeholder="Student Name"
                    className="input py-1 text-xs"
                  />
                ) : (
                  <span className="text-xs font-medium text-gray-900">
                    {entry.raw_name_ocr}
                  </span>
                )}
              </td>

              {/* UUCMS No */}
              <td className="px-3 py-2">
                {editable ? (
                  <input
                    type="text"
                    value={entry.raw_ucms_ocr || ''}
                    onChange={(e) =>
                      updateEntry(idx, 'raw_ucms_ocr', e.target.value)
                    }
                    placeholder="UUCMS No."
                    className="input py-1 font-mono text-xs"
                  />
                ) : (
                  <span className="font-mono text-xs text-gray-600">
                    {entry.raw_ucms_ocr}
                  </span>
                )}
              </td>

              {/* System No */}
              <td className="px-3 py-2">
                {editable ? (
                  <input
                    type="text"
                    value={entry.system_no || ''}
                    onChange={(e) =>
                      updateEntry(idx, 'system_no', e.target.value)
                    }
                    placeholder="e.g. 1"
                    className="input w-20 py-1 text-xs"
                  />
                ) : (
                  <span className="text-xs text-gray-700">
                    {entry.system_no || '—'}
                  </span>
                )}
              </td>

              {/* Signed */}
              <td className="px-3 py-2 text-center">
                {editable ? (
                  <input
                    type="checkbox"
                    checked={entry.signature_present}
                    onChange={(e) =>
                      updateEntry(idx, 'signature_present', e.target.checked)
                    }
                    className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                  />
                ) : entry.signature_present ? (
                  <Check className="mx-auto h-4 w-4 text-green-600" />
                ) : (
                  <X className="mx-auto h-4 w-4 text-gray-300" />
                )}
              </td>

              {/* Remarks */}
              <td className="px-3 py-2">
                {editable ? (
                  <input
                    type="text"
                    value={entry.remarks || ''}
                    onChange={(e) =>
                      updateEntry(idx, 'remarks', e.target.value)
                    }
                    placeholder="—"
                    className="input py-1 text-xs"
                  />
                ) : (
                  <span className="text-xs text-gray-500">
                    {entry.remarks || '—'}
                  </span>
                )}
              </td>

              {/* Delete Action */}
              {editable && (
                <td className="px-3 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => deleteEntry(idx)}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Remove entry"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <AlertTriangle className="mb-2 h-8 w-8" />
          <p className="text-sm">No entries yet</p>
        </div>
      )}

      {editable && (
        <div className="border-t border-gray-100 bg-gray-50/50 p-2.5 flex justify-end">
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-xs hover:bg-gray-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Row
          </button>
        </div>
      )}
    </div>
  );
}
