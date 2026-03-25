/**
 * JCIL Isolate — Download Page
 * Direct download page for JCIL Isolate desktop app.
 * Accessible at jcil.ai/isolate
 */

import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'JCIL Isolate — Private Offline AI',
  description: 'Download JCIL Isolate. Your AI, your device, your privacy. 100% offline. Zero tracking. No accounts.',
  openGraph: {
    title: 'JCIL Isolate — Private Offline AI',
    description: 'Your AI, your device, your privacy. 100% offline. Zero tracking.',
  },
};

const MAC_ARM_URL = 'https://github.com/themusashimaru/jcil-isolate/releases/latest/download/JCIL-Isolate-1.0.0-mac-arm64.dmg';
const MAC_INTEL_URL = 'https://github.com/themusashimaru/jcil-isolate/releases/latest/download/JCIL-Isolate-1.0.0-mac-x64.dmg';
const WINDOWS_URL = 'https://github.com/themusashimaru/jcil-isolate/releases/latest';

export default function IsolatePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-6 py-20 md:py-32">
        {/* Badge */}
        <span className="inline-block border border-green-500/30 bg-green-500/10 text-green-400 font-mono text-[10px] uppercase tracking-[0.3em] px-4 py-1.5 mb-8">
          JUST RELEASED
        </span>

        {/* Header */}
        <h1 className="font-bebas text-[clamp(3rem,10vw,8rem)] leading-[0.85] tracking-tight">
          JCIL<br />ISOLATE
        </h1>

        <p className="mt-6 max-w-xl font-mono text-sm text-muted-foreground leading-relaxed">
          Your AI. Your device. Your privacy. A desktop AI assistant that runs 100% offline.
          No cloud, no tracking, no accounts. Every conversation stays on your machine — permanently.
        </p>

        {/* Stats */}
        <div className="mt-10 flex flex-wrap gap-8 md:gap-12">
          <div>
            <span className="font-bebas text-5xl text-green-400">0</span>
            <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Data Collected</span>
          </div>
          <div>
            <span className="font-bebas text-5xl text-green-400">0</span>
            <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Cloud Servers</span>
          </div>
          <div>
            <span className="font-bebas text-5xl text-green-400">0</span>
            <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Accounts Required</span>
          </div>
          <div>
            <span className="font-bebas text-5xl text-accent">&infin;</span>
            <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Privacy</span>
          </div>
        </div>

        {/* Download buttons */}
        <div className="mt-16 mb-16">
          <h2 className="font-bebas text-3xl mb-6">DOWNLOAD — FREE</h2>
          <div className="flex flex-wrap gap-4">
            <a
              href={MAC_ARM_URL}
              className="inline-flex items-center gap-3 border border-green-500/30 bg-green-500/10 px-8 py-4 font-mono text-sm uppercase tracking-widest text-green-400 hover:bg-green-500/20 hover:border-green-500/50 transition-all duration-200"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              Mac (Apple Silicon)
            </a>
            <a
              href={MAC_INTEL_URL}
              className="inline-flex items-center gap-3 border border-foreground/20 px-8 py-4 font-mono text-sm uppercase tracking-widest text-foreground hover:border-foreground/40 transition-all duration-200"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              Mac (Intel)
            </a>
            <a
              href={WINDOWS_URL}
              className="inline-flex items-center gap-3 border border-foreground/20 px-8 py-4 font-mono text-sm uppercase tracking-widest text-foreground hover:border-foreground/40 transition-all duration-200"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/></svg>
              Windows
            </a>
          </div>
          <p className="mt-4 font-mono text-[10px] text-muted-foreground/50">
            Mac: If you see &quot;unidentified developer&quot; warning, right-click &gt; Open. Requires macOS 13+ or Windows 10+. ~100MB download.
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[1px] bg-border mb-16">
          <div className="bg-background p-8">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-green-400">100% OFFLINE</span>
            <h3 className="font-bebas text-2xl mt-2">No Internet Required</h3>
            <p className="mt-2 font-mono text-xs text-muted-foreground leading-relaxed">Runs entirely on your device. No cloud servers. No API calls. Works anywhere.</p>
          </div>
          <div className="bg-background p-8">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-green-400">ZERO TELEMETRY</span>
            <h3 className="font-bebas text-2xl mt-2">Nothing Leaves Your Machine</h3>
            <p className="mt-2 font-mono text-xs text-muted-foreground leading-relaxed">No analytics. No tracking. No data collection. We literally cannot see your conversations.</p>
          </div>
          <div className="bg-background p-8">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-green-400">NO ACCOUNTS</span>
            <h3 className="font-bebas text-2xl mt-2">Nothing to Hack</h3>
            <p className="mt-2 font-mono text-xs text-muted-foreground leading-relaxed">No email. No password. No database. Just download, open, and talk.</p>
          </div>
          <div className="bg-background p-8">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-green-400">FAITH GROUNDED</span>
            <h3 className="font-bebas text-2xl mt-2">Scripture-Based Values</h3>
            <p className="mt-2 font-mono text-xs text-muted-foreground leading-relaxed">Biblical values, non-denominational. Built to serve with conviction and compassion.</p>
          </div>
        </div>

        {/* How it works */}
        <div className="mb-16">
          <h2 className="font-bebas text-3xl mb-8">HOW IT WORKS</h2>
          <div className="space-y-6">
            <div className="flex gap-4 items-start">
              <span className="font-bebas text-2xl text-accent w-8">1</span>
              <div>
                <p className="font-mono text-sm text-foreground">Download and install</p>
                <p className="font-mono text-xs text-muted-foreground mt-1">One file. Double-click. Done.</p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <span className="font-bebas text-2xl text-accent w-8">2</span>
              <div>
                <p className="font-mono text-sm text-foreground">First launch sets everything up</p>
                <p className="font-mono text-xs text-muted-foreground mt-1">The app installs the AI model automatically. Takes about 30 seconds.</p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <span className="font-bebas text-2xl text-accent w-8">3</span>
              <div>
                <p className="font-mono text-sm text-foreground">Start chatting — offline, forever</p>
                <p className="font-mono text-xs text-muted-foreground mt-1">Disconnect from the internet. It still works. That&apos;s the whole point.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Back link */}
        <Link href="/" className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
          &larr; Back to JCIL.AI
        </Link>
      </div>
    </div>
  );
}
