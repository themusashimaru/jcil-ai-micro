/**
 * QUICK IMAGE GENERATOR
 * Simple selection button for image generation
 */

'use client';

interface QuickImageGeneratorProps {
  onImageGenerated: (imageUrl: string, prompt: string) => void;
  isGenerating?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}

export function QuickImageGenerator({ isGenerating = false, isSelected = false, onSelect }: QuickImageGeneratorProps) {
  return (
    <button
      onClick={onSelect}
      className={`rounded-lg px-3 py-2 text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed border whitespace-nowrap flex items-center justify-center ${
        isSelected
          ? 'bg-white text-black border-white'
          : 'bg-black text-white border-white/20 hover:bg-gray-800'
      }`}
      disabled={isGenerating}
      aria-label="Create image mode"
      title={isSelected ? "Create image mode active - describe your image" : "Select create image mode"}
    >
      {isSelected ? '✓ Create Image' : 'Create Image'}
    </button>
  );
}
