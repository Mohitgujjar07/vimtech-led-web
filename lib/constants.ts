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

// ───────── Academic Section Normalization & Badging ─────────

export interface NormalizedAcademicInfo {
  degree: 'BCA' | 'PUC' | 'TRAINING' | 'WORKSHOP' | 'OTHER';
  year: string | null;
  semester: string | null;
  section: string;
  badgeLabel: string;
  badgeVariant: 'purple' | 'blue' | 'emerald' | 'amber' | 'gray';
}

/**
 * Normalizes raw or legacy section & class strings into official VIMTECH academic badges.
 * Handles inputs like "1b1", "sec 1b1", "3-novas", "5th VNovas", "PUC", etc.
 */
export function normalizeAcademicSection(
  rawSection: string | null | undefined,
  rawClass: string | null | undefined
): NormalizedAcademicInfo {
  const sec = (rawSection || '').trim();
  const cls = (rawClass || '').trim();
  const secLower = sec.toLowerCase().replace(/^sec(tion)?\s*/i, '');
  const clsLower = cls.toLowerCase();

  // 1. Check BCA 1st Year
  if (['1b1', '1b2', '1b3'].includes(secLower) || (clsLower.includes('bca') && clsLower.includes('1st sem') && secLower.startsWith('1b'))) {
    const formattedSec = secLower.toUpperCase();
    return {
      degree: 'BCA',
      year: '1st Year',
      semester: '1st Sem',
      section: formattedSec,
      badgeLabel: `BCA 1st Sem • ${formattedSec}`,
      badgeVariant: 'blue',
    };
  }
  if (['2b1', '2b2', '2b3'].includes(secLower) || (clsLower.includes('bca') && clsLower.includes('2nd sem') && secLower.startsWith('2b'))) {
    const formattedSec = secLower.toUpperCase();
    return {
      degree: 'BCA',
      year: '1st Year',
      semester: '2nd Sem',
      section: formattedSec,
      badgeLabel: `BCA 2nd Sem • ${formattedSec}`,
      badgeVariant: 'blue',
    };
  }

  // 2. Check BCA 2nd Year
  if (secLower.includes('3-vnovas') || secLower.includes('3vnovas') || secLower.includes('3-novas') || secLower === '3b2' || secLower === '3b3' || (clsLower.includes('3rd sem') && secLower.includes('novas'))) {
    const formattedSec = secLower.includes('3b2') ? '3B2' : secLower.includes('3b3') ? '3B3' : '3-VNOVAS';
    return {
      degree: 'BCA',
      year: '2nd Year',
      semester: '3rd Sem',
      section: formattedSec,
      badgeLabel: `BCA 3rd Sem • ${formattedSec}`,
      badgeVariant: 'purple',
    };
  }
  if (secLower.includes('4-vnovas') || secLower.includes('4vnovas') || secLower.includes('4-novas') || secLower === '4b2' || secLower === '4b3' || (clsLower.includes('4th sem') && secLower.includes('novas'))) {
    const formattedSec = secLower.includes('4b2') ? '4B2' : secLower.includes('4b3') ? '4B3' : '4-VNOVAS';
    return {
      degree: 'BCA',
      year: '2nd Year',
      semester: '4th Sem',
      section: formattedSec,
      badgeLabel: `BCA 4th Sem • ${formattedSec}`,
      badgeVariant: 'purple',
    };
  }

  // 3. Check BCA 3rd Year
  if (secLower.includes('5-vnovas') || secLower.includes('5vnovas') || secLower.includes('5th v') || secLower === '5b2' || (clsLower.includes('5th sem') && secLower.includes('novas'))) {
    const formattedSec = secLower.includes('5b2') ? '5B2' : '5-VNOVAS';
    return {
      degree: 'BCA',
      year: '3rd Year',
      semester: '5th Sem',
      section: formattedSec,
      badgeLabel: `BCA 5th Sem • ${formattedSec}`,
      badgeVariant: 'purple',
    };
  }
  if (secLower.includes('6-vnovas') || secLower.includes('6vnovas') || secLower.includes('6th v') || secLower === '6b2' || (clsLower.includes('6th sem') && secLower.includes('novas'))) {
    const formattedSec = secLower.includes('6b2') ? '6B2' : '6-VNOVAS';
    return {
      degree: 'BCA',
      year: '3rd Year',
      semester: '6th Sem',
      section: formattedSec,
      badgeLabel: `BCA 6th Sem • ${formattedSec}`,
      badgeVariant: 'purple',
    };
  }

  // Generic BCA fallback if class specifies semester
  if (clsLower.includes('bca')) {
    const semMatch = cls.match(/(\d)(?:st|nd|rd|th)\s*Sem/i);
    const sem = semMatch ? `${semMatch[1]}${semMatch[1] === '1' ? 'st' : semMatch[1] === '2' ? 'nd' : semMatch[1] === '3' ? 'rd' : 'th'} Sem` : null;
    const year = sem && (sem.startsWith('1') || sem.startsWith('2')) ? '1st Year' : sem && (sem.startsWith('3') || sem.startsWith('4')) ? '2nd Year' : '3rd Year';
    return {
      degree: 'BCA',
      year,
      semester: sem,
      section: sec || 'General',
      badgeLabel: `BCA ${sem || ''} • ${sec || 'General'}`.trim(),
      badgeVariant: 'blue',
    };
  }

  // 4. Check PUC
  if (clsLower.includes('puc') || secLower.includes('puc') || secLower === '1st year' || secLower === '2nd year') {
    const year = secLower.includes('2') || clsLower.includes('2') ? '2nd Year' : '1st Year';
    return {
      degree: 'PUC',
      year,
      semester: null,
      section: year,
      badgeLabel: `PUC • ${year}`,
      badgeVariant: 'emerald',
    };
  }

  // 5. Training / Workshop
  if (clsLower.includes('training') || secLower.includes('training')) {
    return {
      degree: 'TRAINING',
      year: null,
      semester: null,
      section: sec || 'Batch',
      badgeLabel: `Training • ${sec || 'Session'}`,
      badgeVariant: 'amber',
    };
  }
  if (clsLower.includes('workshop') || secLower.includes('workshop')) {
    return {
      degree: 'WORKSHOP',
      year: null,
      semester: null,
      section: sec || 'Session',
      badgeLabel: `Workshop • ${sec || 'Session'}`,
      badgeVariant: 'amber',
    };
  }

  // Default / Other
  return {
    degree: 'OTHER',
    year: null,
    semester: null,
    section: sec || 'General',
    badgeLabel: sec ? `Section ${sec}` : cls || 'General Session',
    badgeVariant: 'gray',
  };
}

// ───────── Grouped Filter Definitions ─────────

export const ACADEMIC_SECTION_GROUPS = [
  {
    group: 'BCA — 1st Year (Sem 1 & 2)',
    options: [
      { value: '1B1', label: '1B1 (1st Sem)' },
      { value: '1B2', label: '1B2 (1st Sem)' },
      { value: '1B3', label: '1B3 (1st Sem)' },
      { value: '2B1', label: '2B1 (2nd Sem)' },
      { value: '2B2', label: '2B2 (2nd Sem)' },
      { value: '2B3', label: '2B3 (2nd Sem)' },
    ],
  },
  {
    group: 'BCA — 2nd Year (Sem 3 & 4)',
    options: [
      { value: '3-VNOVAS', label: '3-VNOVAS (3rd Sem)' },
      { value: '3B2', label: '3B2 (3rd Sem)' },
      { value: '3B3', label: '3B3 (3rd Sem)' },
      { value: '4-VNOVAS', label: '4-VNOVAS (4th Sem)' },
      { value: '4B2', label: '4B2 (4th Sem)' },
      { value: '4B3', label: '4B3 (4th Sem)' },
    ],
  },
  {
    group: 'BCA — 3rd Year (Sem 5 & 6)',
    options: [
      { value: '5-VNOVAS', label: '5-VNOVAS (5th Sem)' },
      { value: '5B2', label: '5B2 (5th Sem)' },
      { value: '6-VNOVAS', label: '6-VNOVAS (6th Sem)' },
      { value: '6B2', label: '6B2 (6th Sem)' },
    ],
  },
  {
    group: 'PUC Program',
    options: [
      { value: '1st Year', label: 'PUC 1st Year' },
      { value: '2nd Year', label: 'PUC 2nd Year' },
    ],
  },
  {
    group: 'Special Programs',
    options: [
      { value: 'TRAINING', label: 'Training Sessions' },
      { value: 'WORKSHOP', label: 'Workshops' },
    ],
  },
];

// ───────── Smart Hardware Remark Classifier ─────────

const HARDWARE_DEFECT_KEYWORDS = [
  'not working',
  'not work',
  'broken',
  'damage',
  'fault',
  'mouse',
  'keyboard',
  'monitor',
  'screen',
  'display',
  'power',
  'stuck',
  'hang',
  'slow',
  'boot',
  'cpu',
  'cable',
  'loose',
  'off',
  'dead',
  'click',
  'repair',
  'replace',
  'restart',
  'shut',
  'flicker',
  'error',
  'jam',
  'issue',
  'problem',
  'defect',
  'black screen',
  'blue screen',
  'wire',
  'port',
  'usb',
  'no display',
];

/**
 * Returns true only if the remark describes a genuine hardware/machine defect.
 * Distinguishes hardware issues from student names/signatures accidentally written in remarks.
 */
export function isHardwareDefectRemark(remark: string | null | undefined): boolean {
  if (!remark) return false;
  const rem = remark.trim().toLowerCase();
  if (rem.length === 0) return false;

  // Check against known defect keywords
  return HARDWARE_DEFECT_KEYWORDS.some((kw) => rem.includes(kw));
}

