/**
 * SECURITY SECTION COMPONENT
 *
 * Enterprise security features - all claims verified
 */

import Section, { SectionHeader } from './Section';
import FeatureCard from './FeatureCard';
import { GlobeIcon, LockIcon, ShieldIcon, DocumentIcon } from './Icons';

export default function SecuritySection() {
  return (
    <Section padding="lg">
      <SectionHeader
        badge="Enterprise Security"
        badgeColor="green"
        title="Your data, protected"
        description="Ministry data deserves the highest protection. Built with enterprise security from day one."
      />

      <div className="flex flex-wrap justify-center gap-3 mb-12">
        {[
          'AES-256 Encryption',
          'US Data Centers',
          'No Training on Your Data',
          'Powered by Claude',
        ].map((badge, i) => {
          const colors = [
            'bg-green-500/10 border-green-500/30 text-green-300',
            'bg-blue-500/10 border-blue-500/30 text-blue-300',
            'bg-purple-500/10 border-purple-500/30 text-purple-300',
            'bg-amber-500/10 border-amber-500/30 text-amber-300',
          ];
          return (
            <span
              key={badge}
              className={`px-4 py-2 rounded-full border text-sm font-medium ${colors[i]}`}
            >
              {badge}
            </span>
          );
        })}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <FeatureCard
          icon={<GlobeIcon className="w-6 h-6" />}
          title="US Data Centers"
          description="All data stored on American servers. No foreign data transfer."
          variant="outlined"
          color="blue"
        />
        <FeatureCard
          icon={<LockIcon className="w-6 h-6" />}
          title="E2E Encryption"
          description="AES-256 encryption at rest. TLS 1.3 in transit. Zero-access architecture."
          variant="outlined"
          color="green"
        />
        <FeatureCard
          icon={<ShieldIcon className="w-6 h-6" />}
          title="AI Safety"
          description="Anthropic's Constitutional AI with industry-leading safety measures."
          variant="outlined"
          color="purple"
        />
        <FeatureCard
          icon={<DocumentIcon className="w-6 h-6" />}
          title="Full Audit Trail"
          description="Complete logging with correlation IDs. Data export available on request."
          variant="outlined"
          color="amber"
        />
      </div>
    </Section>
  );
}
