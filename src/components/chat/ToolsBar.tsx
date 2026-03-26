/**
 * TOOLS BAR COMPONENT
 * Categorized quick access toolbar for all 52 AI tools
 */

'use client';

import { useState } from 'react';

interface Tool {
  id: string;
  icon: string;
  label: string;
  description: string;
  prompt: string;
}

interface ToolCategory {
  name: string;
  icon: string;
  color: string;
  tools: Tool[];
}

const TOOL_CATEGORIES: ToolCategory[] = [
  {
    name: 'Documents',
    icon: '📄',
    color: 'from-blue-500 to-cyan-500',
    tools: [
      {
        id: 'create_document',
        icon: '📝',
        label: 'Create PDF/DOCX',
        description: 'Generate professional documents',
        prompt: 'Create a document for me:',
      },
      {
        id: 'create_presentation',
        icon: '📊',
        label: 'Presentation',
        description: 'Build PowerPoint slides',
        prompt: 'Create a presentation about:',
      },
      {
        id: 'excel_advanced',
        icon: '📈',
        label: 'Spreadsheet',
        description: 'Generate Excel files',
        prompt: 'Create a spreadsheet with:',
      },
      {
        id: 'extract_pdf',
        icon: '📋',
        label: 'Extract PDF',
        description: 'Extract text from PDFs',
        prompt: 'Extract the content from this PDF:',
      },
      {
        id: 'convert_file',
        icon: '🔄',
        label: 'Convert File',
        description: 'Convert between formats',
        prompt: 'Convert this file:',
      },
    ],
  },
  {
    name: 'Research',
    icon: '🔍',
    color: 'from-purple-500 to-pink-500',
    tools: [
      {
        id: 'web_search',
        icon: '🌐',
        label: 'Web Search',
        description: 'Search the internet with citations',
        prompt: 'Search the web for:',
      },
      {
        id: 'browser_visit',
        icon: '🖥️',
        label: 'Visit Website',
        description: 'Read any webpage',
        prompt: 'Visit this website and summarize it:',
      },
      {
        id: 'fetch_url',
        icon: '📥',
        label: 'Fetch URL',
        description: 'Download web content',
        prompt: 'Fetch the content from:',
      },
      {
        id: 'youtube_transcript',
        icon: '▶️',
        label: 'YouTube',
        description: 'Get video transcripts',
        prompt: 'Get the transcript of this YouTube video:',
      },
    ],
  },
  {
    name: 'Code',
    icon: '💻',
    color: 'from-green-500 to-emerald-500',
    tools: [
      {
        id: 'run_code',
        icon: '▶️',
        label: 'Run Code',
        description: 'Execute code in sandbox',
        prompt: 'Run this code:',
      },
      {
        id: 'github',
        icon: '🐙',
        label: 'GitHub',
        description: 'Manage repos, PRs, issues',
        prompt: 'Help me with this GitHub task:',
      },
      {
        id: 'format_code',
        icon: '✨',
        label: 'Format',
        description: 'Format and beautify code',
        prompt: 'Format this code:',
      },
      {
        id: 'diff_compare',
        icon: '📊',
        label: 'Diff',
        description: 'Compare code versions',
        prompt: 'Compare these two code versions:',
      },
      {
        id: 'query_data_sql',
        icon: '🗃️',
        label: 'SQL Query',
        description: 'Query data with SQL',
        prompt: 'Run this SQL query:',
      },
    ],
  },
  {
    name: 'Media',
    icon: '🎨',
    color: 'from-orange-500 to-red-500',
    tools: [
      {
        id: 'transform_image',
        icon: '🖼️',
        label: 'Edit Image',
        description: 'Transform and edit images',
        prompt: 'Edit this image:',
      },
      {
        id: 'analyze_image',
        icon: '👁️',
        label: 'Analyze Image',
        description: 'Describe image contents',
        prompt: 'Analyze this image:',
      },
      {
        id: 'ocr_extract_text',
        icon: '📜',
        label: 'OCR',
        description: 'Extract text from images',
        prompt: 'Extract the text from this image:',
      },
      {
        id: 'transcribe_audio',
        icon: '🎙️',
        label: 'Transcribe',
        description: 'Audio to text',
        prompt: 'Transcribe this audio:',
      },
      {
        id: 'create_chart',
        icon: '📉',
        label: 'Chart',
        description: 'Create data visualizations',
        prompt: 'Create a chart showing:',
      },
    ],
  },
  {
    name: 'Utilities',
    icon: '🔧',
    color: 'from-amber-500 to-yellow-500',
    tools: [
      {
        id: 'generate_qr_code',
        icon: '📱',
        label: 'QR Code',
        description: 'Generate QR codes',
        prompt: 'Generate a QR code for:',
      },
      {
        id: 'zip_files',
        icon: '📦',
        label: 'Zip Files',
        description: 'Compress files',
        prompt: 'Create a zip file containing:',
      },
      {
        id: 'validate_data',
        icon: '✅',
        label: 'Validate',
        description: 'Validate data formats',
        prompt: 'Validate this data:',
      },
      {
        id: 'crypto_toolkit',
        icon: '🔐',
        label: 'Crypto',
        description: 'Encrypt/decrypt, hash',
        prompt: 'Help me with encryption:',
      },
      {
        id: 'calendar_event',
        icon: '📅',
        label: 'Calendar',
        description: 'Create calendar events',
        prompt: 'Create a calendar event for:',
      },
    ],
  },
  {
    name: 'Faith & Life',
    icon: '✝️',
    color: 'from-indigo-500 to-violet-500',
    tools: [
      {
        id: 'scripture',
        icon: '📖',
        label: 'Scripture',
        description: 'Bible study tools',
        prompt: 'Help me study this Bible passage:',
      },
      {
        id: 'translate',
        icon: '🌍',
        label: 'Translate',
        description: 'Translate languages',
        prompt: 'Translate this text:',
      },
      {
        id: 'sms',
        icon: '💬',
        label: 'SMS',
        description: 'Compose messages',
        prompt: 'Help me write a message:',
      },
      {
        id: 'shopper',
        icon: '🛒',
        label: 'Shop',
        description: 'Find and compare products',
        prompt: 'Help me find and compare:',
      },
    ],
  },
];

interface ToolsBarProps {
  onToolSelect?: (prompt: string) => void;
}

export function ToolsBar({ onToolSelect }: ToolsBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const handleToolClick = (tool: Tool) => {
    if (onToolSelect) {
      onToolSelect(tool.prompt);
    }
    setIsExpanded(false);
    setActiveCategory(null);
  };

  const totalTools = TOOL_CATEGORIES.reduce((sum, cat) => sum + cat.tools.length, 0);

  return (
    <div className="relative">
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 text-sm font-medium text-white shadow-lg transition-all hover:shadow-xl hover:scale-105"
        aria-label="Toggle tools"
      >
        <span className="text-lg">🛠️</span>
        <span className="hidden sm:inline">{totalTools} AI Tools</span>
        <svg
          className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Tools Panel */}
      {isExpanded && (
        <div className="absolute bottom-full left-0 mb-2 w-[90vw] max-w-3xl rounded-2xl border border-white/10 bg-black/95 p-4 shadow-2xl backdrop-blur-xl sm:w-auto sm:min-w-[600px]">
          {/* Header */}
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">AI Tools</h3>
              <p className="text-xs text-white/40">{totalTools} tools available — click to use</p>
            </div>
            <button
              onClick={() => {
                setIsExpanded(false);
                setActiveCategory(null);
              }}
              className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white"
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

          {/* Category Tabs */}
          <div className="mb-3 flex flex-wrap gap-2">
            {TOOL_CATEGORIES.map((category) => (
              <button
                key={category.name}
                onClick={() =>
                  setActiveCategory(activeCategory === category.name ? null : category.name)
                }
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  activeCategory === category.name
                    ? `bg-gradient-to-r ${category.color} text-white shadow-lg`
                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span>{category.icon}</span>
                <span>{category.name}</span>
                <span className="text-[10px] opacity-60">({category.tools.length})</span>
              </button>
            ))}
          </div>

          {/* Tools Grid */}
          <div className="max-h-[50vh] overflow-y-auto">
            {(activeCategory
              ? TOOL_CATEGORIES.filter((c) => c.name === activeCategory)
              : TOOL_CATEGORIES
            ).map((category) => (
              <div key={category.name} className="mb-3">
                {!activeCategory && (
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/30">
                    <span>{category.icon}</span>
                    <span>{category.name}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {category.tools.map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => handleToolClick(tool)}
                      className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-3 text-left transition-all hover:scale-[1.02] hover:border-white/20 hover:bg-white/10"
                    >
                      <div
                        className={`absolute inset-0 bg-gradient-to-br ${category.color} opacity-0 transition-opacity group-hover:opacity-10`}
                      />
                      <div className="relative">
                        <div className="mb-1 text-xl">{tool.icon}</div>
                        <div className="text-sm font-medium text-white">{tool.label}</div>
                        <div className="mt-0.5 text-[10px] text-white/40 line-clamp-1">
                          {tool.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-3 border-t border-white/10 pt-2 text-center text-[10px] text-white/30">
            Tools run automatically when needed — or click one to get started
          </div>
        </div>
      )}
    </div>
  );
}
