/**
 * VALUES & TRUST SECTION
 *
 * Communicates JCIL's faith-based values, safety commitment,
 * and why this platform exists. Professional and clear.
 * Composio-inspired unified glass card design.
 */

import Section, { SectionHeader } from './Section';

export default function ValuesSection() {
  return (
    <Section id="values">
      <SectionHeader
        badge="Our Foundation"
        title="Why JCIL exists"
        description="Every AI platform reflects the values of whoever built it. We chose to build one that reflects ours — and yours."
      />

      <div className="max-w-5xl mx-auto">
        {/* Main values grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-12">
          <ValueCard
            icon={<BookIcon />}
            title="Berean by Design"
            description="Like the Bereans in Acts 17:11, we test everything against Scripture. Our AI is grounded in Biblical truth — not cultural trends, not political winds, not popular opinion. We go back to the Word."
          />
          <ValueCard
            icon={<ShieldIcon />}
            title="Safe for Your Family"
            description="Zero tolerance for profanity, blasphemy, and explicit content. JCIL is built so you can hand it to your teenager, your small group, or your church staff without worry."
          />
          <ValueCard
            icon={<ScaleIcon />}
            title="Constitutionally Grounded"
            description="We hold conservative, constitutional values. But we don't follow leaders blindly — we weigh everything against Scripture first. If it doesn't align with the Word, we don't endorse it."
          />
          <ValueCard
            icon={<HeartIcon />}
            title="Compassion, Not Judgment"
            description="We value human life. We're sympathetic, professional, and welcoming. JCIL isn't here to bash or judge — it's here to serve. Everyone deserves a safe space to ask questions and grow."
          />
          <ValueCard
            icon={<LockIcon />}
            title="Your Data, Protected"
            description="API keys encrypted at rest with AES-256. Row-level security on every database query. 6-month hard deletion. Redis rate limiting. CSRF protection. Full audit trails. Enterprise-grade, not afterthought."
          />
          <ValueCard
            icon={<TransparencyIcon />}
            title="Transparent AI"
            description="We proudly disclose how JCIL works. Powered by Claude Sonnet 4.6 by Anthropic — chosen for its industry-leading safety standards. BYOK lets you use any provider. No black boxes."
          />
        </div>

        {/* Why not the others? */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 lg:p-10">
          <h3 className="text-xl font-semibold text-white mb-3">
            &ldquo;Why not just use ChatGPT or Claude directly?&rdquo;
          </h3>
          <p className="text-zinc-400 leading-relaxed mb-6">
            Because none of them were built for you. They don&apos;t align with Christian conservative moral
            values. They don&apos;t filter content through a Biblical lens. They don&apos;t remember your
            preferences across sessions. They don&apos;t give you 51 real tools, 6 AI agents, a full IDE,
            and document generation — all in one place. And they certainly weren&apos;t built to serve pastors,
            ministries, Christian developers, and believing families.
          </p>
          <p className="text-sm text-zinc-500 italic">
            &ldquo;Whatever you do, work at it with all your heart, as working for the Lord.&rdquo;
            &mdash; Colossians 3:23
          </p>
        </div>
      </div>
    </Section>
  );
}

function ValueCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 lg:p-8 transition-all hover:border-white/[0.12] hover:bg-white/[0.04]">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-zinc-400 transition-colors group-hover:text-amber-400">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-500">{description}</p>
    </div>
  );
}

/* --- Icons --- */

function BookIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function ScaleIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.589-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.589-1.202L5.25 4.971z" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function TransparencyIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
