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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Privacy Policy for JCIL.AI</CardTitle>
            <Button asChild variant="ghost" size="icon">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back to Chat</span>
              </Link>
            </Button>
          </div>
          <CardDescription>Last updated: October 29, 2025</CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <p>
            Welcome to JCIL.AI ("we," "us," or "our"). We are committed to
            protecting your privacy and handling your data responsibly. This
            Privacy Policy explains how we collect, use, disclose, and
            safeguard your information when you use our Service.
          </p>

          <div className="my-4 rounded-lg border-2 border-blue-500 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">
              JCIL.AI is an American-made service that utilizes our proprietary
              Christian Filtering system to ensure biblically-aligned responses
              in all AI conversations. We partner with leading AI providers
              (Google and Anthropic) while maintaining our commitment to
              faith-based content filtering.
            </p>
          </div>

          <h3>1. Information We Collect</h3>
          <p>
            We collect information that you provide directly to us and
            information that is automatically collected when you use our
            Service:
          </p>
          <ul>
            <li>
              <strong>Account Information:</strong> When you create an
              account, we collect your email address and store a securely
              hashed version of your password. We never store passwords in
              plain text.
            </li>
            <li>
              <strong>User Content:</strong> We collect and store all chat
              messages, prompts, and any files (including images and
              documents) that you upload to the Service. This data is
              essential for providing your chat history and processing your
              AI requests through our Christian Filtering system.
            </li>
            <li>
              <strong>Usage Data:</strong> We automatically collect certain
              information when you access the Service, including your IP
              address, browser type, device information, operating system,
              access times, and pages viewed. This helps us maintain and
              improve our Service.
            </li>
            <li>
              <strong>Cookies and Similar Technologies:</strong> We use
              cookies and similar tracking technologies to track activity on
              our Service and store certain information to enhance your
              experience.
            </li>
          </ul>

          <h3>2. How We Use Your Information</h3>
          <p>
            We use the information we collect to provide, maintain, and
            improve our Service. Specifically, we may use your information
            to:
          </p>
          <ul>
            <li>Create, maintain, and secure your account</li>
            <li>
              Provide the Service's core functionality, including storing and
              retrieving your chat history
            </li>
            <li>
              Process your prompts and uploaded files through our AI models
              with our JCIL.AI Christian Filtering system to generate
              biblically-aligned responses
            </li>
            <li>
              Apply our proprietary Christian content filtering to ensure all
              responses align with biblical principles and values
            </li>
            <li>
              Send you technical notices, security alerts, and administrative
              messages
            </li>
            <li>
              Monitor and analyze usage patterns and trends to improve the
              Service and our filtering capabilities
            </li>
            <li>
              Detect, prevent, and address technical issues, fraud, or security
              concerns
            </li>
            <li>
              Comply with legal obligations and enforce our Terms of Service
            </li>
          </ul>

          <h3>3. How We Share Your Information</h3>
          <p>
            We do not sell, rent, or trade your personal information. We may
            share your information only in the following limited circumstances:
          </p>
          <ul>
            <li>
              <strong>Third-Party Service Providers:</strong> We work with
              trusted third-party vendors to operate our Service, including
              cloud hosting providers (Supabase for database and
              authentication). These providers access your information only as
              necessary to perform services on our behalf and are contractually
              obligated to protect your data.
            </li>
            <li>
              <strong>AI Service Providers - Google and Anthropic:</strong> To
              provide AI-generated responses, your prompts and uploaded content
              are transmitted to our AI service providers, specifically Google
              (Google AI/Gemini) and Anthropic (Claude). Your content is
              processed through our American-made JCIL.AI Christian Filtering
              system both before being sent to these providers and after
              receiving their responses. This dual-layer filtering ensures that
              all AI conversations maintain biblical alignment and Christian
              values. While we select providers with strong privacy practices,
              we cannot control how Google and Anthropic process your data once
              transmitted. We recommend avoiding sharing highly sensitive
              personal information in your prompts.
            </li>
            <li>
              <strong>Legal Requirements:</strong> We may disclose your
              information if required by law, such as in response to a valid
              subpoena, court order, or government request, or when necessary to
              protect our rights, your safety, or the safety of others.
            </li>
            <li>
              <strong>Business Transfers:</strong> If we are involved in a
              merger, acquisition, or sale of assets, your information may be
              transferred as part of that transaction. We will notify you of any
              such change in ownership or control of your personal information.
            </li>
          </ul>

          <h3>4. Our Christian Filtering System</h3>
          <p>
            JCIL.AI employs a proprietary, American-made Christian Filtering
            system designed to ensure that all AI-generated responses align with
            biblical principles and Christian values. This system:
          </p>
          <ul>
            <li>
              Analyzes all user prompts before they are sent to our AI providers
              (Google and Anthropic)
            </li>
            <li>
              Filters and moderates AI responses to ensure biblical alignment
            </li>
            <li>
              Prevents content that conflicts with Christian teachings and values
            </li>
            <li>
              Promotes responses that reflect scriptural truth and godly wisdom
            </li>
            <li>
              Is continuously updated to improve accuracy and faithfulness to
              biblical standards
            </li>
          </ul>
          <p>
            By using JCIL.AI, you acknowledge that all responses are filtered
            through this Christian lens and may differ from responses you would
            receive from unfiltered AI services.
          </p>

          <h3>5. Security of Your Information</h3>
          <p>
            We use administrative, technical, and physical security measures to
            protect your personal information. These measures include:
          </p>
          <ul>
            <li>
              Encryption of data in transit using industry-standard protocols
              (TLS/SSL)
            </li>
            <li>
              Secure password hashing using modern cryptographic algorithms
            </li>
            <li>Regular security assessments and updates</li>
            <li>
              Access controls limiting who can view or use your information
            </li>
            <li>Monitoring for unauthorized access or security breaches</li>
          </ul>
          <p>
            However, no method of transmission over the Internet or electronic
            storage is 100% secure. While we strive to use commercially
            acceptable means to protect your information, we cannot guarantee
            its absolute security.
          </p>

          <h3>6. Data Retention</h3>
          <p>
            We retain your personal information for as long as your account is
            active or as needed to provide you with our Service. We will retain
            and use your information as necessary to comply with legal
            obligations, resolve disputes, and enforce our agreements.
          </p>
          <p>
            If you delete your account, we will delete or anonymize your
            personal information within a reasonable timeframe, except where we
            are required to retain it for legal or legitimate business purposes.
          </p>

          <h3>7. File Uploads and Data Retention</h3>
          <p>
            When you upload files (images, documents, or other attachments) to JCIL.AI, 
            we implement an automatic deletion policy to protect your privacy and minimize 
            data storage.
          </p>

          <div className="my-4 rounded-lg border-2 border-blue-500 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">
              ⏰ Automatic Deletion After 3 Days
            </p>
            <p className="text-sm mt-2 text-slate-700">
              All uploaded files are automatically deleted from our servers 72 hours 
              (3 days) after upload. Your conversation text and message history remain 
              intact indefinitely.
            </p>
          </div>

          <h4>How It Works</h4>
          <ul>
            <li>
              <strong>Upload:</strong> When you upload a file, it's stored securely 
              on our servers for 3 days
            </li>
            <li>
              <strong>Access:</strong> During the 3-day period, you can view and 
              reference the file in your conversations
            </li>
            <li>
              <strong>Automatic Deletion:</strong> After 3 days, our system automatically 
              deletes the file from storage
            </li>
            <li>
              <strong>Message Preservation:</strong> Your message text remains in your 
              conversation history, but the file will show as "no longer available"
            </li>
          </ul>

          <h4>What Gets Deleted vs. What Stays</h4>
          <div className="grid gap-4 md:grid-cols-2 my-4">
            <div className="rounded-lg bg-red-50 p-4">
              <p className="font-semibold text-red-900 mb-2">
                Deleted After 3 Days:
              </p>
              <ul className="text-sm space-y-1 list-none pl-0">
                <li>• Uploaded images</li>
                <li>• Document files</li>
                <li>• File attachments</li>
                <li>• Screenshots</li>
              </ul>
            </div>
            
            <div className="rounded-lg bg-green-50 p-4">
              <p className="font-semibold text-green-900 mb-2">
                Kept Indefinitely:
              </p>
              <ul className="text-sm space-y-1 list-none pl-0">
                <li>• Your message text</li>
                <li>• Conversation history</li>
                <li>• AI responses</li>
                <li>• Your account data</li>
              </ul>
            </div>
          </div>

          <h4>Why We Do This</h4>
          <ul>
            <li>
              <strong>Privacy First:</strong> Reduces the amount of personal data we 
              store, minimizing your exposure
            </li>
            <li>
              <strong>GDPR Compliance:</strong> Follows data minimization principles 
              required by European privacy law (Article 5(1)(c) and 5(1)(e))
            </li>
            <li>
              <strong>Security:</strong> Limits the window of exposure for any 
              sensitive content you may upload
            </li>
            <li>
              <strong>CCPA Compliance:</strong> Adheres to California data retention 
              best practices
            </li>
            <li>
              <strong>Cost Efficiency:</strong> Keeps storage costs low, allowing us 
              to offer competitive pricing
            </li>
          </ul>

          <p>
            If you need to retain files for longer than 3 days, we recommend downloading 
            them to your local device before the retention period expires. For business 
            or enterprise needs requiring longer retention, please contact our sales team.
          </p>

          <h3>8. Your Privacy Rights</h3>
          <p>
            Depending on your location, you may have certain rights regarding
            your personal information:
          </p>
          <ul>
            <li>
              <strong>Access:</strong> You can request access to the personal
              information we hold about you
            </li>
            <li>
              <strong>Correction:</strong> You can request that we correct
              inaccurate or incomplete information
            </li>
            <li>
              <strong>Deletion:</strong> You can request deletion of your
              personal information, subject to certain legal exceptions
            </li>
            <li>
              <strong>Data Portability:</strong> You can request a copy of your
              data in a structured, machine-readable format
            </li>
            <li>
              <strong>Opt-Out:</strong> You can opt out of certain data
              processing activities
            </li>
          </ul>
          <p>
            To exercise these rights, please contact us using the information
            provided below. We will respond to your request within a reasonable
            timeframe and in accordance with applicable law.
          </p>

          <h3>9. Children's Privacy</h3>
          <p>
            Our Service is not intended for children under the age of 13 (or the
            applicable age of consent in your jurisdiction). We do not knowingly
            collect personal information from children. If you are a parent or
            guardian and believe your child has provided us with personal
            information, please contact us immediately, and we will take steps to
            delete such information.
          </p>

          <h3>10. International Data Transfers</h3>
          <p>
            JCIL.AI is an American-made service operating primarily in the United
            States. Your information may be transferred to and processed in
            countries other than your country of residence, including the United
            States. These countries may have different data protection laws. By
            using our Service, you consent to the transfer of your information to
            these countries.
          </p>

          <h3>11. Third-Party Links</h3>
          <p>
            Our Service may contain links to third-party websites or services
            that we do not own or control. We are not responsible for the
            privacy practices of these third parties. We encourage you to review
            the privacy policies of any third-party sites you visit.
          </p>

          <h3>12. Changes to This Privacy Policy</h3>
          <p>
            We may update this Privacy Policy from time to time to reflect
            changes in our practices or legal requirements. We will notify you
            of any material changes by posting the new Privacy Policy on this
            page and updating the "Last updated" date. We encourage you to
            review this Privacy Policy periodically to stay informed about how
            we protect your information.
          </p>
          <p>
            Your continued use of the Service after any changes constitutes your
            acceptance of the updated Privacy Policy.
          </p>

          <h3>13. Contact Us</h3>
          <p>
            If you have any questions, concerns, or requests regarding this
            Privacy Policy or our data practices, please contact us at:
          </p>
          <ul>
            <li>
              <strong>Email:</strong> privacy@jcil.ai
            </li>
            <li>
              <strong>Website:</strong> https://jcil.ai
            </li>
          </ul>
          <p>
            We will make every effort to respond to your inquiry promptly and
            address any concerns you may have.
          </p>

          <div className="mt-8 rounded-lg bg-gray-100 p-4">
            <p className="text-sm font-semibold">
              By using JCIL.AI, you acknowledge that you have read, understood,
              and agree to be bound by this Privacy Policy. You also acknowledge
              that all AI responses are filtered through our Christian Filtering
              system to ensure biblical alignment, and that your data may be
              processed by Google and Anthropic as part of our AI service
              delivery.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}