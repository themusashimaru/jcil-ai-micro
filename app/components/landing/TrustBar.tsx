/**
 * TRUST BAR
 *
 * A single clean row of verified platform metrics.
 * Builds confidence without overwhelming.
 */

export default function TrustBar() {
  return (
    <section className="border-y border-white/5 bg-white/[0.01] py-12">
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <TrustMetric value="51" label="Real AI Tools" />
          <TrustMetric value="100%" label="TypeScript" />
          <TrustMetric value="5" label="AI Models" />
          <TrustMetric value="E2B" label="Sandboxed Execution" />
        </div>
      </div>
    </section>
  );
}

function TrustMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </div>
  );
}
