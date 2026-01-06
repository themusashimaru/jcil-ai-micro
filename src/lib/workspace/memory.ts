/**
 * CODE LAB PROJECT MEMORY SYSTEM
 *
 * Provides Claude Code-like project memory:
 * - CODELAB.md file for project-specific instructions
 * - Automatic context loading on session start
 * - Memory management tools
 */

export interface ProjectMemory {
  projectPath: string;
  memoryPath: string;
  content: string;
  lastUpdated: string;
  sections: MemorySection[];
}

export interface MemorySection {
  title: string;
  content: string;
  type: 'instructions' | 'context' | 'patterns' | 'preferences' | 'notes';
}

/**
 * Default CODELAB.md template
 */
export const DEFAULT_MEMORY_TEMPLATE = `# Project Memory

This file stores project-specific context and instructions for Code Lab.
The AI will automatically read this file when starting a session.

## Project Overview

<!-- Describe your project here -->

## Code Style & Conventions

<!-- Document your coding style preferences -->
- Use TypeScript for all new code
- Follow existing patterns in the codebase
- Write self-documenting code with clear variable names

## Architecture Notes

<!-- Document key architectural decisions -->

## Common Tasks

<!-- Document frequently performed tasks -->

## Preferences

<!-- Your personal preferences for how the AI should work -->
- Always run tests after making changes
- Prefer small, focused commits
- Explain changes before making them

## Do Not

<!-- Things the AI should avoid -->
- Do not modify configuration files without asking
- Do not delete files without confirmation
- Do not push to main branch directly

---
*Last updated: ${new Date().toISOString()}*
`;

/**
 * Parse CODELAB.md into sections
 */
export function parseMemorySections(content: string): MemorySection[] {
  const sections: MemorySection[] = [];
  const lines = content.split('\n');

  let currentTitle = '';
  let currentContent: string[] = [];
  let currentType: MemorySection['type'] = 'notes';

  const typeMap: Record<string, MemorySection['type']> = {
    'project overview': 'context',
    'code style': 'patterns',
    'conventions': 'patterns',
    'architecture': 'context',
    'common tasks': 'instructions',
    'preferences': 'preferences',
    'do not': 'instructions',
    'instructions': 'instructions',
    'notes': 'notes',
  };

  const saveCurrentSection = () => {
    if (currentTitle && currentContent.length > 0) {
      sections.push({
        title: currentTitle,
        content: currentContent.join('\n').trim(),
        type: currentType,
      });
    }
  };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      saveCurrentSection();
      currentTitle = line.substring(3).trim();
      currentContent = [];

      // Determine type based on title
      const lowerTitle = currentTitle.toLowerCase();
      currentType = 'notes';
      for (const [keyword, type] of Object.entries(typeMap)) {
        if (lowerTitle.includes(keyword)) {
          currentType = type;
          break;
        }
      }
    } else if (currentTitle) {
      currentContent.push(line);
    }
  }

  saveCurrentSection();

  return sections;
}

/**
 * Format memory sections into a system context string
 */
export function formatMemoryForContext(memory: ProjectMemory): string {
  if (!memory.content || memory.content.trim().length === 0) {
    return '';
  }

  const lines: string[] = [
    '---',
    'PROJECT MEMORY (from CODELAB.md):',
    '',
  ];

  // Add instructions first
  const instructions = memory.sections.filter(s => s.type === 'instructions');
  if (instructions.length > 0) {
    lines.push('**Instructions:**');
    for (const section of instructions) {
      lines.push(`\n### ${section.title}`);
      lines.push(section.content);
    }
    lines.push('');
  }

  // Add patterns/conventions
  const patterns = memory.sections.filter(s => s.type === 'patterns');
  if (patterns.length > 0) {
    lines.push('**Code Patterns:**');
    for (const section of patterns) {
      lines.push(`\n### ${section.title}`);
      lines.push(section.content);
    }
    lines.push('');
  }

  // Add preferences
  const preferences = memory.sections.filter(s => s.type === 'preferences');
  if (preferences.length > 0) {
    lines.push('**Preferences:**');
    for (const section of preferences) {
      lines.push(`\n### ${section.title}`);
      lines.push(section.content);
    }
    lines.push('');
  }

  // Add context
  const context = memory.sections.filter(s => s.type === 'context');
  if (context.length > 0) {
    lines.push('**Context:**');
    for (const section of context) {
      lines.push(`\n### ${section.title}`);
      lines.push(section.content);
    }
    lines.push('');
  }

  lines.push('---');

  return lines.join('\n');
}

/**
 * Project Memory Manager
 */
export class ProjectMemoryManager {
  private memory: ProjectMemory | null = null;
  private memoryPath = '/workspace/CODELAB.md';

  /**
   * Load project memory from file
   */
  async load(
    readFile: (path: string) => Promise<string>
  ): Promise<ProjectMemory | null> {
    try {
      const content = await readFile(this.memoryPath);
      const sections = parseMemorySections(content);

      this.memory = {
        projectPath: '/workspace',
        memoryPath: this.memoryPath,
        content,
        lastUpdated: new Date().toISOString(),
        sections,
      };

      return this.memory;
    } catch {
      // Memory file doesn't exist yet
      return null;
    }
  }

  /**
   * Create default memory file
   */
  async create(
    writeFile: (path: string, content: string) => Promise<void>
  ): Promise<ProjectMemory> {
    const content = DEFAULT_MEMORY_TEMPLATE;
    await writeFile(this.memoryPath, content);

    const sections = parseMemorySections(content);

    this.memory = {
      projectPath: '/workspace',
      memoryPath: this.memoryPath,
      content,
      lastUpdated: new Date().toISOString(),
      sections,
    };

    return this.memory;
  }

  /**
   * Update memory content
   */
  async update(
    content: string,
    writeFile: (path: string, content: string) => Promise<void>
  ): Promise<ProjectMemory> {
    await writeFile(this.memoryPath, content);

    const sections = parseMemorySections(content);

    this.memory = {
      projectPath: '/workspace',
      memoryPath: this.memoryPath,
      content,
      lastUpdated: new Date().toISOString(),
      sections,
    };

    return this.memory;
  }

  /**
   * Add a section to memory
   */
  async addSection(
    title: string,
    content: string,
    type: MemorySection['type'],
    readFile: (path: string) => Promise<string>,
    writeFile: (path: string, content: string) => Promise<void>
  ): Promise<ProjectMemory> {
    await this.load(readFile);

    if (!this.memory) {
      await this.create(writeFile);
    }

    // Add new section before the footer
    const newSection = `\n## ${title}\n\n${content}\n`;
    let updatedContent = this.memory!.content;

    // Insert before the footer (---)
    const footerIndex = updatedContent.lastIndexOf('\n---');
    if (footerIndex !== -1) {
      updatedContent = updatedContent.slice(0, footerIndex) + newSection + updatedContent.slice(footerIndex);
    } else {
      updatedContent += newSection;
    }

    // Update timestamp
    updatedContent = updatedContent.replace(
      /\*Last updated:.*\*/,
      `*Last updated: ${new Date().toISOString()}*`
    );

    return this.update(updatedContent, writeFile);
  }

  /**
   * Get current memory
   */
  getMemory(): ProjectMemory | null {
    return this.memory;
  }

  /**
   * Get formatted context for system prompt
   */
  getContextString(): string {
    if (!this.memory) return '';
    return formatMemoryForContext(this.memory);
  }
}

// Singleton instance
let memoryManager: ProjectMemoryManager | null = null;

export function getMemoryManager(): ProjectMemoryManager {
  if (!memoryManager) {
    memoryManager = new ProjectMemoryManager();
  }
  return memoryManager;
}

/**
 * Memory management tools for the workspace agent
 */
export function getMemoryTools() {
  return [
    {
      name: 'memory_read',
      description: 'Read the project memory file (CODELAB.md). This file contains project-specific instructions and context.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
    {
      name: 'memory_create',
      description: 'Create a new project memory file with the default template. Use this if CODELAB.md does not exist.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
    {
      name: 'memory_update',
      description: 'Update the project memory file with new content.',
      input_schema: {
        type: 'object' as const,
        properties: {
          content: {
            type: 'string',
            description: 'The full new content for CODELAB.md',
          },
        },
        required: ['content'],
      },
    },
    {
      name: 'memory_add_section',
      description: 'Add a new section to the project memory file.',
      input_schema: {
        type: 'object' as const,
        properties: {
          title: {
            type: 'string',
            description: 'Section title',
          },
          content: {
            type: 'string',
            description: 'Section content',
          },
          type: {
            type: 'string',
            enum: ['instructions', 'context', 'patterns', 'preferences', 'notes'],
            description: 'Type of section',
          },
        },
        required: ['title', 'content'],
      },
    },
  ];
}
