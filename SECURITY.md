# Security Policy

## Reporting a Vulnerability

The security of JCIL.AI is taken seriously. If you discover a security vulnerability, we appreciate your help in disclosing it to us responsibly.

**Please do NOT report security vulnerabilities through public GitHub issues.**

### How to Report

Email **security@jcil.ai** with:

1. A description of the vulnerability
2. Steps to reproduce the issue
3. The potential impact
4. Any suggested remediation (optional)

### What to Expect

- **Acknowledgment** within 48 hours of your report
- **Status update** within 5 business days with our assessment
- **Resolution timeline** based on severity:
  - Critical: 24-48 hours
  - High: 1 week
  - Medium: 2 weeks
  - Low: Next release cycle

### Scope

The following are in scope for security reports:

- Authentication and authorization bypass
- Injection vulnerabilities (SQL, XSS, command injection, prompt injection)
- Data exposure or leakage
- CSRF or session management issues
- API key or credential exposure
- Sandbox escape in code execution environments
- Rate limiting bypass
- Row-level security policy violations

### Out of Scope

- Denial of service attacks
- Social engineering
- Physical security
- Issues in third-party dependencies with no demonstrated exploit path
- Reports from automated scanners without proof of exploitability

---

## Security Architecture

JCIL.AI implements defense-in-depth security:

### Authentication & Authorization
- Supabase Auth with OAuth providers and WebAuthn passkey support
- `requireUser()` and `requireAdmin()` auth guards on 100% of API routes
- CSRF protection built into every auth guard (Origin/Referer validation)
- Session management through Supabase SSR

### Data Protection
- Row-Level Security (RLS) policies on all Supabase tables
- User BYOK API keys encrypted at rest
- Input validation via 50+ Zod schemas on all API endpoints
- HTML sanitization with DOMPurify on user-generated content
- System prompt injection protection with pattern-based sanitization

### Infrastructure Security
- Redis-backed sliding window rate limiting
- Content Security Policy (CSP) headers
- Sandboxed code execution in E2B isolated VMs
- Error sanitization (no stack traces or internal details in API responses)
- Sentry error tracking for monitoring

### Code Security
- TypeScript strict mode
- ESLint security rules
- Automated CI pipeline with security auditing
- Pre-commit hooks (Husky + lint-staged)

---

## Supported Versions

| Version | Supported |
|---|---|
| Current production | Yes |
| Previous releases | Best effort |

---

_This policy is effective as of March 9, 2026._
