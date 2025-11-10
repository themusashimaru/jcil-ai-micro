/**
 * SMS WRITER TOOL
 * PURPOSE: AI-assisted SMS/text message composition
 */

'use client';

import { ToolLauncher, type ToolConfig } from '@/components/tools/ToolLauncher';

const SMS_CONFIG: ToolConfig = {
  id: 'sms',
  icon: '💬',
  title: 'SMS Writer',
  description: 'Compose clear, concise text messages for any situation.',
  fields: [
    {
      name: 'recipient',
      label: 'Recipient',
      type: 'text',
      placeholder: 'e.g., Mom, Boss, Friend',
      required: true,
    },
    {
      name: 'purpose',
      label: 'Purpose',
      type: 'textarea',
      placeholder: 'What do you need to communicate?\ne.g., Confirming dinner plans, asking for time off, checking in...',
      required: true,
      rows: 3,
    },
    {
      name: 'tone',
      label: 'Tone',
      type: 'select',
      required: true,
      options: [
        { value: 'casual', label: 'Casual' },
        { value: 'friendly', label: 'Friendly' },
        { value: 'professional', label: 'Professional' },
        { value: 'formal', label: 'Formal' },
        { value: 'urgent', label: 'Urgent' },
      ],
    },
    {
      name: 'length',
      label: 'Message Length',
      type: 'select',
      required: true,
      options: [
        { value: 'short', label: 'Short (1 SMS, ~160 chars)' },
        { value: 'medium', label: 'Medium (2-3 messages)' },
        { value: 'long', label: 'Long (detailed)' },
      ],
    },
  ],
  examples: [
    'Running late to meeting',
    'Thank you for dinner',
    'Confirm appointment',
  ],
};

export default function SMSWriterPage() {
  return <ToolLauncher config={SMS_CONFIG} />;
}
