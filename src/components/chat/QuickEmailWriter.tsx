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

interface QuickEmailWriterProps {
  onEmailGenerated?: (email: string, subject: string) => void;
}

export function QuickEmailWriter({ onEmailGenerated }: QuickEmailWriterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [purpose, setPurpose] = useState('');
  const [tone, setTone] = useState<'professional' | 'friendly' | 'formal' | 'casual'>('professional');
  const [keyPoints, setKeyPoints] = useState('');
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
      const emailPrompt = `You are a professional email writing expert. Write a ${tone} email with the following details:

**Recipient:** ${recipient || 'Not specified'}
**Purpose:** ${purpose}
${keyPoints ? `**Key Points to Include:** ${keyPoints}` : ''}

**Instructions:**
1. Write a compelling, clear subject line
2. Create a well-structured email body with:
   - Professional greeting (use recipient name if provided)
   - Clear opening that states purpose
   - Organized body paragraphs (use bullet points if listing items)
   - Strong, actionable closing
   - Appropriate sign-off
3. Match the ${tone} tone throughout
4. Keep it concise but complete (150-300 words for body)
5. Ensure grammar, spelling, and punctuation are perfect
6. Make it ready to send immediately

Return ONLY a JSON object with this format (no markdown, no code blocks):
{
  "subject": "The email subject line",
  "body": "The complete email body with line breaks preserved"
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

  const handleReset = () => {
    setGeneratedEmail(null);
    setError(null);
  };

  const handleClose = () => {
    setIsOpen(false);
    setRecipient('');
    setPurpose('');
    setKeyPoints('');
    setTone('professional');
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl">
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
                      Recipient (Optional)
                    </label>
                    <input
                      type="text"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      placeholder="e.g., John Smith, Hiring Manager"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-400 focus:border-white/20 focus:outline-none"
                    />
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
                  <div className="flex gap-3">
                    <button
                      onClick={handleCopy}
                      className="flex-1 rounded-xl bg-white/10 px-4 py-3 font-semibold text-white hover:bg-white/20 transition"
                    >
                      Copy Email
                    </button>
                    <button
                      onClick={handleReset}
                      className="flex-1 rounded-xl bg-blue-500 px-4 py-3 font-semibold text-white hover:bg-blue-600 transition"
                    >
                      Write Another
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
