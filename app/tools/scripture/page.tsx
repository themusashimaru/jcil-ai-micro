/**
 * SCRIPTURE STUDY TOOL
 * PURPOSE: Bible study, verse lookup, and reflection
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

const SCRIPTURE_CONFIG: ToolConfig = {
  id: 'scripture',
  icon: '📖',
  title: 'Scripture Study',
  description: 'Explore Bible verses, get insights, and deepen your faith.',
  fields: [
    {
      name: 'topic',
      label: 'Topic or Theme',
      type: 'text',
      placeholder: 'e.g., Faith, Love, Forgiveness, Strength',
      required: true,
    },
    {
      name: 'version',
      label: 'Bible Version',
      type: 'select',
      required: true,
      options: [
        { value: 'niv', label: 'NIV (New International Version)' },
        { value: 'kjv', label: 'KJV (King James Version)' },
        { value: 'esv', label: 'ESV (English Standard Version)' },
        { value: 'nlt', label: 'NLT (New Living Translation)' },
        { value: 'nkjv', label: 'NKJV (New King James Version)' },
      ],
    },
    {
      name: 'searchType',
      label: 'What are you looking for?',
      type: 'select',
      required: true,
      options: [
        { value: 'verses', label: 'Relevant Verses' },
        { value: 'study', label: 'Study & Commentary' },
        { value: 'devotional', label: 'Devotional Reflection' },
        { value: 'application', label: 'Life Application' },
      ],
    },
    {
      name: 'context',
      label: 'Additional Context',
      type: 'textarea',
      placeholder: 'Any specific situation or question? (optional)',
      rows: 3,
    },
  ],
  examples: ['Overcoming fear', "God's love", 'Finding purpose'],
};

export default function ScriptureStudyPage() {
  return <ToolLauncher config={SCRIPTURE_CONFIG} />;
}
