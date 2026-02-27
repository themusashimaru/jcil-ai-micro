// @ts-nocheck - Test file with extensive mocking
/** @vitest-environment node */

/**
 * COMPREHENSIVE TESTS for src/agents/strategy/tools/safety.ts
 *
 * Tests all exported functions:
 *   - isUrlSafe
 *   - isFormActionSafe
 *   - isInputSafe
 *   - isDomainTrusted
 *   - sanitizeOutput
 *   - checkContentForWarnings
 *   - canVisitPage
 *   - recordPageVisit
 *   - canSubmitForm
 *   - recordFormSubmission
 *   - getBlockedAttempts
 *   - cleanupSessionTracker
 *   - getSessionTracker
 *   - stopSessionCleanupInterval
 *   - logRiskyAction
 *   - logBlockedAction
 *   - getCondensedSafetyPrompt
 *
 * Also tests exported constants:
 *   - BLOCKED_TLDS, BLOCKED_DOMAINS, BLOCKED_URL_PATTERNS
 *   - ADULT_KEYWORDS, BLOCKED_FORM_ACTIONS, ALLOWED_FORM_TYPES
 *   - BLOCKED_INPUT_TYPES, BLOCKED_INPUT_PATTERNS
 *   - RATE_LIMITS, TRUSTED_DOMAINS
 *   - CONTENT_WARNING_KEYWORDS, AI_SAFETY_PROMPT
 *
 * All external dependencies are mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const { mockWarn, mockError } = vi.hoisted(() => ({
  mockWarn: vi.fn(),
  mockError: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: mockWarn,
    error: mockError,
  }),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────────

import {
  isUrlSafe,
  isFormActionSafe,
  isInputSafe,
  isDomainTrusted,
  sanitizeOutput,
  checkContentForWarnings,
  canVisitPage,
  recordPageVisit,
  canSubmitForm,
  recordFormSubmission,
  getBlockedAttempts,
  cleanupSessionTracker,
  getSessionTracker,
  stopSessionCleanupInterval,
  logRiskyAction,
  logBlockedAction,
  getCondensedSafetyPrompt,
  BLOCKED_TLDS,
  BLOCKED_DOMAINS,
  BLOCKED_URL_PATTERNS,
  ADULT_KEYWORDS,
  BLOCKED_FORM_ACTIONS,
  ALLOWED_FORM_TYPES,
  BLOCKED_INPUT_TYPES,
  BLOCKED_INPUT_PATTERNS,
  RATE_LIMITS,
  TRUSTED_DOMAINS,
  CONTENT_WARNING_KEYWORDS,
  AI_SAFETY_PROMPT,
} from '../safety';

// ── Helpers ────────────────────────────────────────────────────────────────────

function uniqueSessionId(): string {
  return `test-session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ── Setup / Teardown ───────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  stopSessionCleanupInterval();
});

// =============================================================================
// isUrlSafe
// =============================================================================

describe('isUrlSafe', () => {
  // ── Blocked TLDs ──────────────────────────────────────────────────────────

  it('blocks .gov TLD (US government)', () => {
    const result = isUrlSafe('https://www.whitehouse.gov/policy');
    expect(result.safe).toBe(false);
    expect(result.severity).toBe('critical');
    expect(result.category).toBe('government_military');
    expect(result.reason).toContain('.gov');
  });

  it('blocks .mil TLD (US military)', () => {
    const result = isUrlSafe('https://www.army.mil/info');
    expect(result.safe).toBe(false);
    expect(result.severity).toBe('critical');
    expect(result.category).toBe('government_military');
  });

  it('blocks .gov.uk TLD (UK government)', () => {
    const result = isUrlSafe('https://www.service.gov.uk/');
    expect(result.safe).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('blocks .kp TLD (North Korea)', () => {
    const result = isUrlSafe('https://example.kp/page');
    expect(result.safe).toBe(false);
    expect(result.severity).toBe('critical');
    expect(result.reason).toContain('.kp');
  });

  it('blocks .ir TLD (Iran)', () => {
    const result = isUrlSafe('https://example.ir/test');
    expect(result.safe).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('blocks .ru TLD (Russia)', () => {
    const result = isUrlSafe('https://example.ru/page');
    expect(result.safe).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('blocks .cu TLD (Cuba)', () => {
    const result = isUrlSafe('https://example.cu/something');
    expect(result.safe).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('blocks .gov.cn TLD (Chinese government)', () => {
    const result = isUrlSafe('https://something.gov.cn/page');
    expect(result.safe).toBe(false);
    expect(result.severity).toBe('critical');
  });

  // ── Blocked Domains ───────────────────────────────────────────────────────

  it('blocks Russian state media (rt.com)', () => {
    const result = isUrlSafe('https://www.rt.com/news/article');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('state_propaganda');
    expect(result.severity).toBe('critical');
  });

  it('blocks Chinese state media (xinhuanet.com)', () => {
    const result = isUrlSafe('https://www.xinhuanet.com/english');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('state_propaganda');
  });

  it('blocks adult content sites (pornhub.com)', () => {
    const result = isUrlSafe('https://pornhub.com/anything');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('adult_content');
    expect(result.severity).toBe('critical');
  });

  it('blocks adult content sites (onlyfans.com)', () => {
    const result = isUrlSafe('https://onlyfans.com/creator');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('adult_content');
  });

  it('blocks extremist sites (4chan.org)', () => {
    const result = isUrlSafe('https://boards.4chan.org/b/');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('extremist_content');
    expect(result.severity).toBe('critical');
  });

  it('blocks extremist sites (8kun.top)', () => {
    const result = isUrlSafe('https://8kun.top/board');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('extremist_content');
  });

  it('blocks dark web directories (ahmia.fi)', () => {
    const result = isUrlSafe('https://ahmia.fi/search');
    expect(result.safe).toBe(false);
    expect(result.severity).toBe('high');
  });

  it('blocks URL shorteners (bit.ly)', () => {
    const result = isUrlSafe('https://bit.ly/abc123');
    expect(result.safe).toBe(false);
  });

  it('blocks hacking forums (hackforums.net)', () => {
    const result = isUrlSafe('https://hackforums.net/thread');
    expect(result.safe).toBe(false);
  });

  it('blocks banking login pages (chase.com/login)', () => {
    const result = isUrlSafe('https://www.chase.com/login');
    expect(result.safe).toBe(false);
  });

  it('blocks government services (irs.gov)', () => {
    const result = isUrlSafe('https://irs.gov/forms');
    expect(result.safe).toBe(false);
  });

  it('blocks social media login pages (facebook.com/login)', () => {
    const result = isUrlSafe('https://www.facebook.com/login');
    expect(result.safe).toBe(false);
  });

  it('blocks email login (mail.google.com)', () => {
    const result = isUrlSafe('https://mail.google.com/mail');
    expect(result.safe).toBe(false);
  });

  it('blocks Iranian state media (presstv.ir) via .ir TLD', () => {
    const result = isUrlSafe('https://presstv.ir/latest');
    expect(result.safe).toBe(false);
    // .ir TLD check fires before blocked domain check
    expect(result.category).toBe('government_military');
    expect(result.severity).toBe('critical');
  });

  it('blocks North Korean state media (kcna.kp)', () => {
    const result = isUrlSafe('https://kcna.kp/news');
    expect(result.safe).toBe(false);
  });

  // ── Blocked URL patterns ──────────────────────────────────────────────────

  it('blocks login URL pattern', () => {
    const result = isUrlSafe('https://example.com/login');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('restricted_path');
  });

  it('blocks signup URL pattern', () => {
    const result = isUrlSafe('https://example.com/signup');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('restricted_path');
  });

  it('blocks checkout URL pattern', () => {
    const result = isUrlSafe('https://example.com/checkout');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('restricted_path');
  });

  it('blocks admin URL pattern', () => {
    const result = isUrlSafe('https://example.com/admin');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('restricted_path');
  });

  it('blocks .exe file URL pattern', () => {
    const result = isUrlSafe('https://example.com/download/setup.exe');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('restricted_path');
  });

  it('blocks .onion URL pattern', () => {
    const result = isUrlSafe('https://something.onion/page');
    expect(result.safe).toBe(false);
  });

  it('blocks IP address URLs', () => {
    const result = isUrlSafe('http://192.168.1.1/admin');
    expect(result.safe).toBe(false);
  });

  it('blocks sign-in URL pattern', () => {
    const result = isUrlSafe('https://example.com/sign-in');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('restricted_path');
  });

  it('blocks payment URL pattern', () => {
    const result = isUrlSafe('https://example.com/payment');
    expect(result.safe).toBe(false);
  });

  it('blocks dashboard URL pattern', () => {
    const result = isUrlSafe('https://example.com/dashboard');
    expect(result.safe).toBe(false);
  });

  it('blocks .dmg file downloads', () => {
    const result = isUrlSafe('https://example.com/app.dmg');
    expect(result.safe).toBe(false);
  });

  it('blocks .sh file downloads', () => {
    const result = isUrlSafe('https://example.com/install.sh');
    expect(result.safe).toBe(false);
  });

  // ── Adult keywords ────────────────────────────────────────────────────────

  it('blocks URL containing adult keyword in hostname', () => {
    const result = isUrlSafe('https://porn-site.example.com/page');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('adult_content');
    expect(result.severity).toBe('critical');
  });

  it('blocks URL containing adult keyword in path', () => {
    const result = isUrlSafe('https://example.com/nsfw-content');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('adult_content');
  });

  it('blocks URL containing hentai keyword', () => {
    const result = isUrlSafe('https://example.com/hentai/gallery');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('adult_content');
  });

  // ── Suspicious URLs ───────────────────────────────────────────────────────

  it('blocks URLs with excessive subdomains (phishing)', () => {
    const result = isUrlSafe('https://a.b.c.d.e.example.com/page');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('suspicious');
    expect(result.severity).toBe('medium');
    expect(result.reason).toContain('excessive subdomains');
  });

  // ── Invalid URLs ──────────────────────────────────────────────────────────

  it('rejects invalid URL format', () => {
    const result = isUrlSafe('not-a-url');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('invalid');
    expect(result.reason).toBe('Invalid URL format');
  });

  it('rejects empty string', () => {
    const result = isUrlSafe('');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('invalid');
  });

  // ── Safe URLs ─────────────────────────────────────────────────────────────

  it('allows safe URLs (wikipedia.org)', () => {
    const result = isUrlSafe('https://en.wikipedia.org/wiki/Test');
    expect(result.safe).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('allows safe URLs (github.com)', () => {
    const result = isUrlSafe('https://github.com/user/repo');
    expect(result.safe).toBe(true);
  });

  it('allows safe URLs (stackoverflow.com)', () => {
    const result = isUrlSafe('https://stackoverflow.com/questions/12345');
    expect(result.safe).toBe(true);
  });

  it('allows safe URLs (nytimes.com article)', () => {
    const result = isUrlSafe('https://www.nytimes.com/2024/01/01/article.html');
    expect(result.safe).toBe(true);
  });

  it('allows safe URLs (zillow.com)', () => {
    const result = isUrlSafe('https://www.zillow.com/homedetails/123');
    expect(result.safe).toBe(true);
  });
});

// =============================================================================
// isFormActionSafe
// =============================================================================

describe('isFormActionSafe', () => {
  it('blocks payment form actions', () => {
    const result = isFormActionSafe('checkout', 'checkout-form', 'payment-form');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('payment');
    expect(result.severity).toBe('critical');
  });

  it('blocks login form actions', () => {
    const result = isFormActionSafe('login', 'login-form');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('authentication');
    expect(result.severity).toBe('high');
  });

  it('blocks signup form actions', () => {
    const result = isFormActionSafe('signup');
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('signup');
  });

  it('blocks delete form actions', () => {
    const result = isFormActionSafe('delete-account');
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('delete');
  });

  it('blocks password form actions', () => {
    const result = isFormActionSafe('password');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('authentication');
  });

  it('blocks billing form actions', () => {
    const result = isFormActionSafe('billing');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('payment');
  });

  it('blocks contact form actions', () => {
    const result = isFormActionSafe('contact');
    expect(result.safe).toBe(false);
  });

  it('blocks donate form actions', () => {
    const result = isFormActionSafe('donate');
    expect(result.safe).toBe(false);
  });

  it('allows search form actions', () => {
    const result = isFormActionSafe('search', 'search-form', 'search-box');
    expect(result.safe).toBe(true);
  });

  it('allows filter form actions', () => {
    const result = isFormActionSafe('filter', 'filter-form');
    expect(result.safe).toBe(true);
  });

  it('allows quote/estimate form actions', () => {
    const result = isFormActionSafe('get-quote', 'quote-form', 'estimate');
    expect(result.safe).toBe(true);
  });

  it('allows location selector forms', () => {
    const result = isFormActionSafe('set-location', 'zip-form');
    expect(result.safe).toBe(true);
  });

  it('returns cautious result for unknown form actions', () => {
    const result = isFormActionSafe('some-random-action');
    expect(result.safe).toBe(true);
    expect(result.reason).toContain('caution');
    expect(result.severity).toBe('low');
    expect(result.category).toBe('unknown');
  });

  it('logs warning for unknown form actions', () => {
    isFormActionSafe('unknown-form-action');
    expect(mockWarn).toHaveBeenCalled();
  });

  it('checks combined formAction, formId, and formClass', () => {
    // The id contains 'payment' which should trigger block
    const result = isFormActionSafe('process', 'payment-id', 'normal-class');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('payment');
  });

  it('checks formClass for blocked keywords', () => {
    const result = isFormActionSafe('process', 'form-id', 'login-class');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('authentication');
  });
});

// =============================================================================
// isInputSafe
// =============================================================================

describe('isInputSafe', () => {
  it('blocks password input type', () => {
    const result = isInputSafe('user-password', 'pw-field', 'password');
    expect(result.safe).toBe(false);
    expect(result.severity).toBe('critical');
    expect(result.category).toBe('sensitive_input');
  });

  it('blocks credit-card input type', () => {
    const result = isInputSafe('cc', 'cc-field', 'credit-card');
    expect(result.safe).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('blocks ssn input type', () => {
    const result = isInputSafe('ssn', 'ssn-field', 'ssn');
    expect(result.safe).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('blocks cvv input type', () => {
    const result = isInputSafe('cvv', 'cvv-field', 'cvv');
    expect(result.safe).toBe(false);
  });

  it('blocks pin input type', () => {
    const result = isInputSafe('pin', 'pin-field', 'pin');
    expect(result.safe).toBe(false);
  });

  it('blocks input named password', () => {
    const result = isInputSafe('password');
    expect(result.safe).toBe(false);
    expect(result.severity).toBe('critical');
    expect(result.reason).toContain('pattern');
  });

  it('blocks input named credit_card_number', () => {
    const result = isInputSafe('credit_card_number');
    expect(result.safe).toBe(false);
  });

  it('blocks input with id containing api_key', () => {
    const result = isInputSafe('field', 'api_key_input');
    expect(result.safe).toBe(false);
  });

  it('blocks input named social_security', () => {
    const result = isInputSafe('social_security_number');
    expect(result.safe).toBe(false);
  });

  it('blocks input with bank_account in name', () => {
    const result = isInputSafe('bank_account_num');
    expect(result.safe).toBe(false);
  });

  it('blocks input with routing in name', () => {
    const result = isInputSafe('routing_number');
    expect(result.safe).toBe(false);
  });

  it('blocks input with session in id', () => {
    const result = isInputSafe('field', 'session_token');
    expect(result.safe).toBe(false);
  });

  it('blocks input with private_key in name', () => {
    const result = isInputSafe('private_key_field');
    expect(result.safe).toBe(false);
  });

  it('allows safe input names (email)', () => {
    const result = isInputSafe('email', 'email-input', 'text');
    expect(result.safe).toBe(true);
  });

  it('allows safe input names (first_name)', () => {
    const result = isInputSafe('first_name', 'name-field', 'text');
    expect(result.safe).toBe(true);
  });

  it('allows safe input names (zipcode)', () => {
    const result = isInputSafe('zipcode', 'zip-input', 'text');
    expect(result.safe).toBe(true);
  });
});

// =============================================================================
// isDomainTrusted
// =============================================================================

describe('isDomainTrusted', () => {
  it('trusts zillow.com', () => {
    expect(isDomainTrusted('https://www.zillow.com/homes')).toBe(true);
  });

  it('trusts wikipedia.org', () => {
    expect(isDomainTrusted('https://en.wikipedia.org/wiki/Test')).toBe(true);
  });

  it('trusts github.com', () => {
    expect(isDomainTrusted('https://github.com/repo')).toBe(true);
  });

  it('trusts amazon.com', () => {
    expect(isDomainTrusted('https://www.amazon.com/product')).toBe(true);
  });

  it('trusts indeed.com', () => {
    expect(isDomainTrusted('https://www.indeed.com/jobs')).toBe(true);
  });

  it('trusts nytimes.com', () => {
    expect(isDomainTrusted('https://www.nytimes.com/article')).toBe(true);
  });

  it('does not trust random domains', () => {
    expect(isDomainTrusted('https://random-unknown-site.xyz/page')).toBe(false);
  });

  it('does not trust blocked domains', () => {
    expect(isDomainTrusted('https://rt.com/news')).toBe(false);
  });

  it('returns false for invalid URLs', () => {
    expect(isDomainTrusted('not-a-url')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isDomainTrusted('')).toBe(false);
  });
});

// =============================================================================
// sanitizeOutput
// =============================================================================

describe('sanitizeOutput', () => {
  it('redacts credit card numbers (space-separated)', () => {
    const result = sanitizeOutput('Card: 4111 1111 1111 1111');
    expect(result).toContain('[REDACTED_CARD]');
    expect(result).not.toContain('4111 1111 1111 1111');
  });

  it('redacts credit card numbers (dash-separated)', () => {
    const result = sanitizeOutput('Card: 4111-1111-1111-1111');
    expect(result).toContain('[REDACTED_CARD]');
  });

  it('redacts credit card numbers (no separator)', () => {
    const result = sanitizeOutput('Card: 4111111111111111');
    expect(result).toContain('[REDACTED_CARD]');
  });

  it('redacts SSN numbers (dash-separated)', () => {
    const result = sanitizeOutput('SSN: 123-45-6789');
    expect(result).toContain('[REDACTED_SSN]');
    expect(result).not.toContain('123-45-6789');
  });

  it('redacts SSN numbers (space-separated)', () => {
    const result = sanitizeOutput('SSN: 123 45 6789');
    expect(result).toContain('[REDACTED_SSN]');
  });

  it('redacts phone numbers', () => {
    const result = sanitizeOutput('Call: (555) 123-4567');
    expect(result).toContain('[REDACTED_PHONE]');
    expect(result).not.toContain('(555) 123-4567');
  });

  it('redacts phone numbers with country code', () => {
    const result = sanitizeOutput('Call: +1-555-123-4567');
    expect(result).toContain('[REDACTED_PHONE]');
  });

  it('redacts API keys starting with sk', () => {
    const result = sanitizeOutput('Key: sk-abcdefghijklmnopqrstuvwxyz');
    expect(result).toContain('[REDACTED_API_KEY]');
    expect(result).not.toContain('sk-abcdefghijklmnopqrstuvwxyz');
  });

  it('redacts API keys starting with pk', () => {
    // Regex: (sk|pk|api|key)[-_]?[a-zA-Z0-9]{20,}
    const result = sanitizeOutput('Key: pk_abcdefghijklmnopqrstuvwxyz');
    expect(result).toContain('[REDACTED_API_KEY]');
    expect(result).not.toContain('pk_abcdefghijklmnopqrstuvwxyz');
  });

  it('redacts JWT tokens', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const result = sanitizeOutput(`Token: ${jwt}`);
    expect(result).toContain('[REDACTED_JWT]');
    expect(result).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
  });

  it('preserves non-sensitive text', () => {
    const text = 'Hello world, this is a test message.';
    expect(sanitizeOutput(text)).toBe(text);
  });

  it('handles empty string', () => {
    expect(sanitizeOutput('')).toBe('');
  });

  it('handles multiple sensitive items in one string', () => {
    const input =
      'Card: 4111 1111 1111 1111, SSN: 123-45-6789, API: sk-testkey12345678901234567890';
    const result = sanitizeOutput(input);
    expect(result).toContain('[REDACTED_CARD]');
    expect(result).toContain('[REDACTED_SSN]');
    expect(result).toContain('[REDACTED_API_KEY]');
  });
});

// =============================================================================
// checkContentForWarnings
// =============================================================================

describe('checkContentForWarnings', () => {
  it('detects violence keywords', () => {
    const result = checkContentForWarnings('This article is about terrorism and weapons');
    expect(result.hasWarnings).toBe(true);
    expect(result.keywords).toContain('terrorism');
    expect(result.keywords).toContain('weapon');
  });

  it('detects drug keywords', () => {
    const result = checkContentForWarnings('Discussion about cocaine trafficking');
    expect(result.hasWarnings).toBe(true);
    expect(result.keywords).toContain('cocaine');
    expect(result.keywords).toContain('trafficking');
  });

  it('detects extremism keywords', () => {
    const result = checkContentForWarnings('Report on extremist supremacist groups');
    expect(result.hasWarnings).toBe(true);
    expect(result.keywords).toContain('extremist');
    expect(result.keywords).toContain('supremacist');
  });

  it('sets requiresReview when 2+ keywords found', () => {
    const result = checkContentForWarnings('terrorism and weapons training');
    expect(result.requiresReview).toBe(true);
  });

  it('does not require review for single keyword', () => {
    const result = checkContentForWarnings('A general article about fraud prevention');
    expect(result.hasWarnings).toBe(true);
    expect(result.keywords).toContain('fraud');
    expect(result.requiresReview).toBe(false);
  });

  it('returns no warnings for safe content', () => {
    const result = checkContentForWarnings('Beautiful weather today in the park.');
    expect(result.hasWarnings).toBe(false);
    expect(result.keywords).toEqual([]);
    expect(result.requiresReview).toBe(false);
  });

  it('is case-insensitive', () => {
    const result = checkContentForWarnings('TERRORISM AND WEAPONS');
    expect(result.hasWarnings).toBe(true);
    expect(result.keywords).toContain('terrorism');
    expect(result.keywords).toContain('weapon');
  });

  it('handles empty string', () => {
    const result = checkContentForWarnings('');
    expect(result.hasWarnings).toBe(false);
    expect(result.keywords).toEqual([]);
  });

  it('detects self-harm keywords', () => {
    const result = checkContentForWarnings(
      'Information about suicide prevention and self-harm resources'
    );
    expect(result.hasWarnings).toBe(true);
    expect(result.keywords).toContain('suicide');
    expect(result.keywords).toContain('self-harm');
  });

  it('detects hacking/malware keywords', () => {
    const result = checkContentForWarnings('Ransomware attack used phishing and malware');
    expect(result.hasWarnings).toBe(true);
    expect(result.keywords).toContain('ransomware');
    expect(result.keywords).toContain('phishing');
    expect(result.keywords).toContain('malware');
  });
});

// =============================================================================
// canVisitPage / recordPageVisit — Rate Limiting
// =============================================================================

describe('canVisitPage', () => {
  it('allows visiting a safe URL', () => {
    const sessionId = uniqueSessionId();
    const result = canVisitPage(sessionId, 'https://en.wikipedia.org/wiki/Test');
    expect(result.safe).toBe(true);
    cleanupSessionTracker(sessionId);
  });

  it('blocks visiting an unsafe URL (blocked domain)', () => {
    const sessionId = uniqueSessionId();
    const result = canVisitPage(sessionId, 'https://pornhub.com/page');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('adult_content');
    cleanupSessionTracker(sessionId);
  });

  it('blocks visiting an unsafe URL (blocked TLD)', () => {
    const sessionId = uniqueSessionId();
    const result = canVisitPage(sessionId, 'https://example.gov/page');
    expect(result.safe).toBe(false);
    cleanupSessionTracker(sessionId);
  });

  it('records blocked attempts', () => {
    const sessionId = uniqueSessionId();
    canVisitPage(sessionId, 'https://pornhub.com/bad');
    const blocked = getBlockedAttempts(sessionId);
    expect(blocked.length).toBe(1);
    expect(blocked[0].url).toBe('https://pornhub.com/bad');
    cleanupSessionTracker(sessionId);
  });

  it('enforces max total pages limit', () => {
    const sessionId = uniqueSessionId();
    const tracker = getSessionTracker(sessionId);
    tracker.totalPages = RATE_LIMITS.maxTotalPages;

    const result = canVisitPage(sessionId, 'https://en.wikipedia.org/wiki/Test');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('rate_limit');
    expect(result.reason).toContain('Max total pages');
    cleanupSessionTracker(sessionId);
  });

  it('enforces max pages per domain limit', () => {
    const sessionId = uniqueSessionId();
    const tracker = getSessionTracker(sessionId);
    tracker.pagesPerDomain.set('en.wikipedia.org', RATE_LIMITS.maxPagesPerDomain);

    const result = canVisitPage(sessionId, 'https://en.wikipedia.org/wiki/Another');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('rate_limit');
    expect(result.reason).toContain('en.wikipedia.org');
    cleanupSessionTracker(sessionId);
  });

  it('rejects invalid URLs in rate limit check', () => {
    const sessionId = uniqueSessionId();
    // Pass URL safety check but fail URL parsing in domain extraction
    // We need a URL that passes isUrlSafe but cannot be parsed by new URL()
    // Actually, if isUrlSafe can parse it, the domain check will also parse it.
    // So we test with an actually invalid URL - it'll fail in isUrlSafe first
    const result = canVisitPage(sessionId, 'not-a-url');
    expect(result.safe).toBe(false);
    cleanupSessionTracker(sessionId);
  });
});

describe('recordPageVisit', () => {
  it('increments total page count', () => {
    const sessionId = uniqueSessionId();
    recordPageVisit(sessionId, 'https://example.com/page1');
    const tracker = getSessionTracker(sessionId);
    expect(tracker.totalPages).toBe(1);
    cleanupSessionTracker(sessionId);
  });

  it('increments domain-specific page count', () => {
    const sessionId = uniqueSessionId();
    recordPageVisit(sessionId, 'https://example.com/page1');
    recordPageVisit(sessionId, 'https://example.com/page2');
    const tracker = getSessionTracker(sessionId);
    expect(tracker.pagesPerDomain.get('example.com')).toBe(2);
    cleanupSessionTracker(sessionId);
  });

  it('tracks multiple domains separately', () => {
    const sessionId = uniqueSessionId();
    recordPageVisit(sessionId, 'https://example.com/page1');
    recordPageVisit(sessionId, 'https://other.com/page1');
    const tracker = getSessionTracker(sessionId);
    expect(tracker.pagesPerDomain.get('example.com')).toBe(1);
    expect(tracker.pagesPerDomain.get('other.com')).toBe(1);
    cleanupSessionTracker(sessionId);
  });

  it('handles invalid URLs gracefully', () => {
    const sessionId = uniqueSessionId();
    // Should not throw
    recordPageVisit(sessionId, 'not-a-url');
    const tracker = getSessionTracker(sessionId);
    // totalPages still increments
    expect(tracker.totalPages).toBe(1);
    cleanupSessionTracker(sessionId);
  });
});

// =============================================================================
// canSubmitForm / recordFormSubmission
// =============================================================================

describe('canSubmitForm', () => {
  it('allows form submission under limit', () => {
    const sessionId = uniqueSessionId();
    const result = canSubmitForm(sessionId);
    expect(result.safe).toBe(true);
    cleanupSessionTracker(sessionId);
  });

  it('blocks form submission at limit', () => {
    const sessionId = uniqueSessionId();
    const tracker = getSessionTracker(sessionId);
    tracker.formSubmissions = RATE_LIMITS.maxFormSubmissions;

    const result = canSubmitForm(sessionId);
    expect(result.safe).toBe(false);
    expect(result.category).toBe('rate_limit');
    expect(result.reason).toContain('Max form submissions');
    cleanupSessionTracker(sessionId);
  });
});

describe('recordFormSubmission', () => {
  it('increments form submission count', () => {
    const sessionId = uniqueSessionId();
    recordFormSubmission(sessionId);
    const tracker = getSessionTracker(sessionId);
    expect(tracker.formSubmissions).toBe(1);
    cleanupSessionTracker(sessionId);
  });

  it('increments form submission count multiple times', () => {
    const sessionId = uniqueSessionId();
    recordFormSubmission(sessionId);
    recordFormSubmission(sessionId);
    recordFormSubmission(sessionId);
    const tracker = getSessionTracker(sessionId);
    expect(tracker.formSubmissions).toBe(3);
    cleanupSessionTracker(sessionId);
  });
});

// =============================================================================
// getBlockedAttempts
// =============================================================================

describe('getBlockedAttempts', () => {
  it('returns empty array for new session', () => {
    const sessionId = uniqueSessionId();
    const attempts = getBlockedAttempts(sessionId);
    expect(attempts).toEqual([]);
    // Note: getBlockedAttempts checks sessionTrackers directly without creating
  });

  it('returns blocked attempts after unsafe visit attempt', () => {
    const sessionId = uniqueSessionId();
    canVisitPage(sessionId, 'https://rt.com/news');
    canVisitPage(sessionId, 'https://pornhub.com/page');
    const attempts = getBlockedAttempts(sessionId);
    expect(attempts.length).toBe(2);
    expect(attempts[0].url).toBe('https://rt.com/news');
    expect(attempts[1].url).toBe('https://pornhub.com/page');
    cleanupSessionTracker(sessionId);
  });

  it('includes reason and timestamp', () => {
    const sessionId = uniqueSessionId();
    canVisitPage(sessionId, 'https://example.kp/page');
    const attempts = getBlockedAttempts(sessionId);
    expect(attempts[0].reason).toBeTruthy();
    expect(attempts[0].timestamp).toBeGreaterThan(0);
    cleanupSessionTracker(sessionId);
  });
});

// =============================================================================
// getSessionTracker / cleanupSessionTracker
// =============================================================================

describe('getSessionTracker', () => {
  it('creates a new tracker for unknown session', () => {
    const sessionId = uniqueSessionId();
    const tracker = getSessionTracker(sessionId);
    expect(tracker.totalPages).toBe(0);
    expect(tracker.formSubmissions).toBe(0);
    expect(tracker.screenshots).toBe(0);
    expect(tracker.downloads).toBe(0);
    expect(tracker.codeExecutions).toBe(0);
    expect(tracker.blockedAttempts).toEqual([]);
    expect(tracker.createdAt).toBeGreaterThan(0);
    expect(tracker.lastAccessedAt).toBeGreaterThan(0);
    cleanupSessionTracker(sessionId);
  });

  it('returns existing tracker for known session', () => {
    const sessionId = uniqueSessionId();
    const tracker1 = getSessionTracker(sessionId);
    tracker1.totalPages = 5;
    const tracker2 = getSessionTracker(sessionId);
    expect(tracker2.totalPages).toBe(5);
    cleanupSessionTracker(sessionId);
  });

  it('updates lastAccessedAt on each access', () => {
    const sessionId = uniqueSessionId();
    const tracker1 = getSessionTracker(sessionId);
    const firstAccess = tracker1.lastAccessedAt;
    // Small delay to ensure timestamp difference
    const tracker2 = getSessionTracker(sessionId);
    expect(tracker2.lastAccessedAt).toBeGreaterThanOrEqual(firstAccess);
    cleanupSessionTracker(sessionId);
  });
});

describe('cleanupSessionTracker', () => {
  it('removes session tracker data', () => {
    const sessionId = uniqueSessionId();
    getSessionTracker(sessionId);
    cleanupSessionTracker(sessionId);
    // getBlockedAttempts checks without creating, so returns []
    const attempts = getBlockedAttempts(sessionId);
    expect(attempts).toEqual([]);
  });

  it('does not throw for non-existent session', () => {
    expect(() => cleanupSessionTracker('nonexistent-session')).not.toThrow();
  });
});

// =============================================================================
// stopSessionCleanupInterval
// =============================================================================

describe('stopSessionCleanupInterval', () => {
  it('can be called without error even if interval is not running', () => {
    expect(() => stopSessionCleanupInterval()).not.toThrow();
  });

  it('can be called multiple times safely', () => {
    expect(() => {
      stopSessionCleanupInterval();
      stopSessionCleanupInterval();
    }).not.toThrow();
  });
});

// =============================================================================
// logRiskyAction
// =============================================================================

describe('logRiskyAction', () => {
  it('logs a warning with session and action details', () => {
    logRiskyAction('session-1', 'click-suspicious-link', { url: 'https://example.com' });
    expect(mockWarn).toHaveBeenCalledWith(
      'Risky browser action',
      expect.objectContaining({
        sessionId: 'session-1',
        action: 'click-suspicious-link',
        url: 'https://example.com',
        timestamp: expect.any(String),
      })
    );
  });

  it('includes all provided details', () => {
    logRiskyAction('session-2', 'form-submit', { form: 'contact', page: '/contact' });
    expect(mockWarn).toHaveBeenCalledWith(
      'Risky browser action',
      expect.objectContaining({
        sessionId: 'session-2',
        action: 'form-submit',
        form: 'contact',
        page: '/contact',
      })
    );
  });
});

// =============================================================================
// logBlockedAction
// =============================================================================

describe('logBlockedAction', () => {
  it('logs an error with full safety check result', () => {
    const result = {
      safe: false,
      reason: 'Blocked domain',
      severity: 'critical' as const,
      category: 'adult_content',
    };
    logBlockedAction('session-1', 'visit-page', result, { url: 'https://blocked.com' });
    expect(mockError).toHaveBeenCalledWith(
      'BLOCKED browser action',
      expect.objectContaining({
        sessionId: 'session-1',
        action: 'visit-page',
        reason: 'Blocked domain',
        severity: 'critical',
        category: 'adult_content',
        url: 'https://blocked.com',
        timestamp: expect.any(String),
      })
    );
  });

  it('handles result with undefined fields', () => {
    const result = { safe: false };
    logBlockedAction('session-2', 'click', result, {});
    expect(mockError).toHaveBeenCalledWith(
      'BLOCKED browser action',
      expect.objectContaining({
        sessionId: 'session-2',
        action: 'click',
        reason: undefined,
        severity: undefined,
        category: undefined,
      })
    );
  });
});

// =============================================================================
// getCondensedSafetyPrompt
// =============================================================================

describe('getCondensedSafetyPrompt', () => {
  it('returns a non-empty string', () => {
    const prompt = getCondensedSafetyPrompt();
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('mentions key safety concepts', () => {
    const prompt = getCondensedSafetyPrompt();
    expect(prompt).toContain('.gov');
    expect(prompt).toContain('.mil');
    expect(prompt).toContain('adult');
    expect(prompt).toContain('password');
    expect(prompt).toContain('.onion');
  });
});

// =============================================================================
// Exported constants validation
// =============================================================================

describe('exported constants', () => {
  it('BLOCKED_TLDS contains expected TLDs', () => {
    expect(BLOCKED_TLDS).toContain('.gov');
    expect(BLOCKED_TLDS).toContain('.mil');
    expect(BLOCKED_TLDS).toContain('.kp');
    expect(BLOCKED_TLDS).toContain('.ir');
    expect(BLOCKED_TLDS).toContain('.ru');
  });

  it('BLOCKED_DOMAINS contains expected domains', () => {
    expect(BLOCKED_DOMAINS).toContain('rt.com');
    expect(BLOCKED_DOMAINS).toContain('pornhub.com');
    expect(BLOCKED_DOMAINS).toContain('4chan.org');
    expect(BLOCKED_DOMAINS).toContain('bit.ly');
  });

  it('BLOCKED_URL_PATTERNS is an array of RegExp', () => {
    expect(BLOCKED_URL_PATTERNS.length).toBeGreaterThan(0);
    for (const pat of BLOCKED_URL_PATTERNS) {
      expect(pat).toBeInstanceOf(RegExp);
    }
  });

  it('ADULT_KEYWORDS contains expected keywords', () => {
    expect(ADULT_KEYWORDS).toContain('porn');
    expect(ADULT_KEYWORDS).toContain('nsfw');
    expect(ADULT_KEYWORDS).toContain('hentai');
  });

  it('BLOCKED_FORM_ACTIONS contains expected actions', () => {
    expect(BLOCKED_FORM_ACTIONS).toContain('checkout');
    expect(BLOCKED_FORM_ACTIONS).toContain('login');
    expect(BLOCKED_FORM_ACTIONS).toContain('delete');
  });

  it('ALLOWED_FORM_TYPES contains expected types', () => {
    expect(ALLOWED_FORM_TYPES).toContain('search');
    expect(ALLOWED_FORM_TYPES).toContain('filter');
    expect(ALLOWED_FORM_TYPES).toContain('quote');
  });

  it('BLOCKED_INPUT_TYPES contains expected types', () => {
    expect(BLOCKED_INPUT_TYPES).toContain('password');
    expect(BLOCKED_INPUT_TYPES).toContain('credit-card');
    expect(BLOCKED_INPUT_TYPES).toContain('ssn');
  });

  it('BLOCKED_INPUT_PATTERNS is an array of RegExp', () => {
    expect(BLOCKED_INPUT_PATTERNS.length).toBeGreaterThan(0);
    for (const pat of BLOCKED_INPUT_PATTERNS) {
      expect(pat).toBeInstanceOf(RegExp);
    }
  });

  it('RATE_LIMITS has expected fields', () => {
    expect(RATE_LIMITS.maxPagesPerDomain).toBe(20);
    expect(RATE_LIMITS.maxFormSubmissions).toBe(5);
    expect(RATE_LIMITS.maxClicksPerPage).toBe(10);
    expect(RATE_LIMITS.actionDelayMs).toBe(500);
    expect(RATE_LIMITS.maxTotalPages).toBe(100);
    expect(RATE_LIMITS.maxScreenshots).toBe(50);
    expect(RATE_LIMITS.maxDownloads).toBe(10);
    expect(RATE_LIMITS.maxCodeExecutions).toBe(50);
  });

  it('TRUSTED_DOMAINS contains expected domains', () => {
    expect(TRUSTED_DOMAINS).toContain('zillow.com');
    expect(TRUSTED_DOMAINS).toContain('wikipedia.org');
    expect(TRUSTED_DOMAINS).toContain('github.com');
    expect(TRUSTED_DOMAINS).toContain('amazon.com');
  });

  it('CONTENT_WARNING_KEYWORDS contains expected keywords', () => {
    expect(CONTENT_WARNING_KEYWORDS).toContain('terrorism');
    expect(CONTENT_WARNING_KEYWORDS).toContain('cocaine');
    expect(CONTENT_WARNING_KEYWORDS).toContain('malware');
    expect(CONTENT_WARNING_KEYWORDS).toContain('suicide');
  });

  it('AI_SAFETY_PROMPT is a non-empty string', () => {
    expect(AI_SAFETY_PROMPT.length).toBeGreaterThan(100);
    expect(AI_SAFETY_PROMPT).toContain('CRITICAL SAFETY GUIDELINES');
  });
});
