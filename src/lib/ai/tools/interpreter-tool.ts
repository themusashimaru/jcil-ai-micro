/**
 * INTERPRETER TOOL
 * Language interpreter simulation with tree-walking and bytecode execution modes
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Token types for lexer
type TokenType = 'NUMBER' | 'STRING' | 'IDENTIFIER' | 'OPERATOR' | 'KEYWORD' | 'PUNCTUATION' | 'EOF';

interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

// AST node types
type ASTNodeType = 'Program' | 'BinaryExpr' | 'UnaryExpr' | 'Literal' | 'Identifier' |
  'Assignment' | 'VarDecl' | 'FunctionDecl' | 'FunctionCall' | 'IfStatement' |
  'WhileLoop' | 'ForLoop' | 'Return' | 'Block' | 'Print';

interface ASTNode {
  type: ASTNodeType;
  value?: unknown;
  left?: ASTNode;
  right?: ASTNode;
  operator?: string;
  name?: string;
  params?: string[];
  body?: ASTNode[];
  condition?: ASTNode;
  then?: ASTNode;
  else?: ASTNode;
  init?: ASTNode;
  update?: ASTNode;
  arguments?: ASTNode[];
}

// Bytecode instruction types
type Opcode = 'LOAD_CONST' | 'LOAD_VAR' | 'STORE_VAR' | 'ADD' | 'SUB' | 'MUL' | 'DIV' |
  'EQ' | 'NE' | 'LT' | 'GT' | 'LE' | 'GE' | 'AND' | 'OR' | 'NOT' |
  'JUMP' | 'JUMP_IF_FALSE' | 'CALL' | 'RETURN' | 'PRINT' | 'POP' | 'HALT';

interface Instruction {
  opcode: Opcode;
  operand?: unknown;
  line?: number;
}

// Runtime environment
interface Environment {
  variables: Map<string, unknown>;
  functions: Map<string, { params: string[]; body: ASTNode[] }>;
  parent?: Environment;
}

// Bytecode VM state
interface VMState {
  stack: unknown[];
  pc: number; // Program counter
  fp: number; // Frame pointer
  callStack: { returnAddr: number; env: Environment }[];
}

// Language keywords
const KEYWORDS = new Set([
  'var', 'let', 'const', 'function', 'if', 'else', 'while', 'for',
  'return', 'true', 'false', 'null', 'print', 'and', 'or', 'not'
]);

// Operator precedence
const PRECEDENCE: Record<string, number> = {
  'or': 1, 'and': 2,
  '==': 3, '!=': 3, '<': 3, '>': 3, '<=': 3, '>=': 3,
  '+': 4, '-': 4,
  '*': 5, '/': 5, '%': 5,
  'not': 6
};

export const interpreterTool: UnifiedTool = {
  name: 'interpreter',
  description: 'Language interpreter simulation with tree-walking and bytecode execution, lexer, parser, and runtime evaluation',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['execute', 'step', 'eval', 'repl', 'tokenize', 'parse', 'compile', 'disassemble', 'info', 'examples'],
        description: 'Operation type'
      },
      code: { type: 'string', description: 'Source code to interpret' },
      mode: { type: 'string', enum: ['tree_walking', 'bytecode', 'JIT'], description: 'Execution mode' },
      expression: { type: 'string', description: 'Single expression to evaluate' },
      max_steps: { type: 'number', description: 'Maximum execution steps (for debugging)' },
      show_ast: { type: 'boolean', description: 'Show AST in output' },
      show_bytecode: { type: 'boolean', description: 'Show bytecode in output' }
    },
    required: ['operation']
  }
};

export async function executeinterpreter(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'execute':
        result = executeCode(args);
        break;

      case 'step':
        result = stepExecution(args);
        break;

      case 'eval':
        result = evaluateExpression(args);
        break;

      case 'repl':
        result = simulateREPL(args);
        break;

      case 'tokenize':
        result = tokenizeCode(args);
        break;

      case 'parse':
        result = parseCode(args);
        break;

      case 'compile':
        result = compileCode(args);
        break;

      case 'disassemble':
        result = disassembleCode(args);
        break;

      case 'examples':
        result = getExamples();
        break;

      case 'info':
      default:
        result = getInfo();
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

// Lexer - tokenize source code
function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let line = 1;
  let column = 1;

  while (pos < source.length) {
    const char = source[pos];

    // Skip whitespace
    if (/\s/.test(char)) {
      if (char === '\n') { line++; column = 1; }
      else { column++; }
      pos++;
      continue;
    }

    // Skip comments
    if (char === '/' && source[pos + 1] === '/') {
      while (pos < source.length && source[pos] !== '\n') pos++;
      continue;
    }

    // Numbers
    if (/\d/.test(char)) {
      let num = '';
      while (pos < source.length && /[\d.]/.test(source[pos])) {
        num += source[pos++];
      }
      tokens.push({ type: 'NUMBER', value: num, line, column });
      column += num.length;
      continue;
    }

    // Strings
    if (char === '"' || char === "'") {
      const quote = char;
      pos++;
      let str = '';
      while (pos < source.length && source[pos] !== quote) {
        if (source[pos] === '\\') {
          pos++;
          const escapes: Record<string, string> = { 'n': '\n', 't': '\t', 'r': '\r', '\\': '\\' };
          str += escapes[source[pos]] || source[pos];
        } else {
          str += source[pos];
        }
        pos++;
      }
      pos++; // Skip closing quote
      tokens.push({ type: 'STRING', value: str, line, column });
      column += str.length + 2;
      continue;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(char)) {
      let ident = '';
      while (pos < source.length && /[a-zA-Z0-9_]/.test(source[pos])) {
        ident += source[pos++];
      }
      const type = KEYWORDS.has(ident) ? 'KEYWORD' : 'IDENTIFIER';
      tokens.push({ type, value: ident, line, column });
      column += ident.length;
      continue;
    }

    // Multi-character operators
    const twoChar = source.slice(pos, pos + 2);
    if (['==', '!=', '<=', '>=', '&&', '||', '++', '--'].includes(twoChar)) {
      tokens.push({ type: 'OPERATOR', value: twoChar, line, column });
      pos += 2;
      column += 2;
      continue;
    }

    // Single-character operators and punctuation
    if ('+-*/%=<>!'.includes(char)) {
      tokens.push({ type: 'OPERATOR', value: char, line, column });
      pos++;
      column++;
      continue;
    }

    if ('(){}[];,'.includes(char)) {
      tokens.push({ type: 'PUNCTUATION', value: char, line, column });
      pos++;
      column++;
      continue;
    }

    // Unknown character
    pos++;
    column++;
  }

  tokens.push({ type: 'EOF', value: '', line, column });
  return tokens;
}

// Simple recursive descent parser
function parse(tokens: Token[]): ASTNode {
  let pos = 0;

  function current(): Token {
    return tokens[pos] || { type: 'EOF', value: '', line: 0, column: 0 };
  }

  function consume(expected?: string): Token {
    const token = current();
    if (expected && token.value !== expected) {
      throw new Error(`Expected '${expected}' but got '${token.value}' at line ${token.line}`);
    }
    pos++;
    return token;
  }

  function parseProgram(): ASTNode {
    const statements: ASTNode[] = [];
    while (current().type !== 'EOF') {
      statements.push(parseStatement());
    }
    return { type: 'Program', body: statements };
  }

  function parseStatement(): ASTNode {
    const token = current();

    if (token.value === 'var' || token.value === 'let' || token.value === 'const') {
      return parseVarDecl();
    }
    if (token.value === 'function') {
      return parseFunctionDecl();
    }
    if (token.value === 'if') {
      return parseIfStatement();
    }
    if (token.value === 'while') {
      return parseWhileLoop();
    }
    if (token.value === 'for') {
      return parseForLoop();
    }
    if (token.value === 'return') {
      return parseReturn();
    }
    if (token.value === 'print') {
      return parsePrint();
    }
    if (token.value === '{') {
      return parseBlock();
    }

    // Expression statement
    const expr = parseExpression();
    if (current().value === ';') consume(';');
    return expr;
  }

  function parseVarDecl(): ASTNode {
    consume(); // var/let/const
    const name = consume().value;
    consume('=');
    const value = parseExpression();
    if (current().value === ';') consume(';');
    return { type: 'VarDecl', name, value };
  }

  function parseFunctionDecl(): ASTNode {
    consume('function');
    const name = consume().value;
    consume('(');
    const params: string[] = [];
    while (current().value !== ')') {
      params.push(consume().value);
      if (current().value === ',') consume(',');
    }
    consume(')');
    const body = parseBlock();
    return { type: 'FunctionDecl', name, params, body: body.body };
  }

  function parseIfStatement(): ASTNode {
    consume('if');
    consume('(');
    const condition = parseExpression();
    consume(')');
    const then = parseStatement();
    let elseNode: ASTNode | undefined;
    if (current().value === 'else') {
      consume('else');
      elseNode = parseStatement();
    }
    return { type: 'IfStatement', condition, then, else: elseNode };
  }

  function parseWhileLoop(): ASTNode {
    consume('while');
    consume('(');
    const condition = parseExpression();
    consume(')');
    const body = parseStatement();
    return { type: 'WhileLoop', condition, body: [body] };
  }

  function parseForLoop(): ASTNode {
    consume('for');
    consume('(');
    const init = parseStatement();
    const condition = parseExpression();
    if (current().value === ';') consume(';');
    const update = parseExpression();
    consume(')');
    const body = parseStatement();
    return { type: 'ForLoop', init, condition, update, body: [body] };
  }

  function parseReturn(): ASTNode {
    consume('return');
    const value = current().value === ';' ? undefined : parseExpression();
    if (current().value === ';') consume(';');
    return { type: 'Return', value };
  }

  function parsePrint(): ASTNode {
    consume('print');
    consume('(');
    const value = parseExpression();
    consume(')');
    if (current().value === ';') consume(';');
    return { type: 'Print', value };
  }

  function parseBlock(): ASTNode {
    consume('{');
    const statements: ASTNode[] = [];
    while (current().value !== '}') {
      statements.push(parseStatement());
    }
    consume('}');
    return { type: 'Block', body: statements };
  }

  function parseExpression(minPrecedence = 0): ASTNode {
    let left = parseUnary();

    while (true) {
      const op = current().value;
      const precedence = PRECEDENCE[op];
      if (precedence === undefined || precedence < minPrecedence) break;

      consume();
      const right = parseExpression(precedence + 1);
      left = { type: 'BinaryExpr', operator: op, left, right };
    }

    return left;
  }

  function parseUnary(): ASTNode {
    if (current().value === '-' || current().value === 'not' || current().value === '!') {
      const op = consume().value;
      const operand = parseUnary();
      return { type: 'UnaryExpr', operator: op, right: operand };
    }
    return parsePrimary();
  }

  function parsePrimary(): ASTNode {
    const token = current();

    if (token.type === 'NUMBER') {
      consume();
      return { type: 'Literal', value: parseFloat(token.value) };
    }

    if (token.type === 'STRING') {
      consume();
      return { type: 'Literal', value: token.value };
    }

    if (token.value === 'true' || token.value === 'false') {
      consume();
      return { type: 'Literal', value: token.value === 'true' };
    }

    if (token.value === 'null') {
      consume();
      return { type: 'Literal', value: null };
    }

    if (token.type === 'IDENTIFIER') {
      const name = consume().value;
      if (current().value === '(') {
        // Function call
        consume('(');
        const args: ASTNode[] = [];
        while (current().value !== ')') {
          args.push(parseExpression());
          if (current().value === ',') consume(',');
        }
        consume(')');
        return { type: 'FunctionCall', name, arguments: args };
      }
      if (current().value === '=') {
        // Assignment
        consume('=');
        const value = parseExpression();
        return { type: 'Assignment', name, value };
      }
      return { type: 'Identifier', name };
    }

    if (token.value === '(') {
      consume('(');
      const expr = parseExpression();
      consume(')');
      return expr;
    }

    throw new Error(`Unexpected token: ${token.value} at line ${token.line}`);
  }

  return parseProgram();
}

// Tree-walking interpreter
function interpret(ast: ASTNode, env: Environment): { value: unknown; output: string[] } {
  const output: string[] = [];

  function evaluate(node: ASTNode): unknown {
    switch (node.type) {
      case 'Program':
        let result: unknown;
        for (const stmt of node.body || []) {
          result = evaluate(stmt);
        }
        return result;

      case 'Literal':
        return node.value;

      case 'Identifier':
        return lookupVar(env, node.name!);

      case 'BinaryExpr':
        return evalBinaryOp(node.operator!, evaluate(node.left!), evaluate(node.right!));

      case 'UnaryExpr':
        return evalUnaryOp(node.operator!, evaluate(node.right!));

      case 'VarDecl':
        env.variables.set(node.name!, evaluate(node.value!));
        return undefined;

      case 'Assignment':
        const value = evaluate(node.value!);
        setVar(env, node.name!, value);
        return value;

      case 'FunctionDecl':
        env.functions.set(node.name!, { params: node.params!, body: node.body! });
        return undefined;

      case 'FunctionCall':
        return callFunction(node.name!, (node.arguments || []).map(a => evaluate(a)));

      case 'IfStatement':
        if (evaluate(node.condition!)) {
          return evaluate(node.then!);
        } else if (node.else) {
          return evaluate(node.else);
        }
        return undefined;

      case 'WhileLoop':
        while (evaluate(node.condition!)) {
          for (const stmt of node.body || []) {
            evaluate(stmt);
          }
        }
        return undefined;

      case 'ForLoop':
        evaluate(node.init!);
        while (evaluate(node.condition!)) {
          for (const stmt of node.body || []) {
            evaluate(stmt);
          }
          evaluate(node.update!);
        }
        return undefined;

      case 'Return':
        return node.value ? evaluate(node.value) : undefined;

      case 'Block':
        const blockEnv: Environment = { variables: new Map(), functions: new Map(), parent: env };
        let blockResult: unknown;
        for (const stmt of node.body || []) {
          blockResult = evaluate(stmt);
        }
        return blockResult;

      case 'Print':
        const printVal = evaluate(node.value!);
        output.push(String(printVal));
        return printVal;

      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }

  function evalBinaryOp(op: string, left: unknown, right: unknown): unknown {
    switch (op) {
      case '+': return (left as number) + (right as number);
      case '-': return (left as number) - (right as number);
      case '*': return (left as number) * (right as number);
      case '/': return (left as number) / (right as number);
      case '%': return (left as number) % (right as number);
      case '==': return left === right;
      case '!=': return left !== right;
      case '<': return (left as number) < (right as number);
      case '>': return (left as number) > (right as number);
      case '<=': return (left as number) <= (right as number);
      case '>=': return (left as number) >= (right as number);
      case 'and': case '&&': return left && right;
      case 'or': case '||': return left || right;
      default: throw new Error(`Unknown operator: ${op}`);
    }
  }

  function evalUnaryOp(op: string, operand: unknown): unknown {
    switch (op) {
      case '-': return -(operand as number);
      case 'not': case '!': return !operand;
      default: throw new Error(`Unknown unary operator: ${op}`);
    }
  }

  function lookupVar(e: Environment, name: string): unknown {
    if (e.variables.has(name)) return e.variables.get(name);
    if (e.parent) return lookupVar(e.parent, name);
    throw new Error(`Undefined variable: ${name}`);
  }

  function setVar(e: Environment, name: string, value: unknown): void {
    if (e.variables.has(name)) {
      e.variables.set(name, value);
      return;
    }
    if (e.parent) {
      setVar(e.parent, name, value);
      return;
    }
    throw new Error(`Undefined variable: ${name}`);
  }

  function callFunction(name: string, args: unknown[]): unknown {
    // Built-in functions
    if (name === 'sqrt') return Math.sqrt(args[0] as number);
    if (name === 'abs') return Math.abs(args[0] as number);
    if (name === 'floor') return Math.floor(args[0] as number);
    if (name === 'ceil') return Math.ceil(args[0] as number);
    if (name === 'round') return Math.round(args[0] as number);
    if (name === 'min') return Math.min(...(args as number[]));
    if (name === 'max') return Math.max(...(args as number[]));
    if (name === 'len') return (args[0] as string).length;

    const func = env.functions.get(name);
    if (!func) throw new Error(`Undefined function: ${name}`);

    const funcEnv: Environment = { variables: new Map(), functions: env.functions, parent: env };
    func.params.forEach((param, i) => funcEnv.variables.set(param, args[i]));

    for (const stmt of func.body) {
      const result = evaluate(stmt);
      if (stmt.type === 'Return') return result;
    }
    return undefined;
  }

  const result = evaluate(ast);
  return { value: result, output };
}

// Bytecode compiler
function compile(ast: ASTNode): Instruction[] {
  const instructions: Instruction[] = [];

  function emit(opcode: Opcode, operand?: unknown): void {
    instructions.push({ opcode, operand });
  }

  function compileNode(node: ASTNode): void {
    switch (node.type) {
      case 'Program':
        for (const stmt of node.body || []) {
          compileNode(stmt);
        }
        emit('HALT');
        break;

      case 'Literal':
        emit('LOAD_CONST', node.value);
        break;

      case 'Identifier':
        emit('LOAD_VAR', node.name);
        break;

      case 'BinaryExpr':
        compileNode(node.left!);
        compileNode(node.right!);
        const opMap: Record<string, Opcode> = {
          '+': 'ADD', '-': 'SUB', '*': 'MUL', '/': 'DIV',
          '==': 'EQ', '!=': 'NE', '<': 'LT', '>': 'GT', '<=': 'LE', '>=': 'GE',
          'and': 'AND', 'or': 'OR'
        };
        emit(opMap[node.operator!] || 'ADD');
        break;

      case 'UnaryExpr':
        compileNode(node.right!);
        if (node.operator === '-') {
          emit('LOAD_CONST', -1);
          emit('MUL');
        } else if (node.operator === 'not' || node.operator === '!') {
          emit('NOT');
        }
        break;

      case 'VarDecl':
        compileNode(node.value!);
        emit('STORE_VAR', node.name);
        break;

      case 'Assignment':
        compileNode(node.value!);
        emit('STORE_VAR', node.name);
        break;

      case 'Print':
        compileNode(node.value!);
        emit('PRINT');
        break;

      case 'IfStatement':
        compileNode(node.condition!);
        const jumpIfFalseIdx = instructions.length;
        emit('JUMP_IF_FALSE', 0); // Placeholder
        compileNode(node.then!);
        if (node.else) {
          const jumpIdx = instructions.length;
          emit('JUMP', 0); // Placeholder
          instructions[jumpIfFalseIdx].operand = instructions.length;
          compileNode(node.else);
          instructions[jumpIdx].operand = instructions.length;
        } else {
          instructions[jumpIfFalseIdx].operand = instructions.length;
        }
        break;

      case 'WhileLoop':
        const loopStart = instructions.length;
        compileNode(node.condition!);
        const exitJumpIdx = instructions.length;
        emit('JUMP_IF_FALSE', 0);
        for (const stmt of node.body || []) {
          compileNode(stmt);
        }
        emit('JUMP', loopStart);
        instructions[exitJumpIdx].operand = instructions.length;
        break;

      case 'Block':
        for (const stmt of node.body || []) {
          compileNode(stmt);
        }
        break;

      case 'Return':
        if (node.value) compileNode(node.value);
        else emit('LOAD_CONST', undefined);
        emit('RETURN');
        break;

      default:
        throw new Error(`Cannot compile node type: ${node.type}`);
    }
  }

  compileNode(ast);
  return instructions;
}

// Bytecode VM
function runBytecode(instructions: Instruction[]): { value: unknown; output: string[] } {
  const vm: VMState = {
    stack: [],
    pc: 0,
    fp: 0,
    callStack: []
  };
  const variables: Map<string, unknown> = new Map();
  const output: string[] = [];

  while (vm.pc < instructions.length) {
    const instr = instructions[vm.pc];

    switch (instr.opcode) {
      case 'LOAD_CONST':
        vm.stack.push(instr.operand);
        break;

      case 'LOAD_VAR':
        vm.stack.push(variables.get(instr.operand as string));
        break;

      case 'STORE_VAR':
        variables.set(instr.operand as string, vm.stack.pop());
        break;

      case 'ADD':
        vm.stack.push((vm.stack.pop() as number) + (vm.stack.pop() as number));
        break;

      case 'SUB': {
        const b = vm.stack.pop() as number;
        const a = vm.stack.pop() as number;
        vm.stack.push(a - b);
        break;
      }

      case 'MUL':
        vm.stack.push((vm.stack.pop() as number) * (vm.stack.pop() as number));
        break;

      case 'DIV': {
        const divisor = vm.stack.pop() as number;
        const dividend = vm.stack.pop() as number;
        vm.stack.push(dividend / divisor);
        break;
      }

      case 'EQ':
        vm.stack.push(vm.stack.pop() === vm.stack.pop());
        break;

      case 'NE':
        vm.stack.push(vm.stack.pop() !== vm.stack.pop());
        break;

      case 'LT': {
        const b = vm.stack.pop() as number;
        const a = vm.stack.pop() as number;
        vm.stack.push(a < b);
        break;
      }

      case 'GT': {
        const b = vm.stack.pop() as number;
        const a = vm.stack.pop() as number;
        vm.stack.push(a > b);
        break;
      }

      case 'LE': {
        const b = vm.stack.pop() as number;
        const a = vm.stack.pop() as number;
        vm.stack.push(a <= b);
        break;
      }

      case 'GE': {
        const b = vm.stack.pop() as number;
        const a = vm.stack.pop() as number;
        vm.stack.push(a >= b);
        break;
      }

      case 'AND':
        vm.stack.push(vm.stack.pop() && vm.stack.pop());
        break;

      case 'OR':
        vm.stack.push(vm.stack.pop() || vm.stack.pop());
        break;

      case 'NOT':
        vm.stack.push(!vm.stack.pop());
        break;

      case 'JUMP':
        vm.pc = instr.operand as number;
        continue;

      case 'JUMP_IF_FALSE':
        if (!vm.stack.pop()) {
          vm.pc = instr.operand as number;
          continue;
        }
        break;

      case 'PRINT':
        const val = vm.stack.pop();
        output.push(String(val));
        break;

      case 'POP':
        vm.stack.pop();
        break;

      case 'HALT':
        return { value: vm.stack[vm.stack.length - 1], output };

      case 'RETURN':
        return { value: vm.stack.pop(), output };
    }

    vm.pc++;
  }

  return { value: vm.stack[vm.stack.length - 1], output };
}

function executeCode(args: Record<string, unknown>): Record<string, unknown> {
  const code = (args.code as string) || 'print(1 + 2)';
  const mode = (args.mode as string) || 'tree_walking';
  const showAst = args.show_ast === true;
  const showBytecode = args.show_bytecode === true;

  const startTime = Date.now();
  const tokens = tokenize(code);
  const lexTime = Date.now() - startTime;

  const parseStart = Date.now();
  const ast = parse(tokens);
  const parseTime = Date.now() - parseStart;

  let result: { value: unknown; output: string[] };
  let bytecode: Instruction[] | undefined;
  let execTime: number;

  if (mode === 'bytecode' || mode === 'JIT') {
    const compileStart = Date.now();
    bytecode = compile(ast);
    const compileTime = Date.now() - compileStart;

    const runStart = Date.now();
    result = runBytecode(bytecode);
    execTime = Date.now() - runStart;

    return {
      operation: 'execute',
      mode,
      code,
      output: result.output,
      return_value: result.value,
      ...(showAst && { ast: simplifyAST(ast) }),
      ...(showBytecode && { bytecode: formatBytecode(bytecode) }),
      timing: {
        lex_ms: lexTime,
        parse_ms: parseTime,
        compile_ms: compileTime,
        execute_ms: execTime,
        total_ms: lexTime + parseTime + compileTime + execTime
      },
      statistics: {
        tokens: tokens.length - 1,
        ast_nodes: countNodes(ast),
        bytecode_instructions: bytecode.length
      }
    };
  }

  // Tree-walking mode
  const env: Environment = { variables: new Map(), functions: new Map() };
  const runStart = Date.now();
  result = interpret(ast, env);
  execTime = Date.now() - runStart;

  return {
    operation: 'execute',
    mode: 'tree_walking',
    code,
    output: result.output,
    return_value: result.value,
    ...(showAst && { ast: simplifyAST(ast) }),
    timing: {
      lex_ms: lexTime,
      parse_ms: parseTime,
      execute_ms: execTime,
      total_ms: lexTime + parseTime + execTime
    },
    statistics: {
      tokens: tokens.length - 1,
      ast_nodes: countNodes(ast)
    }
  };
}

function stepExecution(args: Record<string, unknown>): Record<string, unknown> {
  const code = (args.code as string) || 'var x = 5; x = x + 1; print(x)';
  const maxSteps = (args.max_steps as number) || 20;

  const tokens = tokenize(code);
  const ast = parse(tokens);
  const bytecode = compile(ast);

  const steps: { step: number; pc: number; instruction: string; stack: unknown[]; variables: Record<string, unknown> }[] = [];
  const variables: Map<string, unknown> = new Map();
  const stack: unknown[] = [];
  let pc = 0;
  let step = 0;

  while (pc < bytecode.length && step < maxSteps) {
    const instr = bytecode[pc];
    steps.push({
      step: step + 1,
      pc,
      instruction: formatInstruction(instr),
      stack: [...stack],
      variables: Object.fromEntries(variables)
    });

    // Execute instruction (simplified)
    switch (instr.opcode) {
      case 'LOAD_CONST': stack.push(instr.operand); break;
      case 'LOAD_VAR': stack.push(variables.get(instr.operand as string)); break;
      case 'STORE_VAR': variables.set(instr.operand as string, stack.pop()); break;
      case 'ADD': stack.push((stack.pop() as number) + (stack.pop() as number)); break;
      case 'PRINT': stack.pop(); break;
      case 'HALT': pc = bytecode.length; continue;
      default: break;
    }

    pc++;
    step++;
  }

  return {
    operation: 'step',
    code,
    max_steps: maxSteps,
    steps,
    final_state: {
      variables: Object.fromEntries(variables),
      stack
    }
  };
}

function evaluateExpression(args: Record<string, unknown>): Record<string, unknown> {
  const expression = (args.expression as string) || '2 + 3 * 4';

  const tokens = tokenize(expression);
  const ast = parse(tokens);
  const env: Environment = { variables: new Map(), functions: new Map() };
  const result = interpret(ast, env);

  return {
    operation: 'eval',
    expression,
    result: result.value,
    ast: simplifyAST(ast)
  };
}

function simulateREPL(args: Record<string, unknown>): Record<string, unknown> {
  const commands = [
    'var x = 10',
    'var y = 20',
    'print(x + y)',
    'function double(n) { return n * 2 }',
    'print(double(x))'
  ];

  const env: Environment = { variables: new Map(), functions: new Map() };
  const history: { input: string; output: string; result: unknown }[] = [];

  for (const cmd of commands) {
    try {
      const tokens = tokenize(cmd);
      const ast = parse(tokens);
      const result = interpret(ast, env);
      history.push({
        input: cmd,
        output: result.output.join('\n'),
        result: result.value
      });
    } catch (e) {
      history.push({
        input: cmd,
        output: `Error: ${e instanceof Error ? e.message : 'Unknown error'}`,
        result: undefined
      });
    }
  }

  return {
    operation: 'repl',
    session: history,
    final_environment: {
      variables: Object.fromEntries(env.variables),
      functions: [...env.functions.keys()]
    }
  };
}

function tokenizeCode(args: Record<string, unknown>): Record<string, unknown> {
  const code = (args.code as string) || 'var x = 10 + 20;';
  const tokens = tokenize(code);

  return {
    operation: 'tokenize',
    code,
    tokens: tokens.map(t => ({
      type: t.type,
      value: t.value,
      position: `${t.line}:${t.column}`
    })),
    statistics: {
      total_tokens: tokens.length,
      by_type: countTokenTypes(tokens)
    }
  };
}

function parseCode(args: Record<string, unknown>): Record<string, unknown> {
  const code = (args.code as string) || 'var x = 10; print(x + 5)';
  const tokens = tokenize(code);
  const ast = parse(tokens);

  return {
    operation: 'parse',
    code,
    ast: simplifyAST(ast),
    statistics: {
      total_nodes: countNodes(ast),
      depth: astDepth(ast)
    }
  };
}

function compileCode(args: Record<string, unknown>): Record<string, unknown> {
  const code = (args.code as string) || 'var x = 10; x = x + 5; print(x)';
  const tokens = tokenize(code);
  const ast = parse(tokens);
  const bytecode = compile(ast);

  return {
    operation: 'compile',
    code,
    bytecode: formatBytecode(bytecode),
    statistics: {
      instructions: bytecode.length,
      by_opcode: countOpcodes(bytecode)
    }
  };
}

function disassembleCode(args: Record<string, unknown>): Record<string, unknown> {
  const code = (args.code as string) || 'if (x > 0) { print(x) } else { print(0) }';
  const tokens = tokenize(code);
  const ast = parse(tokens);
  const bytecode = compile(ast);

  const disassembly = bytecode.map((instr, i) => {
    const operandStr = instr.operand !== undefined ? ` ${JSON.stringify(instr.operand)}` : '';
    return `${i.toString().padStart(4, '0')}: ${instr.opcode}${operandStr}`;
  });

  return {
    operation: 'disassemble',
    code,
    disassembly: disassembly.join('\n'),
    jump_targets: findJumpTargets(bytecode)
  };
}

// Helper functions
function simplifyAST(node: ASTNode): Record<string, unknown> {
  const result: Record<string, unknown> = { type: node.type };
  if (node.value !== undefined) result.value = node.value;
  if (node.name) result.name = node.name;
  if (node.operator) result.operator = node.operator;
  if (node.params) result.params = node.params;
  if (node.left) result.left = simplifyAST(node.left);
  if (node.right) result.right = simplifyAST(node.right);
  if (node.condition) result.condition = simplifyAST(node.condition);
  if (node.then) result.then = simplifyAST(node.then);
  if (node.else) result.else = simplifyAST(node.else);
  if (node.body) result.body = node.body.map(simplifyAST);
  if (node.arguments) result.arguments = node.arguments.map(simplifyAST);
  return result;
}

function countNodes(node: ASTNode): number {
  let count = 1;
  if (node.left) count += countNodes(node.left);
  if (node.right) count += countNodes(node.right);
  if (node.condition) count += countNodes(node.condition);
  if (node.then) count += countNodes(node.then);
  if (node.else) count += countNodes(node.else);
  if (node.body) count += node.body.reduce((sum, n) => sum + countNodes(n), 0);
  if (node.arguments) count += node.arguments.reduce((sum, n) => sum + countNodes(n), 0);
  return count;
}

function astDepth(node: ASTNode): number {
  let maxChild = 0;
  if (node.left) maxChild = Math.max(maxChild, astDepth(node.left));
  if (node.right) maxChild = Math.max(maxChild, astDepth(node.right));
  if (node.condition) maxChild = Math.max(maxChild, astDepth(node.condition));
  if (node.then) maxChild = Math.max(maxChild, astDepth(node.then));
  if (node.else) maxChild = Math.max(maxChild, astDepth(node.else));
  if (node.body) {
    for (const child of node.body) {
      maxChild = Math.max(maxChild, astDepth(child));
    }
  }
  return maxChild + 1;
}

function countTokenTypes(tokens: Token[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const token of tokens) {
    counts[token.type] = (counts[token.type] || 0) + 1;
  }
  return counts;
}

function countOpcodes(bytecode: Instruction[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const instr of bytecode) {
    counts[instr.opcode] = (counts[instr.opcode] || 0) + 1;
  }
  return counts;
}

function formatBytecode(bytecode: Instruction[]): string[] {
  return bytecode.map((instr, i) =>
    `${i}: ${instr.opcode}${instr.operand !== undefined ? ' ' + JSON.stringify(instr.operand) : ''}`
  );
}

function formatInstruction(instr: Instruction): string {
  return `${instr.opcode}${instr.operand !== undefined ? ' ' + JSON.stringify(instr.operand) : ''}`;
}

function findJumpTargets(bytecode: Instruction[]): number[] {
  const targets: number[] = [];
  for (const instr of bytecode) {
    if ((instr.opcode === 'JUMP' || instr.opcode === 'JUMP_IF_FALSE') && typeof instr.operand === 'number') {
      targets.push(instr.operand);
    }
  }
  return [...new Set(targets)].sort((a, b) => a - b);
}

function getExamples(): Record<string, unknown> {
  return {
    operation: 'examples',
    examples: [
      {
        name: 'Execute code',
        call: { operation: 'execute', code: 'var x = 10; print(x * 2)', mode: 'tree_walking' }
      },
      {
        name: 'Execute with bytecode',
        call: { operation: 'execute', code: 'var sum = 0; var i = 1; while (i <= 5) { sum = sum + i; i = i + 1 }; print(sum)', mode: 'bytecode', show_bytecode: true }
      },
      {
        name: 'Evaluate expression',
        call: { operation: 'eval', expression: '(10 + 5) * 2 - 3' }
      },
      {
        name: 'Tokenize code',
        call: { operation: 'tokenize', code: 'function add(a, b) { return a + b }' }
      },
      {
        name: 'Parse to AST',
        call: { operation: 'parse', code: 'if (x > 0) { print(x) }' }
      },
      {
        name: 'Step through execution',
        call: { operation: 'step', code: 'var x = 5; x = x + 1', max_steps: 10 }
      }
    ]
  };
}

function getInfo(): Record<string, unknown> {
  return {
    operation: 'info',
    tool: 'interpreter',
    description: 'Complete language interpreter with lexer, parser, and execution engine',
    capabilities: [
      'Lexical analysis (tokenization)',
      'Recursive descent parsing',
      'Abstract Syntax Tree (AST) generation',
      'Tree-walking interpretation',
      'Bytecode compilation',
      'Stack-based virtual machine',
      'Step-by-step debugging',
      'REPL simulation'
    ],
    language_features: [
      'Variables (var, let, const)',
      'Arithmetic operators (+, -, *, /, %)',
      'Comparison operators (==, !=, <, >, <=, >=)',
      'Logical operators (and, or, not)',
      'Control flow (if/else, while, for)',
      'Functions with parameters',
      'Print statements',
      'Comments (// single line)'
    ],
    execution_modes: {
      tree_walking: 'Directly interprets the AST, simpler but slower',
      bytecode: 'Compiles to bytecode then runs on VM, faster execution',
      JIT: 'Just-in-time compilation simulation'
    },
    built_in_functions: ['sqrt', 'abs', 'floor', 'ceil', 'round', 'min', 'max', 'len'],
    references: [
      'Crafting Interpreters by Robert Nystrom',
      'SICP (Structure and Interpretation of Computer Programs)',
      'Dragon Book (Compilers: Principles, Techniques, and Tools)'
    ]
  };
}

export function isinterpreterAvailable(): boolean {
  return true;
}
