/**
 * FAQ PAGE
 *
 * PURPOSE:
 * - Answer common questions
 * - Dark theme, tier-one presentation
 * - Interactive accordion
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import LandingLogo from '../components/LandingLogo';
import MobileMenu from '../components/MobileMenu';

const faqs = [
  {
    category: 'Platform',
    questions: [
      {
        q: 'What is JCIL.AI?',
        a: 'JCIL.AI is an enterprise-grade AI platform with agentic execution, persistent memory, MCP integration, and full development environment capabilities. Built on faith, open to all.',
      },
      {
        q: 'How is this different from other AI tools?',
        a: 'We compete on capability, not limitations. Dynamic agents that adapt to your workflow, full GitHub integration, sandboxed code execution, and MCP protocol support for infinite extensibility. The difference is in the architecture.',
      },
      {
        q: 'What is Code Lab?',
        a: 'Code Lab is our full development environment — a Claude Code-like experience in your browser. Sandboxed execution, persistent workspaces, 30+ tools, planning mode, hooks system, and project memory.',
      },
    ],
  },
  {
    category: 'Technical',
    questions: [
      {
        q: 'What is MCP integration?',
        a: 'Model Context Protocol (MCP) allows our agents to connect to external tools — databases, browsers, APIs, custom services. It\'s how you extend capability infinitely without waiting for us to build features.',
      },
      {
        q: 'How does the agentic execution work?',
        a: 'Our agents don\'t just respond — they execute. They plan tasks, run code, observe results, fix errors autonomously, and adapt strategy in real-time. It\'s a full execution loop, not a chat interface.',
      },
      {
        q: 'Is code execution safe?',
        a: 'Every session runs in an isolated E2B sandbox — a full Linux environment with zero access to your local machine. Run anything with zero risk.',
      },
      {
        q: 'Does the AI remember between sessions?',
        a: 'Yes. Persistent memory stores your preferences, projects, and context across sessions. Tell us something once, we remember it.',
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
        a: 'AES-256 encryption at rest and in transit. Enterprise-grade security by default.',
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
        <span className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
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
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/80 border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <Link href="/">
              <LandingLogo />
            </Link>

            <div className="hidden md:flex items-center space-x-6">
              <Link href="/#capabilities" className="text-slate-400 hover:text-white font-medium transition">
                Capabilities
              </Link>
              <Link href="/code-lab" className="text-slate-400 hover:text-white font-medium transition">
                Code Lab
              </Link>
              <Link href="/docs" className="text-slate-400 hover:text-white font-medium transition">
                Docs
              </Link>
              <Link href="/#pricing" className="text-slate-400 hover:text-white font-medium transition">
                Pricing
              </Link>
            </div>

            <div className="hidden md:flex items-center space-x-4">
              <Link href="/login" className="px-4 py-2 text-slate-400 hover:text-white font-medium transition">
                Log In
              </Link>
              <Link
                href="/signup"
                className="rounded-xl bg-white px-6 py-2 text-black font-semibold hover:bg-slate-100 transition-all duration-300"
              >
                Get Started
              </Link>
            </div>

            <MobileMenu />
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative py-20 sm:py-28 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px]" />
        </div>

        <div className="container mx-auto px-4 relative">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mb-6 text-5xl sm:text-6xl font-bold text-white">FAQ</h1>
            <p className="text-xl text-slate-400">
              Common questions, direct answers.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="pb-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            {faqs.map((section, sectionIndex) => (
              <div key={sectionIndex} className="mb-12">
                <h2 className="mb-6 text-sm font-semibold uppercase tracking-wider text-purple-400">
                  {section.category}
                </h2>
                <div className="bg-slate-900/50 rounded-2xl border border-white/10 overflow-hidden">
                  <div className="px-6">
                    {section.questions.map((faq, faqIndex) => (
                      <FAQItem key={faqIndex} question={faq.q} answer={faq.a} />
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
            <p className="mb-6 text-slate-400">
              Reach out directly.
            </p>
            <Link
              href="/contact"
              className="inline-block rounded-xl bg-slate-800 border border-slate-700 px-8 py-3 font-semibold text-white hover:bg-slate-700 transition"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-12 border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-slate-500 text-sm">
              &copy; {new Date().getFullYear()} JCIL.AI. All rights reserved.
            </div>
            <div className="flex gap-6 text-sm">
              <Link href="/" className="text-slate-500 hover:text-white transition">Home</Link>
              <Link href="/about" className="text-slate-500 hover:text-white transition">About</Link>
              <Link href="/privacy" className="text-slate-500 hover:text-white transition">Privacy</Link>
              <Link href="/terms" className="text-slate-500 hover:text-white transition">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
