/**
 * IMAGE GENERATION TOOL
 * PURPOSE: AI image generation with DALL-E
 */

'use client';

import { ToolLauncher, type ToolConfig } from '@/components/tools/ToolLauncher';

const IMAGE_CONFIG: ToolConfig = {
  id: 'image',
  icon: '🎨',
  title: 'Image Generator',
  description: 'Create stunning images with AI. Describe what you want to see.',
  fields: [
    {
      name: 'prompt',
      label: 'Image Description',
      type: 'textarea',
      placeholder: 'Describe the image you want to create...\ne.g., A serene mountain landscape at sunset with a crystal-clear lake reflecting the sky...',
      required: true,
      rows: 4,
    },
    {
      name: 'style',
      label: 'Art Style',
      type: 'select',
      required: true,
      options: [
        { value: 'realistic', label: 'Realistic' },
        { value: 'digital-art', label: 'Digital Art' },
        { value: 'oil-painting', label: 'Oil Painting' },
        { value: 'watercolor', label: 'Watercolor' },
        { value: 'anime', label: 'Anime' },
        { value: 'cartoon', label: 'Cartoon' },
        { value: '3d-render', label: '3D Render' },
        { value: 'photography', label: 'Photography' },
      ],
    },
    {
      name: 'size',
      label: 'Image Size',
      type: 'select',
      required: true,
      options: [
        { value: '1024x1024', label: 'Square (1024x1024)' },
        { value: '1792x1024', label: 'Landscape (1792x1024)' },
        { value: '1024x1792', label: 'Portrait (1024x1792)' },
      ],
    },
    {
      name: 'count',
      label: 'Number of Images',
      type: 'select',
      required: true,
      options: [
        { value: '1', label: '1 image' },
        { value: '2', label: '2 images' },
        { value: '4', label: '4 images' },
      ],
    },
  ],
  examples: [
    'Futuristic city skyline at night',
    'Cute puppy playing in garden',
    'Abstract geometric pattern',
  ],
};

export default function ImageGenPage() {
  return <ToolLauncher config={IMAGE_CONFIG} />;
}
