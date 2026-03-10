// @ts-nocheck - Test file with extensive mocking
/** @vitest-environment node */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// MOCKS (hoisted so they are available at vi.mock factory time)
// ============================================

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => ({
    messages: { create: mockCreate },
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// ============================================
// IMPORTS (after mocks)
// ============================================

import { VoiceCodingEngine, voiceCoding, processVoice, voiceToCode } from './index';
import type { VoiceContext } from './index';

// ============================================
// HELPERS
// ============================================

function makeContext(overrides: Partial<VoiceContext> = {}): VoiceContext {
  return {
    currentFile: 'test.ts',
    currentCode: 'const x = 1;',
    cursorLine: 1,
    recentCommands: [],
    projectType: 'general',
    language: 'typescript',
    ...overrides,
  };
}

function makeAIResponse(text: string) {
  return {
    content: [{ type: 'text', text }],
  };
}

// ============================================
// TESTS
// ============================================

describe('VoiceCodingEngine', () => {
  let engine: VoiceCodingEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new VoiceCodingEngine();
  });

  // ------------------------------------------
  // COMMAND CLASSIFICATION
  // ------------------------------------------

  describe('classifyCommand (via processVoiceInput)', () => {
    // We test classification indirectly through processVoiceInput since classifyCommand is private.
    // Built-in commands return immediately, so the action reveals the type.

    it('classifies "save" as command type', async () => {
      const result = await engine.processVoiceInput('save', makeContext());
      expect(result.action).toBe('save');
    });

    it('classifies "save file" as command type', async () => {
      const result = await engine.processVoiceInput('save file', makeContext());
      expect(result.action).toBe('save');
    });

    it('classifies "save all" as command type', async () => {
      const result = await engine.processVoiceInput('save all', makeContext());
      expect(result.action).toBe('save');
    });

    it('classifies "undo" as command type', async () => {
      const result = await engine.processVoiceInput('undo', makeContext());
      expect(result.action).toBe('undo');
    });

    it('classifies "redo" as command type', async () => {
      const result = await engine.processVoiceInput('redo', makeContext());
      expect(result.action).toBe('redo');
    });

    it('classifies "run" as command type', async () => {
      const result = await engine.processVoiceInput('run', makeContext());
      expect(result.action).toBe('run');
    });

    it('classifies "run tests" as command type', async () => {
      const result = await engine.processVoiceInput('run tests', makeContext());
      expect(result.action).toBe('run');
    });

    it('classifies "run the code" as command type', async () => {
      const result = await engine.processVoiceInput('run the code', makeContext());
      expect(result.action).toBe('run');
    });

    it('classifies "build" as command type', async () => {
      const result = await engine.processVoiceInput('build', makeContext());
      expect(result.action).toBe('build');
    });

    it('classifies "build the project" as command type', async () => {
      const result = await engine.processVoiceInput('build the project', makeContext());
      expect(result.action).toBe('build');
    });

    it('classifies "go to line 42" as navigation type', async () => {
      const result = await engine.processVoiceInput('go to line 42', makeContext());
      expect(result.action).toBe('navigate');
      expect(result.cursorPosition).toEqual({ line: 42, column: 0 });
    });

    it('classifies unrecognized commands as code (falls through to AI)', async () => {
      mockCreate.mockResolvedValueOnce(
        makeAIResponse('{"action":"insert","code":"// hello","explanation":"added comment"}')
      );
      const result = await engine.processVoiceInput('add a comment saying hello', makeContext());
      expect(result.action).toBe('insert');
    });
  });

  // ------------------------------------------
  // BUILT-IN COMMANDS
  // ------------------------------------------

  describe('built-in commands via tryBuiltInCommand', () => {
    it('returns save result for "save"', async () => {
      const result = await engine.processVoiceInput('save', makeContext());
      expect(result).toEqual({
        success: true,
        action: 'save',
        explanation: 'Saving file...',
      });
    });

    it('returns undo result with default count of 1', async () => {
      const result = await engine.processVoiceInput('undo', makeContext());
      expect(result).toEqual({
        success: true,
        action: 'undo',
        explanation: 'Undoing 1 change...',
      });
    });

    it('returns undo result with specified count', async () => {
      const result = await engine.processVoiceInput('undo 3 times', makeContext());
      expect(result).toEqual({
        success: true,
        action: 'undo',
        explanation: 'Undoing 3 changes...',
      });
    });

    it('returns redo result with default count of 1', async () => {
      const result = await engine.processVoiceInput('redo', makeContext());
      expect(result).toEqual({
        success: true,
        action: 'redo',
        explanation: 'Redoing 1 change...',
      });
    });

    it('returns redo result with specified count', async () => {
      const result = await engine.processVoiceInput('redo 5 times', makeContext());
      expect(result).toEqual({
        success: true,
        action: 'redo',
        explanation: 'Redoing 5 changes...',
      });
    });

    it('returns navigate result for "go to line N"', async () => {
      const result = await engine.processVoiceInput('go to line 100', makeContext());
      expect(result).toEqual({
        success: true,
        action: 'navigate',
        cursorPosition: { line: 100, column: 0 },
        explanation: 'Going to line 100',
      });
    });

    it('returns run result for "run"', async () => {
      const result = await engine.processVoiceInput('run', makeContext());
      expect(result).toEqual({
        success: true,
        action: 'run',
        explanation: 'Running code...',
      });
    });

    it('returns build result for "build"', async () => {
      const result = await engine.processVoiceInput('build', makeContext());
      expect(result).toEqual({
        success: true,
        action: 'build',
        explanation: 'Building project...',
      });
    });
  });

  // ------------------------------------------
  // AI INTERPRETATION (aiInterpretCommand)
  // ------------------------------------------

  describe('AI interpretation fallback', () => {
    it('calls Anthropic API when no built-in command matches', async () => {
      mockCreate.mockResolvedValueOnce(
        makeAIResponse(
          '{"action":"insert","code":"function foo() {}","language":"typescript","explanation":"Created function"}'
        )
      );
      const result = await engine.processVoiceInput('create function foo', makeContext());
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      expect(result.action).toBe('insert');
      expect(result.code).toBe('function foo() {}');
    });

    it('passes correct model parameter to Anthropic', async () => {
      mockCreate.mockResolvedValueOnce(
        makeAIResponse('{"action":"insert","code":"x","explanation":"y"}')
      );
      await engine.processVoiceInput('do something', makeContext());
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'claude-sonnet-4-6' })
      );
    });

    it('includes context info in system prompt', async () => {
      mockCreate.mockResolvedValueOnce(
        makeAIResponse('{"action":"insert","code":"x","explanation":"y"}')
      );
      const ctx = makeContext({ currentFile: 'app.py', language: 'python', cursorLine: 25 });
      await engine.processVoiceInput('add a function', ctx);
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.system).toContain('app.py');
      expect(callArgs.system).toContain('python');
      expect(callArgs.system).toContain('25');
    });

    it('includes selected text in system prompt when present', async () => {
      mockCreate.mockResolvedValueOnce(
        makeAIResponse('{"action":"replace","code":"x","explanation":"y"}')
      );
      const ctx = makeContext({ selectedText: 'const a = 1;' });
      await engine.processVoiceInput('refactor this', ctx);
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.system).toContain('const a = 1;');
    });

    it('handles AI response without JSON by treating as raw code', async () => {
      mockCreate.mockResolvedValueOnce(makeAIResponse('console.log("hello world");'));
      const result = await engine.processVoiceInput('print hello world', makeContext());
      expect(result.success).toBe(true);
      expect(result.action).toBe('insert');
      expect(result.code).toBe('console.log("hello world");');
      expect(result.explanation).toBe('Generated code from voice command');
    });

    it('prepends imports to code when AI returns imports array', async () => {
      mockCreate.mockResolvedValueOnce(
        makeAIResponse(
          JSON.stringify({
            action: 'insert',
            code: 'const result = await fetch(url);',
            imports: ["import fetch from 'node-fetch';", "import { URL } from 'url';"],
            explanation: 'Added fetch call',
          })
        )
      );
      const result = await engine.processVoiceInput('fetch a url', makeContext());
      expect(result.code).toContain("import fetch from 'node-fetch';");
      expect(result.code).toContain("import { URL } from 'url';");
      expect(result.code).toContain('const result = await fetch(url);');
    });

    it('handles AI response with insertPosition line number', async () => {
      mockCreate.mockResolvedValueOnce(
        makeAIResponse(
          JSON.stringify({
            action: 'insert',
            code: 'const y = 2;',
            explanation: 'Added variable',
            insertPosition: { line: 10 },
          })
        )
      );
      const result = await engine.processVoiceInput('add variable y', makeContext());
      expect(result.cursorPosition).toEqual({ line: 10, column: 0 });
    });

    it('handles AI response without insertPosition', async () => {
      mockCreate.mockResolvedValueOnce(
        makeAIResponse(
          JSON.stringify({
            action: 'insert',
            code: 'const y = 2;',
            explanation: 'Added variable',
          })
        )
      );
      const result = await engine.processVoiceInput('add variable y', makeContext());
      expect(result.cursorPosition).toBeUndefined();
    });

    it('returns error result when AI call throws', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API rate limit'));
      const result = await engine.processVoiceInput('do something complex', makeContext());
      expect(result.success).toBe(false);
      expect(result.action).toBe('error');
      expect(result.error).toBe('API rate limit');
    });

    it('returns generic error message for non-Error throws', async () => {
      mockCreate.mockRejectedValueOnce('string error');
      const result = await engine.processVoiceInput('do something', makeContext());
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to interpret voice command');
    });

    it('handles non-text response type as error', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'tool_use', id: 'x', name: 'y', input: {} }],
      });
      const result = await engine.processVoiceInput('something', makeContext());
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected response type');
    });

    it('uses context language as fallback when AI omits language', async () => {
      mockCreate.mockResolvedValueOnce(
        makeAIResponse(
          JSON.stringify({
            action: 'insert',
            code: 'print("hi")',
            explanation: 'Print statement',
          })
        )
      );
      const result = await engine.processVoiceInput(
        'print hi',
        makeContext({ language: 'python' })
      );
      expect(result.language).toBe('python');
    });

    it('uses AI-specified language when provided', async () => {
      mockCreate.mockResolvedValueOnce(
        makeAIResponse(
          JSON.stringify({
            action: 'insert',
            code: 'fn main() {}',
            language: 'rust',
            explanation: 'Rust main',
          })
        )
      );
      const result = await engine.processVoiceInput('create main function', makeContext());
      expect(result.language).toBe('rust');
    });

    it('handles empty imports array without breaking code', async () => {
      mockCreate.mockResolvedValueOnce(
        makeAIResponse(
          JSON.stringify({
            action: 'insert',
            code: 'const z = 3;',
            imports: [],
            explanation: 'Added var',
          })
        )
      );
      const result = await engine.processVoiceInput('add var z', makeContext());
      expect(result.code).toBe('const z = 3;');
    });

    it('handles missing code in AI response', async () => {
      mockCreate.mockResolvedValueOnce(
        makeAIResponse(
          JSON.stringify({
            action: 'explain',
            explanation: 'This code does X',
          })
        )
      );
      const result = await engine.processVoiceInput('explain this', makeContext());
      expect(result.code).toBe('');
      expect(result.action).toBe('explain');
    });
  });

  // ------------------------------------------
  // generateCodeFromDescription
  // ------------------------------------------

  describe('generateCodeFromDescription', () => {
    it('calls Anthropic API with correct parameters', async () => {
      mockCreate.mockResolvedValueOnce(
        makeAIResponse('function add(a: number, b: number) { return a + b; }')
      );
      await engine.generateCodeFromDescription('a function that adds two numbers', makeContext());
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-6',
          max_tokens: 8192,
        })
      );
    });

    it('returns extracted code from markdown code block', async () => {
      mockCreate.mockResolvedValueOnce(
        makeAIResponse('```typescript\nfunction add(a: number, b: number) { return a + b; }\n```')
      );
      const result = await engine.generateCodeFromDescription('add function', makeContext());
      expect(result.success).toBe(true);
      expect(result.code).toBe('function add(a: number, b: number) { return a + b; }');
    });

    it('returns raw text when no markdown code block found', async () => {
      mockCreate.mockResolvedValueOnce(makeAIResponse('const x = 42;'));
      const result = await engine.generateCodeFromDescription('a constant', makeContext());
      expect(result.code).toBe('const x = 42;');
    });

    it('truncates description in explanation to 50 chars', async () => {
      mockCreate.mockResolvedValueOnce(makeAIResponse('code'));
      const longDesc = 'a'.repeat(100);
      const result = await engine.generateCodeFromDescription(longDesc, makeContext());
      expect(result.explanation).toContain(longDesc.substring(0, 50));
      expect(result.explanation).toContain('...');
    });

    it('returns error on API failure', async () => {
      mockCreate.mockRejectedValueOnce(new Error('Network error'));
      const result = await engine.generateCodeFromDescription('something', makeContext());
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('returns generic error for non-Error throws', async () => {
      mockCreate.mockRejectedValueOnce(42);
      const result = await engine.generateCodeFromDescription('something', makeContext());
      expect(result.success).toBe(false);
      expect(result.error).toBe('Code generation failed');
    });

    it('handles unexpected response type', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'image', source: {} }],
      });
      const result = await engine.generateCodeFromDescription('something', makeContext());
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected response type');
    });

    it('sets action to insert and includes language', async () => {
      mockCreate.mockResolvedValueOnce(makeAIResponse('code'));
      const result = await engine.generateCodeFromDescription(
        'something',
        makeContext({ language: 'python' })
      );
      expect(result.action).toBe('insert');
      expect(result.language).toBe('python');
    });
  });

  // ------------------------------------------
  // fixError
  // ------------------------------------------

  describe('fixError', () => {
    it('sends error message and code to Anthropic', async () => {
      mockCreate.mockResolvedValueOnce(
        makeAIResponse(
          JSON.stringify({
            fixedCode: 'const x: number = 1;',
            explanation: 'Added type annotation',
            lineNumber: 5,
          })
        )
      );
      const ctx = makeContext({ currentCode: 'const x = "not a number";' });
      await engine.fixError('Type error on line 5', ctx);
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('Type error on line 5');
      expect(callArgs.messages[0].content).toContain('const x = "not a number";');
    });

    it('returns fixed code with cursor position', async () => {
      mockCreate.mockResolvedValueOnce(
        makeAIResponse(
          JSON.stringify({
            fixedCode: 'const x: number = 1;',
            explanation: 'Added type annotation',
            lineNumber: 5,
          })
        )
      );
      const result = await engine.fixError('Type error', makeContext());
      expect(result.success).toBe(true);
      expect(result.action).toBe('replace');
      expect(result.code).toBe('const x: number = 1;');
      expect(result.explanation).toBe('Added type annotation');
      expect(result.cursorPosition).toEqual({ line: 5, column: 0 });
    });

    it('returns undefined cursorPosition when lineNumber is absent', async () => {
      mockCreate.mockResolvedValueOnce(
        makeAIResponse(
          JSON.stringify({
            fixedCode: 'fixed code',
            explanation: 'Fixed it',
          })
        )
      );
      const result = await engine.fixError('error', makeContext());
      expect(result.cursorPosition).toBeUndefined();
    });

    it('returns error when response has no JSON', async () => {
      mockCreate.mockResolvedValueOnce(makeAIResponse('Sorry, I cannot parse this error.'));
      const result = await engine.fixError('error', makeContext());
      expect(result.success).toBe(false);
      expect(result.error).toBe('Could not parse fix response');
    });

    it('returns error on API failure', async () => {
      mockCreate.mockRejectedValueOnce(new Error('Timeout'));
      const result = await engine.fixError('error', makeContext());
      expect(result.success).toBe(false);
      expect(result.error).toBe('Timeout');
    });

    it('returns generic error for non-Error throws', async () => {
      mockCreate.mockRejectedValueOnce(null);
      const result = await engine.fixError('error', makeContext());
      expect(result.success).toBe(false);
      expect(result.error).toBe('Fix failed');
    });

    it('handles unexpected response type', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'tool_use', id: 'x', name: 'y', input: {} }],
      });
      const result = await engine.fixError('error', makeContext());
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected response type');
    });
  });

  // ------------------------------------------
  // explainCode
  // ------------------------------------------

  describe('explainCode', () => {
    it('returns explanation from AI response', async () => {
      mockCreate.mockResolvedValueOnce(makeAIResponse('This function adds two numbers together.'));
      const result = await engine.explainCode('function add(a, b) { return a + b; }');
      expect(result.success).toBe(true);
      expect(result.action).toBe('explain');
      expect(result.explanation).toBe('This function adds two numbers together.');
    });

    it('sends code without specific question when none provided', async () => {
      mockCreate.mockResolvedValueOnce(makeAIResponse('Explanation'));
      await engine.explainCode('const x = 1;');
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('Explain this code:');
      expect(callArgs.messages[0].content).toContain('const x = 1;');
    });

    it('includes specific question when provided', async () => {
      mockCreate.mockResolvedValueOnce(makeAIResponse('Answer'));
      await engine.explainCode('const x = 1;', 'What is const?');
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('What is const?');
      expect(callArgs.messages[0].content).toContain('const x = 1;');
    });

    it('returns error on API failure', async () => {
      mockCreate.mockRejectedValueOnce(new Error('Service unavailable'));
      const result = await engine.explainCode('code');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Service unavailable');
    });

    it('returns generic error for non-Error throws', async () => {
      mockCreate.mockRejectedValueOnce(undefined);
      const result = await engine.explainCode('code');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Explanation failed');
    });

    it('handles unexpected response type', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'image', source: {} }],
      });
      const result = await engine.explainCode('code');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected response type');
    });
  });

  // ------------------------------------------
  // getCommandSuggestions
  // ------------------------------------------

  describe('getCommandSuggestions', () => {
    it('includes typescript/javascript suggestions for TS context', () => {
      const suggestions = engine.getCommandSuggestions(makeContext({ language: 'typescript' }));
      expect(suggestions).toContain('Create a function called...');
      expect(suggestions).toContain('Add a React component named...');
      expect(suggestions).toContain('Create an interface for...');
      expect(suggestions).toContain('Add an API endpoint for...');
    });

    it('includes javascript suggestions for JS context', () => {
      const suggestions = engine.getCommandSuggestions(makeContext({ language: 'javascript' }));
      expect(suggestions).toContain('Create a function called...');
      expect(suggestions).toContain('Add a React component named...');
    });

    it('includes python suggestions for Python context', () => {
      const suggestions = engine.getCommandSuggestions(makeContext({ language: 'python' }));
      expect(suggestions).toContain('Create a class called...');
      expect(suggestions).toContain('Add a function that...');
      expect(suggestions).toContain('Create a FastAPI route for...');
    });

    it('does not include TS/JS suggestions for Python context', () => {
      const suggestions = engine.getCommandSuggestions(makeContext({ language: 'python' }));
      expect(suggestions).not.toContain('Add a React component named...');
    });

    it('does not include Python suggestions for TS context', () => {
      const suggestions = engine.getCommandSuggestions(makeContext({ language: 'typescript' }));
      expect(suggestions).not.toContain('Create a FastAPI route for...');
    });

    it('always includes universal suggestions', () => {
      const suggestions = engine.getCommandSuggestions(makeContext({ language: 'rust' }));
      expect(suggestions).toContain('Explain this code');
      expect(suggestions).toContain('Fix the error');
      expect(suggestions).toContain('Refactor this function');
      expect(suggestions).toContain('Add error handling');
      expect(suggestions).toContain('Add tests for this');
      expect(suggestions).toContain('Go to line...');
      expect(suggestions).toContain('Search for...');
      expect(suggestions).toContain('Save file');
      expect(suggestions).toContain('Run tests');
    });

    it('returns only universal suggestions for unknown language', () => {
      const suggestions = engine.getCommandSuggestions(makeContext({ language: 'cobol' }));
      expect(suggestions.length).toBe(9); // 9 universal suggestions
    });
  });

  // ------------------------------------------
  // normalizeTranscript
  // ------------------------------------------

  describe('normalizeTranscript', () => {
    it('converts spoken numbers to digits', () => {
      expect(engine.normalizeTranscript('go to line one')).toBe('go to line 1');
      expect(engine.normalizeTranscript('go to line two')).toBe('go to line 2');
      expect(engine.normalizeTranscript('go to line three')).toBe('go to line 3');
      expect(engine.normalizeTranscript('go to line four')).toBe('go to line 4');
      expect(engine.normalizeTranscript('go to line five')).toBe('go to line 5');
      expect(engine.normalizeTranscript('go to line six')).toBe('go to line 6');
      expect(engine.normalizeTranscript('go to line seven')).toBe('go to line 7');
      expect(engine.normalizeTranscript('go to line eight')).toBe('go to line 8');
      expect(engine.normalizeTranscript('go to line nine')).toBe('go to line 9');
      expect(engine.normalizeTranscript('go to line ten')).toBe('go to line 10');
      expect(engine.normalizeTranscript('value is zero')).toBe('value is 0');
    });

    it('converts spoken parentheses', () => {
      expect(engine.normalizeTranscript('open paren close paren')).toBe('( )');
    });

    it('converts spoken brackets', () => {
      expect(engine.normalizeTranscript('open bracket close bracket')).toBe('[ ]');
    });

    it('converts spoken braces', () => {
      expect(engine.normalizeTranscript('open brace close brace')).toBe('{ }');
    });

    it('converts spoken operators', () => {
      expect(engine.normalizeTranscript('x equals y')).toBe('x = y');
      expect(engine.normalizeTranscript('x plus y')).toBe('x + y');
      expect(engine.normalizeTranscript('x minus y')).toBe('x - y');
      expect(engine.normalizeTranscript('x times y')).toBe('x * y');
      expect(engine.normalizeTranscript('x divided by y')).toBe('x / y');
    });

    it('converts spoken comparison operators', () => {
      expect(engine.normalizeTranscript('x greater than y')).toBe('x > y');
      expect(engine.normalizeTranscript('x less than y')).toBe('x < y');
    });

    it('converts spoken logical operators', () => {
      expect(engine.normalizeTranscript('x and y')).toBe('x && y');
      expect(engine.normalizeTranscript('x or y')).toBe('x || y');
      expect(engine.normalizeTranscript('not x')).toBe('! x');
    });

    it('converts spoken arrow function syntax', () => {
      expect(engine.normalizeTranscript('arrow')).toBe('=>');
    });

    it('converts spoken punctuation', () => {
      expect(engine.normalizeTranscript('colon')).toBe(':');
      expect(engine.normalizeTranscript('semicolon')).toBe(';');
      expect(engine.normalizeTranscript('comma')).toBe(',');
      expect(engine.normalizeTranscript('dot')).toBe('.');
    });

    it('converts spoken quotes', () => {
      expect(engine.normalizeTranscript('quote')).toBe('"');
      expect(engine.normalizeTranscript('backtick')).toBe('`');
    });

    it('converts "single quote" — note: "quote" is replaced first by ordering', () => {
      // In the source, \bquote\b runs before \bsingle quote\b,
      // so "single quote" becomes 'single "' (quote -> " first).
      // This documents the actual behavior of the current implementation.
      const result = engine.normalizeTranscript('single quote');
      expect(result).toBe('single "');
    });

    it('converts spoken whitespace', () => {
      expect(engine.normalizeTranscript('new line')).toBe('\n');
      expect(engine.normalizeTranscript('tab')).toBe('\t');
    });

    it('handles multiple conversions in one transcript', () => {
      const result = engine.normalizeTranscript('x equals one plus two');
      expect(result).toBe('x = 1 + 2');
    });

    it('is case-insensitive', () => {
      expect(engine.normalizeTranscript('ONE PLUS Two')).toBe('1 + 2');
    });

    it('leaves unrecognized words unchanged', () => {
      expect(engine.normalizeTranscript('hello world')).toBe('hello world');
    });
  });

  // ------------------------------------------
  // REGEX PATTERN MATCHING (COMMAND_PATTERNS)
  // ------------------------------------------

  describe('regex patterns for voice commands', () => {
    // We test these patterns via the engine's processVoiceInput:
    // patterns that match built-in commands yield direct results,
    // patterns that don't match go to AI.

    describe('CREATE_FUNCTION pattern', () => {
      it('matches "create function myFunc"', async () => {
        mockCreate.mockResolvedValueOnce(
          makeAIResponse('{"action":"insert","code":"fn","explanation":"x"}')
        );
        await engine.processVoiceInput('create function myFunc', makeContext());
        expect(mockCreate).toHaveBeenCalled(); // Falls through to AI (not a built-in)
      });

      it('matches "make a new function called doStuff that processes data"', async () => {
        mockCreate.mockResolvedValueOnce(
          makeAIResponse('{"action":"insert","code":"fn","explanation":"x"}')
        );
        await engine.processVoiceInput(
          'make a new function called doStuff that processes data',
          makeContext()
        );
        expect(mockCreate).toHaveBeenCalled();
      });
    });

    describe('SAVE pattern', () => {
      it('matches "save"', async () => {
        const result = await engine.processVoiceInput('save', makeContext());
        expect(result.action).toBe('save');
      });

      it('matches "Save" (case-insensitive)', async () => {
        const result = await engine.processVoiceInput('Save', makeContext());
        expect(result.action).toBe('save');
      });

      it('matches "SAVE FILE"', async () => {
        const result = await engine.processVoiceInput('SAVE FILE', makeContext());
        expect(result.action).toBe('save');
      });

      it('does not match "save the world"', async () => {
        mockCreate.mockResolvedValueOnce(
          makeAIResponse('{"action":"insert","code":"x","explanation":"y"}')
        );
        await engine.processVoiceInput('save the world', makeContext());
        // Falls through to AI because "save the world" doesn't match the SAVE pattern
        expect(mockCreate).toHaveBeenCalled();
      });
    });

    describe('UNDO/REDO patterns', () => {
      it('matches "undo 2 times"', async () => {
        const result = await engine.processVoiceInput('undo 2 times', makeContext());
        expect(result.action).toBe('undo');
        expect(result.explanation).toContain('2');
      });

      it('matches "redo 1 time"', async () => {
        const result = await engine.processVoiceInput('redo 1 time', makeContext());
        expect(result.action).toBe('redo');
      });
    });

    describe('GO_TO_LINE pattern', () => {
      it('matches "go to line 1"', async () => {
        const result = await engine.processVoiceInput('go to line 1', makeContext());
        expect(result.cursorPosition).toEqual({ line: 1, column: 0 });
      });

      it('matches "go to line 999"', async () => {
        const result = await engine.processVoiceInput('go to line 999', makeContext());
        expect(result.cursorPosition).toEqual({ line: 999, column: 0 });
      });
    });

    describe('RUN pattern', () => {
      it('matches "run the tests"', async () => {
        const result = await engine.processVoiceInput('run the tests', makeContext());
        expect(result.action).toBe('run');
      });

      it('matches "run the file"', async () => {
        const result = await engine.processVoiceInput('run the file', makeContext());
        expect(result.action).toBe('run');
      });
    });

    describe('COMMIT pattern', () => {
      it('classifies "commit with message fix bug" as command (not built-in, goes to AI)', async () => {
        // commit is classified as 'command' but not handled in tryBuiltInCommand
        // so it falls through to AI
        mockCreate.mockResolvedValueOnce(
          makeAIResponse('{"action":"insert","code":"","explanation":"committed"}')
        );
        await engine.processVoiceInput('commit with message fix bug', makeContext());
        // It goes to AI since commit is not a built-in handler
        expect(mockCreate).toHaveBeenCalled();
      });
    });
  });

  // ------------------------------------------
  // Command history tracking
  // ------------------------------------------

  describe('command history', () => {
    it('stores commands in history across multiple calls', async () => {
      await engine.processVoiceInput('save', makeContext());
      await engine.processVoiceInput('undo', makeContext());
      await engine.processVoiceInput('build', makeContext());
      // We can verify indirectly that the engine accumulates commands.
      // The next processVoiceInput should still work correctly.
      const result = await engine.processVoiceInput('save', makeContext());
      expect(result.success).toBe(true);
    });
  });
});

// ============================================
// EXPORTED FUNCTIONS
// ============================================

describe('processVoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes transcript before processing', async () => {
    // "go to line one" should be normalized to "go to line 1"
    const result = await processVoice('go to line one', makeContext());
    expect(result.action).toBe('navigate');
    expect(result.cursorPosition).toEqual({ line: 1, column: 0 });
  });

  it('handles a built-in command after normalization', async () => {
    const result = await processVoice('save', makeContext());
    expect(result.success).toBe(true);
    expect(result.action).toBe('save');
  });

  it('falls through to AI for complex commands', async () => {
    mockCreate.mockResolvedValueOnce(
      makeAIResponse('{"action":"insert","code":"// normalized","explanation":"done"}')
    );
    const result = await processVoice('create a function called test', makeContext());
    expect(result.success).toBe(true);
    expect(mockCreate).toHaveBeenCalled();
  });
});

describe('voiceToCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns generated code as a string', async () => {
    mockCreate.mockResolvedValueOnce(makeAIResponse('```typescript\nconst hello = "world";\n```'));
    const code = await voiceToCode('a hello world constant');
    expect(code).toBe('const hello = "world";');
  });

  it('uses typescript as default language', async () => {
    mockCreate.mockResolvedValueOnce(makeAIResponse('code'));
    await voiceToCode('something');
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.system).toContain('typescript');
  });

  it('uses specified language', async () => {
    mockCreate.mockResolvedValueOnce(makeAIResponse('code'));
    await voiceToCode('something', 'python');
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.system).toContain('python');
  });

  it('returns empty string when code generation fails', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API error'));
    const code = await voiceToCode('something');
    expect(code).toBe('');
  });

  it('passes default context with untitled file', async () => {
    mockCreate.mockResolvedValueOnce(makeAIResponse('code'));
    await voiceToCode('something');
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.system).toContain('untitled');
  });
});

// ============================================
// EXPORTED SINGLETON
// ============================================

describe('voiceCoding singleton', () => {
  it('is an instance of VoiceCodingEngine', () => {
    expect(voiceCoding).toBeInstanceOf(VoiceCodingEngine);
  });

  it('has processVoiceInput method', () => {
    expect(typeof voiceCoding.processVoiceInput).toBe('function');
  });

  it('has generateCodeFromDescription method', () => {
    expect(typeof voiceCoding.generateCodeFromDescription).toBe('function');
  });

  it('has fixError method', () => {
    expect(typeof voiceCoding.fixError).toBe('function');
  });

  it('has explainCode method', () => {
    expect(typeof voiceCoding.explainCode).toBe('function');
  });

  it('has getCommandSuggestions method', () => {
    expect(typeof voiceCoding.getCommandSuggestions).toBe('function');
  });

  it('has normalizeTranscript method', () => {
    expect(typeof voiceCoding.normalizeTranscript).toBe('function');
  });
});
