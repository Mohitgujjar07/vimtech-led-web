export interface Student {
  id: string;
  name: string;
  ucms_no: string;
  section: string | null;
  created_at: string;
}

export interface LabSession {
  id: string;
  session_date: string;
  section: string | null;
  class_name: string | null;
  faculty_name: string | null;
  total_system_count: number | null;
  total_mouse_count: number | null;
  total_keyboard_count: number | null;
  faculty_confirmed: boolean;
  remarks: string | null;
  created_at: string;
}

export interface SessionPhoto {
  id: string;
  session_id: string;
  photo_url: string;
  page_number: number;
  created_at: string;
}

export interface LabEntry {
  id: string;
  session_id: string;
  sl_no: number | null;
  raw_name_ocr: string | null;
  raw_ucms_ocr: string | null;
  student_id: string | null;
  system_no: string | null;
  signature_present: boolean;
  signature_crop_url: string | null;
  ocr_confidence: number | null;
  matched: boolean;
  remarks: string | null;
  created_at?: string;
  // Joined fields
  student?: Student | null;
}

// OCR extraction types
export interface OcrHeader {
  date: string | null;
  section: string | null;
  class: string | null;
  faculty_name: string | null;
  total_system_count: number | null;
  total_mouse_count: number | null;
  total_keyboard_count: number | null;
}

export interface OcrRow {
  sl_no: number;
  name: string;
  ucms_no: string;
  system_no: string;
  signature_present: boolean;
  remarks: string | null;
}

export interface OcrResult {
  header: OcrHeader;
  rows: OcrRow[];
}

export interface MatchResult {
  student_id: string;
  confidence: number;
}

// For the review table - combines OCR data with match results
export interface ReviewEntry {
  sl_no: number;
  raw_name_ocr: string;
  raw_ucms_ocr: string;
  system_no: string;
  signature_present: boolean;
  remarks: string | null;
  matched: boolean;
  student_id: string | null;
  student_name: string | null;
  student_ucms: string | null;
  ocr_confidence: number | null;
}
