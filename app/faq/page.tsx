'use client';

import { useState } from 'react';
import Link from 'next/link';

const faqs = [
  {
    category: 'Platform',
    questions: [
      {
        q: 'What is JCIL.AI?',
        a: 'JCIL.AI is an enterprise-grade AI platform with 91 real tools, multi-model support (Claude, GPT, Gemini, Grok, DeepSeek), persistent memory, 67+ Composio integrations, and E2B sandboxed execution. Built on faith, open to all.',
      },
      {
        q: 'How is this different from other AI tools?',
        a: 'We compete on capability, not limitations. 91 real tools (zero stubs), multi-model AI, full GitHub integration, E2B sandboxed code execution, and 67+ app integrations via Composio. We also prioritize Scripture-grounded responses and Christian values.',
      },
      {
        q: 'What is Code Lab?',
        a: 'Code Lab is our full development environment in the browser. E2B sandboxed execution, 91 real tools, multi-model support, project persistence, GitHub integration, and document generation\u2014with zero installation required.',
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
        q: 'What are the 67+ integrations?',
        a: 'Through Composio, JCIL connects to GitHub, Slack, Notion, Google Drive, Trello, Jira, Linear, and 60+ more applications. These are real, production integrations\u2014not stubs.',
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
    <div className="border-b border-border/30">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <span className="font-mono text-sm text-foreground group-hover:text-accent transition-colors pr-4">
          {question}
        </span>
        <span
          className={`text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? 'max-h-96 pb-5' : 'max-h-0'
        }`}
      >
        <p className="font-mono text-xs text-muted-foreground leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-sm bg-background/80 border-b border-border/30">
        <div className="max-w-5xl mx-auto px-6 md:px-12 py-4">
          <nav className="flex items-center justify-between">
            <Link href="/" className="font-bebas text-2xl tracking-tight">
              <span className="text-accent">JCIL</span>
              <span className="text-muted-foreground">.AI</span>
            </Link>
            <Link href="/" className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest">
              &larr; Back to Home
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-6 md:px-12 py-16">
        {/* Hero */}
        <div className="mb-16">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Support</span>
          <h1 className="mt-4 font-bebas text-5xl md:text-7xl tracking-tight">FAQ</h1>
          <p className="mt-4 max-w-xl font-mono text-sm text-muted-foreground leading-relaxed">
            Common questions, direct answers.
          </p>
        </div>

        {/* FAQ Content */}
        <div className="max-w-3xl">
          {faqs.map((section) => (
            <div key={section.category} className="mb-12">
              <h2 className="mb-6 font-mono text-[10px] uppercase tracking-[0.3em] text-accent">
                {section.category}
              </h2>
              <div className="border border-border/40 bg-card/50 backdrop-blur-sm overflow-hidden">
                <div className="px-6">
                  {section.questions.map((faq) => (
                    <FAQItem key={faq.q} question={faq.q} answer={faq.a} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 pt-16 border-t border-border/30">
          <div className="max-w-xl">
            <h2 className="font-bebas text-3xl tracking-tight text-foreground mb-4">STILL HAVE QUESTIONS?</h2>
            <p className="font-mono text-xs text-muted-foreground mb-6">Reach out directly.</p>
            <Link
              href="/contact"
              className="inline-block border border-accent bg-accent/10 px-8 py-4 font-mono text-sm uppercase tracking-widest text-accent hover:bg-accent/20 transition-all"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/30 py-8">
        <div className="max-w-5xl mx-auto px-6 md:px-12 text-center">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
            &copy; {new Date().getFullYear()} JCIL.AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
