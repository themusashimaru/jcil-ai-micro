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
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4 dark:bg-gray-900">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Cookie Policy for JCIL.AI</CardTitle>
            <Button asChild variant="ghost" size="icon">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back to Chat</span>
              </Link>
            </Button>
          </div>
          <CardDescription>Last updated: October 28, 2025</CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none dark:prose-invert">
          <p>
            This Cookie Policy explains how JCIL.AI ("we," "us," or "our") uses
            cookies and similar tracking technologies when you use our Service.
          </p>

          <h3>1. What Are Cookies?</h3>
          <p>
            Cookies are small text files that are stored on your device (computer,
            tablet, or mobile) when you visit a website. They help websites remember
            your preferences and provide a better user experience.
          </p>

          <h3>2. How We Use Cookies</h3>
          <p>
            JCIL.AI uses cookies and similar technologies for the following purposes:
          </p>

          <h4>Essential Cookies</h4>
          <p>
            These cookies are necessary for the Service to function properly. They
            enable core functionality such as:
          </p>
          <ul>
            <li>Authentication and security</li>
            <li>Session management</li>
            <li>Keeping you logged in</li>
            <li>Remembering your preferences</li>
          </ul>
          <p>
            <strong>Provider:</strong> Supabase (our authentication and database provider)
          </p>
          <p>
            <strong>Duration:</strong> Session-based and persistent cookies
          </p>

          <h4>Functional Cookies</h4>
          <p>
            These cookies help provide enhanced functionality and personalization:
          </p>
          <ul>
            <li>Remembering your chat history</li>
            <li>Storing your selected AI tool preferences</li>
            <li>Maintaining your UI preferences</li>
          </ul>

          <h4>Analytics Cookies (If Enabled)</h4>
          <p>
            We may use analytics cookies to understand how visitors use our Service,
            which helps us improve the user experience. These cookies collect
            information such as:
          </p>
          <ul>
            <li>Pages visited</li>
            <li>Time spent on the Service</li>
            <li>Links clicked</li>
            <li>General usage patterns</li>
          </ul>
          <p>
            All analytics data is collected in an anonymized form and cannot be
            used to identify you personally.
          </p>

          <h3>3. Types of Cookies We Use</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left">Cookie Name</th>
                  <th className="px-4 py-2 text-left">Purpose</th>
                  <th className="px-4 py-2 text-left">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-2">
                    <code className="text-sm">sb-*-auth-token</code>
                  </td>
                  <td className="px-4 py-2">Authentication token (Essential)</td>
                  <td className="px-4 py-2">Persistent</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">
                    <code className="text-sm">sb-*-auth-token-code-verifier</code>
                  </td>
                  <td className="px-4 py-2">PKCE code verifier (Essential)</td>
                  <td className="px-4 py-2">Session</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3>4. Third-Party Cookies</h3>
          <p>
            We use third-party services that may set their own cookies:
          </p>
          <ul>
            <li>
              <strong>Supabase:</strong> Our authentication and database provider
              uses cookies to manage user sessions and authentication
            </li>
            <li>
              <strong>Google (Gemini AI):</strong> When processing your AI requests
            </li>
            <li>
              <strong>Anthropic (Claude AI):</strong> When processing your AI requests
            </li>
          </ul>
          <p>
            These third-party services have their own privacy policies and cookie
            policies. We recommend reviewing them:
          </p>
          <ul>
            <li>
              <a
                href="https://supabase.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Supabase Privacy Policy
              </a>
            </li>
            <li>
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Google Privacy Policy
              </a>
            </li>
            <li>
              <a
                href="https://www.anthropic.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Anthropic Privacy Policy
              </a>
            </li>
          </ul>

          <h3>5. Managing Cookies</h3>
          <p>
            You have several options for managing cookies:
          </p>

          <h4>Browser Settings</h4>
          <p>
            Most web browsers allow you to control cookies through their settings.
            You can typically:
          </p>
          <ul>
            <li>View cookies stored on your device</li>
            <li>Delete cookies</li>
            <li>Block cookies from specific websites</li>
            <li>Block all cookies</li>
          </ul>
          <p>
            Here are links to cookie management guides for popular browsers:
          </p>
          <ul>
            <li>
              <a
                href="https://support.google.com/chrome/answer/95647"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Google Chrome
              </a>
            </li>
            <li>
              <a
                href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Mozilla Firefox
              </a>
            </li>
            <li>
              <a
                href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Safari
              </a>
            </li>
            <li>
              <a
                href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                Microsoft Edge
              </a>
            </li>
          </ul>

          <h4>Important Note</h4>
          <p className="font-semibold">
            If you disable or block essential cookies, some features of JCIL.AI
            may not function properly. Specifically, you may not be able to:
          </p>
          <ul>
            <li>Log in or stay logged in</li>
            <li>Access your chat history</li>
            <li>Use certain features that require authentication</li>
          </ul>

          <h3>6. Do Not Track</h3>
          <p>
            Some browsers have a "Do Not Track" feature that lets you tell websites
            you do not want to have your online activities tracked. Currently, there
            is no industry standard for how to respond to Do Not Track signals, and
            JCIL.AI does not currently respond to these signals.
          </p>

          <h3>7. Updates to This Cookie Policy</h3>
          <p>
            We may update this Cookie Policy from time to time to reflect changes
            in our practices or for other operational, legal, or regulatory reasons.
            We will notify you of any material changes by posting the updated policy
            on this page with a new "Last updated" date.
          </p>
          <p>
            We encourage you to review this Cookie Policy periodically to stay
            informed about how we use cookies.
          </p>

          <h3>8. Contact Us</h3>
          <p>
            If you have any questions about this Cookie Policy or our use of
            cookies, please contact us at:
          </p>
          <ul>
            <li>
              <strong>Email:</strong> privacy@jcil.ai
            </li>
            <li>
              <strong>Website:</strong> https://jcil.ai
            </li>
          </ul>

          <div className="mt-8 rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
            <p className="text-sm font-semibold">
              By using JCIL.AI, you consent to our use of cookies as described in
              this Cookie Policy. If you do not agree to our use of cookies, please
              adjust your browser settings or refrain from using our Service.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}