/**
 * CUSTOM SKILLS SYSTEM
 *
 * Claude Code-compatible skill loader.
 * Enables user-defined skills through markdown files.
 *
 * Features:
 * - Load skills from .claude/skills/ directory
 * - Parse YAML frontmatter for metadata
 * - Hot-reload on file changes
 * - Slash command registration
 */

import { logger } from '@/lib/logger';
import * as path from 'path';

const log = logger('Skills');

// ============================================================================
// TYPES
// ============================================================================

export interface SkillMetadata {
  /** Unique skill name (used for /skillname command) */
  name: string;
  /** Human-readable description */
  description: string;
  /** Allowed tools for this skill */
  allowedTools?: string[];
  /** Model to use for this skill */
  model?: 'sonnet' | 'opus' | 'haiku';
  /** Maximum tokens for response */
  maxTokens?: number;
  /** Temperature for response */
  temperature?: number;
  /** Tags for categorization */
  tags?: string[];
  /** Author of the skill */
  author?: string;
  /** Version of the skill */
  version?: string;
}

export interface Skill {
  /** Skill metadata from frontmatter */
  metadata: SkillMetadata;
  /** Skill prompt content */
  content: string;
  /** File path */
  filePath: string;
  /** Last modified timestamp */
  lastModified: Date;
}

export interface SkillRegistry {
  skills: Map<string, Skill>;
  loadedAt: Date;
  watchEnabled: boolean;
}

// ============================================================================
// FRONTMATTER PARSER
// ============================================================================

/**
 * Parse YAML frontmatter from a skill file
 */
function parseFrontmatter(content: string): { metadata: Partial<SkillMetadata>; body: string } {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    return { metadata: {}, body: content };
  }

  const [, frontmatter, body] = frontmatterMatch;
  const metadata: Partial<SkillMetadata> = {};

  // Simple YAML parser for common fields
  const lines = frontmatter.split('\n');
  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.*)$/);
    if (!match) continue;

    const [, key, value] = match;
    const trimmedValue = value.trim();

    switch (key.toLowerCase()) {
      case 'name':
        metadata.name = trimmedValue.replace(/^["']|["']$/g, '');
        break;
      case 'description':
        metadata.description = trimmedValue.replace(/^["']|["']$/g, '');
        break;
      case 'model':
        if (['sonnet', 'opus', 'haiku'].includes(trimmedValue.toLowerCase())) {
          metadata.model = trimmedValue.toLowerCase() as 'sonnet' | 'opus' | 'haiku';
        }
        break;
      case 'maxtokens':
        metadata.maxTokens = parseInt(trimmedValue, 10);
        break;
      case 'temperature':
        metadata.temperature = parseFloat(trimmedValue);
        break;
      case 'author':
        metadata.author = trimmedValue.replace(/^["']|["']$/g, '');
        break;
      case 'version':
        metadata.version = trimmedValue.replace(/^["']|["']$/g, '');
        break;
      case 'allowedtools':
      case 'allowed_tools':
        // Parse array format: [tool1, tool2] or tool1, tool2
        metadata.allowedTools = trimmedValue
          .replace(/^\[|\]$/g, '')
          .split(',')
          .map((t) => t.trim().replace(/^["']|["']$/g, ''));
        break;
      case 'tags':
        metadata.tags = trimmedValue
          .replace(/^\[|\]$/g, '')
          .split(',')
          .map((t) => t.trim().replace(/^["']|["']$/g, ''));
        break;
    }
  }

  return { metadata, body };
}

// ============================================================================
// SKILL LOADER
// ============================================================================

export class SkillLoader {
  private readFile: (path: string) => Promise<string>;
  private fileExists: (path: string) => Promise<boolean>;
  private listDir: (path: string) => Promise<string[]>;
  private getStat: (path: string) => Promise<{ mtimeMs: number } | null>;

  private registry: SkillRegistry = {
    skills: new Map(),
    loadedAt: new Date(),
    watchEnabled: false,
  };

  constructor(
    readFile: (path: string) => Promise<string>,
    fileExists: (path: string) => Promise<boolean>,
    listDir: (path: string) => Promise<string[]>,
    getStat?: (path: string) => Promise<{ mtimeMs: number } | null>
  ) {
    this.readFile = readFile;
    this.fileExists = fileExists;
    this.listDir = listDir;
    this.getStat = getStat || (async () => null);
  }

  /**
   * Load all skills from the skills directory
   */
  async loadSkills(workspaceRoot: string): Promise<SkillRegistry> {
    const skillsDir = path.join(workspaceRoot, '.claude', 'skills');

    try {
      if (!(await this.fileExists(skillsDir))) {
        log.debug('Skills directory does not exist', { skillsDir });
        return this.registry;
      }

      const files = await this.listDir(skillsDir);
      const mdFiles = files.filter((f) => f.endsWith('.md'));

      log.info('Loading skills', { count: mdFiles.length, dir: skillsDir });

      for (const file of mdFiles) {
        try {
          const skill = await this.loadSkill(path.join(skillsDir, file));
          if (skill) {
            this.registry.skills.set(skill.metadata.name, skill);
          }
        } catch (error) {
          log.warn('Failed to load skill', { file, error });
        }
      }

      this.registry.loadedAt = new Date();
      log.info('Skills loaded', { count: this.registry.skills.size });

      return this.registry;
    } catch (error) {
      log.error('Failed to load skills directory', { skillsDir, error });
      return this.registry;
    }
  }

  /**
   * Load a single skill file
   */
  async loadSkill(filePath: string): Promise<Skill | null> {
    try {
      const content = await this.readFile(filePath);
      const { metadata, body } = parseFrontmatter(content);

      // Require at least name and description
      if (!metadata.name) {
        // Use filename as name if not specified
        metadata.name = path.basename(filePath, '.md').toLowerCase().replace(/\s+/g, '-');
      }
      if (!metadata.description) {
        metadata.description = `Custom skill: ${metadata.name}`;
      }

      // Get file modification time
      let lastModified = new Date();
      const stat = await this.getStat(filePath);
      if (stat) {
        lastModified = new Date(stat.mtimeMs);
      }

      return {
        metadata: metadata as SkillMetadata,
        content: body.trim(),
        filePath,
        lastModified,
      };
    } catch (error) {
      log.warn('Failed to load skill file', { filePath, error });
      return null;
    }
  }

  /**
   * Get a skill by name
   */
  getSkill(name: string): Skill | undefined {
    return this.registry.skills.get(name);
  }

  /**
   * Get all loaded skills
   */
  getAllSkills(): Skill[] {
    return Array.from(this.registry.skills.values());
  }

  /**
   * Get skill names for autocomplete
   */
  getSkillNames(): string[] {
    return Array.from(this.registry.skills.keys());
  }

  /**
   * Check if a skill exists
   */
  hasSkill(name: string): boolean {
    return this.registry.skills.has(name);
  }

  /**
   * Reload a specific skill
   */
  async reloadSkill(name: string, _workspaceRoot: string): Promise<Skill | null> {
    const existing = this.registry.skills.get(name);
    if (!existing) {
      log.warn('Skill not found for reload', { name });
      return null;
    }

    const skill = await this.loadSkill(existing.filePath);
    if (skill) {
      this.registry.skills.set(skill.metadata.name, skill);
    }
    return skill;
  }

  /**
   * Reload all skills
   */
  async reloadAll(workspaceRoot: string): Promise<SkillRegistry> {
    this.registry.skills.clear();
    return this.loadSkills(workspaceRoot);
  }

  /**
   * Get the registry
   */
  getRegistry(): SkillRegistry {
    return this.registry;
  }
}

// ============================================================================
// SKILL EXECUTION
// ============================================================================

/**
 * Build a system prompt for a skill
 */
export function buildSkillPrompt(skill: Skill, userInput?: string): string {
  let prompt = skill.content;

  // Replace placeholders
  if (userInput) {
    prompt = prompt.replace(/\{\{input\}\}/g, userInput);
    prompt = prompt.replace(/\{\{user_input\}\}/g, userInput);
  }

  // Add metadata context
  if (skill.metadata.allowedTools) {
    prompt += `\n\nAllowed tools for this skill: ${skill.metadata.allowedTools.join(', ')}`;
  }

  return prompt;
}

// ============================================================================
// SKILL TOOLS
// ============================================================================

import Anthropic from '@anthropic-ai/sdk';

/**
 * Get skill management tools for the workspace agent
 */
export function getSkillTools(): Anthropic.Tool[] {
  return [
    {
      name: 'skill_list',
      description: 'List all available custom skills. Shows skill name, description, and tags.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
    {
      name: 'skill_run',
      description: 'Execute a custom skill by name. The skill will be run with the provided input.',
      input_schema: {
        type: 'object' as const,
        properties: {
          name: {
            type: 'string',
            description: 'Name of the skill to run (e.g., "commit", "review")',
          },
          input: {
            type: 'string',
            description: 'Input to pass to the skill (replaces {{input}} in the skill prompt)',
          },
        },
        required: ['name'],
      },
    },
    {
      name: 'skill_create',
      description: 'Create a new custom skill. Creates a .md file in .claude/skills/',
      input_schema: {
        type: 'object' as const,
        properties: {
          name: {
            type: 'string',
            description: 'Skill name (will be used for /skillname command)',
          },
          description: {
            type: 'string',
            description: 'What the skill does',
          },
          content: {
            type: 'string',
            description: 'The skill prompt/instructions',
          },
          model: {
            type: 'string',
            enum: ['sonnet', 'opus', 'haiku'],
            description: 'Model to use for this skill',
          },
          allowedTools: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of tool names this skill can use',
          },
        },
        required: ['name', 'description', 'content'],
      },
    },
    {
      name: 'skill_reload',
      description: 'Reload all skills from the skills directory.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
  ];
}

/**
 * Execute a skill tool
 */
export async function executeSkillTool(
  toolName: string,
  input: Record<string, unknown>,
  loader: SkillLoader,
  _readFile: (path: string) => Promise<string>,
  writeFile: (path: string, content: string) => Promise<void>,
  fileExists: (path: string) => Promise<boolean>,
  workspaceRoot: string = '/workspace'
): Promise<string> {
  try {
    switch (toolName) {
      case 'skill_list': {
        const skills = loader.getAllSkills();

        if (skills.length === 0) {
          return 'No custom skills found. Create one with skill_create or add .md files to .claude/skills/';
        }

        const lines = skills.map((s) => {
          const tags = s.metadata.tags ? ` [${s.metadata.tags.join(', ')}]` : '';
          return `- /${s.metadata.name}: ${s.metadata.description}${tags}`;
        });

        return `Available skills (${skills.length}):\n${lines.join('\n')}`;
      }

      case 'skill_run': {
        const name = input.name as string;
        const userInput = input.input as string | undefined;

        if (!name) {
          return 'Error: skill name is required';
        }

        const skill = loader.getSkill(name);
        if (!skill) {
          const available = loader.getSkillNames();
          return `Skill "${name}" not found. Available: ${available.join(', ') || 'none'}`;
        }

        const prompt = buildSkillPrompt(skill, userInput);
        return `[Skill: ${skill.metadata.name}]\n\n${prompt}`;
      }

      case 'skill_create': {
        const name = input.name as string;
        const description = input.description as string;
        const content = input.content as string;
        const model = input.model as string | undefined;
        const allowedTools = input.allowedTools as string[] | undefined;

        if (!name || !description || !content) {
          return 'Error: name, description, and content are required';
        }

        // Create skills directory if needed
        const skillsDir = path.join(workspaceRoot, '.claude', 'skills');
        try {
          // Create directory structure
          const claudeDir = path.join(workspaceRoot, '.claude');
          if (!(await fileExists(claudeDir))) {
            // We'd need mkdir, but for now just note the limitation
          }
        } catch {
          // Directory might already exist
        }

        // Build skill file content
        const lines: string[] = ['---', `name: "${name}"`, `description: "${description}"`];

        if (model) {
          lines.push(`model: ${model}`);
        }
        if (allowedTools && allowedTools.length > 0) {
          lines.push(`allowedTools: [${allowedTools.map((t) => `"${t}"`).join(', ')}]`);
        }

        lines.push('---', '', content);

        const fileContent = lines.join('\n');
        const filePath = path.join(skillsDir, `${name}.md`);

        await writeFile(filePath, fileContent);

        // Reload to pick up new skill
        await loader.loadSkills(workspaceRoot);

        return `Created skill "${name}" at ${filePath}`;
      }

      case 'skill_reload': {
        await loader.reloadAll(workspaceRoot);
        const count = loader.getAllSkills().length;
        return `Reloaded ${count} skill(s)`;
      }

      default:
        return `Unknown skill tool: ${toolName}`;
    }
  } catch (error) {
    log.error('Skill tool error', { toolName, error });
    return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Check if a tool name is a skill tool
 */
export function isSkillTool(toolName: string): boolean {
  return toolName.startsWith('skill_');
}

// ============================================================================
// SINGLETON
// ============================================================================

let loaderInstance: SkillLoader | null = null;

/**
 * Get the singleton skill loader
 */
export function getSkillLoader(
  readFile: (path: string) => Promise<string>,
  fileExists: (path: string) => Promise<boolean>,
  listDir: (path: string) => Promise<string[]>,
  getStat?: (path: string) => Promise<{ mtimeMs: number } | null>
): SkillLoader {
  if (!loaderInstance) {
    loaderInstance = new SkillLoader(readFile, fileExists, listDir, getStat);
  }
  return loaderInstance;
}

/**
 * Clear the skill loader instance
 */
export function clearSkillLoader(): void {
  loaderInstance = null;
}
