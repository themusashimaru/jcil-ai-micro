/**
 * DEEP EXECUTION TRACER
 *
 * Traces code execution paths across the entire codebase.
 * This is like having X-ray vision into how code flows.
 *
 * Capabilities:
 * - Control flow analysis
 * - Data flow tracking
 * - Side effect identification
 * - Cross-function tracing
 * - Async flow visualization
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';
import {
  ExecutionPath,
  Variable,
  VariableMutation,
  SideEffect,
  DebugLanguage,
  SourceLocation,
} from './types';

const log = logger('DeepExecutionTracer');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// EXECUTION TRACER
// ============================================================================

export class DeepExecutionTracer {
  /**
   * Trace all possible execution paths through code
   */
  async traceExecutionPaths(
    code: string,
    language: DebugLanguage,
    options: {
      entryPoint?: string;
      maxDepth?: number;
      includeAsync?: boolean;
    } = {}
  ): Promise<ExecutionPath[]> {
    const maxDepth = options.maxDepth || 10;

    log.info('Tracing execution paths', { language, maxDepth });

    // Phase 1: Parse structure
    const structure = this.parseCodeStructure(code, language);

    // Phase 2: Identify entry points
    const entryPoints = options.entryPoint
      ? [options.entryPoint]
      : this.identifyEntryPoints(code, language);

    // Phase 3: Trace paths from each entry point
    const paths: ExecutionPath[] = [];

    for (const entry of entryPoints) {
      const tracedPaths = await this.traceFromEntry(code, language, entry, structure, maxDepth);
      paths.push(...tracedPaths);
    }

    // Phase 4: Analyze async flows if requested
    if (options.includeAsync !== false) {
      const asyncPaths = await this.traceAsyncFlows(code, language);
      paths.push(...asyncPaths);
    }

    return paths;
  }

  /**
   * Parse code structure for analysis
   */
  private parseCodeStructure(code: string, _language: DebugLanguage): CodeStructure {
    const lines = code.split('\n');
    const structure: CodeStructure = {
      functions: [],
      branches: [],
      loops: [],
      calls: [],
      assignments: [],
    };

    // Simple pattern-based parsing (would use AST in production)
    lines.forEach((line, i) => {
      const lineNum = i + 1;

      // Functions
      const funcMatch = line.match(
        /(?:function|def|fn|func)\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/
      );
      if (funcMatch) {
        structure.functions.push({
          name: funcMatch[1] || funcMatch[2],
          line: lineNum,
          isAsync: line.includes('async'),
        });
      }

      // Arrow functions
      const arrowMatch = line.match(
        /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z_]\w*)\s*=>/
      );
      if (arrowMatch) {
        structure.functions.push({
          name: arrowMatch[1],
          line: lineNum,
          isAsync: line.includes('async'),
        });
      }

      // Branches
      if (/\bif\s*\(/.test(line)) {
        structure.branches.push({ type: 'if', line: lineNum });
      }
      if (/\belse\s*\{/.test(line) || /\belse\s+if/.test(line)) {
        structure.branches.push({ type: 'else', line: lineNum });
      }
      if (/\bswitch\s*\(/.test(line)) {
        structure.branches.push({ type: 'switch', line: lineNum });
      }
      if (/\?.*:/.test(line)) {
        structure.branches.push({ type: 'ternary', line: lineNum });
      }

      // Loops
      if (/\bfor\s*\(/.test(line) || /\bfor\s+\w+\s+(?:in|of)/.test(line)) {
        structure.loops.push({ type: 'for', line: lineNum });
      }
      if (/\bwhile\s*\(/.test(line)) {
        structure.loops.push({ type: 'while', line: lineNum });
      }
      if (/\.forEach\s*\(/.test(line) || /\.map\s*\(/.test(line)) {
        structure.loops.push({ type: 'iterator', line: lineNum });
      }

      // Function calls
      const callMatches = line.matchAll(/(\w+)\s*\(/g);
      for (const match of callMatches) {
        if (!['if', 'for', 'while', 'switch', 'function', 'catch'].includes(match[1])) {
          structure.calls.push({ name: match[1], line: lineNum });
        }
      }

      // Assignments
      const assignMatch = line.match(/(?:const|let|var)?\s*(\w+)\s*=(?!=)/);
      if (assignMatch) {
        structure.assignments.push({ variable: assignMatch[1], line: lineNum });
      }
    });

    return structure;
  }

  /**
   * Identify entry points in the code
   */
  private identifyEntryPoints(code: string, _language: DebugLanguage): string[] {
    const entryPoints: string[] = [];
    const lines = code.split('\n');

    // Common entry point patterns
    lines.forEach((line, _i) => {
      // Module exports
      if (/export\s+(?:default\s+)?(?:function|class|const)?\s*(\w+)/.test(line)) {
        const match = line.match(/export\s+(?:default\s+)?(?:function|class|const)?\s*(\w+)/);
        if (match) entryPoints.push(match[1]);
      }

      // Main function
      if (/(?:function|def|fn)\s+main\s*\(/.test(line)) {
        entryPoints.push('main');
      }

      // Event handlers
      if (/\.addEventListener\s*\(\s*['"](\w+)['"]/.test(line)) {
        entryPoints.push(`event:${line.match(/\.addEventListener\s*\(\s*['"](\w+)['"]/)?.[1]}`);
      }

      // Express/HTTP handlers
      if (/\.(get|post|put|delete|patch)\s*\(/.test(line)) {
        entryPoints.push(`http:${line.match(/\.(get|post|put|delete|patch)/)?.[1]}`);
      }
    });

    // If no entry points found, use first function
    if (entryPoints.length === 0) {
      const firstFunc = code.match(
        /(?:function|def|fn|const|let|var)\s+(\w+)\s*(?:=\s*(?:async\s*)?\(|\()/
      );
      if (firstFunc) entryPoints.push(firstFunc[1]);
    }

    return entryPoints;
  }

  /**
   * Trace execution from a specific entry point
   */
  private async traceFromEntry(
    code: string,
    language: DebugLanguage,
    entry: string,
    _structure: CodeStructure,
    _maxDepth: number
  ): Promise<ExecutionPath[]> {
    // Use AI for complex path analysis
    const prompt = `Trace the execution path starting from "${entry}" in this ${language} code.

CODE:
\`\`\`${language}
${code}
\`\`\`

Trace the path and identify:
1. Each step in order (what happens, which line)
2. What variables are read/written
3. What side effects occur (I/O, state changes, network)
4. Branch points (where execution could go different ways)
5. Loop iterations (how many times loops might execute)

Return JSON:
{
  "pathName": "descriptive name",
  "steps": [{
    "line": number,
    "operation": "what happens",
    "inputs": [{ "name": "var", "type": "type" }],
    "outputs": [{ "name": "var", "type": "type" }],
    "sideEffects": [{
      "type": "io" | "state" | "network" | "database" | "file" | "memory" | "external",
      "description": "what happens",
      "reversible": boolean,
      "idempotent": boolean
    }],
    "branches": [{
      "condition": "the condition",
      "trueProbability": 0.0-1.0
    }]
  }],
  "complexity": number (1-10),
  "isCritical": boolean
}`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]);

      return [
        {
          id: `path_${entry}_${Date.now()}`,
          name: parsed.pathName || `Path from ${entry}`,
          steps: (parsed.steps || []).map((step: Record<string, unknown>) => ({
            location: { file: 'current', line: Number(step.line) || 1 },
            operation: String(step.operation || ''),
            inputs: Array.isArray(step.inputs)
              ? step.inputs.map((v: Record<string, unknown>) => ({
                  name: String(v.name || ''),
                  type: String(v.type || 'unknown'),
                  isMutable: false,
                }))
              : [],
            outputs: Array.isArray(step.outputs)
              ? step.outputs.map((v: Record<string, unknown>) => ({
                  name: String(v.name || ''),
                  type: String(v.type || 'unknown'),
                  isMutable: true,
                }))
              : [],
            sideEffects: Array.isArray(step.sideEffects)
              ? step.sideEffects.map((s: Record<string, unknown>) => ({
                  type: String(s.type || 'state') as SideEffect['type'],
                  description: String(s.description || ''),
                  reversible: Boolean(s.reversible),
                  idempotent: Boolean(s.idempotent),
                }))
              : [],
            branches: Array.isArray(step.branches)
              ? step.branches.map((b: Record<string, unknown>) => ({
                  condition: String(b.condition || ''),
                  truePath: 'next',
                  probability: {
                    true: Number(b.trueProbability) || 0.5,
                    false: 1 - (Number(b.trueProbability) || 0.5),
                  },
                }))
              : [],
          })),
          probability: 1.0,
          complexity: Number(parsed.complexity) || 1,
          isCritical: Boolean(parsed.isCritical),
        },
      ];
    } catch (error) {
      log.warn('Failed to trace from entry', { entry, error });
      return [];
    }
  }

  /**
   * Trace async flows (promises, callbacks, events)
   */
  private async traceAsyncFlows(code: string, _language: DebugLanguage): Promise<ExecutionPath[]> {
    const paths: ExecutionPath[] = [];
    const lines = code.split('\n');

    // Find async operations
    const asyncOps: { line: number; type: string }[] = [];

    lines.forEach((line, i) => {
      if (/\bawait\s+/.test(line)) {
        asyncOps.push({ line: i + 1, type: 'await' });
      }
      if (/\.then\s*\(/.test(line)) {
        asyncOps.push({ line: i + 1, type: 'then' });
      }
      if (/new\s+Promise\s*\(/.test(line)) {
        asyncOps.push({ line: i + 1, type: 'promise' });
      }
      if (/setTimeout|setInterval/.test(line)) {
        asyncOps.push({ line: i + 1, type: 'timer' });
      }
    });

    if (asyncOps.length > 0) {
      paths.push({
        id: `async_flow_${Date.now()}`,
        name: 'Async Operations Flow',
        steps: asyncOps.map((op) => ({
          location: { file: 'current', line: op.line },
          operation: `Async ${op.type}`,
          inputs: [],
          outputs: [],
          sideEffects: [
            {
              type: 'state' as const,
              description: 'Async boundary - execution order may vary',
              reversible: false,
              idempotent: false,
            },
          ],
          branches: [],
        })),
        probability: 1.0,
        complexity: asyncOps.length,
        isCritical: asyncOps.length > 3,
      });
    }

    return paths;
  }

  /**
   * Track variable mutations through code
   */
  async trackVariableMutations(
    code: string,
    _language: DebugLanguage,
    variableName: string
  ): Promise<Variable & { mutations: VariableMutation[] }> {
    const lines = code.split('\n');
    const mutations: VariableMutation[] = [];
    let origin: SourceLocation | undefined;
    let type = 'unknown';

    lines.forEach((line, i) => {
      // Find declaration
      const declMatch = line.match(
        new RegExp(`(?:const|let|var)\\s+${variableName}\\s*(?::\\s*(\\w+))?\\s*=`)
      );
      if (declMatch) {
        origin = { file: 'current', line: i + 1 };
        type = declMatch[1] || 'unknown';
      }

      // Find mutations
      const mutationMatch = line.match(
        new RegExp(`${variableName}\\s*(?:\\+\\+|--|=(?!=)|\\+=|-=|\\*=|\\/=|\\|\\|=|&&=|\\?\\?=)`)
      );
      if (mutationMatch && !declMatch) {
        mutations.push({
          location: { file: 'current', line: i + 1 },
          operation: line.trim(),
        });
      }

      // Find method calls that might mutate
      const methodMatch = line.match(
        new RegExp(
          `${variableName}\\.(push|pop|shift|unshift|splice|sort|reverse|fill|set|delete|clear|add)\\s*\\(`
        )
      );
      if (methodMatch) {
        mutations.push({
          location: { file: 'current', line: i + 1 },
          operation: `${methodMatch[1]}()`,
        });
      }
    });

    return {
      name: variableName,
      type,
      isMutable: mutations.length > 0,
      origin,
      mutations,
    };
  }

  /**
   * Identify all side effects in code
   */
  async identifySideEffects(
    code: string,
    _language: DebugLanguage
  ): Promise<Array<SideEffect & { location: SourceLocation }>> {
    const sideEffects: Array<SideEffect & { location: SourceLocation }> = [];
    const lines = code.split('\n');

    // Side effect patterns
    const patterns: Array<{
      pattern: RegExp;
      type: SideEffect['type'];
      reversible: boolean;
      idempotent: boolean;
    }> = [
      {
        pattern: /console\.(log|warn|error|info)/,
        type: 'io',
        reversible: false,
        idempotent: true,
      },
      { pattern: /fetch\s*\(|axios|http\./, type: 'network', reversible: false, idempotent: false },
      {
        pattern: /\.query\s*\(|\.execute\s*\(|INSERT|UPDATE|DELETE/,
        type: 'database',
        reversible: false,
        idempotent: false,
      },
      {
        pattern: /fs\.|readFile|writeFile|createWriteStream/,
        type: 'file',
        reversible: true,
        idempotent: false,
      },
      {
        pattern: /localStorage|sessionStorage|cookie/,
        type: 'state',
        reversible: true,
        idempotent: true,
      },
      { pattern: /window\.|document\.|DOM/, type: 'external', reversible: true, idempotent: false },
      {
        pattern: /new\s+\w+\s*\(|malloc|alloc/,
        type: 'memory',
        reversible: true,
        idempotent: false,
      },
    ];

    lines.forEach((line, i) => {
      for (const { pattern, type, reversible, idempotent } of patterns) {
        if (pattern.test(line)) {
          sideEffects.push({
            type,
            description: line.trim(),
            reversible,
            idempotent,
            location: { file: 'current', line: i + 1 },
          });
        }
      }
    });

    return sideEffects;
  }

  /**
   * Generate execution trace for debugging
   */
  async generateExecutionTrace(
    code: string,
    language: DebugLanguage,
    inputs: Record<string, unknown>
  ): Promise<string> {
    const prompt = `Simulate execution of this ${language} code with the given inputs and generate a trace.

CODE:
\`\`\`${language}
${code}
\`\`\`

INPUTS: ${JSON.stringify(inputs)}

Generate a step-by-step execution trace showing:
1. Line number
2. What executes
3. Variable values after execution
4. Any side effects

Format as a readable trace like:
Line X: [operation] → [result]
  Variables: { ... }
  Side effects: ...`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-opus-4-6-20260205',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      });

      return response.content[0].type === 'text' ? response.content[0].text : '';
    } catch (error) {
      log.warn('Failed to generate execution trace', { error });
      return 'Trace generation failed';
    }
  }
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

interface CodeStructure {
  functions: Array<{ name: string; line: number; isAsync: boolean }>;
  branches: Array<{ type: string; line: number }>;
  loops: Array<{ type: string; line: number }>;
  calls: Array<{ name: string; line: number }>;
  assignments: Array<{ variable: string; line: number }>;
}
