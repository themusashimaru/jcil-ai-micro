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
        a: 'JCIL.AI is an AI-powered assistant built specifically for people of faith. We provide intelligent chat, research tools, writing assistance, and more, all wrapped in a protective layer designed to align with Christian values.',
      },
      {
        q: 'How is JCIL.AI different from ChatGPT or other AI tools?',
        a: 'Unlike general-purpose AI tools, JCIL.AI is built with faith-based values at its core. We include content moderation to filter inappropriate material, provide Bible study tools, and ensure the AI assists rather than replaces human thinking and spiritual growth.',
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
        a: 'JCIL.AI offers AI chat, live research with web search, Bible study tools, writing assistance, image generation, data analysis, code help, daily devotionals, and curated breaking news updated every 30 minutes.',
      },
      {
        q: 'Can JCIL.AI help me study the Bible?',
        a: 'Yes. JCIL.AI includes dedicated Bible study tools to help you explore Scripture, develop Bible studies, answer theological questions, and deepen your understanding of God\'s Word.',
      },
      {
        q: 'Will JCIL.AI write my sermon or essay for me?',
        a: 'We believe AI should assist, not replace. JCIL.AI will help you outline a sermon or brainstorm ideas, but we encourage sermons to be Spirit-led. Similarly, we help students study and identify weaknesses rather than writing papers for them.',
      },
    ],
  },
  {
    category: 'Pricing & Plans',
    questions: [
      {
        q: 'Is there a free plan?',
        a: 'Yes. Our free plan includes 10 chats per day with access to basic AI features. It is perfect for testing the service or for those who cannot afford a subscription.',
      },
      {
        q: 'What is the difference between Basic, Pro, and Executive plans?',
        a: 'Basic ($12/month) includes unlimited chat, research, and Bible study tools. Pro ($30/month) adds image generation, enhanced research, and higher intelligence. Executive ($150/month) is for heavy users who need the highest level of AI capability and advanced features.',
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
        a: 'Yes. Your conversations are encrypted in transit and at rest. We use enterprise-grade security standards and do not sell your data to third parties.',
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
        a: 'JCIL.AI does not permit adult content, profane language, or content that promotes harm. Our multi-layer moderation system filters inappropriate content to maintain a safe environment.',
      },
      {
        q: 'Is JCIL.AI safe for my family?',
        a: 'Yes. We designed JCIL.AI with families in mind. Content moderation ensures that users of all ages can use the platform without encountering inappropriate material.',
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold">
            JCIL.AI
          </Link>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link href="/login" className="px-3 py-2 hover:text-gray-300 text-sm sm:text-base">
              Log In
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-white px-4 py-2 sm:px-6 text-black font-semibold hover:bg-gray-200 text-sm sm:text-base"
            >
              Sign Up
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="mb-6 text-4xl sm:text-5xl font-bold">Frequently Asked Questions</h1>
          <p className="text-xl text-gray-300">
            Find answers to common questions about JCIL.AI.
          </p>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="container mx-auto px-4 pb-20">
        <div className="mx-auto max-w-3xl">
          {faqs.map((section, sectionIndex) => (
            <div key={sectionIndex} className="mb-12">
              <h2 className="mb-6 text-2xl font-bold text-blue-400">{section.category}</h2>
              <div className="space-y-4">
                {section.questions.map((faq, faqIndex) => (
                  <div key={faqIndex} className="glass-morphism rounded-xl p-6">
                    <h3 className="mb-3 text-lg font-semibold">{faq.q}</h3>
                    <p className="text-gray-300 leading-relaxed">{faq.a}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="glass-morphism mx-auto max-w-2xl rounded-3xl p-8 sm:p-12">
          <h2 className="mb-4 text-2xl font-bold">Still have questions?</h2>
          <p className="mb-6 text-gray-300">
            Our support team is here to help.
          </p>
          <a
            href="mailto:support@jcil.ai"
            className="inline-block rounded-lg bg-blue-500 px-8 py-3 font-semibold hover:bg-blue-600 transition"
          >
            Contact Support
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-12">
        <div className="container mx-auto px-4 text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} JCIL.AI. All rights reserved.</p>
          <div className="mt-4 space-x-4">
            <Link href="/privacy" className="hover:text-white">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white">Terms of Service</Link>
            <Link href="/" className="hover:text-white">Home</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
