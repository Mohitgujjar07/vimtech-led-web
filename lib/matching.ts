import { createServerClient } from './supabase';
import { MatchResult, Student } from './types';

export const MATCH_THRESHOLD = 0.75;
export const AUTO_CORRECT_THRESHOLD = 0.78;

export interface EnhancedMatchResult {
  student_id: string;
  student_name: string;
  student_ucms: string;
  student_section: string | null;
  confidence: number;
  matched: boolean;
  auto_corrected: boolean;
  match_reason: 'exact_both' | 'exact_uucms' | 'normalized_uucms' | 'exact_name' | 'token_name' | 'ucms_match_with_name_support' | 'fuzzy' | 'alias';
  original_name: string;
  original_ucms: string;
}

/**
 * Checks if the given session is for PUC (Pre-University College).
 * The user confirmed that only BCA 1st/2nd/3rd year students are enrolled in the roster,
 * so PUC sessions must NEVER be auto-corrected or matched against the BCA roster.
 */
export function isPucSession(className?: string | null, section?: string | null): boolean {
  const c = (className || '').toLowerCase();
  const s = (section || '').toLowerCase();
  return c.includes('puc') || /\bpu\b/.test(c) || s.includes('puc') || /\bpu\b/.test(s);
}

/**
 * Standard Levenshtein edit distance.
 */
export function levenshtein(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const d: number[][] = [];
  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[m][n];
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
 * Extracts the 3-4 digit serial number from UUCMS roll numbers (e.g. "U11YB26S0154" -> 154).
 */
export function extractUcmsSerial(ucms: string): number | null {
  if (!ucms) return null;
  const clean = ucms.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = clean.match(/(\d{3,4})$/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Parses an Indian student name into core words (length >= 3) and initials (length <= 2).
 */
export function parseNameTokens(name: string): { coreWords: string[]; initials: string[]; allTokens: string[] } {
  if (!name) return { coreWords: [], initials: [], allTokens: [] };
  const clean = name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
  const tokens = clean.split(/\s+/).filter(Boolean);
  const coreWords: string[] = [];
  const initials: string[] = [];
  for (const t of tokens) {
    if (t.length <= 2) initials.push(t);
    else coreWords.push(t);
  }
  return { coreWords, initials, allTokens: tokens };
}

/**
 * Strictly compares handwritten OCR student names against enrolled roster names.
 * Ensures the given core name must match closely, avoiding matching "Harshitha" to "Ganavi B H" or "Vedashree" to "Jamuna".
 */
export function compareNameStrict(ocrName: string, rosterName: string): number {
  if (!ocrName || !rosterName) return 0;
  const n1 = ocrName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const n2 = rosterName.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (n1 === n2) return 1.0;

  const p1 = parseNameTokens(ocrName);
  const p2 = parseNameTokens(rosterName);

  if (p1.coreWords.length === 0 || p2.coreWords.length === 0) {
    return n1 === n2 ? 1.0 : 0;
  }

  // Find best match for each core word in p1 against p2
  let coreMatches = 0;
  let totalCoreSim = 0;

  for (const w1 of p1.coreWords) {
    let bestSim = 0;
    for (const w2 of p2.coreWords) {
      if (w1 === w2) {
        bestSim = 1.0;
        break;
      }
      const dist = levenshtein(w1, w2);
      const maxL = Math.max(w1.length, w2.length);
      const maxAllowedDist = maxL >= 5 ? 2 : 1;
      if (dist <= maxAllowedDist) {
        const sim = 1.0 - (dist / maxL);
        if (sim > bestSim) bestSim = sim;
      }
    }
    if (bestSim >= 0.7) {
      coreMatches++;
      totalCoreSim += bestSim;
    }
  }

  // If NO core words matched, completely different person!
  if (coreMatches === 0) return 0;

  const avgCoreSim = totalCoreSim / p1.coreWords.length;

  // Compare initials
  let initialsBonus = 0;
  if (p1.initials.length > 0 && p2.initials.length > 0) {
    const init1 = p1.initials.join('');
    const init2 = p2.initials.join('');
    if (init1 === init2) {
      initialsBonus = 0.05;
    } else if (init1.includes(init2) || init2.includes(init1)) {
      initialsBonus = 0.02;
    } else {
      // Contradicting initials! e.g. OCR wrote BR, roster has KM
      return Math.max(0, avgCoreSim - 0.25);
    }
  }

  return Math.min(1.0, avgCoreSim + initialsBonus);
}

/**
 * Strictly compares handwritten UUCMS against roster UUCMS.
 * NEVER uses full string trigrams (which conflated different students who share the common "U11YB26S" prefix).
 */
export function compareUcmsStrict(rawOcrUcms: string, rosterUcms: string): number {
  if (!rawOcrUcms || !rosterUcms) return 0;
  const cleanOcr = cleanUcmsStrict(rawOcrUcms);
  const cleanRoster = cleanUcmsStrict(rosterUcms);

  if (cleanOcr === cleanRoster) return 1.0;
  if (normalizeUcmsKey(cleanOcr) === normalizeUcmsKey(cleanRoster)) return 0.98;

  const ocrSerial = extractUcmsSerial(cleanOcr);
  const rosterSerial = extractUcmsSerial(cleanRoster);

  if (ocrSerial !== null && rosterSerial !== null) {
    if (ocrSerial === rosterSerial) {
      // Same serial! Check if year/prefix is compatible
      return 0.95;
    } else {
      // Different serial! Distinct roll numbers
      return 0.0;
    }
  }

  return 0;
}

/**
 * Fast trigram similarity computation (kept for backward compatibility).
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
 * Token and initials similarity (uses strict core name comparison).
 */
export function tokenNameSimilarity(ocrName: string, rosterName: string): number {
  return compareNameStrict(ocrName, rosterName);
}

/**
 * Matches a single handwritten OCR entry against the enrolled student roster with optical normalization.
 */
export function matchSingleEntry(
  entry: { name: string; ucms_no: string },
  students: Student[],
  sessionSection?: string | null,
  sessionClassName?: string | null
): EnhancedMatchResult | null {
  if (!students || students.length === 0) return null;

  // Rule 1: PUC sessions NEVER match against BCA student roster
  if (isPucSession(sessionClassName, sessionSection)) {
    return null;
  }

  const rawName = (entry.name || '').trim();
  const rawUcms = (entry.ucms_no || '').trim();
  if (!rawName && !rawUcms) return null;

  let bestStudent: Student | null = null;
  let bestScore = 0;
  let matchReason: EnhancedMatchResult['match_reason'] = 'fuzzy';

  for (const s of students) {
    const nameSim = compareNameStrict(rawName, s.name);
    const ucmsSim = compareUcmsStrict(rawUcms, s.ucms_no);

    // Section affinity boost
    let secBoost = 0;
    if (sessionSection && s.section) {
      const sSec = sessionSection.toLowerCase();
      const stSec = s.section.toLowerCase();
      const secMatch =
        sSec.includes(stSec) ||
        stSec.includes(sSec) ||
        (sSec.startsWith('1') && s.section === 'I') ||
        (sSec.startsWith('3') && s.section === 'III') ||
        (sSec.startsWith('5') && s.section === 'V');
      if (secMatch) secBoost = 0.05;
    }

    let candidateScore = 0;
    let reason: EnhancedMatchResult['match_reason'] = 'fuzzy';

    // Case 1: Both name and UUCMS match strongly
    if (nameSim >= 0.75 && ucmsSim >= 0.95) {
      candidateScore = 0.5 * nameSim + 0.5 * ucmsSim + secBoost;
      reason = 'exact_both';
    }
    // Case 2: Exact or high name match, UUCMS was slightly off or blank
    else if (nameSim >= 0.85 && (ucmsSim >= 0.9 || !rawUcms)) {
      candidateScore = nameSim + secBoost;
      reason = nameSim === 1.0 ? 'exact_name' : 'token_name';
    }
    // Case 3: Exact or high UUCMS match, name has minor OCR typo (>= 0.7)
    else if (ucmsSim >= 0.95 && nameSim >= 0.7) {
      candidateScore = 0.4 * nameSim + 0.6 * ucmsSim + secBoost;
      reason = 'ucms_match_with_name_support';
    }
    // Case 4: Contradiction! (e.g. Chethana with Geetha's roll number, or Harshitha with Ganavi's roll number)
    // NEVER match when nameSim < 0.6!
    else {
      candidateScore = 0;
    }

    if (candidateScore > bestScore && candidateScore >= MATCH_THRESHOLD) {
      bestScore = candidateScore;
      bestStudent = s;
      matchReason = reason;
    }
  }

  if (!bestStudent || bestScore < MATCH_THRESHOLD) {
    return null;
  }

  return {
    student_id: bestStudent.id,
    student_name: bestStudent.name,
    student_ucms: bestStudent.ucms_no,
    student_section: bestStudent.section,
    confidence: Math.round(bestScore * 100) / 100,
    matched: true,
    auto_corrected: bestScore >= AUTO_CORRECT_THRESHOLD,
    match_reason: matchReason,
    original_name: rawName,
    original_ucms: rawUcms,
  };
}

/**
 * Matches all extracted ledger rows against the enrolled students roster.
 */
export async function matchAllEntriesEnhanced(
  entries: { name: string; ucms_no: string }[],
  options?: {
    preloadedStudents?: Student[];
    sessionSection?: string | null;
    sessionClassName?: string | null;
  }
): Promise<(EnhancedMatchResult | null)[]> {
  // If PUC session, skip matching entirely
  if (isPucSession(options?.sessionClassName, options?.sessionSection)) {
    return entries.map(() => null);
  }

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
    matchSingleEntry(entry, students!, options?.sessionSection, options?.sessionClassName)
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
