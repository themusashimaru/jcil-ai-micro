import { describe, it, expect } from 'vitest';
import {
  generateLoginPage,
  generateSignupPage,
  generateAuthCallbackPage,
  generateDashboardPage,
  generateMagicLinkPage,
  generateForgotPasswordPage,
  hasAuthIntent,
  hasMagicLinkIntent,
  generateAuthPages,
  type AuthConfig,
} from './authTemplates';

const defaultConfig: AuthConfig = {
  businessName: 'TestBiz',
};

const fullConfig: AuthConfig = {
  businessName: 'Acme Corp',
  primaryColor: '#ff0000',
  secondaryColor: '#00ff00',
  logoUrl: 'https://example.com/logo.png',
  features: {
    emailPassword: true,
    googleOAuth: true,
    githubOAuth: true,
    magicLink: true,
    passkey: true,
  },
};

// -------------------------------------------------------------------
// generateLoginPage
// -------------------------------------------------------------------
describe('generateLoginPage', () => {
  it('should return valid HTML', () => {
    const html = generateLoginPage(defaultConfig);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
  });

  it('should include business name in title', () => {
    const html = generateLoginPage(defaultConfig);
    expect(html).toContain('<title>Login - TestBiz</title>');
  });

  it('should include primary color from config', () => {
    const html = generateLoginPage(fullConfig);
    expect(html).toContain('#ff0000');
  });

  it('should include secondary color from config', () => {
    const html = generateLoginPage(fullConfig);
    expect(html).toContain('#00ff00');
  });

  it('should include logo when provided', () => {
    const html = generateLoginPage(fullConfig);
    expect(html).toContain('https://example.com/logo.png');
  });

  it('should include Google OAuth button when enabled', () => {
    const html = generateLoginPage(fullConfig);
    expect(html).toContain('Google');
  });

  it('should include GitHub OAuth button when enabled', () => {
    const html = generateLoginPage(fullConfig);
    expect(html).toContain('GitHub');
  });

  it('should use default colors when not provided', () => {
    const html = generateLoginPage(defaultConfig);
    expect(html).toContain('#8b5cf6'); // default primary
  });

  it('should include email/password form by default', () => {
    const html = generateLoginPage(defaultConfig);
    expect(html).toContain('email');
    expect(html).toContain('password');
  });

  it('should include Supabase script', () => {
    const html = generateLoginPage(defaultConfig);
    expect(html).toContain('supabase');
  });
});

// -------------------------------------------------------------------
// generateSignupPage
// -------------------------------------------------------------------
describe('generateSignupPage', () => {
  it('should return valid HTML', () => {
    const html = generateSignupPage(defaultConfig);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('should include business name', () => {
    const html = generateSignupPage(defaultConfig);
    expect(html).toContain('TestBiz');
  });

  it('should include signup form elements', () => {
    const html = generateSignupPage(defaultConfig);
    expect(html).toContain('Sign Up');
  });

  it('should include password confirmation', () => {
    const html = generateSignupPage(defaultConfig);
    expect(html).toContain('password');
  });

  it('should include custom colors', () => {
    const html = generateSignupPage(fullConfig);
    expect(html).toContain('#ff0000');
    expect(html).toContain('#00ff00');
  });

  it('should include login link', () => {
    const html = generateSignupPage(defaultConfig);
    expect(html).toContain('login');
  });
});

// -------------------------------------------------------------------
// generateAuthCallbackPage
// -------------------------------------------------------------------
describe('generateAuthCallbackPage', () => {
  it('should return valid HTML', () => {
    const html = generateAuthCallbackPage(defaultConfig);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('should include business name', () => {
    const html = generateAuthCallbackPage(defaultConfig);
    expect(html).toContain('TestBiz');
  });

  it('should handle auth callback logic', () => {
    const html = generateAuthCallbackPage(defaultConfig);
    // Should contain redirect or token exchange logic
    expect(html).toContain('supabase');
  });
});

// -------------------------------------------------------------------
// generateDashboardPage
// -------------------------------------------------------------------
describe('generateDashboardPage', () => {
  it('should return valid HTML', () => {
    const html = generateDashboardPage(defaultConfig);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('should include business name', () => {
    const html = generateDashboardPage(defaultConfig);
    expect(html).toContain('TestBiz');
  });

  it('should include dashboard title', () => {
    const html = generateDashboardPage(defaultConfig);
    expect(html).toContain('Dashboard');
  });

  it('should include logout functionality', () => {
    const html = generateDashboardPage(defaultConfig);
    expect(html.toLowerCase()).toContain('logout');
  });

  it('should include custom colors', () => {
    const html = generateDashboardPage(fullConfig);
    expect(html).toContain('#ff0000');
  });
});

// -------------------------------------------------------------------
// generateMagicLinkPage
// -------------------------------------------------------------------
describe('generateMagicLinkPage', () => {
  it('should return valid HTML', () => {
    const html = generateMagicLinkPage(defaultConfig);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('should include business name', () => {
    const html = generateMagicLinkPage(defaultConfig);
    expect(html).toContain('TestBiz');
  });

  it('should reference magic link concept', () => {
    const html = generateMagicLinkPage(defaultConfig).toLowerCase();
    expect(html).toContain('magic');
  });

  it('should include email input', () => {
    const html = generateMagicLinkPage(defaultConfig);
    expect(html).toContain('email');
  });

  it('should include custom colors', () => {
    const html = generateMagicLinkPage(fullConfig);
    expect(html).toContain('#ff0000');
  });
});

// -------------------------------------------------------------------
// generateForgotPasswordPage
// -------------------------------------------------------------------
describe('generateForgotPasswordPage', () => {
  it('should return valid HTML', () => {
    const html = generateForgotPasswordPage(defaultConfig);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('should include business name', () => {
    const html = generateForgotPasswordPage(defaultConfig);
    expect(html).toContain('TestBiz');
  });

  it('should reference password reset', () => {
    const html = generateForgotPasswordPage(defaultConfig).toLowerCase();
    expect(html.includes('reset') || html.includes('forgot')).toBe(true);
  });

  it('should include email input for reset', () => {
    const html = generateForgotPasswordPage(defaultConfig);
    expect(html).toContain('email');
  });

  it('should include back-to-login link', () => {
    const html = generateForgotPasswordPage(defaultConfig).toLowerCase();
    expect(html).toContain('login');
  });
});

// -------------------------------------------------------------------
// hasAuthIntent
// -------------------------------------------------------------------
describe('hasAuthIntent', () => {
  it('should detect "add authentication"', () => {
    expect(hasAuthIntent('add authentication to my site')).toBe(true);
  });

  it('should detect "login page"', () => {
    expect(hasAuthIntent('I need a login page')).toBe(true);
  });

  it('should detect "signup"', () => {
    expect(hasAuthIntent('create a signup form')).toBe(true);
  });

  it('should detect "user authentication"', () => {
    expect(hasAuthIntent('need user authentication')).toBe(true);
  });

  it('should return false for unrelated request', () => {
    expect(hasAuthIntent('create a landing page')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(hasAuthIntent('')).toBe(false);
  });

  it('should be case-insensitive', () => {
    expect(hasAuthIntent('ADD AUTHENTICATION')).toBe(true);
  });
});

// -------------------------------------------------------------------
// hasMagicLinkIntent
// -------------------------------------------------------------------
describe('hasMagicLinkIntent', () => {
  it('should detect "magic link"', () => {
    expect(hasMagicLinkIntent('use magic link auth')).toBe(true);
  });

  it('should detect "passwordless"', () => {
    expect(hasMagicLinkIntent('passwordless login')).toBe(true);
  });

  it('should detect "no password"', () => {
    expect(hasMagicLinkIntent('no password authentication')).toBe(true);
  });

  it('should detect "email link login"', () => {
    expect(hasMagicLinkIntent('email link login')).toBe(true);
  });

  it('should return false for regular auth request', () => {
    expect(hasMagicLinkIntent('add login page')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(hasMagicLinkIntent('')).toBe(false);
  });
});

// -------------------------------------------------------------------
// generateAuthPages
// -------------------------------------------------------------------
describe('generateAuthPages', () => {
  it('should return 5 pages without magic link', () => {
    const pages = generateAuthPages(defaultConfig);
    expect(Object.keys(pages)).toHaveLength(5);
    expect(pages).toHaveProperty('login.html');
    expect(pages).toHaveProperty('signup.html');
    expect(pages).toHaveProperty('auth-callback.html');
    expect(pages).toHaveProperty('dashboard.html');
    expect(pages).toHaveProperty('forgot-password.html');
  });

  it('should return 6 pages with magic link enabled', () => {
    const pages = generateAuthPages(fullConfig);
    expect(Object.keys(pages)).toHaveLength(6);
    expect(pages).toHaveProperty('magic-link.html');
  });

  it('should not include magic link when not enabled', () => {
    const pages = generateAuthPages({ businessName: 'Test', features: { emailPassword: true } });
    expect(pages).not.toHaveProperty('magic-link.html');
  });

  it('should produce valid HTML for all pages', () => {
    const pages = generateAuthPages(fullConfig);
    for (const [name, html] of Object.entries(pages)) {
      expect(html, `${name} should be valid HTML`).toContain('<!DOCTYPE html>');
      expect(html, `${name} should contain closing tag`).toContain('</html>');
    }
  });

  it('should include business name in all pages', () => {
    const pages = generateAuthPages({ businessName: 'UniqueBusinessName123' });
    for (const [name, html] of Object.entries(pages)) {
      expect(html, `${name} should contain business name`).toContain('UniqueBusinessName123');
    }
  });
});
