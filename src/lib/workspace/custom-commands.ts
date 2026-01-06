/**
 * CUSTOM SLASH COMMANDS
 *
 * User-defined slash commands for personalized workflows.
 *
 * Features:
 * - Create custom commands
 * - Parameter support
 * - Command templates
 * - Import/export
 * - Command sharing
 */

export interface CustomCommandParameter {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'file' | 'select';
  required: boolean;
  default?: unknown;
  options?: string[]; // For select type
}

export interface CustomCommand {
  id: string;
  name: string; // The command name (without /)
  description: string;
  category: string;
  icon: string;
  parameters: CustomCommandParameter[];
  template: string; // The prompt template with {{param}} placeholders
  requiresWorkspace: boolean;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  author?: string;
  usageCount: number;
}

export interface CommandExecutionContext {
  sessionId: string;
  workspaceId?: string;
  userId?: string;
  parameters: Record<string, unknown>;
}

// Built-in command templates that users can customize
export const COMMAND_TEMPLATES: Omit<CustomCommand, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>[] = [
  {
    name: 'quick-fix',
    description: 'Fix a specific type of issue',
    category: 'debug',
    icon: '🔧',
    parameters: [
      { name: 'issue_type', description: 'Type of issue to fix', type: 'select', required: true, options: ['type-error', 'lint-error', 'runtime-error', 'build-error'] },
      { name: 'file', description: 'Specific file to focus on', type: 'file', required: false },
    ],
    template: 'Fix all {{issue_type}} issues{{#file}} in {{file}}{{/file}}. Show me what you changed.',
    requiresWorkspace: true,
    isPublic: false,
  },
  {
    name: 'generate-api',
    description: 'Generate REST API endpoints',
    category: 'generate',
    icon: '🔌',
    parameters: [
      { name: 'resource', description: 'Resource name (e.g., users, posts)', type: 'string', required: true },
      { name: 'operations', description: 'CRUD operations to include', type: 'select', required: false, options: ['all', 'read-only', 'write-only'], default: 'all' },
    ],
    template: 'Generate REST API endpoints for the {{resource}} resource with {{operations}} operations. Include proper validation, error handling, and TypeScript types.',
    requiresWorkspace: true,
    isPublic: true,
  },
  {
    name: 'add-tests',
    description: 'Add tests for a specific file or function',
    category: 'testing',
    icon: '🧪',
    parameters: [
      { name: 'target', description: 'File or function to test', type: 'string', required: true },
      { name: 'framework', description: 'Testing framework', type: 'select', required: false, options: ['jest', 'vitest', 'mocha', 'pytest'], default: 'vitest' },
    ],
    template: 'Write comprehensive tests for {{target}} using {{framework}}. Include edge cases and mock external dependencies.',
    requiresWorkspace: true,
    isPublic: true,
  },
  {
    name: 'document',
    description: 'Generate documentation',
    category: 'docs',
    icon: '📝',
    parameters: [
      { name: 'target', description: 'What to document', type: 'string', required: true },
      { name: 'format', description: 'Documentation format', type: 'select', required: false, options: ['jsdoc', 'tsdoc', 'readme', 'api-docs'], default: 'tsdoc' },
    ],
    template: 'Generate {{format}} documentation for {{target}}. Include examples and type information.',
    requiresWorkspace: true,
    isPublic: true,
  },
  {
    name: 'optimize',
    description: 'Optimize code for performance',
    category: 'refactor',
    icon: '⚡',
    parameters: [
      { name: 'file', description: 'File to optimize', type: 'file', required: true },
      { name: 'focus', description: 'Optimization focus', type: 'select', required: false, options: ['speed', 'memory', 'bundle-size', 'all'], default: 'all' },
    ],
    template: 'Optimize {{file}} for {{focus}}. Identify bottlenecks and implement improvements while maintaining functionality.',
    requiresWorkspace: true,
    isPublic: true,
  },
  {
    name: 'security-check',
    description: 'Run security analysis',
    category: 'security',
    icon: '🔒',
    parameters: [
      { name: 'scope', description: 'What to check', type: 'select', required: false, options: ['full', 'auth', 'inputs', 'deps'], default: 'full' },
    ],
    template: 'Perform a {{scope}} security analysis. Check for OWASP top 10 vulnerabilities, insecure patterns, and suggest fixes.',
    requiresWorkspace: true,
    isPublic: true,
  },
  {
    name: 'migrate',
    description: 'Migrate to a new version or framework',
    category: 'upgrade',
    icon: '🔄',
    parameters: [
      { name: 'from', description: 'Current version/framework', type: 'string', required: true },
      { name: 'to', description: 'Target version/framework', type: 'string', required: true },
    ],
    template: 'Migrate from {{from}} to {{to}}. Update all affected files, dependencies, and configurations. List breaking changes and manual steps needed.',
    requiresWorkspace: true,
    isPublic: true,
  },
];

/**
 * Custom Command Manager
 */
export class CustomCommandManager {
  private commands: Map<string, CustomCommand> = new Map();
  private storageKey = 'code-lab-custom-commands';

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Create a new custom command
   */
  create(command: Omit<CustomCommand, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): CustomCommand {
    const id = this.generateId();
    const now = new Date();

    const newCommand: CustomCommand = {
      ...command,
      id,
      createdAt: now,
      updatedAt: now,
      usageCount: 0,
    };

    this.commands.set(command.name, newCommand);
    this.saveToStorage();

    return newCommand;
  }

  /**
   * Update an existing command
   */
  update(name: string, updates: Partial<CustomCommand>): CustomCommand | null {
    const command = this.commands.get(name);
    if (!command) return null;

    const updated = {
      ...command,
      ...updates,
      updatedAt: new Date(),
    };

    // If name changed, update the key
    if (updates.name && updates.name !== name) {
      this.commands.delete(name);
      this.commands.set(updates.name, updated);
    } else {
      this.commands.set(name, updated);
    }

    this.saveToStorage();
    return updated;
  }

  /**
   * Delete a command
   */
  delete(name: string): boolean {
    const deleted = this.commands.delete(name);
    if (deleted) {
      this.saveToStorage();
    }
    return deleted;
  }

  /**
   * Get a command by name
   */
  get(name: string): CustomCommand | undefined {
    return this.commands.get(name);
  }

  /**
   * Get all commands
   */
  getAll(): CustomCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get commands by category
   */
  getByCategory(category: string): CustomCommand[] {
    return this.getAll().filter(c => c.category === category);
  }

  /**
   * Search commands
   */
  search(query: string): CustomCommand[] {
    const lower = query.toLowerCase();
    return this.getAll().filter(c =>
      c.name.toLowerCase().includes(lower) ||
      c.description.toLowerCase().includes(lower)
    );
  }

  /**
   * Execute a command and return the expanded prompt
   */
  execute(name: string, params: Record<string, unknown>): string {
    const command = this.commands.get(name);
    if (!command) {
      throw new Error(`Command not found: ${name}`);
    }

    // Validate required parameters
    for (const param of command.parameters) {
      if (param.required && !(param.name in params)) {
        throw new Error(`Missing required parameter: ${param.name}`);
      }
    }

    // Apply defaults
    const finalParams: Record<string, unknown> = {};
    for (const param of command.parameters) {
      finalParams[param.name] = params[param.name] ?? param.default;
    }

    // Expand template
    let prompt = command.template;

    // Handle simple {{param}} replacements
    for (const [key, value] of Object.entries(finalParams)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      prompt = prompt.replace(regex, String(value ?? ''));
    }

    // Handle conditional blocks {{#param}}...{{/param}}
    for (const param of command.parameters) {
      const conditionalRegex = new RegExp(
        `\\{\\{#${param.name}\\}\\}(.+?)\\{\\{/${param.name}\\}\\}`,
        'gs'
      );

      if (finalParams[param.name]) {
        // Replace with content, expanding inner {{param}}
        prompt = prompt.replace(conditionalRegex, (_, content) => {
          return content.replace(
            new RegExp(`\\{\\{${param.name}\\}\\}`, 'g'),
            String(finalParams[param.name])
          );
        });
      } else {
        // Remove the entire block
        prompt = prompt.replace(conditionalRegex, '');
      }
    }

    // Increment usage count
    command.usageCount++;
    command.updatedAt = new Date();
    this.saveToStorage();

    return prompt;
  }

  /**
   * Import commands from JSON
   */
  import(json: string): number {
    try {
      const commands = JSON.parse(json) as CustomCommand[];
      let imported = 0;

      for (const cmd of commands) {
        if (!this.commands.has(cmd.name)) {
          this.commands.set(cmd.name, {
            ...cmd,
            id: this.generateId(),
            createdAt: new Date(cmd.createdAt),
            updatedAt: new Date(),
            usageCount: 0,
          });
          imported++;
        }
      }

      this.saveToStorage();
      return imported;
    } catch {
      throw new Error('Invalid command JSON');
    }
  }

  /**
   * Export commands as JSON
   */
  export(names?: string[]): string {
    const commands = names
      ? this.getAll().filter(c => names.includes(c.name))
      : this.getAll();

    return JSON.stringify(commands, null, 2);
  }

  /**
   * Initialize with built-in templates
   */
  initializeDefaults(): void {
    for (const template of COMMAND_TEMPLATES) {
      if (!this.commands.has(template.name)) {
        this.create(template);
      }
    }
  }

  // Private: Load from localStorage
  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const commands = JSON.parse(stored) as CustomCommand[];
        for (const cmd of commands) {
          cmd.createdAt = new Date(cmd.createdAt);
          cmd.updatedAt = new Date(cmd.updatedAt);
          this.commands.set(cmd.name, cmd);
        }
      }
    } catch (e) {
      console.error('Failed to load custom commands:', e);
    }
  }

  // Private: Save to localStorage
  private saveToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const commands = this.getAll();
      localStorage.setItem(this.storageKey, JSON.stringify(commands));
    } catch (e) {
      console.error('Failed to save custom commands:', e);
    }
  }

  // Private: Generate unique ID
  private generateId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// Singleton instance
let commandManagerInstance: CustomCommandManager | null = null;

export function getCustomCommandManager(): CustomCommandManager {
  if (!commandManagerInstance) {
    commandManagerInstance = new CustomCommandManager();
    commandManagerInstance.initializeDefaults();
  }
  return commandManagerInstance;
}
