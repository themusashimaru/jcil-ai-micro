/**
 * ESSAY WRITER TOOL
 * PURPOSE: AI-assisted essay and long-form content writing
 */

'use client';

import { ToolLauncher, type ToolConfig } from '@/components/tools/ToolLauncher';

const ESSAY_CONFIG: ToolConfig = {
  id: 'essay',
  icon: '📝',
  title: 'Essay Writer',
  description: 'Create well-structured essays, articles, and reports with AI guidance.',
  fields: [
    {
      name: 'topic',
      label: 'Topic/Thesis',
      type: 'textarea',
      placeholder: 'What is your essay about?\ne.g., The impact of artificial intelligence on modern education...',
      required: true,
      rows: 3,
    },
    {
      name: 'length',
      label: 'Word Count',
      type: 'select',
      required: true,
      options: [
        { value: '500', label: '500 words' },
        { value: '1000', label: '1000 words' },
        { value: '1500', label: '1500 words' },
        { value: '2000', label: '2000 words' },
        { value: '3000', label: '3000+ words' },
      ],
    },
    {
      name: 'style',
      label: 'Writing Style',
      type: 'select',
      required: true,
      options: [
        { value: 'academic', label: 'Academic' },
        { value: 'professional', label: 'Professional' },
        { value: 'creative', label: 'Creative' },
        { value: 'persuasive', label: 'Persuasive' },
        { value: 'expository', label: 'Expository' },
      ],
    },
    {
      name: 'citations',
      label: 'Citation Style',
      type: 'select',
      options: [
        { value: 'none', label: 'No citations' },
        { value: 'apa', label: 'APA' },
        { value: 'mla', label: 'MLA' },
        { value: 'chicago', label: 'Chicago' },
        { value: 'harvard', label: 'Harvard' },
      ],
    },
    {
      name: 'outline',
      label: 'Key Points/Outline',
      type: 'textarea',
      placeholder: 'Main points you want to cover (optional)...',
      rows: 4,
    },
  ],
  examples: [
    'Climate change solutions',
    'Social media impact on society',
    'Future of renewable energy',
  ],
};

export default function EssayWriterPage() {
  return <ToolLauncher config={ESSAY_CONFIG} />;
}
