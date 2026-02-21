/**
 * USER LEARNING SERVICE - Tests
 */

import { describe, it, expect } from 'vitest';

describe('UserLearning', () => {
  describe('detectPreferences', () => {
    it('should detect bullet format preference', async () => {
      const { detectPreferences } = await import('./index');
      const result = detectPreferences('Can you give me a bulleted list of features?');
      expect(result).toContainEqual({ type: 'format_style', value: 'bullets' });
    });

    it('should detect step-by-step format preference', async () => {
      const { detectPreferences } = await import('./index');
      const result = detectPreferences('Walk me through this step by step');
      expect(result).toContainEqual({ type: 'format_style', value: 'step-by-step' });
    });

    it('should detect concise response length', async () => {
      const { detectPreferences } = await import('./index');
      const result = detectPreferences('Give me a brief overview');
      expect(result).toContainEqual({ type: 'response_length', value: 'concise' });
    });

    it('should detect tl;dr as concise', async () => {
      const { detectPreferences } = await import('./index');
      const result = detectPreferences('tldr whats going on');
      expect(result).toContainEqual({ type: 'response_length', value: 'concise' });
    });

    it('should detect detailed response length', async () => {
      const { detectPreferences } = await import('./index');
      const result = detectPreferences('Can you give me a detailed explanation?');
      expect(result).toContainEqual({ type: 'response_length', value: 'detailed' });
    });

    it('should detect simple explanation request', async () => {
      const { detectPreferences } = await import('./index');
      const result = detectPreferences("Explain like I'm 5");
      expect(result).toContainEqual({ type: 'response_length', value: 'simple' });
    });

    it('should detect formal tone', async () => {
      const { detectPreferences } = await import('./index');
      const result = detectPreferences('Please respond formally');
      expect(result).toContainEqual({ type: 'communication_tone', value: 'formal' });
    });

    it('should detect casual tone', async () => {
      const { detectPreferences } = await import('./index');
      const result = detectPreferences('Just keep it casual');
      expect(result).toContainEqual({ type: 'communication_tone', value: 'casual' });
    });

    it('should detect technical tone', async () => {
      const { detectPreferences } = await import('./index');
      const result = detectPreferences('Be technical about the implementation');
      expect(result).toContainEqual({ type: 'communication_tone', value: 'technical' });
    });

    it('should detect code example preference', async () => {
      const { detectPreferences } = await import('./index');
      const result = detectPreferences('Show me a code example');
      expect(result).toContainEqual({ type: 'output_preference', value: 'code-examples' });
    });

    it('should detect software engineering domain', async () => {
      const { detectPreferences } = await import('./index');
      const result = detectPreferences('How do I set up a React component with TypeScript?');
      expect(result).toContainEqual({ type: 'domain_expertise', value: 'software-engineering' });
    });

    it('should detect business domain', async () => {
      const { detectPreferences } = await import('./index');
      const result = detectPreferences("What's a good business model for a startup?");
      expect(result).toContainEqual({ type: 'domain_expertise', value: 'business' });
    });

    it('should detect finance domain', async () => {
      const { detectPreferences } = await import('./index');
      const result = detectPreferences('How should I structure my investment portfolio?');
      expect(result).toContainEqual({ type: 'domain_expertise', value: 'finance' });
    });

    it('should detect theology domain', async () => {
      const { detectPreferences } = await import('./index');
      const result = detectPreferences('What does scripture say about forgiveness?');
      expect(result).toContainEqual({ type: 'domain_expertise', value: 'theology' });
    });

    it('should detect AI/ML domain', async () => {
      const { detectPreferences } = await import('./index');
      const result = detectPreferences('How do I fine-tune an LLM for my use case?');
      expect(result).toContainEqual({ type: 'domain_expertise', value: 'ai-ml' });
    });

    it('should detect multiple preferences in one message', async () => {
      const { detectPreferences } = await import('./index');
      const result = detectPreferences('Give me a detailed, technical code example of React hooks');
      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result).toContainEqual({ type: 'response_length', value: 'detailed' });
      expect(result).toContainEqual({ type: 'communication_tone', value: 'technical' });
      expect(result).toContainEqual({ type: 'output_preference', value: 'code-examples' });
    });

    it('should return empty array for generic messages', async () => {
      const { detectPreferences } = await import('./index');
      const result = detectPreferences('Hello, how are you doing today?');
      expect(result).toEqual([]);
    });

    it('should be case insensitive', async () => {
      const { detectPreferences } = await import('./index');
      const result = detectPreferences('GIVE ME A BRIEF OVERVIEW');
      expect(result).toContainEqual({ type: 'response_length', value: 'concise' });
    });

    it('should detect table format preference', async () => {
      const { detectPreferences } = await import('./index');
      const result = detectPreferences('Can you show this in table format?');
      expect(result).toContainEqual({ type: 'format_style', value: 'tables' });
    });

    it('should detect diagram/visual preference', async () => {
      const { detectPreferences } = await import('./index');
      const result = detectPreferences('Can you show me a diagram of the architecture?');
      expect(result).toContainEqual({ type: 'output_preference', value: 'visual' });
    });
  });

  describe('module exports', () => {
    it('should export all expected functions', async () => {
      const learningModule = await import('./index');
      expect(typeof learningModule.detectPreferences).toBe('function');
      expect(typeof learningModule.recordPreference).toBe('function');
      expect(typeof learningModule.observeAndLearn).toBe('function');
      expect(typeof learningModule.loadPreferences).toBe('function');
      expect(typeof learningModule.getLearningContext).toBe('function');
      expect(typeof learningModule.deleteUserLearning).toBe('function');
    });
  });

  describe('getLearningContext', () => {
    it('should return empty context when no database is configured', async () => {
      const { getLearningContext } = await import('./index');
      const result = await getLearningContext('nonexistent-user');
      expect(result.loaded).toBe(false);
      expect(result.contextString).toBe('');
      expect(result.preferences).toEqual([]);
    });
  });

  describe('loadPreferences', () => {
    it('should return empty array when no database is configured', async () => {
      const { loadPreferences } = await import('./index');
      const result = await loadPreferences('nonexistent-user');
      expect(result).toEqual([]);
    });
  });

  describe('deleteUserLearning', () => {
    it('should return false when no database is configured', async () => {
      const { deleteUserLearning } = await import('./index');
      const result = await deleteUserLearning('nonexistent-user');
      expect(result).toBe(false);
    });
  });
});
