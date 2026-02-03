/**
 * LL-PARSER TOOL
 * Comprehensive LL parser generator with FIRST/FOLLOW computation,
 * parse table construction, and recursive descent parsing
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface Grammar {
  terminals: string[];
  nonTerminals: string[];
  startSymbol: string;
  productions: Production[];
}

interface Production {
  lhs: string; // Left-hand side (non-terminal)
  rhs: string[]; // Right-hand side symbols
  index: number; // Production number
}

export interface FirstFollowSets {
  first: Map<string, Set<string>>;
  follow: Map<string, Set<string>>;
}

interface ParseTable {
  table: Map<string, Map<string, Production | null>>;
  conflicts: ParseConflict[];
}

interface ParseConflict {
  nonTerminal: string;
  terminal: string;
  productions: Production[];
  type: 'first-first' | 'first-follow';
}

interface ParseTree {
  symbol: string;
  children: ParseTree[];
  isTerminal: boolean;
  value?: string;
}

interface ParseResult {
  success: boolean;
  tree?: ParseTree;
  derivation?: string[];
  error?: string;
  position?: number;
}

interface LLAnalysis {
  isLL1: boolean;
  conflicts: ParseConflict[];
  nullableSymbols: string[];
  firstSets: Record<string, string[]>;
  followSets: Record<string, string[]>;
  parseTable: Record<string, Record<string, number>>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const EPSILON = 'ε';
const END_MARKER = '$';

// ============================================================================
// LL PARSER CORE
// ============================================================================

/**
 * Parse grammar from string notation
 */
function parseGrammar(grammarText: string): Grammar {
  const lines = grammarText
    .trim()
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('//'));
  const productions: Production[] = [];
  const nonTerminals = new Set<string>();
  const allSymbols = new Set<string>();
  let startSymbol = '';

  lines.forEach((line, _idx) => {
    const match = line.match(/^\s*(\w+)\s*->\s*(.+)\s*$/);
    if (!match) return;

    const lhs = match[1];
    const rhsAlternatives = match[2].split('|').map((s) => s.trim());

    if (!startSymbol) startSymbol = lhs;
    nonTerminals.add(lhs);

    rhsAlternatives.forEach((alt) => {
      const rhs = alt === EPSILON ? [] : alt.split(/\s+/).filter((s) => s);
      productions.push({ lhs, rhs, index: productions.length });
      rhs.forEach((s) => allSymbols.add(s));
    });
  });

  const terminals = [...allSymbols].filter((s) => !nonTerminals.has(s) && s !== EPSILON);

  return {
    terminals,
    nonTerminals: [...nonTerminals],
    startSymbol,
    productions,
  };
}

/**
 * Compute FIRST sets for all grammar symbols
 */
function computeFirstSets(grammar: Grammar): Map<string, Set<string>> {
  const first = new Map<string, Set<string>>();

  // Initialize FIRST sets
  grammar.terminals.forEach((t) => {
    first.set(t, new Set([t]));
  });
  grammar.nonTerminals.forEach((nt) => {
    first.set(nt, new Set());
  });

  let changed = true;
  while (changed) {
    changed = false;

    for (const prod of grammar.productions) {
      const lhsFirst = first.get(prod.lhs)!;
      const oldSize = lhsFirst.size;

      if (prod.rhs.length === 0) {
        // Empty production: add epsilon
        lhsFirst.add(EPSILON);
      } else {
        // Add FIRST of RHS
        let allNullable = true;
        for (const symbol of prod.rhs) {
          const symbolFirst = first.get(symbol);
          if (symbolFirst) {
            symbolFirst.forEach((s) => {
              if (s !== EPSILON) lhsFirst.add(s);
            });
            if (!symbolFirst.has(EPSILON)) {
              allNullable = false;
              break;
            }
          } else {
            // Unknown symbol (treat as terminal)
            lhsFirst.add(symbol);
            allNullable = false;
            break;
          }
        }
        if (allNullable) {
          lhsFirst.add(EPSILON);
        }
      }

      if (lhsFirst.size > oldSize) changed = true;
    }
  }

  return first;
}

/**
 * Compute FOLLOW sets for all non-terminals
 */
function computeFollowSets(
  grammar: Grammar,
  first: Map<string, Set<string>>
): Map<string, Set<string>> {
  const follow = new Map<string, Set<string>>();

  // Initialize FOLLOW sets
  grammar.nonTerminals.forEach((nt) => {
    follow.set(nt, new Set());
  });

  // Add $ to FOLLOW of start symbol
  follow.get(grammar.startSymbol)!.add(END_MARKER);

  let changed = true;
  while (changed) {
    changed = false;

    for (const prod of grammar.productions) {
      for (let i = 0; i < prod.rhs.length; i++) {
        const symbol = prod.rhs[i];
        if (!grammar.nonTerminals.includes(symbol)) continue;

        const symbolFollow = follow.get(symbol)!;
        const oldSize = symbolFollow.size;

        // Look at what follows this symbol
        const beta = prod.rhs.slice(i + 1);

        if (beta.length === 0) {
          // Symbol at end: add FOLLOW(lhs)
          follow.get(prod.lhs)!.forEach((s) => symbolFollow.add(s));
        } else {
          // Add FIRST(beta) - epsilon
          const betaFirst = computeFirstOfString(beta, first);
          betaFirst.forEach((s) => {
            if (s !== EPSILON) symbolFollow.add(s);
          });

          // If beta can derive epsilon, add FOLLOW(lhs)
          if (betaFirst.has(EPSILON)) {
            follow.get(prod.lhs)!.forEach((s) => symbolFollow.add(s));
          }
        }

        if (symbolFollow.size > oldSize) changed = true;
      }
    }
  }

  return follow;
}

/**
 * Compute FIRST set for a string of symbols
 */
function computeFirstOfString(symbols: string[], first: Map<string, Set<string>>): Set<string> {
  const result = new Set<string>();

  if (symbols.length === 0) {
    result.add(EPSILON);
    return result;
  }

  let allNullable = true;
  for (const symbol of symbols) {
    const symbolFirst = first.get(symbol);
    if (symbolFirst) {
      symbolFirst.forEach((s) => {
        if (s !== EPSILON) result.add(s);
      });
      if (!symbolFirst.has(EPSILON)) {
        allNullable = false;
        break;
      }
    } else {
      result.add(symbol);
      allNullable = false;
      break;
    }
  }

  if (allNullable) {
    result.add(EPSILON);
  }

  return result;
}

/**
 * Build LL(1) parse table
 */
function buildParseTable(
  grammar: Grammar,
  first: Map<string, Set<string>>,
  follow: Map<string, Set<string>>
): ParseTable {
  const table = new Map<string, Map<string, Production | null>>();
  const conflicts: ParseConflict[] = [];

  // Initialize table
  grammar.nonTerminals.forEach((nt) => {
    table.set(nt, new Map());
    grammar.terminals.forEach((t) => table.get(nt)!.set(t, null));
    table.get(nt)!.set(END_MARKER, null);
  });

  // Fill table
  for (const prod of grammar.productions) {
    const rhsFirst = computeFirstOfString(prod.rhs, first);

    // For each terminal in FIRST(rhs)
    rhsFirst.forEach((terminal) => {
      if (terminal !== EPSILON) {
        const existing = table.get(prod.lhs)!.get(terminal);
        if (existing !== null && existing !== undefined) {
          // Conflict!
          conflicts.push({
            nonTerminal: prod.lhs,
            terminal,
            productions: [existing, prod],
            type: 'first-first',
          });
        } else {
          table.get(prod.lhs)!.set(terminal, prod);
        }
      }
    });

    // If epsilon in FIRST(rhs), add for all terminals in FOLLOW(lhs)
    if (rhsFirst.has(EPSILON)) {
      const lhsFollow = follow.get(prod.lhs)!;
      lhsFollow.forEach((terminal) => {
        const existing = table.get(prod.lhs)!.get(terminal);
        if (existing !== null && existing !== undefined) {
          conflicts.push({
            nonTerminal: prod.lhs,
            terminal,
            productions: [existing, prod],
            type: 'first-follow',
          });
        } else {
          table.get(prod.lhs)!.set(terminal, prod);
        }
      });
    }
  }

  return { table, conflicts };
}

/**
 * Parse input using LL(1) table
 */
function parseWithTable(input: string[], grammar: Grammar, parseTable: ParseTable): ParseResult {
  const stack: (string | ParseTree)[] = [END_MARKER, grammar.startSymbol];
  const tokens = [...input, END_MARKER];
  let tokenIndex = 0;
  const derivation: string[] = [];

  // Build tree structure
  const root: ParseTree = { symbol: grammar.startSymbol, children: [], isTerminal: false };
  const nodeStack: ParseTree[] = [root];

  while (stack.length > 1) {
    const top = stack[stack.length - 1];
    const currentToken = tokens[tokenIndex];

    if (typeof top === 'string') {
      if (grammar.terminals.includes(top) || top === END_MARKER) {
        // Terminal on stack
        if (top === currentToken) {
          stack.pop();
          const node = nodeStack.pop();
          if (node) node.value = currentToken;
          tokenIndex++;
          derivation.push(`Match: ${top}`);
        } else {
          return {
            success: false,
            error: `Expected '${top}', found '${currentToken}'`,
            position: tokenIndex,
            derivation,
          };
        }
      } else {
        // Non-terminal on stack
        const tableRow = parseTable.table.get(top);
        if (!tableRow) {
          return {
            success: false,
            error: `Unknown non-terminal: ${top}`,
            position: tokenIndex,
            derivation,
          };
        }

        const production = tableRow.get(currentToken);
        if (!production) {
          const expected = [...tableRow.entries()]
            .filter(([_, p]) => p !== null)
            .map(([t, _]) => t);
          return {
            success: false,
            error: `No production for ${top} with lookahead '${currentToken}'. Expected: ${expected.join(', ')}`,
            position: tokenIndex,
            derivation,
          };
        }

        stack.pop();
        const currentNode = nodeStack.pop()!;

        derivation.push(
          `${top} -> ${production.rhs.length > 0 ? production.rhs.join(' ') : EPSILON}`
        );

        // Push RHS in reverse order
        const newNodes: ParseTree[] = [];
        for (let i = production.rhs.length - 1; i >= 0; i--) {
          const symbol = production.rhs[i];
          stack.push(symbol);
          const isTerminal = grammar.terminals.includes(symbol);
          const newNode: ParseTree = { symbol, children: [], isTerminal };
          newNodes.unshift(newNode);
          nodeStack.push(newNode);
        }
        currentNode.children = newNodes;
      }
    }
  }

  if (tokenIndex < tokens.length - 1) {
    return {
      success: false,
      error: `Unexpected tokens remaining: ${tokens.slice(tokenIndex, -1).join(' ')}`,
      position: tokenIndex,
      derivation,
    };
  }

  return { success: true, tree: root, derivation };
}

/**
 * Recursive descent parser generator
 */
function generateRecursiveDescentCode(
  grammar: Grammar,
  first: Map<string, Set<string>>,
  follow: Map<string, Set<string>>
): string {
  const lines: string[] = [];

  lines.push('// Auto-generated Recursive Descent Parser');
  lines.push('class Parser {');
  lines.push('  private tokens: string[] = [];');
  lines.push('  private pos: number = 0;');
  lines.push('');
  lines.push('  parse(input: string[]): boolean {');
  lines.push('    this.tokens = [...input, "$"];');
  lines.push('    this.pos = 0;');
  lines.push(`    return this.${grammar.startSymbol}() && this.match("$");`);
  lines.push('  }');
  lines.push('');
  lines.push('  private current(): string { return this.tokens[this.pos]; }');
  lines.push('');
  lines.push('  private match(expected: string): boolean {');
  lines.push('    if (this.current() === expected) { this.pos++; return true; }');
  lines.push('    return false;');
  lines.push('  }');

  // Generate function for each non-terminal
  for (const nt of grammar.nonTerminals) {
    lines.push('');
    lines.push(`  private ${nt}(): boolean {`);

    const ntProductions = grammar.productions.filter((p) => p.lhs === nt);

    if (ntProductions.length === 1 && ntProductions[0].rhs.length === 0) {
      // Only epsilon production
      lines.push('    return true; // epsilon');
    } else {
      // Generate switch based on lookahead
      lines.push('    switch (this.current()) {');

      const caseHandled = new Set<string>();

      for (const prod of ntProductions) {
        const rhsFirst = computeFirstOfString(prod.rhs, first);

        const cases: string[] = [];
        rhsFirst.forEach((t) => {
          if (t !== EPSILON && !caseHandled.has(t)) {
            cases.push(t);
            caseHandled.add(t);
          }
        });

        if (rhsFirst.has(EPSILON)) {
          follow.get(nt)!.forEach((t) => {
            if (!caseHandled.has(t)) {
              cases.push(t);
              caseHandled.add(t);
            }
          });
        }

        if (cases.length > 0) {
          cases.forEach((c) => lines.push(`      case "${c}":`));

          if (prod.rhs.length === 0) {
            lines.push('        return true; // epsilon');
          } else {
            const checks = prod.rhs.map((s) => {
              if (grammar.terminals.includes(s)) {
                return `this.match("${s}")`;
              } else {
                return `this.${s}()`;
              }
            });
            lines.push(`        return ${checks.join(' && ')};`);
          }
        }
      }

      lines.push('      default:');
      lines.push('        return false;');
      lines.push('    }');
    }

    lines.push('  }');
  }

  lines.push('}');

  return lines.join('\n');
}

/**
 * Analyze grammar for LL(1) properties
 */
function analyzeGrammar(grammar: Grammar): LLAnalysis {
  const first = computeFirstSets(grammar);
  const follow = computeFollowSets(grammar, first);
  const parseTable = buildParseTable(grammar, first, follow);

  // Find nullable symbols
  const nullableSymbols = grammar.nonTerminals.filter((nt) => first.get(nt)?.has(EPSILON));

  // Convert sets to arrays for output
  const firstSets: Record<string, string[]> = {};
  const followSets: Record<string, string[]> = {};

  first.forEach((set, symbol) => {
    if (grammar.nonTerminals.includes(symbol)) {
      firstSets[symbol] = [...set].sort();
    }
  });

  follow.forEach((set, symbol) => {
    followSets[symbol] = [...set].sort();
  });

  // Convert parse table
  const tableObj: Record<string, Record<string, number>> = {};
  parseTable.table.forEach((row, nt) => {
    tableObj[nt] = {};
    row.forEach((prod, term) => {
      if (prod) tableObj[nt][term] = prod.index;
    });
  });

  return {
    isLL1: parseTable.conflicts.length === 0,
    conflicts: parseTable.conflicts,
    nullableSymbols,
    firstSets,
    followSets,
    parseTable: tableObj,
  };
}

/**
 * Eliminate left recursion from grammar
 */
function eliminateLeftRecursion(grammar: Grammar): Grammar {
  const newProductions: Production[] = [];
  let prodIndex = 0;

  for (const A of grammar.nonTerminals) {
    const aProductions = grammar.productions.filter((p) => p.lhs === A);
    const leftRecursive = aProductions.filter((p) => p.rhs[0] === A);
    const nonLeftRecursive = aProductions.filter((p) => p.rhs[0] !== A);

    if (leftRecursive.length === 0) {
      // No left recursion
      aProductions.forEach((p) => {
        newProductions.push({ ...p, index: prodIndex++ });
      });
    } else {
      // Eliminate: A -> Aα | β becomes A -> βA', A' -> αA' | ε
      const aPrime = `${A}'`;

      // A -> β A'
      nonLeftRecursive.forEach((p) => {
        newProductions.push({
          lhs: A,
          rhs: [...p.rhs, aPrime],
          index: prodIndex++,
        });
      });

      if (nonLeftRecursive.length === 0) {
        // Only left recursive: A -> A'
        newProductions.push({
          lhs: A,
          rhs: [aPrime],
          index: prodIndex++,
        });
      }

      // A' -> α A'
      leftRecursive.forEach((p) => {
        newProductions.push({
          lhs: aPrime,
          rhs: [...p.rhs.slice(1), aPrime],
          index: prodIndex++,
        });
      });

      // A' -> ε
      newProductions.push({
        lhs: aPrime,
        rhs: [],
        index: prodIndex++,
      });
    }
  }

  // Collect new non-terminals
  const newNonTerminals = [...new Set(newProductions.map((p) => p.lhs))];

  return {
    ...grammar,
    nonTerminals: newNonTerminals,
    productions: newProductions,
  };
}

/**
 * Left factor grammar
 */
function leftFactor(grammar: Grammar): Grammar {
  const newProductions: Production[] = [];
  let prodIndex = 0;
  let factorCount = 0;

  for (const A of grammar.nonTerminals) {
    const aProductions = grammar.productions.filter((p) => p.lhs === A);

    // Group by common prefix
    const groups = new Map<string, Production[]>();

    for (const prod of aProductions) {
      const prefix = prod.rhs[0] || EPSILON;
      if (!groups.has(prefix)) groups.set(prefix, []);
      groups.get(prefix)!.push(prod);
    }

    for (const [prefix, prods] of groups) {
      if (prods.length === 1 || prefix === EPSILON) {
        // No common prefix
        prods.forEach((p) => {
          newProductions.push({ ...p, index: prodIndex++ });
        });
      } else {
        // Factor out common prefix
        const aFactor = `${A}_f${factorCount++}`;

        // A -> prefix A_f
        newProductions.push({
          lhs: A,
          rhs: [prefix, aFactor],
          index: prodIndex++,
        });

        // A_f -> rest of each production
        for (const prod of prods) {
          const rest = prod.rhs.slice(1);
          newProductions.push({
            lhs: aFactor,
            rhs: rest.length > 0 ? rest : [],
            index: prodIndex++,
          });
        }
      }
    }
  }

  const newNonTerminals = [...new Set(newProductions.map((p) => p.lhs))];

  return {
    ...grammar,
    nonTerminals: newNonTerminals,
    productions: newProductions,
  };
}

/**
 * Format grammar for display
 */
function formatGrammar(grammar: Grammar): string {
  const lines: string[] = [];

  let currentLhs = '';
  for (const prod of grammar.productions) {
    const rhs = prod.rhs.length > 0 ? prod.rhs.join(' ') : EPSILON;
    if (prod.lhs !== currentLhs) {
      lines.push(`${prod.lhs} -> ${rhs}`);
      currentLhs = prod.lhs;
    } else {
      lines.push(`   | ${rhs}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format parse tree
 */
function formatParseTree(tree: ParseTree, indent: string = ''): string {
  const lines: string[] = [];
  const value = tree.isTerminal && tree.value ? ` = "${tree.value}"` : '';
  lines.push(`${indent}${tree.symbol}${value}`);

  tree.children.forEach((child, i) => {
    const isLast = i === tree.children.length - 1;
    const childIndent = indent + (isLast ? '  ' : '│ ');
    const prefix = indent + (isLast ? '└─' : '├─');
    const childValue = child.isTerminal && child.value ? ` = "${child.value}"` : '';
    lines.push(`${prefix}${child.symbol}${childValue}`);

    if (child.children.length > 0) {
      child.children.forEach((grandchild, _j) => {
        lines.push(formatParseTree(grandchild, childIndent));
      });
    }
  });

  return lines.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const llparserTool: UnifiedTool = {
  name: 'll_parser',
  description:
    'Comprehensive LL parser generator with FIRST/FOLLOW computation, parse table construction, recursive descent generation, and grammar transformations',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'analyze',
          'parse',
          'first_follow',
          'generate',
          'transform',
          'demo',
          'info',
          'examples',
        ],
        description: 'Operation to perform',
      },
      grammar: {
        type: 'string',
        description:
          'Grammar in BNF-like notation (e.g., "E -> E + T | T\\nT -> T * F | F\\nF -> ( E ) | id")',
      },
      input: {
        type: 'array',
        items: { type: 'string' },
        description: 'Input tokens to parse',
      },
      transformation: {
        type: 'string',
        enum: ['eliminate_left_recursion', 'left_factor', 'both'],
        description: 'Grammar transformation to apply',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executellparser(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, grammar: grammarText, input, transformation } = args;

    switch (operation) {
      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              tool: 'LL Parser Generator',
              description: 'Comprehensive LL(1) parser tools',
              capabilities: [
                'FIRST and FOLLOW set computation',
                'LL(1) parse table construction',
                'Conflict detection (FIRST-FIRST, FIRST-FOLLOW)',
                'Predictive parsing with derivation trace',
                'Parse tree construction',
                'Recursive descent code generation',
                'Left recursion elimination',
                'Left factoring',
              ],
              concepts: {
                LL1: 'Top-down parser that reads input Left-to-right, produces Leftmost derivation, using 1 token lookahead',
                FIRST: 'Set of terminals that can begin strings derived from a symbol',
                FOLLOW: 'Set of terminals that can appear after a non-terminal',
                predictiveParsing: 'Parsing without backtracking using lookahead',
                recursiveDescent: 'Implementation using mutually recursive functions',
              },
              operations: [
                'analyze',
                'parse',
                'first_follow',
                'generate',
                'transform',
                'demo',
                'examples',
              ],
            },
            null,
            2
          ),
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              examples: [
                {
                  name: 'Analyze Grammar',
                  params: {
                    operation: 'analyze',
                    grammar:
                      "E -> T E'\nE' -> + T E' | ε\nT -> F T'\nT' -> * F T' | ε\nF -> ( E ) | id",
                  },
                },
                {
                  name: 'Parse Input',
                  params: {
                    operation: 'parse',
                    grammar: 'S -> a S b | ε',
                    input: ['a', 'a', 'b', 'b'],
                  },
                },
                {
                  name: 'Eliminate Left Recursion',
                  params: {
                    operation: 'transform',
                    grammar: 'E -> E + T | T\nT -> T * F | F\nF -> ( E ) | id',
                    transformation: 'eliminate_left_recursion',
                  },
                },
              ],
            },
            null,
            2
          ),
        };
      }

      case 'analyze': {
        if (!grammarText) {
          return { toolCallId: id, content: 'Error: grammar is required', isError: true };
        }

        const grammar = parseGrammar(grammarText);
        const analysis = analyzeGrammar(grammar);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'analyze',
              grammar: {
                terminals: grammar.terminals,
                nonTerminals: grammar.nonTerminals,
                startSymbol: grammar.startSymbol,
                productionCount: grammar.productions.length,
                formatted: formatGrammar(grammar),
              },
              analysis: {
                isLL1: analysis.isLL1,
                reason: analysis.isLL1
                  ? 'Grammar has no FIRST-FIRST or FIRST-FOLLOW conflicts'
                  : `Grammar has ${analysis.conflicts.length} conflict(s)`,
                conflicts: analysis.conflicts.map((c) => ({
                  type: c.type,
                  location: `M[${c.nonTerminal}, ${c.terminal}]`,
                  conflictingProductions: c.productions.map(
                    (p) => `${p.lhs} -> ${p.rhs.join(' ') || EPSILON}`
                  ),
                })),
                nullableSymbols: analysis.nullableSymbols,
                firstSets: analysis.firstSets,
                followSets: analysis.followSets,
              },
              parseTable: analysis.parseTable,
            },
            null,
            2
          ),
        };
      }

      case 'first_follow': {
        if (!grammarText) {
          return { toolCallId: id, content: 'Error: grammar is required', isError: true };
        }

        const grammar = parseGrammar(grammarText);
        const first = computeFirstSets(grammar);
        const follow = computeFollowSets(grammar, first);

        const firstSets: Record<string, string[]> = {};
        const followSets: Record<string, string[]> = {};

        grammar.nonTerminals.forEach((nt) => {
          firstSets[nt] = [...(first.get(nt) || [])].sort();
          followSets[nt] = [...(follow.get(nt) || [])].sort();
        });

        // Compute FIRST for each production's RHS
        const productionFirsts = grammar.productions.map((p) => ({
          production: `${p.lhs} -> ${p.rhs.join(' ') || EPSILON}`,
          first: [...computeFirstOfString(p.rhs, first)].sort(),
        }));

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'first_follow',
              grammar: formatGrammar(grammar),
              firstSets,
              followSets,
              productionFirstSets: productionFirsts,
              explanation: {
                first: 'FIRST(X) = set of terminals that begin strings derivable from X',
                follow:
                  'FOLLOW(A) = set of terminals that can appear immediately to the right of A',
                epsilon: `${EPSILON} in FIRST means the symbol can derive empty string`,
              },
            },
            null,
            2
          ),
        };
      }

      case 'parse': {
        if (!grammarText) {
          return { toolCallId: id, content: 'Error: grammar is required', isError: true };
        }
        if (!input || !Array.isArray(input)) {
          return { toolCallId: id, content: 'Error: input array is required', isError: true };
        }

        const grammar = parseGrammar(grammarText);
        const first = computeFirstSets(grammar);
        const follow = computeFollowSets(grammar, first);
        const parseTable = buildParseTable(grammar, first, follow);

        if (parseTable.conflicts.length > 0) {
          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                operation: 'parse',
                error: 'Grammar is not LL(1) - has conflicts',
                conflicts: parseTable.conflicts.map((c) => ({
                  type: c.type,
                  location: `M[${c.nonTerminal}, ${c.terminal}]`,
                })),
                suggestion: 'Try transforming the grammar first',
              },
              null,
              2
            ),
          };
        }

        const result = parseWithTable(input, grammar, parseTable);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'parse',
              input: input.join(' '),
              success: result.success,
              ...(result.success
                ? {
                    parseTree: formatParseTree(result.tree!),
                    derivation: result.derivation,
                  }
                : {
                    error: result.error,
                    position: result.position,
                    partialDerivation: result.derivation,
                  }),
            },
            null,
            2
          ),
        };
      }

      case 'generate': {
        if (!grammarText) {
          return { toolCallId: id, content: 'Error: grammar is required', isError: true };
        }

        const grammar = parseGrammar(grammarText);
        const analysis = analyzeGrammar(grammar);

        if (!analysis.isLL1) {
          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                operation: 'generate',
                error: 'Cannot generate parser - grammar is not LL(1)',
                conflicts: analysis.conflicts.length,
                suggestion: 'Transform grammar first using eliminate_left_recursion or left_factor',
              },
              null,
              2
            ),
          };
        }

        const first = computeFirstSets(grammar);
        const follow = computeFollowSets(grammar, first);
        const code = generateRecursiveDescentCode(grammar, first, follow);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'generate',
              grammar: formatGrammar(grammar),
              generatedCode: code,
              usage:
                'const parser = new Parser();\nconst success = parser.parse(["id", "+", "id"]);',
            },
            null,
            2
          ),
        };
      }

      case 'transform': {
        if (!grammarText) {
          return { toolCallId: id, content: 'Error: grammar is required', isError: true };
        }

        let grammar = parseGrammar(grammarText);
        const originalGrammar = formatGrammar(grammar);
        const transformations: string[] = [];

        const trans = transformation || 'both';

        if (trans === 'eliminate_left_recursion' || trans === 'both') {
          grammar = eliminateLeftRecursion(grammar);
          transformations.push('Left recursion elimination');
        }

        if (trans === 'left_factor' || trans === 'both') {
          grammar = leftFactor(grammar);
          transformations.push('Left factoring');
        }

        const analysis = analyzeGrammar(grammar);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'transform',
              originalGrammar,
              transformationsApplied: transformations,
              transformedGrammar: formatGrammar(grammar),
              analysis: {
                isLL1: analysis.isLL1,
                conflicts: analysis.conflicts.length,
              },
            },
            null,
            2
          ),
        };
      }

      case 'demo': {
        // Classic expression grammar - not LL(1)
        const originalGrammar = 'E -> E + T | T\nT -> T * F | F\nF -> ( E ) | id';
        const original = parseGrammar(originalGrammar);
        const originalAnalysis = analyzeGrammar(original);

        // Transform to LL(1)
        const transformed = eliminateLeftRecursion(original);
        const transformedAnalysis = analyzeGrammar(transformed);

        // Parse example
        const first = computeFirstSets(transformed);
        const follow = computeFollowSets(transformed, first);
        const parseTable = buildParseTable(transformed, first, follow);
        const parseResult = parseWithTable(['id', '+', 'id', '*', 'id'], transformed, parseTable);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'demo',
              title: 'LL(1) Parser Generation Demo',
              step1_original: {
                grammar: formatGrammar(original),
                isLL1: originalAnalysis.isLL1,
                problem: 'Left recursion prevents LL(1) parsing',
              },
              step2_transformed: {
                grammar: formatGrammar(transformed),
                isLL1: transformedAnalysis.isLL1,
                firstSets: transformedAnalysis.firstSets,
                followSets: transformedAnalysis.followSets,
              },
              step3_parsing: {
                input: 'id + id * id',
                success: parseResult.success,
                derivation: parseResult.derivation?.slice(0, 10),
                note: 'Showing first 10 derivation steps',
              },
              concepts: [
                'LL(1) requires no left recursion',
                'FIRST sets determine which production to use',
                'FOLLOW sets handle nullable productions',
                'Conflicts indicate grammar is not LL(1)',
              ],
            },
            null,
            2
          ),
        };
      }

      default:
        return {
          toolCallId: id,
          content: `Unknown operation: ${operation}. Use 'info' for available operations.`,
          isError: true,
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isllparserAvailable(): boolean {
  return true;
}
