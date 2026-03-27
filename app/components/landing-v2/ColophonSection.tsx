'use client';

import { useRef, useEffect } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function ColophonSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      if (headerRef.current) {
        gsap.from(headerRef.current, {
          x: -60,
          opacity: 0,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: headerRef.current,
            start: 'top 85%',
            toggleActions: 'play none none reverse',
          },
        });
      }

      if (gridRef.current) {
        const columns = gridRef.current.querySelectorAll(':scope > div');
        gsap.from(columns, {
          y: 40,
          opacity: 0,
          duration: 0.8,
          stagger: 0.1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: gridRef.current,
            start: 'top 85%',
            toggleActions: 'play none none reverse',
          },
        });
      }

      if (footerRef.current) {
        gsap.from(footerRef.current, {
          y: 20,
          opacity: 0,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: footerRef.current,
            start: 'top 95%',
            toggleActions: 'play none none reverse',
          },
        });
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="colophon"
      className="relative py-32 pl-6 md:pl-28 pr-6 md:pr-12 border-t border-border/30"
    >
      <div ref={headerRef} className="mb-16">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">
          05 / Connect
        </span>
        <h2 className="mt-4 font-bebas text-5xl md:text-7xl tracking-tight">GET STARTED</h2>
      </div>

      <div ref={gridRef} className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8 md:gap-12">
        <div className="col-span-1">
          <h4 className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-4">
            Products
          </h4>
          <ul className="space-y-2">
            <li>
              <Link
                href="/chat"
                className="font-mono text-xs text-foreground/80 hover:text-accent transition-colors duration-200"
              >
                Chat
              </Link>
            </li>
            <li>
              <a
                href="/code-lab"
                className="font-mono text-xs text-foreground/80 hover:text-accent transition-colors duration-200"
              >
                Code Lab
              </a>
            </li>
            <li>
              <a
                href="/capabilities"
                className="font-mono text-xs text-foreground/80 hover:text-accent transition-colors duration-200"
              >
                Capabilities
              </a>
            </li>
            <li>
              <a
                href="/docs"
                className="font-mono text-xs text-foreground/80 hover:text-accent transition-colors duration-200"
              >
                Docs
              </a>
            </li>
          </ul>
        </div>

        <div className="col-span-1">
          <h4 className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-4">
            Powered By
          </h4>
          <ul className="space-y-2">
            <li className="font-mono text-xs text-foreground">Anthropic (Claude)</li>
            <li className="font-mono text-[10px] text-muted-foreground mt-3 uppercase tracking-wider">
              BYOK Support:
            </li>
            <li className="font-mono text-xs text-foreground/60">OpenAI (GPT-4o)</li>
            <li className="font-mono text-xs text-foreground/60">Google (Gemini)</li>
            <li className="font-mono text-xs text-foreground/60">xAI (Grok)</li>
          </ul>
        </div>

        <div className="col-span-1">
          <h4 className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-4">
            Key Integrations
          </h4>
          <ul className="space-y-2">
            <li className="font-mono text-xs text-foreground/80">
              Composio (88 apps, 2,500+ actions)
            </li>
            <li className="font-mono text-xs text-foreground/80">E2B Sandbox</li>
            <li className="font-mono text-xs text-foreground/80">FLUX.2</li>
          </ul>
        </div>

        <div className="col-span-1">
          <h4 className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-4">
            Built For
          </h4>
          <ul className="space-y-2">
            <li className="font-mono text-xs text-foreground/80">Pastors</li>
            <li className="font-mono text-xs text-foreground/80">Developers</li>
            <li className="font-mono text-xs text-foreground/80">Ministries</li>
            <li className="font-mono text-xs text-foreground/80">Families</li>
          </ul>
        </div>

        <div className="col-span-1">
          <h4 className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-4">
            Contact
          </h4>
          <ul className="space-y-2">
            <li>
              <a
                href="mailto:support@jcil.ai"
                className="font-mono text-xs text-foreground/80 hover:text-accent transition-colors duration-200"
              >
                support@jcil.ai
              </a>
            </li>
            <li>
              <Link
                href="/chat"
                className="font-mono text-xs text-foreground/80 hover:text-accent transition-colors duration-200"
              >
                Try JCIL.AI
              </Link>
            </li>
          </ul>
        </div>

        <div className="col-span-1">
          <h4 className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground mb-4">
            Security
          </h4>
          <ul className="space-y-2">
            <li className="font-mono text-xs text-foreground/80">AES-256 Encryption</li>
            <li className="font-mono text-xs text-foreground/80">Composio (SOC 2)</li>
            <li className="font-mono text-xs text-foreground/80">Supabase RLS</li>
          </ul>
        </div>
      </div>

      <div className="mt-16 flex flex-wrap gap-4">
        <Link
          href="/chat"
          className="inline-flex items-center gap-3 border border-accent bg-accent/10 px-8 py-4 font-mono text-sm uppercase tracking-widest text-accent hover:bg-accent/20 transition-all duration-200"
        >
          Start Free — No Credit Card
        </Link>
        <a
          href="/code-lab"
          className="inline-flex items-center gap-3 border border-foreground/20 px-8 py-4 font-mono text-sm uppercase tracking-widest text-foreground hover:border-foreground/40 transition-all duration-200"
        >
          Explore Code Lab
        </a>
      </div>

      <div
        ref={footerRef}
        className="mt-24 pt-8 border-t border-border/20 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
          &copy; 2026 JCIL.AI. All rights reserved.
        </p>
        <p className="font-mono text-[10px] text-muted-foreground">
          AI that shares your values. Built with conviction.
        </p>
      </div>
    </section>
  );
}
