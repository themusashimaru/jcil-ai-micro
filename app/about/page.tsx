/**
 * ABOUT US PAGE
 *
 * PURPOSE:
 * - Tell the JCIL.AI story
 * - Build trust and credibility
 * - Explain mission and values
 */

import Link from 'next/link';

export default function AboutPage() {
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
      <section className="container mx-auto px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="mb-6 text-4xl sm:text-5xl font-bold">About JCIL.AI</h1>
          <p className="text-xl text-gray-300">
            Building AI tools that serve people of faith.
          </p>
        </div>
      </section>

      {/* Our Story */}
      <section className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-6 text-3xl font-bold">Our Story</h2>
          <div className="space-y-6 text-lg text-gray-300 leading-relaxed">
            <p>
              JCIL.AI was founded with a simple observation: the most powerful AI tools in the world
              are built in Silicon Valley, often reflecting values that do not align with millions
              of Americans who hold traditional, faith-based beliefs.
            </p>
            <p>
              As artificial intelligence becomes more influential in how we learn, work, and
              communicate, we saw a growing need for tools that respect and reinforce the values
              of people of faith rather than challenge them.
            </p>
            <p>
              Our founder, a computer programmer specializing in tool development, deep research,
              and security systems engineering, set out to build something different: an AI platform
              built on world-class infrastructure, wrapped in a protective layer designed specifically
              to serve Christians and people of faith.
            </p>
          </div>
        </div>
      </section>

      {/* Our Mission */}
      <section className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-6 text-3xl font-bold">Our Mission</h2>
          <div className="space-y-6 text-lg text-gray-300 leading-relaxed">
            <p>
              We believe that if people of faith do not build their own tools, others will build
              them for us. And those tools will not share our values.
            </p>
            <p>
              JCIL.AI exists to ensure that Christians and people of faith have access to powerful,
              modern AI technology that they can trust. Technology that empowers without replacing
              human thinking. Technology that serves without compromising beliefs.
            </p>
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-3xl font-bold">Our Values</h2>
          <div className="space-y-8">
            <div className="glass-morphism rounded-2xl p-6">
              <h3 className="mb-3 text-xl font-semibold">Human Development Matters</h3>
              <p className="text-gray-300">
                We will help a pastor outline a sermon, but we believe sermons should be Spirit-led.
                We will help a student study and identify weaknesses, but we will not write their
                papers for them. AI should assist human growth, not replace it.
              </p>
            </div>

            <div className="glass-morphism rounded-2xl p-6">
              <h3 className="mb-3 text-xl font-semibold">Safe for Families</h3>
              <p className="text-gray-300">
                Our platform includes robust content moderation. No adult content. No profane language.
                Clear community guidelines. JCIL.AI is a place where families can use AI without
                worrying about what they might encounter.
              </p>
            </div>

            <div className="glass-morphism rounded-2xl p-6">
              <h3 className="mb-3 text-xl font-semibold">Privacy as Stewardship</h3>
              <p className="text-gray-300">
                We take the stewardship of your data seriously. Your conversations are encrypted
                and automatically deleted after 6 months. We do not sell your data or use it
                for purposes beyond providing you with the service you paid for.
              </p>
            </div>

            <div className="glass-morphism rounded-2xl p-6">
              <h3 className="mb-3 text-xl font-semibold">Scripture as Foundation</h3>
              <p className="text-gray-300">
                We believe Scripture is the written Word of God. JCIL.AI is designed to be a
                study aid that helps users explore the Bible, develop Bible studies, and deepen
                their faith with an assistant that shares their reverence for God's Word.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="glass-morphism mx-auto max-w-2xl rounded-3xl p-8 sm:p-12">
          <h2 className="mb-4 text-3xl font-bold">Join Our Community</h2>
          <p className="mb-8 text-lg text-gray-300">
            Experience AI that was built with your values in mind.
          </p>
          <Link
            href="/signup"
            className="inline-block rounded-lg bg-blue-500 px-8 py-4 text-lg font-semibold hover:bg-blue-600 transition"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-12 mt-12">
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
