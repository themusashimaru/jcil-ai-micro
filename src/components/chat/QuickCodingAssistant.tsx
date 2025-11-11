/**
 * QUICK CODING ASSISTANT
 * Simple selection button for coding assistance mode
 */

'use client';

interface QuickCodingAssistantProps {
  onCodeGenerated: (response: string, request: string) => void;
  isGenerating?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}

export function QuickCodingAssistant({ isGenerating = false, isSelected = false, onSelect }: QuickCodingAssistantProps) {
  return (
    <button
      onClick={onSelect}
      className={`rounded-lg px-3 py-2 text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed border whitespace-nowrap ${
        isSelected
          ? 'bg-white text-black border-white'
          : 'bg-black text-white border-white/20 hover:bg-gray-800'
      }`}
      disabled={isGenerating}
      aria-label="Coding assistant mode"
      title={isSelected ? "Coding mode active - type your coding question" : "Select coding assistant mode"}
    >
      {isSelected ? '✓ Code' : 'Code'}
    </button>
  );
}
