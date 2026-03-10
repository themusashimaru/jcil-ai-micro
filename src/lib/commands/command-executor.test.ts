import { describe, it, expect, vi } from 'vitest';

// Mock modules that command-executor imports
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => ''),
    readdirSync: vi.fn(() => []),
  };
});

vi.mock('minimatch', () => ({
  minimatch: vi.fn(() => false),
}));

import { parseArguments, expandVariables, generateHelpText } from './command-executor';
import type { CommandExecutionInput, CommandDefinition } from './types';

// -------------------------------------------------------------------
// parseArguments
// -------------------------------------------------------------------
describe('parseArguments', () => {
  it('should return empty arrays for empty input', () => {
    const result = parseArguments('');
    expect(result.positional).toEqual([]);
    expect(result.named).toEqual({});
  });

  it('should return empty arrays for whitespace input', () => {
    const result = parseArguments('   ');
    expect(result.positional).toEqual([]);
    expect(result.named).toEqual({});
  });

  it('should parse positional arguments', () => {
    const result = parseArguments('hello world');
    expect(result.positional).toEqual(['hello', 'world']);
    expect(result.named).toEqual({});
  });

  it('should parse named arguments with = syntax', () => {
    const result = parseArguments('--name=John --age=30');
    expect(result.named).toEqual({ name: 'John', age: '30' });
    expect(result.positional).toEqual([]);
  });

  it('should parse named flag arguments (no value)', () => {
    const result = parseArguments('--verbose --debug');
    expect(result.named).toEqual({ verbose: 'true', debug: 'true' });
  });

  it('should parse mixed positional and named arguments', () => {
    const result = parseArguments('file.ts --output=build --verbose');
    expect(result.positional).toEqual(['file.ts']);
    expect(result.named).toEqual({ output: 'build', verbose: 'true' });
  });

  it('should handle quoted strings with double quotes', () => {
    // The tokenizer processes the full input string, so "hello world" becomes one token
    // and --name="John Doe" becomes one token (quotes around the value part including =)
    const result = parseArguments('"hello world" --name="John Doe"');
    expect(result.positional).toEqual(['hello world']);
    // --name="John Doe" → the tokenizer sees " after = and enters quote mode,
    // so the full token is: --name=John Doe
    expect(result.named.name).toBe('John Doe');
  });

  it('should handle quoted strings with single quotes', () => {
    const result = parseArguments("'hello world'");
    expect(result.positional).toEqual(['hello world']);
  });

  it('should handle multiple positional arguments', () => {
    const result = parseArguments('file1.ts file2.ts file3.ts');
    expect(result.positional).toEqual(['file1.ts', 'file2.ts', 'file3.ts']);
  });

  it('should handle = in named argument value', () => {
    const result = parseArguments('--expr=a=b');
    expect(result.named).toEqual({ expr: 'a=b' });
  });
});

// -------------------------------------------------------------------
// expandVariables
// -------------------------------------------------------------------
describe('expandVariables', () => {
  const baseInput: CommandExecutionInput = {
    arguments: 'hello world',
    positionalArgs: ['hello', 'world'],
    namedArgs: { lang: 'typescript', output: 'dist' },
    sessionId: 'session-123',
    workspaceId: 'workspace-456',
    cwd: '/home/user/project',
  };

  it('should expand $ARGUMENTS', () => {
    const result = expandVariables('Run with: $ARGUMENTS', baseInput);
    expect(result).toBe('Run with: hello world');
  });

  it('should expand ${ARGUMENTS}', () => {
    const result = expandVariables('Run with: ${ARGUMENTS}', baseInput);
    expect(result).toBe('Run with: hello world');
  });

  it('should expand positional arguments $1 and $2', () => {
    const result = expandVariables('First: $1, Second: $2', baseInput);
    expect(result).toBe('First: hello, Second: world');
  });

  it('should expand positional arguments with braces ${1}', () => {
    const result = expandVariables('First: ${1}', baseInput);
    expect(result).toBe('First: hello');
  });

  it('should replace missing positional arguments with empty string', () => {
    const result = expandVariables('Third: $3', baseInput);
    expect(result).toBe('Third: ');
  });

  it('should expand named arguments $name', () => {
    const result = expandVariables('Language: $lang', baseInput);
    expect(result).toBe('Language: typescript');
  });

  it('should expand named arguments ${name}', () => {
    const result = expandVariables('Output: ${output}', baseInput);
    expect(result).toBe('Output: dist');
  });

  it('should expand $SESSION_ID', () => {
    const result = expandVariables('Session: $SESSION_ID', baseInput);
    expect(result).toBe('Session: session-123');
  });

  it('should expand ${SESSION_ID}', () => {
    const result = expandVariables('Session: ${SESSION_ID}', baseInput);
    expect(result).toBe('Session: session-123');
  });

  it('should expand $WORKSPACE_ID', () => {
    const result = expandVariables('Workspace: $WORKSPACE_ID', baseInput);
    expect(result).toBe('Workspace: workspace-456');
  });

  it('should expand $CWD', () => {
    const result = expandVariables('Dir: $CWD', baseInput);
    expect(result).toBe('Dir: /home/user/project');
  });

  it('should expand ${CWD}', () => {
    const result = expandVariables('Dir: ${CWD}', baseInput);
    expect(result).toBe('Dir: /home/user/project');
  });

  it('should use process.cwd() when cwd is not set', () => {
    const input = { ...baseInput, cwd: undefined };
    const result = expandVariables('Dir: $CWD', input);
    expect(result).toBe(`Dir: ${process.cwd()}`);
  });

  it('should expand multiple variables in the same string', () => {
    const result = expandVariables(
      'Run $1 in $CWD with session $SESSION_ID and $ARGUMENTS',
      baseInput
    );
    expect(result).toBe('Run hello in /home/user/project with session session-123 and hello world');
  });

  it('should handle content with no variables', () => {
    const result = expandVariables('No variables here', baseInput);
    expect(result).toBe('No variables here');
  });

  it('should handle empty content', () => {
    const result = expandVariables('', baseInput);
    expect(result).toBe('');
  });
});

// -------------------------------------------------------------------
// generateHelpText
// -------------------------------------------------------------------
describe('generateHelpText', () => {
  it('should generate basic help text', () => {
    const command: CommandDefinition = {
      metadata: {
        name: 'test',
        description: 'A test command',
      },
      content: 'Run the test',
      sourcePath: '/project/.claude/commands/test.md',
      scope: 'project',
    };

    const help = generateHelpText(command);
    expect(help).toContain('/test');
    expect(help).toContain('A test command');
    expect(help).toContain('Source: /project/.claude/commands/test.md (project)');
  });

  it('should include arguments in help text', () => {
    const command: CommandDefinition = {
      metadata: {
        name: 'build',
        description: 'Build the project',
        arguments: [
          { name: 'target', required: true, description: 'Build target' },
          { name: 'output', required: false, default: 'dist', description: 'Output directory' },
        ],
      },
      content: 'Build $1',
      sourcePath: '/project/.claude/commands/build.md',
      scope: 'project',
    };

    const help = generateHelpText(command);
    expect(help).toContain('Arguments:');
    expect(help).toContain('target');
    expect(help).toContain('(required)');
    expect(help).toContain('Build target');
    expect(help).toContain('output');
    expect(help).toContain('[default: dist]');
    expect(help).toContain('Output directory');
  });

  it('should include tags', () => {
    const command: CommandDefinition = {
      metadata: {
        name: 'deploy',
        tags: ['ci', 'deployment'],
      },
      content: 'Deploy it',
      sourcePath: '/project/.claude/commands/deploy.md',
      scope: 'user',
    };

    const help = generateHelpText(command);
    expect(help).toContain('Tags: ci, deployment');
    expect(help).toContain('(user)');
  });

  it('should handle command with no description', () => {
    const command: CommandDefinition = {
      metadata: { name: 'simple' },
      content: 'Do it',
      sourcePath: '/commands/simple.md',
      scope: 'project',
    };

    const help = generateHelpText(command);
    expect(help).toContain('/simple');
    expect(help).not.toContain(' - ');
  });

  it('should handle command with no arguments', () => {
    const command: CommandDefinition = {
      metadata: { name: 'clean', description: 'Clean up' },
      content: 'Clean',
      sourcePath: '/commands/clean.md',
      scope: 'project',
    };

    const help = generateHelpText(command);
    expect(help).not.toContain('Arguments:');
  });

  it('should handle empty arguments array', () => {
    const command: CommandDefinition = {
      metadata: { name: 'noop', arguments: [] },
      content: '',
      sourcePath: '/commands/noop.md',
      scope: 'project',
    };

    const help = generateHelpText(command);
    expect(help).not.toContain('Arguments:');
  });

  it('should handle argument with no description', () => {
    const command: CommandDefinition = {
      metadata: {
        name: 'run',
        arguments: [{ name: 'file', required: true }],
      },
      content: 'Run $1',
      sourcePath: '/commands/run.md',
      scope: 'project',
    };

    const help = generateHelpText(command);
    expect(help).toContain('file');
    expect(help).toContain('(required)');
  });
});
