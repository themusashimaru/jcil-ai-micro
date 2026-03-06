/**
 * CAPABILITIES SECTION
 *
 * Platform capabilities — orchestration, IDE, image gen, integrations
 */

import Section, { SectionHeader } from './Section';
import FeatureCard from './FeatureCard';
import { AgentIcon, PlugIcon, RefreshIcon, BrainIcon } from './Icons';

export default function CapabilitiesSection() {
  return (
    <Section id="capabilities" padding="lg" background="muted" className="border-y border-white/5">
      <SectionHeader
        badge="Capabilities"
        badgeColor="blue"
        title="Not a wrapper. A platform."
        description="Tools that chain together. Research flows into charts, charts flow into presentations, images flow into documents. One request, complete deliverables."
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <FeatureCard
          icon={<AgentIcon className="w-6 h-6" />}
          title="Tool Orchestration"
          description="Tools chain together automatically. Say 'create a deck about AI trends' and watch research, charts, images, and slides generate in sequence."
          variant="outlined"
          color="purple"
        />
        <FeatureCard
          icon={<PlugIcon className="w-6 h-6" />}
          title="67+ Integrations"
          description="Connect to GitHub, Slack, Notion, Google Drive, and 60+ more apps through Composio. Plus FLUX.2 AI image generation."
          variant="outlined"
          color="blue"
        />
        <FeatureCard
          icon={<RefreshIcon className="w-6 h-6" />}
          title="Full-Service IDE"
          description="Code Lab with real E2B sandboxed execution, pair programming, debugging, Git integration, and deployment — not a toy."
          variant="outlined"
          color="pink"
        />
        <FeatureCard
          icon={<BrainIcon className="w-6 h-6" />}
          title="Persistent Memory"
          description="Context that survives sessions. The AI remembers your codebase, preferences, and project history."
          variant="outlined"
          color="amber"
        />
      </div>
    </Section>
  );
}
