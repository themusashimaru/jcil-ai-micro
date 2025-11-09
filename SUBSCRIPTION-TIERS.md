# Subscription Tiers System

## Overview

JCIL.AI Slingshot 2.0 now supports multiple subscription tiers with daily message limits and different Claude models to optimize costs while providing value to paid users.

## Tier Structure

### 🆓 FREE TIER
- **Price:** $0/month
- **Daily Limit:** 10 messages per day
- **Model:** Claude Haiku 4 (`claude-haiku-4-20250514`)
- **API Cost:** $0.25/MTok input, $1.25/MTok output
- **Features:**
  - Full chat functionality
  - Image uploads (vision)
  - Basic AI tools
  - 40 messages per minute burst rate limit

### 📘 BASIC TIER
- **Price:** $12/month
- **Daily Limit:** 30 messages per day
- **Model:** Claude Haiku 4.5 (`claude-haiku-4.5-20250514`)
- **API Cost:** $1/MTok input, $5/MTok output
- **Features:**
  - All free tier features
  - Newer, faster Haiku 4.5 model
  - Better performance and quality
  - 3x more messages than free
  - Access to professional tools

### 🚀 PRO TIER
- **Price:** $30/month
- **Daily Limit:** 100 messages per day
- **Model:** Claude Haiku 4.5 (`claude-haiku-4.5-20250514`)
- **API Cost:** $1/MTok input, $5/MTok output
- **Features:**
  - All basic tier features
  - 10x more messages than free
  - Access to AI assistants
  - Best for power users

### 💼 EXECUTIVE TIER
- **Price:** $150/month
- **Daily Limit:** 200 messages per day
- **Model:** Claude Haiku 4.5 (`claude-haiku-4.5-20250514`)
- **API Cost:** $1/MTok input, $5/MTok output
- **Features:**
  - All pro tier features
  - 20x more messages than free
  - Priority access to all features
  - Premium support (coming soon)
  - **Note:** Can be upgraded to Sonnet 4 if needed

## Cost Comparison

**Free Tier (Haiku 4):**
- 4x cheaper than Haiku 4.5
- 12x cheaper than Sonnet 4
- Perfect for casual users

**Paid Tiers (Haiku 4.5):**
- 3x cheaper than Sonnet 4
- Better quality than Haiku 4
- Still affordable for scaled usage

## Database Setup

### Step 1: Initial Setup (if not done already)
```bash
# In Supabase SQL Editor, run:
add-subscription-tier.sql
```

### Step 2: Add Daily Limits and New Tiers
```bash
# In Supabase SQL Editor, run:
update-subscription-tiers-with-limits.sql
```

This will:
- Create `user_profiles` table with tier and pricing info
- Add `daily_usage` table to track message counts per day
- Set up functions for limit checking and usage tracking
- Auto-create profiles for new users (defaults to 'free', 5 messages/day)
- Backfill existing users as 'free' tier
- Set up automatic daily reset (records are dated)

## Managing User Tiers

### Via Supabase Dashboard

1. Go to Supabase Dashboard → Table Editor
2. Open `user_profiles` table
3. Find user by `id` (UUID from auth.users)
4. Update `subscription_tier` and `daily_message_limit`:
   - **free:** tier='free', limit=10, price=0
   - **basic:** tier='basic', limit=30, price=12
   - **pro:** tier='pro', limit=100, price=30
   - **executive:** tier='executive', limit=200, price=150

### Via SQL

```sql
-- Upgrade user to BASIC tier ($12/mo, 30 messages/day)
UPDATE public.user_profiles
SET subscription_tier = 'basic',
    daily_message_limit = 30,
    monthly_price = 12,
    updated_at = NOW()
WHERE id = 'USER_UUID_HERE';

-- Upgrade user to PRO tier ($30/mo, 100 messages/day)
UPDATE public.user_profiles
SET subscription_tier = 'pro',
    daily_message_limit = 100,
    monthly_price = 30,
    updated_at = NOW()
WHERE id = 'USER_UUID_HERE';

-- Upgrade user to EXECUTIVE tier ($150/mo, 200 messages/day)
UPDATE public.user_profiles
SET subscription_tier = 'executive',
    daily_message_limit = 200,
    monthly_price = 150,
    updated_at = NOW()
WHERE id = 'USER_UUID_HERE';

-- Downgrade user to FREE tier
UPDATE public.user_profiles
SET subscription_tier = 'free',
    daily_message_limit = 10,
    monthly_price = 0,
    updated_at = NOW()
WHERE id = 'USER_UUID_HERE';

-- View all users by tier
SELECT subscription_tier, COUNT(*) as user_count, SUM(monthly_price) as monthly_revenue
FROM public.user_profiles
GROUP BY subscription_tier
ORDER BY monthly_price DESC;

-- View today's usage for a user
SELECT u.subscription_tier, u.daily_message_limit,
       COALESCE(d.message_count, 0) as used_today,
       u.daily_message_limit - COALESCE(d.message_count, 0) as remaining
FROM public.user_profiles u
LEFT JOIN public.daily_usage d ON d.user_id = u.id AND d.usage_date = CURRENT_DATE
WHERE u.id = 'USER_UUID_HERE';
```

## Testing the System

### Test Free Tier (Default - 10 messages/day)
1. Create a new user account
2. Send a chat message
3. Check server logs for:
   - `👤 User {id} tier: free`
   - `📊 Daily usage: 1/10 for tier: free`
   - `🤖 Using model: claude-haiku-4-20250514 for tier: free`
   - `✅ Daily usage incremented for user {id}`
4. Send 9 more messages (total 10)
5. Try sending an 11th message - should get limit error:
   ```json
   {
     "ok": false,
     "error": "Daily message limit reached (10 messages per day for free tier). Upgrade your plan or try again tomorrow.",
     "limitExceeded": true
   }
   ```

### Test Basic Tier (30 messages/day)
1. Upgrade user in Supabase:
   ```sql
   UPDATE public.user_profiles
   SET subscription_tier = 'basic', daily_message_limit = 30, monthly_price = 12
   WHERE id = 'YOUR_USER_ID';
   ```
2. Send a chat message
3. Check server logs: Should see `🤖 Using model: claude-haiku-4.5-20250514 for tier: basic`
4. Verify you can send 30 messages total

### Test Pro Tier (100 messages/day)
1. Upgrade to pro tier
2. Verify daily limit is 100 messages
3. Model should still be Haiku 4.5

### Test Executive Tier (200 messages/day)
1. Upgrade to executive tier
2. Verify daily limit is 200 messages
3. Model should be Haiku 4.5 (can upgrade to Sonnet 4 later if needed)

## Daily Limit Reset

**How it works:**
- Daily limits are tracked by date (CURRENT_DATE in database)
- Each user has one row per day in `daily_usage` table
- When a new day starts (midnight), new usage records are created automatically
- Old records are kept for 90 days for analytics, then deleted by cleanup function

**Manual reset for testing:**
```sql
-- Reset a user's daily count (delete today's record)
DELETE FROM public.daily_usage
WHERE user_id = 'USER_UUID_HERE'
  AND usage_date = CURRENT_DATE;

-- Clear all old usage records (90+ days old)
SELECT public.cleanup_old_usage();
```

## Monitoring & Analytics

```sql
-- View top users by message count today
SELECT u.email, p.subscription_tier, d.message_count, p.daily_message_limit
FROM public.daily_usage d
JOIN auth.users u ON u.id = d.user_id
JOIN public.user_profiles p ON p.id = d.user_id
WHERE d.usage_date = CURRENT_DATE
ORDER BY d.message_count DESC
LIMIT 20;

-- Revenue report by tier
SELECT subscription_tier,
       COUNT(*) as users,
       SUM(monthly_price) as monthly_revenue,
       SUM(daily_message_limit) as total_daily_capacity
FROM public.user_profiles
WHERE subscription_tier != 'free'
GROUP BY subscription_tier
ORDER BY monthly_revenue DESC;

-- Daily usage stats
SELECT
  p.subscription_tier,
  COUNT(DISTINCT d.user_id) as active_users,
  SUM(d.message_count) as total_messages,
  AVG(d.message_count) as avg_messages_per_user
FROM public.daily_usage d
JOIN public.user_profiles p ON p.id = d.user_id
WHERE d.usage_date = CURRENT_DATE
GROUP BY p.subscription_tier;
```

## Future Enhancements

- [ ] Self-service tier upgrades (Stripe integration)
- [ ] Token-based limits (instead of message count)
- [ ] Usage analytics dashboard
- [ ] Admin panel for tier management
- [ ] Email notifications on tier changes
- [ ] Trial periods for paid tier
- [ ] Rollover unused messages (bonus feature)
- [ ] Upgrade Executive tier to Sonnet 4

## API Changes

The tier system is transparent to the frontend. The API automatically:
1. Fetches user's subscription tier from database
2. Selects appropriate Claude model
3. Logs model selection for monitoring
4. Returns responses as normal

No frontend changes required! 🎉

## Monitoring

Check your logs for:
- `👤 User {id} tier: {tier}` - Shows what tier user is on
- `🤖 Using model: {model} for tier: {tier}` - Confirms model selection

## Support

For questions about the tier system, contact the development team.
