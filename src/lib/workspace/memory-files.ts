/**
 * CLAUDE.md MEMORY FILES
 *
 * Claude Code-compatible memory file system.
 * Provides hierarchical project context through CLAUDE.md files.
 *
 * Features:
 * - Hierarchical discovery (workspace, parent directories, home)
 * - @include directives for importing other files
 * - Automatic injection into system prompts
 * - Support for both CLAUDE.md and CODELAB.md (backwards compatibility)
 */

import { logger } from '@/lib/logger';
import * as path from 'path';

const log = logger('MemoryFiles');

// ============================================================================
// TYPES
// ============================================================================

export interface MemoryFile {
  path: string;
  content: string;
  source: 'workspace' | 'parent' | 'home' | 'include';
  priority: number; // Lower = higher priority
}

export interface MemoryContext {
  files: MemoryFile[];
  combinedContent: string;
  includes: Map<string, string>; // path -> content
  loadedAt: Date;
}

export interface MemoryLoadOptions {
  workspaceRoot: string;
  maxDepth?: number;
  maxFileSize?: number;
  maxTotalSize?: number;
  includeParentDirs?: boolean;
  includeHomeDir?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MEMORY_FILENAMES = ['CLAUDE.md', 'CODELAB.md', '.claude.md'];
const MAX_FILE_SIZE = 100 * 1024; // 100KB per file
const MAX_TOTAL_SIZE = 500 * 1024; // 500KB total
const MAX_INCLUDE_DEPTH = 5;
const INCLUDE_DIRECTIVE_REGEX = /@include\s+([^\s]+)/g;

// ============================================================================
// MEMORY FILE LOADER
// ============================================================================

export class MemoryFileLoader {
  private readFile: (path: string) => Promise<string>;
  private fileExists: (path: string) => Promise<boolean>;

  constructor(
    readFile: (path: string) => Promise<string>,
    fileExists: (path: string) => Promise<boolean>,
    _listDir: (path: string) => Promise<string[]> // Reserved for future use
  ) {
    this.readFile = readFile;
    this.fileExists = fileExists;
  }

  /**
   * Load all memory files for a workspace
   */
  async loadMemoryContext(options: MemoryLoadOptions): Promise<MemoryContext> {
    const {
      workspaceRoot,
      maxDepth = 10,
      includeParentDirs = true,
      includeHomeDir = true,
    } = options;

    const files: MemoryFile[] = [];
    const includes = new Map<string, string>();
    let totalSize = 0;

    // 1. Load workspace-level memory file (highest priority)
    const workspaceMemory = await this.findMemoryFile(workspaceRoot);
    if (workspaceMemory) {
      const { content, processedContent } = await this.processMemoryFile(
        workspaceMemory.path,
        workspaceMemory.content,
        includes,
        workspaceRoot
      );
      files.push({
        path: workspaceMemory.path,
        content: processedContent,
        source: 'workspace',
        priority: 0,
      });
      totalSize += content.length;
    }

    // 2. Load parent directory memory files
    if (includeParentDirs) {
      let currentDir = path.dirname(workspaceRoot);
      let depth = 0;

      while (depth < maxDepth && currentDir !== path.dirname(currentDir)) {
        if (totalSize >= MAX_TOTAL_SIZE) break;

        const parentMemory = await this.findMemoryFile(currentDir);
        if (parentMemory && parentMemory.content.length + totalSize <= MAX_TOTAL_SIZE) {
          const { content, processedContent } = await this.processMemoryFile(
            parentMemory.path,
            parentMemory.content,
            includes,
            currentDir
          );
          files.push({
            path: parentMemory.path,
            content: processedContent,
            source: 'parent',
            priority: depth + 1,
          });
          totalSize += content.length;
        }

        currentDir = path.dirname(currentDir);
        depth++;
      }
    }

    // 3. Load home directory memory file (lowest priority)
    if (includeHomeDir && totalSize < MAX_TOTAL_SIZE) {
      const homeDir = process.env.HOME || '/root';
      const homeMemory = await this.findMemoryFile(homeDir);
      if (homeMemory && homeMemory.content.length + totalSize <= MAX_TOTAL_SIZE) {
        const { processedContent } = await this.processMemoryFile(
          homeMemory.path,
          homeMemory.content,
          includes,
          homeDir
        );
        files.push({
          path: homeMemory.path,
          content: processedContent,
          source: 'home',
          priority: 100,
        });
      }
    }

    // Sort by priority (lower = higher priority)
    files.sort((a, b) => a.priority - b.priority);

    // Combine content
    const combinedContent = this.combineMemoryFiles(files);

    return {
      files,
      combinedContent,
      includes,
      loadedAt: new Date(),
    };
  }

  /**
   * Find a memory file in a directory
   */
  private async findMemoryFile(dir: string): Promise<{ path: string; content: string } | null> {
    for (const filename of MEMORY_FILENAMES) {
      const filePath = path.join(dir, filename);
      try {
        if (await this.fileExists(filePath)) {
          const content = await this.readFile(filePath);
          if (content.length <= MAX_FILE_SIZE) {
            log.debug('Found memory file', { path: filePath, size: content.length });
            return { path: filePath, content };
          } else {
            log.warn('Memory file too large, skipping', { path: filePath, size: content.length });
          }
        }
      } catch {
        // File doesn't exist or can't be read, continue
      }
    }
    return null;
  }

  /**
   * Process a memory file, expanding @include directives
   */
  private async processMemoryFile(
    filePath: string,
    content: string,
    includes: Map<string, string>,
    baseDir: string,
    depth: number = 0
  ): Promise<{ content: string; processedContent: string }> {
    if (depth >= MAX_INCLUDE_DEPTH) {
      log.warn('Max include depth reached', { filePath, depth });
      return { content, processedContent: content };
    }

    let processedContent = content;
    const matches = [...content.matchAll(INCLUDE_DIRECTIVE_REGEX)];

    for (const match of matches) {
      const includePath = match[1];
      const fullIncludePath = path.isAbsolute(includePath)
        ? includePath
        : path.join(baseDir, includePath);

      if (includes.has(fullIncludePath)) {
        // Already included, prevent circular includes
        processedContent = processedContent.replace(
          match[0],
          `<!-- Already included: ${includePath} -->`
        );
        continue;
      }

      try {
        if (await this.fileExists(fullIncludePath)) {
          const includeContent = await this.readFile(fullIncludePath);

          if (includeContent.length <= MAX_FILE_SIZE) {
            includes.set(fullIncludePath, includeContent);

            // Recursively process includes in the included file
            const { processedContent: nestedProcessed } = await this.processMemoryFile(
              fullIncludePath,
              includeContent,
              includes,
              path.dirname(fullIncludePath),
              depth + 1
            );

            // Replace the @include directive with the content
            processedContent = processedContent.replace(
              match[0],
              `<!-- Included: ${includePath} -->\n${nestedProcessed}\n<!-- End: ${includePath} -->`
            );
          } else {
            processedContent = processedContent.replace(
              match[0],
              `<!-- Include skipped (too large): ${includePath} -->`
            );
          }
        } else {
          processedContent = processedContent.replace(
            match[0],
            `<!-- Include not found: ${includePath} -->`
          );
        }
      } catch (error) {
        log.warn('Failed to process include', { path: fullIncludePath, error });
        processedContent = processedContent.replace(
          match[0],
          `<!-- Include error: ${includePath} -->`
        );
      }
    }

    return { content, processedContent };
  }

  /**
   * Combine memory files into a single context string
   */
  private combineMemoryFiles(files: MemoryFile[]): string {
    if (files.length === 0) return '';

    const sections: string[] = [];

    sections.push('---');
    sections.push('# Project Memory');
    sections.push('');
    sections.push('The following context has been loaded from CLAUDE.md files:');
    sections.push('');

    for (const file of files) {
      const sourceLabel = this.getSourceLabel(file.source);
      sections.push(`## ${sourceLabel}`);
      sections.push(`<!-- From: ${file.path} -->`);
      sections.push('');
      sections.push(file.content);
      sections.push('');
    }

    sections.push('---');

    return sections.join('\n');
  }

  /**
   * Get human-readable label for memory source
   */
  private getSourceLabel(source: MemoryFile['source']): string {
    switch (source) {
      case 'workspace':
        return 'Project Context';
      case 'parent':
        return 'Parent Directory Context';
      case 'home':
        return 'Global User Context';
      case 'include':
        return 'Included Context';
      default:
        return 'Context';
    }
  }
}

// ============================================================================
// MEMORY FILE TOOLS
// ============================================================================

import Anthropic from '@anthropic-ai/sdk';

/**
 * Get memory file tools for the workspace agent
 */
export function getClaudeMemoryTools(): Anthropic.Tool[] {
  return [
    {
      name: 'memory_load',
      description:
        'Load CLAUDE.md memory files from the workspace. These files contain project-specific instructions and context.',
      input_schema: {
        type: 'object' as const,
        properties: {
          includeParentDirs: {
            type: 'boolean',
            description: 'Include memory files from parent directories (default: true)',
          },
          includeHomeDir: {
            type: 'boolean',
            description: 'Include global memory file from home directory (default: true)',
          },
        },
        required: [],
      },
    },
    {
      name: 'memory_create',
      description: 'Create a new CLAUDE.md memory file in the workspace root.',
      input_schema: {
        type: 'object' as const,
        properties: {
          content: {
            type: 'string',
            description:
              'Content for the CLAUDE.md file. If not provided, a default template will be used.',
          },
        },
        required: [],
      },
    },
    {
      name: 'memory_update',
      description: 'Update the CLAUDE.md memory file in the workspace root.',
      input_schema: {
        type: 'object' as const,
        properties: {
          content: {
            type: 'string',
            description: 'New content for the CLAUDE.md file',
          },
        },
        required: ['content'],
      },
    },
    {
      name: 'memory_add_instruction',
      description: 'Add a new instruction or note to the CLAUDE.md file.',
      input_schema: {
        type: 'object' as const,
        properties: {
          section: {
            type: 'string',
            description: 'Section to add to (e.g., "Instructions", "Preferences", "Do Not")',
          },
          instruction: {
            type: 'string',
            description: 'The instruction or note to add',
          },
        },
        required: ['instruction'],
      },
    },
  ];
}

/**
 * Default CLAUDE.md template
 */
export const DEFAULT_CLAUDE_MD_TEMPLATE = `# Project Memory (CLAUDE.md)

This file stores project-specific context and instructions.
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

## Instructions

<!-- Specific instructions for the AI -->
- Always run tests after making changes
- Prefer small, focused commits
- Explain changes before making them

## Do Not

<!-- Things the AI should avoid -->
- Do not modify configuration files without asking
- Do not delete files without confirmation
- Do not push to main branch directly

## Includes

<!-- You can include other files using @include directives -->
<!-- Example: @include ./docs/api-conventions.md -->

---
*Last updated: ${new Date().toISOString()}*
`;

// ============================================================================
// EXECUTE MEMORY TOOLS
// ============================================================================

/**
 * Execute a memory tool
 */
export async function executeMemoryTool(
  toolName: string,
  input: Record<string, unknown>,
  readFile: (path: string) => Promise<string>,
  writeFile: (path: string, content: string) => Promise<void>,
  fileExists: (path: string) => Promise<boolean>,
  listDir: (path: string) => Promise<string[]>,
  workspaceRoot: string = '/workspace'
): Promise<string> {
  const loader = new MemoryFileLoader(readFile, fileExists, listDir);

  try {
    switch (toolName) {
      case 'memory_load': {
        const includeParentDirs = input.includeParentDirs !== false;
        const includeHomeDir = input.includeHomeDir !== false;

        const context = await loader.loadMemoryContext({
          workspaceRoot,
          includeParentDirs,
          includeHomeDir,
        });

        if (context.files.length === 0) {
          return 'No CLAUDE.md memory files found. Use memory_create to create one.';
        }

        const fileList = context.files.map((f) => `- ${f.path} (${f.source})`).join('\n');

        return `Loaded ${context.files.length} memory file(s):\n${fileList}\n\nContent:\n${context.combinedContent}`;
      }

      case 'memory_create': {
        const content = (input.content as string) || DEFAULT_CLAUDE_MD_TEMPLATE;
        const memoryPath = path.join(workspaceRoot, 'CLAUDE.md');

        try {
          const exists = await fileExists(memoryPath);
          if (exists) {
            return `CLAUDE.md already exists at ${memoryPath}. Use memory_update to modify it.`;
          }
        } catch {
          // File doesn't exist, proceed with creation
        }

        await writeFile(memoryPath, content);
        return `Created CLAUDE.md at ${memoryPath}`;
      }

      case 'memory_update': {
        const content = input.content as string;
        if (!content) {
          return 'Error: content is required for memory_update';
        }

        const memoryPath = path.join(workspaceRoot, 'CLAUDE.md');

        // Check for CODELAB.md as fallback
        let targetPath = memoryPath;
        try {
          if (!(await fileExists(memoryPath))) {
            const codelabPath = path.join(workspaceRoot, 'CODELAB.md');
            if (await fileExists(codelabPath)) {
              targetPath = codelabPath;
            }
          }
        } catch {
          // Use default path
        }

        await writeFile(targetPath, content);
        return `Updated memory file at ${targetPath}`;
      }

      case 'memory_add_instruction': {
        const instruction = input.instruction as string;
        if (!instruction) {
          return 'Error: instruction is required';
        }

        const section = (input.section as string) || 'Instructions';
        const memoryPath = path.join(workspaceRoot, 'CLAUDE.md');

        let content: string;
        try {
          content = await readFile(memoryPath);
        } catch {
          // File doesn't exist, create with default template
          content = DEFAULT_CLAUDE_MD_TEMPLATE;
        }

        // Find the section and add the instruction
        const sectionHeader = `## ${section}`;
        const sectionIndex = content.indexOf(sectionHeader);

        if (sectionIndex !== -1) {
          // Find the end of the section (next ## or ---)
          const afterSection = content.substring(sectionIndex + sectionHeader.length);
          const nextSectionMatch = afterSection.match(/\n## |\n---/);
          const insertIndex = nextSectionMatch
            ? sectionIndex + sectionHeader.length + nextSectionMatch.index!
            : content.length;

          // Insert the new instruction
          const newContent =
            content.substring(0, insertIndex) +
            `\n- ${instruction}` +
            content.substring(insertIndex);

          await writeFile(memoryPath, newContent);
          return `Added instruction to ${section} section: "${instruction}"`;
        } else {
          // Section doesn't exist, add it
          const footerIndex = content.lastIndexOf('\n---');
          const newSection = `\n## ${section}\n\n- ${instruction}\n`;

          const newContent =
            footerIndex !== -1
              ? content.substring(0, footerIndex) + newSection + content.substring(footerIndex)
              : content + newSection;

          await writeFile(memoryPath, newContent);
          return `Created ${section} section and added instruction: "${instruction}"`;
        }
      }

      default:
        return `Unknown memory tool: ${toolName}`;
    }
  } catch (error) {
    log.error('Memory tool error', { toolName, error });
    return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Check if a tool name is a memory tool
 */
export function isClaudeMemoryTool(toolName: string): boolean {
  return toolName.startsWith('memory_');
}

// ============================================================================
// SINGLETON LOADER
// ============================================================================

let loaderInstance: MemoryFileLoader | null = null;
let cachedContext: MemoryContext | null = null;
let cacheWorkspaceRoot: string | null = null;

/**
 * Get cached memory context for a workspace
 */
export async function getCachedMemoryContext(
  workspaceRoot: string,
  readFile: (path: string) => Promise<string>,
  fileExists: (path: string) => Promise<boolean>,
  listDir: (path: string) => Promise<string[]>,
  forceReload: boolean = false
): Promise<MemoryContext> {
  // Return cached context if valid
  if (
    !forceReload &&
    cachedContext &&
    cacheWorkspaceRoot === workspaceRoot &&
    Date.now() - cachedContext.loadedAt.getTime() < 5 * 60 * 1000 // 5 minute cache
  ) {
    return cachedContext;
  }

  // Create or reuse loader
  if (!loaderInstance) {
    loaderInstance = new MemoryFileLoader(readFile, fileExists, listDir);
  }

  // Load fresh context
  cachedContext = await loaderInstance.loadMemoryContext({ workspaceRoot });
  cacheWorkspaceRoot = workspaceRoot;

  return cachedContext;
}

/**
 * Clear the memory context cache
 */
export function clearMemoryCache(): void {
  cachedContext = null;
  cacheWorkspaceRoot = null;
}
