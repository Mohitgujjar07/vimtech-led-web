import Link from 'next/link';
import { FileSpreadsheet, Users, Camera, Download, ArrowRight } from 'lucide-react';

const features = [
  {
    icon: Camera,
    title: 'Photo to Data',
    description: 'Snap a photo of your lab ledger and let AI extract all student entries automatically.',
  },
  {
    icon: Users,
    title: 'Instant Extraction',
    description: 'Automatic handwriting extraction captures names, UCMS numbers, systems, and signatures directly from your paper ledger.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Excel & PDF Export',
    description: 'Export sessions as formatted spreadsheets or print-ready PDFs with one click.',
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col items-center">
      {/* Hero */}
      <div className="mt-8 text-center sm:mt-16">
        <div className="mb-4 inline-flex items-center rounded-full bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700 ring-1 ring-inset ring-brand-600/20">
          ✨ AI-Powered Lab Ledger Digitization
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          From paper ledger to
          <span className="text-brand-700"> digital records</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-gray-600">
          Stop manually typing lab session data. Photograph your ledger,
          let Gemini AI read it, and get clean, searchable, exportable records.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href="/sessions/new" className="btn-primary text-base px-6 py-3">
            <Camera className="h-5 w-5" />
            New Session
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/sessions" className="btn-secondary text-base px-6 py-3">
            <FileSpreadsheet className="h-5 w-5" />
            View Sessions
          </Link>
        </div>
      </div>

      {/* Feature cards */}
      <div className="mt-16 grid w-full max-w-4xl gap-6 sm:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <div key={feature.title} className="card text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50">
                <Icon className="h-6 w-6 text-brand-700" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">{feature.title}</h3>
              <p className="mt-1 text-xs text-gray-500">{feature.description}</p>
            </div>
          );
        })}
      </div>

      {/* Quick links */}
      <div className="mt-12 mb-8 flex flex-wrap justify-center gap-4 text-sm">
        <Link href="/dashboard" className="text-brand-600 hover:text-brand-800 hover:underline">
          Dashboard &amp; Analytics →
        </Link>
        <Link href="/export" className="text-brand-600 hover:text-brand-800 hover:underline">
          Export Data →
        </Link>
      </div>
    </div>
  );
}
