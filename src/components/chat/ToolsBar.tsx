/**
 * TOOLS BAR COMPONENT
 * Quick access toolbar for AI tools
 */

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Tool {
  id: string;
  icon: string;
  label: string;
  color: string;
  description: string;
}

const TOOLS: Tool[] = [
  {
    id: 'code',
    icon: '💻',
    label: 'Code',
    color: 'from-blue-500 to-cyan-500',
    description: 'Generate, debug, and optimize code',
  },
  {
    id: 'research',
    icon: '🔍',
    label: 'Research',
    color: 'from-purple-500 to-pink-500',
    description: 'Deep web research with citations',
  },
  {
    id: 'image',
    icon: '🎨',
    label: 'Image',
    color: 'from-orange-500 to-red-500',
    description: 'Generate AI images',
  },
  {
    id: 'video',
    icon: '🎬',
    label: 'Video',
    color: 'from-green-500 to-emerald-500',
    description: 'Create AI videos',
  },
  {
    id: 'email',
    icon: '✉️',
    label: 'Email',
    color: 'from-indigo-500 to-blue-500',
    description: 'Draft professional emails',
  },
  {
    id: 'essay',
    icon: '📝',
    label: 'Essay',
    color: 'from-violet-500 to-purple-500',
    description: 'Write essays and articles',
  },
  {
    id: 'sms',
    icon: '💬',
    label: 'SMS',
    color: 'from-teal-500 to-cyan-500',
    description: 'Compose text messages',
  },
  {
    id: 'translate',
    icon: '🌍',
    label: 'Translate',
    color: 'from-sky-500 to-blue-500',
    description: 'Translate languages',
  },
  {
    id: 'shopper',
    icon: '🛒',
    label: 'Shop',
    color: 'from-pink-500 to-rose-500',
    description: 'Find and compare products',
  },
  {
    id: 'scripture',
    icon: '📖',
    label: 'Scripture',
    color: 'from-amber-500 to-yellow-500',
    description: 'Study Bible verses',
  },
  {
    id: 'data',
    icon: '📊',
    label: 'Data',
    color: 'from-emerald-500 to-green-500',
    description: 'Analyze data and charts',
  },
];

export function ToolsBar() {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToolClick = (toolId: string) => {
    router.push(`/tools/${toolId}`);
  };

  return (
    <div className="relative">
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 text-sm font-medium text-white shadow-lg transition-all hover:shadow-xl hover:scale-105"
        aria-label="Toggle tools"
      >
        <span className="text-lg">🛠️</span>
        <span className="hidden sm:inline">AI Tools</span>
        <svg
          className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Tools Grid */}
      {isExpanded && (
        <div className="absolute bottom-full left-0 mb-2 w-[90vw] max-w-2xl rounded-2xl border border-white/10 bg-black/95 p-4 shadow-2xl backdrop-blur-xl sm:w-auto sm:min-w-[500px]">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Choose an AI Tool</h3>
            <button
              onClick={() => setIsExpanded(false)}
              className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white flex items-center justify-center"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Tools Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {TOOLS.map((tool) => (
              <button
                key={tool.id}
                onClick={() => {
                  handleToolClick(tool.id);
                  setIsExpanded(false);
                }}
                className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4 text-left transition-all hover:scale-105 hover:border-white/20 hover:bg-white/10"
              >
                {/* Gradient Background */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${tool.color} opacity-0 transition-opacity group-hover:opacity-20`}
                />

                {/* Content */}
                <div className="relative">
                  <div className="mb-2 text-3xl">{tool.icon}</div>
                  <div className="font-semibold text-white">{tool.label}</div>
                  <div className="mt-1 text-xs text-white/50 line-clamp-2">
                    {tool.description}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-4 border-t border-white/10 pt-3 text-center text-xs text-white/50">
            Click any tool to get started
          </div>
        </div>
      )}
    </div>
  );
}
