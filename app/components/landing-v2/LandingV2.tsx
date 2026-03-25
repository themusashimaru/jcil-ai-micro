'use client';

import { HeroSection } from './HeroSection';
import { SignalsSection } from './SignalsSection';
import { WorkSection } from './WorkSection';
import { AutomationSection } from './AutomationSection';
import { PrinciplesSection } from './PrinciplesSection';
import { IsolateSection } from './IsolateSection';
import { ColophonSection } from './ColophonSection';
import { TopNav } from './TopNav';
import { SideNav } from './SideNav';
import { SmoothScroll } from './SmoothScroll';

export function LandingV2() {
  return (
    <SmoothScroll>
      <main className="relative min-h-screen">
        <TopNav />
        <SideNav />
        <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />

        <div className="relative z-10">
          <HeroSection />
          <SignalsSection />
          <WorkSection />
          <AutomationSection />
          <IsolateSection />
          <PrinciplesSection />
          <ColophonSection />
        </div>
      </main>
    </SmoothScroll>
  );
}
