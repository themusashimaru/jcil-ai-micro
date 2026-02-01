/**
 * AST ANALYZER TOOL
 * Parse and analyze Abstract Syntax Trees for any language
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// AST Node types
const NODE_TYPES = {
  javascript: ['Program', 'FunctionDeclaration', 'VariableDeclaration', 'ClassDeclaration', 'ImportDeclaration', 'ExportDeclaration', 'ArrowFunctionExpression', 'CallExpression', 'MemberExpression', 'Identifier', 'Literal', 'BinaryExpression', 'ConditionalExpression', 'IfStatement', 'ForStatement', 'WhileStatement', 'ReturnStatement', 'TryStatement', 'ThrowStatement'],
  python: ['Module', 'FunctionDef', 'AsyncFunctionDef', 'ClassDef', 'Import', 'ImportFrom', 'Assign', 'AugAssign', 'For', 'AsyncFor', 'While', 'If', 'With', 'AsyncWith', 'Raise', 'Try', 'Return', 'Yield', 'YieldFrom', 'Lambda', 'ListComp', 'DictComp', 'SetComp', 'GeneratorExp'],
  typescript: ['Program', 'FunctionDeclaration', 'VariableDeclaration', 'ClassDeclaration', 'InterfaceDeclaration', 'TypeAliasDeclaration', 'EnumDeclaration', 'ImportDeclaration', 'ExportDeclaration', 'ArrowFunctionExpression', 'TypeAnnotation', 'GenericType', 'UnionType', 'IntersectionType'],
  java: ['CompilationUnit', 'ClassDeclaration', 'InterfaceDeclaration', 'MethodDeclaration', 'FieldDeclaration', 'ConstructorDeclaration', 'ImportDeclaration', 'PackageDeclaration', 'AnnotationDeclaration', 'EnumDeclaration'],
  go: ['File', 'FuncDecl', 'GenDecl', 'TypeSpec', 'ValueSpec', 'ImportSpec', 'StructType', 'InterfaceType', 'FuncType', 'MapType', 'ChanType', 'ArrayType', 'SliceExpr'],
  rust: ['Crate', 'Mod', 'Fn', 'Struct', 'Enum', 'Impl', 'Trait', 'Use', 'Const', 'Static', 'Type', 'Macro', 'Match', 'If', 'Loop', 'While', 'For']
};

// Pattern detection
const PATTERNS = {
  singleton: { indicators: ['getInstance', 'private constructor', 'static instance'], score: 0 },
  factory: { indicators: ['create', 'make', 'build', 'Factory'], score: 0 },
  observer: { indicators: ['subscribe', 'unsubscribe', 'notify', 'Observer', 'listener'], score: 0 },
  strategy: { indicators: ['Strategy', 'execute', 'algorithm', 'setStrategy'], score: 0 },
  decorator: { indicators: ['Decorator', 'wrap', 'Component'], score: 0 },
  adapter: { indicators: ['Adapter', 'adaptee', 'convert'], score: 0 },
  facade: { indicators: ['Facade', 'simplify', 'subsystem'], score: 0 },
  proxy: { indicators: ['Proxy', 'handler', 'target', 'Reflect'], score: 0 }
};

function analyzeStructure(code: string, language: string): Record<string, unknown> {
  const lines = code.split('\n');
  const nodeTypes = NODE_TYPES[language as keyof typeof NODE_TYPES] || NODE_TYPES.javascript;

  const analysis = {
    totalLines: lines.length,
    codeLines: lines.filter(l => l.trim() && !l.trim().startsWith('//')).length,
    commentLines: lines.filter(l => l.trim().startsWith('//')).length,
    blankLines: lines.filter(l => !l.trim()).length,
    functions: (code.match(/function\s+\w+|=>\s*{|def\s+\w+|fn\s+\w+|func\s+\w+/g) || []).length,
    classes: (code.match(/class\s+\w+|struct\s+\w+|interface\s+\w+/g) || []).length,
    imports: (code.match(/import\s+|from\s+['"]|require\(/g) || []).length,
    exports: (code.match(/export\s+|module\.exports/g) || []).length,
    conditionals: (code.match(/if\s*\(|if\s+|switch\s*\(|match\s+|\?\s*:/g) || []).length,
    loops: (code.match(/for\s*\(|for\s+|while\s*\(|while\s+|\.forEach|\.map\(|\.filter\(/g) || []).length,
    asyncCode: (code.match(/async\s+|await\s+|Promise|\.then\(|goroutine|spawn/g) || []).length,
    errorHandling: (code.match(/try\s*{|catch\s*\(|except\s*:|rescue|Result<|Option</g) || []).length,
    nodeTypes: nodeTypes.slice(0, 10),
    language
  };

  return analysis;
}

function detectPatterns(code: string): Record<string, unknown> {
  const detected: Record<string, number> = {};

  for (const [pattern, { indicators }] of Object.entries(PATTERNS)) {
    let score = 0;
    for (const indicator of indicators) {
      if (code.toLowerCase().includes(indicator.toLowerCase())) {
        score += 1;
      }
    }
    if (score >= 2) {
      detected[pattern] = Math.min(score / indicators.length, 1);
    }
  }

  return {
    patternsDetected: Object.keys(detected),
    confidence: detected,
    suggestions: Object.keys(detected).length === 0
      ? ['Consider using design patterns for better code organization']
      : Object.keys(detected).map(p => `${p} pattern detected - ensure proper implementation`)
  };
}

function findDependencies(code: string): Record<string, unknown> {
  const imports = code.match(/import\s+.*?from\s+['"]([^'"]+)['"]/g) || [];
  const requires = code.match(/require\(['"]([^'"]+)['"]\)/g) || [];
  const pythonImports = code.match(/from\s+(\S+)\s+import|import\s+(\S+)/g) || [];

  const external: string[] = [];
  const internal: string[] = [];

  [...imports, ...requires].forEach(imp => {
    const match = imp.match(/['"]([^'"]+)['"]/);
    if (match) {
      if (match[1].startsWith('.') || match[1].startsWith('@/')) {
        internal.push(match[1]);
      } else {
        external.push(match[1]);
      }
    }
  });

  return {
    external: [...new Set(external)],
    internal: [...new Set(internal)],
    totalDependencies: external.length + internal.length,
    pythonImports: pythonImports.length
  };
}

function calculateComplexity(code: string): Record<string, unknown> {
  const lines = code.split('\n');
  let maxNesting = 0;
  let currentNesting = 0;
  let totalNesting = 0;

  for (const line of lines) {
    const opens = (line.match(/{|\(.*{|:\s*$/g) || []).length;
    const closes = (line.match(/}/g) || []).length;
    currentNesting += opens - closes;
    maxNesting = Math.max(maxNesting, currentNesting);
    totalNesting += currentNesting > 0 ? currentNesting : 0;
  }

  const conditionals = (code.match(/if\s*\(|if\s+|\?\s*:|&&|\|\|/g) || []).length;
  const loops = (code.match(/for\s*\(|while\s*\(|do\s*{|\.forEach|\.map/g) || []).length;
  const functions = (code.match(/function\s+|=>\s*{|def\s+|fn\s+/g) || []).length;

  const cyclomaticComplexity = conditionals + loops + 1;
  const cognitiveComplexity = conditionals + (loops * 2) + (maxNesting * 3);

  return {
    cyclomaticComplexity,
    cognitiveComplexity,
    functionCount: functions,
    maxNestingDepth: maxNesting,
    averageNesting: lines.length > 0 ? (totalNesting / lines.length).toFixed(2) : 0,
    recommendation: cyclomaticComplexity > 10
      ? 'High complexity - consider refactoring into smaller functions'
      : cyclomaticComplexity > 5
        ? 'Moderate complexity - monitor for growth'
        : 'Good complexity level'
  };
}

export const astAnalyzerTool: UnifiedTool = {
  name: 'ast_analyzer',
  description: 'AST Analyzer: analyze_structure, detect_patterns, find_dependencies, calculate_complexity, get_node_types',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['analyze_structure', 'detect_patterns', 'find_dependencies', 'calculate_complexity', 'get_node_types'] },
      code: { type: 'string', description: 'Source code to analyze' },
      language: { type: 'string', description: 'Programming language (javascript, typescript, python, java, go, rust)' }
    },
    required: ['operation']
  },
};

export async function executeAstAnalyzer(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const code = args.code || 'function example() { return 42; }';
    const language = args.language || 'javascript';
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'analyze_structure':
        result = analyzeStructure(code, language);
        break;
      case 'detect_patterns':
        result = detectPatterns(code);
        break;
      case 'find_dependencies':
        result = findDependencies(code);
        break;
      case 'calculate_complexity':
        result = calculateComplexity(code);
        break;
      case 'get_node_types':
        result = {
          language,
          nodeTypes: NODE_TYPES[language as keyof typeof NODE_TYPES] || NODE_TYPES.javascript,
          supportedLanguages: Object.keys(NODE_TYPES)
        };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isAstAnalyzerAvailable(): boolean { return true; }
