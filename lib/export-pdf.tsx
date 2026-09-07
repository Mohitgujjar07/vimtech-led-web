import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer';
import { LabSession, LabEntry, Student } from './types';

interface ExportEntry extends LabEntry {
  student?: Student | null;
}

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  headerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderBottom: '2px solid #6b21a8',
    paddingBottom: 8,
  },
  logo: {
    width: 64,
    height: 64,
    objectFit: 'contain',
    alignSelf: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: '#6b21a8',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#666666',
    marginTop: 2,
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 4,
    fontSize: 10,
  },
  metaLabel: {
    fontFamily: 'Helvetica-Bold',
    width: 80,
  },
  metaValue: {
    flex: 1,
  },
  metaSection: {
    marginBottom: 12,
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#6b21a8',
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    padding: 5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '0.5px solid #e5e7eb',
    padding: 4,
    fontSize: 9,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottom: '0.5px solid #e5e7eb',
    padding: 4,
    fontSize: 9,
    backgroundColor: '#faf5ff',
  },
  colSlNo: { width: '8%' },
  colName: { width: '28%' },
  colUcms: { width: '18%' },
  colSystem: { width: '12%' },
  colSigned: { width: '10%' },
  colRemarks: { width: '24%' },
  totalsRow: {
    flexDirection: 'row',
    marginTop: 10,
    padding: 6,
    backgroundColor: '#f3e8ff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
  },
  remarksSection: {
    marginTop: 10,
    padding: 8,
    borderTop: '1px solid #d8b4fe',
  },
  remarksLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#6b21a8',
  },
  remarksText: {
    fontSize: 10,
    marginTop: 3,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#999',
    borderTop: '0.5px solid #e5e7eb',
    paddingTop: 5,
  },
});

interface SessionPdfProps {
  session: LabSession;
  entries: ExportEntry[];
  logoBase64?: string;
}

export function SessionPdfDocument({
  session,
  entries,
  logoBase64,
}: SessionPdfProps) {
  const sortedEntries = [...entries].sort(
    (a, b) => (a.sl_no || 0) - (b.sl_no || 0)
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerContainer}>
          {logoBase64 && (
            <Image style={styles.logo} src={logoBase64} />
          )}
          <Text style={styles.title}>Computer Lab Ledger</Text>
          <Text style={styles.subtitle}>VIMTECH</Text>
        </View>

        {/* Session metadata */}
        <View style={styles.metaSection}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Date:</Text>
            <Text style={styles.metaValue}>{session.session_date}</Text>
            <Text style={styles.metaLabel}>Section:</Text>
            <Text style={styles.metaValue}>{session.section || '-'}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Class:</Text>
            <Text style={styles.metaValue}>{session.class_name || '-'}</Text>
            <Text style={styles.metaLabel}>Faculty:</Text>
            <Text style={styles.metaValue}>{session.faculty_name || '-'}</Text>
          </View>
        </View>

        {/* Table */}
        <View style={styles.table}>
          {/* Header row */}
          <View style={styles.tableHeader}>
            <Text style={styles.colSlNo}>SL.NO</Text>
            <Text style={styles.colName}>NAME</Text>
            <Text style={styles.colUcms}>UUCMS NO.</Text>
            <Text style={styles.colSystem}>SYSTEM</Text>
            <Text style={styles.colSigned}>SIGNED</Text>
            <Text style={styles.colRemarks}>REMARKS</Text>
          </View>

          {/* Data rows */}
          {sortedEntries.map((entry, idx) => (
            <View
              key={entry.id || idx}
              style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
            >
              <Text style={styles.colSlNo}>{entry.sl_no || ''}</Text>
              <Text style={styles.colName}>
                {entry.student?.name || entry.raw_name_ocr || ''}
              </Text>
              <Text style={styles.colUcms}>
                {entry.student?.ucms_no || entry.raw_ucms_ocr || ''}
              </Text>
              <Text style={styles.colSystem}>{entry.system_no || ''}</Text>
              <Text style={styles.colSigned}>
                {entry.signature_present ? 'Yes' : 'No'}
              </Text>
              <Text style={styles.colRemarks}>{entry.remarks || ''}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsRow}>
          <Text>
            Total Students: {entries.length}
            {'    '}Systems: {session.total_system_count ?? entries.length}
            {'    '}Mouse: {session.total_mouse_count ?? '-'}
            {'    '}Keyboard: {session.total_keyboard_count ?? '-'}
          </Text>
        </View>

        {/* Session remarks */}
        {session.remarks && (
          <View style={styles.remarksSection}>
            <Text style={styles.remarksLabel}>Session Remarks:</Text>
            <Text style={styles.remarksText}>{session.remarks}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Lab Ledger — VIMTECH</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

interface MultiSessionPdfProps {
  sessions: { session: LabSession; entries: ExportEntry[] }[];
  logoBase64?: string;
}

export function MultiSessionPdfDocument({
  sessions,
  logoBase64,
}: MultiSessionPdfProps) {
  return (
    <Document>
      {sessions.map(({ session, entries }, sIdx) => {
        const sortedEntries = [...entries].sort(
          (a, b) => (a.sl_no || 0) - (b.sl_no || 0)
        );

        return (
          <Page key={session.id || sIdx} size="A4" style={styles.page}>
            {/* Header */}
            <View style={styles.headerContainer}>
              {logoBase64 && (
                <Image style={styles.logo} src={logoBase64} />
              )}
              <Text style={styles.title}>Computer Lab Ledger</Text>
              <Text style={styles.subtitle}>VIMTECH</Text>
            </View>

            {/* Session metadata */}
            <View style={styles.metaSection}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Date:</Text>
                <Text style={styles.metaValue}>{session.session_date}</Text>
                <Text style={styles.metaLabel}>Section:</Text>
                <Text style={styles.metaValue}>{session.section || '-'}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Class:</Text>
                <Text style={styles.metaValue}>{session.class_name || '-'}</Text>
                <Text style={styles.metaLabel}>Faculty:</Text>
                <Text style={styles.metaValue}>{session.faculty_name || '-'}</Text>
              </View>
            </View>

            {/* Table */}
            <View style={styles.table}>
              {/* Header row */}
              <View style={styles.tableHeader}>
                <Text style={styles.colSlNo}>SL.NO</Text>
                <Text style={styles.colName}>NAME</Text>
                <Text style={styles.colUcms}>UUCMS NO.</Text>
                <Text style={styles.colSystem}>SYSTEM</Text>
                <Text style={styles.colSigned}>SIGNED</Text>
                <Text style={styles.colRemarks}>REMARKS</Text>
              </View>

              {/* Data rows */}
              {sortedEntries.map((entry, idx) => (
                <View
                  key={entry.id || idx}
                  style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                >
                  <Text style={styles.colSlNo}>{entry.sl_no || ''}</Text>
                  <Text style={styles.colName}>
                    {entry.student?.name || entry.raw_name_ocr || ''}
                  </Text>
                  <Text style={styles.colUcms}>
                    {entry.student?.ucms_no || entry.raw_ucms_ocr || ''}
                  </Text>
                  <Text style={styles.colSystem}>{entry.system_no || ''}</Text>
                  <Text style={styles.colSigned}>
                    {entry.signature_present ? 'Yes' : 'No'}
                  </Text>
                  <Text style={styles.colRemarks}>{entry.remarks || ''}</Text>
                </View>
              ))}
            </View>

            {/* Totals */}
            <View style={styles.totalsRow}>
              <Text>
                Total Students: {entries.length}
                {'    '}Systems: {session.total_system_count ?? entries.length}
                {'    '}Mouse: {session.total_mouse_count ?? '-'}
                {'    '}Keyboard: {session.total_keyboard_count ?? '-'}
              </Text>
            </View>

            {/* Session remarks */}
            {session.remarks && (
              <View style={styles.remarksSection}>
                <Text style={styles.remarksLabel}>Session Remarks:</Text>
                <Text style={styles.remarksText}>{session.remarks}</Text>
              </View>
            )}

            {/* Footer */}
            <View style={styles.footer} fixed>
              <Text>Lab Ledger — VIMTECH</Text>
              <Text
                render={({ pageNumber, totalPages }) =>
                  `Page ${pageNumber} of ${totalPages}`
                }
              />
            </View>
          </Page>
        );
      })}
    </Document>
  );
}
