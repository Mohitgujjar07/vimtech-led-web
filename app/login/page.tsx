'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { User, Lock, Loader2, LogIn, Eye, EyeOff, Smartphone, Download, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get('redirect') || '/';
  const redirect = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      toast.info(
        "To install on mobile: tap your browser menu (⋮) and choose 'Install app' or 'Add to Home screen'",
        { duration: 6000 }
      );
    }
  };

  const handleDownloadApk = async () => {
    try {
      const res = await fetch('/downloads/vimtech-lab-ledger.apk', { method: 'HEAD' });
      if (res.ok) {
        const link = document.createElement('a');
        link.href = '/downloads/vimtech-lab-ledger.apk';
        link.download = 'vimtech-lab-ledger.apk';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        toast.info(
          "APK package is ready to be loaded into 'public/downloads/vimtech-lab-ledger.apk'. In the meantime, use 'Install to Home Screen' above for instant full-screen app access!",
          { duration: 7000 }
        );
      }
    } catch {
      toast.info(
        "Tip: Use 'Install to Home Screen' above to add VIMTECH Lab Ledger to your phone!",
        { duration: 6000 }
      );
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error('Please enter username and password');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        toast.error(data.error || 'Invalid username or password');
      } else {
        toast.success('Welcome! Logged in successfully.');
        router.push(redirect);
        router.refresh();
      }
    } catch {
      toast.error('Network error during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Header with College Logo */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-purple-100 bg-white p-2 shadow-sm">
            <Image
              src="/logo.png"
              alt="Vaisiri Institute of Management & Technology"
              width={80}
              height={80}
              className="h-full w-full object-contain"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Lab Ledger</h1>
          <p className="mt-1 text-sm font-medium text-brand-700">
            VIMTECH • Computer Lab Management
          </p>
          <p className="text-xs text-gray-500">
            Faculty & Lab Staff Sign In
          </p>
        </div>

        {/* Login Card */}
        <div className="card shadow-lg border border-gray-100">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="input pl-10"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-hidden"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing In...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Sign In
                </>
              )}
            </button>
          </form>
        </div>

        {/* Mobile Download & App Install Section */}
        <div className="mt-5 rounded-xl border border-brand-100 bg-white/90 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-800">
            <Smartphone className="h-4 w-4 text-brand-600" />
            <span>Mobile App &amp; Offline Access</span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Access VIMTECH Lab Ledger on Android phones &amp; tablets:
          </p>

          <div className="mt-3 flex flex-col gap-2">
            {/* Install Web App (PWA) */}
            <button
              type="button"
              onClick={handleInstallApp}
              className="flex items-center justify-center gap-2 rounded-lg border border-brand-200 bg-brand-50/70 px-3 py-2 text-xs font-medium text-brand-800 transition hover:bg-brand-100"
            >
              {isInstalled ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  <span>App Installed on Device</span>
                </>
              ) : (
                <>
                  <Smartphone className="h-3.5 w-3.5 text-brand-700" />
                  <span>Install to Home Screen (Instant)</span>
                </>
              )}
            </button>

            {/* Direct APK Download */}
            <button
              type="button"
              onClick={handleDownloadApk}
              className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-100 hover:text-gray-900"
            >
              <Download className="h-3.5 w-3.5 text-gray-600" />
              <span>Download Android APK (.apk)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[80vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
