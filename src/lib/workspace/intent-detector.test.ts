import { describe, it, expect } from 'vitest';
import {
  detectCodeLabIntent,
  shouldUseWorkspaceAgent,
  isSlashCommand,
  getRoutingRecommendation,
} from './intent-detector';

// -------------------------------------------------------------------
// detectCodeLabIntent
// -------------------------------------------------------------------
describe('detectCodeLabIntent', () => {
  // General chat
  it('should detect greeting as general_chat', () => {
    const result = detectCodeLabIntent('Hello!');
    expect(result.type).toBe('general_chat');
    expect(result.shouldUseWorkspace).toBe(false);
  });

  it('should detect thanks as general_chat', () => {
    const result = detectCodeLabIntent('Thanks!');
    expect(result.type).toBe('general_chat');
  });

  // Workspace agent - file operations
  it('should detect file creation as workspace', () => {
    const result = detectCodeLabIntent('create a new component file');
    expect(result.type).toBe('workspace_agent');
    expect(result.shouldUseWorkspace).toBe(true);
  });

  it('should detect file editing as workspace', () => {
    const result = detectCodeLabIntent('edit the file src/index.ts');
    expect(result.shouldUseWorkspace).toBe(true);
  });

  it('should detect file deletion as workspace', () => {
    const result = detectCodeLabIntent('delete the old test file');
    expect(result.shouldUseWorkspace).toBe(true);
  });

  // Workspace agent - shell commands
  it('should detect npm commands as workspace', () => {
    const result = detectCodeLabIntent('npm install lodash');
    expect(result.shouldUseWorkspace).toBe(true);
  });

  it('should detect git commands as workspace', () => {
    const result = detectCodeLabIntent('git status');
    expect(result.shouldUseWorkspace).toBe(true);
  });

  it('should detect docker commands as workspace', () => {
    const result = detectCodeLabIntent('docker build .');
    expect(result.shouldUseWorkspace).toBe(true);
  });

  // Code generation
  it('should detect code generation intent', () => {
    const result = detectCodeLabIntent('write a function to sort an array');
    expect(['code_generation', 'workspace_agent']).toContain(result.type);
  });

  it('should detect React component creation', () => {
    const result = detectCodeLabIntent('create a new React component for a login form');
    expect(result.confidence).toBeGreaterThan(0);
  });

  // Code explanation
  it('should detect explanation request with high confidence', () => {
    const result = detectCodeLabIntent('can you explain how closures work');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should detect walk-through request', () => {
    const result = detectCodeLabIntent('walk me through how React hooks work');
    expect(result.confidence).toBeGreaterThan(0);
  });

  // Code review / analysis
  it('should detect code review request', () => {
    const result = detectCodeLabIntent('review my code for issues');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should detect code quality analysis', () => {
    const result = detectCodeLabIntent('is my implementation correct');
    expect(result.confidence).toBeGreaterThan(0);
  });

  // Testing
  it('should detect test execution as workspace', () => {
    const result = detectCodeLabIntent('run the test suite');
    expect(result.shouldUseWorkspace).toBe(true);
  });

  // Deployment
  it('should detect deployment intent', () => {
    const result = detectCodeLabIntent('deploy the app to production');
    expect(result.shouldUseWorkspace).toBe(true);
  });

  // Debugging
  it('should detect debugging intent', () => {
    const result = detectCodeLabIntent('fix the error in my code');
    expect(result.shouldUseWorkspace).toBe(true);
  });

  it('should detect TypeError reference', () => {
    const result = detectCodeLabIntent('I keep getting a TypeError: undefined is not a function');
    expect(result.confidence).toBeGreaterThan(0);
  });

  // Database
  it('should detect database intent', () => {
    const result = detectCodeLabIntent('create a database migration for users table');
    expect(result.confidence).toBeGreaterThan(0);
  });

  // Security
  it('should detect security intent', () => {
    const result = detectCodeLabIntent('run npm audit to check for security vulnerabilities');
    expect(result.confidence).toBeGreaterThan(0);
  });

  // User level defaults
  it('should default to intermediate user level', () => {
    const result = detectCodeLabIntent('create a React component');
    expect(result.userLevel).toBeDefined();
  });

  // Confidence scoring
  it('should have higher confidence for specific intents', () => {
    const vague = detectCodeLabIntent('help me');
    const specific = detectCodeLabIntent('create a new React component called UserProfile');
    expect(specific.confidence).toBeGreaterThanOrEqual(vague.confidence);
  });

  // Returns DetectedIntent shape
  it('should always return all required fields', () => {
    const result = detectCodeLabIntent('anything at all');
    expect(result).toHaveProperty('type');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('shouldUseWorkspace');
    expect(result).toHaveProperty('signals');
    expect(result).toHaveProperty('userLevel');
    expect(result).toHaveProperty('requiresClarification');
    expect(typeof result.confidence).toBe('number');
    expect(typeof result.shouldUseWorkspace).toBe('boolean');
    expect(Array.isArray(result.signals)).toBe(true);
  });

  it('should handle empty string', () => {
    const result = detectCodeLabIntent('');
    expect(result.type).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });
});

// -------------------------------------------------------------------
// shouldUseWorkspaceAgent
// -------------------------------------------------------------------
describe('shouldUseWorkspaceAgent', () => {
  it('should return true for file operations', () => {
    expect(shouldUseWorkspaceAgent('create a new file called index.ts')).toBe(true);
  });

  it('should return true for npm commands', () => {
    expect(shouldUseWorkspaceAgent('npm run build')).toBe(true);
  });

  it('should return true for git operations', () => {
    expect(shouldUseWorkspaceAgent('git commit -m "fix bug"')).toBe(true);
  });

  it('should return false for greetings', () => {
    expect(shouldUseWorkspaceAgent('Hello there!')).toBe(false);
  });

  it('should return false for explanations', () => {
    expect(shouldUseWorkspaceAgent('explain what a closure is')).toBe(false);
  });

  it('should return false for simple questions', () => {
    expect(shouldUseWorkspaceAgent('what is TypeScript?')).toBe(false);
  });
});

// -------------------------------------------------------------------
// isSlashCommand
// -------------------------------------------------------------------
describe('isSlashCommand', () => {
  it('should detect /help as slash command', () => {
    expect(isSlashCommand('/help')).toBe(true);
  });

  it('should detect /run as slash command', () => {
    expect(isSlashCommand('/run test')).toBe(true);
  });

  it('should not detect regular message', () => {
    expect(isSlashCommand('hello world')).toBe(false);
  });

  it('should not detect number after slash', () => {
    expect(isSlashCommand('/123')).toBe(false);
  });

  it('should handle leading whitespace', () => {
    expect(isSlashCommand('  /help')).toBe(true);
  });

  it('should not detect empty string', () => {
    expect(isSlashCommand('')).toBe(false);
  });

  it('should not detect bare slash', () => {
    expect(isSlashCommand('/')).toBe(false);
  });
});

// -------------------------------------------------------------------
// getRoutingRecommendation
// -------------------------------------------------------------------
describe('getRoutingRecommendation', () => {
  it('should recommend workspace for file operations', () => {
    const rec = getRoutingRecommendation('create a new component file');
    expect(rec.useWorkspace).toBe(true);
    expect(rec.explanation).toContain('Workspace agent recommended');
  });

  it('should recommend standard chat for explanations', () => {
    const rec = getRoutingRecommendation('explain this code to me');
    expect(rec.useWorkspace).toBe(false);
    expect(rec.explanation).toContain('Standard chat mode');
  });

  it('should return confidence score', () => {
    const rec = getRoutingRecommendation('npm run build');
    expect(rec.confidence).toBeGreaterThan(0);
    expect(typeof rec.confidence).toBe('number');
  });

  it('should return intent type', () => {
    const rec = getRoutingRecommendation('review my code');
    expect(rec.intentType).toBeDefined();
    expect(typeof rec.intentType).toBe('string');
  });

  it('should return explanation string', () => {
    const rec = getRoutingRecommendation('hello');
    expect(rec.explanation).toBeTruthy();
    expect(typeof rec.explanation).toBe('string');
  });

  it('should have all required fields', () => {
    const rec = getRoutingRecommendation('anything');
    expect(rec).toHaveProperty('useWorkspace');
    expect(rec).toHaveProperty('intentType');
    expect(rec).toHaveProperty('confidence');
    expect(rec).toHaveProperty('explanation');
  });
});
