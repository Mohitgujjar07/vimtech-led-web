import { NextRequest, NextResponse } from 'next/server';
import { extractLedgerData } from '@/lib/gemini';
import { createServerClient } from '@/lib/supabase';
import { OcrResult } from '@/lib/types';
import { matchAllEntriesFast } from '@/lib/matching';

export const maxDuration = 60; // Allow up to 60s for OCR processing

export async function POST(request: NextRequest) {
  try {
    // Verify authentication to protect Gemini API quota from unauthorized abuse
    const sessionCookie = request.cookies.get('lab_auth_session')?.value;
    if (sessionCookie !== 'authenticated') {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to process ledger photos.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      photos,
      sessionDate,
      section,
      className,
      facultyName,
    }: {
      photos: { base64: string; mimeType: string; pageNumber: number }[];
      sessionDate: string;
      section: string | null;
      className: string | null;
      facultyName: string | null;
    } = body;

    if (!photos || photos.length === 0) {
      return NextResponse.json(
        { error: 'No photos provided' },
        { status: 400 }
      );
    }

    if (photos.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 photos allowed per session upload' },
        { status: 400 }
      );
    }

    // Sort photos by page number
    const sortedPhotos = [...photos].sort(
      (a, b) => a.pageNumber - b.pageNumber
    );

    // Process all photos through OCR concurrently for maximum speed
    const ocrPromises = sortedPhotos.map(async (photo) => {
      try {
        const result = await extractLedgerData(photo.base64, photo.mimeType);
        return { result, pageNumber: photo.pageNumber };
      } catch (err) {
        console.error(`OCR failed for page ${photo.pageNumber}:`, err);
        return null;
      }
    });

    const settledResults = await Promise.all(ocrPromises);
    const ocrResults = settledResults.filter(
      (r): r is { result: OcrResult; pageNumber: number } => r !== null
    );

    if (ocrResults.length === 0) {
      return NextResponse.json(
        { error: 'OCR extraction failed for all photos. Please check your image clarity.' },
        { status: 500 }
      );
    }

    // Merge results: header from first photo only, all rows concatenated
    const firstResult = ocrResults[0].result;
    const header = firstResult.header;
    const allRows = ocrResults.flatMap((r) => r.result.rows);

    const supabase = createServerClient();

    // Helper to normalize any handwritten date format (DD/MM/YYYY, etc.) to YYYY-MM-DD
    const normalizeDate = (raw: string | null | undefined, fallback: string): string => {
      if (!raw || typeof raw !== 'string') return fallback;
      const cleaned = raw.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

      const dmy = cleaned.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})$/);
      if (dmy) {
        const d = dmy[1].padStart(2, '0');
        const m = dmy[2].padStart(2, '0');
        let y = dmy[3];
        if (y.length === 2) y = `20${y}`;
        return `${y}-${m}-${d}`;
      }

      const parsed = new Date(cleaned);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
      return fallback;
    };

    const parseCount = (val: unknown): number | null => {
      if (typeof val === 'number' && !isNaN(val)) return Math.floor(val);
      if (typeof val === 'string') {
        const n = parseInt(val.replace(/\D/g, ''), 10);
        return isNaN(n) ? null : n;
      }
      return null;
    };

    const fallbackDate = sessionDate || new Date().toISOString().split('T')[0];
    const finalDate = normalizeDate(header.date, fallbackDate);

    // Create the lab session
    const { data: session, error: sessionError } = await supabase
      .from('lab_sessions')
      .insert({
        session_date: finalDate,
        section: header.section || section || null,
        class_name: header.class || className || null,
        faculty_name: header.faculty_name || facultyName || null,
        total_system_count: parseCount(header.total_system_count) ?? (allRows.length > 0 ? allRows.length : null),
        total_mouse_count: parseCount(header.total_mouse_count),
        total_keyboard_count: parseCount(header.total_keyboard_count),
      })
      .select()
      .single();

    if (sessionError || !session) {
      console.error('Session creation error:', sessionError);
      return NextResponse.json(
        { error: `Failed to create session: ${sessionError?.message || 'Database error'}` },
        { status: 500 }
      );
    }

    // Concurrently upload photos to Supabase Storage in parallel
    const photoUploadPromises = sortedPhotos.map(async (photo) => {
      try {
        const photoBuffer = Buffer.from(photo.base64, 'base64');
        const ext = photo.mimeType.split('/')[1] || 'jpeg';
        const filePath = `${session.id}/page-${photo.pageNumber}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('session-photos')
          .upload(filePath, photoBuffer, {
            contentType: photo.mimeType,
            upsert: true,
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('session-photos')
            .getPublicUrl(filePath);

          await supabase.from('session_photos').insert({
            session_id: session.id,
            photo_url: urlData.publicUrl,
            page_number: photo.pageNumber,
          });
        }
      } catch (err) {
        console.error(`Photo upload failed for page ${photo.pageNumber}:`, err);
      }
    });

    // Concurrently upload photos
    await Promise.all(photoUploadPromises);

    // Fuzzy-match extracted student names & UUCMS numbers against enrolled roster
    const matchResults = await matchAllEntriesFast(
      allRows.map((r) => ({ name: r.name || '', ucms_no: r.ucms_no || '' }))
    );

    // Map extracted OCR rows to lab_entries with authentic match results
    const entriesToInsert = allRows.map((row, idx) => {
      const match = matchResults[idx];
      return {
        session_id: session.id,
        sl_no: row.sl_no,
        raw_name_ocr: row.name || '',
        raw_ucms_ocr: row.ucms_no || '',
        system_no: row.system_no || null,
        signature_present: row.signature_present || false,
        remarks: row.remarks || null,
        student_id: match ? match.student_id : null,
        matched: !!match,
        ocr_confidence: match ? match.confidence : null,
      };
    });

    // Single Batch Insert for all lab entries
    if (entriesToInsert.length > 0) {
      const { error: batchInsertError } = await supabase
        .from('lab_entries')
        .insert(entriesToInsert);

      if (batchInsertError) {
        console.error('Batch insert error:', batchInsertError);
        throw batchInsertError;
      }
    }

    const matchedCount = entriesToInsert.filter((e) => e.matched).length;

    return NextResponse.json({
      sessionId: session.id,
      totalPhotos: ocrResults.length,
      totalEntries: entriesToInsert.length,
      matchedEntries: matchedCount,
    });
  } catch (err) {
    console.error('OCR route error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
