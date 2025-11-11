/**
 * QUICK ESSAY WRITER
 *
 * PURPOSE:
 * - Generate well-structured academic essays
 * - Support various essay types and citation styles
 * - Deliver publication-ready essays
 */

'use client';

import { useState } from 'react';

interface QuickEssayWriterProps {
  onEssayGenerated?: (essay: string, title: string) => void;
}

export function QuickEssayWriter({ onEssayGenerated }: QuickEssayWriterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [essayType, setEssayType] = useState<'argumentative' | 'analytical' | 'expository' | 'narrative'>('analytical');
  const [wordCount, setWordCount] = useState<500 | 1000 | 1500>(1000);
  const [citations, setCitations] = useState<'none' | 'apa' | 'mla' | 'chicago'>('none');
  const [keyArguments, setKeyArguments] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedEssay, setGeneratedEssay] = useState<{ title: string; essay: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Please enter an essay topic');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedEssay(null);

    try {
      const typeDescriptions = {
        argumentative: 'presenting a clear thesis and supporting it with evidence and counterarguments',
        analytical: 'breaking down and examining a topic in depth with critical analysis',
        expository: 'explaining and informing about a topic in a clear, factual manner',
        narrative: 'telling a story with personal insights and reflective commentary',
      };

      const essayPrompt = `You are an expert academic writer. Write a ${wordCount}-word ${essayType} essay on the following topic:

**Topic:** ${topic}
**Essay Type:** ${essayType.charAt(0).toUpperCase() + essayType.slice(1)} - ${typeDescriptions[essayType]}
**Target Length:** ${wordCount} words
${citations !== 'none' ? `**Citation Style:** ${citations.toUpperCase()}` : ''}
${keyArguments ? `**Key Points to Address:** ${keyArguments}` : ''}

**Essay Requirements:**
1. Create a compelling, specific title
2. Structure with clear sections:
   - Introduction with strong thesis/hook
   - 3-5 well-developed body paragraphs
   - Each paragraph: topic sentence → evidence/analysis → transition
   - Conclusion that synthesizes main points
3. Use academic language appropriate for college-level writing
4. Include:
   - Clear thesis statement
   - Topic sentences for each paragraph
   - Smooth transitions between ideas
   - Supporting evidence and examples
   - Critical analysis and insight
5. ${citations !== 'none' ? `Include in-text citations in ${citations.toUpperCase()} format and a References/Works Cited section` : 'No citations needed'}
6. Maintain formal, objective tone (unless narrative)
7. Ensure proper grammar, spelling, and punctuation
8. Make it publication-ready and academically rigorous

**Return ONLY a JSON object (no markdown, no code blocks):**
{
  "title": "The essay title",
  "essay": "The complete essay with proper formatting and line breaks"
}`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: essayPrompt,
            },
          ],
          tool: 'essay',
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate essay');
      }

      const data = await res.json();
      let content = data.content.trim();

      // Remove markdown code blocks if present
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');

      const essayData = JSON.parse(content);

      setGeneratedEssay(essayData);

      if (onEssayGenerated) {
        onEssayGenerated(essayData.essay, essayData.title);
      }
    } catch (err) {
      console.error('Essay generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate essay');
    }

    setIsGenerating(false);
  };

  const handleCopy = () => {
    if (generatedEssay) {
      const fullEssay = `${generatedEssay.title}\n\n${generatedEssay.essay}`;
      navigator.clipboard.writeText(fullEssay);
    }
  };

  const handleSendEmail = () => {
    if (!generatedEssay) return;

    const subject = `Essay: ${generatedEssay.title}`;
    const body = `${generatedEssay.title}\n\n${generatedEssay.essay}`;

    const mailto = `mailto:${recipientEmail || ''}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    window.location.href = mailto;
  };

  const handleReset = () => {
    setGeneratedEssay(null);
    setError(null);
  };

  const handleClose = () => {
    setIsOpen(false);
    setTopic('');
    setRecipientEmail('');
    setEssayType('analytical');
    setWordCount(1000);
    setCitations('none');
    setKeyArguments('');
    setGeneratedEssay(null);
    setError(null);
  };

  return (
    <>
      {/* Essay Writer Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-lg bg-black px-3 py-2 text-xs font-medium text-white transition hover:bg-gray-800 border border-white/20"
        title="Write academic essays"
      >
        <span className="flex items-center gap-1.5">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span>Essay</span>
        </span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-4 md:py-10">
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl mx-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-white">✍️ Essay Writer</h2>
                <p className="text-sm text-gray-400 mt-1">
                  Generate academic essays with proper structure
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
            <div className="px-6 py-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {!generatedEssay ? (
                <>
                  {/* Topic */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">
                      Essay Topic <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g., The Impact of Social Media on Mental Health"
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
                      placeholder="e.g., professor@university.edu"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-400 focus:border-white/20 focus:outline-none"
                    />
                    <p className="text-xs text-gray-500">
                      Required only if you want to use the &quot;Send Email&quot; button
                    </p>
                  </div>

                  {/* Essay Type */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">
                      Essay Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['argumentative', 'analytical', 'expository', 'narrative'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setEssayType(type)}
                          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                            essayType === type
                              ? 'bg-blue-500 text-white'
                              : 'bg-white/5 text-gray-400 hover:bg-white/10'
                          }`}
                        >
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Word Count & Citations */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-300">
                        Word Count
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {([500, 1000, 1500] as const).map((count) => (
                          <button
                            key={count}
                            onClick={() => setWordCount(count)}
                            className={`rounded-lg px-2 py-2 text-xs font-medium transition ${
                              wordCount === count
                                ? 'bg-blue-500 text-white'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                          >
                            {count}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-300">
                        Citation Style
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['none', 'apa', 'mla', 'chicago'] as const).map((style) => (
                          <button
                            key={style}
                            onClick={() => setCitations(style)}
                            className={`rounded-lg px-2 py-2 text-xs font-medium transition ${
                              citations === style
                                ? 'bg-blue-500 text-white'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                          >
                            {style === 'none' ? 'None' : style.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Key Arguments */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">
                      Key Points to Address (Optional)
                    </label>
                    <textarea
                      value={keyArguments}
                      onChange={(e) => setKeyArguments(e.target.value)}
                      placeholder="List main arguments or points you want included (one per line)"
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
                    disabled={!topic.trim() || isGenerating}
                    className="w-full rounded-xl bg-blue-500 px-4 py-3 font-semibold text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {isGenerating ? 'Writing Essay...' : 'Generate Essay'}
                  </button>
                </>
              ) : (
                <>
                  {/* Generated Essay */}
                  <div className="space-y-4">
                    <div className="rounded-xl bg-white/5 p-4 border border-white/10">
                      <p className="text-xs font-semibold text-gray-400 mb-2">TITLE</p>
                      <p className="text-xl font-bold text-white">{generatedEssay.title}</p>
                    </div>

                    <div className="rounded-xl bg-white/5 p-6 border border-white/10">
                      <div className="prose prose-invert max-w-none">
                        <div className="text-sm leading-relaxed text-gray-200 whitespace-pre-wrap">
                          {generatedEssay.essay}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3">
                      <p className="text-xs text-blue-200">
                        <strong>Note:</strong> Always review and edit AI-generated essays. Add personal insights and verify all citations.
                      </p>
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
                        Copy Essay
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
