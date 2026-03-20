'use client';

import { useRef, useEffect, useState, type ReactNode } from 'react';
import { cn } from './utils';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SiGmail, SiStripe, SiSlack, SiGooglecalendar } from 'react-icons/si';
import { TbWorldSearch } from 'react-icons/tb';

gsap.registerPlugin(ScrollTrigger);

interface TimelineEvent {
  time: string;
  icon: ReactNode;
  platform: string;
  action: string;
  detail: string;
}

const timeline: TimelineEvent[] = [
  {
    time: '7:00 AM',
    icon: <SiGmail />,
    platform: 'Gmail + Calendar',
    action: 'Morning Briefing',
    detail:
      "Reads all overnight emails, checks your calendar for the day, and writes you a morning briefing — what's urgent, what's scheduled, and what needs your attention first.",
  },
  {
    time: '9:00 AM',
    icon: <SiStripe />,
    platform: 'Stripe + Gmail',
    action: 'Daily Revenue Report',
    detail:
      "Pulls yesterday's revenue, new subscriptions, and churn from Stripe. Writes a clean summary and emails it to your team before standup.",
  },
  {
    time: '12:00 PM',
    icon: <SiGooglecalendar />,
    platform: 'JCIL AI + Gmail',
    action: 'Blog Post Draft',
    detail:
      'Researches a trending topic in your industry, writes a draft blog post, and sends it to your inbox for review. Every day, on autopilot.',
  },
  {
    time: '3:00 PM',
    icon: <SiSlack />,
    platform: 'Slack + GitHub',
    action: 'Team Progress Update',
    detail:
      "Scans today's GitHub commits and open PRs, summarizes what shipped, and posts a progress update to your Slack #team channel.",
  },
  {
    time: 'Friday',
    icon: <TbWorldSearch />,
    platform: 'Research + Gmail',
    action: 'Weekly Stock Research',
    detail:
      'Conducts deep research on your watchlist stocks, analyzes market trends, and sends you a detailed weekly report with key insights.',
  },
];

const capabilities = [
  {
    title: 'Chain Everything',
    description:
      'Read emails, check your calendar, research a topic, and send the results — all in one task. Your apps work together.',
  },
  {
    title: 'Plain English',
    description:
      'No code. No config. Just tell JCIL what you want and when. It figures out which connectors to use.',
  },
  {
    title: 'Real AI Work',
    description:
      'Not just reminders. JCIL researches, writes, analyzes, and delivers — then sends the results wherever you need them.',
  },
];

export function AutomationSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const capsRef = useRef<HTMLDivElement>(null);
  const [activeEvent, setActiveEvent] = useState(0);

  // Cycle through timeline events
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveEvent((prev) => (prev + 1) % timeline.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!sectionRef.current || !headerRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        headerRef.current,
        { x: -60, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: headerRef.current,
            start: 'top 90%',
            toggleActions: 'play none none reverse',
          },
        }
      );

      if (timelineRef.current) {
        const items = timelineRef.current.querySelectorAll('[data-timeline-item]');
        gsap.fromTo(
          items,
          { x: -40, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 0.6,
            stagger: 0.12,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: timelineRef.current,
              start: 'top 85%',
              toggleActions: 'play none none reverse',
            },
          }
        );
      }

      if (capsRef.current) {
        const cards = capsRef.current.querySelectorAll('[data-cap-card]');
        gsap.fromTo(
          cards,
          { y: 40, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.7,
            stagger: 0.15,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: capsRef.current,
              start: 'top 85%',
              toggleActions: 'play none none reverse',
            },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="automation"
      className="relative py-32 pl-6 md:pl-28 pr-6 md:pr-12"
    >
      {/* Header */}
      <div ref={headerRef} className="mb-16 flex items-end justify-between">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">
            03 / Automation
          </span>
          <h2 className="mt-4 font-bebas text-5xl md:text-7xl tracking-tight">
            YOUR AI WORKS WHILE YOU DON&apos;T
          </h2>
        </div>
        <p className="hidden md:block max-w-xs font-mono text-xs text-muted-foreground text-right leading-relaxed">
          Schedule tasks in plain English. JCIL connects to your apps and runs them on autopilot.
        </p>
      </div>

      {/* Two-column layout: Timeline + Capability cards */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16">
        {/* Timeline — left column (3/5) */}
        <div className="lg:col-span-3" ref={timelineRef}>
          <div className="relative">
            {/* Vertical line */}
            <div
              className="absolute left-[18px] top-2 bottom-2 w-px bg-border/40"
              aria-hidden="true"
            />

            <div className="space-y-1">
              {timeline.map((event, index) => (
                <button
                  key={index}
                  data-timeline-item
                  onClick={() => setActiveEvent(index)}
                  className={cn(
                    'relative flex items-start gap-5 w-full text-left px-4 py-4 rounded-lg transition-all duration-500',
                    activeEvent === index
                      ? 'bg-accent/5 border border-accent/20'
                      : 'border border-transparent hover:bg-white/[0.02]'
                  )}
                >
                  {/* Dot */}
                  <div className="relative flex-shrink-0 mt-1">
                    <div
                      className={cn(
                        'w-[9px] h-[9px] rounded-full transition-all duration-500',
                        activeEvent === index
                          ? 'bg-accent scale-125 shadow-[0_0_8px_rgba(var(--accent-rgb,249,115,22),0.4)]'
                          : 'bg-muted-foreground/30'
                      )}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {event.time}
                      </span>
                      <span className="text-sm text-accent/70">{event.icon}</span>
                      <span
                        className={cn(
                          'font-mono text-[10px] uppercase tracking-widest transition-colors duration-300',
                          activeEvent === index ? 'text-accent' : 'text-muted-foreground/60'
                        )}
                      >
                        {event.platform}
                      </span>
                    </div>
                    <h4
                      className={cn(
                        'font-bebas text-xl md:text-2xl tracking-tight transition-colors duration-300',
                        activeEvent === index ? 'text-foreground' : 'text-foreground/60'
                      )}
                    >
                      {event.action}
                    </h4>
                    <p
                      className={cn(
                        'font-mono text-xs leading-relaxed mt-1 transition-all duration-500 overflow-hidden',
                        activeEvent === index
                          ? 'text-muted-foreground max-h-20 opacity-100'
                          : 'max-h-0 opacity-0'
                      )}
                    >
                      {event.detail}
                    </p>
                  </div>

                  {/* Active indicator bar */}
                  {activeEvent === index && (
                    <div className="absolute top-0 left-0 w-[2px] h-full bg-accent rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Capability cards — right column (2/5) */}
        <div className="lg:col-span-2 flex flex-col gap-4" ref={capsRef}>
          <div className="mb-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              How it works
            </span>
          </div>

          {capabilities.map((cap, index) => (
            <div
              key={index}
              data-cap-card
              className="group relative border border-border/40 p-6 transition-all duration-500 hover:border-accent/40"
            >
              <div
                className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                aria-hidden="true"
              />
              <div className="relative z-10">
                <span className="font-mono text-[10px] text-muted-foreground/40">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h4 className="mt-2 font-bebas text-xl md:text-2xl tracking-tight group-hover:text-accent transition-colors duration-300">
                  {cap.title}
                </h4>
                <p className="mt-2 font-mono text-xs text-muted-foreground leading-relaxed">
                  {cap.description}
                </p>
              </div>
            </div>
          ))}

          <a
            href="/chat"
            className="mt-4 inline-flex items-center gap-3 border border-accent bg-accent/10 px-6 py-3 font-mono text-xs uppercase tracking-widest text-accent hover:bg-accent/20 transition-all duration-200 w-fit"
          >
            Try it free &rarr;
          </a>
        </div>
      </div>
    </section>
  );
}
