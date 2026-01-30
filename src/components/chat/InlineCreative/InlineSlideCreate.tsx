/**
 * INLINE SLIDE CREATE
 *
 * Inline form for creating presentation slides within the chat flow.
 * Uses FLUX.2 to generate horizontal 16:9 images perfect for presentations.
 */

'use client';

import { useState, useCallback } from 'react';
import { X, Presentation, Loader2, Sparkles } from 'lucide-react';
import type { GeneratedImage } from '@/app/chat/types';

interface InlineSlideCreateProps {
  onClose: () => void;
  onSlideGenerated: (slide: GeneratedImage) => void;
  conversationId?: string;
}

// Slide templates for quick prompts
const SLIDE_TEMPLATES = [
  {
    id: 'title',
    label: 'Title Slide',
    prompt: 'Professional title slide with modern gradient background',
  },
  {
    id: 'content',
    label: 'Content Slide',
    prompt: 'Clean presentation slide layout with space for text',
  },
  {
    id: 'chart',
    label: 'Chart/Data',
    prompt: 'Professional data visualization presentation slide',
  },
  {
    id: 'quote',
    label: 'Quote Slide',
    prompt: 'Elegant quote presentation slide with subtle background',
  },
];

export function InlineSlideCreate({
  onClose,
  onSlideGenerated,
  conversationId,
}: InlineSlideCreateProps) {
  const [prompt, setPrompt] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTemplateSelect = useCallback((templateId: string) => {
    const template = SLIDE_TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      setSelectedTemplate(templateId);
      setPrompt(template.prompt);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/create/slide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          conversationId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Slide generation failed');
      }

      // Success - pass slide to parent
      onSlideGenerated({
        id: data.id,
        type: 'create',
        imageUrl: data.imageUrl,
        prompt: data.prompt,
        enhancedPrompt: data.enhancedPrompt,
        dimensions: data.dimensions,
        model: data.model,
        seed: data.seed,
        verification: data.verification,
      });

      // Close the inline form
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Slide generation failed');
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, conversationId, onSlideGenerated, onClose, isGenerating]);

  return (
    <div className="w-full max-w-lg mx-auto mb-4">
      <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-2xl p-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Presentation className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">Create Slide</h3>
              <p className="text-[10px] text-gray-500">16:9 presentation format</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Template Selection */}
        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-2">Quick templates</p>
          <div className="flex gap-2 flex-wrap">
            {SLIDE_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => handleTemplateSelect(template.id)}
                disabled={isGenerating}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedTemplate === template.id
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'bg-gray-800/50 text-gray-400 border border-gray-700 hover:bg-gray-800'
                }`}
              >
                {template.label}
              </button>
            ))}
          </div>
        </div>

        {/* Prompt Input */}
        <div className="mb-4">
          <textarea
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              setSelectedTemplate(null);
            }}
            placeholder="Describe your slide... e.g., 'Modern tech startup pitch deck title slide with blue gradient'"
            className="w-full h-24 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
            disabled={isGenerating}
          />
        </div>

        {/* Preview box showing 16:9 aspect */}
        <div className="mb-4">
          <div className="aspect-video w-full max-w-xs mx-auto rounded-lg bg-gray-800/30 border border-gray-700 border-dashed flex items-center justify-center">
            <span className="text-[10px] text-gray-500">16:9 slide preview</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Create Slide
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
