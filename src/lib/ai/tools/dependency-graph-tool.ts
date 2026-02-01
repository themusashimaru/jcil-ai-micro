/**
 * DEPENDENCY GRAPH TOOL
 * Map and analyze project dependencies
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface Dependency {
  name: string;
  version?: string;
  type: 'external' | 'internal' | 'dev' | 'peer';
  usedBy?: string[];
}

function parsePackageJson(content: string): Record<string, unknown> {
  try {
    const pkg = JSON.parse(content);
    const deps: Dependency[] = [];

    if (pkg.dependencies) {
      for (const [name, version] of Object.entries(pkg.dependencies)) {
        deps.push({ name, version: version as string, type: 'external' });
      }
    }

    if (pkg.devDependencies) {
      for (const [name, version] of Object.entries(pkg.devDependencies)) {
        deps.push({ name, version: version as string, type: 'dev' });
      }
    }

    if (pkg.peerDependencies) {
      for (const [name, version] of Object.entries(pkg.peerDependencies)) {
        deps.push({ name, version: version as string, type: 'peer' });
      }
    }

    return {
      name: pkg.name,
      version: pkg.version,
      totalDependencies: deps.length,
      external: deps.filter(d => d.type === 'external').length,
      dev: deps.filter(d => d.type === 'dev').length,
      peer: deps.filter(d => d.type === 'peer').length,
      dependencies: deps
    };
  } catch {
    return { error: 'Invalid package.json format' };
  }
}

function analyzeImports(code: string): Record<string, unknown> {
  const imports: Record<string, string[]> = {
    external: [],
    internal: [],
    builtin: []
  };

  // JavaScript/TypeScript imports
  const esImports = code.matchAll(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
  const requires = code.matchAll(/require\(['"]([^'"]+)['"]\)/g);
  const dynamicImports = code.matchAll(/import\(['"]([^'"]+)['"]\)/g);

  // Python imports
  const pythonImports = code.matchAll(/^(?:from\s+(\S+)\s+import|import\s+(\S+))/gm);

  const builtins = new Set(['fs', 'path', 'http', 'https', 'crypto', 'os', 'util', 'stream', 'events', 'buffer', 'url', 'querystring', 'child_process', 'cluster', 'dgram', 'dns', 'net', 'readline', 'repl', 'tls', 'tty', 'v8', 'vm', 'zlib']);

  for (const match of [...esImports, ...requires, ...dynamicImports]) {
    const dep = match[1];
    if (dep.startsWith('.') || dep.startsWith('@/') || dep.startsWith('~/')) {
      imports.internal.push(dep);
    } else if (builtins.has(dep.split('/')[0])) {
      imports.builtin.push(dep);
    } else {
      imports.external.push(dep);
    }
  }

  for (const match of pythonImports) {
    const dep = match[1] || match[2];
    if (dep) imports.external.push(dep.split('.')[0]);
  }

  return {
    external: [...new Set(imports.external)],
    internal: [...new Set(imports.internal)],
    builtin: [...new Set(imports.builtin)],
    summary: {
      externalCount: new Set(imports.external).size,
      internalCount: new Set(imports.internal).size,
      builtinCount: new Set(imports.builtin).size
    }
  };
}

function buildDependencyTree(deps: Record<string, string>): Record<string, unknown> {
  const tree: Record<string, unknown> = {};
  const flat: string[] = [];

  for (const [name, version] of Object.entries(deps)) {
    flat.push(`${name}@${version}`);
    tree[name] = {
      version,
      depth: 0,
      // In real impl, would resolve transitive deps
      transitive: []
    };
  }

  return {
    tree,
    flat,
    depth: 1, // Would calculate actual depth with real resolution
    totalPackages: flat.length
  };
}

function detectCircular(imports: Record<string, string[]>): Record<string, unknown> {
  const visited = new Set<string>();
  const stack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(node: string, path: string[]): void {
    if (stack.has(node)) {
      const cycleStart = path.indexOf(node);
      cycles.push(path.slice(cycleStart).concat(node));
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    stack.add(node);

    const deps = imports[node] || [];
    for (const dep of deps) {
      dfs(dep, [...path, node]);
    }

    stack.delete(node);
  }

  for (const node of Object.keys(imports)) {
    dfs(node, []);
  }

  return {
    hasCircular: cycles.length > 0,
    cycles: cycles.slice(0, 10),
    cycleCount: cycles.length,
    recommendation: cycles.length > 0
      ? 'Circular dependencies detected. Consider restructuring or using dependency injection.'
      : 'No circular dependencies detected.'
  };
}

function analyzeSecurity(deps: Record<string, string>): Record<string, unknown> {
  // Known vulnerable packages (simplified - real impl would use npm audit API)
  const knownVulnerable: Record<string, { severity: string; advisory: string }> = {
    'lodash': { severity: 'high', advisory: 'Prototype pollution in versions < 4.17.21' },
    'minimist': { severity: 'critical', advisory: 'Prototype pollution in versions < 1.2.6' },
    'node-fetch': { severity: 'medium', advisory: 'Header leak in versions < 2.6.7' },
    'axios': { severity: 'medium', advisory: 'SSRF in versions < 0.21.2' },
    'moment': { severity: 'low', advisory: 'ReDoS vulnerability, consider dayjs' }
  };

  const issues: Record<string, unknown>[] = [];

  for (const [name, version] of Object.entries(deps)) {
    if (name in knownVulnerable) {
      issues.push({
        package: name,
        version,
        ...knownVulnerable[name]
      });
    }
  }

  return {
    vulnerabilitiesFound: issues.length,
    issues,
    recommendation: issues.length > 0
      ? 'Run npm audit for detailed vulnerability report'
      : 'No known vulnerabilities in direct dependencies',
    suggestedActions: issues.map(i => `Update ${i.package} to latest version`)
  };
}

function generateMermaid(imports: Record<string, string[]>): string {
  let diagram = 'graph TD\n';

  for (const [file, deps] of Object.entries(imports)) {
    const safeFile = file.replace(/[^a-zA-Z0-9]/g, '_');
    for (const dep of deps.slice(0, 10)) {
      const safeDep = dep.replace(/[^a-zA-Z0-9]/g, '_');
      diagram += `  ${safeFile}["${file}"] --> ${safeDep}["${dep}"]\n`;
    }
  }

  return diagram;
}

export const dependencyGraphTool: UnifiedTool = {
  name: 'dependency_graph',
  description: 'Dependency Graph: parse_package, analyze_imports, build_tree, detect_circular, security_check, generate_diagram',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['parse_package', 'analyze_imports', 'build_tree', 'detect_circular', 'security_check', 'generate_diagram'] },
      content: { type: 'string', description: 'package.json content or source code' },
      dependencies: { type: 'object', description: 'Dependencies object {name: version}' },
      imports: { type: 'object', description: 'Import map {file: [imports]}' }
    },
    required: ['operation']
  },
};

export async function executeDependencyGraph(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'parse_package':
        result = parsePackageJson(args.content || '{"name":"test","dependencies":{"lodash":"^4.17.21"}}');
        break;
      case 'analyze_imports':
        result = analyzeImports(args.content || "import React from 'react';\nimport { helper } from './utils';");
        break;
      case 'build_tree':
        result = buildDependencyTree(args.dependencies || { 'react': '^18.0.0', 'lodash': '^4.17.21' });
        break;
      case 'detect_circular':
        result = detectCircular(args.imports || { 'a.ts': ['b.ts'], 'b.ts': ['c.ts'], 'c.ts': ['a.ts'] });
        break;
      case 'security_check':
        result = analyzeSecurity(args.dependencies || { 'lodash': '4.17.20', 'axios': '0.21.0' });
        break;
      case 'generate_diagram':
        result = { diagram: generateMermaid(args.imports || { 'index.ts': ['utils.ts', 'api.ts'], 'api.ts': ['config.ts'] }) };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isDependencyGraphAvailable(): boolean { return true; }
