import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { SteeringEngine, createSteeringEngine } from './SteeringEngine';

describe('SteeringEngine', () => {
  let engine: SteeringEngine;

  beforeEach(() => {
    engine = new SteeringEngine();
  });

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(engine).toBeInstanceOf(SteeringEngine);
    });

    it('should accept optional onStream', () => {
      const onStream = vi.fn();
      const e = new SteeringEngine(onStream);
      expect(e).toBeInstanceOf(SteeringEngine);
    });
  });

  describe('setActiveDomains', () => {
    it('should set domains without error', () => {
      expect(() => engine.setActiveDomains(['housing', 'jobs'])).not.toThrow();
    });
  });

  describe('parseCommand', () => {
    it('should return null for empty string', () => {
      expect(engine.parseCommand('')).toBeNull();
    });

    it('should return null for non-command text', () => {
      expect(engine.parseCommand('hello there')).toBeNull();
    });

    it('should parse kill domain commands', () => {
      const result = engine.parseCommand('stop researching about housing');
      expect(result).not.toBeNull();
      expect(result!.action).toBe('kill_domain');
    });

    it('should parse "cancel all scouts on" pattern', () => {
      const result = engine.parseCommand('cancel all scouts on transportation');
      expect(result).not.toBeNull();
      expect(result!.action).toBe('kill_domain');
    });

    it('should parse focus domain commands', () => {
      const result = engine.parseCommand('focus on housing prices');
      expect(result).not.toBeNull();
      expect(result!.action).toBe('focus_domain');
    });

    it('should parse "prioritize" focus commands', () => {
      const result = engine.parseCommand('prioritize research on transit');
      expect(result).not.toBeNull();
      expect(result!.action).toBe('focus_domain');
    });

    it('should parse redirect commands', () => {
      const result = engine.parseCommand('actually, look at restaurants instead');
      expect(result).not.toBeNull();
      expect(result!.action).toBe('redirect');
    });

    it('should extract target from commands', () => {
      const result = engine.parseCommand('cancel all scouts on downtown apartments');
      expect(result).not.toBeNull();
      expect(result!.target).toBeDefined();
      expect(result!.target!.length).toBeGreaterThan(0);
    });

    it('should include message in command', () => {
      const msg = 'focus on housing prices';
      const result = engine.parseCommand(msg);
      expect(result!.message).toBe(msg);
    });

    it('should include timestamp in command', () => {
      const result = engine.parseCommand('forget housing research');
      expect(result).not.toBeNull();
      expect(result!.timestamp).toBeGreaterThan(0);
    });
  });

  describe('shouldKillScout', () => {
    it('should have shouldKillScout method', () => {
      expect(typeof engine.shouldKillScout).toBe('function');
    });
  });
});

describe('createSteeringEngine', () => {
  it('should return a SteeringEngine', () => {
    const engine = createSteeringEngine();
    expect(engine).toBeInstanceOf(SteeringEngine);
  });

  it('should accept optional onStream', () => {
    const onStream = vi.fn();
    const engine = createSteeringEngine(onStream);
    expect(engine).toBeInstanceOf(SteeringEngine);
  });
});
