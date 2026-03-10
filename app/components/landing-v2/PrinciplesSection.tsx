"use client";

import { useRef, useEffect } from "react";
import { HighlightText } from "./HighlightText";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const principles = [
  {
    number: "01",
    titleParts: [
      { text: "BEREAN", highlight: true },
      { text: " BY DESIGN", highlight: false },
    ],
    description: "Like the Bereans in Acts 17:11, we test everything against Scripture. Our AI is grounded in Biblical truth — not cultural trends, not political winds, not popular opinion.",
    align: "left" as const,
  },
  {
    number: "02",
    titleParts: [
      { text: "SAFE", highlight: true },
      { text: " FOR YOUR FAMILY", highlight: false },
    ],
    description: "Zero tolerance for profanity, blasphemy, and explicit content. Built so you can hand it to your teenager, your small group, or your church staff.",
    align: "right" as const,
  },
  {
    number: "03",
    titleParts: [
      { text: "ENTERPRISE ", highlight: false },
      { text: "SECURITY", highlight: true },
    ],
    description: "API keys encrypted at rest with AES-256. Row-level security. 6-month hard deletion. Redis rate limiting. CSRF protection. Full audit trails.",
    align: "left" as const,
  },
  {
    number: "04",
    titleParts: [
      { text: "YOUR DATA, ", highlight: false },
      { text: "PROTECTED", highlight: true },
    ],
    description: "Your data is never used for training. End-to-end encryption. Full data export and deletion on request. We exist to serve you, not exploit you.",
    align: "right" as const,
  },
];

export function PrinciplesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const principlesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current || !headerRef.current || !principlesRef.current) return;

    const ctx = gsap.context(() => {
      gsap.from(headerRef.current, {
        x: -60, opacity: 0, duration: 1, ease: "power3.out",
        scrollTrigger: { trigger: headerRef.current, start: "top 85%", toggleActions: "play none none reverse" },
      });

      const articles = principlesRef.current?.querySelectorAll("article");
      articles?.forEach((article, index) => {
        const isRight = principles[index].align === "right";
        gsap.from(article, {
          x: isRight ? 80 : -80, opacity: 0, duration: 1, ease: "power3.out",
          scrollTrigger: { trigger: article, start: "top 85%", toggleActions: "play none none reverse" },
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="principles" className="relative py-32 pl-6 md:pl-28 pr-6 md:pr-12">
      <div ref={headerRef} className="mb-24">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">03 / Foundation</span>
        <h2 className="mt-4 font-bebas text-5xl md:text-7xl tracking-tight">WHY JCIL EXISTS</h2>
        <p className="mt-6 max-w-2xl font-mono text-sm text-muted-foreground leading-relaxed">
          Every AI platform reflects the values of whoever built it. We chose to build one that reflects ours — and yours.
          <span className="block mt-4 text-foreground/80 italic">&ldquo;Whatever you do, work at it with all your heart, as working for the Lord.&rdquo; — Colossians 3:23</span>
        </p>
      </div>

      <div ref={principlesRef} className="space-y-24 md:space-y-32">
        {principles.map((principle, index) => (
          <article
            key={index}
            className={`flex flex-col ${principle.align === "right" ? "items-end text-right" : "items-start text-left"}`}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-4">
              {principle.number} / {principle.titleParts[0].text.split(" ")[0]}
            </span>

            <h3 className="font-bebas text-4xl md:text-6xl lg:text-8xl tracking-tight leading-none">
              {principle.titleParts.map((part, i) =>
                part.highlight ? (
                  <HighlightText key={i} parallaxSpeed={0.6}>{part.text}</HighlightText>
                ) : (
                  <span key={i}>{part.text}</span>
                )
              )}
            </h3>

            <p className="mt-6 max-w-md font-mono text-sm text-muted-foreground leading-relaxed">
              {principle.description}
            </p>

            <div className={`mt-8 h-[1px] bg-border w-24 md:w-48 ${principle.align === "right" ? "mr-0" : "ml-0"}`} />
          </article>
        ))}
      </div>
    </section>
  );
}
