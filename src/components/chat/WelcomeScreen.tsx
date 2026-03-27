'use client';

/**
 * WELCOME SCREEN
 *
 * Shown when the chat is empty. Gives users instant ways to start
 * a conversation with real, useful prompts they can click.
 *
 * Design: Clean, minimal, action-oriented. No animations that
 * delay interaction. Every element is clickable.
 */

import { memo } from 'react';

interface WelcomeScreenProps {
  userName?: string;
  onSendPrompt: (prompt: string) => void;
}

interface StarterPrompt {
  icon: string;
  label: string;
  prompt: string;
}

const STARTER_PROMPTS: StarterPrompt[] = [
  {
    icon: '📖',
    label: 'Bible study on forgiveness',
    prompt:
      'Create a Bible study guide on forgiveness. Include key Scripture passages, discussion questions, and practical applications for daily life.',
  },
  {
    icon: '📄',
    label: 'Write a professional resume',
    prompt:
      'Help me write a professional resume. Ask me about my experience and skills, then generate a polished PDF resume.',
  },
  {
    icon: '💼',
    label: 'Business plan for my idea',
    prompt:
      "Help me create a business plan. Ask me about my business idea and I'll help you build a professional plan with market analysis, financial projections, and strategy.",
  },
  {
    icon: '🔍',
    label: 'Research a topic with sources',
    prompt:
      'I need to research a topic. Search the web and give me a comprehensive summary with cited sources.',
  },
  {
    icon: '📊',
    label: 'Create a spreadsheet',
    prompt: 'Help me create a professional Excel spreadsheet. What data do you need to organize?',
  },
  {
    icon: '✍️',
    label: 'Draft a letter or email',
    prompt: "Help me draft a professional letter. What's the purpose and who is the recipient?",
  },
  {
    icon: '🎯',
    label: 'Plan a church event',
    prompt:
      'Help me plan a church event. I need a timeline, budget, volunteer assignments, and promotional materials.',
  },
  {
    icon: '💻',
    label: 'Help me with code',
    prompt: 'I need help with a coding project. What language and what are you trying to build?',
  },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export const WelcomeScreen = memo(function WelcomeScreen({
  userName,
  onSendPrompt,
}: WelcomeScreenProps) {
  const greeting = getGreeting();
  const displayName = userName ? `, ${userName.split(' ')[0]}` : '';

  return (
    <div className="flex flex-col flex-1 min-h-0 px-4 py-8">
      {/* Top spacer */}
      <div className="flex-1 min-h-[10vh]" />

      {/* Greeting */}
      <div className="text-center mb-8 max-w-2xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-semibold text-white mb-2">
          {greeting}
          {displayName}
        </h1>
        <p className="text-sm text-white/40">Ask me anything, or try one of these to get started</p>
      </div>

      {/* Conversation Starters Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl mx-auto w-full mb-8">
        {STARTER_PROMPTS.map((starter) => (
          <button
            key={starter.label}
            onClick={() => onSendPrompt(starter.prompt)}
            className="group flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3.5 text-left transition-all hover:bg-white/[0.06] hover:border-white/20"
          >
            <span className="text-lg flex-shrink-0 mt-0.5">{starter.icon}</span>
            <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors leading-snug">
              {starter.label}
            </span>
          </button>
        ))}
      </div>

      {/* Bottom spacer */}
      <div className="flex-1 min-h-[5vh]" />

      {/* Subtle footer */}
      <div className="text-center pb-2">
        <p className="text-[10px] text-white/20">
          Powered by Claude Opus 4.6 &middot; 52 AI tools &middot; Christian values
        </p>
      </div>
    </div>
  );
});
