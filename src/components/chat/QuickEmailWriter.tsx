/**
 * QUICK EMAIL WRITER
 *
 * PURPOSE:
 * - Generate professional emails with AI assistance
 * - Support various tones and purposes
 * - Deliver polished, ready-to-send emails
 */

'use client';

import { useState } from 'react';
import { useUserProfile } from '@/contexts/UserProfileContext';

interface QuickEmailWriterProps {
  onEmailGenerated?: (email: string, subject: string) => void;
}

export function QuickEmailWriter({ onEmailGenerated }: QuickEmailWriterProps) {
  const { profile } = useUserProfile();
  const [isOpen, setIsOpen] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [purpose, setPurpose] = useState('');
  const [tone, setTone] = useState<'professional' | 'friendly' | 'formal' | 'casual'>('professional');
  const [keyPoints, setKeyPoints] = useState('');
  const [includeSignature, setIncludeSignature] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState<{ subject: string; body: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!purpose.trim()) {
      setError('Please describe the purpose of your email');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedEmail(null);

    try {
      const toneInstructions = {
        professional: 'formal but approachable, using professional language without being stiff',
        friendly: 'warm and conversational like talking to a colleague or acquaintance, casual but still respectful',
        formal: 'highly formal and business-like, suitable for executives or official correspondence',
        casual: 'relaxed and informal like chatting with a friend, keeping it brief and easy-going'
      };

      const wordLimits = {
        professional: '80-150 words',
        friendly: '60-120 words',
        formal: '100-180 words',
        casual: '50-100 words'
      };

      const emailPrompt = `You are an email writing expert. Write a ${tone} email with these details:

**Recipient:** ${recipient || 'Not specified'}
**Purpose:** ${purpose}
${keyPoints ? `**Key Points:** ${keyPoints}` : ''}

**Critical Instructions:**
1. TONE: ${toneInstructions[tone]}
2. LENGTH: Keep body to ${wordLimits[tone]} - BE CONCISE, get straight to the point
3. NO FLUFF: Skip unnecessary pleasantries, avoid long-winded explanations
4. Subject: Clear and compelling (under 8 words)
5. Structure:
   - Brief greeting
   - State purpose in 1-2 sentences
   - Key points (use bullet points with hyphens if needed)
   - Brief closing
   - Simple sign-off
6. NO em-dashes (—) - use standard hyphens (-) only
7. Make every word count - remove anything that doesn't add value

Return ONLY JSON (no markdown, no code blocks):
{
  "subject": "Subject line",
  "body": "Complete email body"
}`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: emailPrompt,
            },
          ],
          tool: 'email',
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate email');
      }

      const data = await res.json();
      let content = data.content.trim();

      // Remove markdown code blocks if present
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');

      const emailData = JSON.parse(content);

      // Remove any em-dashes that may have been generated
      emailData.body = emailData.body.replace(/—/g, '-');
      emailData.subject = emailData.subject.replace(/—/g, '-');

      // Add signature if requested and available
      if (includeSignature && profile.emailSignature) {
        // Convert markdown to plain text for mailto (email clients don't support HTML)
        const plainSignature = profile.emailSignature
          .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold markers
          .replace(/\*(.*?)\*/g, '$1');      // Remove italic markers
        emailData.body = `${emailData.body}\n\n${plainSignature}`;
      }

      setGeneratedEmail(emailData);

      if (onEmailGenerated) {
        onEmailGenerated(emailData.body, emailData.subject);
      }
    } catch (err) {
      console.error('Email generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate email');
    }

    setIsGenerating(false);
  };

  const handleCopy = () => {
    if (generatedEmail) {
      const fullEmail = `Subject: ${generatedEmail.subject}\n\n${generatedEmail.body}`;
      navigator.clipboard.writeText(fullEmail);
    }
  };

  const handleSendEmail = () => {
    if (!generatedEmail) return;

    // Create mailto link with encoded subject and body
    const mailto = `mailto:${recipientEmail || ''}?subject=${encodeURIComponent(
      generatedEmail.subject
    )}&body=${encodeURIComponent(generatedEmail.body)}`;

    // Open mailto link
    window.location.href = mailto;
  };

  const handleReset = () => {
    setGeneratedEmail(null);
    setError(null);
  };

  const handleClose = () => {
    setIsOpen(false);
    setRecipient('');
    setRecipientEmail('');
    setPurpose('');
    setKeyPoints('');
    setTone('professional');
    setIncludeSignature(true);
    setGeneratedEmail(null);
    setError(null);
  };

  return (
    <>
      {/* Email Writer Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-lg bg-black px-3 py-2 text-xs font-medium text-white transition hover:bg-gray-800 border border-white/20"
        title="Write professional emails"
      >
        <span className="flex items-center gap-1.5">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <span>Email</span>
        </span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-4 md:py-10">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl mx-4 my-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-white">📧 Email Writer</h2>
                <p className="text-sm text-gray-400 mt-1">
                  Generate professional emails in seconds
                </p>
              </div>
              <button
                onClick={handleClose}
                className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white transition"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {!generatedEmail ? (
                <>
                  {/* Recipient */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">
                      Recipient Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      placeholder="e.g., John Smith, Hiring Manager"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-400 focus:border-white/20 focus:outline-none"
                    />
                  </div>

                  {/* Recipient Email */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">
                      Recipient Email (Optional)
                    </label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="e.g., john.smith@company.com"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-400 focus:border-white/20 focus:outline-none"
                    />
                    <p className="text-xs text-gray-500">
                      Required only if you want to use the &quot;Send Email&quot; button
                    </p>
                  </div>

                  {/* Purpose */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">
                      Purpose <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      placeholder="e.g., Request a meeting, Follow up on proposal, Thank someone for interview"
                      rows={3}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-400 focus:border-white/20 focus:outline-none resize-none"
                    />
                  </div>

                  {/* Tone */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">
                      Tone
                    </label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {(['professional', 'friendly', 'formal', 'casual'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTone(t)}
                          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                            tone === t
                              ? 'bg-blue-500 text-white'
                              : 'bg-white/5 text-gray-400 hover:bg-white/10'
                          }`}
                        >
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Key Points */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">
                      Key Points (Optional)
                    </label>
                    <textarea
                      value={keyPoints}
                      onChange={(e) => setKeyPoints(e.target.value)}
                      placeholder="List important points to include (one per line)"
                      rows={3}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-400 focus:border-white/20 focus:outline-none resize-none"
                    />
                  </div>

                  {/* Include Signature Toggle */}
                  {profile.emailSignature && (
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={includeSignature}
                            onChange={(e) => setIncludeSignature(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-white/10 rounded-full peer-checked:bg-blue-500 transition-colors"></div>
                          <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-300 group-hover:text-white transition">
                            Include Email Signature
                          </span>
                          <p className="text-xs text-gray-500">
                            Append your saved signature to the email
                          </p>
                        </div>
                      </label>

                      {/* Signature Preview */}
                      {includeSignature && (
                        <div className="ml-14 rounded-xl border border-white/10 bg-white/5 p-3">
                          <p className="text-xs font-semibold text-gray-400 mb-2">SIGNATURE PREVIEW</p>
                          <div
                            className="whitespace-pre-wrap text-xs"
                            style={{ color: profile.signatureColor || '#FFFFFF' }}
                            dangerouslySetInnerHTML={{
                              __html: profile.emailSignature
                                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                                .replace(/\n/g, '<br/>'),
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                      {error}
                    </div>
                  )}

                  {/* Generate Button */}
                  <button
                    onClick={handleGenerate}
                    disabled={!purpose.trim() || isGenerating}
                    className="w-full rounded-xl bg-blue-500 px-4 py-3 font-semibold text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {isGenerating ? 'Generating Email...' : 'Generate Email'}
                  </button>
                </>
              ) : (
                <>
                  {/* Generated Email */}
                  <div className="space-y-4">
                    <div className="rounded-xl bg-white/5 p-4 border border-white/10">
                      <p className="text-xs font-semibold text-gray-400 mb-2">SUBJECT</p>
                      <p className="text-white font-medium">{generatedEmail.subject}</p>
                    </div>

                    <div className="rounded-xl bg-white/5 p-4 border border-white/10">
                      <p className="text-xs font-semibold text-gray-400 mb-3">EMAIL BODY</p>
                      <div className="text-gray-200 whitespace-pre-wrap leading-relaxed text-sm">
                        {generatedEmail.body}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-3">
                      <button
                        onClick={handleCopy}
                        className="flex-1 rounded-xl bg-white/10 px-4 py-3 font-semibold text-white hover:bg-white/20 transition flex items-center justify-center gap-2"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        Copy Email
                      </button>
                      <button
                        onClick={handleReset}
                        className="flex-1 rounded-xl bg-white/10 px-4 py-3 font-semibold text-white hover:bg-white/20 transition"
                      >
                        Write Another
                      </button>
                    </div>

                    {/* Send Email Button */}
                    <button
                      onClick={handleSendEmail}
                      className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-3 font-semibold text-white hover:from-blue-600 hover:to-purple-600 transition flex items-center justify-center gap-2"
                      title={!recipientEmail ? 'Enter recipient email to enable' : 'Open in your default email client'}
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                      {recipientEmail ? 'Send Email' : 'Send Email (Add Recipient Email)'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
