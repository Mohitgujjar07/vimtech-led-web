import Link from 'next/link';
import { FileQuestion, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-600 shadow-sm">
        <FileQuestion className="h-7 w-7" />
      </div>
      <h2 className="text-xl font-bold text-gray-900">Page not found</h2>
      <p className="mt-1.5 max-w-md text-sm text-gray-500">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/dashboard"
        className="btn-primary mt-6 inline-flex items-center gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Return to Dashboard</span>
      </Link>
    </div>
  );
}
