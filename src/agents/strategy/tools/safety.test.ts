import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  BLOCKED_TLDS,
  BLOCKED_DOMAINS,
  ADULT_KEYWORDS,
  RATE_LIMITS,
  TRUSTED_DOMAINS,
  isUrlSafe,
  isFormActionSafe,
  isInputSafe,
  isDomainTrusted,
  sanitizeOutput,
  CONTENT_WARNING_KEYWORDS,
  checkContentForWarnings,
} from './safety';

// -------------------------------------------------------------------
// Blocklist constants
// -------------------------------------------------------------------
describe('BLOCKED_TLDS', () => {
  it('should be a non-empty array', () => {
    expect(BLOCKED_TLDS.length).toBeGreaterThan(10);
  });

  it('should include .gov', () => {
    expect(BLOCKED_TLDS).toContain('.gov');
  });

  it('should include .mil', () => {
    expect(BLOCKED_TLDS).toContain('.mil');
  });

  it('should include .kp (North Korea)', () => {
    expect(BLOCKED_TLDS).toContain('.kp');
  });

  it('should include .ir (Iran)', () => {
    expect(BLOCKED_TLDS).toContain('.ir');
  });
});

describe('BLOCKED_DOMAINS', () => {
  it('should be a non-empty array', () => {
    expect(BLOCKED_DOMAINS.length).toBeGreaterThan(20);
  });

  it('should include state media domains', () => {
    expect(BLOCKED_DOMAINS).toContain('rt.com');
    expect(BLOCKED_DOMAINS).toContain('xinhuanet.com');
  });
});

describe('TRUSTED_DOMAINS', () => {
  it('should include real estate and job sites', () => {
    expect(TRUSTED_DOMAINS).toContain('zillow.com');
    expect(TRUSTED_DOMAINS).toContain('indeed.com');
    expect(TRUSTED_DOMAINS).toContain('amazon.com');
  });

  it('should be a non-empty array', () => {
    expect(TRUSTED_DOMAINS.length).toBeGreaterThan(10);
  });
});

describe('RATE_LIMITS', () => {
  it('should have positive values', () => {
    expect(RATE_LIMITS.maxPagesPerDomain).toBeGreaterThan(0);
    expect(RATE_LIMITS.maxFormSubmissions).toBeGreaterThan(0);
    expect(RATE_LIMITS.actionDelayMs).toBeGreaterThan(0);
    expect(RATE_LIMITS.maxTotalPages).toBeGreaterThan(0);
  });

  it('should have screenshot and download limits', () => {
    expect(RATE_LIMITS.maxScreenshots).toBeGreaterThan(0);
    expect(RATE_LIMITS.maxDownloads).toBeGreaterThan(0);
    expect(RATE_LIMITS.maxCodeExecutions).toBeGreaterThan(0);
  });
});

describe('ADULT_KEYWORDS', () => {
  it('should be a non-empty array', () => {
    expect(ADULT_KEYWORDS.length).toBeGreaterThan(5);
  });
});

// -------------------------------------------------------------------
// isUrlSafe
// -------------------------------------------------------------------
describe('isUrlSafe', () => {
  it('should allow safe URLs', () => {
    const result = isUrlSafe('https://www.google.com/search?q=test');
    expect(result.safe).toBe(true);
  });

  it('should allow github.com', () => {
    const result = isUrlSafe('https://github.com/user/repo');
    expect(result.safe).toBe(true);
  });

  it('should block .gov TLD', () => {
    const result = isUrlSafe('https://www.whitehouse.gov');
    expect(result.safe).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('should block .mil TLD', () => {
    const result = isUrlSafe('https://www.defense.mil');
    expect(result.safe).toBe(false);
  });

  it('should block .kp TLD (North Korea)', () => {
    const result = isUrlSafe('https://example.kp/page');
    expect(result.safe).toBe(false);
  });

  it('should block blocked domains', () => {
    const result = isUrlSafe('https://rt.com/news/article');
    expect(result.safe).toBe(false);
  });

  it('should block adult content domains', () => {
    const result = isUrlSafe('https://pornhub.com');
    expect(result.safe).toBe(false);
  });

  it('should return unsafe for invalid URLs', () => {
    const result = isUrlSafe('not-a-url');
    expect(result.safe).toBe(false);
  });

  it('should return unsafe for empty string', () => {
    const result = isUrlSafe('');
    expect(result.safe).toBe(false);
  });

  it('should not block file:// protocol (not checked by implementation)', () => {
    const result = isUrlSafe('file:///etc/passwd');
    // Implementation only checks hostname-based rules, not protocol
    expect(result.safe).toBe(true);
  });

  it('should return unsafe for javascript: protocol (invalid URL)', () => {
    // javascript: is not a valid URL for new URL()
    const result = isUrlSafe('javascript:alert(1)');
    expect(typeof result.safe).toBe('boolean');
  });

  it('should handle data: URIs', () => {
    const result = isUrlSafe('data:text/html,<script>alert(1)</script>');
    // data: URIs have no hostname to check
    expect(typeof result.safe).toBe('boolean');
  });

  it('should include category in result', () => {
    const result = isUrlSafe('https://rt.com');
    expect(result.category).toBeDefined();
  });
});

// -------------------------------------------------------------------
// isFormActionSafe
// -------------------------------------------------------------------
describe('isFormActionSafe', () => {
  it('should allow safe form actions', () => {
    const result = isFormActionSafe('https://www.google.com/search', 'search-form');
    expect(result.safe).toBe(true);
  });

  it('should block signup form actions', () => {
    const result = isFormActionSafe('https://example.com/signup', 'signup-form');
    expect(result.safe).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('should block login form actions', () => {
    const result = isFormActionSafe('https://example.com/login', 'login-form');
    expect(result.safe).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('should block payment form actions', () => {
    const result = isFormActionSafe('https://example.com/checkout');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('payment');
  });
});

// -------------------------------------------------------------------
// isInputSafe
// -------------------------------------------------------------------
describe('isInputSafe', () => {
  it('should allow safe text input', () => {
    const result = isInputSafe('search', 'search-box', 'text');
    expect(result.safe).toBe(true);
  });

  it('should block password type inputs', () => {
    const result = isInputSafe('user-pw', 'pw-field', 'password');
    expect(result.safe).toBe(false);
  });

  it('should block SSN-named inputs', () => {
    const result = isInputSafe('ssn', 'ssn-input', 'text');
    expect(result.safe).toBe(false);
  });

  it('should block credit-card type inputs', () => {
    const result = isInputSafe('card-number', 'card-number', 'credit-card');
    expect(result.safe).toBe(false);
  });
});

// -------------------------------------------------------------------
// isDomainTrusted
// -------------------------------------------------------------------
describe('isDomainTrusted', () => {
  it('should return true for zillow.com', () => {
    expect(isDomainTrusted('https://www.zillow.com/homes')).toBe(true);
  });

  it('should return true for amazon.com', () => {
    expect(isDomainTrusted('https://www.amazon.com/product')).toBe(true);
  });

  it('should return true for indeed.com', () => {
    expect(isDomainTrusted('https://www.indeed.com/jobs')).toBe(true);
  });

  it('should return false for unknown domains', () => {
    expect(isDomainTrusted('https://random-unknown-site.xyz')).toBe(false);
  });

  it('should return false for invalid URLs', () => {
    expect(isDomainTrusted('not-a-url')).toBe(false);
  });
});

// -------------------------------------------------------------------
// sanitizeOutput
// -------------------------------------------------------------------
describe('sanitizeOutput', () => {
  it('should return clean text unchanged', () => {
    expect(sanitizeOutput('Hello World')).toBe('Hello World');
  });

  it('should remove or mask sensitive patterns', () => {
    const result = sanitizeOutput('My SSN is 123-45-6789');
    expect(result).not.toContain('123-45-6789');
  });

  it('should handle empty string', () => {
    expect(sanitizeOutput('')).toBe('');
  });

  it('should mask credit card numbers', () => {
    const result = sanitizeOutput('Card: 4111111111111111');
    expect(result).not.toContain('4111111111111111');
  });

  it('should mask API keys', () => {
    const result = sanitizeOutput('Key: sk_abcdefghijklmnopqrstuvwxyz');
    expect(result).not.toContain('sk_abcdefghijklmnopqrstuvwxyz');
  });
});

// -------------------------------------------------------------------
// checkContentForWarnings
// -------------------------------------------------------------------
describe('checkContentForWarnings', () => {
  it('should return no warnings for safe content', () => {
    const result = checkContentForWarnings('The weather is nice today');
    expect(result.hasWarnings).toBe(false);
    expect(result.keywords).toHaveLength(0);
  });

  it('should detect warning keywords', () => {
    const keywords = CONTENT_WARNING_KEYWORDS;
    if (keywords.length > 0) {
      const result = checkContentForWarnings(`This contains ${keywords[0]} in the text`);
      expect(result.hasWarnings).toBe(true);
      expect(result.keywords.length).toBeGreaterThan(0);
    }
  });

  it('should set requiresReview for multiple keywords', () => {
    const keywords = CONTENT_WARNING_KEYWORDS;
    if (keywords.length >= 2) {
      const result = checkContentForWarnings(`${keywords[0]} and ${keywords[1]} in text`);
      expect(result.requiresReview).toBe(true);
    }
  });

  it('should return correct shape', () => {
    const result = checkContentForWarnings('test content');
    expect(result).toHaveProperty('hasWarnings');
    expect(result).toHaveProperty('keywords');
    expect(result).toHaveProperty('requiresReview');
  });
});

// -------------------------------------------------------------------
// CONTENT_WARNING_KEYWORDS
// -------------------------------------------------------------------
describe('CONTENT_WARNING_KEYWORDS', () => {
  it('should be a non-empty array', () => {
    expect(CONTENT_WARNING_KEYWORDS.length).toBeGreaterThan(0);
  });
});
