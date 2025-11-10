/**
 * TRANSLATOR/SUMMARIZER TOOL
 * PURPOSE: Multi-language translation
 */

'use client';

import { ToolLauncher, type ToolConfig } from '@/components/tools/ToolLauncher';

const TRANSLATE_CONFIG: ToolConfig = {
  id: 'translate',
  icon: '🌍',
  title: 'Translator',
  description: 'Translate text between languages with AI-powered accuracy.',
  fields: [
    {
      name: 'text',
      label: 'Text to Translate',
      type: 'textarea',
      placeholder: 'Enter or paste the text you want to translate...',
      required: true,
      rows: 6,
    },
    {
      name: 'sourceLanguage',
      label: 'Source Language',
      type: 'select',
      required: true,
      options: [
        { value: 'auto', label: 'Auto-detect' },
        { value: 'en', label: 'English' },
        { value: 'es', label: 'Spanish' },
        { value: 'fr', label: 'French' },
        { value: 'de', label: 'German' },
        { value: 'it', label: 'Italian' },
        { value: 'pt', label: 'Portuguese' },
        { value: 'ru', label: 'Russian' },
        { value: 'ja', label: 'Japanese' },
        { value: 'ko', label: 'Korean' },
        { value: 'zh', label: 'Chinese (Simplified)' },
        { value: 'ar', label: 'Arabic' },
        { value: 'hi', label: 'Hindi' },
      ],
    },
    {
      name: 'targetLanguage',
      label: 'Target Language',
      type: 'select',
      required: true,
      options: [
        { value: 'en', label: 'English' },
        { value: 'es', label: 'Spanish' },
        { value: 'fr', label: 'French' },
        { value: 'de', label: 'German' },
        { value: 'it', label: 'Italian' },
        { value: 'pt', label: 'Portuguese' },
        { value: 'ru', label: 'Russian' },
        { value: 'ja', label: 'Japanese' },
        { value: 'ko', label: 'Korean' },
        { value: 'zh', label: 'Chinese (Simplified)' },
        { value: 'ar', label: 'Arabic' },
        { value: 'hi', label: 'Hindi' },
      ],
    },
    {
      name: 'tone',
      label: 'Translation Tone',
      type: 'select',
      required: true,
      options: [
        { value: 'formal', label: 'Formal' },
        { value: 'casual', label: 'Casual' },
        { value: 'literal', label: 'Literal' },
        { value: 'creative', label: 'Creative (natural flow)' },
      ],
    },
  ],
  examples: [
    'English to Spanish',
    'Japanese to English',
    'French to German',
  ],
};

export default function TranslatePage() {
  return <ToolLauncher config={TRANSLATE_CONFIG} />;
}
