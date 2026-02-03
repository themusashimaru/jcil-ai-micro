/**
 * AST-TRANSFORMER TOOL
 * Abstract Syntax Tree construction, traversal, transformation, and optimization
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface ASTNode {
  type: string;
  value?: string | number | boolean;
  children?: ASTNode[];
  metadata?: Record<string, unknown>;
  location?: {
    line: number;
    column: number;
    start: number;
    end: number;
  };
}

interface TransformRule {
  pattern: Partial<ASTNode>;
  replacement: ASTNode | ((node: ASTNode, match: Record<string, ASTNode>) => ASTNode);
  condition?: (node: ASTNode) => boolean;
}

interface TraversalOptions {
  order: 'pre' | 'post' | 'level';
  filter?: (node: ASTNode) => boolean;
}

interface OptimizationResult {
  original: ASTNode;
  optimized: ASTNode;
  transformations: string[];
  stats: {
    originalNodes: number;
    optimizedNodes: number;
    reductionPercent: number;
  };
}

interface ParseResult {
  success: boolean;
  ast?: ASTNode;
  error?: string;
  tokens?: Token[];
}

interface Token {
  type: string;
  value: string;
  position: number;
}

// ============================================================================
// EXPRESSION PARSER (SIMPLE)
// ============================================================================

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const regex = /(\d+\.?\d*)|([a-zA-Z_]\w*)|([+\-*/^%])|([()])|(\s+)/g;
  let match;

  while ((match = regex.exec(input)) !== null) {
    if (match[5]) continue; // Skip whitespace

    let type: string;
    if (match[1]) type = 'NUMBER';
    else if (match[2]) type = 'IDENTIFIER';
    else if (match[3]) type = 'OPERATOR';
    else if (match[4]) type = 'PAREN';
    else type = 'UNKNOWN';

    tokens.push({ type, value: match[0], position: match.index });
  }

  return tokens;
}

function parseExpression(input: string): ParseResult {
  const tokens = tokenize(input);
  let pos = 0;

  function peek(): Token | null {
    return tokens[pos] || null;
  }

  function consume(): Token {
    return tokens[pos++];
  }

  function parseAdditive(): ASTNode {
    let left = parseMultiplicative();

    while (peek()?.value === '+' || peek()?.value === '-') {
      const op = consume();
      const right = parseMultiplicative();
      left = {
        type: 'BinaryExpression',
        value: op.value,
        children: [left, right]
      };
    }

    return left;
  }

  function parseMultiplicative(): ASTNode {
    let left = parsePower();

    while (peek()?.value === '*' || peek()?.value === '/' || peek()?.value === '%') {
      const op = consume();
      const right = parsePower();
      left = {
        type: 'BinaryExpression',
        value: op.value,
        children: [left, right]
      };
    }

    return left;
  }

  function parsePower(): ASTNode {
    const left = parseUnary();

    if (peek()?.value === '^') {
      const op = consume();
      const right = parsePower(); // Right associative
      return {
        type: 'BinaryExpression',
        value: op.value,
        children: [left, right]
      };
    }

    return left;
  }

  function parseUnary(): ASTNode {
    if (peek()?.value === '-' || peek()?.value === '+') {
      const op = consume();
      const operand = parseUnary();
      return {
        type: 'UnaryExpression',
        value: op.value,
        children: [operand]
      };
    }

    return parsePrimary();
  }

  function parsePrimary(): ASTNode {
    const token = peek();

    if (!token) {
      throw new Error('Unexpected end of input');
    }

    if (token.value === '(') {
      consume();
      const expr = parseAdditive();
      if (peek()?.value !== ')') {
        throw new Error('Expected closing parenthesis');
      }
      consume();
      return expr;
    }

    if (token.type === 'NUMBER') {
      consume();
      return {
        type: 'NumberLiteral',
        value: parseFloat(token.value)
      };
    }

    if (token.type === 'IDENTIFIER') {
      consume();
      if (peek()?.value === '(') {
        // Function call
        consume();
        const args: ASTNode[] = [];
        while (peek()?.value !== ')') {
          args.push(parseAdditive());
          if (peek()?.value === ',') consume();
        }
        consume(); // )
        return {
          type: 'CallExpression',
          value: token.value,
          children: args
        };
      }
      return {
        type: 'Identifier',
        value: token.value
      };
    }

    throw new Error(`Unexpected token: ${token.value}`);
  }

  try {
    const ast = parseAdditive();
    if (pos < tokens.length) {
      throw new Error(`Unexpected token: ${tokens[pos].value}`);
    }
    return { success: true, ast, tokens };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Parse error',
      tokens
    };
  }
}

// ============================================================================
// AST TRAVERSAL
// ============================================================================

function traverse(
  node: ASTNode,
  visitor: (node: ASTNode, parent: ASTNode | null, path: string[]) => void | 'skip',
  options: TraversalOptions = { order: 'pre' }
): void {
  const { order, filter } = options;

  function visit(n: ASTNode, parent: ASTNode | null, path: string[]): void {
    if (filter && !filter(n)) return;

    if (order === 'pre') {
      const result = visitor(n, parent, path);
      if (result === 'skip') return;
    }

    if (n.children) {
      n.children.forEach((child, i) => {
        visit(child, n, [...path, `children[${i}]`]);
      });
    }

    if (order === 'post') {
      visitor(n, parent, path);
    }
  }

  if (order === 'level') {
    // BFS traversal
    const queue: { node: ASTNode; parent: ASTNode | null; path: string[] }[] = [
      { node, parent: null, path: [] }
    ];

    while (queue.length > 0) {
      const { node: n, parent, path } = queue.shift()!;
      if (filter && !filter(n)) continue;
      visitor(n, parent, path);
      if (n.children) {
        n.children.forEach((child, i) => {
          queue.push({ node: child, parent: n, path: [...path, `children[${i}]`] });
        });
      }
    }
  } else {
    visit(node, null, []);
  }
}

function collectNodes(ast: ASTNode, predicate: (node: ASTNode) => boolean): ASTNode[] {
  const result: ASTNode[] = [];
  traverse(ast, (node) => {
    if (predicate(node)) result.push(node);
  });
  return result;
}

function countNodes(ast: ASTNode): number {
  let count = 0;
  traverse(ast, () => { count++; });
  return count;
}

function getDepth(ast: ASTNode): number {
  let maxDepth = 0;
  traverse(ast, (_, __, path) => {
    maxDepth = Math.max(maxDepth, path.length + 1);
  });
  return maxDepth;
}

// ============================================================================
// AST TRANSFORMATION
// ============================================================================

function cloneNode(node: ASTNode): ASTNode {
  return {
    type: node.type,
    value: node.value,
    children: node.children?.map(cloneNode),
    metadata: node.metadata ? { ...node.metadata } : undefined,
    location: node.location ? { ...node.location } : undefined
  };
}

function transform(
  ast: ASTNode,
  transformer: (node: ASTNode) => ASTNode | null | undefined
): ASTNode {
  function transformNode(node: ASTNode): ASTNode {
    // First transform children
    const newChildren = node.children?.map(transformNode).filter((n): n is ASTNode => n !== null);

    const newNode = {
      ...node,
      children: newChildren
    };

    // Then apply transformer to this node
    const result = transformer(newNode);
    return result ?? newNode;
  }

  return transformNode(cloneNode(ast));
}

export function applyRules(ast: ASTNode, rules: TransformRule[]): ASTNode {
  return transform(ast, (node) => {
    for (const rule of rules) {
      if (matchesPattern(node, rule.pattern)) {
        if (rule.condition && !rule.condition(node)) continue;

        if (typeof rule.replacement === 'function') {
          return rule.replacement(node, {});
        }
        return cloneNode(rule.replacement);
      }
    }
    return node;
  });
}

function matchesPattern(node: ASTNode, pattern: Partial<ASTNode>): boolean {
  if (pattern.type !== undefined && node.type !== pattern.type) return false;
  if (pattern.value !== undefined && node.value !== pattern.value) return false;
  return true;
}

// ============================================================================
// OPTIMIZATIONS
// ============================================================================

function constantFolding(ast: ASTNode): ASTNode {
  return transform(ast, (node) => {
    if (node.type === 'BinaryExpression' && node.children?.length === 2) {
      const [left, right] = node.children;

      if (left.type === 'NumberLiteral' && right.type === 'NumberLiteral') {
        const l = left.value as number;
        const r = right.value as number;
        let result: number;

        switch (node.value) {
          case '+': result = l + r; break;
          case '-': result = l - r; break;
          case '*': result = l * r; break;
          case '/': result = l / r; break;
          case '%': result = l % r; break;
          case '^': result = Math.pow(l, r); break;
          default: return node;
        }

        return { type: 'NumberLiteral', value: result };
      }
    }

    if (node.type === 'UnaryExpression' && node.children?.length === 1) {
      const operand = node.children[0];
      if (operand.type === 'NumberLiteral') {
        const val = operand.value as number;
        if (node.value === '-') return { type: 'NumberLiteral', value: -val };
        if (node.value === '+') return { type: 'NumberLiteral', value: val };
      }
    }

    return node;
  });
}

function algebraicSimplification(ast: ASTNode): ASTNode {
  return transform(ast, (node) => {
    if (node.type !== 'BinaryExpression' || !node.children) return node;
    const [left, right] = node.children;
    const op = node.value;

    // x + 0 = x, 0 + x = x
    if (op === '+') {
      if (right.type === 'NumberLiteral' && right.value === 0) return left;
      if (left.type === 'NumberLiteral' && left.value === 0) return right;
    }

    // x - 0 = x
    if (op === '-') {
      if (right.type === 'NumberLiteral' && right.value === 0) return left;
    }

    // x * 1 = x, 1 * x = x
    if (op === '*') {
      if (right.type === 'NumberLiteral' && right.value === 1) return left;
      if (left.type === 'NumberLiteral' && left.value === 1) return right;
      // x * 0 = 0, 0 * x = 0
      if (right.type === 'NumberLiteral' && right.value === 0) return { type: 'NumberLiteral', value: 0 };
      if (left.type === 'NumberLiteral' && left.value === 0) return { type: 'NumberLiteral', value: 0 };
    }

    // x / 1 = x
    if (op === '/') {
      if (right.type === 'NumberLiteral' && right.value === 1) return left;
    }

    // x ^ 1 = x, x ^ 0 = 1
    if (op === '^') {
      if (right.type === 'NumberLiteral' && right.value === 1) return left;
      if (right.type === 'NumberLiteral' && right.value === 0) return { type: 'NumberLiteral', value: 1 };
    }

    return node;
  });
}

function deadCodeElimination(ast: ASTNode): ASTNode {
  // For this simple expression AST, we eliminate redundant operations
  return transform(ast, (node) => {
    // If same identifier on both sides of subtraction, result is 0
    if (node.type === 'BinaryExpression' && node.value === '-' && node.children) {
      const [left, right] = node.children;
      if (left.type === 'Identifier' && right.type === 'Identifier' &&
          left.value === right.value) {
        return { type: 'NumberLiteral', value: 0 };
      }
    }

    // If same identifier on both sides of division, result is 1
    if (node.type === 'BinaryExpression' && node.value === '/' && node.children) {
      const [left, right] = node.children;
      if (left.type === 'Identifier' && right.type === 'Identifier' &&
          left.value === right.value) {
        return { type: 'NumberLiteral', value: 1 };
      }
    }

    return node;
  });
}

function optimize(ast: ASTNode): OptimizationResult {
  const transformations: string[] = [];
  let current = cloneNode(ast);
  const originalNodes = countNodes(ast);

  // Apply optimizations in passes until no changes
  let changed = true;
  let iterations = 0;
  const maxIterations = 10;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    const before = JSON.stringify(current);

    // Constant folding
    const afterFolding = constantFolding(current);
    if (JSON.stringify(afterFolding) !== before) {
      current = afterFolding;
      transformations.push(`Pass ${iterations}: Constant folding`);
      changed = true;
    }

    // Algebraic simplification
    const afterAlgebra = algebraicSimplification(current);
    if (JSON.stringify(afterAlgebra) !== JSON.stringify(current)) {
      current = afterAlgebra;
      transformations.push(`Pass ${iterations}: Algebraic simplification`);
      changed = true;
    }

    // Dead code elimination
    const afterDCE = deadCodeElimination(current);
    if (JSON.stringify(afterDCE) !== JSON.stringify(current)) {
      current = afterDCE;
      transformations.push(`Pass ${iterations}: Dead code elimination`);
      changed = true;
    }
  }

  const optimizedNodes = countNodes(current);

  return {
    original: ast,
    optimized: current,
    transformations,
    stats: {
      originalNodes,
      optimizedNodes,
      reductionPercent: Math.round((1 - optimizedNodes / originalNodes) * 100)
    }
  };
}

// ============================================================================
// CODE GENERATION
// ============================================================================

function generateCode(ast: ASTNode, language: 'javascript' | 'python' | 'c' = 'javascript'): string {
  function generate(node: ASTNode): string {
    switch (node.type) {
      case 'NumberLiteral':
        return String(node.value);

      case 'Identifier':
        return String(node.value);

      case 'BinaryExpression': {
        const [left, right] = node.children || [];
        const leftCode = generate(left);
        const rightCode = generate(right);
        const op = node.value;

        if (op === '^') {
          if (language === 'javascript') return `Math.pow(${leftCode}, ${rightCode})`;
          if (language === 'python') return `(${leftCode} ** ${rightCode})`;
          if (language === 'c') return `pow(${leftCode}, ${rightCode})`;
        }

        return `(${leftCode} ${op} ${rightCode})`;
      }

      case 'UnaryExpression': {
        const operand = generate(node.children![0]);
        return `(${node.value}${operand})`;
      }

      case 'CallExpression': {
        const args = (node.children || []).map(generate).join(', ');
        const funcName = node.value;

        // Map common math functions
        if (language === 'javascript') {
          const jsMap: Record<string, string> = {
            'sqrt': 'Math.sqrt', 'sin': 'Math.sin', 'cos': 'Math.cos',
            'tan': 'Math.tan', 'log': 'Math.log', 'exp': 'Math.exp',
            'abs': 'Math.abs', 'floor': 'Math.floor', 'ceil': 'Math.ceil'
          };
          return `${jsMap[funcName as string] || funcName}(${args})`;
        }

        if (language === 'python') {
          const pyMap: Record<string, string> = {
            'sqrt': 'math.sqrt', 'sin': 'math.sin', 'cos': 'math.cos',
            'tan': 'math.tan', 'log': 'math.log', 'exp': 'math.exp',
            'abs': 'abs', 'floor': 'math.floor', 'ceil': 'math.ceil'
          };
          return `${pyMap[funcName as string] || funcName}(${args})`;
        }

        if (language === 'c') {
          return `${funcName}(${args})`;
        }

        return `${funcName}(${args})`;
      }

      default:
        return `/* Unknown: ${node.type} */`;
    }
  }

  return generate(ast);
}

// ============================================================================
// VISUALIZATION
// ============================================================================

function visualizeAST(ast: ASTNode): string {
  const lines: string[] = [];

  function render(node: ASTNode, prefix: string, isLast: boolean): void {
    const connector = isLast ? '└── ' : '├── ';
    const label = node.value !== undefined ? `${node.type}: ${node.value}` : node.type;
    lines.push(prefix + connector + label);

    if (node.children) {
      const childPrefix = prefix + (isLast ? '    ' : '│   ');
      node.children.forEach((child, i) => {
        render(child, childPrefix, i === node.children!.length - 1);
      });
    }
  }

  const label = ast.value !== undefined ? `${ast.type}: ${ast.value}` : ast.type;
  lines.push(label);
  if (ast.children) {
    ast.children.forEach((child, i) => {
      render(child, '', i === ast.children!.length - 1);
    });
  }

  return lines.join('\n');
}

export function toJSON(ast: ASTNode): string {
  return JSON.stringify(ast, null, 2);
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const asttransformerTool: UnifiedTool = {
  name: 'ast_transformer',
  description: 'Abstract Syntax Tree construction, traversal, transformation, and optimization for expressions and code',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['parse', 'transform', 'optimize', 'generate', 'visualize', 'analyze', 'demo', 'info', 'examples'],
        description: 'Operation to perform'
      },
      expression: {
        type: 'string',
        description: 'Expression to parse (e.g., "x + 2 * y")'
      },
      ast: {
        type: 'object',
        description: 'AST to transform/optimize'
      },
      rules: {
        type: 'array',
        description: 'Transformation rules to apply'
      },
      language: {
        type: 'string',
        enum: ['javascript', 'python', 'c'],
        description: 'Target language for code generation'
      }
    },
    required: ['operation']
  }
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeasttransformer(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, expression, ast: inputAst, language = 'javascript' } = args;

    switch (operation) {
      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'AST Transformer',
            description: 'Abstract Syntax Tree manipulation toolkit',
            capabilities: [
              'Expression parsing to AST',
              'Pre-order, post-order, level-order traversal',
              'Pattern-based transformations',
              'Constant folding optimization',
              'Algebraic simplification',
              'Dead code elimination',
              'Multi-language code generation (JS, Python, C)',
              'AST visualization and analysis'
            ],
            supportedNodes: [
              'NumberLiteral', 'Identifier', 'BinaryExpression',
              'UnaryExpression', 'CallExpression'
            ],
            operations: ['parse', 'transform', 'optimize', 'generate', 'visualize', 'analyze', 'demo', 'examples']
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                name: 'Parse Expression',
                params: {
                  operation: 'parse',
                  expression: 'x + 2 * y - 1'
                }
              },
              {
                name: 'Optimize Expression',
                params: {
                  operation: 'optimize',
                  expression: 'x * 1 + 0 + 3 * 4'
                }
              },
              {
                name: 'Generate Python Code',
                params: {
                  operation: 'generate',
                  expression: 'sqrt(x^2 + y^2)',
                  language: 'python'
                }
              }
            ]
          }, null, 2)
        };
      }

      case 'parse': {
        if (!expression) {
          return { toolCallId: id, content: 'Error: expression is required', isError: true };
        }

        const result = parseExpression(expression);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'parse',
            input: expression,
            success: result.success,
            ...(result.success ? {
              ast: result.ast,
              visualization: visualizeAST(result.ast!),
              tokens: result.tokens
            } : {
              error: result.error,
              tokens: result.tokens
            })
          }, null, 2)
        };
      }

      case 'optimize': {
        let ast: ASTNode;

        if (expression) {
          const parseResult = parseExpression(expression);
          if (!parseResult.success || !parseResult.ast) {
            return { toolCallId: id, content: `Error: ${parseResult.error}`, isError: true };
          }
          ast = parseResult.ast;
        } else if (inputAst) {
          ast = inputAst as ASTNode;
        } else {
          return { toolCallId: id, content: 'Error: expression or ast is required', isError: true };
        }

        const result = optimize(ast);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'optimize',
            original: {
              ast: result.original,
              visualization: visualizeAST(result.original),
              code: generateCode(result.original, language as 'javascript' | 'python' | 'c')
            },
            optimized: {
              ast: result.optimized,
              visualization: visualizeAST(result.optimized),
              code: generateCode(result.optimized, language as 'javascript' | 'python' | 'c')
            },
            transformations: result.transformations,
            stats: result.stats
          }, null, 2)
        };
      }

      case 'generate': {
        let ast: ASTNode;

        if (expression) {
          const parseResult = parseExpression(expression);
          if (!parseResult.success || !parseResult.ast) {
            return { toolCallId: id, content: `Error: ${parseResult.error}`, isError: true };
          }
          ast = parseResult.ast;
        } else if (inputAst) {
          ast = inputAst as ASTNode;
        } else {
          return { toolCallId: id, content: 'Error: expression or ast is required', isError: true };
        }

        const code = generateCode(ast, language as 'javascript' | 'python' | 'c');

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'generate',
            ast: ast,
            language,
            generatedCode: code,
            visualization: visualizeAST(ast)
          }, null, 2)
        };
      }

      case 'visualize': {
        let ast: ASTNode;

        if (expression) {
          const parseResult = parseExpression(expression);
          if (!parseResult.success || !parseResult.ast) {
            return { toolCallId: id, content: `Error: ${parseResult.error}`, isError: true };
          }
          ast = parseResult.ast;
        } else if (inputAst) {
          ast = inputAst as ASTNode;
        } else {
          return { toolCallId: id, content: 'Error: expression or ast is required', isError: true };
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'visualize',
            treeView: visualizeAST(ast),
            json: ast,
            stats: {
              nodeCount: countNodes(ast),
              depth: getDepth(ast),
              nodeTypes: [...new Set(collectNodes(ast, () => true).map(n => n.type))]
            }
          }, null, 2)
        };
      }

      case 'analyze': {
        let ast: ASTNode;

        if (expression) {
          const parseResult = parseExpression(expression);
          if (!parseResult.success || !parseResult.ast) {
            return { toolCallId: id, content: `Error: ${parseResult.error}`, isError: true };
          }
          ast = parseResult.ast;
        } else if (inputAst) {
          ast = inputAst as ASTNode;
        } else {
          return { toolCallId: id, content: 'Error: expression or ast is required', isError: true };
        }

        const allNodes = collectNodes(ast, () => true);
        const nodeTypes = allNodes.reduce((acc, n) => {
          acc[n.type] = (acc[n.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const identifiers = collectNodes(ast, n => n.type === 'Identifier')
          .map(n => n.value as string);
        const numbers = collectNodes(ast, n => n.type === 'NumberLiteral')
          .map(n => n.value as number);
        const operators = collectNodes(ast, n => n.type === 'BinaryExpression')
          .map(n => n.value as string);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'analyze',
            visualization: visualizeAST(ast),
            statistics: {
              totalNodes: allNodes.length,
              depth: getDepth(ast),
              nodeTypeCounts: nodeTypes
            },
            elements: {
              identifiers: [...new Set(identifiers)],
              numbers: [...new Set(numbers)],
              operators: [...new Set(operators)]
            },
            complexity: {
              operatorCount: operators.length,
              identifierCount: identifiers.length,
              literalCount: numbers.length
            }
          }, null, 2)
        };
      }

      case 'transform': {
        let ast: ASTNode;

        if (expression) {
          const parseResult = parseExpression(expression);
          if (!parseResult.success || !parseResult.ast) {
            return { toolCallId: id, content: `Error: ${parseResult.error}`, isError: true };
          }
          ast = parseResult.ast;
        } else if (inputAst) {
          ast = inputAst as ASTNode;
        } else {
          return { toolCallId: id, content: 'Error: expression or ast is required', isError: true };
        }

        // Apply built-in transformations
        const transformed = transform(ast, (node) => {
          // Example: Convert x^2 to x*x for efficiency
          if (node.type === 'BinaryExpression' && node.value === '^' && node.children) {
            const [base, exp] = node.children;
            if (exp.type === 'NumberLiteral' && exp.value === 2) {
              return {
                type: 'BinaryExpression',
                value: '*',
                children: [cloneNode(base), cloneNode(base)]
              };
            }
          }
          return node;
        });

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'transform',
            original: {
              ast: ast,
              visualization: visualizeAST(ast),
              code: generateCode(ast, language as 'javascript' | 'python' | 'c')
            },
            transformed: {
              ast: transformed,
              visualization: visualizeAST(transformed),
              code: generateCode(transformed, language as 'javascript' | 'python' | 'c')
            },
            appliedRules: ['x^2 → x*x (strength reduction)']
          }, null, 2)
        };
      }

      case 'demo': {
        const testExpr = 'x * 1 + 0 + 2 * 3 + y - y';
        const parseResult = parseExpression(testExpr);

        if (!parseResult.success || !parseResult.ast) {
          return {
            toolCallId: id,
            content: JSON.stringify({ error: 'Demo parse failed' }, null, 2)
          };
        }

        const optimizeResult = optimize(parseResult.ast);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'demo',
            title: 'AST Transformer Demo',
            input: testExpr,
            step1_parse: {
              description: 'Parse expression to AST',
              visualization: visualizeAST(parseResult.ast),
              nodeCount: countNodes(parseResult.ast)
            },
            step2_optimize: {
              description: 'Apply optimizations',
              transformations: optimizeResult.transformations,
              visualization: visualizeAST(optimizeResult.optimized),
              nodeCount: countNodes(optimizeResult.optimized)
            },
            step3_generate: {
              description: 'Generate code in multiple languages',
              javascript: generateCode(optimizeResult.optimized, 'javascript'),
              python: generateCode(optimizeResult.optimized, 'python'),
              c: generateCode(optimizeResult.optimized, 'c')
            },
            concepts: [
              'ASTs represent code structure hierarchically',
              'Constant folding evaluates compile-time constants',
              'Algebraic simplification removes identity operations',
              'Dead code elimination removes unreachable/useless code',
              'Code generation produces executable output'
            ]
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: `Unknown operation: ${operation}. Use 'info' for available operations.`,
          isError: true
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isasttransformerAvailable(): boolean {
  return true;
}
