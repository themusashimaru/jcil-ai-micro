# JCIL.AI

> **AI-Powered Intelligence Platform** — Built on Anthropic Claude Sonnet 4.6

[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![Anthropic](https://img.shields.io/badge/Powered%20by-Claude%20Sonnet%204.6-orange)](https://anthropic.com/)
[![License](https://img.shields.io/badge/License-Proprietary-red)](#license)

---

## What is JCIL.AI?

JCIL.AI is a full-service AI platform that goes far beyond chat. Powered by Anthropic's Claude Sonnet 4.6 as the default model, JCIL.AI provides a comprehensive suite of 51 real AI tools spanning research, code development, document generation, data analysis, and more.

What makes JCIL.AI different:

- **51 production AI tools** — every single one has a real implementation. No stubs, no demos, no fake data.
- **Multi-provider support with BYOK** — bring your own API keys for Claude, OpenAI, xAI (Grok), DeepSeek, or Google Gemini. Switch providers mid-conversation without losing context.
- **Christian conservative values** — JCIL.AI is unapologetically built on biblical truth and American values. Faith-aligned AI that doesn't compromise.
- **Enterprise-grade security** — Row-level security, encrypted API key storage, CSRF protection, rate limiting, sandboxed code execution, and auth guards on every route.

---

## Core Features

### AI Chat
Full conversational AI powered by Claude Sonnet 4.6 with streaming responses, extended thinking, conversation memory, and intelligent follow-up suggestions. Upload images, PDFs, and documents directly into the conversation for analysis.

### Code Lab
A browser-based integrated development environment with:
- Sandboxed code execution via E2B (Python, JavaScript, and more)
- Full terminal access with bash, git, npm, pip
- File system operations (read, write, create projects)
- Real-time code streaming and output

### Multi-Provider AI (BYOK)
Bring Your Own Key and switch between AI providers seamlessly:

| Provider | Models Available | Context Window |
|---|---|---|
| **Anthropic (Claude)** | Opus 4.6, Sonnet 4.6, Haiku 4.5 | 200K tokens |
| **OpenAI** | GPT-5.2 | 200K tokens |
| **xAI (Grok)** | Grok 4.1 Fast, Grok Code Fast | Up to 2M tokens |
| **DeepSeek** | DeepSeek Reasoner (R1) | 64K tokens |
| **Google (Gemini)** | Gemini 3 Pro, Gemini 3 Flash | 1M tokens |

Your API keys are encrypted at rest and never stored in plaintext. Switch providers or models mid-conversation — your context carries over through intelligent conversation handoff.

### Document Generation
Create professional, downloadable documents on demand:
- **Excel spreadsheets** (.xlsx) — with working formulas, budgets, trackers, data tables
- **Word documents** (.docx) — letters, contracts, proposals, reports, memos
- **PDF documents** — invoices, certificates, flyers, professional documents
- **PowerPoint presentations** (.pptx) — slide decks with charts and layouts
- **Mail merge** — batch document generation from templates

### Web Research & Analysis
- **Web search** — real-time search powered by Brave API
- **URL fetching** — extract and analyze content from any webpage
- **Browser automation** — full Puppeteer-powered browser for JavaScript-heavy sites
- **Screenshot capture** — take and analyze screenshots of any webpage
- **Parallel research** — launch multiple AI research agents simultaneously for complex topics

### Developer Tools
- **Code generation** — production-quality code in any language
- **Code analysis** — security audits, performance reviews, quality analysis
- **Project scaffolding** — create complete project structures
- **Test generation** — comprehensive test suites
- **Error fixing** — AI-powered debugging with root cause analysis
- **Code refactoring** — improve code quality while preserving functionality
- **Code formatting** — Prettier integration

---

## Full Tool Suite (51 Tools)

Every tool listed below has a real, working implementation.

### Search & Web
| Tool | Description |
|---|---|
| `web_search` | Real-time web search for current information |
| `fetch_url` | Extract content from any URL |
| `browser_visit` | Full browser with JavaScript rendering (Puppeteer) |
| `screenshot` | Capture webpage screenshots |
| `web_capture` | Advanced web page capture and archiving |

### Code & Development
| Tool | Description |
|---|---|
| `run_code` | Execute code in sandboxed E2B environment |
| `generate_code` | Generate production-quality code |
| `analyze_code` | Security audit and code review |
| `build_project` | Scaffold complete project structures |
| `generate_tests` | Create test suites |
| `fix_error` | AI-powered error debugging |
| `refactor_code` | Improve code quality |
| `prettier` | Code formatting |
| `workspace` | Full coding workspace with bash, git, file ops |
| `generate_docs` | Generate documentation |

### Document & File Generation
| Tool | Description |
|---|---|
| `document` | Generate Word documents (.docx) |
| `spreadsheet` | Generate Excel spreadsheets (.xlsx) |
| `pdf` | PDF manipulation and creation |
| `presentation` | PowerPoint presentations (.pptx) |
| `mail_merge` | Batch document generation |
| `document_templates` | Business document templates |
| `email_template` | HTML email templates |
| `chart` | Data visualization and charts |

### Vision & Media
| Tool | Description |
|---|---|
| `analyze_image` | AI vision analysis of images |
| `extract_table` | Extract tables from images/webpages |
| `extract_pdf_url` | Extract text from PDF URLs |
| `image_transform` | Resize, compress, convert, watermark images |
| `ocr` | Text extraction from images (Tesseract.js) |
| `exif` | Image metadata extraction |
| `media` | Media processing (FFmpeg.js) |
| `audio_transcribe` | Audio transcription |

### Data & Analysis
| Tool | Description |
|---|---|
| `sql` | Run SQL queries (SQL.js) |
| `excel` | Advanced Excel operations (SheetJS) |
| `nlp` | Natural language processing |
| `diff` | Text comparison and diff |
| `validator` | Data validation |
| `search_index` | Full-text search indexing (Lunr.js) |
| `faker` | Test data generation |

### Scientific & Specialized
| Tool | Description |
|---|---|
| `geospatial` | Geospatial calculations (Turf.js) |
| `phone` | Phone number validation and formatting |
| `dna_bio` | DNA/biological sequence analysis |
| `signal` | Signal processing (FFT) |
| `medical_calc` | Medical calculations |
| `sequence_analyze` | Sequence analysis |
| `constraint` | Constraint solving (logic-solver) |
| `parser` | Grammar parsing (Nearley) |
| `accessibility` | WCAG accessibility checking (axe-core) |
| `graphics_3d` | 3D graphics generation |
| `hough_vision` | Computer vision (Hough transforms) |
| `ray_tracing` | Ray tracing renderer |

### Utilities
| Tool | Description |
|---|---|
| `qr_code` | QR code generation |
| `barcode` | Barcode generation |
| `crypto` | Cryptography operations (JOSE) |
| `zip` | ZIP file creation and extraction |
| `file_convert` | File format conversion |
| `link_shorten` | URL shortening |
| `http_request` | HTTP requests (API calls, webhooks) |
| `youtube_transcript` | YouTube video transcription |
| `github` | GitHub integration |

### AI Orchestration
| Tool | Description |
|---|---|
| `parallel_research` | Multi-agent parallel research |
| `mini_agent` | Mini-agent orchestrator |
| `dynamic_tool` | Runtime tool creation |

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 14, React 18, TypeScript 5.4, Tailwind CSS | SSR, type safety, responsive UI |
| **AI Engine** | Anthropic Claude Sonnet 4.6 (default) | Primary AI with 200K context |
| **Multi-Provider** | OpenAI, xAI, DeepSeek, Google Gemini | BYOK alternative providers |
| **Database** | Supabase PostgreSQL | User data, sessions, RLS |
| **Cache** | Upstash Redis | Rate limiting, session caching |
| **Auth** | Supabase Auth + WebAuthn | OAuth, passkeys |
| **Payments** | Stripe | Subscription billing |
| **Code Sandbox** | E2B | Isolated code execution |
| **Browser** | Puppeteer | Web scraping, screenshots |
| **Hosting** | Vercel | Production deployment |
| **Monitoring** | Sentry | Error tracking |
| **Analytics** | Vercel Analytics + Speed Insights | Performance monitoring |

---

## Security

JCIL.AI is built with security as a first-class concern:

| Feature | Implementation |
|---|---|
| **Row-Level Security** | Supabase RLS policies on all tables |
| **Input Validation** | 50+ Zod schemas for all API inputs |
| **CSRF Protection** | Origin/Referer validation built into auth guards |
| **Rate Limiting** | Redis-backed sliding window rate limiter |
| **Auth Guards** | `requireUser`/`requireAdmin` on every API route (46 files, 100%) |
| **API Key Encryption** | BYOK keys encrypted at rest with AES |
| **HTML Sanitization** | DOMPurify on all user-generated content |
| **Sandboxed Execution** | E2B isolated VMs for code execution |
| **CSP Headers** | Content Security Policy headers |
| **Prompt Injection Protection** | System prompt sanitization against injection attacks |

See [SECURITY.md](./SECURITY.md) for our security policy and responsible disclosure process.

---

## Faith & Values

JCIL.AI is built on Christian conservative values. This is not a filter or an add-on — it is core to who we are.

- **Biblical Foundation** — The Bible is the authoritative Word of God. JCIL.AI speaks from personal conviction, not hedged language.
- **Pro-Life** — We defend the sanctity of human life from conception.
- **Pro-2nd Amendment** — We support the constitutional right to bear arms.
- **America First** — We proudly support American interests and sovereignty.
- **Traditional Family Values** — Marriage between one man and one woman. Gender is binary as God created.
- **Intellectual Honesty** — We think critically with evidence and reason. Not conspiracy, not groupthink — honest inquiry grounded in truth.

These values are embedded in the AI's system prompt and cannot be overridden by user prompts.

---

## Getting Started

### Prerequisites

- Node.js 22.x+
- pnpm 8+
- Supabase project
- Anthropic API key

### Installation

```bash
# Clone repository
git clone https://github.com/themusashimaru/jcil-ai-micro.git
cd jcil-ai-micro

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your API keys

# Run development server
pnpm dev

# Run tests
pnpm test
```

### Required Environment Variables

```bash
ANTHROPIC_API_KEY=              # Claude API access (required)
NEXT_PUBLIC_SUPABASE_URL=       # Supabase database URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase public key
SUPABASE_SERVICE_ROLE_KEY=      # Supabase admin key
```

### Optional Environment Variables

```bash
E2B_API_KEY=                    # Sandboxed code execution (Code Lab)
UPSTASH_REDIS_REST_URL=         # Rate limiting
UPSTASH_REDIS_REST_TOKEN=       # Rate limiting
BRAVE_API_KEY=                  # Web search
XAI_API_KEY=                    # xAI/Grok provider (fallback)
OPENAI_API_KEY=                 # OpenAI provider (BYOK server-side)
DEEPSEEK_API_KEY=               # DeepSeek provider
GEMINI_API_KEY=                 # Google Gemini provider
GITHUB_TOKEN=                   # GitHub integration
STRIPE_SECRET_KEY=              # Payment processing
SENTRY_DSN=                     # Error tracking
```

---

## Architecture

```
app/
  (auth)/                        # Authentication pages
  (chat)/                        # Chat interface
  api/
    chat/                        # Main AI chat endpoint
    code-lab/                    # Code Lab API routes
    documents/                   # Document generation
    stripe/                      # Payment webhooks
    memory/                      # Conversation memory
    providers/                   # Provider status API
    user/                        # User settings, API keys

src/
  lib/
    ai/
      providers/                 # Multi-provider system
        adapters/                # Anthropic, OpenAI, Google adapters
        context/                 # Conversation handoff between providers
      tools/                     # 51 tool implementations
      byok.ts                   # Bring Your Own Key logic
      chat-router.ts            # Multi-provider chat routing
    auth/                        # Auth guards (requireUser, requireAdmin)
    security/                    # CSRF, rate limiting, crypto, validation
    db/                          # Database operations
  agents/                        # AI agent implementations (strategy, code)

components/                      # React UI components
  code-lab/                      # Code Lab IDE interface
```

---

## Development

### Running Tests

```bash
pnpm test                 # Run all tests
pnpm test -- --coverage   # Run with coverage report
pnpm test:watch           # Watch mode
```

### Build Verification

```bash
npx tsc --noEmit          # Type check
pnpm lint                 # ESLint
pnpm build                # Production build
```

### Commit Convention

```
<type>(<scope>): <description>

Types: feat, fix, refactor, test, docs, security, perf, chore
Scopes: tools, chat, codelab, auth, db, ci, ui, a11y
```

---

## Subscription Plans

| Plan | Price | Features |
|---|---|---|
| **Free** | $0/mo | Basic chat, limited daily messages |
| **Plus** | $18/mo | All tools, Code Lab, document generation |
| **Pro** | $30/mo | Priority support, higher rate limits, extended thinking |
| **Executive** | $99/mo | Enterprise features, maximum limits, priority access |

---

## Project Status

| Metric | Value |
|---|---|
| Real AI tools | 51/51 (100% implemented) |
| Test coverage | 41.25% (12,107 tests across 410 files) |
| Auth guard coverage | 100% (46 route files) |
| AI model | Claude Sonnet 4.6 (default) |
| Supported providers | 5 (Claude, OpenAI, xAI, DeepSeek, Google) |
| Production dependencies | 75 |

See [PROJECT_STATUS.md](./PROJECT_STATUS.md) for detailed verified metrics.

---

## Documentation

| Document | Description |
|---|---|
| [PROJECT_STATUS.md](./PROJECT_STATUS.md) | Current verified metrics and ground truth |
| [TASK_TRACKER.md](./TASK_TRACKER.md) | Development roadmap and progress |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Development guide and code standards |
| [SECURITY.md](./SECURITY.md) | Security policy and responsible disclosure |
| [APP_ASSESSMENT_AND_RECOMMENDATIONS.md](./APP_ASSESSMENT_AND_RECOMMENDATIONS.md) | Technical assessment report |
| [CTO_ASSESSMENT_REPORT.md](./CTO_ASSESSMENT_REPORT.md) | CTO-level technical review |

---

## Disclaimer

JCIL.AI is an AI-powered tool. AI-generated content is provided for informational purposes and should not be considered professional legal, medical, financial, or tax advice. Always consult qualified professionals for decisions in those areas. While we strive for accuracy, AI responses may contain errors. Users are responsible for verifying information before acting on it.

---

## License

Proprietary - All Rights Reserved

Copyright (c) 2024-2026 JCIL.AI

This software is proprietary and confidential. Unauthorized copying, distribution, modification, or use of this software, via any medium, is strictly prohibited without express written permission from JCIL.AI.

---

## Support

- **Website**: [jcil.ai](https://jcil.ai)
- **Support**: support@jcil.ai
- **Security Issues**: security@jcil.ai (see [SECURITY.md](./SECURITY.md))

---

_Last updated: March 9, 2026_
