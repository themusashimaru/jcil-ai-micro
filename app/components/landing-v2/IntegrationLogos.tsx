"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

const integrations = [
  { name: "Gmail", color: "#EA4335" },
  { name: "Google Sheets", color: "#34A853" },
  { name: "Google Drive", color: "#4285F4" },
  { name: "Google Calendar", color: "#4285F4" },
  { name: "Slack", color: "#4A154B" },
  { name: "GitHub", color: "#181717" },
  { name: "Notion", color: "#000000" },
  { name: "Stripe", color: "#635BFF" },
  { name: "Salesforce", color: "#00A1E0" },
  { name: "HubSpot", color: "#FF7A59" },
  { name: "Jira", color: "#0052CC" },
  { name: "Asana", color: "#F06A6A" },
  { name: "Trello", color: "#0079BF" },
  { name: "Discord", color: "#5865F2" },
  { name: "Zoom", color: "#2D8CFF" },
  { name: "Microsoft Teams", color: "#6264A7" },
];

const integrationsRow2 = [
  { name: "Airtable", color: "#18BFFF" },
  { name: "Dropbox", color: "#0061FF" },
  { name: "OneDrive", color: "#0078D4" },
  { name: "Box", color: "#0061D5" },
  { name: "Figma", color: "#F24E1E" },
  { name: "Linear", color: "#5E6AD2" },
  { name: "Intercom", color: "#1F8DED" },
  { name: "Zendesk", color: "#03363D" },
  { name: "Mailchimp", color: "#FFE01B" },
  { name: "SendGrid", color: "#1A82E2" },
  { name: "Twilio", color: "#F22F46" },
  { name: "AWS", color: "#FF9900" },
  { name: "Vercel", color: "#000000" },
  { name: "Supabase", color: "#3ECF8E" },
  { name: "MongoDB", color: "#47A248" },
  { name: "PostgreSQL", color: "#4169E1" },
];

function IntegrationLogo({ name, color }: { name: string; color: string }) {
  return (
    <div
      className="w-6 h-6 rounded-sm flex items-center justify-center text-[9px] font-bold text-white"
      style={{ backgroundColor: color }}
    >
      {name.charAt(0)}
    </div>
  );
}

export function IntegrationLogosCarousel() {
  const row1Ref = useRef<HTMLDivElement>(null);
  const row2Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!row1Ref.current || !row2Ref.current) return;

    gsap.to(row1Ref.current, {
      xPercent: -50,
      duration: 40,
      ease: "none",
      repeat: -1,
    });

    gsap.fromTo(
      row2Ref.current,
      { xPercent: -50 },
      {
        xPercent: 0,
        duration: 45,
        ease: "none",
        repeat: -1,
      }
    );
  }, []);

  return (
    <div className="w-full overflow-hidden py-8 space-y-6">
      <div className="flex items-center justify-center gap-2 mb-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Powered by Composio
        </span>
        <span className="text-accent">&bull;</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">
          67+ Integrations
        </span>
        <span className="text-accent">&bull;</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          SOC 2 Compliant
        </span>
      </div>

      {/* Row 1 */}
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-background to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-background to-transparent z-10" />
        <div ref={row1Ref} className="flex gap-8 w-fit">
          {[...integrations, ...integrations].map((integration, index) => (
            <div
              key={`row1-${index}`}
              className="group flex items-center gap-3 px-5 py-3 border border-border/30 hover:border-accent/50 transition-all duration-300 bg-card/50 backdrop-blur-sm flex-shrink-0"
            >
              <div className="w-6 h-6 flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                <IntegrationLogo name={integration.name} color={integration.color} />
              </div>
              <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap">
                {integration.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Row 2 */}
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-background to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-background to-transparent z-10" />
        <div ref={row2Ref} className="flex gap-8 w-fit">
          {[...integrationsRow2, ...integrationsRow2].map((integration, index) => (
            <div
              key={`row2-${index}`}
              className="group flex items-center gap-3 px-5 py-3 border border-border/30 hover:border-accent/50 transition-all duration-300 bg-card/50 backdrop-blur-sm flex-shrink-0"
            >
              <div className="w-6 h-6 flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                <IntegrationLogo name={integration.name} color={integration.color} />
              </div>
              <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap">
                {integration.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
