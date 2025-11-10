/**
 * CODING ASSISTANT TOOL
 * PURPOSE: Code generation, debugging, and refactoring assistance
 */

'use client';

import { ToolLauncher, type ToolConfig } from '@/components/tools/ToolLauncher';

const CODE_CONFIG: ToolConfig = {
  id: 'code',
  icon: '💻',
  title: 'Coding Assistant',
  description: 'Generate, debug, and refactor code with AI assistance. Supports 20+ languages.',
  fields: [
    {
      name: 'language',
      label: 'Language/Framework',
      type: 'select',
      required: true,
      options: [
        { value: 'javascript', label: 'JavaScript' },
        { value: 'typescript', label: 'TypeScript' },
        { value: 'python', label: 'Python' },
        { value: 'react', label: 'React' },
        { value: 'nextjs', label: 'Next.js' },
        { value: 'vue', label: 'Vue.js' },
        { value: 'node', label: 'Node.js' },
        { value: 'java', label: 'Java' },
        { value: 'csharp', label: 'C#' },
        { value: 'cpp', label: 'C++' },
        { value: 'go', label: 'Go' },
        { value: 'rust', label: 'Rust' },
        { value: 'php', label: 'PHP' },
        { value: 'ruby', label: 'Ruby' },
        { value: 'swift', label: 'Swift' },
        { value: 'kotlin', label: 'Kotlin' },
        { value: 'sql', label: 'SQL' },
        { value: 'html-css', label: 'HTML/CSS' },
        { value: 'bash', label: 'Bash/Shell' },
        { value: 'other', label: 'Other' },
      ],
    },
    {
      name: 'task',
      label: 'What do you need?',
      type: 'select',
      required: true,
      options: [
        { value: 'generate', label: 'Generate new code' },
        { value: 'debug', label: 'Debug/fix code' },
        { value: 'refactor', label: 'Refactor/improve code' },
        { value: 'explain', label: 'Explain code' },
        { value: 'optimize', label: 'Optimize performance' },
        { value: 'test', label: 'Write tests' },
        { value: 'document', label: 'Add documentation' },
        { value: 'convert', label: 'Convert/translate code' },
      ],
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      placeholder: 'Describe what you want to build or the problem you\'re facing...\ne.g., Create a React component for a responsive navbar with dropdown menus...',
      required: true,
      rows: 6,
    },
    {
      name: 'codeStyle',
      label: 'Code Style',
      type: 'select',
      required: true,
      options: [
        { value: 'modern', label: 'Modern/Best Practices' },
        { value: 'functional', label: 'Functional Programming' },
        { value: 'oop', label: 'Object-Oriented' },
        { value: 'minimal', label: 'Minimal/Simple' },
        { value: 'enterprise', label: 'Enterprise/Scalable' },
      ],
    },
    {
      name: 'documentation',
      label: 'Documentation Level',
      type: 'select',
      required: true,
      options: [
        { value: 'none', label: 'No comments' },
        { value: 'minimal', label: 'Minimal comments' },
        { value: 'standard', label: 'Standard documentation' },
        { value: 'comprehensive', label: 'Comprehensive JSDoc/docstrings' },
      ],
    },
    {
      name: 'requirements',
      label: 'Additional Requirements',
      type: 'textarea',
      placeholder: 'Any specific requirements, constraints, or context? (optional)\ne.g., Must use TypeScript strict mode, needs to work with existing API, follow company style guide...',
      rows: 3,
    },
  ],
  examples: [
    'React authentication form',
    'Python data processing script',
    'REST API with Express',
  ],
};

export default function CodingAssistantPage() {
  return <ToolLauncher config={CODE_CONFIG} />;
}
