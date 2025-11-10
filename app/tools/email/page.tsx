/**
 * EMAIL WRITER TOOL
 *
 * PURPOSE:
 * - Specialized chat context for email composition
 * - AI-assisted email writing with tone/style control
 * - Draft, edit, and refine email messages
 */

'use client';

import { ToolLauncher, type ToolConfig } from '@/components/tools/ToolLauncher';

const EMAIL_CONFIG: ToolConfig = {
  id: 'email',
  icon: '✉️',
  title: 'Email Writer',
  description: 'Draft professional emails with AI assistance. Specify recipient, subject, tone, and key points.',
  fields: [
    {
      name: 'recipient',
      label: 'Recipient',
      type: 'text',
      placeholder: 'e.g., John Smith, CEO',
      required: true,
    },
    {
      name: 'subject',
      label: 'Subject',
      type: 'text',
      placeholder: 'e.g., Project Update Q4 2024',
      required: true,
    },
    {
      name: 'keyPoints',
      label: 'Key Points',
      type: 'textarea',
      placeholder: 'What do you want to communicate?\ne.g., Progress on project milestones, budget update, next steps...',
      required: true,
      rows: 5,
    },
    {
      name: 'tone',
      label: 'Tone',
      type: 'select',
      required: true,
      options: [
        { value: 'professional', label: 'Professional' },
        { value: 'casual', label: 'Casual' },
        { value: 'formal', label: 'Formal' },
        { value: 'friendly', label: 'Friendly' },
        { value: 'direct', label: 'Direct' },
      ],
    },
    {
      name: 'length',
      label: 'Length',
      type: 'select',
      required: true,
      options: [
        { value: 'brief', label: 'Brief (2-3 paragraphs)' },
        { value: 'medium', label: 'Medium (4-5 paragraphs)' },
        { value: 'detailed', label: 'Detailed (6+ paragraphs)' },
      ],
    },
  ],
  examples: [
    'Request for project update',
    'Thank you for meeting',
    'Follow-up on proposal',
  ],
};

export default function EmailWriterPage() {
  return <ToolLauncher config={EMAIL_CONFIG} />;
}
