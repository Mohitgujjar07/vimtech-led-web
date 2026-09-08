import { NextRequest, NextResponse } from 'next/server';
import { extractLedgerData } from '@/lib/gemini';
import { createServerClient } from '@/lib/supabase';
import { OcrResult } from '@/lib/types';
import { matchAllEntriesEnhanced } from '@/lib/matching';
import { verifySessionToken } from '@/lib/auth';

export const maxDuration = 60; // Allow up to 60s for OCR processing

export async function POST(request: NextRequest) {
  try {
    // Verify authentication to protect Gemini API quota from unauthorized abuse
    const sessionCookie = request.cookies.get('lab_auth_session')?.value;
    const authSession = sessionCookie ? await verifySessionToken(sessionCookie) : null;
    if (!authSession) {
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
    const errors: string[] = [];
    const ocrPromises = sortedPhotos.map(async (photo) => {
      try {
        const result = await extractLedgerData(photo.base64, photo.mimeType);
        return { result, pageNumber: photo.pageNumber };
      } catch (err) {
        console.warn(`OCR attempt 1 failed for page ${photo.pageNumber} (${err instanceof Error ? err.message : ''}), retrying...`);
        try {
          const retryResult = await extractLedgerData(photo.base64, photo.mimeType);
          return { result: retryResult, pageNumber: photo.pageNumber };
        } catch (retryErr) {
          const msg = retryErr instanceof Error ? retryErr.message : 'Unknown OCR error';
          console.error(`OCR failed for page ${photo.pageNumber}:`, msg);
          errors.push(`Page ${photo.pageNumber}: ${msg}`);
          return null;
        }
      }
    });

    const settledResults = await Promise.all(ocrPromises);
    const ocrResults = settledResults.filter(
      (r): r is { result: OcrResult; pageNumber: number } => r !== null
    );

    if (ocrResults.length === 0) {
      const detailedError = errors.length > 0 ? errors[0] : 'Please check your image clarity.';
      return NextResponse.json(
        { error: `OCR extraction failed for all photos. ${detailedError}` },
        { status: 500 }
      );
    }

    // Sort OCR results strictly by page number
    ocrResults.sort((a, b) => a.pageNumber - b.pageNumber);

    // Merge results: header from first photo with non-empty header, all rows concatenated in page order
    const headerResult =
      ocrResults.find(
        (r) => r.result.header && (r.result.header.date || r.result.header.section || r.result.header.class)
      ) || ocrResults[0];
    const header = headerResult.result.header || {};

    // Concatenate all rows from all pages in order, ensuring continuous SL.NO sequencing
    const rawRows = ocrResults.flatMap((r) => r.result.rows || []);
    let currentSl = 0;
    const allRows = rawRows.map((row) => {
      let sl = row.sl_no;
      if (!sl || sl <= currentSl) {
        currentSl += 1;
        sl = currentSl;
      } else {
        currentSl = sl;
      }
      return {
        ...row,
        sl_no: sl,
      };
    });

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

    // Match extracted handwriting rows against the master student roster with optical normalization & auto-correction
    const finalSection = header.section || section || null;
    const matchResults = await matchAllEntriesEnhanced(
      allRows.map((r) => ({ name: r.name || '', ucms_no: r.ucms_no || '' })),
      { sessionSection: finalSection }
    );

    // Map extracted OCR rows to lab_entries, auto-correcting to verified roster data when confidence is high
    const entriesToInsert = allRows.map((row, idx) => {
      const match = matchResults[idx];
      const isAutoCorrected = !!match?.auto_corrected;

      // Auto-correct to official student Name & UUCMS if matched
      const effectiveName = isAutoCorrected ? match.student_name : (row.name || '');
      const effectiveUcms = isAutoCorrected ? match.student_ucms : (row.ucms_no || '');

      // Preserve original handwriting remark if there was an auto-correction discrepancy
      let remarks = row.remarks || null;
      if (isAutoCorrected && (row.name !== match.student_name || row.ucms_no !== match.student_ucms)) {
        const rawNote = `[Handwriting: ${row.name || '—'} / ${row.ucms_no || '—'}]`;
        remarks = remarks ? `${remarks} ${rawNote}` : rawNote;
      }

      return {
        session_id: session.id,
        sl_no: row.sl_no,
        raw_name_ocr: effectiveName,
        raw_ucms_ocr: effectiveUcms,
        system_no: row.system_no || null,
        signature_present: row.signature_present || false,
        remarks,
        student_id: match ? match.student_id : null,
        matched: !!match?.matched,
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
    const autoCorrectedCount = matchResults.filter((m) => m?.auto_corrected).length;

    return NextResponse.json({
      sessionId: session.id,
      totalPhotos: ocrResults.length,
      totalEntries: entriesToInsert.length,
      matchedEntries: matchedCount,
      autoCorrectedEntries: autoCorrectedCount,
    });
  } catch (err) {
    console.error('OCR route error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
