'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

export default function CookiePolicy() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4">
      <Card className="w-full max-w-4xl shadow-lg border-slate-200">
        <CardHeader className="border-b border-slate-200">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl text-blue-900">Cookie Policy</CardTitle>
            <Button asChild variant="ghost" size="icon" className="hover:bg-slate-100">
              <Link href="/">
                <ArrowLeft className="h-5 w-5 text-slate-700" />
                <span className="sr-only">Back to Chat</span>
              </Link>
            </Button>
          </div>
          <CardDescription className="text-slate-600">
            Last updated: November 5, 2025
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6 text-slate-700">
          <p className="text-base leading-relaxed">
            This Cookie Policy explains how JCIL.AI slingshot 2.0 ("we," "us," or "our")
            uses cookies and similar tracking technologies when you use our Service.
          </p>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              1. What Are Cookies?
            </h3>
            <p className="leading-relaxed">
              Cookies are small text files stored on your device (computer, tablet, or
              mobile) when you visit a website. They help websites remember your preferences
              and provide a better user experience.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              2. How We Use Cookies
            </h3>
            <p className="mb-3 leading-relaxed">
              JCIL.AI slingshot 2.0 uses cookies and similar technologies for the
              following purposes:
            </p>

            <h4 className="text-base font-semibold text-slate-900 mb-2">
              Essential Cookies
            </h4>
            <p className="mb-3 leading-relaxed">
              These cookies are necessary for the Service to function properly. They
              enable core functionality such as:
            </p>
            <ul className="space-y-2 ml-5 list-disc mb-4">
              <li className="leading-relaxed">Authentication and security</li>
              <li className="leading-relaxed">Session management</li>
              <li className="leading-relaxed">Keeping you logged in</li>
              <li className="leading-relaxed">Remembering your preferences</li>
            </ul>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 mb-4">
              <p className="text-sm text-slate-700">
                <strong className="text-slate-900">Provider:</strong> Supabase (our
                authentication and database provider)
              </p>
              <p className="text-sm text-slate-700 mt-1">
                <strong className="text-slate-900">Duration:</strong> Session-based and
                persistent cookies
              </p>
            </div>

            <h4 className="text-base font-semibold text-slate-900 mb-2">
              Functional Cookies
            </h4>
            <p className="mb-3 leading-relaxed">
              These cookies help provide enhanced functionality and personalization:
            </p>
            <ul className="space-y-2 ml-5 list-disc">
              <li className="leading-relaxed">Remembering your chat history</li>
              <li className="leading-relaxed">Storing your selected AI tool preferences</li>
              <li className="leading-relaxed">Maintaining your UI preferences</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              3. Types of Cookies We Use
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border border-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900 border-b border-slate-200">
                      Cookie Name
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900 border-b border-slate-200">
                      Purpose
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900 border-b border-slate-200">
                      Duration
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm">
                      <code className="text-blue-900 bg-blue-50 px-2 py-1 rounded">
                        sb-*-auth-token
                      </code>
                    </td>
                    <td className="px-4 py-3 text-sm">Authentication token (Essential)</td>
                    <td className="px-4 py-3 text-sm">Persistent</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm">
                      <code className="text-blue-900 bg-blue-50 px-2 py-1 rounded">
                        sb-*-auth-token-code-verifier
                      </code>
                    </td>
                    <td className="px-4 py-3 text-sm">PKCE code verifier (Essential)</td>
                    <td className="px-4 py-3 text-sm">Session</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              4. Third-Party Services
            </h3>
            <p className="mb-3 leading-relaxed">
              We use third-party services that may set their own cookies:
            </p>
            <ul className="space-y-2 ml-5 list-disc">
              <li className="leading-relaxed">
                <strong className="text-slate-900">Supabase:</strong> Our authentication
                and database provider uses cookies to manage user sessions and authentication
              </li>
              <li className="leading-relaxed">
                <strong className="text-slate-900">XAI (Grok):</strong> When
                processing your AI requests
              </li>
            </ul>
            <p className="mt-4 mb-3 leading-relaxed">
              These third-party services have their own privacy policies. We recommend
              reviewing them:
            </p>
            <ul className="space-y-2 ml-5 list-disc">
              <li className="leading-relaxed">
                <a
                  href="https://supabase.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-900 underline hover:text-blue-700"
                >
                  Supabase Privacy Policy
                </a>
              </li>
              <li className="leading-relaxed">
                <a
                  href="https://x.ai/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-900 underline hover:text-blue-700"
                >
                  XAI Privacy Policy
                </a>
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              5. Managing Cookies
            </h3>
            <p className="mb-3 leading-relaxed">
              You have several options for managing cookies:
            </p>

            <h4 className="text-base font-semibold text-slate-900 mb-2">
              Browser Settings
            </h4>
            <p className="mb-3 leading-relaxed">
              Most web browsers allow you to control cookies through their settings.
              You can typically:
            </p>
            <ul className="space-y-2 ml-5 list-disc mb-4">
              <li className="leading-relaxed">View cookies stored on your device</li>
              <li className="leading-relaxed">Delete cookies</li>
              <li className="leading-relaxed">Block cookies from specific websites</li>
              <li className="leading-relaxed">Block all cookies</li>
            </ul>
            <p className="mb-3 leading-relaxed">
              Here are links to cookie management guides for popular browsers:
            </p>
            <ul className="space-y-2 ml-5 list-disc">
              <li className="leading-relaxed">
                <a
                  href="https://support.google.com/chrome/answer/95647"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-900 underline hover:text-blue-700"
                >
                  Google Chrome
                </a>
              </li>
              <li className="leading-relaxed">
                <a
                  href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-900 underline hover:text-blue-700"
                >
                  Mozilla Firefox
                </a>
              </li>
              <li className="leading-relaxed">
                <a
                  href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-900 underline hover:text-blue-700"
                >
                  Safari
                </a>
              </li>
              <li className="leading-relaxed">
                <a
                  href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-900 underline hover:text-blue-700"
                >
                  Microsoft Edge
                </a>
              </li>
            </ul>

            <div className="mt-4 rounded-lg border border-blue-900 bg-blue-50 p-5">
              <h4 className="text-base font-semibold text-blue-900 mb-2">
                Important Note
              </h4>
              <p className="text-sm text-slate-700 leading-relaxed">
                If you disable or block essential cookies, some features of JCIL.AI
                slingshot 2.0 may not function properly. Specifically, you may not be
                able to log in, stay logged in, or access your chat history.
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              6. Do Not Track
            </h3>
            <p className="leading-relaxed">
              Some browsers have a "Do Not Track" feature that lets you tell websites
              you do not want to have your online activities tracked. Currently, there
              is no industry standard for how to respond to Do Not Track signals, and
              JCIL.AI slingshot 2.0 does not currently respond to these signals.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              7. Updates to This Cookie Policy
            </h3>
            <p className="leading-relaxed">
              We may update this Cookie Policy from time to time to reflect changes in
              our practices or for other operational, legal, or regulatory reasons. We
              will notify you of any material changes by posting the updated policy on
              this page with a new "Last updated" date. We encourage you to review this
              Cookie Policy periodically to stay informed about how we use cookies.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              8. Contact Us
            </h3>
            <p className="mb-3 leading-relaxed">
              If you have any questions about this Cookie Policy or our use of cookies,
              please contact us at:
            </p>
            <ul className="space-y-2 ml-5 list-disc">
              <li className="leading-relaxed">
                <strong className="text-slate-900">Email:</strong> privacy@jcil.ai
              </li>
              <li className="leading-relaxed">
                <strong className="text-slate-900">Website:</strong> https://jcil.ai
              </li>
            </ul>
          </section>

          <div className="mt-8 rounded-lg bg-slate-100 border border-slate-200 p-5">
            <p className="text-sm font-semibold text-slate-900 leading-relaxed">
              By using JCIL.AI slingshot 2.0, you consent to our use of cookies as
              described in this Cookie Policy. If you do not agree to our use of cookies,
              please adjust your browser settings or refrain from using our Service.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
