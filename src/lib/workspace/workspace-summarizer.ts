/**
 * WORKSPACE SUMMARIZER
 *
 * Semantic AI summarization for workspace context.
 * Provides intelligent summaries of code, files, and project structure.
 *
 * Features:
 * - File content summarization
 * - Project structure analysis
 * - Code change summarization
 * - Topic extraction and indexing
 * - Cross-session context preservation
 *
 * @version 1.0.0
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';

const log = logger('workspace-summarizer');

// ============================================================================
// TYPES
// ============================================================================

export interface FileSummary {
  path: string;
  summary: string;
  topics: string[];
  exports: string[];
  dependencies: string[];
  complexity: 'low' | 'medium' | 'high';
  lastUpdated: number;
}

export interface ProjectSummary {
  name: string;
  description: string;
  techStack: string[];
  mainComponents: string[];
  architecture: string;
  keyFeatures: string[];
  generatedAt: number;
}

export interface ChangeSummary {
  files: string[];
  summary: string;
  impact: 'low' | 'medium' | 'high';
  breakingChanges: boolean;
  topics: string[];
  timestamp: number;
}

export interface WorkspaceContext {
  projectSummary: ProjectSummary | null;
  fileSummaries: Map<string, FileSummary>;
  recentChanges: ChangeSummary[];
  topics: Map<string, string[]>; // topic -> file paths
  lastRefresh: number;
}

export interface SummaryOptions {
  maxTokens?: number;
  includeCode?: boolean;
  focusAreas?: string[];
}

// ============================================================================
// WORKSPACE SUMMARIZER CLASS
// ============================================================================

export class WorkspaceSummarizer {
  private anthropic: Anthropic;
  private contexts: Map<string, WorkspaceContext> = new Map();
  private summaryCache: Map<string, { summary: string; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.anthropic = new Anthropic();
    log.info('WorkspaceSummarizer initialized');
  }

  /**
   * Get or create workspace context
   */
  getContext(workspaceId: string): WorkspaceContext {
    if (!this.contexts.has(workspaceId)) {
      this.contexts.set(workspaceId, {
        projectSummary: null,
        fileSummaries: new Map(),
        recentChanges: [],
        topics: new Map(),
        lastRefresh: 0,
      });
    }
    return this.contexts.get(workspaceId)!;
  }

  /**
   * Summarize a single file
   */
  async summarizeFile(
    workspaceId: string,
    filePath: string,
    content: string,
    options: SummaryOptions = {}
  ): Promise<FileSummary> {
    const cacheKey = `file:${workspaceId}:${filePath}`;
    const cached = this.summaryCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      const context = this.getContext(workspaceId);
      const existing = context.fileSummaries.get(filePath);
      if (existing) return existing;
    }

    const maxTokens = options.maxTokens || 500;

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: maxTokens,
      system: `You are a code analyzer. Analyze the given file and provide a structured summary.
Output JSON with this exact structure:
{
  "summary": "Brief 2-3 sentence description of what this file does",
  "topics": ["topic1", "topic2", "topic3"],
  "exports": ["exportedFunction1", "ExportedClass1"],
  "dependencies": ["dependency1", "dependency2"],
  "complexity": "low|medium|high"
}`,
      messages: [
        {
          role: 'user',
          content: `Analyze this file (${filePath}):\n\n${content.slice(0, 8000)}`,
        },
      ],
    });

    const textContent = response.content.find((block) => block.type === 'text');
    const responseText = textContent?.type === 'text' ? textContent.text : '{}';

    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

      const summary: FileSummary = {
        path: filePath,
        summary: parsed.summary || 'No summary available',
        topics: parsed.topics || [],
        exports: parsed.exports || [],
        dependencies: parsed.dependencies || [],
        complexity: parsed.complexity || 'medium',
        lastUpdated: Date.now(),
      };

      // Update context
      const context = this.getContext(workspaceId);
      context.fileSummaries.set(filePath, summary);

      // Update topic index
      for (const topic of summary.topics) {
        const files = context.topics.get(topic) || [];
        if (!files.includes(filePath)) {
          files.push(filePath);
          context.topics.set(topic, files);
        }
      }

      // Cache the result
      this.summaryCache.set(cacheKey, {
        summary: JSON.stringify(summary),
        timestamp: Date.now(),
      });

      log.info('File summarized', { workspaceId, filePath, topics: summary.topics });
      return summary;
    } catch (error) {
      log.error('Failed to parse file summary', { error, filePath });
      return {
        path: filePath,
        summary: 'Unable to analyze file',
        topics: [],
        exports: [],
        dependencies: [],
        complexity: 'medium',
        lastUpdated: Date.now(),
      };
    }
  }

  /**
   * Generate project-wide summary
   */
  async summarizeProject(
    workspaceId: string,
    files: Array<{ path: string; content: string }>,
    options: SummaryOptions = {}
  ): Promise<ProjectSummary> {
    const cacheKey = `project:${workspaceId}`;
    const cached = this.summaryCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      try {
        return JSON.parse(cached.summary) as ProjectSummary;
      } catch {
        // Continue to generate new summary
      }
    }

    // Prepare file overview
    const fileOverview = files
      .slice(0, 50)
      .map((f) => {
        const ext = f.path.split('.').pop() || '';
        const preview = f.content.slice(0, 200).replace(/\n/g, ' ');
        return `${f.path} (${ext}): ${preview}...`;
      })
      .join('\n');

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: options.maxTokens || 1000,
      system: `You are a project analyzer. Analyze the project structure and provide a comprehensive summary.
Output JSON with this exact structure:
{
  "name": "Project name",
  "description": "2-3 sentence project description",
  "techStack": ["tech1", "tech2"],
  "mainComponents": ["component1", "component2"],
  "architecture": "Brief architecture description",
  "keyFeatures": ["feature1", "feature2"]
}`,
      messages: [
        {
          role: 'user',
          content: `Analyze this project:\n\nFile structure and previews:\n${fileOverview}`,
        },
      ],
    });

    const textContent = response.content.find((block) => block.type === 'text');
    const responseText = textContent?.type === 'text' ? textContent.text : '{}';

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

      const summary: ProjectSummary = {
        name: parsed.name || 'Unknown Project',
        description: parsed.description || 'No description available',
        techStack: parsed.techStack || [],
        mainComponents: parsed.mainComponents || [],
        architecture: parsed.architecture || 'Unknown',
        keyFeatures: parsed.keyFeatures || [],
        generatedAt: Date.now(),
      };

      // Update context
      const context = this.getContext(workspaceId);
      context.projectSummary = summary;
      context.lastRefresh = Date.now();

      // Cache
      this.summaryCache.set(cacheKey, {
        summary: JSON.stringify(summary),
        timestamp: Date.now(),
      });

      log.info('Project summarized', { workspaceId, name: summary.name });
      return summary;
    } catch (error) {
      log.error('Failed to parse project summary', { error });
      return {
        name: 'Unknown Project',
        description: 'Unable to analyze project',
        techStack: [],
        mainComponents: [],
        architecture: 'Unknown',
        keyFeatures: [],
        generatedAt: Date.now(),
      };
    }
  }

  /**
   * Summarize code changes
   */
  async summarizeChanges(
    workspaceId: string,
    changes: Array<{ path: string; diff: string; changeType: 'added' | 'modified' | 'deleted' }>
  ): Promise<ChangeSummary> {
    const changeText = changes
      .map((c) => `${c.changeType.toUpperCase()}: ${c.path}\n${c.diff.slice(0, 500)}`)
      .join('\n\n');

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      system: `Analyze code changes and provide a summary.
Output JSON:
{
  "summary": "Brief summary of what changed",
  "impact": "low|medium|high",
  "breakingChanges": true|false,
  "topics": ["topic1", "topic2"]
}`,
      messages: [
        {
          role: 'user',
          content: `Summarize these changes:\n\n${changeText}`,
        },
      ],
    });

    const textContent = response.content.find((block) => block.type === 'text');
    const responseText = textContent?.type === 'text' ? textContent.text : '{}';

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

      const summary: ChangeSummary = {
        files: changes.map((c) => c.path),
        summary: parsed.summary || 'Changes made',
        impact: parsed.impact || 'medium',
        breakingChanges: parsed.breakingChanges || false,
        topics: parsed.topics || [],
        timestamp: Date.now(),
      };

      // Update context
      const context = this.getContext(workspaceId);
      context.recentChanges.push(summary);
      // Keep only last 20 change summaries
      if (context.recentChanges.length > 20) {
        context.recentChanges = context.recentChanges.slice(-20);
      }

      log.info('Changes summarized', {
        workspaceId,
        files: summary.files.length,
        impact: summary.impact,
      });
      return summary;
    } catch (error) {
      log.error('Failed to parse change summary', { error });
      return {
        files: changes.map((c) => c.path),
        summary: 'Unable to summarize changes',
        impact: 'medium',
        breakingChanges: false,
        topics: [],
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Search files by topic
   */
  searchByTopic(workspaceId: string, topic: string): string[] {
    const context = this.getContext(workspaceId);
    const files = context.topics.get(topic.toLowerCase()) || [];

    // Also search in related topics
    const relatedFiles: string[] = [];
    for (const [t, paths] of context.topics.entries()) {
      if (t.includes(topic.toLowerCase()) || topic.toLowerCase().includes(t)) {
        relatedFiles.push(...paths);
      }
    }

    return [...new Set([...files, ...relatedFiles])];
  }

  /**
   * Generate context for AI assistant
   */
  async generateContextForAssistant(
    workspaceId: string,
    _query: string,
    options: { maxTokens?: number; relevantFiles?: string[] } = {}
  ): Promise<string> {
    const context = this.getContext(workspaceId);
    const parts: string[] = [];

    // Project summary
    if (context.projectSummary) {
      parts.push(`## Project Overview
**${context.projectSummary.name}**
${context.projectSummary.description}

Tech Stack: ${context.projectSummary.techStack.join(', ')}
Key Features: ${context.projectSummary.keyFeatures.join(', ')}
`);
    }

    // Relevant file summaries
    const relevantFiles = options.relevantFiles || [];
    if (relevantFiles.length > 0) {
      parts.push('## Relevant Files');
      for (const filePath of relevantFiles.slice(0, 10)) {
        const fileSummary = context.fileSummaries.get(filePath);
        if (fileSummary) {
          parts.push(`### ${filePath}
${fileSummary.summary}
Topics: ${fileSummary.topics.join(', ')}
Exports: ${fileSummary.exports.slice(0, 5).join(', ')}
`);
        }
      }
    }

    // Recent changes
    if (context.recentChanges.length > 0) {
      const recentChanges = context.recentChanges.slice(-5);
      parts.push('## Recent Changes');
      for (const change of recentChanges) {
        parts.push(`- ${change.summary} (Impact: ${change.impact})`);
      }
    }

    const fullContext = parts.join('\n\n');

    // Truncate if needed
    const maxChars = (options.maxTokens || 2000) * 4;
    return fullContext.slice(0, maxChars);
  }

  /**
   * Extract keywords/topics from text
   */
  async extractTopics(text: string): Promise<string[]> {
    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 100,
      system:
        'Extract 3-5 key topics from the text. Output only comma-separated topics, no other text.',
      messages: [
        {
          role: 'user',
          content: text.slice(0, 1000),
        },
      ],
    });

    const textContent = response.content.find((block) => block.type === 'text');
    const responseText = textContent?.type === 'text' ? textContent.text : '';

    return responseText
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);
  }

  /**
   * Clear workspace context
   */
  clearContext(workspaceId: string): void {
    this.contexts.delete(workspaceId);

    // Clear related cache entries
    for (const key of this.summaryCache.keys()) {
      if (key.includes(workspaceId)) {
        this.summaryCache.delete(key);
      }
    }

    log.info('Workspace context cleared', { workspaceId });
  }

  /**
   * Get all topics for a workspace
   */
  getAllTopics(workspaceId: string): string[] {
    const context = this.getContext(workspaceId);
    return Array.from(context.topics.keys());
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let summarizerInstance: WorkspaceSummarizer | null = null;

export function getWorkspaceSummarizer(): WorkspaceSummarizer {
  if (!summarizerInstance) {
    summarizerInstance = new WorkspaceSummarizer();
  }
  return summarizerInstance;
}

// ============================================================================
// WORKSPACE SUMMARIZATION TOOLS
// ============================================================================

export function getWorkspaceSummarizationTools() {
  return [
    {
      name: 'summarize_file',
      description: 'Generate an AI summary of a file including topics, exports, and dependencies',
      input_schema: {
        type: 'object' as const,
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the file to summarize',
          },
        },
        required: ['filePath'],
      },
    },
    {
      name: 'summarize_project',
      description: 'Generate a comprehensive summary of the entire project',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
    {
      name: 'search_by_topic',
      description: 'Find files related to a specific topic or concept',
      input_schema: {
        type: 'object' as const,
        properties: {
          topic: {
            type: 'string',
            description: 'Topic to search for (e.g., "authentication", "database", "api")',
          },
        },
        required: ['topic'],
      },
    },
    {
      name: 'get_workspace_context',
      description: 'Get a formatted context summary for the AI assistant',
      input_schema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'The query or task to provide context for',
          },
          relevantFiles: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific files to include in context',
          },
        },
        required: [],
      },
    },
  ];
}

export function isWorkspaceSummarizationTool(toolName: string): boolean {
  return [
    'summarize_file',
    'summarize_project',
    'search_by_topic',
    'get_workspace_context',
  ].includes(toolName);
}
