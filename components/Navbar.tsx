'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  Users,
  Download,
  BarChart3,
  LogOut,
  Plus,
  BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';

const navLinks = [
  { href: '/sessions', label: 'Sessions', icon: BookOpen },
  { href: '/roster', label: 'Roster', icon: Users },
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/export', label: 'Export', icon: Download },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    toast.success('Logged out');
    router.push('/login');
    router.refresh();
  };

  // Don't show navigation bar on login page
  if (pathname === '/login') {
    return null;
  }

  const isSessionsActive =
    pathname === '/sessions' ||
    (pathname.startsWith('/sessions/') && pathname !== '/sessions/new');
  const isNewSessionActive = pathname === '/sessions/new';
  const isRosterActive = pathname.startsWith('/roster');
  const isDashboardActive = pathname.startsWith('/dashboard');
  const isExportActive = pathname.startsWith('/export');

  return (
    <>
      {/* ────────────────── DESKTOP TOP NAVBAR (md: and up) ────────────────── */}
      <nav className="sticky top-0 z-50 hidden md:block border-b border-gray-200 bg-white/95">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo + brand */}
            <Link href="/sessions" className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white p-1 border border-purple-100 shadow-2xs">
                <Image
                  src="/logo.png"
                  alt="VIMTECH Logo"
                  width={40}
                  height={40}
                  className="h-full w-full object-contain"
                  priority
                />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-black text-gray-900 leading-tight">VIMTECH</span>
                <span className="text-xs font-bold text-brand-700 leading-tight">Lab Ledger</span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="flex items-center gap-1.5">
              <Link
                href="/sessions/new"
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all ${
                  isNewSessionActive
                    ? 'bg-brand-700 text-white shadow-sm'
                    : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                }`}
              >
                <Plus className="h-4 w-4" />
                New Session
              </Link>

              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive =
                  (link.href === '/sessions' && isSessionsActive) ||
                  (link.href !== '/sessions' && pathname.startsWith(link.href));

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-gray-100 text-brand-700 font-semibold'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                );
              })}

              <div className="ml-2 pl-2 border-l border-gray-200">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden lg:inline">Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* ────────────────── MOBILE SLIM TOP HEADER (< md) ────────────────── */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-gray-200 bg-white/95 px-3.5 md:hidden">
        <Link href="/sessions" className="flex items-center gap-2.5">
          <Image
            src="/app-logo.png"
            alt="VIMTECH Lab Ledger"
            width={36}
            height={36}
            className="h-9 w-9 rounded-xl object-contain shadow-2xs border border-purple-100"
            priority
          />
          <div>
            <span className="text-xs font-black tracking-tight text-gray-900 block leading-tight">
              VIMTECH
            </span>
            <span className="text-[11px] font-bold text-brand-700 block leading-tight">
              Lab Ledger
            </span>
          </div>
        </Link>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-red-50 hover:text-red-600"
          aria-label="Logout"
        >
          <LogOut className="h-4 w-4" />
          <span>Exit</span>
        </button>
      </header>

      {/* ────────────────── MOBILE BOTTOM NAVIGATION BAR (< md) ────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-gray-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.05)] md:hidden">
        {/* Tab 1: Sessions */}
        <Link
          href="/sessions"
          className={`flex flex-1 flex-col items-center justify-center py-1 text-[11px] font-medium transition-colors ${
            isSessionsActive ? 'text-brand-700 font-bold' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <BookOpen className={`h-5 w-5 mb-0.5 ${isSessionsActive ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
          <span>Sessions</span>
        </Link>

        {/* Tab 2: Roster */}
        <Link
          href="/roster"
          className={`flex flex-1 flex-col items-center justify-center py-1 text-[11px] font-medium transition-colors ${
            isRosterActive ? 'text-brand-700 font-bold' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Users className={`h-5 w-5 mb-0.5 ${isRosterActive ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
          <span>Roster</span>
        </Link>

        {/* Tab 3: Center Elevated Action (+ New Session) */}
        <div className="flex flex-1 items-center justify-center">
          <Link
            href="/sessions/new"
            aria-label="New Session"
            className="group relative -top-3 flex h-13 w-13 items-center justify-center rounded-full bg-gradient-to-tr from-brand-700 to-brand-500 text-white shadow-lg ring-4 ring-white transition-transform active:scale-95"
          >
            <Plus className="h-6 w-6 stroke-[2.5]" />
          </Link>
        </div>

        {/* Tab 4: Dashboard */}
        <Link
          href="/dashboard"
          className={`flex flex-1 flex-col items-center justify-center py-1 text-[11px] font-medium transition-colors ${
            isDashboardActive ? 'text-brand-700 font-bold' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <BarChart3 className={`h-5 w-5 mb-0.5 ${isDashboardActive ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
          <span>Dashboard</span>
        </Link>

        {/* Tab 5: Export */}
        <Link
          href="/export"
          className={`flex flex-1 flex-col items-center justify-center py-1 text-[11px] font-medium transition-colors ${
            isExportActive ? 'text-brand-700 font-bold' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Download className={`h-5 w-5 mb-0.5 ${isExportActive ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
          <span>Export</span>
        </Link>
      </nav>
    </>
  );
}
