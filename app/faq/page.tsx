/**
 * FAQ PAGE
 *
 * Common questions with accurate, verified answers
 * Interactive accordion with shared header/footer
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import LandingHeader from '../components/landing/LandingHeader';
import LandingFooter from '../components/landing/LandingFooter';

const faqs = [
  {
    category: 'Platform',
    questions: [
      {
        q: 'What is JCIL.AI?',
        a: 'JCIL.AI is an enterprise-grade AI platform with 51 real tools, multi-model support (Claude, GPT, Gemini, Grok, DeepSeek), persistent memory, 136+ Composio integrations, and E2B sandboxed execution. Built on faith, open to all.',
      },
      {
        q: 'How is this different from other AI tools?',
        a: 'We compete on capability, not limitations. 51 real tools (zero stubs), multi-model AI, full GitHub integration, E2B sandboxed code execution, and 136+ app integrations via Composio. We also prioritize Scripture-grounded responses and Christian values.',
      },
      {
        q: 'What is Code Lab?',
        a: 'Code Lab is our full development environment in the browser. E2B sandboxed execution, 51 real tools, multi-model support, project persistence, GitHub integration, and document generation\u2014with zero installation required.',
      },
    ],
  },
  {
    category: 'Technical',
    questions: [
      {
        q: 'What AI models do you support?',
        a: 'We support Claude Opus 4.6 and Sonnet 4.6 (Anthropic), GPT-5.2 (OpenAI), Gemini (Google), Grok (xAI), and DeepSeek. Choose the best model for your task.',
      },
      {
        q: 'How does the agentic execution work?',
        a: "Our agents don't just respond\u2014they execute. They plan tasks, run code in E2B sandboxes, observe results, fix errors autonomously, and adapt strategy in real-time. It's a full execution loop, not a chat interface.",
      },
      {
        q: 'Is code execution safe?',
        a: 'Every session runs in an isolated E2B sandbox\u2014a full Linux environment with zero access to your local machine. Run anything with zero risk.',
      },
      {
        q: 'Does the AI remember between sessions?',
        a: 'Yes. Persistent memory stores your preferences, projects, and context across sessions. Tell us something once, we remember it.',
      },
      {
        q: 'What are the 136+ integrations?',
        a: 'Through Composio, JCIL connects to GitHub, Slack, Notion, Google Drive, Trello, Jira, Linear, and 130+ more applications. These are real, production integrations\u2014not stubs.',
      },
    ],
  },
  {
    category: 'Privacy & Security',
    questions: [
      {
        q: 'Where is my data stored?',
        a: 'All data is processed and stored exclusively on American servers. Your information never leaves US soil.',
      },
      {
        q: 'Do you train on my conversations?',
        a: 'No. Your private conversations are never used to train AI models. Your data is yours.',
      },
      {
        q: 'How long do you keep data?',
        a: 'Conversations are automatically deleted after 6 months. You can manually delete at any time from settings.',
      },
      {
        q: 'What encryption do you use?',
        a: 'AES-256 encryption at rest and TLS 1.3 in transit. Enterprise-grade security by default.',
      },
    ],
  },
  {
    category: 'Pricing',
    questions: [
      {
        q: 'Is there a free tier?',
        a: 'Yes. Limited daily usage to test the platform. Full capability requires a subscription.',
      },
      {
        q: 'Can I cancel anytime?',
        a: 'Yes. Cancel anytime with no hidden fees. Your access continues until the end of your billing period.',
      },
      {
        q: 'What payment methods do you accept?',
        a: 'All major credit cards through Stripe. Your payment information is never stored on our servers.',
      },
    ],
  },
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-white/10">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <span className="text-lg font-medium text-white group-hover:text-purple-400 transition pr-4">
          {question}
        </span>
        <span
          className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? 'max-h-96 pb-5' : 'max-h-0'
        }`}
      >
        <p className="text-slate-400 leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

export default function FAQPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <LandingHeader />

      {/* Hero */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px]" />
        </div>

        <div className="container mx-auto px-4 relative">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mb-6 text-5xl sm:text-6xl font-bold text-white">FAQ</h1>
            <p className="text-xl text-slate-400">Common questions, direct answers.</p>
          </div>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="pb-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            {faqs.map((section) => (
              <div key={section.category} className="mb-12">
                <h2 className="mb-6 text-sm font-semibold uppercase tracking-wider text-purple-400">
                  {section.category}
                </h2>
                <div className="bg-slate-900/50 rounded-2xl border border-white/10 overflow-hidden">
                  <div className="px-6">
                    {section.questions.map((faq) => (
                      <FAQItem key={faq.q} question={faq.q} answer={faq.a} />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 border-t border-white/10">
        <div className="container mx-auto px-4 text-center">
          <div className="mx-auto max-w-xl">
            <h2 className="mb-4 text-2xl font-bold text-white">Still have questions?</h2>
            <p className="mb-6 text-slate-400">Reach out directly.</p>
            <Link
              href="/contact"
              className="inline-block rounded-xl bg-slate-800 border border-slate-700 px-8 py-3 font-semibold text-white hover:bg-slate-700 transition"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>

      <LandingFooter />
    </main>
  );
}
