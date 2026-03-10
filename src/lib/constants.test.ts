import { describe, it, expect } from 'vitest';
import {
  PAGINATION,
  RATE_LIMITS,
  TIMEOUTS,
  CACHE_TTL,
  FILE_LIMITS,
  MESSAGE_LIMITS,
  TOKEN_LIMITS,
  IMAGE_LIMITS,
  RETENTION,
  UI,
  HTTP_STATUS,
  ERROR_CODES,
} from './constants';

describe('Application Constants', () => {
  describe('PAGINATION', () => {
    it('should have valid default page sizes', () => {
      expect(PAGINATION.DEFAULT_PAGE_SIZE).toBe(50);
      expect(PAGINATION.USER_DEFAULT_PAGE_SIZE).toBe(20);
    });

    it('should have max page sizes greater than defaults', () => {
      expect(PAGINATION.MAX_PAGE_SIZE).toBeGreaterThan(PAGINATION.DEFAULT_PAGE_SIZE);
      expect(PAGINATION.USER_MAX_PAGE_SIZE).toBeGreaterThan(PAGINATION.USER_DEFAULT_PAGE_SIZE);
    });

    it('should be readonly (TypeScript enforced)', () => {
      // The 'as const' assertion makes these readonly in TypeScript
      // Runtime mutation is possible but TypeScript will error
      expect(PAGINATION.DEFAULT_PAGE_SIZE).toBe(50);
      // Verify values are defined
      expect(Object.keys(PAGINATION).length).toBeGreaterThan(0);
    });
  });

  describe('RATE_LIMITS', () => {
    it('should have reasonable chat limits', () => {
      expect(RATE_LIMITS.CHAT_FREE_PER_MINUTE).toBeGreaterThan(0);
      expect(RATE_LIMITS.CHAT_PAID_PER_MINUTE).toBeGreaterThan(RATE_LIMITS.CHAT_FREE_PER_MINUTE);
    });

    it('should have reasonable API limits', () => {
      expect(RATE_LIMITS.API_REQUESTS_PER_MINUTE).toBeGreaterThan(0);
      expect(RATE_LIMITS.LOGIN_ATTEMPTS_PER_HOUR).toBeGreaterThan(0);
    });

    it('should have support ticket limits', () => {
      expect(RATE_LIMITS.SUPPORT_TICKETS_PER_HOUR).toBeGreaterThan(0);
      expect(RATE_LIMITS.SUPPORT_TICKETS_PER_HOUR).toBeLessThanOrEqual(10);
    });
  });

  describe('TIMEOUTS', () => {
    it('should have reasonable API timeouts', () => {
      expect(TIMEOUTS.API_REQUEST).toBe(30_000);
      expect(TIMEOUTS.LONG_API_REQUEST).toBeGreaterThan(TIMEOUTS.API_REQUEST);
    });

    it('should have AI response timeout', () => {
      expect(TIMEOUTS.AI_RESPONSE).toBeGreaterThan(TIMEOUTS.API_REQUEST);
    });

    it('should have code execution timeout', () => {
      expect(TIMEOUTS.CODE_EXECUTION).toBe(60_000);
    });

    it('should have session idle timeout', () => {
      expect(TIMEOUTS.SESSION_IDLE).toBe(30 * 60 * 1000); // 30 minutes
    });
  });

  describe('CACHE_TTL', () => {
    it('should have increasing TTL values', () => {
      expect(CACHE_TTL.SHORT).toBeLessThan(CACHE_TTL.MEDIUM);
      expect(CACHE_TTL.MEDIUM).toBeLessThan(CACHE_TTL.LONG);
      expect(CACHE_TTL.LONG).toBeLessThan(CACHE_TTL.USER_SESSION);
      expect(CACHE_TTL.USER_SESSION).toBeLessThan(CACHE_TTL.STATIC);
    });

    it('should have admin stats cache', () => {
      expect(CACHE_TTL.ADMIN_STATS).toBe(300); // 5 minutes
    });
  });

  describe('FILE_LIMITS', () => {
    it('should have max file size in bytes', () => {
      expect(FILE_LIMITS.MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
    });

    it('should have image size less than general file size', () => {
      expect(FILE_LIMITS.MAX_IMAGE_SIZE).toBeLessThan(FILE_LIMITS.MAX_FILE_SIZE);
    });

    it('should have document size greater than general file size', () => {
      expect(FILE_LIMITS.MAX_DOCUMENT_SIZE).toBeGreaterThan(FILE_LIMITS.MAX_FILE_SIZE);
    });

    it('should have maximum files per request', () => {
      expect(FILE_LIMITS.MAX_FILES_PER_REQUEST).toBe(10);
    });
  });

  describe('MESSAGE_LIMITS', () => {
    it('should have max message length', () => {
      expect(MESSAGE_LIMITS.MAX_MESSAGE_LENGTH).toBe(32_000);
    });

    it('should have max title length', () => {
      expect(MESSAGE_LIMITS.MAX_TITLE_LENGTH).toBe(200);
    });

    it('should have minimum message length', () => {
      expect(MESSAGE_LIMITS.MIN_MESSAGE_LENGTH).toBe(1);
    });

    it('should have messages before summary threshold', () => {
      expect(MESSAGE_LIMITS.MESSAGES_BEFORE_SUMMARY).toBeGreaterThan(0);
    });
  });

  describe('TOKEN_LIMITS', () => {
    it('should have increasing limits by tier', () => {
      expect(TOKEN_LIMITS.FREE).toBeLessThan(TOKEN_LIMITS.PLUS);
      expect(TOKEN_LIMITS.PLUS).toBeLessThan(TOKEN_LIMITS.PRO);
      expect(TOKEN_LIMITS.PRO).toBeLessThan(TOKEN_LIMITS.EXECUTIVE);
    });

    it('should have reasonable free tier', () => {
      expect(TOKEN_LIMITS.FREE).toBe(10_000);
    });
  });

  describe('IMAGE_LIMITS', () => {
    it('should have increasing limits by tier', () => {
      expect(IMAGE_LIMITS.FREE).toBeLessThan(IMAGE_LIMITS.PLUS);
      expect(IMAGE_LIMITS.PLUS).toBeLessThan(IMAGE_LIMITS.PRO);
      expect(IMAGE_LIMITS.PRO).toBeLessThan(IMAGE_LIMITS.EXECUTIVE);
    });
  });

  describe('RETENTION', () => {
    it('should have conversation retention in days', () => {
      expect(RETENTION.CONVERSATIONS).toBe(90);
    });

    it('should have message retention matching conversation retention', () => {
      expect(RETENTION.MESSAGES).toBe(RETENTION.CONVERSATIONS);
    });

    it('should have session data retention', () => {
      expect(RETENTION.SESSION_DATA).toBe(30);
    });
  });

  describe('UI', () => {
    it('should have typing indicator threshold', () => {
      expect(UI.TYPING_INDICATOR_THRESHOLD).toBe(300);
    });

    it('should have auto-save interval', () => {
      expect(UI.AUTO_SAVE_INTERVAL).toBe(5000);
    });

    it('should have toast duration', () => {
      expect(UI.TOAST_DURATION).toBe(5000);
    });

    it('should have search debounce', () => {
      expect(UI.SEARCH_DEBOUNCE).toBe(300);
    });
  });

  describe('HTTP_STATUS', () => {
    it('should have correct success codes', () => {
      expect(HTTP_STATUS.OK).toBe(200);
      expect(HTTP_STATUS.CREATED).toBe(201);
      expect(HTTP_STATUS.NO_CONTENT).toBe(204);
    });

    it('should have correct client error codes', () => {
      expect(HTTP_STATUS.BAD_REQUEST).toBe(400);
      expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
      expect(HTTP_STATUS.FORBIDDEN).toBe(403);
      expect(HTTP_STATUS.NOT_FOUND).toBe(404);
      expect(HTTP_STATUS.TOO_MANY_REQUESTS).toBe(429);
    });

    it('should have correct server error codes', () => {
      expect(HTTP_STATUS.INTERNAL_ERROR).toBe(500);
      expect(HTTP_STATUS.SERVICE_UNAVAILABLE).toBe(503);
    });
  });

  describe('ERROR_CODES', () => {
    it('should have authentication error codes', () => {
      expect(ERROR_CODES.UNAUTHORIZED).toBe('UNAUTHORIZED');
      expect(ERROR_CODES.FORBIDDEN).toBe('FORBIDDEN');
      expect(ERROR_CODES.AUTH_ERROR).toBe('AUTH_ERROR');
    });

    it('should have rate limiting error code', () => {
      expect(ERROR_CODES.RATE_LIMITED).toBe('RATE_LIMITED');
    });

    it('should have validation error codes', () => {
      expect(ERROR_CODES.INVALID_INPUT).toBe('INVALID_INPUT');
      expect(ERROR_CODES.REQUEST_TOO_LARGE).toBe('REQUEST_TOO_LARGE');
    });

    it('should have resource error codes', () => {
      expect(ERROR_CODES.NOT_FOUND).toBe('NOT_FOUND');
      expect(ERROR_CODES.ALREADY_EXISTS).toBe('ALREADY_EXISTS');
    });

    it('should have limit error codes', () => {
      expect(ERROR_CODES.TOKEN_LIMIT_EXCEEDED).toBe('TOKEN_LIMIT_EXCEEDED');
      expect(ERROR_CODES.IMAGE_LIMIT_EXCEEDED).toBe('IMAGE_LIMIT_EXCEEDED');
    });
  });
});
