import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
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

import Anthropic from '@anthropic-ai/sdk';
import { ForensicIntake, createForensicIntake } from './ForensicIntake';

describe('ForensicIntake', () => {
  let intake: ForensicIntake;
  let mockClient: Anthropic;

  beforeEach(() => {
    mockClient = new Anthropic();
    intake = new ForensicIntake(mockClient);
  });

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(intake).toBeInstanceOf(ForensicIntake);
    });

    it('should accept optional onStream callback', () => {
      const onStream = vi.fn();
      const fi = new ForensicIntake(mockClient, onStream);
      expect(fi).toBeInstanceOf(ForensicIntake);
    });

    it('should accept custom system prompt', () => {
      const fi = new ForensicIntake(mockClient, undefined, 'Custom prompt');
      expect(fi).toBeInstanceOf(ForensicIntake);
    });

    it('should accept custom opening message', () => {
      const fi = new ForensicIntake(mockClient, undefined, undefined, 'Hello!');
      expect(fi).toBeInstanceOf(ForensicIntake);
    });
  });

  describe('methods', () => {
    it('should have getMessages method', () => {
      expect(typeof intake.getMessages).toBe('function');
    });

    it('should have restoreMessages method', () => {
      expect(typeof intake.restoreMessages).toBe('function');
    });

    it('should have startIntake method', () => {
      expect(typeof intake.startIntake).toBe('function');
    });

    it('should have processUserInput method', () => {
      expect(typeof intake.processUserInput).toBe('function');
    });

    it('should have isComplete method', () => {
      expect(typeof intake.isComplete).toBe('function');
    });

    it('should have getSynthesizedProblem method', () => {
      expect(typeof intake.getSynthesizedProblem).toBe('function');
    });

    it('should have getUserProblem method', () => {
      expect(typeof intake.getUserProblem).toBe('function');
    });
  });

  describe('getMessages', () => {
    it('should return empty array initially', () => {
      expect(intake.getMessages()).toEqual([]);
    });

    it('should return a copy (not reference)', () => {
      const msgs = intake.getMessages();
      msgs.push({ role: 'user', content: 'test' });
      expect(intake.getMessages()).toEqual([]);
    });
  });

  describe('restoreMessages', () => {
    it('should restore messages', () => {
      const messages = [
        { role: 'user' as const, content: 'I need help with housing' },
        { role: 'assistant' as const, content: 'Tell me more' },
      ];
      intake.restoreMessages(messages);
      expect(intake.getMessages()).toHaveLength(2);
    });
  });

  describe('isComplete', () => {
    it('should return false initially', () => {
      expect(intake.isComplete()).toBe(false);
    });
  });

  describe('getSynthesizedProblem', () => {
    it('should return undefined initially', () => {
      expect(intake.getSynthesizedProblem()).toBeUndefined();
    });
  });

  describe('getUserProblem', () => {
    it('should return undefined initially', () => {
      expect(intake.getUserProblem()).toBeUndefined();
    });
  });
});

describe('createForensicIntake', () => {
  it('should return a ForensicIntake instance', () => {
    const client = new Anthropic();
    const fi = createForensicIntake(client);
    expect(fi).toBeInstanceOf(ForensicIntake);
  });

  it('should accept all optional params', () => {
    const client = new Anthropic();
    const fi = createForensicIntake(client, vi.fn(), 'prompt', 'opening');
    expect(fi).toBeInstanceOf(ForensicIntake);
  });
});
