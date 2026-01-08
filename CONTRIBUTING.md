# Contributing to JCIL.AI

> Development Guidelines and Best Practices

---

## Development Philosophy

JCIL.AI maintains enterprise-grade code quality standards. All contributions must adhere to these principles:

1. **Safety First** — Security is non-negotiable
2. **Type Safety** — TypeScript strict mode, no `any` types
3. **Test Coverage** — All new features require tests
4. **Code Quality** — Zero warnings policy
5. **Documentation** — Code should be self-documenting with comments where needed

---

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- pnpm 8+ (required)
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/themusashimaru/jcil-ai-micro.git
cd jcil-ai-micro

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env.local

# Start development server
pnpm dev
```

### Environment Configuration

Required environment variables for development:

```env
# Minimum required
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
ANTHROPIC_API_KEY=your-anthropic-key
```

---

## Code Standards

### TypeScript Configuration

We use strict TypeScript settings:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

**Requirements:**
- No `any` types (use `unknown` and narrow)
- No unused variables or imports
- Explicit return types on exported functions
- Proper null/undefined handling

### ESLint Rules

```json
{
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error"],
    "@typescript-eslint/no-explicit-any": "error",
    "no-console": ["warn", { "allow": ["warn", "error"] }]
  }
}
```

### Code Quality Checks

Before committing, ensure:

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Tests
pnpm test

# Build verification
pnpm build
```

**All checks must pass with zero errors and zero warnings.**

---

## Project Structure

```
jcil-ai-micro/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── admin/             # Admin dashboard
│   └── [feature]/         # Feature pages
├── src/
│   ├── agents/            # AI Agent System
│   │   ├── core/         # Base classes and types
│   │   ├── research/     # Research Agent
│   │   └── code/         # Code Agent
│   ├── components/        # React components
│   ├── lib/              # Core libraries
│   │   ├── anthropic/    # Claude integration
│   │   ├── security/     # Security utilities
│   │   ├── validation/   # Zod schemas
│   │   └── [module]/     # Other modules
│   └── prompts/          # AI prompt templates
├── docs/                  # Documentation
└── public/               # Static assets
```

---

## Writing Code

### API Routes

All API routes must follow this pattern:

```typescript
import { NextRequest } from 'next/server';
import { validateCSRF } from '@/lib/security/csrf';
import { acquireSlot, releaseSlot, generateRequestId } from '@/lib/queue';
import { someSchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logger';

const log = logger('ModuleName');

export async function POST(request: NextRequest) {
  // 1. CSRF Protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  const requestId = generateRequestId();
  let slotAcquired = false;

  try {
    // 2. Queue Management
    slotAcquired = await acquireSlot(requestId);
    if (!slotAcquired) {
      return Response.json(
        { error: 'Server busy', retryAfter: 5 },
        { status: 503 }
      );
    }

    // 3. Parse and Validate Input
    const body = await request.json();
    const validation = someSchema.safeParse(body);
    if (!validation.success) {
      return Response.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    // 4. Business Logic
    const result = await processRequest(validation.data);

    // 5. Return Response
    return Response.json({ ok: true, data: result });

  } catch (error) {
    log.error('Request failed', error as Error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );

  } finally {
    // 6. Release Queue Slot
    if (slotAcquired) {
      await releaseSlot(requestId);
    }
  }
}
```

### Input Validation

Always validate input with Zod schemas:

```typescript
// In src/lib/validation/schemas.ts
export const myFeatureSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  count: z.number().int().min(0).max(1000),
});

// In API route
const validation = myFeatureSchema.safeParse(body);
if (!validation.success) {
  return Response.json({
    error: 'Validation failed',
    code: 'VALIDATION_ERROR',
    details: validation.error.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    })),
  }, { status: 400 });
}
```

### Logging

Use structured logging:

```typescript
import { logger } from '@/lib/logger';

const log = logger('ModuleName');

// Good
log.info('Operation completed', { userId, count: items.length });
log.error('Operation failed', error, { context: 'additional info' });

// Bad
console.log('Something happened');  // Don't use console.log
```

### Error Handling

Handle errors explicitly:

```typescript
// Good
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  log.error('Operation failed', error as Error);
  throw new AppError('Operation failed', 'OPERATION_FAILED');
}

// Bad
const result = await riskyOperation();  // Unhandled rejection
```

---

## Security Requirements

### Input Validation

- All user input MUST be validated with Zod schemas
- Never trust client-side validation alone
- Sanitize before using in shell commands or SQL

### Authentication

- Check authentication on every protected route
- Verify admin status server-side
- Use Row-Level Security in database

### Secrets

- Never commit secrets to version control
- Use environment variables for all secrets
- Don't log sensitive information

### Code Execution

- All code execution must use E2B sandbox
- Sanitize file paths and shell arguments
- Validate session ownership

---

## Testing

### Test Structure

```
src/lib/
├── feature.ts
└── feature.test.ts    # Tests next to source
```

### Writing Tests

```typescript
import { describe, it, expect, vi } from 'vitest';
import { myFunction } from './feature';

describe('myFunction', () => {
  it('should handle valid input', () => {
    const result = myFunction({ valid: 'input' });
    expect(result).toBe(expected);
  });

  it('should reject invalid input', () => {
    expect(() => myFunction({ invalid: 'input' }))
      .toThrow('Expected error');
  });

  it('should handle edge cases', () => {
    expect(myFunction(null)).toBe(defaultValue);
    expect(myFunction(undefined)).toBe(defaultValue);
  });
});
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage
pnpm test:coverage
```

### Test Requirements

- All new features require tests
- Test coverage should not decrease
- Test both success and error paths
- Mock external services appropriately

---

## Git Workflow

### Branch Naming

```
feature/description    # New features
fix/description       # Bug fixes
docs/description      # Documentation
refactor/description  # Code refactoring
```

### Commit Messages

Use conventional commits:

```
feat: add user authentication
fix: resolve rate limiting edge case
docs: update API documentation
refactor: simplify validation logic
test: add tests for queue system
chore: update dependencies
```

### Pull Request Process

1. Create feature branch from `main`
2. Make changes with atomic commits
3. Ensure all checks pass locally
4. Open PR with clear description
5. Request review from maintainers
6. Address feedback
7. Squash and merge when approved

### PR Description Template

```markdown
## Summary
Brief description of changes

## Changes
- Change 1
- Change 2

## Testing
How to test these changes

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Build succeeds
```

---

## Code Review Guidelines

### For Authors

- Keep PRs focused and small (< 500 lines ideal)
- Provide context in PR description
- Respond to feedback promptly
- Don't take feedback personally

### For Reviewers

- Be constructive and specific
- Approve with comments for minor issues
- Block only for security or correctness issues
- Suggest, don't demand

### What We Look For

1. **Security** — No vulnerabilities introduced
2. **Correctness** — Logic is sound
3. **Testing** — Adequate test coverage
4. **Performance** — No obvious bottlenecks
5. **Readability** — Code is clear and maintainable
6. **Consistency** — Follows project patterns

---

## Documentation

### Code Comments

```typescript
/**
 * Process a user request with retry logic
 *
 * @param request - The incoming request object
 * @param options - Processing options
 * @returns Processed result or throws on failure
 *
 * @example
 * const result = await processRequest(req, { retry: true });
 */
export async function processRequest(
  request: Request,
  options: ProcessOptions
): Promise<ProcessResult> {
  // Implementation
}
```

### README Updates

Update documentation when:
- Adding new features
- Changing configuration
- Modifying APIs
- Adding dependencies

---

## Release Process

1. All tests pass
2. No TypeScript errors
3. No ESLint warnings
4. Documentation updated
5. Changelog updated
6. Version bumped
7. Tag created
8. Deploy to production

---

## Getting Help

- **Questions**: Open a discussion on GitHub
- **Bugs**: Open an issue with reproduction steps
- **Security**: Email security@jcil.ai (do not open public issue)

---

## Code of Conduct

- Be respectful and professional
- Focus on technical merit
- Welcome diverse perspectives
- No harassment or discrimination

---

*Thank you for contributing to JCIL.AI!*
