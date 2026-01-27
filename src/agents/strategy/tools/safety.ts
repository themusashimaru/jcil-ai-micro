/**
 * BROWSER SAFETY FRAMEWORK
 *
 * Safety measures for browser automation to prevent:
 * - Unauthorized form submissions
 * - Accessing restricted content
 * - Creating unwanted accounts or commitments
 * - Exposing sensitive data
 */

import { logger } from '@/lib/logger';

const log = logger('BrowserSafety');

// =============================================================================
// DOMAIN RESTRICTIONS
// =============================================================================

/**
 * Domains that should NEVER be visited
 */
export const BLOCKED_DOMAINS = [
  // Government & Military
  '.gov',
  '.mil',
  '.gov.uk',
  '.gov.au',
  '.gc.ca',

  // Adult content (partial list)
  'pornhub.com',
  'xvideos.com',
  'xhamster.com',

  // State media / propaganda
  'rt.com',
  'sputniknews.com',
  'xinhuanet.com',
  'globaltimes.cn',

  // Banking (never automate banking)
  'chase.com/login',
  'bankofamerica.com/login',
  'wellsfargo.com/login',

  // Social media login/account pages
  'facebook.com/login',
  'instagram.com/accounts',
  'twitter.com/login',
  'x.com/login',
];

/**
 * Domains that are safe for deeper interaction (forms, etc.)
 */
export const TRUSTED_DOMAINS = [
  // Real estate
  'zillow.com',
  'redfin.com',
  'realtor.com',
  'trulia.com',
  'apartments.com',
  'streeteasy.com',

  // Jobs
  'linkedin.com/jobs',
  'indeed.com',
  'glassdoor.com',

  // E-commerce (for price research)
  'amazon.com',
  'ebay.com',
  'walmart.com',
  'target.com',
  'bestbuy.com',

  // Travel
  'kayak.com',
  'expedia.com',
  'google.com/flights',
  'google.com/travel',

  // Business info
  'yelp.com',
  'google.com/maps',
  'crunchbase.com',

  // General research
  'wikipedia.org',
  'github.com',
];

// =============================================================================
// FORM SAFETY
// =============================================================================

/**
 * Form actions that are NEVER allowed
 */
export const BLOCKED_FORM_ACTIONS = [
  // Payment/Financial
  'checkout',
  'payment',
  'pay',
  'purchase',
  'buy',
  'order',
  'subscribe',
  'billing',
  'credit-card',
  'creditcard',

  // Account creation
  'signup',
  'sign-up',
  'register',
  'create-account',
  'join',

  // Authentication
  'login',
  'signin',
  'sign-in',
  'authenticate',
  'password',

  // Destructive
  'delete',
  'remove',
  'cancel',
  'unsubscribe',

  // Communication
  'send-message',
  'contact-form',
  'submit-application',
  'apply',
];

/**
 * Form types that ARE allowed (whitelist approach)
 */
export const ALLOWED_FORM_TYPES = [
  // Search and filters
  'search',
  'filter',
  'sort',
  'refine',

  // Quote requests (read-only info gathering)
  'quote',
  'estimate',
  'calculator',
  'pricing',

  // Location/preference selectors
  'location',
  'zip',
  'zipcode',
  'city',
  'state',
  'date',
  'checkin',
  'checkout',
  'guests',
  'rooms',
  'beds',
  'baths',
  'price-range',
  'min-price',
  'max-price',
];

/**
 * Input types that should NEVER be filled
 */
export const BLOCKED_INPUT_TYPES = [
  'password',
  'credit-card',
  'card-number',
  'cvv',
  'cvc',
  'ssn',
  'social-security',
  'bank-account',
  'routing-number',
];

/**
 * Input fields that should NEVER be filled (by name/id patterns)
 */
export const BLOCKED_INPUT_PATTERNS = [
  /password/i,
  /credit.?card/i,
  /card.?number/i,
  /cvv|cvc|csv/i,
  /ssn|social.?security/i,
  /bank.?account/i,
  /routing/i,
  /secret/i,
  /token/i,
  /api.?key/i,
];

// =============================================================================
// RATE LIMITS
// =============================================================================

export const RATE_LIMITS = {
  // Max pages to visit per domain per session
  maxPagesPerDomain: 20,

  // Max forms to submit per session
  maxFormSubmissions: 5,

  // Max clicks per page
  maxClicksPerPage: 10,

  // Delay between actions (ms)
  actionDelayMs: 500,

  // Max total pages per strategy execution
  maxTotalPages: 100,

  // Max screenshots per session
  maxScreenshots: 50,
};

// =============================================================================
// SAFETY CHECK FUNCTIONS
// =============================================================================

/**
 * Check if a URL is safe to visit
 */
export function isUrlSafe(url: string): { safe: boolean; reason?: string } {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const fullUrl = url.toLowerCase();

    // Check blocked domains
    for (const blocked of BLOCKED_DOMAINS) {
      if (hostname.includes(blocked) || fullUrl.includes(blocked)) {
        return { safe: false, reason: `Blocked domain: ${blocked}` };
      }
    }

    // Check for obvious bad patterns
    if (fullUrl.includes('/login') || fullUrl.includes('/signin')) {
      return { safe: false, reason: 'Login pages are not allowed' };
    }

    if (fullUrl.includes('/signup') || fullUrl.includes('/register')) {
      return { safe: false, reason: 'Registration pages are not allowed' };
    }

    if (fullUrl.includes('/checkout') || fullUrl.includes('/payment')) {
      return { safe: false, reason: 'Payment pages are not allowed' };
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: 'Invalid URL' };
  }
}

/**
 * Check if a form action is safe
 */
export function isFormActionSafe(
  formAction: string,
  formId?: string,
  formClass?: string
): { safe: boolean; reason?: string } {
  const combined = `${formAction} ${formId || ''} ${formClass || ''}`.toLowerCase();

  // Check blocked actions
  for (const blocked of BLOCKED_FORM_ACTIONS) {
    if (combined.includes(blocked)) {
      return { safe: false, reason: `Blocked form action: ${blocked}` };
    }
  }

  // Check if it matches allowed types
  const isAllowed = ALLOWED_FORM_TYPES.some((allowed) => combined.includes(allowed));

  if (!isAllowed) {
    // Not explicitly allowed - be cautious
    log.warn('Form not in whitelist, requiring extra caution', { formAction, formId, formClass });
    return {
      safe: true,
      reason: 'Form not in whitelist - proceed with caution',
    };
  }

  return { safe: true };
}

/**
 * Check if an input field is safe to fill
 */
export function isInputSafe(
  inputName: string,
  inputId?: string,
  inputType?: string
): { safe: boolean; reason?: string } {
  // Check input type
  if (inputType && BLOCKED_INPUT_TYPES.includes(inputType.toLowerCase())) {
    return { safe: false, reason: `Blocked input type: ${inputType}` };
  }

  // Check input name/id against patterns
  const toCheck = `${inputName} ${inputId || ''}`;
  for (const pattern of BLOCKED_INPUT_PATTERNS) {
    if (pattern.test(toCheck)) {
      return { safe: false, reason: `Blocked input pattern: ${pattern}` };
    }
  }

  return { safe: true };
}

/**
 * Check if a domain is trusted for deeper interaction
 */
export function isDomainTrusted(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return TRUSTED_DOMAINS.some(
      (trusted) => hostname.includes(trusted) || hostname.endsWith(trusted.replace('www.', ''))
    );
  } catch {
    return false;
  }
}

/**
 * Sanitize data before returning (remove any accidentally captured sensitive info)
 */
export function sanitizeOutput(data: string): string {
  // Remove anything that looks like a credit card number
  let sanitized = data.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[REDACTED_CARD]');

  // Remove anything that looks like an SSN
  sanitized = sanitized.replace(/\b\d{3}[\s-]?\d{2}[\s-]?\d{4}\b/g, '[REDACTED_SSN]');

  // Remove email addresses (optional - might want to keep these)
  // sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');

  // Remove phone numbers
  sanitized = sanitized.replace(
    /\b(\+?1?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    '[REDACTED_PHONE]'
  );

  return sanitized;
}

// =============================================================================
// ACTION TRACKING
// =============================================================================

interface SessionTracker {
  pagesPerDomain: Map<string, number>;
  formSubmissions: number;
  totalPages: number;
  screenshots: number;
}

const sessionTrackers = new Map<string, SessionTracker>();

/**
 * Get or create session tracker
 */
export function getSessionTracker(sessionId: string): SessionTracker {
  if (!sessionTrackers.has(sessionId)) {
    sessionTrackers.set(sessionId, {
      pagesPerDomain: new Map(),
      formSubmissions: 0,
      totalPages: 0,
      screenshots: 0,
    });
  }
  return sessionTrackers.get(sessionId)!;
}

/**
 * Check if we can visit another page
 */
export function canVisitPage(
  sessionId: string,
  url: string
): { allowed: boolean; reason?: string } {
  const tracker = getSessionTracker(sessionId);

  // Check total pages
  if (tracker.totalPages >= RATE_LIMITS.maxTotalPages) {
    return { allowed: false, reason: 'Max total pages reached' };
  }

  // Check pages per domain
  try {
    const domain = new URL(url).hostname;
    const domainCount = tracker.pagesPerDomain.get(domain) || 0;
    if (domainCount >= RATE_LIMITS.maxPagesPerDomain) {
      return { allowed: false, reason: `Max pages for ${domain} reached` };
    }
  } catch {
    return { allowed: false, reason: 'Invalid URL' };
  }

  return { allowed: true };
}

/**
 * Record a page visit
 */
export function recordPageVisit(sessionId: string, url: string): void {
  const tracker = getSessionTracker(sessionId);
  tracker.totalPages++;

  try {
    const domain = new URL(url).hostname;
    tracker.pagesPerDomain.set(domain, (tracker.pagesPerDomain.get(domain) || 0) + 1);
  } catch {
    // Ignore invalid URLs
  }
}

/**
 * Check if we can submit another form
 */
export function canSubmitForm(sessionId: string): { allowed: boolean; reason?: string } {
  const tracker = getSessionTracker(sessionId);

  if (tracker.formSubmissions >= RATE_LIMITS.maxFormSubmissions) {
    return { allowed: false, reason: 'Max form submissions reached' };
  }

  return { allowed: true };
}

/**
 * Record a form submission
 */
export function recordFormSubmission(sessionId: string): void {
  const tracker = getSessionTracker(sessionId);
  tracker.formSubmissions++;
}

/**
 * Cleanup session tracker
 */
export function cleanupSessionTracker(sessionId: string): void {
  sessionTrackers.delete(sessionId);
}

// =============================================================================
// LOGGING & AUDIT
// =============================================================================

/**
 * Log a potentially risky action for audit
 */
export function logRiskyAction(
  sessionId: string,
  action: string,
  details: Record<string, unknown>
): void {
  log.warn('Risky browser action', {
    sessionId,
    action,
    ...details,
    timestamp: new Date().toISOString(),
  });
}
