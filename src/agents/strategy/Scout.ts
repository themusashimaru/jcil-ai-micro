/**
 * SCOUT FRAMEWORK - Research Execution
 *
 * Scouts are strategic research agents using Sonnet 4.6.
 * They intelligently select from powerful tools: Brave Search, Puppeteer browser,
 * E2B code execution, Vision analysis, and more.
 * Sonnet enables surgical, high-yield research with fewer iterations.
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  AgentBlueprint,
  ScoutState,
  Finding,
  FindingType,
  SourceCitation,
  DataPoint,
  StrategyStreamCallback,
  ScoutToolType,
} from './types';
import { CLAUDE_SONNET_46, SCOUT_PROMPT, MODEL_CONFIGS } from './constants';
import { extractJSON } from './utils';
import { braveWebSearch, type BraveSearchResponse, type BraveWebResult } from '@/lib/brave';
import { logger } from '@/lib/logger';
import {
  executeScoutTool,
  getClaudeToolDefinitions,
  parseClaudeToolCall,
  setSessionId,
  AI_SAFETY_PROMPT,
} from './tools';

const log = logger('Scout');

// =============================================================================
// SCOUT RESULT
// =============================================================================

interface ScoutResult {
  agentId: string;
  findings: Finding[];
  summary: string;
  needsDeeper: boolean;
  childSuggestions: Partial<AgentBlueprint>[];
  gaps: string[];
  searchesExecuted: number;
  tokensUsed: number;
  // Separate token tracking for accurate cost calculation
  inputTokens: number;
  outputTokens: number;
  executionTime: number;
}

// =============================================================================
// SCOUT CLASS
// =============================================================================

export class Scout {
  private client: Anthropic;
  private blueprint: AgentBlueprint;
  private state: ScoutState;
  private onStream?: StrategyStreamCallback;
  private model: string;
  private costPerQuery = 0.005; // Brave Search cost
  private maxToolIterations = 8; // Max tool iterations - allow scouts to search, visit sites, and extract data
  private scoutPrompt: string;
  // Separate token tracking for accurate cost calculation
  private inputTokens = 0;
  private outputTokens = 0;

  constructor(
    client: Anthropic,
    blueprint: AgentBlueprint,
    onStream?: StrategyStreamCallback,
    scoutPrompt?: string
  ) {
    this.client = client;
    this.blueprint = blueprint;
    this.onStream = onStream;
    this.scoutPrompt = scoutPrompt || SCOUT_PROMPT;

    // Select model based on tier - defaults to Sonnet for strategic research
    this.model = MODEL_CONFIGS[blueprint.modelTier]?.id || CLAUDE_SONNET_46;

    this.state = {
      id: blueprint.id,
      blueprintId: blueprint.id,
      name: blueprint.name,
      status: 'pending',
      progress: 0,
      searchesCompleted: 0,
      searchesTotal: blueprint.searchQueries.length,
      findings: [],
      errors: [],
      startTime: Date.now(),
      tokensUsed: 0,
      costIncurred: 0,
    };

    // Separate token tracking for accurate cost calculation
    this.inputTokens = 0;
    this.outputTokens = 0;
  }

  // ===========================================================================
  // PUBLIC METHODS
  // ===========================================================================

  /**
   * Execute the scout's research mission
   */
  async execute(): Promise<ScoutResult> {
    const startTime = Date.now();
    this.state.status = 'researching';
    this.state.startTime = startTime;

    this.emitEvent('agent_progress', `${this.blueprint.name} starting research...`, {
      agentId: this.blueprint.id,
      agentName: this.blueprint.name,
      progress: 0,
    });

    // Use tool-based execution if tools are specified
    if (this.blueprint.tools && this.blueprint.tools.length > 0) {
      return this.executeWithTools(startTime);
    }

    try {
      // Legacy: Execute all search queries (for scouts without tools specified)
      const searchResults = await this.executeSearches();

      this.state.status = 'synthesizing';
      this.state.progress = 70;

      this.emitEvent('agent_progress', `${this.blueprint.name} synthesizing findings...`, {
        agentId: this.blueprint.id,
        progress: 70,
      });

      // Analyze results and generate findings
      const analysisResult = await this.analyzeResults(searchResults);

      // Update state
      this.state.status = 'complete';
      this.state.progress = 100;
      this.state.endTime = Date.now();
      this.state.findings = analysisResult.findings;

      const executionTime = Date.now() - startTime;

      this.emitEvent(
        'agent_complete',
        `${this.blueprint.name} complete with ${analysisResult.findings.length} findings`,
        {
          agentId: this.blueprint.id,
          agentName: this.blueprint.name,
        }
      );

      log.info('Scout execution complete', {
        agentId: this.blueprint.id,
        findingsCount: analysisResult.findings.length,
        searchesExecuted: this.state.searchesCompleted,
        executionTimeMs: executionTime,
      });

      return {
        agentId: this.blueprint.id,
        findings: analysisResult.findings,
        summary: analysisResult.summary,
        needsDeeper: analysisResult.needsDeeper,
        childSuggestions: analysisResult.childSuggestions,
        gaps: analysisResult.gaps,
        searchesExecuted: this.state.searchesCompleted,
        tokensUsed: this.state.tokensUsed,
        inputTokens: this.inputTokens,
        outputTokens: this.outputTokens,
        executionTime,
      };
    } catch (error) {
      this.state.status = 'failed';
      this.state.endTime = Date.now();
      const errMsg = error instanceof Error ? error.message : String(error);
      this.state.errors.push(errMsg);

      this.emitEvent('agent_failed', `${this.blueprint.name} failed: ${errMsg}`, {
        agentId: this.blueprint.id,
        error: errMsg,
      });

      log.error('Scout execution failed', { agentId: this.blueprint.id, error });

      return {
        agentId: this.blueprint.id,
        findings: [],
        summary: `Research failed: ${errMsg}`,
        needsDeeper: false,
        childSuggestions: [],
        gaps: ['Research could not be completed'],
        searchesExecuted: this.state.searchesCompleted,
        tokensUsed: this.state.tokensUsed,
        inputTokens: this.inputTokens,
        outputTokens: this.outputTokens,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute research using Claude's native tool calling
   */
  private async executeWithTools(startTime: number): Promise<ScoutResult> {
    try {
      // Set session ID for safety tracking
      setSessionId(this.blueprint.id);

      // Get tool definitions for this scout's assigned tools
      const allToolDefs = getClaudeToolDefinitions();
      const toolDefs = allToolDefs.filter((t: { name: string }) =>
        this.blueprint.tools?.includes(t.name as ScoutToolType)
      );

      log.info('Scout executing with tools', {
        agentId: this.blueprint.id,
        tools: this.blueprint.tools,
      });

      // Build the system prompt
      const systemPrompt = this.buildToolSystemPrompt();

      // Build the initial user message with context
      const userMessage = this.buildToolUserMessage();

      // Message history for the conversation
      const messages: Anthropic.Messages.MessageParam[] = [{ role: 'user', content: userMessage }];

      let iteration = 0;
      let totalToolCost = 0;
      const toolResults: Array<{ tool: string; result: unknown }> = [];

      // Tool calling loop
      while (iteration < this.maxToolIterations) {
        iteration++;

        this.state.progress = Math.round((iteration / this.maxToolIterations) * 60);
        this.emitEvent(
          'agent_progress',
          `${this.blueprint.name} reasoning... (iteration ${iteration})`,
          {
            agentId: this.blueprint.id,
            progress: this.state.progress,
          }
        );

        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: 4096,
          temperature: 0.5,
          system: systemPrompt,
          tools: toolDefs as Anthropic.Messages.Tool[],
          messages,
        });

        // Track token usage (separate for accurate cost calculation)
        const inputToks = response.usage?.input_tokens || 0;
        const outputToks = response.usage?.output_tokens || 0;
        this.inputTokens += inputToks;
        this.outputTokens += outputToks;
        this.state.tokensUsed += inputToks + outputToks;

        // Check if model wants to use tools
        const toolUseBlocks = response.content.filter(
          (block): block is Anthropic.Messages.ToolUseBlock => block.type === 'tool_use'
        );

        if (toolUseBlocks.length === 0) {
          // No more tool calls - model is done, extract final response
          const textContent = response.content
            .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
            .map((block) => block.text)
            .join('\n');

          // Parse and return findings
          this.state.status = 'synthesizing';
          this.state.progress = 80;

          const analysisResult = this.parseAnalysisResponse(textContent);

          this.state.status = 'complete';
          this.state.progress = 100;
          this.state.endTime = Date.now();
          this.state.findings = analysisResult.findings;
          this.state.costIncurred += totalToolCost;

          const executionTime = Date.now() - startTime;

          this.emitEvent(
            'agent_complete',
            `${this.blueprint.name} complete with ${analysisResult.findings.length} findings (${iteration} tool iterations)`,
            {
              agentId: this.blueprint.id,
              agentName: this.blueprint.name,
            }
          );

          log.info('Scout tool execution complete', {
            agentId: this.blueprint.id,
            findingsCount: analysisResult.findings.length,
            toolIterations: iteration,
            toolsUsed: toolResults.length,
            executionTimeMs: executionTime,
          });

          return {
            agentId: this.blueprint.id,
            findings: analysisResult.findings,
            summary: analysisResult.summary,
            needsDeeper: analysisResult.needsDeeper,
            childSuggestions: analysisResult.childSuggestions,
            gaps: analysisResult.gaps,
            searchesExecuted: this.state.searchesCompleted,
            tokensUsed: this.state.tokensUsed,
            inputTokens: this.inputTokens,
            outputTokens: this.outputTokens,
            executionTime,
          };
        }

        // Execute tool calls
        const toolResultContents: Anthropic.Messages.ToolResultBlockParam[] = [];

        for (const toolUse of toolUseBlocks) {
          const toolInput = toolUse.input as Record<string, unknown>;

          // Emit specific event based on tool type for activity feed
          if (toolUse.name === 'brave_search') {
            this.emitEvent('search_executing', `Searching: ${toolInput.query}`, {
              agentId: this.blueprint.id,
              agentName: this.blueprint.name,
              searchQuery: String(toolInput.query || ''),
            });
          } else if (toolUse.name === 'browser_visit') {
            this.emitEvent('browser_visiting', `Visiting: ${toolInput.url}`, {
              agentId: this.blueprint.id,
              agentName: this.blueprint.name,
              url: String(toolInput.url || ''),
            });
          } else if (toolUse.name === 'screenshot') {
            this.emitEvent('screenshot_captured', `Screenshot: ${toolInput.url}`, {
              agentId: this.blueprint.id,
              agentName: this.blueprint.name,
              url: String(toolInput.url || ''),
            });
          } else if (toolUse.name === 'run_code') {
            this.emitEvent('code_executing', `Running ${toolInput.language} code`, {
              agentId: this.blueprint.id,
              agentName: this.blueprint.name,
              language: String(toolInput.language || 'python'),
            });
          } else if (toolUse.name === 'vision_analyze') {
            this.emitEvent('vision_analyzing', `Analyzing: ${toolInput.url}`, {
              agentId: this.blueprint.id,
              agentName: this.blueprint.name,
              url: String(toolInput.url || ''),
              prompt: String(toolInput.prompt || '').slice(0, 50),
            });
          } else if (toolUse.name === 'extract_table') {
            this.emitEvent('table_extracting', `Extracting table: ${toolInput.url}`, {
              agentId: this.blueprint.id,
              agentName: this.blueprint.name,
              url: String(toolInput.url || ''),
            });
          } else if (toolUse.name === 'safe_form_fill') {
            this.emitEvent('form_filling', `Filling form: ${toolInput.url}`, {
              agentId: this.blueprint.id,
              agentName: this.blueprint.name,
              url: String(toolInput.url || ''),
            });
          } else if (toolUse.name === 'paginate') {
            this.emitEvent('paginating', `Paginating: ${toolInput.url}`, {
              agentId: this.blueprint.id,
              agentName: this.blueprint.name,
              url: String(toolInput.url || ''),
              maxPages: Number(toolInput.maxPages || 5),
            });
          } else if (toolUse.name === 'infinite_scroll') {
            this.emitEvent('scrolling', `Scrolling: ${toolInput.url}`, {
              agentId: this.blueprint.id,
              agentName: this.blueprint.name,
              url: String(toolInput.url || ''),
            });
          } else if (toolUse.name === 'click_navigate') {
            this.emitEvent('browser_visiting', `Clicking: ${toolInput.clickSelector}`, {
              agentId: this.blueprint.id,
              agentName: this.blueprint.name,
              url: String(toolInput.url || ''),
            });
          } else if (toolUse.name === 'extract_pdf') {
            this.emitEvent('pdf_extracting', `Extracting PDF: ${toolInput.url}`, {
              agentId: this.blueprint.id,
              agentName: this.blueprint.name,
              url: String(toolInput.url || ''),
            });
          } else if (toolUse.name === 'compare_screenshots') {
            const urls = (toolInput.urls as string[]) || [];
            this.emitEvent('comparing', `Comparing ${urls.length} pages`, {
              agentId: this.blueprint.id,
              agentName: this.blueprint.name,
              urlCount: urls.length,
            });
          } else if (toolUse.name === 'generate_comparison') {
            this.emitEvent('agent_progress', `Generating comparison table`, {
              agentId: this.blueprint.id,
              agentName: this.blueprint.name,
            });
          }

          const call = parseClaudeToolCall(toolUse.name, toolInput);

          if (!call) {
            toolResultContents.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: `Error: Unknown tool ${toolUse.name}`,
              is_error: true,
            });
            continue;
          }

          // Execute the tool
          const result = await executeScoutTool(call);
          totalToolCost += result.costIncurred;

          if (call.tool === 'brave_search') {
            this.state.searchesCompleted++;
          }

          toolResults.push({ tool: toolUse.name, result: result.output });

          this.emitEvent('search_complete', `${toolUse.name} complete`, {
            agentId: this.blueprint.id,
          });

          // Format tool result for Claude
          toolResultContents.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(result.output, null, 2).slice(0, 50000),
            is_error: !result.success,
          });
        }

        // Add assistant message and tool results to conversation
        messages.push({ role: 'assistant', content: response.content });
        messages.push({ role: 'user', content: toolResultContents });
      }

      // Max iterations reached - synthesize what we have
      log.warn('Scout reached max tool iterations', {
        agentId: this.blueprint.id,
        iterations: this.maxToolIterations,
      });

      this.state.status = 'complete';
      this.state.progress = 100;
      this.state.endTime = Date.now();
      this.state.costIncurred += totalToolCost;

      return {
        agentId: this.blueprint.id,
        findings: [],
        summary: 'Research reached maximum iterations',
        needsDeeper: true,
        childSuggestions: [],
        gaps: ['Research incomplete - max iterations reached'],
        searchesExecuted: this.state.searchesCompleted,
        tokensUsed: this.state.tokensUsed,
        inputTokens: this.inputTokens,
        outputTokens: this.outputTokens,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      this.state.status = 'failed';
      this.state.endTime = Date.now();
      const errMsg = error instanceof Error ? error.message : String(error);
      this.state.errors.push(errMsg);

      this.emitEvent('agent_failed', `${this.blueprint.name} failed: ${errMsg}`, {
        agentId: this.blueprint.id,
        error: errMsg,
      });

      log.error('Scout tool execution failed', { agentId: this.blueprint.id, error });

      return {
        agentId: this.blueprint.id,
        findings: [],
        summary: `Research failed: ${errMsg}`,
        needsDeeper: false,
        childSuggestions: [],
        gaps: ['Research could not be completed'],
        searchesExecuted: this.state.searchesCompleted,
        tokensUsed: this.state.tokensUsed,
        inputTokens: this.inputTokens,
        outputTokens: this.outputTokens,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Build system prompt for tool-based execution
   */
  private buildToolSystemPrompt(): string {
    return `You are ${this.blueprint.name}, a specialized research scout.

ROLE: ${this.blueprint.role}
EXPERTISE: ${this.blueprint.expertise.join(', ')}
PURPOSE: ${this.blueprint.purpose}

KEY QUESTIONS TO ANSWER:
${this.blueprint.keyQuestions.map((q) => `• ${q}`).join('\n')}

AVAILABLE TOOLS:
${this.blueprint.tools?.map((t) => `• ${t}`).join('\n') || 'None'}

INSTRUCTIONS:
1. Use your tools to gather information relevant to your key questions
2. Be strategic - don't waste tool calls on irrelevant searches
3. When visiting URLs with browser_visit, extract specific data needed
4. Use run_code for calculations or data processing when helpful
5. Stop when you have enough information to answer your key questions

${AI_SAFETY_PROMPT}

When you have gathered sufficient information, provide your findings in this JSON format:
\`\`\`json
{
  "findings": [
    {
      "type": "fact|insight|recommendation|warning|opportunity|comparison|data|gap",
      "title": "Brief title",
      "content": "Detailed content",
      "confidence": "high|medium|low",
      "relevanceScore": 0.0-1.0,
      "sources": [{"title": "Source name", "url": "optional url"}]
    }
  ],
  "summary": "Executive summary of findings",
  "needsDeeper": false,
  "gaps": ["Any information gaps identified"],
  "childSuggestions": []
}
\`\`\``;
  }

  /**
   * Build initial user message for tool-based execution
   */
  private buildToolUserMessage(): string {
    let message = `Execute your research mission. Here's your context:\n\n`;

    if (this.blueprint.searchQueries.length > 0) {
      message += `SUGGESTED SEARCH QUERIES (use as starting points):\n${this.blueprint.searchQueries.map((q) => `• ${q}`).join('\n')}\n\n`;
    }

    if (this.blueprint.browserTargets && this.blueprint.browserTargets.length > 0) {
      message += `SPECIFIC URLS TO VISIT:\n${this.blueprint.browserTargets.map((u) => `• ${u}`).join('\n')}\n\n`;
    }

    message += `Begin your research now. Use your tools to gather information, then provide your findings.`;

    return message;
  }

  /**
   * Get current state
   */
  getState(): ScoutState {
    return { ...this.state };
  }

  /**
   * Get blueprint
   */
  getBlueprint(): AgentBlueprint {
    return this.blueprint;
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Execute all search queries
   */
  private async executeSearches(): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const queries = this.blueprint.searchQueries;

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];

      this.emitEvent('search_executing', `Searching: ${query.slice(0, 50)}...`, {
        agentId: this.blueprint.id,
        searchQuery: query,
      });

      try {
        // Execute Brave search
        const searchResult = await braveWebSearch({ query, count: 10, extraSnippets: true });

        // Format results
        const formattedResults = this.formatSearchResults(searchResult);
        results.set(query, formattedResults);

        this.state.searchesCompleted++;
        this.state.costIncurred += this.costPerQuery;

        // Update progress
        this.state.progress = Math.round(((i + 1) / queries.length) * 60); // 0-60% for searches

        this.emitEvent('search_complete', `Search complete: ${query.slice(0, 30)}...`, {
          agentId: this.blueprint.id,
        });

        // Small delay to avoid rate limiting
        if (i < queries.length - 1) {
          await this.sleep(200);
        }
      } catch (error) {
        log.warn('Search failed', { query, error });
        this.state.errors.push(`Search failed: ${query}`);
        results.set(query, 'Search failed - no results');
      }
    }

    return results;
  }

  /**
   * Format Brave search results
   */
  private formatSearchResults(searchResult: BraveSearchResponse): string {
    if (!searchResult.webResults?.length) {
      return 'No results found';
    }

    return searchResult.webResults
      .slice(0, 8)
      .map((r: BraveWebResult, i: number) => {
        const description = r.description || '';
        const snippet = r.extraSnippets?.join(' ') || '';
        return `[${i + 1}] ${r.title}\nURL: ${r.url}\n${description}\n${snippet}`.trim();
      })
      .join('\n\n');
  }

  /**
   * Analyze search results and generate findings
   */
  private async analyzeResults(searchResults: Map<string, string>): Promise<{
    findings: Finding[];
    summary: string;
    needsDeeper: boolean;
    childSuggestions: Partial<AgentBlueprint>[];
    gaps: string[];
  }> {
    // Build the prompt with search results
    const searchContext = Array.from(searchResults.entries())
      .map(([query, results]) => `QUERY: ${query}\n\nRESULTS:\n${results}`)
      .join('\n\n---\n\n');

    const prompt = this.scoutPrompt
      .replace('{AGENT_NAME}', this.blueprint.name)
      .replace('{AGENT_ROLE}', this.blueprint.role)
      .replace('{EXPERTISE}', this.blueprint.expertise.join(', '))
      .replace('{PURPOSE}', this.blueprint.purpose)
      .replace('{KEY_QUESTIONS}', this.blueprint.keyQuestions.map((q) => `• ${q}`).join('\n'))
      .replace('{SEARCH_QUERIES}', this.blueprint.searchQueries.join('\n'));

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      temperature: 0.5,
      system: prompt,
      messages: [
        {
          role: 'user',
          content: `Here are your search results. Analyze them and provide your findings:\n\n${searchContext}`,
        },
      ],
    });

    // Track token usage (separate for accurate cost calculation)
    const inputToks = response.usage?.input_tokens || 0;
    const outputToks = response.usage?.output_tokens || 0;
    this.inputTokens += inputToks;
    this.outputTokens += outputToks;
    this.state.tokensUsed += inputToks + outputToks;

    const textContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    // Parse the response
    return this.parseAnalysisResponse(textContent);
  }

  /**
   * Parse analysis response
   * Uses robust JSON extraction with repair for malformed LLM outputs
   */
  private parseAnalysisResponse(response: string): {
    findings: Finding[];
    summary: string;
    needsDeeper: boolean;
    childSuggestions: Partial<AgentBlueprint>[];
    gaps: string[];
  } {
    // Use robust JSON extraction with repair capabilities
    const parsed = extractJSON<{
      findings?: Array<Record<string, unknown>>;
      summary?: string;
      needsDeeper?: boolean;
      childSuggestions?: Partial<AgentBlueprint>[];
      gaps?: string[];
    }>(response);

    if (!parsed) {
      // Create a basic finding from the text (no JSON found or repair failed)
      log.info('No JSON found in scout response, extracting summary from text');
      return {
        findings: [
          {
            id: `finding_${Date.now()}`,
            agentId: this.blueprint.id,
            agentName: this.blueprint.name,
            type: 'insight',
            title: 'Research Summary',
            content: response.slice(0, 1000),
            confidence: 'medium',
            sources: [],
            timestamp: Date.now(),
            relevanceScore: 0.7,
          },
        ],
        summary: response.slice(0, 500),
        needsDeeper: false,
        childSuggestions: [],
        gaps: [],
      };
    }

    const findings: Finding[] = (parsed.findings || []).map(
      (f: Record<string, unknown>, i: number) => ({
        id: `finding_${this.blueprint.id}_${i}`,
        agentId: this.blueprint.id,
        agentName: this.blueprint.name,
        type: this.normalizeType(f.type),
        title: String(f.title || 'Finding'),
        content: String(f.content || ''),
        confidence: this.normalizeConfidence(f.confidence),
        sources: this.normalizeSources(f.sources),
        dataPoints: this.normalizeDataPoints(f.dataPoints),
        timestamp: Date.now(),
        relevanceScore: Number(f.relevanceScore) || 0.7,
      })
    );

    return {
      findings,
      summary: String(parsed.summary || ''),
      needsDeeper: Boolean(parsed.needsDeeper),
      childSuggestions: Array.isArray(parsed.childSuggestions) ? parsed.childSuggestions : [],
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps.map(String) : [],
    };
  }

  /**
   * Normalize finding type
   */
  private normalizeType(raw: unknown): FindingType {
    const value = String(raw).toLowerCase();
    const valid: FindingType[] = [
      'fact',
      'insight',
      'recommendation',
      'warning',
      'opportunity',
      'comparison',
      'data',
      'gap',
    ];
    return valid.includes(value as FindingType) ? (value as FindingType) : 'insight';
  }

  /**
   * Normalize confidence level
   */
  private normalizeConfidence(raw: unknown): 'high' | 'medium' | 'low' {
    const value = String(raw).toLowerCase();
    if (value === 'high' || value === 'medium' || value === 'low') {
      return value;
    }
    return 'medium';
  }

  /**
   * Normalize sources
   */
  private normalizeSources(raw: unknown): SourceCitation[] {
    if (!Array.isArray(raw)) return [];

    return raw.map((s): SourceCitation => {
      if (typeof s === 'string') {
        return {
          title: s,
          type: 'web',
          accessedAt: Date.now(),
          reliability: 'medium',
        };
      }
      const source = s as Record<string, unknown>;
      return {
        title: String(source.title || 'Source'),
        url: source.url ? String(source.url) : undefined,
        type: 'web',
        accessedAt: Date.now(),
        reliability: 'medium',
      };
    });
  }

  /**
   * Normalize data points
   */
  private normalizeDataPoints(raw: unknown): DataPoint[] | undefined {
    if (!Array.isArray(raw)) return undefined;

    return raw.map((d): DataPoint => {
      const point = d as Record<string, unknown>;
      return {
        label: String(point.label || ''),
        value: point.value as string | number,
        unit: point.unit ? String(point.unit) : undefined,
        source: point.source ? String(point.source) : undefined,
      };
    });
  }

  /**
   * Emit stream event
   */
  private emitEvent(
    type:
      | 'agent_progress'
      | 'agent_complete'
      | 'agent_failed'
      | 'search_executing'
      | 'search_complete'
      | 'browser_visiting'
      | 'screenshot_captured'
      | 'code_executing'
      // New tool events
      | 'vision_analyzing'
      | 'table_extracting'
      | 'form_filling'
      | 'paginating'
      | 'scrolling'
      | 'pdf_extracting'
      | 'comparing',
    message: string,
    data: Record<string, unknown>
  ): void {
    if (this.onStream) {
      this.onStream({
        type,
        message,
        timestamp: Date.now(),
        data: data as Parameters<StrategyStreamCallback>[0]['data'],
      });
    }
  }

  /**
   * Sleep helper
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createScout(
  client: Anthropic,
  blueprint: AgentBlueprint,
  onStream?: StrategyStreamCallback,
  scoutPrompt?: string
): Scout {
  return new Scout(client, blueprint, onStream, scoutPrompt);
}

// =============================================================================
// BATCH EXECUTION
// =============================================================================

/**
 * Execute multiple scouts in batches
 *
 * IMPORTANT: This function snapshots the blueprints array at the start to prevent
 * race conditions if new blueprints are added mid-iteration (e.g., via steering).
 * Any scouts added after iteration starts will NOT be executed by this generator -
 * they should be handled separately by the calling code.
 */
export async function* executeScoutBatch(
  client: Anthropic,
  blueprints: AgentBlueprint[],
  batchSize: number = 5,
  delayMs: number = 500,
  onStream?: StrategyStreamCallback,
  scoutPrompt?: string
): AsyncGenerator<ScoutResult> {
  // CRITICAL: Snapshot the blueprints array to prevent race conditions
  // If steering adds new scouts mid-execution, they won't be picked up here
  // (the caller handles them separately in the "unexecuted steering scouts" loop)
  const blueprintSnapshot = [...blueprints];
  const initialCount = blueprintSnapshot.length;

  log.info('Starting scout batch execution', { totalScouts: initialCount, batchSize });

  for (let i = 0; i < initialCount; i += batchSize) {
    const batch = blueprintSnapshot.slice(i, i + batchSize);

    // Execute batch concurrently
    const scouts = batch.map((bp) => createScout(client, bp, onStream, scoutPrompt));
    const results = await Promise.allSettled(scouts.map((s) => s.execute()));

    // Yield results
    for (const result of results) {
      if (result.status === 'fulfilled') {
        yield result.value;
      } else {
        log.error('Scout batch execution failed', { error: result.reason });
      }
    }

    // Delay between batches
    if (i + batchSize < initialCount) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
