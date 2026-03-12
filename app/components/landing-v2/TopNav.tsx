'use client';

import Link from 'next/link';

export function TopNav() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-8 py-3 bg-background/80 backdrop-blur-sm border-b border-border/30">
      {/* Logo */}
      <Link
        href="/"
        className="font-bebas text-xl md:text-2xl tracking-wide text-foreground hover:text-accent transition-colors"
      >
        JCIL.AI
      </Link>

      {/* Auth buttons */}
      <div className="flex items-center gap-3">
        <Link
          href="/login"
          className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
        >
          Log In
        </Link>
        <Link
          href="/signup"
          className="font-mono text-xs uppercase tracking-widest text-foreground border border-foreground/30 px-4 py-2 hover:border-accent hover:text-accent hover:bg-accent/10 transition-all duration-200"
        >
          Sign Up
        </Link>
      </div>
    </header>
  );
}
