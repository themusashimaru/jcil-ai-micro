# JCIL.AI Rebuild Master Prompt - Gemini-Only Edition

## PROJECT OVERVIEW

Build a complete AI chat platform called **JCIL.AI** (Jesus Christ Is Lord) - a Christian conservative AI assistant platform using **Google Gemini as the sole AI provider**. The platform should be built with Next.js 14 (App Router), Supabase (auth + database), Vercel deployment, and Stripe for payments.

---

## BRAND IDENTITY

**Name:** JCIL.AI (Jesus Christ Is Lord)
**AI Assistant Name:** Slingshot 2.0
**Tagline:** "Speaking life into millions through technology that honors God"

**Brand Values:**
- Truth Over Trends (biblical truth, even when unpopular)
- Grace With Truth (speak truth in love)
- Protection Over Profit (protect hearts and minds)
- Eternal Perspective (every conversation matters)
- Technological Excellence for God's Glory

**Visual Identity:**
- Primary colors: Deep blue, gold accents
- Professional, clean, trustworthy design
- Cross/faith imagery subtle but present
- Mobile-first, PWA-capable

---

## TECH STACK

### Frontend
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- React components with streaming support
- PWA with service worker

### Backend
- Next.js API Routes
- Supabase (PostgreSQL + Auth + Storage)
- Redis/Upstash for rate limiting & queuing
- Vercel deployment

### AI Provider (GEMINI ONLY)
- @google/genai SDK (latest version)
- Model: gemini-2.0-flash (default)
- Built-in tools:
  - Google Search grounding (automatic)
  - Code Execution (Python)
- Native safety settings
- Streaming responses

### Payments
- Stripe Checkout
- Stripe Customer Portal
- Webhook handling for subscription events

---

## GEMINI CONFIGURATION

### API Key Rotation (Dual-Pool System)
```
Primary Pool (round-robin):
- GOOGLE_GENERATIVE_AI_API_KEY_1
- GOOGLE_GENERATIVE_AI_API_KEY_2
- GOOGLE_GENERATIVE_AI_API_KEY_3
... (unlimited)

Fallback Pool (emergency reserve):
- GOOGLE_GENERATIVE_AI_API_KEY_FALLBACK_1
- GOOGLE_GENERATIVE_AI_API_KEY_FALLBACK_2
... (unlimited)

Single Key (backward compatible):
- GOOGLE_GENERATIVE_AI_API_KEY
```

### Tier-Based Model Configuration
Admin panel should allow setting different models per subscription tier:

| Tier | Default Model | Description |
|------|---------------|-------------|
| Free | gemini-2.0-flash-lite | Lightweight, fast |
| Plus | gemini-2.0-flash | Balanced |
| Pro | gemini-2.0-flash | Full featured |
| Executive | gemini-1.5-pro | Premium model |

### Built-in Tools (Auto-Enabled)
```javascript
config.tools = [
  { googleSearch: {} },    // Real-time web search
  { codeExecution: {} },   // Python code execution
];
```

### Native Safety Settings
```javascript
safetySettings: [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
]
```

---

## SUBSCRIPTION TIERS

| Tier | Price | Tokens/Month | Features |
|------|-------|--------------|----------|
| Free | $0 | 10,000 (one-time trial) | Basic chat, limited history |
| Plus | $18/mo | 1,000,000 | Full chat, search, code execution |
| Pro | $30/mo | 3,000,000 | Priority support, all features |
| Executive | $99/mo | 5,000,000 | Premium model, all features |

---

## DATABASE SCHEMA (Supabase PostgreSQL)

### Core Tables

```sql
-- Users (synced with Supabase Auth)
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  subscription_tier TEXT DEFAULT 'free',  -- free, plus, pro, executive
  subscription_status TEXT DEFAULT 'active',
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  is_active BOOLEAN DEFAULT true,
  is_banned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin Users
CREATE TABLE admin_users (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  email TEXT UNIQUE NOT NULL,
  can_view_users BOOLEAN DEFAULT true,
  can_edit_users BOOLEAN DEFAULT true,
  can_view_conversations BOOLEAN DEFAULT true,
  can_manage_subscriptions BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'New Chat',
  tool_context TEXT,  -- general, email, study, research, code, scripture
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  retention_until TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '3 months')
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,  -- user, assistant, system
  content TEXT NOT NULL,
  model_used TEXT,
  tokens_used INTEGER,
  has_attachments BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Provider Settings (for admin model configuration)
CREATE TABLE provider_settings (
  id UUID PRIMARY KEY,
  active_provider TEXT DEFAULT 'gemini',
  provider_config JSONB DEFAULT '{"gemini": {"model": "gemini-2.0-flash"}}',
  models_by_tier JSONB DEFAULT '{
    "free": "gemini-2.0-flash-lite",
    "plus": "gemini-2.0-flash",
    "pro": "gemini-2.0-flash",
    "executive": "gemini-1.5-pro"
  }',
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Support Tickets
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  subject TEXT NOT NULL,
  status TEXT DEFAULT 'open',  -- open, in_progress, resolved, closed
  priority TEXT DEFAULT 'normal',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Passkeys (WebAuthn/Face ID/Touch ID)
CREATE TABLE user_passkeys (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  device_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## API ROUTES STRUCTURE

### Authentication
- `POST /api/auth/callback` - Supabase OAuth callback
- `POST /api/auth/signout` - Sign out user
- `POST /api/auth/webauthn/register` - Register passkey
- `POST /api/auth/webauthn/authenticate` - Authenticate with passkey

### Chat
- `POST /api/chat` - Main chat endpoint (streaming)
- `POST /api/chat/generate-title` - Auto-generate conversation title

### Conversations
- `GET /api/conversations` - List user conversations
- `GET /api/conversations/history` - Get conversation history
- `GET /api/conversations/[id]/messages` - Get messages for conversation
- `DELETE /api/conversations/[id]` - Delete conversation

### User
- `GET /api/user/subscription` - Get subscription status
- `GET /api/user/usage` - Get token usage
- `GET /api/user/is-admin` - Check admin status
- `POST /api/user/settings` - Update user settings
- `GET /api/user/export` - Export user data

### Admin
- `GET /api/admin/users` - List all users
- `GET /api/admin/users/[userId]` - Get user details
- `PUT /api/admin/users/[userId]` - Update user
- `GET /api/admin/provider` - Get provider settings
- `PUT /api/admin/provider` - Update provider/model settings
- `GET /api/admin/earnings` - Revenue analytics

### Stripe
- `POST /api/stripe/checkout` - Create checkout session
- `POST /api/stripe/portal` - Customer portal redirect
- `POST /api/stripe/webhook` - Handle Stripe events

### Documents
- `POST /api/documents/generate` - Generate PDF from markdown
- `POST /api/documents/native` - Generate DOCX/XLSX from JSON

### Features
- `GET /api/features` - Get available features for current provider

---

## RATE LIMITING & QUEUING

### Token Limits (Monthly)
```javascript
const TOKEN_LIMITS = {
  free: 10_000,        // One-time trial
  plus: 1_000_000,     // 1M/month
  pro: 3_000_000,      // 3M/month
  executive: 5_000_000 // 5M/month
};
```

### Request Queue
- Max concurrent requests: 50 (configurable)
- Queue timeout: 30 seconds
- Auto-expire stuck requests: 2 minutes
- Redis for distributed state (falls back to in-memory)

### Rate Limit Response
When user exceeds limits:
```json
{
  "error": "Token limit exceeded",
  "usage": 1000000,
  "limit": 1000000,
  "message": "You've reached your monthly token limit. Upgrade your plan or wait until next month."
}
```

---

## CHAT FEATURES

### Streaming Responses
- Real-time token streaming
- Graceful error handling mid-stream
- Automatic retry on rate limits

### Built-in Capabilities (Gemini decides automatically)
1. **Google Search** - Current events, news, weather, prices, fact-checking
2. **Code Execution** - Math, financial calculations, data analysis
3. **Document Generation** - PDF, DOCX, XLSX from structured content
4. **Image Analysis** - Vision/multimodal support for uploaded images

### Document Generation
- Resume/CV builder (DOCX)
- Spreadsheets (XLSX)
- Invoices (DOCX)
- PDF fallback for all document types

### Context Features
- Tool context (email, study, research, code, scripture)
- Conversation memory
- Auto-generated titles

---

## SYSTEM PROMPT PHILOSOPHY

**CRITICAL: Speak as a believer TO believers**

The AI should NOT say:
- "Christians believe that..."
- "From a Christian perspective..."
- "The Christian view is..."

The AI SHOULD say:
- "Scripture says..."
- "God's design for this is..."
- "Marriage is..." (direct statement)
- "We know from Scripture that..."

**Think of the AI as:**
- A pastor giving counsel
- A trusted Christian friend
- A wise mentor in the faith

**NOT as:**
- A religious studies professor
- A neutral academic
- An outsider describing Christianity

### Response Style
- Short, direct, Scripture-based
- 2-4 sentences for simple questions
- Don't invite endless debate
- State truth, cite Scripture, done

### AI Identity
- Name: Slingshot 2.0
- Never mention: OpenAI, GPT, ChatGPT, Google, Gemini
- If asked: "I'm Slingshot 2.0, the AI assistant for JCIL.ai"

---

## ADMIN PANEL FEATURES

### Dashboard
- Total users, revenue, active conversations
- Usage charts and analytics

### User Management
- View all users with search/filter
- Edit subscription tier
- Ban/unban users
- View user conversations

### Provider Settings
- Set active model per tier
- Configure model parameters
- View API key status

### Support Tickets
- View and respond to tickets
- Priority and status management

### Earnings Reports
- Revenue by tier
- MRR tracking
- Export to PDF/Excel

---

## LANDING PAGE SECTIONS

1. **Hero** - Main value proposition with CTA
2. **Features** - Chat, Search, Documents, Code
3. **Pricing** - Tier comparison table
4. **Testimonials** - User stories
5. **FAQ** - Common questions
6. **Footer** - Links, legal, contact

**Key Messaging:**
- "AI that honors your faith"
- "Truth without compromise"
- "Your conversations, protected"
- "Technology for the Kingdom"

---

## ENVIRONMENT VARIABLES

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Gemini (Primary)
GOOGLE_GENERATIVE_AI_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY_1=
GOOGLE_GENERATIVE_AI_API_KEY_2=
# ... add more as needed

# Gemini (Fallback)
GOOGLE_GENERATIVE_AI_API_KEY_FALLBACK_1=
# ... add more as needed

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_PLUS_PRICE_ID=
STRIPE_PRO_PRICE_ID=
STRIPE_EXECUTIVE_PRICE_ID=

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# App
NEXT_PUBLIC_SITE_URL=https://jcil.ai
NEXTAUTH_SECRET=

# Optional
WEBAUTHN_RP_ID=jcil.ai
WEBAUTHN_RP_NAME=JCIL.AI
```

---

## SECURITY REQUIREMENTS

1. **Authentication** - Supabase Auth with email/social login
2. **WebAuthn** - Passkeys for Face ID/Touch ID
3. **RLS Policies** - Row-level security on all tables
4. **Content Moderation** - Gemini native safety settings
5. **Rate Limiting** - Per-user token limits
6. **Data Retention** - 3-month auto-cleanup
7. **HTTPS Only** - Vercel handles SSL
8. **No External Data Sharing** - Privacy first

---

## MOBILE/PWA FEATURES

- Service worker for offline support
- Add to home screen prompt
- Push notifications (optional)
- Responsive design (mobile-first)
- Touch-friendly UI
- Dark mode support

---

## DEPLOYMENT CHECKLIST

1. Set up Supabase project
2. Run database migrations
3. Configure Stripe products/prices
4. Add environment variables to Vercel
5. Deploy to Vercel
6. Set up custom domain
7. Configure DNS
8. Test all features
9. Set up monitoring/alerts

---

## KEY IMPLEMENTATION NOTES

### Gemini Client Structure
```typescript
// Dual-pool API key rotation
function getGeminiClient(): GoogleGenAI {
  // Try primary pool (round-robin)
  // Fall back to fallback pool
  // Throw if all keys exhausted
}

// Streaming completion
async function createGeminiStreamingCompletion(options) {
  // Build config with tools and safety settings
  // Call generateContentStream
  // Return ReadableStream
}

// Non-streaming completion (for documents)
async function createGeminiCompletion(options) {
  // Build config with tools and safety settings
  // Call generateContent
  // Return text and metadata
}
```

### Chat Route Flow
1. Authenticate user
2. Check rate limits
3. Skip external moderation (Gemini handles it)
4. Get tier-specific model
5. Process request:
   - Document generation? → Non-streaming
   - Regular chat? → Streaming with tools
6. Stream response to client
7. Save to database
8. Update usage counters

---

This prompt contains everything needed to rebuild JCIL.AI with Gemini as the sole provider. Copy this into Google AI Studio or use with Claude/GPT to generate the codebase structure and implementation details.
