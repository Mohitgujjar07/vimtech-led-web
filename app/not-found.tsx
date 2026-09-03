import Link from 'next/link';
import { Home, AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
        <AlertCircle className="h-8 w-8" />
      </div>
      <h1 className="mt-4 text-2xl font-bold text-gray-900">Page Not Found</h1>
      <p className="mt-1 text-sm text-gray-500">
        The ledger page you are looking for does not exist or has been moved.
      </p>
      <Link href="/" className="btn-primary mt-6">
        <Home className="h-4 w-4" />
        Return to Home
      </Link>
    </div>
  );
}
