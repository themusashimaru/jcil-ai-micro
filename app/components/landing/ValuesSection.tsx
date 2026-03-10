/**
 * VALUES SECTION
 *
 * Trimmed to the 3 strongest differentiators + the killer "why not ChatGPT" callout.
 * This is the emotional core of the landing page.
 */

import Section, { SectionHeader } from './Section';

export default function ValuesSection() {
  return (
    <Section id="values" className="border-y border-white/[0.04]">
      <SectionHeader
        badge="Our Foundation"
        title="Why JCIL exists"
        description="Every AI platform reflects the values of whoever built it. We chose to build one that reflects ours."
      />

      <div className="mx-auto max-w-5xl">
        {/* Three core values */}
        <div className="mb-10 grid gap-6 sm:grid-cols-3">
          <ValueCard
            icon={<BookIcon />}
            title="Berean by Design"
            description="Like the Bereans in Acts 17:11, we test everything against Scripture. Our AI is grounded in Biblical truth — not cultural trends or popular opinion."
          />
          <ValueCard
            icon={<ShieldIcon />}
            title="Safe for Your Family"
            description="Zero tolerance for profanity, blasphemy, and explicit content. Hand it to your teenager, your small group, or your church staff without worry."
          />
          <ValueCard
            icon={<LockIcon />}
            title="Your Data, Protected"
            description="API keys encrypted with AES-256. Row-level security. Redis rate limiting. CSRF protection. Full audit trails. Enterprise-grade, not afterthought."
          />
        </div>

        {/* Why not the others — this is the conversion driver */}
        <div className="rounded-2xl border border-amber-500/10 bg-gradient-to-br from-amber-500/[0.04] to-transparent p-8 lg:p-10">
          <h3 className="text-xl font-semibold text-white mb-4">
            &ldquo;Why not just use ChatGPT or Claude directly?&rdquo;
          </h3>
          <p className="text-zinc-400 leading-relaxed mb-6">
            Because none of them were built for you. They don&apos;t align with Christian values.
            They don&apos;t filter content through a Biblical lens. They don&apos;t remember your
            preferences across sessions. They don&apos;t give you 51 real tools, 6 AI agents, a full
            IDE, and document generation — all in one place. And they weren&apos;t built to serve
            pastors, ministries, Christian developers, and believing families.
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

function BookIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  );
}
