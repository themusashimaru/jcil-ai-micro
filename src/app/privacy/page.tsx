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

export default function PrivacyPolicy() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4">
      <Card className="w-full max-w-4xl shadow-lg border-slate-200">
        <CardHeader className="border-b border-slate-200">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl text-blue-900">Privacy Policy</CardTitle>
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
            Welcome to JCIL.AI slingshot 2.0 ("we," "us," or "our"). We are committed to
            protecting your privacy and handling your data with integrity and transparency.
            This Privacy Policy explains how we collect, use, disclose, and safeguard your
            information when you use our Service.
          </p>

          <div className="rounded-lg border-2 border-blue-900 bg-blue-50 p-5">
            <p className="text-sm font-semibold text-blue-900 leading-relaxed">
              JCIL.AI Slingshot 2.0 is powered by XAI (Grok), providing
              intelligent AI assistance through a Christian perspective. Our service
              applies biblically-aligned content filtering to ensure responses reflect
              Christian values and principles.
            </p>
          </div>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              1. Information We Collect
            </h3>
            <p className="mb-3 leading-relaxed">
              We collect information that you provide directly to us and information
              that is automatically collected when you use our Service:
            </p>
            <ul className="space-y-2 ml-5 list-disc">
              <li className="leading-relaxed">
                <strong className="text-slate-900">Account Information:</strong> When you create an
                account, we collect your email address and store a securely hashed
                version of your password. We never store passwords in plain text.
              </li>
              <li className="leading-relaxed">
                <strong className="text-slate-900">User Content:</strong> We collect and store your chat
                messages, prompts, and any files (including images) that you upload
                to the Service. This data is essential for providing your chat
                history and processing your AI requests.
              </li>
              <li className="leading-relaxed">
                <strong className="text-slate-900">Usage Data:</strong> We automatically collect certain
                information when you access the Service, including your IP address,
                browser type, device information, operating system, access times, and
                pages viewed.
              </li>
              <li className="leading-relaxed">
                <strong className="text-slate-900">Cookies:</strong> We use cookies and similar tracking
                technologies to enhance your experience and maintain your session.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              2. How We Use Your Information
            </h3>
            <p className="mb-3 leading-relaxed">
              We use the information we collect to provide, maintain, and improve our
              Service. Specifically, we use your information to:
            </p>
            <ul className="space-y-2 ml-5 list-disc">
              <li className="leading-relaxed">Create, maintain, and secure your account</li>
              <li className="leading-relaxed">
                Provide the Service's core functionality, including storing and
                retrieving your chat history
              </li>
              <li className="leading-relaxed">
                Process your prompts and uploaded files through XAI (Grok) to generate
                intelligent, biblically-aligned responses
              </li>
              <li className="leading-relaxed">
                Apply our Christian content filtering to ensure responses align with
                biblical principles
              </li>
              <li className="leading-relaxed">
                Send you technical notices, security alerts, and administrative messages
              </li>
              <li className="leading-relaxed">
                Monitor and analyze usage patterns to improve the Service
              </li>
              <li className="leading-relaxed">
                Detect, prevent, and address technical issues, fraud, or security concerns
              </li>
              <li className="leading-relaxed">Comply with legal obligations and enforce our Terms of Service</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              3. How We Share Your Information
            </h3>
            <p className="mb-3 leading-relaxed">
              We do not sell, rent, or trade your personal information. We may share
              your information only in the following limited circumstances:
            </p>
            <ul className="space-y-3 ml-5 list-disc">
              <li className="leading-relaxed">
                <strong className="text-slate-900">Service Providers:</strong> We work with trusted
                third-party vendors including Supabase (database and authentication)
                to operate our Service. These providers access your information only
                as necessary to perform services on our behalf and are contractually
                obligated to protect your data.
              </li>
              <li className="leading-relaxed">
                <strong className="text-slate-900">AI Provider - XAI (Grok):</strong> To provide
                AI-generated responses, your prompts and uploaded content are
                transmitted to XAI's Grok AI. Your content is processed
                through our Christian content filtering system to ensure biblical
                alignment. While we select providers with strong privacy practices,
                we recommend avoiding sharing highly sensitive personal information
                in your prompts.
              </li>
              <li className="leading-relaxed">
                <strong className="text-slate-900">Legal Requirements:</strong> We may disclose your
                information if required by law, such as in response to a valid
                subpoena, court order, or government request, or when necessary to
                protect our rights or safety.
              </li>
              <li className="leading-relaxed">
                <strong className="text-slate-900">Business Transfers:</strong> If we are involved in a
                merger, acquisition, or sale of assets, your information may be
                transferred as part of that transaction. We will notify you of any
                such change in ownership or control.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              4. Christian Content Filtering
            </h3>
            <p className="mb-3 leading-relaxed">
              JCIL.AI slingshot 2.0 employs a Christian content filtering system
              designed to ensure that AI-generated responses align with biblical
              principles and Christian values. This system:
            </p>
            <ul className="space-y-2 ml-5 list-disc">
              <li className="leading-relaxed">
                Analyzes user prompts and AI responses to ensure biblical alignment
              </li>
              <li className="leading-relaxed">
                Filters content that conflicts with Christian teachings and values
              </li>
              <li className="leading-relaxed">
                Promotes responses that reflect scriptural truth and godly wisdom
              </li>
              <li className="leading-relaxed">
                Is continuously updated to improve accuracy and faithfulness to biblical
                standards
              </li>
            </ul>
            <p className="mt-3 leading-relaxed">
              By using JCIL.AI slingshot 2.0, you acknowledge that all responses are
              filtered through this Christian lens and may differ from responses you
              would receive from unfiltered AI services.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              5. Security of Your Information
            </h3>
            <p className="mb-3 leading-relaxed">
              We use administrative, technical, and physical security measures to
              protect your personal information, including:
            </p>
            <ul className="space-y-2 ml-5 list-disc">
              <li className="leading-relaxed">
                Encryption of data in transit using industry-standard protocols (TLS/SSL)
              </li>
              <li className="leading-relaxed">
                Secure password hashing using modern cryptographic algorithms
              </li>
              <li className="leading-relaxed">Regular security assessments and updates</li>
              <li className="leading-relaxed">
                Access controls limiting who can view or use your information
              </li>
              <li className="leading-relaxed">
                Monitoring for unauthorized access or security breaches
              </li>
            </ul>
            <p className="mt-3 leading-relaxed">
              However, no method of transmission over the Internet or electronic storage
              is 100% secure. While we strive to use commercially acceptable means to
              protect your information, we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              6. Data Retention
            </h3>
            <p className="leading-relaxed">
              We retain your personal information for as long as your account is active
              or as needed to provide you with our Service. We will retain and use your
              information as necessary to comply with legal obligations, resolve disputes,
              and enforce our agreements. If you delete your account, we will delete or
              anonymize your personal information within a reasonable timeframe, except
              where we are required to retain it for legal purposes.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              7. File Uploads and Automatic Deletion
            </h3>
            <p className="mb-3 leading-relaxed">
              When you upload files (images, documents, or other attachments) to JCIL.AI
              slingshot 2.0, we implement an automatic deletion policy to protect your
              privacy and minimize data storage.
            </p>

            <div className="rounded-lg border border-blue-900 bg-blue-50 p-5">
              <p className="text-sm font-semibold text-blue-900 mb-2">
                Automatic Deletion After 3 Days
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                All uploaded files are automatically deleted from our servers 72 hours
                (3 days) after upload. Your conversation text and message history remain
                intact indefinitely.
              </p>
            </div>

            <h4 className="text-base font-semibold text-slate-900 mt-4 mb-2">
              How It Works
            </h4>
            <ul className="space-y-2 ml-5 list-disc">
              <li className="leading-relaxed">
                <strong className="text-slate-900">Upload:</strong> Files are stored securely for 3 days
              </li>
              <li className="leading-relaxed">
                <strong className="text-slate-900">Access:</strong> During the 3-day period, you can view
                and reference files in your conversations
              </li>
              <li className="leading-relaxed">
                <strong className="text-slate-900">Automatic Deletion:</strong> After 3 days, our system
                automatically deletes the file from storage
              </li>
              <li className="leading-relaxed">
                <strong className="text-slate-900">Message Preservation:</strong> Your message text remains,
                but the file will show as "no longer available"
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              8. Your Privacy Rights
            </h3>
            <p className="mb-3 leading-relaxed">
              Depending on your location, you may have certain rights regarding your
              personal information:
            </p>
            <ul className="space-y-2 ml-5 list-disc">
              <li className="leading-relaxed">
                <strong className="text-slate-900">Access:</strong> Request access to the personal
                information we hold about you
              </li>
              <li className="leading-relaxed">
                <strong className="text-slate-900">Correction:</strong> Request correction of inaccurate
                or incomplete information
              </li>
              <li className="leading-relaxed">
                <strong className="text-slate-900">Deletion:</strong> Request deletion of your personal
                information, subject to legal exceptions
              </li>
              <li className="leading-relaxed">
                <strong className="text-slate-900">Data Portability:</strong> Request a copy of your data
                in a structured, machine-readable format
              </li>
            </ul>
            <p className="mt-3 leading-relaxed">
              To exercise these rights, please contact us using the information provided
              below. We will respond to your request in accordance with applicable law.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              9. Children's Privacy
            </h3>
            <p className="leading-relaxed">
              Our Service is not intended for children under the age of 13. We do not
              knowingly collect personal information from children. If you are a parent
              or guardian and believe your child has provided us with personal information,
              please contact us immediately, and we will take steps to delete such
              information.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              10. Changes to This Privacy Policy
            </h3>
            <p className="leading-relaxed">
              We may update this Privacy Policy from time to time to reflect changes in
              our practices or legal requirements. We will notify you of any material
              changes by posting the new Privacy Policy on this page and updating the
              "Last updated" date. Your continued use of the Service after any changes
              constitutes your acceptance of the updated Privacy Policy.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              11. Contact Us
            </h3>
            <p className="mb-3 leading-relaxed">
              If you have any questions, concerns, or requests regarding this Privacy
              Policy or our data practices, please contact us at:
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
              By using JCIL.AI slingshot 2.0, you acknowledge that you have read,
              understood, and agree to be bound by this Privacy Policy. You also
              acknowledge that all AI responses are filtered through our Christian
              content filtering system to ensure biblical alignment.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
