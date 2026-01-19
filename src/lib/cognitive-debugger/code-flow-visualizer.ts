/**
 * CODE FLOW VISUALIZER
 *
 * Creates visual representations of code execution flow.
 * Makes the invisible visible - data flow, control flow, and dependencies.
 *
 * Output formats:
 * - Mermaid diagrams (for web rendering)
 * - ASCII art (for terminal)
 * - Structured data (for programmatic use)
 */

import { logger } from '@/lib/logger';
import { ExecutionPath, DebugLanguage, Severity } from './types';

const log = logger('CodeFlowVisualizer');

// ============================================================================
// CODE FLOW VISUALIZER
// ============================================================================

export class CodeFlowVisualizer {
  /**
   * Visualize code flow in multiple formats
   */
  async visualize(
    code: string,
    language: DebugLanguage
  ): Promise<{
    mermaid: string;
    ascii: string;
    hotspots: Array<{ line: number; severity: Severity; reason: string }>;
  }> {
    log.info('Visualizing code flow', { language });

    // Parse code structure
    const structure = this.parseStructure(code);

    // Generate Mermaid diagram
    const mermaid = this.generateMermaid(structure);

    // Generate ASCII representation
    const ascii = this.generateAscii(structure);

    // Identify hotspots
    const hotspots = this.identifyHotspots(structure, code);

    return { mermaid, ascii, hotspots };
  }

  /**
   * Generate execution path diagram
   */
  generatePathDiagram(paths: ExecutionPath[]): string {
    if (paths.length === 0) return 'No execution paths detected';

    let diagram = 'flowchart TD\n';

    for (const path of paths) {
      diagram += `  subgraph ${this.sanitizeId(path.name)}\n`;
      diagram += `    direction TB\n`;

      for (let i = 0; i < path.steps.length; i++) {
        const step = path.steps[i];
        const nodeId = `${this.sanitizeId(path.id)}_${i}`;
        const label = this.truncate(step.operation, 30);

        diagram += `    ${nodeId}["${label}"]\n`;

        if (i > 0) {
          const prevId = `${this.sanitizeId(path.id)}_${i - 1}`;
          diagram += `    ${prevId} --> ${nodeId}\n`;
        }

        // Add side effect indicators
        if (step.sideEffects.length > 0) {
          const sideEffectId = `${nodeId}_se`;
          diagram += `    ${nodeId} -.-> ${sideEffectId}((${step.sideEffects[0].type}))\n`;
        }
      }

      diagram += `  end\n`;
    }

    return diagram;
  }

  /**
   * Parse code structure for visualization
   */
  private parseStructure(code: string): CodeStructure {
    const lines = code.split('\n');
    const structure: CodeStructure = {
      nodes: [],
      edges: [],
      functions: [],
      branches: [],
      loops: [],
      sideEffects: [],
    };

    let currentFunction: string | null = null;
    const branchStack: number[] = [];
    const loopStack: number[] = [];

    lines.forEach((line, i) => {
      const lineNum = i + 1;
      const trimmed = line.trim();

      // Detect functions
      const funcMatch = trimmed.match(
        /(?:function|def|fn|func)\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/
      );
      if (funcMatch) {
        const name = funcMatch[1] || funcMatch[2];
        structure.functions.push({ name, startLine: lineNum, endLine: lineNum });
        currentFunction = name;
        structure.nodes.push({
          id: `func_${name}`,
          label: name,
          type: 'function',
          line: lineNum,
        });
      }

      // Detect branches
      if (/\bif\s*\(/.test(trimmed)) {
        structure.branches.push({ line: lineNum, type: 'if' });
        branchStack.push(lineNum);
        structure.nodes.push({
          id: `branch_${lineNum}`,
          label: 'if',
          type: 'branch',
          line: lineNum,
        });
      }
      if (/\belse\b/.test(trimmed) && branchStack.length > 0) {
        structure.edges.push({
          from: `branch_${branchStack[branchStack.length - 1]}`,
          to: `else_${lineNum}`,
          label: 'false',
        });
        structure.nodes.push({
          id: `else_${lineNum}`,
          label: 'else',
          type: 'branch',
          line: lineNum,
        });
      }

      // Detect loops
      if (/\bfor\s*\(|\bwhile\s*\(/.test(trimmed)) {
        const type = trimmed.includes('while') ? 'while' : 'for';
        structure.loops.push({ line: lineNum, type });
        loopStack.push(lineNum);
        structure.nodes.push({
          id: `loop_${lineNum}`,
          label: type,
          type: 'loop',
          line: lineNum,
        });
      }

      // Detect side effects
      if (/console\.|fetch\(|\.query\(|fs\./.test(trimmed)) {
        const type = trimmed.includes('fetch')
          ? 'network'
          : trimmed.includes('query')
            ? 'database'
            : trimmed.includes('fs.')
              ? 'file'
              : 'io';
        structure.sideEffects.push({ line: lineNum, type });
        structure.nodes.push({
          id: `side_${lineNum}`,
          label: type,
          type: 'sideEffect',
          line: lineNum,
        });
      }

      // Track function calls
      const callMatches = trimmed.matchAll(/(\w+)\s*\(/g);
      for (const match of callMatches) {
        if (!['if', 'for', 'while', 'switch', 'function', 'catch'].includes(match[1])) {
          structure.edges.push({
            from: currentFunction ? `func_${currentFunction}` : 'main',
            to: `call_${match[1]}_${lineNum}`,
            label: 'calls',
          });
        }
      }

      // Detect closing braces (simplified)
      if (/^\s*\}\s*$/.test(line)) {
        if (branchStack.length > 0) {
          branchStack.pop();
        } else if (loopStack.length > 0) {
          loopStack.pop();
        } else if (currentFunction) {
          const func = structure.functions.find((f) => f.name === currentFunction);
          if (func) func.endLine = lineNum;
          currentFunction = null;
        }
      }
    });

    return structure;
  }

  /**
   * Generate Mermaid flowchart
   */
  private generateMermaid(structure: CodeStructure): string {
    let diagram = 'flowchart TD\n';
    diagram += '  classDef function fill:#4CAF50,stroke:#2E7D32,color:white\n';
    diagram += '  classDef branch fill:#2196F3,stroke:#1565C0,color:white\n';
    diagram += '  classDef loop fill:#FF9800,stroke:#EF6C00,color:white\n';
    diagram += '  classDef sideEffect fill:#F44336,stroke:#C62828,color:white\n\n';

    // Add nodes
    for (const node of structure.nodes) {
      const shape = this.getNodeShape(node.type);
      diagram += `  ${node.id}${shape[0]}"${node.label} (L${node.line})"${shape[1]}\n`;
    }

    diagram += '\n';

    // Add edges
    for (const edge of structure.edges) {
      const label = edge.label ? `|${edge.label}|` : '';
      diagram += `  ${edge.from} -->${label} ${edge.to}\n`;
    }

    diagram += '\n';

    // Apply classes
    const functionNodes = structure.nodes.filter((n) => n.type === 'function').map((n) => n.id);
    const branchNodes = structure.nodes.filter((n) => n.type === 'branch').map((n) => n.id);
    const loopNodes = structure.nodes.filter((n) => n.type === 'loop').map((n) => n.id);
    const sideEffectNodes = structure.nodes.filter((n) => n.type === 'sideEffect').map((n) => n.id);

    if (functionNodes.length) diagram += `  class ${functionNodes.join(',')} function\n`;
    if (branchNodes.length) diagram += `  class ${branchNodes.join(',')} branch\n`;
    if (loopNodes.length) diagram += `  class ${loopNodes.join(',')} loop\n`;
    if (sideEffectNodes.length) diagram += `  class ${sideEffectNodes.join(',')} sideEffect\n`;

    return diagram;
  }

  /**
   * Generate ASCII visualization
   */
  private generateAscii(structure: CodeStructure): string {
    let ascii = '╔══════════════════════════════════════════╗\n';
    ascii += '║           CODE FLOW VISUALIZATION          ║\n';
    ascii += '╚══════════════════════════════════════════╝\n\n';

    // Functions
    if (structure.functions.length > 0) {
      ascii += '📦 FUNCTIONS:\n';
      for (const func of structure.functions) {
        ascii += `   ├─ ${func.name} (L${func.startLine}-${func.endLine})\n`;
      }
      ascii += '\n';
    }

    // Control flow
    if (structure.branches.length > 0 || structure.loops.length > 0) {
      ascii += '🔀 CONTROL FLOW:\n';
      for (const branch of structure.branches) {
        ascii += `   ├─ ${branch.type} (L${branch.line})\n`;
      }
      for (const loop of structure.loops) {
        ascii += `   ├─ ${loop.type} loop (L${loop.line})\n`;
      }
      ascii += '\n';
    }

    // Side effects
    if (structure.sideEffects.length > 0) {
      ascii += '⚡ SIDE EFFECTS:\n';
      for (const se of structure.sideEffects) {
        const icon =
          se.type === 'network'
            ? '🌐'
            : se.type === 'database'
              ? '🗄️'
              : se.type === 'file'
                ? '📁'
                : '📝';
        ascii += `   ├─ ${icon} ${se.type} (L${se.line})\n`;
      }
      ascii += '\n';
    }

    // Summary
    ascii += '📊 SUMMARY:\n';
    ascii += `   ├─ Functions: ${structure.functions.length}\n`;
    ascii += `   ├─ Branches: ${structure.branches.length}\n`;
    ascii += `   ├─ Loops: ${structure.loops.length}\n`;
    ascii += `   └─ Side Effects: ${structure.sideEffects.length}\n`;

    return ascii;
  }

  /**
   * Identify code hotspots
   */
  private identifyHotspots(
    structure: CodeStructure,
    code: string
  ): Array<{ line: number; severity: Severity; reason: string }> {
    const hotspots: Array<{ line: number; severity: Severity; reason: string }> = [];
    const lines = code.split('\n');

    // Loops with side effects are hotspots
    for (const loop of structure.loops) {
      const loopSideEffects = structure.sideEffects.filter(
        (se) => Math.abs(se.line - loop.line) < 10
      );
      if (loopSideEffects.length > 0) {
        hotspots.push({
          line: loop.line,
          severity: 'high',
          reason: `Loop with ${loopSideEffects.length} side effect(s) - potential performance issue`,
        });
      }
    }

    // Nested branches
    let branchDepth = 0;
    lines.forEach((line, i) => {
      if (/\bif\s*\(/.test(line)) {
        branchDepth++;
        if (branchDepth >= 3) {
          hotspots.push({
            line: i + 1,
            severity: 'medium',
            reason: `Deeply nested conditionals (depth: ${branchDepth}) - consider refactoring`,
          });
        }
      }
      if (/^\s*\}/.test(line)) {
        branchDepth = Math.max(0, branchDepth - 1);
      }
    });

    // Long functions
    for (const func of structure.functions) {
      const length = func.endLine - func.startLine;
      if (length > 50) {
        hotspots.push({
          line: func.startLine,
          severity: 'low',
          reason: `Long function (${length} lines) - consider breaking into smaller functions`,
        });
      }
    }

    // Multiple side effects in sequence
    for (let i = 0; i < structure.sideEffects.length - 1; i++) {
      if (structure.sideEffects[i + 1].line - structure.sideEffects[i].line <= 3) {
        hotspots.push({
          line: structure.sideEffects[i].line,
          severity: 'medium',
          reason: 'Multiple sequential side effects - consider batching or error handling',
        });
      }
    }

    return hotspots.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * Generate data flow diagram
   */
  generateDataFlowDiagram(code: string, _language: DebugLanguage): string {
    let diagram = 'flowchart LR\n';
    diagram += '  subgraph Input\n';
    diagram += '    I1[User Input]\n';
    diagram += '    I2[API Request]\n';
    diagram += '    I3[Database]\n';
    diagram += '  end\n\n';

    diagram += '  subgraph Processing\n';
    diagram += '    P1[Validation]\n';
    diagram += '    P2[Transform]\n';
    diagram += '    P3[Business Logic]\n';
    diagram += '  end\n\n';

    diagram += '  subgraph Output\n';
    diagram += '    O1[Response]\n';
    diagram += '    O2[Database Write]\n';
    diagram += '    O3[External API]\n';
    diagram += '  end\n\n';

    // Add edges based on code patterns
    if (/req\.|request\./.test(code)) {
      diagram += '  I1 --> P1\n';
      diagram += '  I2 --> P1\n';
    }
    if (/validate|check|assert/.test(code)) {
      diagram += '  P1 --> P2\n';
    }
    if (/transform|map|reduce/.test(code)) {
      diagram += '  P2 --> P3\n';
    }
    if (/res\.|response\./.test(code)) {
      diagram += '  P3 --> O1\n';
    }
    if (/\.save|\.insert|\.update/.test(code)) {
      diagram += '  P3 --> O2\n';
    }
    if (/fetch|axios|http/.test(code)) {
      diagram += '  P3 --> O3\n';
    }

    return diagram;
  }

  /**
   * Generate dependency graph
   */
  generateDependencyGraph(code: string, language: DebugLanguage): string {
    const imports: Array<{ module: string; items: string[] }> = [];

    // Parse imports
    const importPattern =
      language === 'python'
        ? /(?:from\s+(\S+)\s+import\s+(.+)|import\s+(\S+))/g
        : /import\s+(?:\{([^}]+)\}|(\S+))\s+from\s+['"]([^'"]+)['"]/g;

    let match;
    while ((match = importPattern.exec(code)) !== null) {
      if (language === 'python') {
        imports.push({
          module: match[1] || match[3],
          items: match[2] ? match[2].split(',').map((s) => s.trim()) : ['*'],
        });
      } else {
        imports.push({
          module: match[3],
          items: (match[1] || match[2] || '').split(',').map((s) => s.trim()),
        });
      }
    }

    let diagram = 'flowchart BT\n';
    diagram += '  subgraph "This Module"\n';
    diagram += '    M[Current File]\n';
    diagram += '  end\n\n';

    if (imports.length > 0) {
      diagram += '  subgraph "Dependencies"\n';
      imports.forEach((imp, i) => {
        const id = `D${i}`;
        diagram += `    ${id}["${imp.module}"]\n`;
      });
      diagram += '  end\n\n';

      imports.forEach((_imp, i) => {
        const id = `D${i}`;
        diagram += `  ${id} --> M\n`;
      });
    }

    return diagram;
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  private getNodeShape(type: string): [string, string] {
    switch (type) {
      case 'function':
        return ['[/', '/]'];
      case 'branch':
        return ['{', '}'];
      case 'loop':
        return ['((', '))'];
      case 'sideEffect':
        return ['[', ']'];
      default:
        return ['[', ']'];
    }
  }

  private sanitizeId(str: string): string {
    return str.replace(/[^a-zA-Z0-9]/g, '_');
  }

  private truncate(str: string, length: number): string {
    return str.length > length ? str.slice(0, length - 3) + '...' : str;
  }
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

interface CodeStructure {
  nodes: Array<{
    id: string;
    label: string;
    type: 'function' | 'branch' | 'loop' | 'sideEffect' | 'other';
    line: number;
  }>;
  edges: Array<{
    from: string;
    to: string;
    label?: string;
  }>;
  functions: Array<{
    name: string;
    startLine: number;
    endLine: number;
  }>;
  branches: Array<{
    line: number;
    type: string;
  }>;
  loops: Array<{
    line: number;
    type: string;
  }>;
  sideEffects: Array<{
    line: number;
    type: string;
  }>;
}
