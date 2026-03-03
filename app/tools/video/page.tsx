/**
 * VIDEO CONTENT TOOL
 * PURPOSE: AI-assisted video scripting and planning
 */

'use client';

import dynamic from 'next/dynamic';
import type { ToolConfig } from '@/components/tools/ToolLauncher';

const ToolLauncher = dynamic(
  () => import('@/components/tools/ToolLauncher').then((m) => m.ToolLauncher),
  {
    loading: () => (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Loading tool...</div>
    ),
  }
);

const VIDEO_CONFIG: ToolConfig = {
  id: 'video',
  icon: '🎬',
  title: 'Video Script & Planning',
  description: 'AI-assisted video scripting, storyboarding, and content planning.',
  fields: [
    {
      name: 'prompt',
      label: 'Video Concept',
      type: 'textarea',
      placeholder:
        'Describe the video you want to plan...\ne.g., A 5-minute tutorial on setting up a React project...',
      required: true,
      rows: 4,
    },
    {
      name: 'duration',
      label: 'Target Length',
      type: 'select',
      required: true,
      options: [
        { value: 'short', label: 'Short (under 1 min)' },
        { value: 'medium', label: 'Medium (1-5 min)' },
        { value: 'long', label: 'Long (5+ min)' },
      ],
    },
    {
      name: 'style',
      label: 'Content Type',
      type: 'select',
      required: true,
      options: [
        { value: 'tutorial', label: 'Tutorial' },
        { value: 'presentation', label: 'Presentation' },
        { value: 'storytelling', label: 'Storytelling' },
        { value: 'marketing', label: 'Marketing' },
      ],
    },
  ],
  examples: [
    'Write a script for a product demo video',
    'Create a storyboard for a church announcement',
    'Plan a tutorial video for our API',
  ],
};

export default function VideoGenPage() {
  return <ToolLauncher config={VIDEO_CONFIG} />;
}
