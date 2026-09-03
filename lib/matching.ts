import { createServerClient } from './supabase';
import { MatchResult, Student } from './types';

const MATCH_THRESHOLD = 0.5;

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

export async function matchAllEntriesFast(
  entries: { name: string; ucms_no: string }[],
  preloadedStudents?: Student[]
): Promise<(MatchResult | null)[]> {
  let students = preloadedStudents;
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

  if (students.length === 0) {
    return entries.map(() => null);
  }

  return entries.map((entry) => {
    let bestMatch: MatchResult | null = null;
    let maxConfidence = 0;

    for (const student of students!) {
      const nameSim = trigramSimilarity(entry.name || '', student.name || '');
      const ucmsSim = trigramSimilarity(entry.ucms_no || '', student.ucms_no || '');
      const confidence = Math.max(nameSim, ucmsSim);

      if (confidence > maxConfidence) {
        maxConfidence = confidence;
        if (confidence >= MATCH_THRESHOLD) {
          bestMatch = {
            student_id: student.id,
            confidence: Math.round(confidence * 100) / 100,
          };
        }
      }
    }

    return bestMatch;
  });
}

export async function matchAllEntries(
  entries: { raw_name_ocr: string; raw_ucms_ocr: string }[]
): Promise<(MatchResult | null)[]> {
  return matchAllEntriesFast(
    entries.map((e) => ({ name: e.raw_name_ocr, ucms_no: e.raw_ucms_ocr }))
  );
}

