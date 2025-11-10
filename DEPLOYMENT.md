# Delta-2 Deployment Guide

## Quick Start

### 1. Environment Variables

Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Fill in your API keys and credentials.

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Run Development Server

```bash
pnpm dev
```

Visit http://localhost:3000

---

## Vercel Deployment

### Required Environment Variables

Configure these in Vercel Project Settings → Environment Variables:

#### Essential (Required)
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `XAI_API_KEY` - xAI API key for live search

#### Optional
- `OPENAI_API_KEY` - OpenAI API key (alternative provider)
- `UPSTASH_REDIS_REST_URL` - Upstash Redis URL (rate limiting)
- `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis token
- `STRIPE_SECRET_KEY` - Stripe secret key (payments)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key

### Deployment Steps

1. **Connect Repository**
   - Go to Vercel Dashboard
   - Import your GitHub repository
   - Select the branch to deploy

2. **Configure Environment Variables**
   - Go to Project Settings → Environment Variables
   - Add all required variables from above
   - Apply to Production, Preview, and Development

3. **Deploy**
   - Vercel will automatically deploy on push
   - Or manually trigger via Dashboard

### Common Issues

#### "Secret does not exist" Error
- Go to Vercel → Project Settings → Environment Variables
- Ensure all referenced secrets are created
- Don't reference secrets that don't exist

#### Lockfile Errors
- Ensure `pnpm-lock.yaml` is committed
- CI uses `--frozen-lockfile` by default
- Run `pnpm install` to regenerate if needed

---

## Supabase Setup

### 1. Create Project
- Go to https://supabase.com
- Create a new project
- Wait for database to provision

### 2. Get API Keys
- Go to Project Settings → API
- Copy `URL` → Set as `NEXT_PUBLIC_SUPABASE_URL`
- Copy `anon public` → Set as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Copy `service_role` → Set as `SUPABASE_SERVICE_ROLE_KEY`

### 3. Database Schema
```sql
-- Run in Supabase SQL Editor
-- TODO: Add schema migrations
```

---

## xAI API Setup

### 1. Get API Key
- Go to https://x.ai
- Create an account
- Generate API key
- Set as `XAI_API_KEY`

### 2. Features Enabled
- Live web search
- X/Twitter search
- News search
- Real-time citations

---

## CI/CD Configuration

### GitHub Actions

The project uses GitHub Actions for CI/CD. See `.github/workflows/` for configuration.

**Key Points:**
- Uses pnpm 10.x
- Runs typecheck, lint, and build
- Requires `pnpm-lock.yaml` to be committed
- Environment variables needed for build

---

## Production Checklist

- [ ] All environment variables configured
- [ ] Supabase project created and configured
- [ ] xAI API key obtained
- [ ] Stripe configured (if using payments)
- [ ] Redis configured (if using rate limiting)
- [ ] Domain configured in Vercel
- [ ] SSL certificate active
- [ ] Error monitoring configured
- [ ] Analytics configured

---

## Troubleshooting

### Build Fails
1. Check all environment variables are set
2. Verify `pnpm-lock.yaml` is up to date
3. Check TypeScript errors with `pnpm typecheck`
4. Check ESLint errors with `pnpm lint`

### Live Search Not Working
1. Verify `XAI_API_KEY` is set correctly
2. Check API key has proper permissions
3. Review browser console for errors
4. Check Vercel function logs

### Database Connection Issues
1. Verify Supabase URL and keys
2. Check Supabase project is active
3. Review RLS policies
4. Check database connection limits

---

## Support

For issues, please check:
- GitHub Issues
- Project README
- Vercel Documentation
- Supabase Documentation
