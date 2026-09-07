# VIMTECH Lab Ledger — Development & Architectural Rules

## 1. Mobile-First UI/UX Standards
- **Thumb-Accessible Navigation**: On mobile screens (`< 768px`), primary navigation must reside in a fixed Bottom Navigation Bar (`fixed bottom-0 left-0 right-0 z-50`) with an elevated center action button.
- **Safe-Area Padding**: Pages must maintain bottom padding (`pb-24 md:pb-8`) so content is never obscured by the docked bottom navigation bar.
- **Zero Horizontal Scrolling**: Never render wide multi-column HTML tables directly on mobile devices. Always implement an adaptive view:
  - Mobile (`< 768px`): Clean card/list view where all fields (Name, UUCMS, System No, Remarks) fit within viewport width with zero sideways scrolling.
  - Desktop (`>= 768px`): High-density tabular spreadsheet view.
- **Touch-Friendly Hit Targets**: Frequent binary toggles (e.g. Signature Yes/No) must be large thumb buttons (min 44px height) with high-contrast active states.

## 2. React 19 & Next.js Performance Guardrails
- **Supabase Client Singleton**: Always cache the browser Supabase client at module scope in `lib/supabase.ts`. Never instantiate a new browser client on every function call or component render.
- **Row-Level Memoization**: Large editable lists (e.g. 50–100 student entries) must extract each row into a `React.memo`-wrapped component with `useCallback` handlers and functional state updaters (`setEntries(prev => ...)`). Only the active row being edited should re-render.
- **Dynamic Heavy Imports**: Never import heavyweight libraries (`xlsx`, `@react-pdf/renderer`, `papaparse`) statically at the top of page or component files. Always load them on demand using dynamic `await import(...)` inside action handlers.
- **Search Debouncing**: Any input that triggers database queries (e.g. student lookup) must be debounced by at least 300ms using a `useRef` timer with unmount cleanup.

## 3. PDF Generation & Document Design
- **Institutional Logo Banners**: When rendering wide rectangular college logos (~6:1 aspect ratio), never force them into square boxes (e.g. 50x50) or side-by-side rows with document titles.
- **Centered Header Layout**: Always place the logo banner horizontally centered at the top of the page with `objectFit: 'contain'`, appropriate width (340–380pt), and render centered document titles (`COMPUTER LAB LEDGER`) directly below the banner.

## 4. Local Network & Dev Configuration
- When running the Next.js development server for mobile testing on local Wi-Fi, ensure `package.json` specifies `"dev": "next dev -H 0.0.0.0"` and any test device IP addresses (e.g. `192.168.x.x`, `192.168.x.x:3000`) are listed in `allowedDevOrigins` in `next.config.js`.
