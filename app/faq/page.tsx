/**
 * FAQ PAGE
 *
 * PURPOSE:
 * - Answer common questions
 * - Reduce support inquiries
 * - Build trust with potential customers
 */

import Link from 'next/link';

const faqs = [
  {
    category: 'General',
    questions: [
      {
        q: 'What is JCIL.AI?',
        a: 'JCIL.AI is an AI-powered assistant built specifically for people of faith. We provide intelligent chat, real-time fact-checking, research tools, writing assistance, and more, all wrapped in a protective layer designed to align with Christian values.',
      },
      {
        q: 'How is JCIL.AI different from ChatGPT or other AI tools?',
        a: 'Unlike general-purpose AI tools, JCIL.AI is built with faith-based values at its core. We include content moderation to filter inappropriate material, provide Bible study tools, and ensure the AI assists rather than replaces human thinking and spiritual growth. All our data is processed on American servers with enterprise-grade security.',
      },
      {
        q: 'Is JCIL.AI affiliated with any church or denomination?',
        a: 'No, JCIL.AI is an independent service designed to serve Christians across all denominations. We focus on shared biblical principles rather than denominational specifics.',
      },
    ],
  },
  {
    category: 'Features & Tools',
    questions: [
      {
        q: 'What can I use JCIL.AI for?',
        a: 'JCIL.AI offers AI chat, real-time fact-checking powered by Perplexity, live research with web search, Bible study tools, professional resume and cover letter writing, data analysis, code help, daily devotionals, and curated breaking news updated every 30 minutes.',
      },
      {
        q: 'Can JCIL.AI help me study the Bible?',
        a: 'Yes. JCIL.AI includes dedicated Bible study tools to help you explore Scripture, develop Bible studies, answer theological questions, and deepen your understanding of God\'s Word.',
      },
      {
        q: 'Will JCIL.AI write my sermon or essay for me?',
        a: 'We believe AI should assist, not replace. JCIL.AI will help you outline a sermon or brainstorm ideas, but we encourage sermons to be Spirit-led. Similarly, we help students study and identify weaknesses rather than writing papers for them.',
      },
      {
        q: 'Can JCIL.AI help with job applications?',
        a: 'Yes. JCIL.AI can help you create professional resumes and cover letters tailored to specific job postings. Just describe the job you\'re applying for, and our AI will help you craft compelling application materials.',
      },
    ],
  },
  {
    category: 'Pricing & Plans',
    questions: [
      {
        q: 'Is there a free plan?',
        a: 'Yes. Our free plan includes limited daily chats with access to basic AI features. It is perfect for testing the service or for those who cannot afford a subscription.',
      },
      {
        q: 'What is the difference between Plus, Pro, and Executive plans?',
        a: 'Plus ($18/month) includes unlimited chat, real-time fact-checking, research, and Bible study tools. Pro ($30/month) adds 3M token context window, enhanced research, and advanced document generation. Executive ($99/month) is for power users who need the highest intelligence AI model and 5x more capacity.',
      },
      {
        q: 'Can I cancel my subscription anytime?',
        a: 'Yes. You can cancel your subscription at any time with no hidden fees. Your access continues until the end of your billing period.',
      },
    ],
  },
  {
    category: 'Privacy & Security',
    questions: [
      {
        q: 'Is my data safe with JCIL.AI?',
        a: 'Yes. Your conversations are encrypted in transit and at rest using industry-standard AES-256 encryption. We use enterprise-grade security standards, process all data on American servers, and do not sell your data to third parties.',
      },
      {
        q: 'Where is my data stored?',
        a: 'All data is processed and stored exclusively on American servers. Your information never leaves US soil, ensuring compliance with American data protection standards.',
      },
      {
        q: 'How long do you keep my conversations?',
        a: 'Conversations are automatically deleted after 6 months. You can also manually delete your conversation history at any time from your settings.',
      },
      {
        q: 'Do you use my conversations to train AI models?',
        a: 'No. Your private conversations are not used to train AI models. We take your privacy seriously and treat your data as confidential.',
      },
    ],
  },
  {
    category: 'Content & Moderation',
    questions: [
      {
        q: 'What kind of content is not allowed?',
        a: 'JCIL.AI does not permit adult content, profane language, or content that promotes harm. Our multi-layer enterprise-grade moderation system filters inappropriate content to maintain a safe environment.',
      },
      {
        q: 'Is JCIL.AI appropriate for all ages?',
        a: 'JCIL.AI is intended for users 18 years of age and older. While we maintain strict content moderation, the platform is designed for adult use and parental discretion is advised for any minors.',
      },
      {
        q: 'What values does JCIL.AI reflect?',
        a: 'JCIL.AI is built on a biblical Christian worldview. Our AI responses align with traditional Christian values and Scripture. We are upfront about this - users who prefer a secular AI assistant should consider other options.',
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-slate-900">
              JCIL.AI
            </Link>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Link href="/login" className="px-3 py-2 text-slate-700 hover:text-slate-900 text-sm sm:text-base font-medium">
                Log In
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-blue-900 px-4 py-2 sm:px-6 text-white font-semibold hover:bg-blue-800 text-sm sm:text-base transition"
              >
                Sign Up
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-slate-50 to-white py-16 sm:py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="mb-6 text-4xl sm:text-5xl font-bold text-slate-900">Frequently Asked Questions</h1>
            <p className="text-xl text-slate-600">
              Find answers to common questions about JCIL.AI.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="container mx-auto px-4 pb-20">
        <div className="mx-auto max-w-3xl">
          {faqs.map((section, sectionIndex) => (
            <div key={sectionIndex} className="mb-12">
              <h2 className="mb-6 text-2xl font-bold text-blue-800">{section.category}</h2>
              <div className="space-y-4">
                {section.questions.map((faq, faqIndex) => (
                  <div key={faqIndex} className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                    <h3 className="mb-3 text-lg font-semibold text-slate-900">{faq.q}</h3>
                    <p className="text-slate-600 leading-relaxed">{faq.a}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-slate-50 py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="mx-auto max-w-2xl bg-white rounded-3xl p-8 sm:p-12 shadow-lg border border-slate-200">
            <h2 className="mb-4 text-2xl font-bold text-slate-900">Still have questions?</h2>
            <p className="mb-6 text-slate-600">
              Our support team is here to help.
            </p>
            <a
              href="mailto:support@jcil.ai"
              className="inline-block rounded-lg bg-blue-900 px-8 py-3 text-white font-semibold hover:bg-blue-800 transition"
            >
              Contact Support
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="container mx-auto px-4 text-center text-sm text-slate-400">
          <p>&copy; {new Date().getFullYear()} JCIL.AI. All rights reserved.</p>
          <div className="mt-4 space-x-4">
            <Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white transition">Terms of Service</Link>
            <Link href="/" className="hover:text-white transition">Home</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
