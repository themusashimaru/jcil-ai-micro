/**
 * COMPILER TOOL
 * Lexer, parser, and code generator for a simple language
 * ACTUAL compiler construction!
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

type TokenType = 'NUMBER' | 'IDENT' | 'OP' | 'KEYWORD' | 'PAREN' | 'EOF';
interface Token { type: TokenType; value: string; line: number; col: number; }

function lexer(code: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0, line = 1, col = 1;
  const keywords = ['let', 'if', 'else', 'while', 'fn', 'return', 'print'];
  
  while (pos < code.length) {
    const ch = code[pos];
    if (ch === '\n') { line++; col = 1; pos++; continue; }
    if (/\s/.test(ch)) { col++; pos++; continue; }
    if (/[0-9]/.test(ch)) {
      let num = '';
      const startCol = col;
      while (pos < code.length && /[0-9.]/.test(code[pos])) { num += code[pos++]; col++; }
      tokens.push({ type: 'NUMBER', value: num, line, col: startCol });
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = '';
      const startCol = col;
      while (pos < code.length && /[a-zA-Z0-9_]/.test(code[pos])) { ident += code[pos++]; col++; }
      tokens.push({ type: keywords.includes(ident) ? 'KEYWORD' : 'IDENT', value: ident, line, col: startCol });
      continue;
    }
    if ('+-*/%=<>!&|'.includes(ch)) {
      let op = ch;
      pos++; col++;
      if (pos < code.length && '=&|'.includes(code[pos])) { op += code[pos++]; col++; }
      tokens.push({ type: 'OP', value: op, line, col: col - op.length });
      continue;
    }
    if ('(){}[];,'.includes(ch)) {
      tokens.push({ type: 'PAREN', value: ch, line, col });
      pos++; col++;
      continue;
    }
    pos++; col++;
  }
  tokens.push({ type: 'EOF', value: '', line, col });
  return tokens;
}

type ASTNode = { type: string; [key: string]: unknown };

function parser(tokens: Token[]): ASTNode {
  let pos = 0;
  const current = () => tokens[pos];
  const advance = () => tokens[pos++];
  
  function parseExpr(): ASTNode {
    let left = parseTerm();
    while (current().type === 'OP' && '+-<>==!=<=>='.includes(current().value)) {
      const op = advance().value;
      left = { type: 'BinOp', op, left, right: parseTerm() };
    }
    return left;
  }
  
  function parseTerm(): ASTNode {
    let left = parseFactor();
    while (current().type === 'OP' && '*/%'.includes(current().value)) {
      const op = advance().value;
      left = { type: 'BinOp', op, left, right: parseFactor() };
    }
    return left;
  }
  
  function parseFactor(): ASTNode {
    const tok = current();
    if (tok.type === 'NUMBER') { advance(); return { type: 'Number', value: parseFloat(tok.value) }; }
    if (tok.type === 'IDENT') { advance(); return { type: 'Ident', name: tok.value }; }
    if (tok.value === '(') { advance(); const expr = parseExpr(); advance(); return expr; }
    if (tok.type === 'OP' && tok.value === '-') { advance(); return { type: 'Unary', op: '-', arg: parseFactor() }; }
    return { type: 'Error', message: 'Unexpected: ' + tok.value };
  }
  
  function parseStmt(): ASTNode {
    const tok = current();
    if (tok.value === 'let') {
      advance();
      const name = advance().value;
      advance(); // =
      const value = parseExpr();
      if (current().value === ';') advance();
      return { type: 'Let', name, value };
    }
    if (tok.value === 'if') {
      advance();
      advance(); // (
      const cond = parseExpr();
      advance(); // )
      const then = parseBlock();
      let elseBlock = null;
      if (current().value === 'else') { advance(); elseBlock = parseBlock(); }
      return { type: 'If', cond, then, else: elseBlock };
    }
    if (tok.value === 'while') {
      advance();
      advance(); // (
      const cond = parseExpr();
      advance(); // )
      const body = parseBlock();
      return { type: 'While', cond, body };
    }
    if (tok.value === 'print') {
      advance();
      advance(); // (
      const arg = parseExpr();
      advance(); // )
      if (current().value === ';') advance();
      return { type: 'Print', arg };
    }
    const expr = parseExpr();
    if (current().value === ';') advance();
    return { type: 'ExprStmt', expr };
  }
  
  function parseBlock(): ASTNode {
    if (current().value === '{') {
      advance();
      const stmts: ASTNode[] = [];
      while (current().value !== '}' && current().type !== 'EOF') stmts.push(parseStmt());
      advance();
      return { type: 'Block', stmts };
    }
    return parseStmt();
  }
  
  const stmts: ASTNode[] = [];
  while (current().type !== 'EOF') stmts.push(parseStmt());
  return { type: 'Program', stmts };
}

function codegen(ast: ASTNode): string {
  const lines: string[] = [];
  let tempCount = 0;
  
  function gen(node: ASTNode): string {
    switch (node.type) {
      case 'Number': return String(node.value);
      case 'Ident': return String(node.name);
      case 'BinOp': {
        const l = gen(node.left as ASTNode);
        const r = gen(node.right as ASTNode);
        const t = 't' + (tempCount++);
        lines.push(t + ' = ' + l + ' ' + node.op + ' ' + r);
        return t;
      }
      case 'Unary': return '-' + gen(node.arg as ASTNode);
      case 'Let': {
        const v = gen(node.value as ASTNode);
        lines.push(node.name + ' = ' + v);
        return '';
      }
      case 'Print': {
        const v = gen(node.arg as ASTNode);
        lines.push('PRINT ' + v);
        return '';
      }
      case 'If': {
        const c = gen(node.cond as ASTNode);
        const lElse = 'L' + (tempCount++);
        const lEnd = 'L' + (tempCount++);
        lines.push('IF_FALSE ' + c + ' GOTO ' + lElse);
        gen(node.then as ASTNode);
        lines.push('GOTO ' + lEnd);
        lines.push(lElse + ':');
        if (node.else) gen(node.else as ASTNode);
        lines.push(lEnd + ':');
        return '';
      }
      case 'While': {
        const lStart = 'L' + (tempCount++);
        const lEnd = 'L' + (tempCount++);
        lines.push(lStart + ':');
        const c = gen(node.cond as ASTNode);
        lines.push('IF_FALSE ' + c + ' GOTO ' + lEnd);
        gen(node.body as ASTNode);
        lines.push('GOTO ' + lStart);
        lines.push(lEnd + ':');
        return '';
      }
      case 'Block': (node.stmts as ASTNode[]).forEach(s => gen(s)); return '';
      case 'ExprStmt': gen(node.expr as ASTNode); return '';
      case 'Program': (node.stmts as ASTNode[]).forEach(s => gen(s)); return '';
      default: return '';
    }
  }
  
  gen(ast);
  return lines.join('\n');
}

export const compilerTool: UnifiedTool = {
  name: 'compiler',
  description: 'Compiler with lexer, parser, and code generator for a simple language',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['lex', 'parse', 'compile', 'run', 'info'], description: 'Operation' },
      code: { type: 'string', description: 'Source code to compile' }
    },
    required: ['operation']
  }
};

export async function executeCompiler(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const code = args.code || 'let x = 5;\nlet y = x * 2 + 3;\nprint(y);';
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'lex': result = { tokens: lexer(code) }; break;
      case 'parse': result = { ast: parser(lexer(code)) }; break;
      case 'compile': result = { ir: codegen(parser(lexer(code))) }; break;
      case 'run': {
        const ir = codegen(parser(lexer(code)));
        const env: Record<string, number> = {};
        const output: string[] = [];
        for (const line of ir.split('\n')) {
          if (line.includes(' = ')) {
            const [name, expr] = line.split(' = ');
            const parts = expr.split(' ');
            if (parts.length === 1) env[name] = Number(env[parts[0]] ?? parts[0]);
            else env[name] = eval((env[parts[0]] ?? parts[0]) + parts[1] + (env[parts[2]] ?? parts[2]));
          }
          if (line.startsWith('PRINT ')) output.push(String(env[line.slice(6)] ?? line.slice(6)));
        }
        result = { output, env };
        break;
      }
      case 'info':
      default:
        result = { description: 'Mini compiler', features: ['Lexer', 'Recursive descent parser', 'IR codegen'], grammar: 'let, if, while, print, arithmetic' };
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isCompilerAvailable(): boolean { return true; }
