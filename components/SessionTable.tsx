'use client';

import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  Check,
  X,
  AlertTriangle,
  Trash2,
  Plus,
  Search,
} from 'lucide-react';
import { LabEntry } from '@/lib/types';

interface SessionTableProps {
  entries: LabEntry[];
  sessionId: string;
  editable?: boolean;
  onEntriesChange?: (entries: LabEntry[]) => void;
}

/* ───────── Memoized Desktop Row Component ───────── */
interface SessionTableRowProps {
  entry: LabEntry;
  index: number;
  editable: boolean;
  onUpdate: (index: number, field: keyof LabEntry, value: unknown) => void;
  onDelete: (index: number) => void;
}

const SessionTableRow = memo(function SessionTableRow({
  entry,
  index,
  editable,
  onUpdate,
  onDelete,
}: SessionTableRowProps) {
  return (
    <tr className="hover:bg-gray-50/80 transition-colors">
      {/* SL No */}
      <td className="px-3 py-2 text-gray-500 font-mono text-xs font-semibold">{entry.sl_no}</td>

      {/* Student Name */}
      <td className="px-3 py-2">
        {editable ? (
          <input
            type="text"
            value={entry.raw_name_ocr || ''}
            onChange={(e) => onUpdate(index, 'raw_name_ocr', e.target.value)}
            placeholder="Student Name"
            className="input py-1 text-xs"
          />
        ) : (
          <span className="text-xs font-medium text-gray-900">
            {entry.raw_name_ocr || '—'}
          </span>
        )}
      </td>

      {/* UUCMS No */}
      <td className="px-3 py-2">
        {editable ? (
          <input
            type="text"
            value={entry.raw_ucms_ocr || ''}
            onChange={(e) => onUpdate(index, 'raw_ucms_ocr', e.target.value)}
            placeholder="UUCMS No."
            className="input py-1 font-mono text-xs uppercase"
          />
        ) : (
          <span className="font-mono text-xs text-gray-600">
            {entry.raw_ucms_ocr || '—'}
          </span>
        )}
      </td>

      {/* System No */}
      <td className="px-3 py-2">
        {editable ? (
          <input
            type="text"
            value={entry.system_no || ''}
            onChange={(e) => onUpdate(index, 'system_no', e.target.value)}
            placeholder="e.g. 1"
            className="input w-20 py-1 text-xs font-mono font-medium"
          />
        ) : (
          <span className="text-xs font-medium text-gray-700">
            {entry.system_no || '—'}
          </span>
        )}
      </td>

      {/* Signed */}
      <td className="px-3 py-2 text-center">
        {editable ? (
          <button
            type="button"
            onClick={() => onUpdate(index, 'signature_present', !entry.signature_present)}
            className={`inline-flex items-center justify-center h-6 w-14 rounded-full text-xs font-medium transition-all ${
              entry.signature_present
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
            }`}
          >
            {entry.signature_present ? (
              <Check className="h-3.5 w-3.5 stroke-[3]" />
            ) : (
              <X className="h-3.5 w-3.5" />
            )}
          </button>
        ) : entry.signature_present ? (
          <Check className="mx-auto h-4 w-4 text-emerald-600 stroke-[3]" />
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
            onChange={(e) => onUpdate(index, 'remarks', e.target.value)}
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
            onClick={() => onDelete(index)}
            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Remove entry"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </td>
      )}
    </tr>
  );
});

/* ───────── Memoized Mobile Card Component (< md) ───────── */
const SessionCardRow = memo(function SessionCardRow({
  entry,
  index,
  editable,
  onUpdate,
  onDelete,
}: SessionTableRowProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-xs space-y-2.5 transition-all hover:border-brand-200">
      {/* Row 1: Index + Student Name + Delete */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-50 font-mono text-xs font-bold text-brand-700">
            {entry.sl_no}
          </span>
          {editable ? (
            <input
              type="text"
              value={entry.raw_name_ocr || ''}
              onChange={(e) => onUpdate(index, 'raw_name_ocr', e.target.value)}
              placeholder="Student Name"
              className="input py-1.5 text-sm font-semibold flex-1 min-w-0"
            />
          ) : (
            <span className="text-sm font-bold text-gray-900 truncate">
              {entry.raw_name_ocr || 'Unnamed Student'}
            </span>
          )}
        </div>
        {editable && (
          <button
            type="button"
            onClick={() => onDelete(index)}
            className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 active:scale-90"
            title="Remove entry"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Row 2: UUCMS + System No (Side-by-side) */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-0.5">
            UUCMS Roll No
          </label>
          {editable ? (
            <input
              type="text"
              value={entry.raw_ucms_ocr || ''}
              onChange={(e) => onUpdate(index, 'raw_ucms_ocr', e.target.value)}
              placeholder="e.g. U11YB24S0001"
              className="input py-1 text-xs font-mono uppercase"
            />
          ) : (
            <span className="font-mono text-xs text-brand-700 bg-brand-50/60 rounded px-2 py-1 block truncate">
              {entry.raw_ucms_ocr || '—'}
            </span>
          )}
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-0.5">
            System Assigned
          </label>
          {editable ? (
            <input
              type="text"
              value={entry.system_no || ''}
              onChange={(e) => onUpdate(index, 'system_no', e.target.value)}
              placeholder="Sys #"
              className="input py-1 text-xs font-medium"
            />
          ) : (
            <span className="text-xs font-semibold text-gray-700 bg-gray-100/70 rounded px-2 py-1 block">
              {entry.system_no ? `PC #${entry.system_no}` : '—'}
            </span>
          )}
        </div>
      </div>

      {/* Row 3: Thumb-Friendly Signature Toggle + Remarks */}
      <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
        {editable ? (
          <button
            type="button"
            onClick={() => onUpdate(index, 'signature_present', !entry.signature_present)}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all shrink-0 active:scale-95 ${
              entry.signature_present
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs'
                : 'bg-gray-100 text-gray-500 border border-gray-200'
            }`}
          >
            {entry.signature_present ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600 stroke-[3]" />
                <span>Signed</span>
              </>
            ) : (
              <>
                <X className="h-3.5 w-3.5 text-gray-400" />
                <span>Unsigned</span>
              </>
            )}
          </button>
        ) : (
          <div className="shrink-0">
            {entry.signature_present ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                <Check className="h-3 w-3 stroke-[3]" /> Signed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">
                <X className="h-3 w-3" /> Unsigned
              </span>
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {editable ? (
            <input
              type="text"
              value={entry.remarks || ''}
              onChange={(e) => onUpdate(index, 'remarks', e.target.value)}
              placeholder="Remarks (e.g. Mouse issue)"
              className="input py-1 text-xs truncate"
            />
          ) : (
            <span className="text-xs text-gray-500 block truncate">
              {entry.remarks || 'No remarks'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

/* ───────── Main Adaptive Table/Cards Component ───────── */
export default function SessionTable({
  entries: initialEntries,
  sessionId,
  editable = true,
  onEntriesChange,
}: SessionTableProps) {
  const [entries, setEntries] = useState<LabEntry[]>(initialEntries);
  const [searchQuery, setSearchQuery] = useState('');

  const lastEmittedRef = useRef<LabEntry[]>(initialEntries);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
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

  const updateEntry = useCallback(
    (index: number, field: keyof LabEntry, value: unknown) => {
      setEntries((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: value };

        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          notifyParent(updated);
        }, 200);

        return updated;
      });
    },
    [notifyParent]
  );

  const deleteEntry = useCallback(
    (index: number) => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      setEntries((prev) => {
        const updated = prev.filter((_, i) => i !== index);
        notifyParent(updated);
        return updated;
      });
    },
    [notifyParent]
  );

  const addRow = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setEntries((prev) => {
      const newEntry: LabEntry = {
        id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        session_id: sessionId,
        sl_no: prev.length + 1,
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
      const updated = [...prev, newEntry];
      notifyParent(updated);
      return updated;
    });
  }, [sessionId, notifyParent]);

  // Fast filtering for both mobile and desktop
  const filteredIndices = useMemo(() => {
    if (!searchQuery.trim()) {
      return entries.map((_, i) => i);
    }
    const q = searchQuery.toLowerCase();
    const result: number[] = [];
    entries.forEach((e, idx) => {
      const matchName = (e.raw_name_ocr || '').toLowerCase().includes(q);
      const matchRoll = (e.raw_ucms_ocr || '').toLowerCase().includes(q);
      const matchSys = (e.system_no || '').toLowerCase().includes(q);
      const matchRem = (e.remarks || '').toLowerCase().includes(q);
      if (matchName || matchRoll || matchSys || matchRem) {
        result.push(idx);
      }
    });
    return result;
  }, [entries, searchQuery]);

  const signedCount = entries.filter((e) => e.signature_present).length;

  return (
    <div className="space-y-3">
      {/* Search & Quick Stats Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student, roll number, or system..."
            className="input pl-8.5 py-1.5 text-xs bg-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 text-xs text-gray-500">
          <span>
            {entries.length} student{entries.length !== 1 ? 's' : ''} ({signedCount} signed)
          </span>

          {editable && (
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-50 border border-brand-200 px-2.5 py-1.5 text-xs font-semibold text-brand-700 shadow-2xs hover:bg-brand-100 active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Student</span>
            </button>
          )}
        </div>
      </div>

      {/* ────────────────── MOBILE VIEW: Card List (< md) ────────────────── */}
      <div className="block md:hidden space-y-2.5">
        {filteredIndices.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-400">
            <AlertTriangle className="mx-auto h-8 w-8 text-gray-300 mb-2" />
            <p className="text-sm font-medium">No matching student entries</p>
            {entries.length > 0 && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-xs font-semibold text-brand-700 hover:underline"
              >
                Clear search filter
              </button>
            )}
          </div>
        ) : (
          filteredIndices.map((origIdx) => (
            <SessionCardRow
              key={entries[origIdx].id || origIdx}
              entry={entries[origIdx]}
              index={origIdx}
              editable={editable}
              onUpdate={updateEntry}
              onDelete={deleteEntry}
            />
          ))
        )}

        {editable && (
          <button
            type="button"
            onClick={addRow}
            className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-300 bg-brand-50/40 py-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 active:scale-98"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Add Student Row</span>
          </button>
        )}
      </div>

      {/* ────────────────── DESKTOP VIEW: High-Density Table (>= md) ────────────────── */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/90">
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
            {filteredIndices.map((origIdx) => (
              <SessionTableRow
                key={entries[origIdx].id || origIdx}
                entry={entries[origIdx]}
                index={origIdx}
                editable={editable}
                onUpdate={updateEntry}
                onDelete={deleteEntry}
              />
            ))}
          </tbody>
        </table>

        {filteredIndices.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <AlertTriangle className="mb-2 h-8 w-8 text-gray-300" />
            <p className="text-sm font-medium">No matching entries found</p>
          </div>
        )}

        {editable && (
          <div className="border-t border-gray-100 bg-gray-50/50 p-2.5 flex justify-end">
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Row
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
