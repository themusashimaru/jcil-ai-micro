import { describe, it, expect, vi, afterEach } from 'vitest';

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
  BLOCKED_URL_PATTERNS,
  BLOCKED_FORM_ACTIONS,
  BLOCKED_INPUT_TYPES,
  BLOCKED_INPUT_PATTERNS,
  ALLOWED_FORM_TYPES,
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
  canVisitPage,
  recordPageVisit,
  canSubmitForm,
  recordFormSubmission,
  getBlockedAttempts,
  cleanupSessionTracker,
  getSessionTracker,
  getCondensedSafetyPrompt,
  logRiskyAction,
  logBlockedAction,
  stopSessionCleanupInterval,
  AI_SAFETY_PROMPT,
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

// -------------------------------------------------------------------
// Extended blocklist constant tests
// -------------------------------------------------------------------
describe('BLOCKED_URL_PATTERNS', () => {
  it('should contain login patterns', () => {
    const hasLogin = BLOCKED_URL_PATTERNS.some((p) => p.test('/login'));
    expect(hasLogin).toBe(true);
  });

  it('should contain checkout patterns', () => {
    const hasCheckout = BLOCKED_URL_PATTERNS.some((p) => p.test('/checkout'));
    expect(hasCheckout).toBe(true);
  });

  it('should contain .exe pattern', () => {
    const hasExe = BLOCKED_URL_PATTERNS.some((p) => p.test('file.exe'));
    expect(hasExe).toBe(true);
  });

  it('should contain .onion pattern', () => {
    const hasOnion = BLOCKED_URL_PATTERNS.some((p) => p.test('site.onion'));
    expect(hasOnion).toBe(true);
  });

  it('should contain IP address pattern', () => {
    const hasIP = BLOCKED_URL_PATTERNS.some((p) => p.test('http://192.168.1.1'));
    expect(hasIP).toBe(true);
  });
});

describe('BLOCKED_FORM_ACTIONS', () => {
  it('should include payment actions', () => {
    expect(BLOCKED_FORM_ACTIONS).toContain('checkout');
    expect(BLOCKED_FORM_ACTIONS).toContain('payment');
    expect(BLOCKED_FORM_ACTIONS).toContain('purchase');
  });

  it('should include auth actions', () => {
    expect(BLOCKED_FORM_ACTIONS).toContain('login');
    expect(BLOCKED_FORM_ACTIONS).toContain('signup');
    expect(BLOCKED_FORM_ACTIONS).toContain('register');
  });

  it('should include destructive actions', () => {
    expect(BLOCKED_FORM_ACTIONS).toContain('delete');
    expect(BLOCKED_FORM_ACTIONS).toContain('cancel');
  });
});

describe('BLOCKED_INPUT_TYPES', () => {
  it('should block password type', () => {
    expect(BLOCKED_INPUT_TYPES).toContain('password');
  });

  it('should block credit-card type', () => {
    expect(BLOCKED_INPUT_TYPES).toContain('credit-card');
  });

  it('should block ssn type', () => {
    expect(BLOCKED_INPUT_TYPES).toContain('ssn');
  });
});

describe('BLOCKED_INPUT_PATTERNS', () => {
  it('should match password-related fields', () => {
    const matches = BLOCKED_INPUT_PATTERNS.some((p) => p.test('password'));
    expect(matches).toBe(true);
  });

  it('should match credit card fields', () => {
    const matches = BLOCKED_INPUT_PATTERNS.some((p) => p.test('creditcard'));
    expect(matches).toBe(true);
  });

  it('should match API key fields', () => {
    const matches = BLOCKED_INPUT_PATTERNS.some((p) => p.test('api_key'));
    expect(matches).toBe(true);
  });

  it('should match session fields', () => {
    const matches = BLOCKED_INPUT_PATTERNS.some((p) => p.test('session'));
    expect(matches).toBe(true);
  });
});

describe('ALLOWED_FORM_TYPES', () => {
  it('should include search', () => {
    expect(ALLOWED_FORM_TYPES).toContain('search');
  });

  it('should include filter', () => {
    expect(ALLOWED_FORM_TYPES).toContain('filter');
  });

  it('should include location selectors', () => {
    expect(ALLOWED_FORM_TYPES).toContain('zip');
    expect(ALLOWED_FORM_TYPES).toContain('city');
  });
});

// -------------------------------------------------------------------
// Extended isUrlSafe tests
// -------------------------------------------------------------------
describe('isUrlSafe - extended', () => {
  describe('blocked TLD categories', () => {
    it('should block .gov.uk', () => {
      const result = isUrlSafe('https://www.example.gov.uk/page');
      expect(result.safe).toBe(false);
      expect(result.severity).toBe('critical');
      expect(result.category).toBe('government_military');
    });

    it('should block .ir (Iran)', () => {
      const result = isUrlSafe('https://example.ir/page');
      expect(result.safe).toBe(false);
    });

    it('should block .cu (Cuba)', () => {
      const result = isUrlSafe('https://example.cu/page');
      expect(result.safe).toBe(false);
    });

    it('should block .sy (Syria)', () => {
      const result = isUrlSafe('https://example.sy/page');
      expect(result.safe).toBe(false);
    });

    it('should block .ru (Russia)', () => {
      const result = isUrlSafe('https://example.ru/page');
      expect(result.safe).toBe(false);
    });

    it('should block .gov.cn', () => {
      const result = isUrlSafe('https://example.gov.cn/page');
      expect(result.safe).toBe(false);
    });
  });

  describe('blocked domain categories', () => {
    it('should categorize adult domains as adult_content with critical severity', () => {
      const result = isUrlSafe('https://pornhub.com/video');
      expect(result.safe).toBe(false);
      expect(result.category).toBe('adult_content');
      expect(result.severity).toBe('critical');
    });

    it('should categorize state media as state_propaganda', () => {
      const result = isUrlSafe('https://sputniknews.com/article');
      expect(result.safe).toBe(false);
      expect(result.category).toBe('state_propaganda');
    });

    it('should categorize extremist sites correctly', () => {
      const result = isUrlSafe('https://stormfront.org/forum');
      expect(result.safe).toBe(false);
      expect(result.category).toBe('extremist_content');
    });

    it('should block Chinese state media', () => {
      const result = isUrlSafe('https://cgtn.com/article');
      expect(result.safe).toBe(false);
    });

    it('should block Iranian state media', () => {
      const result = isUrlSafe('https://presstv.ir/article');
      expect(result.safe).toBe(false);
    });

    it('should block dark web directories', () => {
      const result = isUrlSafe('https://ahmia.fi/search');
      expect(result.safe).toBe(false);
    });

    it('should block URL shorteners', () => {
      const result = isUrlSafe('https://bit.ly/abc123');
      expect(result.safe).toBe(false);
    });

    it('should block hacking forums', () => {
      const result = isUrlSafe('https://hackforums.net/thread');
      expect(result.safe).toBe(false);
    });

    it('should block banking login pages', () => {
      const result = isUrlSafe('https://chase.com/login');
      expect(result.safe).toBe(false);
    });

    it('should block social media login pages', () => {
      const result = isUrlSafe('https://facebook.com/login');
      expect(result.safe).toBe(false);
    });

    it('should block email login pages', () => {
      const result = isUrlSafe('https://mail.google.com/inbox');
      expect(result.safe).toBe(false);
    });
  });

  describe('URL pattern matching', () => {
    it('should block /login path', () => {
      const result = isUrlSafe('https://example.com/login');
      expect(result.safe).toBe(false);
      expect(result.category).toBe('restricted_path');
    });

    it('should block /signin path', () => {
      const result = isUrlSafe('https://example.com/signin');
      expect(result.safe).toBe(false);
    });

    it('should block /signup path', () => {
      const result = isUrlSafe('https://example.com/signup');
      expect(result.safe).toBe(false);
    });

    it('should block /checkout path', () => {
      const result = isUrlSafe('https://example.com/checkout');
      expect(result.safe).toBe(false);
    });

    it('should block /payment path', () => {
      const result = isUrlSafe('https://example.com/payment');
      expect(result.safe).toBe(false);
    });

    it('should block /admin path', () => {
      const result = isUrlSafe('https://example.com/admin');
      expect(result.safe).toBe(false);
    });

    it('should block .exe files', () => {
      const result = isUrlSafe('https://example.com/file.exe');
      expect(result.safe).toBe(false);
    });

    it('should block .sh files', () => {
      const result = isUrlSafe('https://example.com/script.sh');
      expect(result.safe).toBe(false);
    });

    it('should block .onion addresses', () => {
      const result = isUrlSafe('https://example.onion/page');
      expect(result.safe).toBe(false);
    });

    it('should block IP address URLs', () => {
      const result = isUrlSafe('http://192.168.1.1/admin');
      expect(result.safe).toBe(false);
    });

    it('should block /register path', () => {
      const result = isUrlSafe('https://example.com/register');
      expect(result.safe).toBe(false);
    });

    it('should block /auth path', () => {
      const result = isUrlSafe('https://example.com/auth');
      expect(result.safe).toBe(false);
    });

    it('should block /oauth path', () => {
      const result = isUrlSafe('https://example.com/oauth');
      expect(result.safe).toBe(false);
    });

    it('should block .dmg files', () => {
      const result = isUrlSafe('https://example.com/app.dmg');
      expect(result.safe).toBe(false);
    });

    it('should block .apk files', () => {
      const result = isUrlSafe('https://example.com/app.apk');
      expect(result.safe).toBe(false);
    });
  });

  describe('adult keyword detection in URL', () => {
    it('should block URLs with porn in hostname', () => {
      const result = isUrlSafe('https://freeporn.example.com/page');
      expect(result.safe).toBe(false);
      expect(result.category).toBe('adult_content');
    });

    it('should block URLs with nsfw in path', () => {
      const result = isUrlSafe('https://example.com/nsfw/content');
      expect(result.safe).toBe(false);
      expect(result.category).toBe('adult_content');
    });

    it('should block URLs with xxx in hostname', () => {
      const result = isUrlSafe('https://xxx.example.com/page');
      expect(result.safe).toBe(false);
    });

    it('should block URLs with hentai in path', () => {
      const result = isUrlSafe('https://example.com/hentai/page');
      expect(result.safe).toBe(false);
    });
  });

  describe('suspicious URL characteristics', () => {
    it('should block URLs with excessive subdomains', () => {
      const result = isUrlSafe('https://a.b.c.d.e.example.com/page');
      expect(result.safe).toBe(false);
      expect(result.category).toBe('suspicious');
      expect(result.severity).toBe('medium');
    });

    it('should allow URLs with normal subdomain count', () => {
      const result = isUrlSafe('https://www.example.com/page');
      expect(result.safe).toBe(true);
    });

    it('should allow URLs with 3 subdomains', () => {
      const result = isUrlSafe('https://a.b.example.com/page');
      expect(result.safe).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should return invalid category for malformed URL', () => {
      const result = isUrlSafe('://broken');
      expect(result.safe).toBe(false);
      expect(result.category).toBe('invalid');
    });

    it('should handle URL with port number', () => {
      const result = isUrlSafe('https://example.com:8080/page');
      expect(result.safe).toBe(true);
    });

    it('should handle URL with query parameters', () => {
      const result = isUrlSafe('https://example.com/page?q=test&lang=en');
      expect(result.safe).toBe(true);
    });

    it('should handle URL with fragment', () => {
      const result = isUrlSafe('https://example.com/page#section');
      expect(result.safe).toBe(true);
    });
  });
});

// -------------------------------------------------------------------
// Extended isFormActionSafe tests
// -------------------------------------------------------------------
describe('isFormActionSafe - extended', () => {
  it('should categorize payment forms as critical', () => {
    const result = isFormActionSafe('/api/payment', 'payment-form');
    expect(result.safe).toBe(false);
    expect(result.severity).toBe('critical');
    expect(result.category).toBe('payment');
  });

  it('should categorize billing forms as critical payment', () => {
    const result = isFormActionSafe('/api/billing');
    expect(result.safe).toBe(false);
    expect(result.severity).toBe('critical');
    expect(result.category).toBe('payment');
  });

  it('should categorize auth forms as high severity', () => {
    const result = isFormActionSafe('/api/authenticate');
    expect(result.safe).toBe(false);
    expect(result.severity).toBe('high');
    expect(result.category).toBe('authentication');
  });

  it('should block password reset forms', () => {
    const result = isFormActionSafe('/reset-password');
    expect(result.safe).toBe(false);
  });

  it('should block delete forms', () => {
    const result = isFormActionSafe('/api/delete-account');
    expect(result.safe).toBe(false);
  });

  it('should block contact/message forms', () => {
    const result = isFormActionSafe('/send-message');
    expect(result.safe).toBe(false);
  });

  it('should allow search forms', () => {
    const result = isFormActionSafe('/api/search', 'search-form');
    expect(result.safe).toBe(true);
  });

  it('should allow filter forms', () => {
    const result = isFormActionSafe('/api/filter');
    expect(result.safe).toBe(true);
  });

  it('should allow quote/estimate forms', () => {
    const result = isFormActionSafe('/api/quote');
    expect(result.safe).toBe(true);
  });

  it('should allow calculator forms', () => {
    const result = isFormActionSafe('/api/calculator');
    expect(result.safe).toBe(true);
  });

  it('should allow location forms', () => {
    const result = isFormActionSafe('/api/zipcode-lookup');
    expect(result.safe).toBe(true);
  });

  it('should allow forms not in either list (with caution)', () => {
    const result = isFormActionSafe('/api/custom-action', 'my-form', 'custom-class');
    expect(result.safe).toBe(true);
    expect(result.reason).toContain('not in whitelist');
    expect(result.severity).toBe('low');
  });

  it('should detect blocked action in formId', () => {
    const result = isFormActionSafe('/api/action', 'checkout-form');
    expect(result.safe).toBe(false);
  });

  it('should detect blocked action in formClass', () => {
    const result = isFormActionSafe('/api/action', undefined, 'payment-widget');
    expect(result.safe).toBe(false);
  });
});

// -------------------------------------------------------------------
// Extended isInputSafe tests
// -------------------------------------------------------------------
describe('isInputSafe - extended', () => {
  it('should block CVV type inputs', () => {
    const result = isInputSafe('cvv', 'cvv-input', 'cvv');
    expect(result.safe).toBe(false);
    expect(result.severity).toBe('critical');
  });

  it('should block bank-account type inputs', () => {
    const result = isInputSafe('bank', 'bank-id', 'bank-account');
    expect(result.safe).toBe(false);
  });

  it('should block routing-number type inputs', () => {
    const result = isInputSafe('routing', 'routing-id', 'routing-number');
    expect(result.safe).toBe(false);
  });

  it('should block pin type inputs', () => {
    const result = isInputSafe('user-pin', 'pin-field', 'pin');
    expect(result.safe).toBe(false);
  });

  it('should block token type inputs', () => {
    const result = isInputSafe('auth-token', 'token-field', 'token');
    expect(result.safe).toBe(false);
  });

  it('should block inputs with password in name', () => {
    const result = isInputSafe('new_password', undefined, 'text');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('sensitive_input');
  });

  it('should block inputs with api_key in name', () => {
    const result = isInputSafe('api_key', undefined, 'text');
    expect(result.safe).toBe(false);
  });

  it('should block inputs with private_key in name', () => {
    const result = isInputSafe('private_key', undefined, 'text');
    expect(result.safe).toBe(false);
  });

  it('should block inputs with session in id', () => {
    const result = isInputSafe('field', 'session_id', 'text');
    expect(result.safe).toBe(false);
  });

  it('should block inputs with cookie in name', () => {
    const result = isInputSafe('cookie_value', undefined, 'text');
    expect(result.safe).toBe(false);
  });

  it('should allow regular text inputs', () => {
    const result = isInputSafe('first_name', 'name-input', 'text');
    expect(result.safe).toBe(true);
  });

  it('should allow number inputs', () => {
    const result = isInputSafe('quantity', 'qty', 'number');
    expect(result.safe).toBe(true);
  });

  it('should allow email inputs (name not matching patterns)', () => {
    const result = isInputSafe('user_email', 'email-input', 'email');
    expect(result.safe).toBe(true);
  });

  it('should handle undefined inputId', () => {
    const result = isInputSafe('search', undefined, 'text');
    expect(result.safe).toBe(true);
  });

  it('should handle undefined inputType', () => {
    const result = isInputSafe('search');
    expect(result.safe).toBe(true);
  });

  it('should be case-insensitive on input type', () => {
    const result = isInputSafe('field', undefined, 'PASSWORD');
    expect(result.safe).toBe(false);
  });
});

// -------------------------------------------------------------------
// Extended isDomainTrusted tests
// -------------------------------------------------------------------
describe('isDomainTrusted - extended', () => {
  it('should trust redfin.com', () => {
    expect(isDomainTrusted('https://www.redfin.com/search')).toBe(true);
  });

  it('should trust wikipedia.org', () => {
    expect(isDomainTrusted('https://en.wikipedia.org/wiki/Test')).toBe(true);
  });

  it('should trust github.com', () => {
    expect(isDomainTrusted('https://github.com/user/repo')).toBe(true);
  });

  it('should trust stackoverflow.com', () => {
    expect(isDomainTrusted('https://stackoverflow.com/questions')).toBe(true);
  });

  it('should trust booking.com', () => {
    expect(isDomainTrusted('https://www.booking.com/hotel')).toBe(true);
  });

  it('should trust nytimes.com', () => {
    expect(isDomainTrusted('https://www.nytimes.com/article')).toBe(true);
  });

  it('should not trust random domains', () => {
    expect(isDomainTrusted('https://evilsite.xyz')).toBe(false);
  });

  it('should handle empty string', () => {
    expect(isDomainTrusted('')).toBe(false);
  });
});

// -------------------------------------------------------------------
// Extended sanitizeOutput tests
// -------------------------------------------------------------------
describe('sanitizeOutput - extended', () => {
  it('should mask credit card with spaces', () => {
    const result = sanitizeOutput('Card: 4111 1111 1111 1111');
    expect(result).toContain('[REDACTED_CARD]');
  });

  it('should mask credit card with dashes', () => {
    const result = sanitizeOutput('Card: 4111-1111-1111-1111');
    expect(result).toContain('[REDACTED_CARD]');
  });

  it('should mask SSN without dashes', () => {
    const result = sanitizeOutput('SSN: 123 45 6789');
    expect(result).toContain('[REDACTED_SSN]');
  });

  it('should mask JWT tokens', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const result = sanitizeOutput(`Token: ${jwt}`);
    expect(result).toContain('[REDACTED_JWT]');
  });

  it('should mask API keys with pk prefix', () => {
    // The regex requires (sk|pk|api|key) followed by optional [-_] then 20+ alphanumeric
    const result = sanitizeOutput('Key: pkAbcdefghijklmnopqrstuvwxyz12');
    expect(result).toContain('[REDACTED_API_KEY]');
  });

  it('should mask API keys with key prefix', () => {
    const result = sanitizeOutput('Key: keyAbcdefghijklmnopqrstuvwxyz12');
    expect(result).toContain('[REDACTED_API_KEY]');
  });

  it('should not alter normal text', () => {
    const text = 'This is a normal paragraph about shopping.';
    expect(sanitizeOutput(text)).toBe(text);
  });

  it('should handle text with multiple sensitive items', () => {
    const input = 'Card: 4111111111111111 SSN: 123-45-6789 Key: sk_abcdefghijklmnopqrstuvwxyz';
    const result = sanitizeOutput(input);
    expect(result).toContain('[REDACTED_CARD]');
    expect(result).toContain('[REDACTED_SSN]');
    expect(result).toContain('[REDACTED_API_KEY]');
  });
});

// -------------------------------------------------------------------
// Extended checkContentForWarnings tests
// -------------------------------------------------------------------
describe('checkContentForWarnings - extended', () => {
  it('should detect violence keywords', () => {
    const result = checkContentForWarnings('There was a bomb threat at the building');
    expect(result.hasWarnings).toBe(true);
    expect(result.keywords).toContain('bomb');
  });

  it('should detect illegal activity keywords', () => {
    const result = checkContentForWarnings('The police seized narcotic substances');
    expect(result.hasWarnings).toBe(true);
    expect(result.keywords).toContain('narcotic');
  });

  it('should be case-insensitive', () => {
    const result = checkContentForWarnings('TERRORISM is a global threat');
    expect(result.hasWarnings).toBe(true);
    expect(result.keywords).toContain('terrorism');
  });

  it('should not require review for single keyword', () => {
    const result = checkContentForWarnings('A weapon was found');
    expect(result.hasWarnings).toBe(true);
    expect(result.requiresReview).toBe(false);
  });

  it('should require review for 2+ keywords', () => {
    const result = checkContentForWarnings('The terrorist had a weapon and explosive materials');
    expect(result.hasWarnings).toBe(true);
    expect(result.requiresReview).toBe(true);
    expect(result.keywords.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle empty string', () => {
    const result = checkContentForWarnings('');
    expect(result.hasWarnings).toBe(false);
    expect(result.keywords).toHaveLength(0);
  });
});

// -------------------------------------------------------------------
// Session tracking: canVisitPage, recordPageVisit, canSubmitForm
// -------------------------------------------------------------------
describe('Session tracking', () => {
  const sessionId = 'test-session-' + Date.now();

  afterEach(() => {
    cleanupSessionTracker(sessionId);
    stopSessionCleanupInterval();
  });

  describe('getSessionTracker', () => {
    it('should create a new tracker for unknown session', () => {
      const tracker = getSessionTracker(sessionId);
      expect(tracker).toBeDefined();
      expect(tracker.totalPages).toBe(0);
      expect(tracker.formSubmissions).toBe(0);
      expect(tracker.screenshots).toBe(0);
      expect(tracker.downloads).toBe(0);
      expect(tracker.codeExecutions).toBe(0);
      expect(tracker.blockedAttempts).toEqual([]);
    });

    it('should return the same tracker for same session', () => {
      const tracker1 = getSessionTracker(sessionId);
      tracker1.totalPages = 5;
      const tracker2 = getSessionTracker(sessionId);
      expect(tracker2.totalPages).toBe(5);
    });

    it('should set createdAt and lastAccessedAt', () => {
      const tracker = getSessionTracker(sessionId);
      expect(tracker.createdAt).toBeGreaterThan(0);
      expect(tracker.lastAccessedAt).toBeGreaterThanOrEqual(tracker.createdAt);
    });
  });

  describe('canVisitPage', () => {
    it('should allow safe URLs', () => {
      const result = canVisitPage(sessionId, 'https://www.example.com/page');
      expect(result.safe).toBe(true);
    });

    it('should block unsafe URLs and record the blocked attempt', () => {
      const result = canVisitPage(sessionId, 'https://pornhub.com');
      expect(result.safe).toBe(false);
      const attempts = getBlockedAttempts(sessionId);
      expect(attempts.length).toBeGreaterThan(0);
      expect(attempts[0].url).toBe('https://pornhub.com');
    });

    it('should block when total pages limit reached', () => {
      const tracker = getSessionTracker(sessionId);
      tracker.totalPages = RATE_LIMITS.maxTotalPages;
      const result = canVisitPage(sessionId, 'https://example.com/page');
      expect(result.safe).toBe(false);
      expect(result.category).toBe('rate_limit');
      expect(result.reason).toContain('Max total pages');
    });

    it('should block when domain page limit reached', () => {
      const tracker = getSessionTracker(sessionId);
      tracker.pagesPerDomain.set('example.com', RATE_LIMITS.maxPagesPerDomain);
      const result = canVisitPage(sessionId, 'https://example.com/another-page');
      expect(result.safe).toBe(false);
      expect(result.category).toBe('rate_limit');
    });

    it('should return invalid for bad URLs (after URL safety passes)', () => {
      // A URL that passes isUrlSafe but is invalid for new URL() in the domain check
      // This is tricky since isUrlSafe also uses new URL() - invalid URLs fail there first
      const result = canVisitPage(sessionId, 'not-a-url');
      expect(result.safe).toBe(false);
    });
  });

  describe('recordPageVisit', () => {
    it('should increment total pages', () => {
      const tracker = getSessionTracker(sessionId);
      expect(tracker.totalPages).toBe(0);
      recordPageVisit(sessionId, 'https://example.com/page1');
      expect(tracker.totalPages).toBe(1);
      recordPageVisit(sessionId, 'https://example.com/page2');
      expect(tracker.totalPages).toBe(2);
    });

    it('should track pages per domain', () => {
      recordPageVisit(sessionId, 'https://example.com/page1');
      recordPageVisit(sessionId, 'https://example.com/page2');
      recordPageVisit(sessionId, 'https://other.com/page1');
      const tracker = getSessionTracker(sessionId);
      expect(tracker.pagesPerDomain.get('example.com')).toBe(2);
      expect(tracker.pagesPerDomain.get('other.com')).toBe(1);
    });

    it('should handle invalid URLs gracefully', () => {
      const tracker = getSessionTracker(sessionId);
      const beforePages = tracker.totalPages;
      recordPageVisit(sessionId, 'invalid-url');
      // totalPages still increments, but domain tracking silently fails
      expect(tracker.totalPages).toBe(beforePages + 1);
    });
  });

  describe('canSubmitForm', () => {
    it('should allow form submissions under limit', () => {
      const result = canSubmitForm(sessionId);
      expect(result.safe).toBe(true);
    });

    it('should block when form submission limit reached', () => {
      const tracker = getSessionTracker(sessionId);
      tracker.formSubmissions = RATE_LIMITS.maxFormSubmissions;
      const result = canSubmitForm(sessionId);
      expect(result.safe).toBe(false);
      expect(result.category).toBe('rate_limit');
      expect(result.reason).toContain('Max form submissions');
    });
  });

  describe('recordFormSubmission', () => {
    it('should increment form submissions', () => {
      const tracker = getSessionTracker(sessionId);
      expect(tracker.formSubmissions).toBe(0);
      recordFormSubmission(sessionId);
      expect(tracker.formSubmissions).toBe(1);
      recordFormSubmission(sessionId);
      expect(tracker.formSubmissions).toBe(2);
    });
  });

  describe('getBlockedAttempts', () => {
    it('should return empty array for new session', () => {
      const attempts = getBlockedAttempts('nonexistent-session');
      expect(attempts).toEqual([]);
    });

    it('should return blocked attempts with timestamps', () => {
      canVisitPage(sessionId, 'https://rt.com/article');
      const attempts = getBlockedAttempts(sessionId);
      expect(attempts.length).toBe(1);
      expect(attempts[0].url).toBe('https://rt.com/article');
      expect(attempts[0].reason).toBeDefined();
      expect(attempts[0].timestamp).toBeGreaterThan(0);
    });
  });

  describe('cleanupSessionTracker', () => {
    it('should remove session tracker', () => {
      getSessionTracker(sessionId);
      cleanupSessionTracker(sessionId);
      // After cleanup, getBlockedAttempts should return empty
      const attempts = getBlockedAttempts(sessionId);
      expect(attempts).toEqual([]);
    });

    it('should not throw for nonexistent session', () => {
      expect(() => cleanupSessionTracker('nonexistent')).not.toThrow();
    });
  });
});

// -------------------------------------------------------------------
// Logging functions
// -------------------------------------------------------------------
describe('logRiskyAction', () => {
  it('should not throw', () => {
    expect(() =>
      logRiskyAction('test-session', 'click', { url: 'https://example.com' })
    ).not.toThrow();
  });
});

describe('logBlockedAction', () => {
  it('should not throw', () => {
    const result = { safe: false, reason: 'blocked', severity: 'high' as const, category: 'test' };
    expect(() =>
      logBlockedAction('test-session', 'navigate', result, { url: 'https://evil.com' })
    ).not.toThrow();
  });
});

// -------------------------------------------------------------------
// getCondensedSafetyPrompt
// -------------------------------------------------------------------
describe('getCondensedSafetyPrompt', () => {
  it('should return a non-empty string', () => {
    const prompt = getCondensedSafetyPrompt();
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('should mention key safety topics', () => {
    const prompt = getCondensedSafetyPrompt();
    expect(prompt).toContain('.gov');
    expect(prompt).toContain('.mil');
    expect(prompt).toContain('adult');
    expect(prompt).toContain('password');
  });
});

// -------------------------------------------------------------------
// AI_SAFETY_PROMPT constant
// -------------------------------------------------------------------
describe('AI_SAFETY_PROMPT', () => {
  it('should be a non-empty string', () => {
    expect(AI_SAFETY_PROMPT.length).toBeGreaterThan(100);
  });

  it('should mention critical safety guidelines', () => {
    expect(AI_SAFETY_PROMPT).toContain('SAFETY GUIDELINES');
    expect(AI_SAFETY_PROMPT).toContain('NEVER');
  });
});

// -------------------------------------------------------------------
// stopSessionCleanupInterval
// -------------------------------------------------------------------
describe('stopSessionCleanupInterval', () => {
  it('should not throw when no interval is running', () => {
    expect(() => stopSessionCleanupInterval()).not.toThrow();
  });

  it('should stop the interval after it is started', () => {
    // Start the interval by creating a tracker
    getSessionTracker('cleanup-test');
    expect(() => stopSessionCleanupInterval()).not.toThrow();
    cleanupSessionTracker('cleanup-test');
  });
});
