/**
 * VIDEO GENERATION TOOL
 * PURPOSE: AI video generation
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
  title: 'Video Generator',
  description: 'Create AI-generated videos from text prompts.',
  fields: [
    {
      name: 'prompt',
      label: 'Video Description',
      type: 'textarea',
      placeholder:
        'Describe the video you want to create...\ne.g., A time-lapse of clouds moving over a mountain range...',
      required: true,
      rows: 4,
    },
    {
      name: 'duration',
      label: 'Duration',
      type: 'select',
      required: true,
      options: [
        { value: '3', label: '3 seconds' },
        { value: '5', label: '5 seconds' },
        { value: '10', label: '10 seconds' },
      ],
    },
    {
      name: 'style',
      label: 'Video Style',
      type: 'select',
      required: true,
      options: [
        { value: 'cinematic', label: 'Cinematic' },
        { value: 'animated', label: 'Animated' },
        { value: 'realistic', label: 'Realistic' },
        { value: 'artistic', label: 'Artistic' },
      ],
    },
    {
      name: 'aspectRatio',
      label: 'Aspect Ratio',
      type: 'select',
      required: true,
      options: [
        { value: '16:9', label: '16:9 (Widescreen)' },
        { value: '9:16', label: '9:16 (Vertical)' },
        { value: '1:1', label: '1:1 (Square)' },
      ],
    },
  ],
  examples: [
    'Ocean waves crashing on shore',
    'Bustling city street time-lapse',
    'Northern lights dancing in sky',
  ],
};

export default function VideoGenPage() {
  return <ToolLauncher config={VIDEO_CONFIG} />;
}
