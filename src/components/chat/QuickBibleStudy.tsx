/**
 * QUICK BIBLE STUDY
 *
 * PURPOSE:
 * - Provide in-depth theological answers to Scripture questions
 * - Master's degree level biblical scholarship
 * - Hebrew/Greek word studies and exegesis
 * - Apologetically sound responses
 * - Deep teachings of Christ
 */

'use client';

import { useState } from 'react';

interface QuickBibleStudyProps {
  onStudyComplete?: (response: string, question: string) => void;
}

export function QuickBibleStudy({ onStudyComplete }: QuickBibleStudyProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [isStudying, setIsStudying] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleStudy = async () => {
    if (!question.trim()) {
      setError('Please enter a question about Scripture');
      return;
    }

    setIsStudying(true);
    setError(null);
    setResponse(null);

    try {
      const studyPrompt = `As a seminary-trained biblical scholar with expertise in Hebrew, Greek, systematic theology, and biblical exegesis, provide a comprehensive answer to this theological question:

${question}

Please provide:
1. **Biblical Foundation**: Cite relevant KJV Scripture passages with proper exegesis
2. **Original Languages**: Include Hebrew/Greek word studies where applicable
3. **Theological Analysis**: Engage with systematic theology, biblical theology, and historical context
4. **Christological Focus**: Connect to the teachings and person of Christ
5. **Apologetic Considerations**: Address potential objections or alternative interpretations
6. **Practical Application**: How this truth impacts Christian life and discipleship

Write at a master's degree level with theological sophistication, using proper hermeneutical principles and engaging with church tradition while remaining biblically grounded.`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: studyPrompt,
            },
          ],
          tool: 'scripture',
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to process question');
      }

      const data = await res.json();
      const answer = data.content as string;

      setResponse(answer);

      if (onStudyComplete) {
        onStudyComplete(answer, question);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process question');
    }

    setIsStudying(false);
  };

  const handleNewQuestion = () => {
    setQuestion('');
    setResponse(null);
    setError(null);
  };

  const handleClose = () => {
    setIsOpen(false);
    setQuestion('');
    setResponse(null);
    setError(null);
  };

  return (
    <>
      {/* Bible Study Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-lg bg-black px-3 py-2 text-xs font-medium text-white transition hover:bg-gray-800 border border-white/20"
        title="In-depth Bible study and theological questions"
      >
        <span className="flex items-center gap-1.5">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m-8-8h16" />
          </svg>
          <span>Bible Study</span>
        </span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-sm">
          <div className="flex justify-center px-3 pb-4 pt-20 sm:px-6 sm:pb-10">
            <div className="w-full max-w-3xl overflow-hidden rounded-t-3xl border border-white/10 bg-zinc-950/95 shadow-2xl">
              <div className="flex max-h-[85vh] flex-col">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 px-6 pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="hidden h-1.5 w-16 rounded-full bg-white/10 sm:block"
                      aria-hidden="true"
                    />
                    <h2 className="text-lg font-semibold sm:text-xl">📖 Bible Study</h2>
                  </div>
                  <button
                    onClick={handleClose}
                    className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white"
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
                <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
                  <div className="space-y-4">
                    {/* Question Input */}
                    {!response && (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-300">
                            Ask Your Theological Question
                          </label>
                          <textarea
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder="e.g., What is the biblical theology of the covenant? How does justification by faith relate to sanctification? What does Romans 8:28-30 teach about God's sovereignty?"
                            className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-white placeholder-gray-400 focus:border-white/20 focus:outline-none resize-none"
                            rows={4}
                            disabled={isStudying}
                          />
                          <p className="text-xs text-gray-500">
                            Get in-depth theological answers with Hebrew/Greek insights
                          </p>
                        </div>

                        {/* Error Message */}
                        {error && (
                          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                            {error}
                          </div>
                        )}

                        {/* Study Button */}
                        <button
                          onClick={handleStudy}
                          disabled={!question.trim() || isStudying}
                          className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-black transition hover:bg-gray-200 disabled:opacity-50"
                        >
                          {isStudying ? 'Studying Scripture...' : 'Study Scripture'}
                        </button>

                        {/* Help Text */}
                        <div className="rounded-xl bg-white/5 p-4 text-xs text-gray-400">
                          <p className="font-semibold text-gray-300 mb-2">You&apos;ll receive:</p>
                          <ul className="space-y-1 list-disc list-inside">
                            <li>Biblical foundation with KJV passages</li>
                            <li>Hebrew/Greek word studies and etymology</li>
                            <li>Theological analysis and systematic theology</li>
                            <li>Christological connections and teachings</li>
                            <li>Apologetic considerations and defense</li>
                            <li>Practical application for Christian living</li>
                          </ul>
                        </div>
                      </>
                    )}

                    {/* Response Display */}
                    {response && (
                      <>
                        <div className="rounded-xl bg-white/5 p-6 border border-white/10">
                          <p className="text-sm font-semibold text-amber-400 mb-3">
                            Question: {question}
                          </p>
                          <div className="prose prose-invert max-w-none text-sm leading-relaxed text-gray-200 whitespace-pre-line">
                            {response}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                          <button
                            onClick={handleNewQuestion}
                            className="flex-1 rounded-xl bg-white/10 px-4 py-3 font-semibold text-white transition hover:bg-white/20"
                          >
                            Ask Another Question
                          </button>
                          <button
                            onClick={handleClose}
                            className="flex-1 rounded-xl bg-white px-4 py-3 font-semibold text-black transition hover:bg-gray-200"
                          >
                            Close
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
