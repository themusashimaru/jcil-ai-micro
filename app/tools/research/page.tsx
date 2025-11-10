/**
 * DEEP RESEARCH TOOL
 * PURPOSE: Web research with citations and source tracking
 */

'use client';

import { ToolLauncher, type ToolConfig } from '@/components/tools/ToolLauncher';

const RESEARCH_CONFIG: ToolConfig = {
  id: 'research',
  icon: '🔍',
  title: 'Deep Research',
  description: 'Comprehensive research with web search, analysis, and citations.',
  fields: [
    {
      name: 'topic',
      label: 'Research Topic',
      type: 'textarea',
      placeholder: 'What do you want to research?\ne.g., Latest advances in quantum computing, market trends for electric vehicles...',
      required: true,
      rows: 3,
    },
    {
      name: 'depth',
      label: 'Research Depth',
      type: 'select',
      required: true,
      options: [
        { value: 'overview', label: 'Quick Overview' },
        { value: 'detailed', label: 'Detailed Analysis' },
        { value: 'comprehensive', label: 'Comprehensive Study' },
      ],
    },
    {
      name: 'sources',
      label: 'Number of Sources',
      type: 'select',
      required: true,
      options: [
        { value: '5', label: '5 sources' },
        { value: '10', label: '10 sources' },
        { value: '15', label: '15 sources' },
        { value: '20', label: '20+ sources' },
      ],
    },
    {
      name: 'focus',
      label: 'Specific Focus Areas',
      type: 'textarea',
      placeholder: 'Any specific aspects to focus on? (optional)',
      rows: 3,
    },
  ],
  examples: [
    'AI regulation policies 2024',
    'Renewable energy market analysis',
    'Modern education technology trends',
  ],
};

export default function ResearchPage() {
  return <ToolLauncher config={RESEARCH_CONFIG} />;
}
