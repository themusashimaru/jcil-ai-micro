export interface MemoryFile {
  path: string;
  content: string;
  exists: boolean;
  lastModified?: Date;
}

export interface CodeLabMemoryEditorProps {
  memoryFile?: MemoryFile;
  onSave: (content: string) => Promise<void>;
  onLoad?: () => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

export const SECTION_TEMPLATES = [
  {
    id: 'overview',
    name: 'Project Overview',
    icon: '📋',
    content: `## Project Overview

<!-- Describe your project here -->
- **Name**:
- **Description**:
- **Tech Stack**:
`,
  },
  {
    id: 'style',
    name: 'Code Style',
    icon: '🎨',
    content: `## Code Style & Conventions

- Use TypeScript for all new code
- Follow existing patterns in the codebase
- Write self-documenting code with clear variable names
- Prefer functional components with hooks
`,
  },
  {
    id: 'instructions',
    name: 'Instructions',
    icon: '📝',
    content: `## Instructions

- Always run tests after making changes
- Prefer small, focused commits
- Explain changes before making them
- Keep dependencies up to date
`,
  },
  {
    id: 'donot',
    name: 'Do Not',
    icon: '🚫',
    content: `## Do Not

- Do not modify configuration files without asking
- Do not delete files without confirmation
- Do not push to main branch directly
- Do not expose API keys or secrets
`,
  },
  {
    id: 'architecture',
    name: 'Architecture',
    icon: '🏗️',
    content: `## Architecture Notes

<!-- Document key architectural decisions -->
-
`,
  },
  {
    id: 'tasks',
    name: 'Common Tasks',
    icon: '✅',
    content: `## Common Tasks

<!-- Document frequently performed tasks -->
- **Run tests**: \`npm test\`
- **Build**: \`npm run build\`
- **Deploy**: \`npm run deploy\`
`,
  },
];
