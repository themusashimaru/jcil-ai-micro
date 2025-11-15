/**
 * ODE TO THE MARINE CORPS
 *
 * A personal tribute and thank you to the United States Marine Corps
 */

import Link from 'next/link';

export default function MarineCorpsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white">
      {/* Header */}
      <header className="container mx-auto px-4 py-6 border-b border-gray-800">
        <nav className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold">
            JCIL.AI
          </Link>
          <Link href="/" className="text-gray-400 hover:text-white transition">
            ← Back to Home
          </Link>
        </nav>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-16">
        <article className="mx-auto max-w-4xl">
          {/* Title Section */}
          <div className="mb-12 text-center">
            <h1 className="mb-4 text-5xl font-bold">Ode to the Marine Corps</h1>
            <p className="text-xl text-gray-400 italic">
              A Personal Thank You
            </p>
          </div>

          {/* Eagle, Globe, and Anchor Symbol (Text representation) */}
          <div className="mb-12 text-center">
            <div className="text-6xl mb-4">⚓</div>
            <p className="text-sm text-gray-500 italic">
              Semper Fidelis - Always Faithful
            </p>
          </div>

          {/* Content */}
          <div className="glass-morphism rounded-2xl p-8 md:p-12 space-y-8 text-lg leading-relaxed">
            <p className="text-xl font-semibold text-blue-400 text-center">
              To the United States Marine Corps,
            </p>

            <p>
              I write this with a heart full of gratitude and profound respect. The journey has been
              tough. There&apos;s no denying that. But it is because of the <strong className="text-white">values
              instilled in me</strong> by the Marine Corps that I stand here today as a man, a father, and
              a follower of Christ.
            </p>

            <p>
              The Corps taught me what it means to be a <strong className="text-white">man</strong>. Not just
              in strength or courage, but in character, integrity, and honor. You showed me that true strength
              comes from discipline, that leadership is earned through service, and that commitment means
              standing firm even when the path is hard.
            </p>

            <p>
              As a <strong className="text-white">father</strong>, the lessons learned in the Corps guide me
              every single day. The discipline to wake up and do what needs to be done. The commitment to be
              present and lead my family with purpose. The courage to make hard decisions and stand by them.
              These weren&apos;t just military lessons. They became the foundation of how I raise my children
              and love my family.
            </p>

            <div className="bg-blue-900/20 border-l-4 border-blue-500 p-6 my-8">
              <p className="font-semibold text-blue-400 mb-3">The Marine Corps Values:</p>
              <ul className="space-y-2 text-gray-300">
                <li><strong className="text-white">Honor</strong> - Doing what&apos;s right, even when no one is watching</li>
                <li><strong className="text-white">Courage</strong> - Facing fears and challenges head-on</li>
                <li><strong className="text-white">Commitment</strong> - Unwavering dedication to mission and purpose</li>
              </ul>
            </div>

            <p>
              These values don&apos;t just apply to the battlefield. They apply to life. They apply to my
              <strong className="text-white"> walk with Christ</strong>. The discipline to pray daily, to study
              Scripture, to lead my family in faith. The courage to stand for truth in a world that often rejects
              it. The commitment to follow Jesus no matter the cost.
            </p>

            <p>
              The Marine Corps gave me the framework, and Christ gave me the purpose. Together, they&apos;ve
              shaped who I am today. A warrior not just in the physical sense, but in the spiritual battle we
              all face. A leader not just of Marines, but of my household. A man who understands that
              <strong className="text-white"> true leadership means serving others</strong>, just as Christ served us.
            </p>

            <p>
              Yes, the road has been tough. There have been struggles, setbacks, and moments of doubt. But the
              Corps taught me to <strong className="text-white">never quit</strong>. To adapt and overcome. To
              push through when others give up. These lessons have carried me through the hardest seasons of life
              and continue to sustain me every day.
            </p>

            <p className="text-xl text-center font-semibold text-blue-400 mt-12 pt-8 border-t border-gray-700">
              Thank you, United States Marine Corps.
            </p>

            <p className="text-center text-gray-300">
              Thank you for teaching me discipline. Thank you for instilling commitment. Thank you for making me
              a better man, a better father, and a better servant of God.
            </p>

            <p className="text-center text-gray-300">
              You gave me so much more than I ever could have imagined.
            </p>

            <p className="text-center text-2xl font-bold text-white mt-8">
              Semper Fi
            </p>
          </div>

          {/* Closing Note */}
          <div className="mt-12 text-center text-sm text-gray-500">
            <p>
              This tribute reflects the personal experience and gratitude of the founder of JCIL.AI.
              <br />
              The United States Marine Corps is not affiliated with or endorsing this website.
            </p>
          </div>
        </article>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} JCIL.AI. All rights reserved.</p>
          <p className="mt-2">
            <Link href="/privacy" className="hover:text-white">Privacy Policy</Link>
            {' • '}
            <Link href="/terms" className="hover:text-white">Terms of Service</Link>
            {' • '}
            <Link href="/cookies" className="hover:text-white">Cookie Policy</Link>
          </p>
        </div>
      </footer>
    </main>
  );
}
