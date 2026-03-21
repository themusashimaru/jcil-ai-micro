'use client';

import { useRef, useState, useEffect, type ReactNode } from 'react';
import { cn } from './utils';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  SiInstagram,
  SiTiktok,
  SiFacebook,
  SiX,
  SiCanva,
  SiWordpress,
  SiStripe,
  SiPaypal,
  SiGoogle,
  SiBamboo,
  SiSalesforce,
  SiHubspot,
  SiSlack,
  SiDiscord,
  SiGithub,
  SiNotion,
  SiLinear,
  SiJira,
  SiShopify,
  SiZoom,
  SiDropbox,
  SiAsana,
  SiTwilio,
  SiMailchimp,
  SiYoutube,
  SiReddit,
  SiPinterest,
  SiTrello,
  SiAirtable,
  SiFigma,
  SiIntercom,
  SiZendesk,
  SiCalendly,
  SiVercel,
  SiGoogleanalytics,
  SiGoogledrive,
  SiGooglesheets,
  SiGmail,
  SiQuickbooks,
  SiClickup,
  SiMongodb,
  SiSupabase,
  SiGooglecalendar,
  SiGoogledocs,
  SiWhatsapp,
  SiTelegram,
  SiMedium,
  SiSpotify,
  SiGitlab,
  SiBitbucket,
} from 'react-icons/si';
import {
  TbTicket,
  TbBrandOnedrive,
  TbBrandGoogleMaps,
  TbBrandLinkedin,
  TbBrandTeams,
} from 'react-icons/tb';
import { FaMicrosoft } from 'react-icons/fa6';
gsap.registerPlugin(ScrollTrigger);

/* ─── Featured integration cards ─── */
interface Signal {
  date: string;
  title: string;
  note: string;
  icon: ReactNode;
  actions: number;
}

const signals: Signal[] = [
  {
    date: 'Social',
    title: 'Instagram',
    note: 'Post photos, reels, carousels. Manage DMs, comments, analytics.',
    icon: <SiInstagram />,
    actions: 25,
  },
  {
    date: 'Social',
    title: 'TikTok',
    note: 'Upload videos, post photos, publish content. Full creator toolkit.',
    icon: <SiTiktok />,
    actions: 18,
  },
  {
    date: 'Social',
    title: 'Facebook',
    note: 'Page posts with photos and videos. Albums, events, insights.',
    icon: <SiFacebook />,
    actions: 22,
  },
  {
    date: 'Social',
    title: 'Twitter/X',
    note: 'Tweet with media. Search, DMs, lists, spaces. 70+ actions.',
    icon: <SiX />,
    actions: 70,
  },
  {
    date: 'Design',
    title: 'Canva',
    note: 'Create designs, manage brand kits, export assets. 48 tools.',
    icon: <SiCanva />,
    actions: 48,
  },
  {
    date: 'CMS',
    title: 'WordPress',
    note: 'Publish posts, manage pages, upload media. Run your blog from chat.',
    icon: <SiWordpress />,
    actions: 35,
  },
  {
    date: 'Payments',
    title: 'Stripe',
    note: 'Process payments, manage subscriptions, handle invoices.',
    icon: <SiStripe />,
    actions: 51,
  },
  {
    date: 'Payments',
    title: 'PayPal',
    note: 'Invoices, orders, payouts, subscriptions. Church donations.',
    icon: <SiPaypal />,
    actions: 30,
  },
  {
    date: 'Events',
    title: 'Eventbrite',
    note: 'Create events, sell tickets, manage attendees and venues.',
    icon: <TbTicket />,
    actions: 14,
  },
  {
    date: 'Suite',
    title: 'Google',
    note: 'Drive, Docs, Sheets, Calendar, Gmail — full workspace access.',
    icon: <SiGoogle />,
    actions: 180,
  },
  {
    date: 'HR',
    title: 'BambooHR',
    note: 'Employees, time off, directory, onboarding. Full HR platform.',
    icon: <SiBamboo />,
    actions: 25,
  },
  {
    date: 'CRM',
    title: 'Salesforce',
    note: 'Enterprise CRM integration for sales and customer data.',
    icon: <SiSalesforce />,
    actions: 45,
  },
  {
    date: 'CRM',
    title: 'HubSpot',
    note: 'Contacts, deals, companies, tickets, email campaigns. Full CRM.',
    icon: <SiHubspot />,
    actions: 35,
  },
];

/* ─── Logo marquee data ─── */
interface MarqueeLogo {
  name: string;
  icon: ReactNode;
}

const marqueeLogos: MarqueeLogo[] = [
  { name: 'GitHub', icon: <SiGithub /> },
  { name: 'Slack', icon: <SiSlack /> },
  { name: 'Discord', icon: <SiDiscord /> },
  { name: 'Notion', icon: <SiNotion /> },
  { name: 'Linear', icon: <SiLinear /> },
  { name: 'Jira', icon: <SiJira /> },
  { name: 'Shopify', icon: <SiShopify /> },
  { name: 'Zoom', icon: <SiZoom /> },
  { name: 'Dropbox', icon: <SiDropbox /> },
  { name: 'Asana', icon: <SiAsana /> },
  { name: 'Twilio', icon: <SiTwilio /> },
  { name: 'Mailchimp', icon: <SiMailchimp /> },
  { name: 'YouTube', icon: <SiYoutube /> },
  { name: 'LinkedIn', icon: <TbBrandLinkedin /> },
  { name: 'Reddit', icon: <SiReddit /> },
  { name: 'Pinterest', icon: <SiPinterest /> },
  { name: 'Trello', icon: <SiTrello /> },
  { name: 'Airtable', icon: <SiAirtable /> },
  { name: 'Figma', icon: <SiFigma /> },
  { name: 'Intercom', icon: <SiIntercom /> },
  { name: 'Zendesk', icon: <SiZendesk /> },
  { name: 'Calendly', icon: <SiCalendly /> },
  { name: 'Vercel', icon: <SiVercel /> },
  { name: 'Google Analytics', icon: <SiGoogleanalytics /> },
  { name: 'Google Drive', icon: <SiGoogledrive /> },
  { name: 'Google Sheets', icon: <SiGooglesheets /> },
  { name: 'Gmail', icon: <SiGmail /> },
  { name: 'MS Teams', icon: <TbBrandTeams /> },
  { name: 'Outlook', icon: <FaMicrosoft /> },
  { name: 'QuickBooks', icon: <SiQuickbooks /> },
  { name: 'ClickUp', icon: <SiClickup /> },
  { name: 'Instagram', icon: <SiInstagram /> },
  { name: 'TikTok', icon: <SiTiktok /> },
  { name: 'Facebook', icon: <SiFacebook /> },
  { name: 'Twitter/X', icon: <SiX /> },
  { name: 'Canva', icon: <SiCanva /> },
  { name: 'Stripe', icon: <SiStripe /> },
  { name: 'PayPal', icon: <SiPaypal /> },
  { name: 'Salesforce', icon: <SiSalesforce /> },
  { name: 'HubSpot', icon: <SiHubspot /> },
  { name: 'MongoDB', icon: <SiMongodb /> },
  { name: 'Supabase', icon: <SiSupabase /> },
  { name: 'Google Calendar', icon: <SiGooglecalendar /> },
  { name: 'Google Docs', icon: <SiGoogledocs /> },
  { name: 'WordPress', icon: <SiWordpress /> },
  { name: 'WhatsApp', icon: <SiWhatsapp /> },
  { name: 'Telegram', icon: <SiTelegram /> },
  { name: 'Medium', icon: <SiMedium /> },
  { name: 'Spotify', icon: <SiSpotify /> },
  { name: 'GitLab', icon: <SiGitlab /> },
  { name: 'Bitbucket', icon: <SiBitbucket /> },
  { name: 'OneDrive', icon: <TbBrandOnedrive /> },
  { name: 'Google Maps', icon: <TbBrandGoogleMaps /> },
  { name: 'BambooHR', icon: <SiBamboo /> },
  { name: 'Eventbrite', icon: <TbTicket /> },
];

export function SignalsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    if (!sectionRef.current || !cursorRef.current) return;

    const section = sectionRef.current;
    const cursor = cursorRef.current;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = section.getBoundingClientRect();
      gsap.to(cursor, {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        duration: 0.5,
        ease: 'power3.out',
      });
    };

    const handleMouseEnter = () => setIsHovering(true);
    const handleMouseLeave = () => setIsHovering(false);

    section.addEventListener('mousemove', handleMouseMove);
    section.addEventListener('mouseenter', handleMouseEnter);
    section.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      section.removeEventListener('mousemove', handleMouseMove);
      section.removeEventListener('mouseenter', handleMouseEnter);
      section.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  useEffect(() => {
    if (!sectionRef.current || !headerRef.current || !cardsRef.current) return;

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
            start: 'top 85%',
            toggleActions: 'play none none reverse',
          },
        }
      );

      const cards = cardsRef.current?.querySelectorAll('article');
      if (cards) {
        gsap.fromTo(
          cards,
          { x: -100, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 0.8,
            stagger: 0.2,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: cardsRef.current,
              start: 'top 90%',
              toggleActions: 'play none none reverse',
            },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="signals" ref={sectionRef} className="relative py-32 pl-6 md:pl-28">
      <div
        ref={cursorRef}
        className={cn(
          'pointer-events-none absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 z-50',
          'w-12 h-12 rounded-full border-2 border-accent bg-accent',
          'transition-opacity duration-300',
          isHovering ? 'opacity-100' : 'opacity-0'
        )}
      />

      <div ref={headerRef} className="mb-8 pr-6 md:pr-12">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">
          01 / Integrations
        </span>
        <h2 className="mt-4 font-bebas text-5xl md:text-7xl tracking-tight">
          2,500+ ACTIONS. 88 PLATFORMS.
        </h2>
        <p className="mt-4 max-w-xl font-mono text-sm text-muted-foreground leading-relaxed">
          Powered by Composio (SOC 2 certified). Post to Instagram, TikTok, Facebook. Design in
          Canva. Manage invoices in PayPal. Sell on Shopify. Run HR in BambooHR. All from one chat.
        </p>
      </div>

      {/* Scrolling logo marquee */}
      <LogoMarquee />

      {/* Featured integration cards */}
      <div
        ref={cardsRef}
        className="flex gap-8 overflow-x-auto pb-8 pr-12 mt-12 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {signals.map((signal, index) => (
          <SignalCard key={index} signal={signal} index={index} />
        ))}
      </div>
    </section>
  );
}

/* ─── Infinite-scroll logo marquee ─── */
function LogoMarquee() {
  return (
    <div className="relative overflow-hidden pr-6 md:pr-12">
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-background to-transparent z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background to-transparent z-10" />

      {/* Row 1 — scrolls left */}
      <div className="flex animate-marquee-left mb-3">
        <MarqueeRow logos={marqueeLogos.slice(0, 27)} />
        <MarqueeRow logos={marqueeLogos.slice(0, 27)} aria-hidden />
      </div>

      {/* Row 2 — scrolls right */}
      <div className="flex animate-marquee-right">
        <MarqueeRow logos={marqueeLogos.slice(27)} />
        <MarqueeRow logos={marqueeLogos.slice(27)} aria-hidden />
      </div>
    </div>
  );
}

function MarqueeRow({ logos, ...props }: { logos: MarqueeLogo[] } & Record<string, unknown>) {
  return (
    <div className="flex shrink-0 gap-3" {...props}>
      {logos.map((logo, i) => (
        <div
          key={i}
          className="group flex items-center gap-2 border border-border/30 px-4 py-2 hover:border-accent/50 hover:bg-accent/5 transition-all duration-300"
        >
          <span className="text-base text-muted-foreground group-hover:text-accent transition-colors duration-300">
            {logo.icon}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground group-hover:text-foreground whitespace-nowrap transition-colors duration-300">
            {logo.name}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Signal card with action badge ─── */
function SignalCard({ signal, index }: { signal: Signal; index: number }) {
  return (
    <article
      className={cn(
        'group relative flex-shrink-0 w-80',
        'transition-transform duration-500 ease-out',
        'hover:-translate-y-2'
      )}
    >
      <div className="relative bg-card border border-border/50 md:border-t md:border-l md:border-r-0 md:border-b-0 p-8">
        <div className="absolute -top-px left-0 right-0 h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />
        <div className="flex items-baseline justify-between mb-8">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            No. {String(index + 1).padStart(2, '0')}
          </span>
          <time className="font-mono text-[10px] text-muted-foreground/60">{signal.date}</time>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl text-accent/80 group-hover:text-accent transition-colors duration-300">
            {signal.icon}
          </span>
          <h3 className="font-bebas text-4xl tracking-tight group-hover:text-accent transition-colors duration-300">
            {signal.title}
          </h3>
          {/* Action count badge */}
          <span className="ml-auto font-mono text-[10px] text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-sm">
            {signal.actions} actions
          </span>
        </div>
        <div className="w-12 h-px bg-accent/60 mb-6 group-hover:w-full transition-all duration-500" />
        <p className="font-mono text-xs text-muted-foreground leading-relaxed">{signal.note}</p>
        <div className="absolute bottom-0 right-0 w-6 h-6 overflow-hidden">
          <div className="absolute bottom-0 right-0 w-8 h-8 bg-background rotate-45 translate-x-4 translate-y-4 border-t border-l border-border/30" />
        </div>
      </div>
      <div className="absolute inset-0 -z-10 translate-x-1 translate-y-1 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </article>
  );
}
