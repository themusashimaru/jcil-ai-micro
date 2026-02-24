/**
 * INLINE IMAGE EDIT
 *
 * Inline form for editing images within the chat flow.
 * Replaces modal approach - everything stays in the chat.
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { X, Wand2, Loader2, Upload } from 'lucide-react';
import type { GeneratedImage } from '@/app/chat/types';

interface InlineImageEditProps {
  onClose: () => void;
  onImageGenerated: (image: GeneratedImage) => void;
  conversationId?: string;
}

export function InlineImageEdit({
  onClose,
  onImageGenerated,
  conversationId,
}: InlineImageEditProps) {
  const [prompt, setPrompt] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImage(event.target?.result as string);
      setError(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || !uploadedImage || isGenerating) return;

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/create/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          images: [uploadedImage],
          conversationId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Edit failed');
      }

      // Success - pass image to parent
      onImageGenerated({
        id: data.id,
        type: 'edit',
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
      setError(err instanceof Error ? err.message : 'Edit failed');
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, uploadedImage, conversationId, onImageGenerated, onClose, isGenerating]);

  return (
    <div className="w-full max-w-lg mx-auto mb-4">
      <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-2xl p-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <Wand2 className="w-4 h-4 text-violet-400" />
            </div>
            <h3 className="text-sm font-medium text-white">Edit Image</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            aria-label="Close image editing form"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Image Upload */}
        <div className="mb-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />

          {uploadedImage ? (
            <div className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={uploadedImage}
                alt="Source"
                className="w-full h-32 object-contain rounded-xl bg-gray-800/50 border border-gray-700"
              />
              <button
                onClick={() => setUploadedImage(null)}
                className="absolute top-2 right-2 p-1 rounded-full bg-gray-900/80 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove uploaded image"
              >
                <X className="w-3 h-3" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-32 flex flex-col items-center justify-center gap-2 rounded-xl bg-gray-800/50 border border-dashed border-gray-600 hover:border-violet-500/50 hover:bg-gray-800 transition-colors"
            >
              <Upload className="w-6 h-6 text-gray-500" />
              <span className="text-xs text-gray-400">Upload image to edit</span>
            </button>
          )}
        </div>

        {/* Prompt Input */}
        <div className="mb-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the changes you want to make..."
            className="w-full h-20 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
            disabled={isGenerating}
          />
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
            disabled={!prompt.trim() || !uploadedImage || isGenerating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Editing...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Apply Edit
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
