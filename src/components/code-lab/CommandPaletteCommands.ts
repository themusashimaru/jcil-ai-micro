import { useMemo } from 'react';

export interface Command {
  id: string;
  title: string;
  description?: string;
  icon: string;
  category: 'slash' | 'git' | 'file' | 'ai' | 'settings' | 'help';
  shortcut?: string;
  action: () => void;
}

export const categoryLabels: Record<string, string> = {
  slash: 'Slash Commands',
  git: 'Git',
  ai: 'AI Actions',
  file: 'Files',
  settings: 'Settings',
  help: 'Help',
};

export function useCommands(
  onExecuteSlashCommand: (command: string) => void,
  onSendMessage: (message: string) => void
): Command[] {
  return useMemo(
    () => [
      // Slash Commands
      {
        id: 'fix',
        title: '/fix',
        description: 'Fix errors and bugs in the codebase',
        icon: '🔧',
        category: 'slash',
        shortcut: '',
        action: () => onExecuteSlashCommand('/fix'),
      },
      {
        id: 'test',
        title: '/test',
        description: 'Run tests and fix failures',
        icon: '🧪',
        category: 'slash',
        action: () => onExecuteSlashCommand('/test'),
      },
      {
        id: 'build',
        title: '/build',
        description: 'Run build and resolve errors',
        icon: '🔨',
        category: 'slash',
        action: () => onExecuteSlashCommand('/build'),
      },
      {
        id: 'commit',
        title: '/commit',
        description: 'Stage changes and create commit',
        icon: '✅',
        category: 'slash',
        action: () => onExecuteSlashCommand('/commit'),
      },
      {
        id: 'push',
        title: '/push',
        description: 'Push commits to remote',
        icon: '🚀',
        category: 'slash',
        action: () => onExecuteSlashCommand('/push'),
      },
      {
        id: 'review',
        title: '/review',
        description: 'Code review and analysis',
        icon: '👀',
        category: 'slash',
        action: () => onExecuteSlashCommand('/review'),
      },
      {
        id: 'explain',
        title: '/explain',
        description: 'Explain code architecture',
        icon: '📖',
        category: 'slash',
        action: () => onExecuteSlashCommand('/explain'),
      },
      {
        id: 'refactor',
        title: '/refactor',
        description: 'Refactor code for quality',
        icon: '♻️',
        category: 'slash',
        action: () => onExecuteSlashCommand('/refactor'),
      },
      {
        id: 'install',
        title: '/install',
        description: 'Install packages/dependencies',
        icon: '📦',
        category: 'slash',
        action: () => onExecuteSlashCommand('/install'),
      },
      {
        id: 'workspace',
        title: '/workspace',
        description: 'Enable sandbox execution mode',
        icon: '>',
        category: 'slash',
        action: () => onExecuteSlashCommand('/workspace'),
      },

      // Git Commands
      {
        id: 'git-status',
        title: 'Git: Status',
        description: 'Show git status',
        icon: '📊',
        category: 'git',
        action: () => onSendMessage('Show me the git status'),
      },
      {
        id: 'git-diff',
        title: 'Git: Diff',
        description: 'Show all changes',
        icon: '📋',
        category: 'git',
        action: () => onSendMessage('Show me the git diff'),
      },
      {
        id: 'git-log',
        title: 'Git: Log',
        description: 'Show recent commits',
        icon: '📜',
        category: 'git',
        action: () => onSendMessage('Show me the recent git log'),
      },
      {
        id: 'git-branch',
        title: 'Git: Branches',
        description: 'List all branches',
        icon: '🌿',
        category: 'git',
        action: () => onSendMessage('List all git branches'),
      },

      // AI Actions
      {
        id: 'ai-improve',
        title: 'AI: Improve Code',
        description: 'Suggest improvements for current code',
        icon: '✨',
        category: 'ai',
        action: () => onSendMessage('Review my code and suggest improvements'),
      },
      {
        id: 'ai-document',
        title: 'AI: Add Documentation',
        description: 'Generate documentation for code',
        icon: '📝',
        category: 'ai',
        action: () => onSendMessage('Add documentation comments to the code'),
      },
      {
        id: 'ai-optimize',
        title: 'AI: Optimize Performance',
        description: 'Analyze and optimize performance',
        icon: '⚡',
        category: 'ai',
        action: () => onSendMessage('Analyze this code for performance issues and optimize it'),
      },
      {
        id: 'ai-security',
        title: 'AI: Security Audit',
        description: 'Check for security vulnerabilities',
        icon: '🔒',
        category: 'ai',
        action: () => onSendMessage('Perform a security audit on this codebase'),
      },
      {
        id: 'ai-types',
        title: 'AI: Add TypeScript Types',
        description: 'Add proper TypeScript types',
        icon: '📘',
        category: 'ai',
        action: () => onSendMessage('Add proper TypeScript types to this code'),
      },
      {
        id: 'ai-tests',
        title: 'AI: Generate Tests',
        description: 'Generate unit tests',
        icon: '🧪',
        category: 'ai',
        action: () => onSendMessage('Generate comprehensive unit tests for this code'),
      },

      // File Operations
      {
        id: 'file-new',
        title: 'File: New',
        description: 'Create a new file',
        icon: '📄',
        category: 'file',
        action: () => onSendMessage('Create a new file at'),
      },
      {
        id: 'file-search',
        title: 'File: Search',
        description: 'Search files by name',
        icon: '🔍',
        category: 'file',
        action: () => onSendMessage('Search for files matching'),
      },
      {
        id: 'file-tree',
        title: 'File: Show Tree',
        description: 'Display project structure',
        icon: '🌲',
        category: 'file',
        action: () => onSendMessage('Show me the project file structure'),
      },

      // Help
      {
        id: 'help-commands',
        title: 'Help: All Commands',
        description: 'Show all available commands',
        icon: '❓',
        category: 'help',
        shortcut: '⌘/',
        action: () => onExecuteSlashCommand('/help'),
      },
      {
        id: 'help-shortcuts',
        title: 'Help: Keyboard Shortcuts',
        description: 'Show keyboard shortcuts',
        icon: '⌨️',
        category: 'help',
        action: () => onSendMessage('What keyboard shortcuts are available?'),
      },
    ],
    [onExecuteSlashCommand, onSendMessage]
  );
}
