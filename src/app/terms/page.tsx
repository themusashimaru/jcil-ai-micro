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
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4 dark:bg-gray-900">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Terms of Service for JCIL.AI</CardTitle>
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
            Welcome to JCIL.AI. These Terms of Service ("Terms") govern your
            access to and use of our Service. By accessing or using JCIL.AI,
            you agree to be bound by these Terms. If you do not agree, please
            do not use our Service.
          </p>

          <div className="my-4 rounded-lg border-2 border-blue-500 bg-blue-50 p-4 dark:bg-blue-950">
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
              JCIL.AI is a faith-based AI service that filters all responses
              through our Christian Filtering system to ensure biblical
              alignment. By using this Service, you acknowledge and agree to
              receive AI responses filtered through a Christian worldview.
            </p>
          </div>

          <h3>1. Acceptance of Terms</h3>
          <p>
            By creating an account, accessing, or using JCIL.AI, you represent
            that you are at least 13 years of age (or the age of majority in
            your jurisdiction) and have the legal capacity to enter into these
            Terms. If you are using the Service on behalf of an organization,
            you represent that you have authority to bind that organization to
            these Terms.
          </p>

          <h3>2. Description of Service</h3>
          <p>
            JCIL.AI is an American-made artificial intelligence chat service
            that provides AI-generated responses filtered through our
            proprietary Christian Filtering system. Our Service:
          </p>
          <ul>
            <li>
              Uses AI technology from Google (Google AI/Gemini) and Anthropic
              (Claude)
            </li>
            <li>
              Applies biblical principles and Christian values to all AI
              responses
            </li>
            <li>Allows users to upload files and images for analysis</li>
            <li>Stores chat history for registered users</li>
            <li>
              Provides specialized tools for text messaging, email writing, and
              recipe extraction
            </li>
          </ul>
          <p>
            We reserve the right to modify, suspend, or discontinue any aspect
            of the Service at any time without prior notice.
          </p>

          <h3>3. User Accounts and Registration</h3>
          <p>
            To use certain features of our Service, you must create an account.
            You agree to:
          </p>
          <ul>
            <li>
              Provide accurate, current, and complete information during
              registration
            </li>
            <li>
              Maintain and promptly update your account information to keep it
              accurate
            </li>
            <li>
              Maintain the security and confidentiality of your account password
            </li>
            <li>
              Notify us immediately of any unauthorized use of your account
            </li>
            <li>
              Accept responsibility for all activities that occur under your
              account
            </li>
          </ul>
          <p>
            You may not share your account credentials with others or allow
            others to access your account. We reserve the right to suspend or
            terminate accounts that violate these Terms.
          </p>

          <h3>4. Acceptable Use Policy</h3>
          <p>
            You agree to use JCIL.AI only for lawful purposes and in accordance
            with these Terms. You agree NOT to:
          </p>
          <ul>
            <li>
              Use the Service for any illegal, harmful, or fraudulent purposes
            </li>
            <li>
              Attempt to circumvent or disable our Christian Filtering system
            </li>
            <li>
              Upload content that is offensive, pornographic, violent, or
              promotes hatred
            </li>
            <li>
              Use the Service to harass, threaten, or harm others
            </li>
            <li>
              Violate any applicable laws, regulations, or third-party rights
            </li>
            <li>
              Attempt to gain unauthorized access to our systems or other users'
              accounts
            </li>
            <li>
              Use automated systems (bots, scrapers) to access the Service
              without permission
            </li>
            <li>
              Transmit viruses, malware, or other malicious code
            </li>
            <li>
              Reverse engineer, decompile, or attempt to extract source code
            </li>
            <li>
              Use the Service to compete with us or to develop competing
              products
            </li>
            <li>
              Remove, obscure, or alter any proprietary notices on the Service
            </li>
          </ul>
          <p>
            Violation of this Acceptable Use Policy may result in immediate
            termination of your account and legal action if necessary.
          </p>

          <h3>5. User Content</h3>
          <p>
            You retain ownership of any content you submit to JCIL.AI,
            including chat messages, prompts, and uploaded files ("User
            Content"). However, by submitting User Content, you grant us:
          </p>
          <ul>
            <li>
              A worldwide, non-exclusive, royalty-free license to use, store,
              process, and display your User Content solely to provide and
              improve the Service
            </li>
            <li>
              The right to transmit your User Content to our AI service
              providers (Google and Anthropic) for processing
            </li>
            <li>
              The right to analyze your User Content to improve our Christian
              Filtering system (in anonymized form)
            </li>
          </ul>
          <p>You represent and warrant that:</p>
          <ul>
            <li>You own or have the necessary rights to your User Content</li>
            <li>
              Your User Content does not violate any third-party rights,
              including intellectual property rights
            </li>
            <li>
              Your User Content complies with these Terms and applicable laws
            </li>
          </ul>
          <p>
            We reserve the right to remove any User Content that violates these
            Terms or is otherwise objectionable, without prior notice.
          </p>

          <h3>6. Intellectual Property Rights</h3>
          <p>
            The Service, including all content, features, functionality,
            software, text, graphics, logos, and our Christian Filtering system,
            is owned by JCIL.AI and is protected by United States and
            international copyright, trademark, and other intellectual property
            laws.
          </p>
          <p>
            AI-generated responses are provided "as-is" and we make no claims of
            ownership over them. However, these responses have been filtered
            through our proprietary Christian Filtering system, which is our
            intellectual property.
          </p>
          <p>
            You may not copy, modify, distribute, sell, or lease any part of our
            Service or included software without our express written permission.
          </p>

          <h3>7. AI-Generated Content Disclaimer</h3>
          <p>
            AI-generated responses provided by JCIL.AI are for informational and
            conversational purposes only. You acknowledge and agree that:
          </p>
          <ul>
            <li>
              AI responses may contain inaccuracies, errors, or outdated
              information
            </li>
            <li>
              AI responses should not be considered professional advice (legal,
              medical, financial, or otherwise)
            </li>
            <li>
              Our Christian Filtering system aims to provide biblically-aligned
              responses but does not replace personal Bible study, prayer, or
              pastoral guidance
            </li>
            <li>
              You are solely responsible for verifying any information and for
              any decisions you make based on AI responses
            </li>
            <li>
              We do not endorse or guarantee the accuracy of any AI-generated
              content
            </li>
          </ul>
          <p>
            For spiritual guidance, please consult your pastor, church leaders,
            or the Bible directly.
          </p>

          <h3>8. Christian Content Filtering</h3>
          <p>
            JCIL.AI employs a Christian Filtering system designed to align all
            responses with biblical principles. However:
          </p>
          <ul>
            <li>
              The filtering system is not perfect and may occasionally allow
              content that some users find objectionable
            </li>
            <li>
              Biblical interpretation varies among Christian denominations and
              traditions
            </li>
            <li>
              Our filtering reflects a conservative evangelical Christian
              worldview
            </li>
            <li>
              We do not guarantee that all responses will align with your
              personal theological beliefs
            </li>
          </ul>
          <p>
            If you encounter content you believe is inappropriate or unbiblical,
            please report it to us for review.
          </p>

          <h3>9. Third-Party Services</h3>
          <p>
            Our Service utilizes third-party AI providers (Google and Anthropic)
            and other services (Supabase). Your use of the Service is also
            subject to these third parties' terms and privacy policies. We are
            not responsible for the actions, content, or privacy practices of
            these third parties.
          </p>
          <p>
            Links to third-party websites may be provided for your convenience.
            We do not endorse and are not responsible for the content of linked
            sites.
          </p>

          <h3>10. Fees and Payment</h3>
          <p>
            Currently, JCIL.AI offers free access to our Service. We reserve the
            right to introduce paid subscription plans in the future. If we do:
          </p>
          <ul>
            <li>We will provide advance notice of any pricing changes</li>
            <li>
              Existing users may be grandfathered into certain free features
            </li>
            <li>All payments will be processed securely through third-party
              payment processors</li>
            <li>Subscription fees are non-refundable except as required by law</li>
          </ul>

          <h3>11. Privacy and Data Protection</h3>
          <p>
            Your privacy is important to us. Our collection, use, and disclosure
            of your personal information is governed by our{' '}
            <Link href="/privacy" className="text-blue-600 hover:underline dark:text-blue-400">
              Privacy Policy
            </Link>
            , which is incorporated into these Terms by reference. By using the
            Service, you consent to our Privacy Policy.
          </p>

          <h3>12. Disclaimers and Limitation of Liability</h3>
          <p className="uppercase font-semibold">
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT
            WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT
            LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
            PURPOSE, OR NON-INFRINGEMENT.
          </p>
          <p>
            We do not warrant that:
          </p>
          <ul>
            <li>The Service will be uninterrupted, secure, or error-free</li>
            <li>The results obtained from the Service will be accurate or
              reliable</li>
            <li>AI-generated content will be biblically accurate or appropriate</li>
            <li>Any errors in the Service will be corrected</li>
          </ul>
          <p className="uppercase font-semibold">
            TO THE FULLEST EXTENT PERMITTED BY LAW, JCIL.AI AND ITS AFFILIATES,
            OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR
            ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
            DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED
            DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER
            INTANGIBLE LOSSES RESULTING FROM:
          </p>
          <ul>
            <li>Your use of or inability to use the Service</li>
            <li>Any unauthorized access to or use of our servers</li>
            <li>Any interruption or cessation of transmission to or from the
              Service</li>
            <li>Any bugs, viruses, or other harmful code</li>
            <li>Any errors or omissions in any content or for any loss or damage
              incurred as a result of the use of any content posted or
              transmitted through the Service</li>
            <li>Any AI-generated content or advice</li>
          </ul>
          <p>
            IN NO EVENT SHALL OUR TOTAL LIABILITY TO YOU FOR ALL DAMAGES EXCEED
            THE AMOUNT YOU PAID TO US IN THE TWELVE (12) MONTHS PRECEDING THE
            CLAIM, OR $100, WHICHEVER IS GREATER.
          </p>

          <h3>13. Indemnification</h3>
          <p>
            You agree to indemnify, defend, and hold harmless JCIL.AI, its
            affiliates, officers, directors, employees, agents, and licensors
            from and against any claims, liabilities, damages, losses, costs,
            expenses, or fees (including reasonable attorneys' fees) arising
            from:
          </p>
          <ul>
            <li>Your use or misuse of the Service</li>
            <li>Your violation of these Terms</li>
            <li>Your violation of any rights of another party</li>
            <li>Your User Content</li>
          </ul>

          <h3>14. Termination</h3>
          <p>
            We reserve the right to suspend or terminate your access to the
            Service at any time, with or without cause, with or without notice,
            effective immediately. Reasons for termination may include:
          </p>
          <ul>
            <li>Violation of these Terms</li>
            <li>Fraudulent, abusive, or illegal activity</li>
            <li>Extended periods of inactivity</li>
            <li>Requests by law enforcement or government agencies</li>
          </ul>
          <p>
            You may terminate your account at any time by contacting us or using
            the account deletion feature (if available). Upon termination:
          </p>
          <ul>
            <li>Your right to use the Service will immediately cease</li>
            <li>We may delete your account and User Content</li>
            <li>
              Provisions of these Terms that by their nature should survive
              termination will survive (including liability limitations and
              dispute resolution)
            </li>
          </ul>

          <h3>15. Dispute Resolution and Governing Law</h3>
          <p>
            These Terms shall be governed by and construed in accordance with
            the laws of the United States and the state in which JCIL.AI is
            registered, without regard to its conflict of law provisions.
          </p>
          <p>
            Any disputes arising from these Terms or your use of the Service
            shall be resolved through binding arbitration in accordance with the
            American Arbitration Association's rules, rather than in court,
            except that you may assert claims in small claims court if your
            claims qualify.
          </p>
          <p>
            You agree to waive any right to a jury trial or to participate in a
            class action lawsuit against JCIL.AI.
          </p>

          <h3>16. Changes to Terms</h3>
          <p>
            We reserve the right to modify these Terms at any time. If we make
            material changes, we will notify you by:
          </p>
          <ul>
            <li>Posting the updated Terms on this page with a new "Last
              updated" date</li>
            <li>Sending you an email notification (if you have provided an email
              address)</li>
            <li>Displaying a notice in the Service</li>
          </ul>
          <p>
            Your continued use of the Service after changes become effective
            constitutes your acceptance of the revised Terms. If you do not
            agree to the new Terms, you must stop using the Service.
          </p>

          <h3>17. Severability</h3>
          <p>
            If any provision of these Terms is found to be invalid, illegal, or
            unenforceable, the remaining provisions shall continue in full force
            and effect. The invalid provision shall be modified to the minimum
            extent necessary to make it valid and enforceable.
          </p>

          <h3>18. Entire Agreement</h3>
          <p>
            These Terms, together with our Privacy Policy and Cookie Policy,
            constitute the entire agreement between you and JCIL.AI regarding
            the Service and supersede all prior agreements and understandings.
          </p>

          <h3>19. Contact Information</h3>
          <p>
            If you have any questions about these Terms, please contact us at:
          </p>
          <ul>
            <li>
              <strong>Email:</strong> legal@jcil.ai
            </li>
            <li>
              <strong>Website:</strong> https://jcil.ai
            </li>
          </ul>

          <h3>20. Faith-Based Service Acknowledgment</h3>
          <p>
            By using JCIL.AI, you explicitly acknowledge and agree that:
          </p>
          <ul>
            <li>
              This is a faith-based service designed to reflect Christian values
              and biblical principles
            </li>
            <li>
              All AI responses are filtered through a Christian worldview
            </li>
            <li>
              The Service is intended for users who desire biblically-aligned AI
              interactions
            </li>
            <li>
              If you do not agree with Christian values or biblical principles,
              this Service may not be suitable for you
            </li>
          </ul>

          <div className="mt-8 rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
            <p className="text-sm font-semibold">
              By using JCIL.AI, you acknowledge that you have read, understood,
              and agree to be bound by these Terms of Service. God bless you!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}