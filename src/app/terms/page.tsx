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

export default function TermsOfService() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4">
      <Card className="w-full max-w-4xl shadow-lg border-slate-200">
        <CardHeader className="border-b border-slate-200">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl text-blue-900">Terms of Service</CardTitle>
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
            Welcome to JCIL.AI slingshot 2.0. These Terms of Service ("Terms") govern
            your access to and use of our Service. By accessing or using JCIL.AI
            slingshot 2.0, you agree to be bound by these Terms. If you do not agree,
            please do not use our Service.
          </p>

          <div className="rounded-lg border-2 border-blue-900 bg-blue-50 p-5">
            <p className="text-sm font-semibold text-blue-900 leading-relaxed">
              JCIL.AI slingshot 2.0 is a faith-based AI service powered by Claude AI
              (Anthropic) that applies Christian content filtering to ensure biblical
              alignment. By using this Service, you acknowledge and agree to receive
              AI responses filtered through a Christian perspective.
            </p>
          </div>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              1. Acceptance of Terms
            </h3>
            <p className="leading-relaxed">
              By creating an account, accessing, or using JCIL.AI slingshot 2.0, you
              represent that you are at least 13 years of age (or the age of majority
              in your jurisdiction) and have the legal capacity to enter into these
              Terms. If you are using the Service on behalf of an organization, you
              represent that you have authority to bind that organization to these Terms.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              2. Description of Service
            </h3>
            <p className="mb-3 leading-relaxed">
              JCIL.AI slingshot 2.0 is an artificial intelligence chat service powered
              by Claude AI (Anthropic) that provides AI-generated responses filtered
              through a Christian content filtering system. Our Service:
            </p>
            <ul className="space-y-2 ml-5 list-disc">
              <li className="leading-relaxed">
                Utilizes Claude AI technology from Anthropic to provide intelligent responses
              </li>
              <li className="leading-relaxed">
                Applies biblical principles and Christian values to all AI responses
              </li>
              <li className="leading-relaxed">
                Allows users to upload files and images for analysis
              </li>
              <li className="leading-relaxed">
                Stores chat history for registered users
              </li>
              <li className="leading-relaxed">
                Provides specialized tools for text messaging, email writing, and recipe extraction
              </li>
            </ul>
            <p className="mt-3 leading-relaxed">
              We reserve the right to modify, suspend, or discontinue any aspect of the
              Service at any time without prior notice.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              3. User Accounts and Registration
            </h3>
            <p className="mb-3 leading-relaxed">
              To use certain features of our Service, you must create an account. You agree to:
            </p>
            <ul className="space-y-2 ml-5 list-disc">
              <li className="leading-relaxed">
                Provide accurate, current, and complete information during registration
              </li>
              <li className="leading-relaxed">
                Maintain and promptly update your account information
              </li>
              <li className="leading-relaxed">
                Maintain the security and confidentiality of your account password
              </li>
              <li className="leading-relaxed">
                Notify us immediately of any unauthorized use of your account
              </li>
              <li className="leading-relaxed">
                Accept responsibility for all activities that occur under your account
              </li>
            </ul>
            <p className="mt-3 leading-relaxed">
              You may not share your account credentials with others. We reserve the
              right to suspend or terminate accounts that violate these Terms.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              4. Acceptable Use Policy
            </h3>
            <p className="mb-3 leading-relaxed">
              You agree to use JCIL.AI slingshot 2.0 only for lawful purposes and in
              accordance with these Terms. You agree NOT to:
            </p>
            <ul className="space-y-2 ml-5 list-disc">
              <li className="leading-relaxed">
                Use the Service for any illegal, harmful, or fraudulent purposes
              </li>
              <li className="leading-relaxed">
                Attempt to circumvent or disable our Christian content filtering system
              </li>
              <li className="leading-relaxed">
                Upload content that is offensive, pornographic, violent, or promotes hatred
              </li>
              <li className="leading-relaxed">
                Use the Service to harass, threaten, or harm others
              </li>
              <li className="leading-relaxed">
                Violate any applicable laws, regulations, or third-party rights
              </li>
              <li className="leading-relaxed">
                Attempt to gain unauthorized access to our systems or other users' accounts
              </li>
              <li className="leading-relaxed">
                Use automated systems (bots, scrapers) to access the Service without permission
              </li>
              <li className="leading-relaxed">
                Transmit viruses, malware, or other malicious code
              </li>
              <li className="leading-relaxed">
                Reverse engineer, decompile, or attempt to extract source code
              </li>
            </ul>
            <p className="mt-3 leading-relaxed">
              Violation of this Acceptable Use Policy may result in immediate termination
              of your account and legal action if necessary.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              5. User Content
            </h3>
            <p className="mb-3 leading-relaxed">
              You retain ownership of any content you submit to JCIL.AI slingshot 2.0,
              including chat messages, prompts, and uploaded files ("User Content").
              However, by submitting User Content, you grant us:
            </p>
            <ul className="space-y-2 ml-5 list-disc">
              <li className="leading-relaxed">
                A worldwide, non-exclusive, royalty-free license to use, store, process,
                and display your User Content solely to provide and improve the Service
              </li>
              <li className="leading-relaxed">
                The right to transmit your User Content to Anthropic (Claude AI) for processing
              </li>
              <li className="leading-relaxed">
                The right to analyze your User Content to improve our Christian content
                filtering system (in anonymized form)
              </li>
            </ul>
            <p className="mt-3 leading-relaxed">
              We reserve the right to remove any User Content that violates these Terms
              or is otherwise objectionable, without prior notice.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              6. AI-Generated Content Disclaimer
            </h3>
            <p className="mb-3 leading-relaxed">
              AI-generated responses provided by JCIL.AI slingshot 2.0 are for
              informational and conversational purposes only. You acknowledge and agree that:
            </p>
            <ul className="space-y-2 ml-5 list-disc">
              <li className="leading-relaxed">
                AI responses may contain inaccuracies, errors, or outdated information
              </li>
              <li className="leading-relaxed">
                AI responses should not be considered professional advice (legal, medical,
                financial, or otherwise)
              </li>
              <li className="leading-relaxed">
                Our Christian content filtering system aims to provide biblically-aligned
                responses but does not replace personal Bible study, prayer, or pastoral guidance
              </li>
              <li className="leading-relaxed">
                You are solely responsible for verifying any information and for any
                decisions you make based on AI responses
              </li>
              <li className="leading-relaxed">
                We do not endorse or guarantee the accuracy of any AI-generated content
              </li>
            </ul>
            <p className="mt-3 leading-relaxed">
              For spiritual guidance, please consult your pastor, church leaders, or
              the Bible directly.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              7. Christian Content Filtering
            </h3>
            <p className="mb-3 leading-relaxed">
              JCIL.AI slingshot 2.0 employs a Christian content filtering system
              designed to align all responses with biblical principles. However:
            </p>
            <ul className="space-y-2 ml-5 list-disc">
              <li className="leading-relaxed">
                The filtering system is not perfect and may occasionally allow content
                that some users find objectionable
              </li>
              <li className="leading-relaxed">
                Biblical interpretation varies among Christian denominations and traditions
              </li>
              <li className="leading-relaxed">
                Our filtering reflects a conservative evangelical Christian worldview
              </li>
              <li className="leading-relaxed">
                We do not guarantee that all responses will align with your personal
                theological beliefs
              </li>
            </ul>
            <p className="mt-3 leading-relaxed">
              If you encounter content you believe is inappropriate or unbiblical,
              please report it to us for review.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              8. Third-Party Services
            </h3>
            <p className="leading-relaxed">
              Our Service utilizes third-party providers including Anthropic (Claude AI)
              and Supabase (database and authentication). Your use of the Service is
              subject to these third parties' terms and privacy policies. We are not
              responsible for the actions, content, or privacy practices of these
              third parties.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              9. Privacy and Data Protection
            </h3>
            <p className="leading-relaxed">
              Your privacy is important to us. Our collection, use, and disclosure of
              your personal information is governed by our{' '}
              <Link href="/privacy" className="text-blue-900 underline hover:text-blue-700">
                Privacy Policy
              </Link>
              , which is incorporated into these Terms by reference. By using the Service,
              you consent to our Privacy Policy.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              10. Disclaimers and Limitation of Liability
            </h3>
            <div className="rounded-lg bg-slate-100 border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900 leading-relaxed mb-2">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES
                OF ANY KIND, EITHER EXPRESS OR IMPLIED.
              </p>
            </div>
            <p className="mt-3 mb-3 leading-relaxed">We do not warrant that:</p>
            <ul className="space-y-2 ml-5 list-disc">
              <li className="leading-relaxed">
                The Service will be uninterrupted, secure, or error-free
              </li>
              <li className="leading-relaxed">
                The results obtained from the Service will be accurate or reliable
              </li>
              <li className="leading-relaxed">
                AI-generated content will be biblically accurate or appropriate
              </li>
              <li className="leading-relaxed">Any errors in the Service will be corrected</li>
            </ul>
            <div className="mt-4 rounded-lg bg-slate-100 border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900 leading-relaxed">
                TO THE FULLEST EXTENT PERMITTED BY LAW, JCIL.AI AND ITS AFFILIATES SHALL
                NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
                PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, USE, OR GOODWILL RESULTING
                FROM YOUR USE OF OR INABILITY TO USE THE SERVICE.
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              11. Termination
            </h3>
            <p className="mb-3 leading-relaxed">
              We reserve the right to suspend or terminate your access to the Service
              at any time, with or without cause. Reasons for termination may include:
            </p>
            <ul className="space-y-2 ml-5 list-disc">
              <li className="leading-relaxed">Violation of these Terms</li>
              <li className="leading-relaxed">Fraudulent, abusive, or illegal activity</li>
              <li className="leading-relaxed">Extended periods of inactivity</li>
              <li className="leading-relaxed">
                Requests by law enforcement or government agencies
              </li>
            </ul>
            <p className="mt-3 leading-relaxed">
              You may terminate your account at any time by contacting us. Upon
              termination, your right to use the Service will immediately cease.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              12. Governing Law
            </h3>
            <p className="leading-relaxed">
              These Terms shall be governed by and construed in accordance with the
              laws of the United States, without regard to conflict of law provisions.
              Any disputes arising from these Terms or your use of the Service shall
              be resolved through binding arbitration in accordance with the American
              Arbitration Association's rules.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              13. Changes to Terms
            </h3>
            <p className="leading-relaxed">
              We reserve the right to modify these Terms at any time. If we make
              material changes, we will notify you by posting the updated Terms on
              this page with a new "Last updated" date. Your continued use of the
              Service after changes become effective constitutes your acceptance of
              the revised Terms.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              14. Contact Information
            </h3>
            <p className="mb-3 leading-relaxed">
              If you have any questions about these Terms, please contact us at:
            </p>
            <ul className="space-y-2 ml-5 list-disc">
              <li className="leading-relaxed">
                <strong className="text-slate-900">Email:</strong> legal@jcil.ai
              </li>
              <li className="leading-relaxed">
                <strong className="text-slate-900">Website:</strong> https://jcil.ai
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              15. Faith-Based Service Acknowledgment
            </h3>
            <p className="mb-3 leading-relaxed">
              By using JCIL.AI slingshot 2.0, you explicitly acknowledge and agree that:
            </p>
            <ul className="space-y-2 ml-5 list-disc">
              <li className="leading-relaxed">
                This is a faith-based service designed to reflect Christian values and
                biblical principles
              </li>
              <li className="leading-relaxed">
                All AI responses are filtered through a Christian perspective
              </li>
              <li className="leading-relaxed">
                The Service is intended for users who desire biblically-aligned AI interactions
              </li>
              <li className="leading-relaxed">
                If you do not agree with Christian values or biblical principles, this
                Service may not be suitable for you
              </li>
            </ul>
          </section>

          <div className="mt-8 rounded-lg bg-slate-100 border border-slate-200 p-5">
            <p className="text-sm font-semibold text-slate-900 leading-relaxed">
              By using JCIL.AI slingshot 2.0, you acknowledge that you have read,
              understood, and agree to be bound by these Terms of Service. God bless you!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
