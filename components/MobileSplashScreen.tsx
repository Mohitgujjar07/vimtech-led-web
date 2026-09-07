'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

export default function MobileSplashScreen() {
  const [show, setShow] = useState<boolean | null>(null);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Only execute on client side
    if (typeof window === 'undefined') return;

    // Only show on mobile screens (< 768px)
    const isMobile = window.innerWidth < 768;
    const hasSeenSplash = sessionStorage.getItem('vimtech_splash_seen');

    if (isMobile && !hasSeenSplash) {
      setShow(true);

      // Start fade-out after 1.8 seconds
      const fadeTimer = setTimeout(() => {
        setFading(true);
      }, 1800);

      // Fully unmount after 2.3 seconds
      const hideTimer = setTimeout(() => {
        sessionStorage.setItem('vimtech_splash_seen', 'true');
        setShow(false);
      }, 2300);

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(hideTimer);
      };
    } else {
      setShow(false);
    }
  }, []);

  const handleDismiss = () => {
    setFading(true);
    setTimeout(() => {
      sessionStorage.setItem('vimtech_splash_seen', 'true');
      setShow(false);
    }, 300);
  };

  // If desktop (>= 768px) or already shown in this session, render nothing
  if (!show) return null;

  return (
    <aside
      onClick={handleDismiss}
      aria-label="VIMTECH Welcome Splash Screen"
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-between bg-black transition-opacity duration-500 md:hidden cursor-pointer select-none ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Top Bar with Skip Button */}
      <div className="absolute top-4 right-4 z-20">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleDismiss();
          }}
          className="rounded-full bg-black/40 backdrop-blur-md px-3.5 py-1 text-xs font-semibold text-white tracking-wide shadow-md hover:bg-black/60 transition-all border border-white/20"
        >
          Skip ✕
        </button>
      </div>

      {/* Main Fullscreen Splash Image */}
      <div className="relative h-full w-full">
        <Image
          src="/splash-screen.png"
          alt="VIMTECH Lab Ledger"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>

      {/* Bottom Loading Pill */}
      <div className="absolute bottom-6 left-0 right-0 z-20 flex items-center justify-center pointer-events-none">
        <div className="flex items-center gap-2 rounded-full bg-white/85 backdrop-blur-md px-4 py-1.5 shadow-lg border border-purple-100">
          <span className="h-2 w-2 rounded-full bg-purple-700 animate-ping" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-purple-950">
            Entering Lab Ledger...
          </span>
        </div>
      </div>
    </aside>
  );
}
