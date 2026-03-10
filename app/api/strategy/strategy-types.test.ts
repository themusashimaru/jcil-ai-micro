/**
 * STRATEGY TYPES TESTS
 *
 * Tests for strategy-types.ts:
 * - Type exports (SessionPhase, StrategyAttachment, ActiveSession)
 * - activeSessions Map behavior
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { activeSessions } from './strategy-types';
import type { SessionPhase, StrategyAttachment, ActiveSession } from './strategy-types';

describe('strategy-types', () => {
  beforeEach(() => {
    activeSessions.clear();
  });

  describe('activeSessions Map', () => {
    it('should be an empty Map initially', () => {
      expect(activeSessions).toBeInstanceOf(Map);
      expect(activeSessions.size).toBe(0);
    });

    it('should allow setting and getting sessions', () => {
      const session: ActiveSession = {
        agent: {} as ActiveSession['agent'],
        dbId: 'db-123',
        started: Date.now(),
        phase: 'intake',
      };

      activeSessions.set('session-1', session);
      expect(activeSessions.get('session-1')).toBe(session);
      expect(activeSessions.size).toBe(1);
    });

    it('should allow deleting sessions', () => {
      const session: ActiveSession = {
        agent: {} as ActiveSession['agent'],
        dbId: 'db-456',
        started: Date.now(),
        phase: 'executing',
      };

      activeSessions.set('session-2', session);
      expect(activeSessions.has('session-2')).toBe(true);

      activeSessions.delete('session-2');
      expect(activeSessions.has('session-2')).toBe(false);
      expect(activeSessions.size).toBe(0);
    });

    it('should support multiple concurrent sessions', () => {
      const sessions: ActiveSession[] = [
        { agent: {} as ActiveSession['agent'], dbId: 'db-1', started: 1000, phase: 'intake' },
        { agent: {} as ActiveSession['agent'], dbId: 'db-2', started: 2000, phase: 'executing' },
        { agent: {} as ActiveSession['agent'], dbId: 'db-3', started: 3000, phase: 'complete' },
      ];

      sessions.forEach((s, i) => activeSessions.set(`session-${i}`, s));
      expect(activeSessions.size).toBe(3);

      expect(activeSessions.get('session-0')?.phase).toBe('intake');
      expect(activeSessions.get('session-1')?.phase).toBe('executing');
      expect(activeSessions.get('session-2')?.phase).toBe('complete');
    });

    it('should return undefined for non-existent sessions', () => {
      expect(activeSessions.get('non-existent')).toBeUndefined();
    });

    it('should overwrite existing sessions with the same key', () => {
      const session1: ActiveSession = {
        agent: {} as ActiveSession['agent'],
        dbId: 'db-old',
        started: 1000,
        phase: 'intake',
      };
      const session2: ActiveSession = {
        agent: {} as ActiveSession['agent'],
        dbId: 'db-new',
        started: 2000,
        phase: 'executing',
      };

      activeSessions.set('session-x', session1);
      activeSessions.set('session-x', session2);

      expect(activeSessions.size).toBe(1);
      expect(activeSessions.get('session-x')?.dbId).toBe('db-new');
    });
  });

  describe('SessionPhase type', () => {
    it('should accept valid phase values', () => {
      const phases: SessionPhase[] = ['intake', 'executing', 'complete', 'cancelled', 'error'];
      expect(phases).toHaveLength(5);
      phases.forEach((phase) => {
        expect(typeof phase).toBe('string');
      });
    });
  });

  describe('StrategyAttachment type', () => {
    it('should allow creating valid attachments', () => {
      const attachment: StrategyAttachment = {
        id: 'att-1',
        name: 'document.pdf',
        type: 'application/pdf',
        size: 1024,
        content: 'base64content==',
      };

      expect(attachment.id).toBe('att-1');
      expect(attachment.name).toBe('document.pdf');
      expect(attachment.type).toBe('application/pdf');
      expect(attachment.size).toBe(1024);
      expect(attachment.content).toBe('base64content==');
    });
  });

  describe('ActiveSession type', () => {
    it('should allow creating valid sessions with all phase values', () => {
      const phases: SessionPhase[] = ['intake', 'executing', 'complete', 'cancelled', 'error'];

      phases.forEach((phase) => {
        const session: ActiveSession = {
          agent: {} as ActiveSession['agent'],
          dbId: `db-${phase}`,
          started: Date.now(),
          phase,
        };
        expect(session.phase).toBe(phase);
      });
    });
  });
});
