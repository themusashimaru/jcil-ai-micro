# JCIL.AI - Christian Conservative AI Chat

Production-ready Next.js PWA with AI chat through a Christian conservative lens, advanced tools, and comprehensive admin panel.

## Tech Stack

- **Framework**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Auth**: Supabase (Google OAuth only)
- **Database**: Supabase Postgres with RLS
- **Storage**: Supabase Storage
- **Caching/Queues**: Upstash Redis / Vercel KV
- **Payments**: Stripe Subscriptions
- **AI Providers**: OpenAI (GPT-5.1, GPT-4o, DALL-E 3, Whisper, TTS)
- **APIs**: Google Maps, Places, Geocoding, Weather
- **Package Manager**: pnpm
- **Node Version**: 20.x

## Vercel Quick Start

1. **Clone & Install**
   ```bash
   git clone https://github.com/themusashimaru/jcil-ai-micro.git
   cd jcil-ai-micro
   pnpm install
   ```

2. **Set Environment Variables** (see checklist below)

3. **Deploy to Vercel**
   ```bash
   vercel --prod
   ```

4. **Configure Vercel Environment Variables** via dashboard or CLI

## Environment Variables Checklist

### Required for Build

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Redis (Upstash or Vercel KV)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# AI Provider
OPENAI_API_KEY=sk-xxx

# Google APIs
GOOGLE_MAPS_API_KEY=xxx
GOOGLE_PLACES_API_KEY=xxx
GOOGLE_WEATHER_API_KEY=xxx

# Optional
SENTRY_DSN=https://xxx@sentry.io/xxx
NODE_ENV=production
```

### Vercel Environment Setup

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add all variables above
3. Set variables for: Production, Preview, Development
4. Redeploy after adding variables

## Development

```bash
# Install dependencies
pnpm install

# Run dev server
pnpm dev

# Type check
pnpm typecheck

# Lint
pnpm lint

# Build
pnpm build

# Start production server
pnpm start
```

## Project Structure

```
jcil-ai-micro/
├── app/                      # Next.js App Router
│   ├── page.tsx             # Landing page
│   ├── chat/                # Main chat app
│   ├── tools/               # Tool-specific contexts
│   │   ├── email/
│   │   ├── essay/
│   │   ├── research/
│   │   ├── image/
│   │   └── ...
│   ├── admin/               # Admin panel
│   │   ├── dashboard/
│   │   ├── broadcasts/
│   │   ├── live/           # eDiscovery
│   │   ├── users/
│   │   ├── plans/
│   │   └── ...
│   ├── settings/
│   └── api/                # API routes
│       ├── auth/
│       ├── chat/           # SSE streaming
│       ├── upload/
│       └── admin/
├── src/
│   ├── components/ui/      # Reusable UI components
│   ├── lib/                # Core libraries
│   │   ├── supabase/
│   │   ├── redis/
│   │   ├── stripe/
│   │   ├── providers/      # AI provider clients
│   │   ├── moderation/
│   │   └── ...
│   ├── server/             # Server-side logic
│   ├── prompts/            # AI prompt templates
│   ├── workers/            # Background jobs
│   └── styles/             # Theme & styles
├── public/
│   ├── manifest.json       # PWA manifest
│   └── sw.js              # Service worker
├── docs/                   # Documentation
└── scripts/               # Utility scripts
```

## Features (Stubs Implemented)

### User App
- ✅ Chat interface with sidebar & streaming responses
- ✅ Glassmorphism UI (black theme)
- ✅ Tool launchers (Email, Essay, Research, Image, Video, etc.)
- ⏳ Auto-title & semantic search
- ⏳ Export (PDF/TXT/JSON)
- ⏳ Settings (profile enrichment, model prefs)
- ⏳ Daily devotionals widget

### Admin Panel (Mobile-First)
- ✅ Dashboard with KPIs & kill switches
- ✅ Broadcasts (targeted by plan)
- ✅ Internal/External inbox with AI draft assist
- ✅ Live chats & eDiscovery
- ✅ User management
- ✅ Plan editor
- ✅ Provider & routing config
- ✅ CMS pages editor
- ✅ Branding/white-label
- ✅ Moderation & safety tools

### Subscription Tiers
- **Free**: 10 msgs/day
- **Basic**: 100 msgs/day, no image/video gen
- **Pro**: 200 msgs/day, 5 image/video per day
- **Exec**: 1000 msgs/day, 10 image/video per day

## Security

- ✅ Supabase RLS for all user-scoped data
- ✅ Google OAuth only (no email/password)
- ✅ Rate limiting (Redis-backed)
- ✅ File upload validation (MIME, size)
- ✅ CSP, XSS/CSRF protection
- ⏳ Image moderation on upload
- ⏳ Content moderation (pre/post)
- ⏳ Audit logging for admin actions

## CI/CD

GitHub Actions runs on all pushes:
- Type checking
- Linting
- Build verification

See `.github/workflows/ci.yml`

## Documentation

- See `docs/ARCHITECTURE.md` for system architecture
- See `docs/ROUTING.md` for routing patterns
- See `docs/THEMING.md` for theme customization

## Roadmap

- [ ] Implement business logic for all stubs
- [ ] Add comprehensive test suite
- [ ] Set up Sentry for error tracking
- [ ] Implement real-time notifications
- [ ] Add analytics & monitoring
- [ ] Complete PWA offline support
- [ ] Implement voice input (Whisper)
- [ ] Build admin analytics dashboard

## Contributing

1. Create feature branch from `main`
2. Make changes with conventional commits
3. Open PR with clear description
4. Ensure CI passes

## License

Proprietary - All rights reserved

---

**Current Status**: Full scaffold with stub implementations. Chat UI implemented. Ready for feature development.
