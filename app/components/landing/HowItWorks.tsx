/**
 * HOW IT WORKS
 *
 * Clean 3-step workflow. Minimal, professional.
 */

export default function HowItWorks() {
  return (
    <section className="bg-black py-24 lg:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            How it works
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            From idea to impact in three steps.
          </p>
        </div>

        <div className="grid gap-12 md:grid-cols-3 md:gap-8">
          <Step
            number="01"
            title="Describe"
            description="Tell the AI what you need in plain English. Sermon prep, code projects, research — anything."
          />
          <Step
            number="02"
            title="Execute"
            description="The agent plans, writes code, runs tests, and fixes errors automatically in a secure sandbox."
          />
          <Step
            number="03"
            title="Deploy"
            description="Get working code pushed to GitHub, documents ready to share, or research compiled and cited."
          />
        </div>
      </div>
    </section>
  );
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="text-center md:text-left">
      <div className="mb-4 text-sm font-medium text-amber-400/70">{number}</div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 leading-relaxed text-slate-400">{description}</p>
    </div>
  );
}
