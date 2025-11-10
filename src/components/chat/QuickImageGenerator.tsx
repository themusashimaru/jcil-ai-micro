/**
 * QUICK IMAGE GENERATOR
 * Inline image generation in chat
 */

'use client';

import { useState } from 'react';

interface QuickImageGeneratorProps {
  onImageGenerated: (imageUrl: string, prompt: string) => void;
  isGenerating?: boolean;
}

export function QuickImageGenerator({ onImageGenerated, isGenerating = false }: QuickImageGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim() || loading) return;

    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          tool: 'image',
        }),
      });

      if (!response.ok) {
        throw new Error('Image generation failed');
      }

      const data = await response.json();

      if (data.url) {
        onImageGenerated(data.url, prompt);
        setPrompt('');
        setIsOpen(false);
      } else {
        throw new Error('No image URL in response');
      }
    } catch (error) {
      console.error('Image generation error:', error);
      alert(`Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group relative overflow-hidden rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 p-2 transition-all hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={isGenerating}
        aria-label="Generate image"
        title="Generate AI image"
      >
        <span className="text-xl">🎨</span>
      </button>

      {/* Popup Form */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-full max-w-md rounded-2xl border border-white/10 bg-black/95 p-4 shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎨</span>
              <h3 className="font-semibold text-white">Generate Image</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
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

          {/* Input */}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleGenerate();
              }
            }}
            placeholder="Describe the image you want to create...&#10;e.g., A serene mountain landscape at sunset with a lake"
            className="mb-3 w-full resize-none rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/30 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            rows={4}
            disabled={loading}
          />

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-white/50">
              {loading ? 'Generating...' : 'Press ⌘/Ctrl + Enter to generate'}
            </div>
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || loading}
              className="rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 text-sm font-medium text-white transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Generating...
                </span>
              ) : (
                'Generate Image'
              )}
            </button>
          </div>

          {/* Tips */}
          <div className="mt-3 rounded-lg border border-white/5 bg-white/5 p-3">
            <p className="text-xs font-medium text-white/70">💡 Tips for better images:</p>
            <ul className="mt-2 space-y-1 text-xs text-white/50">
              <li>• Be specific about style, mood, and details</li>
              <li>• Mention colors, lighting, and composition</li>
              <li>• Include artistic style (realistic, anime, oil painting, etc.)</li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
