// ─────────────────────────────────────────────────────────────
// VIMTECH Lab Ledger — Institutional Constants & Dropdown Data
// ─────────────────────────────────────────────────────────────

/** Degree / program types offered at VIMTECH */
export const DEGREE_TYPES = ['BCA', 'PUC', 'TRAINING', 'WORKSHOP'] as const;
export type DegreeType = (typeof DEGREE_TYPES)[number];

// ───────── BCA Semester → Section Mapping ─────────

export interface SemesterInfo {
  label: string;       // e.g. "1st Sem"
  year: string;        // e.g. "1st Year"
  sections: string[];  // e.g. ["1B1", "1B2", "1B3"]
}

export const BCA_SEMESTERS: SemesterInfo[] = [
  { label: '1st Sem', year: '1st Year', sections: ['1B1', '1B2', '1B3'] },
  { label: '2nd Sem', year: '1st Year', sections: ['2B1', '2B2', '2B3'] },
  { label: '3rd Sem', year: '2nd Year', sections: ['3-VNOVAS', '3B2', '3B3'] },
  { label: '4th Sem', year: '2nd Year', sections: ['4-VNOVAS', '4B2', '4B3'] },
  { label: '5th Sem', year: '3rd Year', sections: ['5-VNOVAS', '5B2'] },
  { label: '6th Sem', year: '3rd Year', sections: ['6-VNOVAS', '6B2'] },
];

// ───────── PUC Year Mapping ─────────

export const PUC_YEARS = ['1st Year', '2nd Year'] as const;

// ───────── Faculty Lists ─────────

/** Faculty available for BCA / Training / Workshop sessions */
export const FACULTY_GENERAL: string[] = [
  'ACHUTH H',
  'CHAITHRA S',
  'MADHUPRIYA',
  'LAVANYA HK',
  'CHINTANA D',
  'MOHANALAKSHMI',
  'KISHORE',
  'KAVYA',
  'SUCHITHRA V',
  'HARINI',
];

/** Additional faculty for PUC */
export const FACULTY_PUC_ONLY: string[] = ['GURU KIRAN'];

// ───────── Helper Functions ─────────

/**
 * Returns semester/year options for a given degree.
 * - BCA: 6 semesters with year grouping
 * - PUC: 2 years
 * - TRAINING/WORKSHOP: empty (no semester structure)
 */
export function getSemesterOptions(degree: DegreeType | string): { label: string; value: string }[] {
  switch (degree) {
    case 'BCA':
      return BCA_SEMESTERS.map((s) => ({ label: `${s.label} (${s.year})`, value: s.label }));
    case 'PUC':
      return PUC_YEARS.map((y) => ({ label: y, value: y }));
    default:
      return [];
  }
}

/**
 * Returns section options for a given degree + semester/year.
 * - BCA: sections mapped to the specific semester
 * - PUC: no sub-sections (returns empty)
 * - TRAINING/WORKSHOP: no predefined sections
 */
export function getSectionsForSemester(degree: DegreeType | string, semester: string): string[] {
  if (degree === 'BCA') {
    const found = BCA_SEMESTERS.find((s) => s.label === semester);
    return found ? found.sections : [];
  }
  // PUC, TRAINING, WORKSHOP have no sub-sections
  return [];
}

/**
 * Returns the faculty list for a given degree.
 * PUC includes GURU KIRAN in addition to the general list.
 */
export function getFacultyForDegree(degree: DegreeType | string): string[] {
  if (degree === 'PUC') {
    return [...FACULTY_GENERAL, ...FACULTY_PUC_ONLY].sort();
  }
  return [...FACULTY_GENERAL];
}

/**
 * Returns a flat list of all known sections across all degrees and semesters.
 * Useful for filter UIs (roster, sessions list).
 */
export function getAllSections(): string[] {
  const sections: string[] = [];
  for (const sem of BCA_SEMESTERS) {
    sections.push(...sem.sections);
  }
  // PUC years as "sections" for filtering
  sections.push(...PUC_YEARS);
  return sections.sort();
}

/**
 * Builds the combined class_name string stored in the DB.
 * e.g. "BCA - 3rd Sem" or "PUC - 1st Year" or "TRAINING" or "WORKSHOP"
 */
export function buildClassName(degree: string, semester: string): string {
  if (!degree) return '';
  if (!semester) return degree;
  return `${degree} - ${semester}`;
}
