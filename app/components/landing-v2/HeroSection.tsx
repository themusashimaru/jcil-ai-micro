'use client';

import { useEffect, useRef } from 'react';
import { ScrambleTextOnHover } from './ScrambleText';
import { SplitFlapText, SplitFlapMuteToggle, SplitFlapAudioProvider } from './SplitFlapText';
import { AnimatedNoise } from './AnimatedNoise';
import { BitmapChevron } from './BitmapChevron';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current || !contentRef.current) return;

    const ctx = gsap.context(() => {
      gsap.to(contentRef.current, {
        y: -100,
        opacity: 0,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: 1,
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative min-h-screen flex items-center pt-16 pl-6 md:pl-28 pr-6 md:pr-12"
    >
      <AnimatedNoise opacity={0.03} />

      {/* Left vertical labels */}
      <div className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground -rotate-90 origin-left block whitespace-nowrap">
          FAITH FIRST
        </span>
      </div>

      {/* Main content */}
      <div ref={contentRef} className="flex-1 w-full">
        <SplitFlapAudioProvider>
          <div className="relative">
            <SplitFlapText text="JCIL.AI" speed={80} />
            <div className="mt-4">
              <SplitFlapMuteToggle />
            </div>
          </div>
        </SplitFlapAudioProvider>

        <h2 className="font-bebas text-muted-foreground/60 text-[clamp(1rem,3vw,2rem)] mt-4 tracking-wide">
          Zero Compromise. Faith First.
        </h2>

        <p className="mt-12 max-w-lg font-mono text-sm text-muted-foreground leading-relaxed">
          2,500+ automated actions across 88 platforms. Builds new tools on the fly. Browses the web
          live. Posts to Instagram, TikTok, Facebook, Twitter. Manages your invoices, HR, events,
          and e-commerce. Powered by Opus 4.6. Grounded in Scripture.
        </p>

        {/* Stats row */}
        <div className="mt-10 flex flex-wrap gap-8 md:gap-12">
          <div>
            <span className="font-bebas text-4xl md:text-5xl text-accent">91+</span>
            <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
              AI Tools
            </span>
          </div>
          <div>
            <span className="font-bebas text-4xl md:text-5xl text-accent">&infin;</span>
            <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
              Self-Building
            </span>
          </div>
          <div>
            <span className="font-bebas text-4xl md:text-5xl text-accent">2,500+</span>
            <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
              Actions
            </span>
          </div>
          <div>
            <span className="font-bebas text-4xl md:text-5xl text-accent">88</span>
            <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
              Integrations
            </span>
          </div>
          <div>
            <span className="font-bebas text-4xl md:text-5xl text-accent">5</span>
            <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
              LLM Providers
            </span>
          </div>
        </div>

        <div className="mt-16 flex flex-wrap items-center gap-6 md:gap-8">
          <a
            href="/chat"
            className="group inline-flex items-center gap-3 border border-foreground/20 px-6 py-3 font-mono text-xs uppercase tracking-widest text-foreground hover:border-accent hover:text-accent transition-all duration-200 bg-accent/10 hover:bg-accent/20"
          >
            <ScrambleTextOnHover text="Start Free" as="span" duration={0.6} />
            <BitmapChevron className="transition-transform duration-[400ms] ease-in-out group-hover:rotate-45" />
          </a>
          <a
            href="/code-lab"
            className="group inline-flex items-center gap-3 border border-foreground/20 px-6 py-3 font-mono text-xs uppercase tracking-widest text-foreground hover:border-foreground/40 transition-all duration-200"
          >
            <ScrambleTextOnHover text="Explore Code Lab" as="span" duration={0.6} />
            <BitmapChevron className="transition-transform duration-[400ms] ease-in-out group-hover:rotate-45" />
          </a>
        </div>
      </div>

      {/* Floating info tag */}
      <div className="absolute bottom-8 right-8 md:bottom-12 md:right-12">
        <div className="border border-border px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Powered by Anthropic
        </div>
      </div>
    </section>
  );
}
