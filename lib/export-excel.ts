import { LabSession, LabEntry, Student } from './types';

interface ExportEntry extends LabEntry {
  student?: Student | null;
}

function sanitizeFormula(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

export async function generateSessionExcel(
  session: LabSession,
  entries: ExportEntry[]
) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  // Build header rows
  const headerData = [
    ['COMPUTER LAB LEDGER'],
    [],
    ['Date:', session.session_date, '', 'Section:', session.section || ''],
    ['Class:', session.class_name || '', '', 'Faculty:', session.faculty_name || ''],
    [],
    ['SL.NO', 'NAME', 'UUCMS NO.', 'SYSTEM NO.', 'SIGNED', 'REMARKS'],
  ];

  // Build data rows
  const dataRows = entries
    .sort((a, b) => (a.sl_no || 0) - (b.sl_no || 0))
    .map((entry) => [
      entry.sl_no || '',
      sanitizeFormula(entry.student?.name || entry.raw_name_ocr || ''),
      sanitizeFormula(entry.student?.ucms_no || entry.raw_ucms_ocr || ''),
      sanitizeFormula(entry.system_no || ''),
      entry.signature_present ? 'Yes' : 'No',
      sanitizeFormula(entry.remarks || ''),
    ]);

  // Totals row
  const totalsRow = [
    '',
    `Total Students: ${entries.length}`,
    '',
    `Systems: ${session.total_system_count ?? entries.length}`,
    `Mouse: ${session.total_mouse_count ?? ''}`,
    `Keyboard: ${session.total_keyboard_count ?? ''}`,
  ];

  // Remarks row
  const remarksRow = session.remarks
    ? ['', `Remarks: ${session.remarks}`]
    : [];

  const allRows = [
    ...headerData,
    ...dataRows,
    [],
    totalsRow,
    ...(remarksRow.length ? [remarksRow] : []),
  ];

  const ws = XLSX.utils.aoa_to_sheet(allRows);

  // Set column widths
  ws['!cols'] = [
    { wch: 8 },  // SL.NO
    { wch: 30 }, // NAME
    { wch: 18 }, // UCMS NO.
    { wch: 12 }, // SYSTEM NO.
    { wch: 10 }, // SIGNED
    { wch: 25 }, // REMARKS
  ];

  // Merge title row
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
  ];

  const dateStr = session.session_date || 'session';
  const sheetName = `${dateStr}_${session.section || 'all'}`.substring(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  return wb;
}

export async function generateDateRangeExcel(
  sessions: { session: LabSession; entries: ExportEntry[] }[]
) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  for (const { session, entries } of sessions) {
    const tempWb = await generateSessionExcel(session, entries);
    const sheetName = tempWb.SheetNames[0];
    const ws = tempWb.Sheets[sheetName];

    // Ensure unique sheet name
    let finalName = sheetName;
    let counter = 1;
    while (wb.SheetNames.includes(finalName)) {
      finalName = `${sheetName.substring(0, 28)}_${counter}`;
      counter++;
    }

    XLSX.utils.book_append_sheet(wb, ws, finalName);
  }

  return wb;
}

export async function downloadExcel(wb: unknown, filename: string): Promise<void> {
  const XLSX = await import('xlsx');
  XLSX.writeFile(wb as import('xlsx').WorkBook, filename);
}
