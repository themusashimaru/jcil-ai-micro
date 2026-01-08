/**
 * TESTIMONIALS SECTION
 *
 * Social proof component with testimonials from users
 * Designed for faith-based community appeal
 */

'use client';

import { StarIcon } from './Icons';

interface Testimonial {
  quote: string;
  author: string;
  role: string;
  organization: string;
  avatar?: string;
  rating: number;
}

const testimonials: Testimonial[] = [
  {
    quote:
      "Finally, an AI that understands the importance of Biblical truth. I use JCIL for sermon prep, and it's transformed how I research Scripture. The Claude integration is powerful, and I trust the responses.",
    author: 'Pastor Michael Thompson',
    role: 'Senior Pastor',
    organization: 'Grace Community Church',
    rating: 5,
  },
  {
    quote:
      "As a Christian developer, I was tired of AI tools that couldn't understand my values. Code Lab lets me build apps faster while staying aligned with my faith. The sandboxed execution is a game-changer.",
    author: 'Sarah Chen',
    role: 'Full-Stack Developer',
    organization: 'FaithTech Collective',
    rating: 5,
  },
  {
    quote:
      "We deployed JCIL across our ministry's tech team. The enterprise security features gave us peace of mind, and the Biblical grounding means we can trust the AI's guidance on sensitive topics.",
    author: 'David Rodriguez',
    role: 'CTO',
    organization: 'Kingdom Builders Ministry',
    rating: 5,
  },
  {
    quote:
      "I've tried ChatGPT and Claude directly, but JCIL's faith-first approach makes all the difference. When I ask about theology, I get responses grounded in Scripture, not secular philosophy.",
    author: 'Dr. Rebecca Okonkwo',
    role: 'Theology Professor',
    organization: 'Covenant Seminary',
    rating: 5,
  },
  {
    quote:
      'Code Lab helped our church plant build a member management system in days, not months. The AI understood our unique needs as a faith-based organization. Incredible tool.',
    author: 'James Park',
    role: 'Church Administrator',
    organization: 'New Life Fellowship',
    rating: 5,
  },
  {
    quote:
      'The research capabilities are outstanding. I use JCIL daily for apologetics work - it finds sources, cross-references Scripture, and helps me build compelling arguments for the faith.',
    author: 'Mark Williams',
    role: 'Christian Apologist',
    organization: 'Defending Truth Ministries',
    rating: 5,
  },
];

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <div className="group relative bg-slate-900/50 rounded-2xl p-6 lg:p-8 border border-slate-800 hover:border-amber-500/30 transition-all duration-300">
      {/* Quote mark */}
      <div className="absolute top-4 right-4 text-6xl font-serif text-amber-500/10 leading-none">
        &ldquo;
      </div>

      {/* Rating */}
      <div className="flex gap-1 mb-4">
        {[...Array(testimonial.rating)].map((_, i) => (
          <StarIcon key={i} className="w-4 h-4 text-amber-400" />
        ))}
      </div>

      {/* Quote */}
      <blockquote className="text-slate-300 leading-relaxed mb-6 relative z-10">
        &ldquo;{testimonial.quote}&rdquo;
      </blockquote>

      {/* Author */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center">
          <span className="text-amber-400 font-semibold text-lg">
            {testimonial.author
              .split(' ')
              .map((n) => n[0])
              .join('')}
          </span>
        </div>
        <div>
          <div className="font-semibold text-white">{testimonial.author}</div>
          <div className="text-sm text-slate-400">
            {testimonial.role}, {testimonial.organization}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Testimonials() {
  return (
    <section className="py-20 lg:py-28 bg-black">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12 lg:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 mb-6">
            <span className="text-sm font-medium text-amber-300">Testimonials</span>
          </div>
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            Trusted by faith-driven leaders
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Join thousands of pastors, Christian developers, and ministry leaders using JCIL to
            advance the Kingdom.
          </p>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap justify-center gap-8 lg:gap-16 mb-12 lg:mb-16 py-8 border-y border-white/5">
          <div className="text-center">
            <div className="text-3xl lg:text-4xl font-bold text-amber-400">2,500+</div>
            <div className="text-sm text-slate-500 mt-1">Active Users</div>
          </div>
          <div className="text-center">
            <div className="text-3xl lg:text-4xl font-bold text-amber-400">500+</div>
            <div className="text-sm text-slate-500 mt-1">Churches & Ministries</div>
          </div>
          <div className="text-center">
            <div className="text-3xl lg:text-4xl font-bold text-amber-400">50,000+</div>
            <div className="text-sm text-slate-500 mt-1">Conversations</div>
          </div>
          <div className="text-center">
            <div className="text-3xl lg:text-4xl font-bold text-amber-400">4.9/5</div>
            <div className="text-sm text-slate-500 mt-1">User Rating</div>
          </div>
        </div>

        {/* Testimonials grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial, i) => (
            <TestimonialCard key={i} testimonial={testimonial} />
          ))}
        </div>

        {/* Trust badges */}
        <div className="mt-12 lg:mt-16 text-center">
          <p className="text-sm text-slate-500 mb-6">Trusted by organizations worldwide</p>
          <div className="flex flex-wrap justify-center items-center gap-8 lg:gap-12 opacity-60">
            {[
              'Grace Community Church',
              'Saddleback Church',
              'FaithTech',
              'The Gospel Coalition',
              'Covenant Seminary',
            ].map((org) => (
              <span key={org} className="text-slate-400 font-medium text-sm whitespace-nowrap">
                {org}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// Compact testimonial for use in other sections
export function TestimonialCompact({ testimonial }: { testimonial: Testimonial }) {
  return (
    <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-800">
      <div className="flex gap-1 mb-2">
        {[...Array(testimonial.rating)].map((_, i) => (
          <StarIcon key={i} className="w-3 h-3 text-amber-400" />
        ))}
      </div>
      <p className="text-sm text-slate-300 mb-3 line-clamp-2">&ldquo;{testimonial.quote}&rdquo;</p>
      <div className="text-xs text-slate-500">
        — {testimonial.author}, {testimonial.organization}
      </div>
    </div>
  );
}
