/**
 * TRUST BAR
 *
 * Key differentiators at a glance — what sets JCIL apart from competition.
 */

export default function TrustBar() {
  return (
    <section className="border-y border-white/5 bg-white/[0.01] py-14">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-2 gap-y-8 gap-x-4 sm:grid-cols-3 lg:grid-cols-6">
          <TrustMetric value="51" label="Real AI Tools" />
          <TrustMetric value="6" label="AI Agents" />
          <TrustMetric value="5" label="LLM Providers" />
          <TrustMetric value="67+" label="App Integrations" />
          <TrustMetric value="FLUX.2" label="Image Generation" />
          <TrustMetric value="E2B" label="Sandboxed Execution" />
        </div>
      </div>
    </section>
  );
}

function TrustMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-xl font-semibold text-white sm:text-2xl">{value}</div>
      <div className="mt-1 text-xs text-slate-500 sm:text-sm">{label}</div>
    </div>
  );
}
