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
        className="rounded-lg bg-black px-3 py-2 text-xs font-medium text-white transition hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed border border-white/20 whitespace-nowrap"
        disabled={isGenerating}
        aria-label="Generate image"
        title="Generate AI image"
      >
        Image
      </button>

      {/* Popup Form */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
          <div className="relative mx-4 w-full max-w-lg rounded-2xl border border-white/10 bg-black/95 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Create AI Image</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
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
              placeholder="Describe the image you want to create...&#10;Example: A serene mountain landscape at sunset with a lake"
              className="mb-4 w-full resize-none rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:border-white/40 focus:outline-none"
              rows={3}
              disabled={loading}
              autoFocus
            />

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim() || loading}
                className="rounded-lg bg-white px-6 py-2 text-sm font-semibold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
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
                  'Generate'
                )}
              </button>
            </div>

            {/* Tip */}
            <p className="mt-4 text-xs text-white/50">
              💡 Tip: Be specific about style, colors, and mood for best results
            </p>
          </div>
        </div>
      )}
    </>
  );
}
