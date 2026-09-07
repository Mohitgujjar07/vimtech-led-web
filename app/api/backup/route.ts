import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { timingSafeEqualStr } from '@/lib/auth';
import * as XLSX from 'xlsx';

export const maxDuration = 60;

// This endpoint is designed to be called by Vercel Cron (weekly)
// or manually by an admin. It generates an Excel backup of recent sessions
// and stores it in Supabase Storage.

export async function GET(request: Request) {
  try {
    // Verify cron secret — reject if missing or mismatched using timingSafeEqualStr
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    const expectedHeader = cronSecret ? `Bearer ${cronSecret}` : '';
    const isAuthorized =
      Boolean(cronSecret) &&
      Boolean(authHeader) &&
      timingSafeEqualStr(authHeader as string, expectedHeader);

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    // Get sessions from the past 7 days
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const fromDate = oneWeekAgo.toISOString().split('T')[0];

    const { data: sessions, error: sessionsError } = await supabase
      .from('lab_sessions')
      .select('*')
      .gte('session_date', fromDate)
      .order('session_date', { ascending: true });

    if (sessionsError) {
      throw new Error(`Failed to fetch sessions: ${sessionsError.message}`);
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        message: 'No sessions found in the past week',
        backupCreated: false,
      });
    }

    // Batch fetch all entries for these sessions in a single query
    const sessionIds = sessions.map((s) => s.id);
    const { data: allEntries, error: entriesError } = await supabase
      .from('lab_entries')
      .select('*, student:students(name, ucms_no)')
      .in('session_id', sessionIds)
      .order('sl_no', { ascending: true });

    if (entriesError) {
      throw new Error(`Failed to fetch session entries: ${entriesError.message}`);
    }

    // Group entries by session_id
    const entriesBySessionId = new Map<string, typeof allEntries>();
    for (const entry of allEntries || []) {
      const existing = entriesBySessionId.get(entry.session_id) || [];
      existing.push(entry);
      entriesBySessionId.set(entry.session_id, existing);
    }

    // Create workbook
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      ['WEEKLY BACKUP REPORT'],
      ['Generated:', new Date().toISOString()],
      ['Period:', `${fromDate} to ${new Date().toISOString().split('T')[0]}`],
      ['Total Sessions:', sessions.length],
      [],
      ['Date', 'Section', 'Class', 'Faculty', 'Confirmed', 'Remarks'],
      ...sessions.map((s) => [
        s.session_date,
        s.section || '',
        s.class_name || '',
        s.faculty_name || '',
        s.faculty_confirmed ? 'Yes' : 'No',
        s.remarks || '',
      ]),
    ];
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    summaryWs['!cols'] = [
      { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

    // Individual session sheets
    for (const session of sessions) {
      const entries = entriesBySessionId.get(session.id) || [];

      const sheetData = [
        ['COMPUTER LAB LEDGER'],
        [],
        ['Date:', session.session_date, '', 'Section:', session.section || ''],
        ['Class:', session.class_name || '', '', 'Faculty:', session.faculty_name || ''],
        [],
        ['SL.NO', 'NAME', 'UCMS NO.', 'SYSTEM NO.', 'SIGNED', 'REMARKS'],
        ...entries.map((e: Record<string, unknown>) => [
          e.sl_no || '',
          (e.student as Record<string, unknown>)?.name || e.raw_name_ocr || '',
          (e.student as Record<string, unknown>)?.ucms_no || e.raw_ucms_ocr || '',
          e.system_no || '',
          e.signature_present ? 'Yes' : 'No',
          e.remarks || '',
        ]),
        [],
        [
          '',
          `Total: ${entries.length}`,
          '',
          `Systems: ${session.total_system_count ?? entries.length}`,
          `Mouse: ${session.total_mouse_count ?? ''}`,
          `Keyboard: ${session.total_keyboard_count ?? ''}`,
        ],
      ];

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws['!cols'] = [
        { wch: 8 }, { wch: 30 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 25 },
      ];

      const sheetName = `${session.session_date}_${session.section || 'all'}`.substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Upload to Supabase Storage
    const now = new Date();
    const filename = `backup-${now.toISOString().split('T')[0]}-week.xlsx`;
    const filePath = `backups/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from('session-photos') // Reuse existing bucket
      .upload(filePath, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true,
      });

    if (uploadError) {
      console.error('Backup upload error:', uploadError);
      throw new Error(`Failed to upload backup: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('session-photos')
      .getPublicUrl(filePath);

    // 90-day rolling photo retention cleanup
    // Once a session is confirmed and >90 days old, photo is pruned from storage
    let photosArchived = 0;
    try {
      let photosToDelete: { photo_id: string; photo_url: string; session_id: string }[] = [];

      const { data: rpcPhotos, error: rpcError } = await supabase.rpc('photos_due_for_deletion', {
        retention_days: 90,
      });

      if (!rpcError && rpcPhotos) {
        photosToDelete = rpcPhotos;
      } else {
        // Fallback to query if RPC not yet created
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const { data: queryPhotos } = await supabase
          .from('session_photos')
          .select('id, photo_url, session_id, lab_sessions!inner(faculty_confirmed)')
          .eq('archived', false)
          .eq('lab_sessions.faculty_confirmed', true)
          .lt('created_at', ninetyDaysAgo.toISOString());

        if (queryPhotos) {
          photosToDelete = queryPhotos.map((p: Record<string, unknown>) => ({
            photo_id: p.id as string,
            photo_url: p.photo_url as string,
            session_id: p.session_id as string,
          }));
        }
      }

      if (photosToDelete.length > 0) {
        const paths: string[] = [];
        for (const photo of photosToDelete) {
          const url = photo.photo_url;
          const match = url ? url.match(/session-photos\/(.+)$/) : null;
          if (match && match[1]) {
            paths.push(match[1]);
          }
        }

        if (paths.length > 0) {
          const { error: removeError } = await supabase.storage.from('session-photos').remove(paths);
          if (removeError) {
            console.error('Failed to batch remove storage paths:', removeError);
          }
        }

        const photoIds = photosToDelete.map((p) => p.photo_id);
        const { error: archiveError } = await supabase
          .from('session_photos')
          .update({ archived: true })
          .in('id', photoIds);

        if (archiveError) {
          console.error('Failed to batch archive session photos:', archiveError);
        } else {
          photosArchived = photosToDelete.length;
        }
      }
    } catch (retentionErr) {
      console.warn('Photo retention cleanup notice:', retentionErr);
    }

    return NextResponse.json({
      message: 'Backup created successfully',
      backupCreated: true,
      sessionsCount: sessions.length,
      filename,
      url: urlData.publicUrl,
      photosArchived,
    });
  } catch (err) {
    console.error('Backup error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Backup failed' },
      { status: 500 }
    );
  }
}
