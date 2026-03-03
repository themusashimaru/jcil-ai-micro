/**
 * CAPABILITIES SECTION
 *
 * Enterprise-grade feature highlights
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
        title="Enterprise-grade features"
        description="Built for serious work. Whether you're preparing a sermon or shipping production code, JCIL has the tools you need."
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <FeatureCard
          icon={<AgentIcon className="w-6 h-6" />}
          title="Agentic AI"
          description="Autonomous task execution with plan-execute-observe loops. The AI doesn't just respond, it acts."
          variant="outlined"
          color="purple"
        />
        <FeatureCard
          icon={<PlugIcon className="w-6 h-6" />}
          title="136+ Integrations"
          description="Connect to GitHub, Slack, Notion, Google Drive, and 130+ more apps through Composio."
          variant="outlined"
          color="blue"
        />
        <FeatureCard
          icon={<RefreshIcon className="w-6 h-6" />}
          title="Self-Correcting"
          description="Automatic error detection and retry with intelligent analysis. Broken builds get fixed automatically."
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
