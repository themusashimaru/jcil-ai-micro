/**
 * TRUST BAR — Key metrics in a clean horizontal strip.
 */

export default function TrustBar() {
  return (
    <section className="relative border-y border-white/[0.06] bg-zinc-950/50">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
          <Metric value="91" label="Real AI Tools" />
          <Metric value="5" label="LLM Providers" />
          <Metric value="67+" label="Integrations" />
          <Metric value="FLUX.2" label="Image Gen" />
          <Metric value="E2B" label="Sandboxed" />
        </div>
      </div>
    </section>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold tracking-tight text-white">{value}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</div>
    </div>
  );
}
