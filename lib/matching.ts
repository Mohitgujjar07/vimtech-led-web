import { createServerClient } from './supabase';
import { MatchResult, Student } from './types';

export const MATCH_THRESHOLD = 0.5;
export const AUTO_CORRECT_THRESHOLD = 0.65;

export interface EnhancedMatchResult {
  student_id: string;
  student_name: string;
  student_ucms: string;
  student_section: string | null;
  confidence: number;
  matched: boolean;
  auto_corrected: boolean;
  match_reason: 'exact_uucms' | 'normalized_uucms' | 'exact_name' | 'token_name' | 'fuzzy' | 'alias';
  original_name: string;
  original_ucms: string;
}

/**
 * Optical character normalization for handwritten Indian college roll numbers.
 * Maps visually ambiguous handwritten OCR characters to canonical forms.
 */
export function normalizeUcmsKey(val: string): string {
  if (!val) return '';
  return val
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/5/g, 'S')
    .replace(/0/g, 'O')
    .replace(/[1L|]/g, 'I')
    .replace(/8/g, 'B')
    .replace(/2/g, 'Z')
    .replace(/6/g, 'G');
}

/**
 * Strips whitespace, dots, and symbols for clean comparison.
 */
export function cleanUcmsStrict(val: string): string {
  if (!val) return '';
  return val.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
}

/**
 * Fast trigram similarity computation.
 */
export function trigramSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  const s1 = `  ${str1.toLowerCase().trim()} `;
  const s2 = `  ${str2.toLowerCase().trim()} `;
  if (s1 === s2) return 1.0;
  if (s1.length < 3 || s2.length < 3) {
    return s1.includes(s2) || s2.includes(s1) ? 0.8 : 0;
  }

  const set1 = new Set<string>();
  for (let i = 0; i <= s1.length - 3; i++) {
    set1.add(s1.substring(i, i + 3));
  }

  const set2 = new Set<string>();
  for (let i = 0; i <= s2.length - 3; i++) {
    set2.add(s2.substring(i, i + 3));
  }

  let intersection = 0;
  for (const tri of set1) {
    if (set2.has(tri)) intersection++;
  }

  const union = set1.size + set2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Token and initials similarity for Indian student names.
 * e.g. "Mohit G" vs "Mohit Gujjar", "Kavya S" vs "Kavya Srinivas", "Prajwal K R" vs "Prajwal Kumar R".
 */
export function tokenNameSimilarity(ocrName: string, rosterName: string): number {
  if (!ocrName || !rosterName) return 0;
  const clean1 = ocrName.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const clean2 = rosterName.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

  if (clean1 === clean2) return 1.0;

  const t1 = clean1.split(/\s+/).filter(Boolean);
  const t2 = clean2.split(/\s+/).filter(Boolean);

  if (t1.length === 0 || t2.length === 0) return 0;

  let matchedTokens = 0;
  const usedT2 = new Set<number>();

  for (const token1 of t1) {
    let foundIndex = -1;
    // 1. Exact token match
    for (let j = 0; j < t2.length; j++) {
      if (!usedT2.has(j) && t2[j] === token1) {
        foundIndex = j;
        break;
      }
    }

    // 2. Initial match (e.g. "g" matches "gujjar" or "gujjar" matches "g")
    if (foundIndex === -1) {
      for (let j = 0; j < t2.length; j++) {
        if (!usedT2.has(j)) {
          if (
            (token1.length === 1 && t2[j].startsWith(token1)) ||
            (t2[j].length === 1 && token1.startsWith(t2[j])) ||
            (token1.length >= 3 && t2[j].startsWith(token1)) ||
            (t2[j].length >= 3 && token1.startsWith(t2[j]))
          ) {
            foundIndex = j;
            break;
          }
        }
      }
    }

    if (foundIndex !== -1) {
      matchedTokens++;
      usedT2.add(foundIndex);
    }
  }

  const shorterLen = Math.min(t1.length, t2.length);
  const longerLen = Math.max(t1.length, t2.length);

  if (matchedTokens === shorterLen && shorterLen > 0) {
    return 0.88 + 0.1 * (shorterLen / longerLen);
  }

  return matchedTokens / longerLen;
}

/**
 * Matches a single handwritten OCR entry against the enrolled student roster with optical normalization.
 */
export function matchSingleEntry(
  entry: { name: string; ucms_no: string },
  students: Student[],
  sessionSection?: string | null
): EnhancedMatchResult | null {
  if (!students || students.length === 0) return null;

  const rawName = (entry.name || '').trim();
  const rawUcms = (entry.ucms_no || '').trim();
  const strictUcms = cleanUcmsStrict(rawUcms);
  const normUcms = normalizeUcmsKey(rawUcms);

  let bestMatch: EnhancedMatchResult | null = null;
  let maxScore = 0;

  for (const student of students) {
    const studentStrictUcms = cleanUcmsStrict(student.ucms_no);
    const studentNormUcms = normalizeUcmsKey(student.ucms_no);

    let score = 0;
    let reason: EnhancedMatchResult['match_reason'] = 'fuzzy';

    // 1. Exact UUCMS Match (Highest priority)
    if (strictUcms && studentStrictUcms && strictUcms === studentStrictUcms) {
      score = 1.0;
      reason = 'exact_uucms';
    }
    // 2. Optical-Normalized UUCMS Match (e.g. 5 <-> S, 0 <-> O, 1 <-> I)
    else if (normUcms && studentNormUcms && normUcms === studentNormUcms) {
      score = 0.98;
      reason = 'normalized_uucms';
    } else {
      // 3. Name similarities
      const exactNameMatch = rawName.toLowerCase() === student.name.toLowerCase();
      const tokenSim = tokenNameSimilarity(rawName, student.name);
      const trigramNameSim = trigramSimilarity(rawName, student.name);
      const bestNameSim = exactNameMatch ? 0.96 : Math.max(tokenSim, trigramNameSim);

      // 4. Partial UUCMS trigram
      const ucmsTri = strictUcms && studentStrictUcms ? trigramSimilarity(strictUcms, studentStrictUcms) : 0;

      if (exactNameMatch) {
        score = 0.96;
        reason = 'exact_name';
      } else if (tokenSim >= 0.85) {
        score = tokenSim;
        reason = 'token_name';
      } else {
        score = Math.max(bestNameSim, ucmsTri);
        reason = 'fuzzy';
      }

      // 5. Joint confirmation: If both name AND UUCMS partially match, boost confidence
      if (bestNameSim >= 0.5 && ucmsTri >= 0.5) {
        score = Math.min(1.0, score + 0.15);
      }
    }

    // 6. Section affinity weighting: if student belongs to session section/year, give small boost
    if (sessionSection && student.section && score >= 0.4) {
      const sSec = sessionSection.toLowerCase();
      const stSec = student.section.toLowerCase();
      if (sSec === stSec || sSec.includes(stSec) || stSec.includes(sSec)) {
        score = Math.min(1.0, score + 0.05);
      }
    }

    if (score > maxScore) {
      maxScore = score;
      if (score >= MATCH_THRESHOLD) {
        bestMatch = {
          student_id: student.id,
          student_name: student.name,
          student_ucms: student.ucms_no,
          student_section: student.section,
          confidence: Math.round(score * 100) / 100,
          matched: true,
          auto_corrected: score >= AUTO_CORRECT_THRESHOLD,
          match_reason: reason,
          original_name: rawName,
          original_ucms: rawUcms,
        };
      }
    }
  }

  return bestMatch;
}

/**
 * Matches all extracted ledger rows against the enrolled students roster.
 */
export async function matchAllEntriesEnhanced(
  entries: { name: string; ucms_no: string }[],
  options?: {
    preloadedStudents?: Student[];
    sessionSection?: string | null;
  }
): Promise<(EnhancedMatchResult | null)[]> {
  let students = options?.preloadedStudents;

  if (!students) {
    try {
      const supabase = createServerClient();
      const { data } = await supabase
        .from('students')
        .select('id, name, ucms_no, section');
      students = (data || []) as Student[];
    } catch {
      students = [];
    }
  }

  if (!students || students.length === 0) {
    return entries.map(() => null);
  }

  return entries.map((entry) =>
    matchSingleEntry(entry, students, options?.sessionSection)
  );
}

/**
 * Backward-compatible fast matching for existing callers.
 */
export async function matchAllEntriesFast(
  entries: { name: string; ucms_no: string }[],
  preloadedStudents?: Student[]
): Promise<(MatchResult | null)[]> {
  const enhanced = await matchAllEntriesEnhanced(entries, {
    preloadedStudents,
  });
  return enhanced.map((res) =>
    res ? { student_id: res.student_id, confidence: res.confidence } : null
  );
}

export async function matchAllEntries(
  entries: { raw_name_ocr: string; raw_ucms_ocr: string }[]
): Promise<(MatchResult | null)[]> {
  return matchAllEntriesFast(
    entries.map((e) => ({ name: e.raw_name_ocr, ucms_no: e.raw_ucms_ocr }))
  );
}

export async function matchStudent(
  ocrName: string,
  ocrUcms: string
): Promise<MatchResult | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc('match_student', {
    ocr_name: ocrName || '',
    ocr_ucms: ocrUcms || '',
  });

  if (error) {
    console.error('Match student error:', error);
    return null;
  }

  if (data && data.length > 0 && data[0].confidence >= MATCH_THRESHOLD) {
    return {
      student_id: data[0].student_id,
      confidence: data[0].confidence,
    };
  }

  return null;
}
