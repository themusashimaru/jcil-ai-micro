'use client';

import { useRef, useEffect } from 'react';
import { ScrambleTextOnHover } from './ScrambleText';
import { BitmapChevron } from './BitmapChevron';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const MAC_ARM_URL = 'https://github.com/themusashimaru/jcil-isolate/releases/latest/download/JCIL-Isolate-1.2.0-mac-arm64.pkg';
const MAC_INTEL_URL = 'https://github.com/themusashimaru/jcil-isolate/releases/latest/download/JCIL-Isolate-1.2.0-mac-x64.pkg';
const WINDOWS_URL = 'https://github.com/themusashimaru/jcil-isolate/releases/latest';

const features = [
  {
    label: '100% OFFLINE',
    title: 'No Internet Required',
    description: 'Runs entirely on your device. No cloud servers. No API calls. Works on an airplane, in a bunker, off the grid.',
  },
  {
    label: 'ZERO TELEMETRY',
    title: 'Nothing Leaves Your Machine',
    description: 'No analytics. No tracking. No data collection. No usage logs. We literally cannot see your conversations.',
  },
  {
    label: 'NO ACCOUNTS',
    title: 'Nothing to Hack',
    description: 'No email. No password. No database storing your info. Just download, open, and talk. That simple.',
  },
  {
    label: 'FAITH GROUNDED',
    title: 'Scripture-Based Values',
    description: 'The same biblical values as JCIL.AI — non-denominational, grounded in Scripture alone. Built to serve, not to compromise.',
  },
];

export function IsolateSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      if (badgeRef.current) {
        gsap.fromTo(badgeRef.current,
          { scale: 0.8, opacity: 0 },
          {
            scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(1.7)',
            scrollTrigger: { trigger: badgeRef.current, start: 'top 90%', toggleActions: 'play none none reverse' },
          }
        );
      }

      if (headerRef.current) {
        gsap.fromTo(headerRef.current,
          { y: 40, opacity: 0 },
          {
            y: 0, opacity: 1, duration: 0.8, ease: 'power3.out',
            scrollTrigger: { trigger: headerRef.current, start: 'top 85%', toggleActions: 'play none none reverse' },
          }
        );
      }

      if (cardsRef.current) {
        const cards = cardsRef.current.querySelectorAll('article');
        cards.forEach((card, i) => {
          gsap.fromTo(card,
            { y: 30, opacity: 0 },
            {
              y: 0, opacity: 1, duration: 0.6, delay: i * 0.1, ease: 'power2.out',
              scrollTrigger: { trigger: card, start: 'top 90%', toggleActions: 'play none none reverse' },
            }
          );
        });
      }

      if (ctaRef.current) {
        gsap.fromTo(ctaRef.current,
          { y: 20, opacity: 0 },
          {
            y: 0, opacity: 1, duration: 0.6, ease: 'power2.out',
            scrollTrigger: { trigger: ctaRef.current, start: 'top 90%', toggleActions: 'play none none reverse' },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="isolate"
      className="relative py-32 md:py-48 pl-6 md:pl-28 pr-6 md:pr-12 border-t border-border"
    >
      {/* NEW badge */}
      <div ref={badgeRef} className="mb-8">
        <span className="inline-block border border-green-500/30 bg-green-500/10 text-green-400 font-mono text-[10px] uppercase tracking-[0.3em] px-4 py-1.5">
          JUST RELEASED
        </span>
      </div>

      {/* Header */}
      <div ref={headerRef} className="mb-16 md:mb-24">
        <h2 className="font-bebas text-[clamp(3rem,8vw,7rem)] leading-[0.85] tracking-tight text-foreground">
          JCIL<br />ISOLATE
        </h2>
        <p className="mt-6 max-w-xl font-mono text-sm text-muted-foreground leading-relaxed">
          Your AI. Your device. Your privacy. JCIL Isolate is a desktop AI assistant that runs
          100% offline. No cloud, no tracking, no accounts. Just download and talk. Every conversation
          stays on your machine — permanently.
        </p>

        {/* Stats */}
        <div className="mt-10 flex flex-wrap gap-8 md:gap-12">
          <div>
            <span className="font-bebas text-4xl md:text-5xl text-green-400">0</span>
            <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
              Data Collected
            </span>
          </div>
          <div>
            <span className="font-bebas text-4xl md:text-5xl text-green-400">0</span>
            <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
              Cloud Servers
            </span>
          </div>
          <div>
            <span className="font-bebas text-4xl md:text-5xl text-green-400">0</span>
            <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
              Accounts Required
            </span>
          </div>
          <div>
            <span className="font-bebas text-4xl md:text-5xl text-accent">∞</span>
            <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
              Privacy
            </span>
          </div>
        </div>
      </div>

      {/* Feature cards */}
      <div ref={cardsRef} className="grid grid-cols-1 md:grid-cols-2 gap-[1px] bg-border mb-16 md:mb-24">
        {features.map((f) => (
          <article
            key={f.label}
            className="bg-background p-8 md:p-10 group hover:bg-accent/5 transition-colors duration-300"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-green-400">
              {f.label}
            </span>
            <h3 className="font-bebas text-2xl md:text-3xl mt-3 text-foreground">
              {f.title}
            </h3>
            <p className="mt-3 font-mono text-xs text-muted-foreground leading-relaxed max-w-sm">
              {f.description}
            </p>
          </article>
        ))}
      </div>

      {/* Download CTA */}
      <div ref={ctaRef}>
        <h3 className="font-bebas text-2xl md:text-3xl text-foreground mb-6">
          DOWNLOAD NOW — FREE
        </h3>

        <div className="flex flex-wrap items-center gap-4 md:gap-6">
          <a
            href={MAC_ARM_URL}
            className="group inline-flex items-center gap-3 border border-green-500/30 bg-green-500/10 px-6 py-3 font-mono text-xs uppercase tracking-widest text-green-400 hover:bg-green-500/20 hover:border-green-500/50 transition-all duration-200"
          >
            <ScrambleTextOnHover text="Mac (Apple Silicon)" as="span" duration={0.6} />
            <BitmapChevron className="transition-transform duration-[400ms] ease-in-out group-hover:rotate-45" />
          </a>

          <a
            href={MAC_INTEL_URL}
            className="group inline-flex items-center gap-3 border border-foreground/20 px-6 py-3 font-mono text-xs uppercase tracking-widest text-foreground hover:border-foreground/40 transition-all duration-200"
          >
            <ScrambleTextOnHover text="Mac (Intel)" as="span" duration={0.6} />
            <BitmapChevron className="transition-transform duration-[400ms] ease-in-out group-hover:rotate-45" />
          </a>

          <a
            href={WINDOWS_URL}
            className="group inline-flex items-center gap-3 border border-foreground/20 px-6 py-3 font-mono text-xs uppercase tracking-widest text-foreground hover:border-foreground/40 transition-all duration-200"
          >
            <ScrambleTextOnHover text="Windows" as="span" duration={0.6} />
            <BitmapChevron className="transition-transform duration-[400ms] ease-in-out group-hover:rotate-45" />
          </a>
        </div>

        <p className="mt-6 font-mono text-[10px] text-muted-foreground/60 max-w-lg">
          Mac users: If you see an &quot;unidentified developer&quot; warning, right-click the app and select Open.
          Requires macOS 13+ or Windows 10+. ~100MB download. 3GB disk space for the AI model.
        </p>
      </div>

      {/* Corner label */}
      <div className="absolute top-8 right-8 md:top-12 md:right-12">
        <div className="border border-green-500/20 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-green-400/60">
          v1.1.0
        </div>
      </div>
    </section>
  );
}
