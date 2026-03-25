/**
 * JCIL Isolate — Download Page
 * Direct download page for JCIL Isolate desktop app.
 * Accessible at jcil.ai/isolate
 */

import { Metadata } from 'next';
import Link from 'next/link';
import { DownloadButtons } from './DownloadButtons';

export const metadata: Metadata = {
  title: 'JCIL Isolate — Private Offline AI',
  description: 'Download JCIL Isolate. Your AI, your device, your privacy. 100% offline. Zero tracking. No accounts.',
  openGraph: {
    title: 'JCIL Isolate — Private Offline AI',
    description: 'Your AI, your device, your privacy. 100% offline. Zero tracking.',
  },
};


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

        {/* Download buttons — auto-detects platform */}
        <div className="mt-16 mb-16">
          <h2 className="font-bebas text-3xl mb-6">DOWNLOAD — FREE</h2>
          <DownloadButtons />
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
