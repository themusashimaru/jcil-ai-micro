/**
 * CHAT DEMO COMPONENT
 *
 * PURPOSE:
 * - Show a realistic chat mockup on the landing page
 * - Demonstrate faith-based AI responses
 * - Blue/dark theme matching the actual chat experience
 */

'use client';

import { useState, useEffect } from 'react';
import { sanitizeHtml } from '@/lib/sanitize';

// Sample conversation demonstrating faith-based response
const DEMO_CONVERSATION = {
  question: "Who is Jesus?",
  answer: `Jesus Christ is the Son of God, the second person of the Trinity, who took on human flesh to save humanity from sin.

**Key truths about Jesus:**

• **Fully God and Fully Man** - He is the eternal Word made flesh (John 1:14), possessing both a divine and human nature

• **The Promised Messiah** - Fulfilled over 300 Old Testament prophecies about the coming Savior

• **Sinless Sacrifice** - He lived a perfect life and died on the cross as the atoning sacrifice for our sins

• **Risen Lord** - On the third day, He rose from the dead, conquering death and offering eternal life to all who believe

• **Coming King** - He ascended to Heaven and will return to judge the living and the dead

Scripture declares: *"For God so loved the world that He gave His only begotten Son, that whoever believes in Him should not perish but have everlasting life."* — John 3:16`,
};

export default function ChatDemo() {
  const [showAnswer, setShowAnswer] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    // Start animation after a short delay
    const timer = setTimeout(() => {
      setShowAnswer(true);
      setIsTyping(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!showAnswer) return;

    // Typing animation for the answer
    const fullText = DEMO_CONVERSATION.answer;
    let currentIndex = 0;

    const typingInterval = setInterval(() => {
      if (currentIndex <= fullText.length) {
        setTypedText(fullText.slice(0, currentIndex));
        currentIndex += 3; // Type 3 characters at a time for speed
      } else {
        setIsTyping(false);
        clearInterval(typingInterval);
      }
    }, 10);

    return () => clearInterval(typingInterval);
  }, [showAnswer]);

  // Parse markdown-like formatting
  // SECURITY FIX: Use sanitizeHtml to prevent XSS attacks
  const formatText = (text: string) => {
    return text.split('\n').map((line, i) => {
      // Bold text
      let formatted = line.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
      // Italic text
      formatted = formatted.replace(/\*([^*]+)\*/g, '<em class="text-slate-300 italic">$1</em>');
      // Sanitize the HTML to prevent XSS
      const safeHtml = sanitizeHtml(formatted);
      // Bullet points
      if (formatted.startsWith('•')) {
        return (
          <p key={i} className="flex items-start gap-2 my-1">
            <span className="text-blue-400 mt-0.5">•</span>
            <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(formatted.slice(1).trim()) }} />
          </p>
        );
      }
      // Scripture reference
      if (formatted.includes('—')) {
        return (
          <p key={i} className="text-right text-slate-400 mt-2 italic text-sm" dangerouslySetInnerHTML={{ __html: safeHtml }} />
        );
      }
      // Regular paragraph
      return formatted.trim() ? (
        <p key={i} className="my-2" dangerouslySetInnerHTML={{ __html: safeHtml }} />
      ) : (
        <div key={i} className="h-2" />
      );
    });
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Chat Window */}
      <div className="rounded-2xl overflow-hidden shadow-2xl shadow-blue-900/20 border border-slate-700/50">
        {/* Header */}
        <div className="bg-slate-800 px-4 py-3 flex items-center justify-between border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-medium text-sm">JCIL.AI Chat</p>
              <p className="text-slate-400 text-xs">Faith-aligned AI assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-slate-600" />
            <div className="w-3 h-3 rounded-full bg-slate-600" />
            <div className="w-3 h-3 rounded-full bg-slate-600" />
          </div>
        </div>

        {/* Chat Messages */}
        <div className="bg-gradient-to-b from-slate-900 to-slate-800 p-4 min-h-[400px] max-h-[500px] overflow-y-auto">
          {/* User Message */}
          <div className="flex justify-end mb-4">
            <div className="bg-blue-600 text-white px-4 py-2.5 rounded-2xl rounded-br-md max-w-[80%] shadow-lg">
              <p className="text-sm">{DEMO_CONVERSATION.question}</p>
            </div>
          </div>

          {/* AI Response */}
          {showAnswer && (
            <div className="flex justify-start">
              <div className="flex items-start gap-3 max-w-[90%]">
                {/* AI Avatar */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex-shrink-0 flex items-center justify-center shadow-lg">
                  <span className="text-white text-xs font-bold">AI</span>
                </div>

                {/* Message Bubble */}
                <div className="bg-slate-700/50 backdrop-blur-sm text-slate-200 px-4 py-3 rounded-2xl rounded-tl-md shadow-lg border border-slate-600/30">
                  <div className="text-sm leading-relaxed">
                    {formatText(typedText)}
                    {isTyping && (
                      <span className="inline-block w-2 h-4 bg-blue-400 ml-1 animate-pulse" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Typing Indicator (before answer shows) */}
          {!showAnswer && (
            <div className="flex justify-start">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex-shrink-0 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">AI</span>
                </div>
                <div className="bg-slate-700/50 px-4 py-3 rounded-2xl rounded-tl-md">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar (disabled/mockup) */}
        <div className="bg-slate-800 px-4 py-3 border-t border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-slate-700/50 rounded-xl px-4 py-2.5 text-slate-400 text-sm">
              Ask anything about faith, life, or the Bible...
            </div>
            <button className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white hover:bg-blue-500 transition">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Caption */}
      <p className="text-center text-slate-500 text-sm mt-4">
        Real example of JCIL.AI answering questions with Biblical truth
      </p>
    </div>
  );
}
