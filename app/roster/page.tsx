'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Upload,
  Search,
  Trash2,
  Filter,
  Loader2,
  FileSpreadsheet,
  AlertCircle,
  GraduationCap,
  X,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { createBrowserClient } from '@/lib/supabase';
import { Student } from '@/lib/types';
import RosterUpload from '@/components/RosterUpload';

export default function RosterPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // New student form
  const [newName, setNewName] = useState('');
  const [newUcms, setNewUcms] = useState('');
  const [newSection, setNewSection] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setStudents(data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load students';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newUcms.trim()) {
      toast.error('Student Name and UUCMS No are required');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.from('students').insert({
        name: newName.trim(),
        ucms_no: newUcms.trim().toUpperCase(),
        section: newSection.trim() || null,
      });

      if (error) throw error;

      toast.success(`Student ${newName.trim()} added successfully!`);
      setNewName('');
      setNewUcms('');
      setNewSection('');
      setShowAddModal(false);
      await loadStudents();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add student';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStudent = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} from the roster?`)) return;

    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) throw error;

      toast.success(`${name} removed from roster`);
      setStudents((prev) => prev.filter((s) => s.id !== id));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete student';
      toast.error(msg);
    }
  };

  const sections = Array.from(
    new Set(students.map((s) => s.section).filter(Boolean) as string[])
  ).sort();

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.ucms_no.toLowerCase().includes(search.toLowerCase());
    const matchesSection = sectionFilter ? s.section === sectionFilter : true;
    return matchesSearch && matchesSection;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Student Roster</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage enrolled students for automated AI ledger matching.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="btn-secondary"
          >
            <Upload className="h-4 w-4" />
            {showUpload ? 'Hide Upload' : 'Upload Roster (CSV / Excel)'}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" />
            Add Student
          </button>
        </div>
      </div>

      {/* Roster Upload Collapsible Panel */}
      {showUpload && (
        <div className="card border-2 border-brand-200 bg-brand-50/20 shadow-md">
          <div className="mb-4 flex items-center justify-between border-b border-brand-100 pb-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-brand-700" />
              <h2 className="text-base font-semibold text-gray-900">Batch Roster Ingestion</h2>
            </div>
            <button
              onClick={() => setShowUpload(false)}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <RosterUpload
            onUploadComplete={() => {
              loadStudents();
              setShowUpload(false);
            }}
          />
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Total Enrolled</p>
            <p className="text-xl font-bold text-gray-900">{students.length}</p>
          </div>
        </div>

        <div className="card flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-700">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Active Sections</p>
            <p className="text-xl font-bold text-gray-900">{sections.length}</p>
          </div>
        </div>

        <div className="card flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Filtered Match</p>
            <p className="text-xl font-bold text-gray-900">{filteredStudents.length}</p>
          </div>
        </div>

        <div className="card flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Status</p>
            <p className="text-sm font-semibold text-blue-700">
              {students.length > 0 ? 'Ready for OCR' : 'Roster Empty'}
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student name or UUCMS number..."
            className="input pl-9 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="input py-2 text-sm w-44"
          >
            <option value="">All Sections</option>
            {sections.map((sec) => (
              <option key={sec} value={sec}>
                Section {sec}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Students Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Users className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-base font-semibold text-gray-800">
              {students.length === 0 ? 'No students enrolled in roster' : 'No matching students found'}
            </p>
            <p className="mt-1 text-sm text-gray-500 max-w-sm">
              {students.length === 0
                ? 'Upload a CSV or Excel roster with Name and UUCMS No columns to enable automatic OCR matching on ledger photos.'
                : 'Try adjusting your search terms or section filter.'}
            </p>
            {students.length === 0 && (
              <button
                onClick={() => setShowUpload(true)}
                className="btn-primary mt-4 inline-flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Upload Student Roster
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 w-16">#</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Student Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">UUCMS No.</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Section</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Enrolled On</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600 w-20">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredStudents.map((student, idx) => (
                  <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs font-mono text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{student.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-brand-700 font-semibold">
                      {student.ucms_no}
                    </td>
                    <td className="px-4 py-3">
                      {student.section ? (
                        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          Section {student.section}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {student.created_at
                        ? new Date(student.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDeleteStudent(student.id, student.name)}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="Delete student"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Single Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-brand-700" />
                <h3 className="text-lg font-bold text-gray-900">Add Student to Roster</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddStudent} className="mt-4 space-y-4">
              <div>
                <label className="label">Student Name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="input"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="label">UUCMS / Roll Number *</label>
                <input
                  type="text"
                  value={newUcms}
                  onChange={(e) => setNewUcms(e.target.value)}
                  placeholder="e.g. U18VT22S001"
                  className="input font-mono uppercase"
                  required
                />
              </div>

              <div>
                <label className="label">Section (optional)</label>
                <input
                  type="text"
                  value={newSection}
                  onChange={(e) => setNewSection(e.target.value)}
                  placeholder="e.g. A, B, BCA-3"
                  className="input"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Add Student
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
