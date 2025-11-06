# Subscription Tiers System

## Overview

JCIL.AI Slingshot 2.0 now supports multiple subscription tiers with different Claude models to optimize costs while providing value to paid users.

## Tier Structure

### 🆓 FREE TIER
- **Model:** Claude Haiku 4 (`claude-haiku-4-20250514`)
- **Pricing:** $0.25/MTok input, $1.25/MTok output
- **Features:**
  - Full chat functionality
  - Image uploads (vision)
  - All AI tools
  - 40 messages per minute rate limit

### 💎 PAID TIER
- **Model:** Claude Haiku 4.5 (`claude-haiku-4.5-20250514`)
- **Pricing:** $1/MTok input, $5/MTok output
- **Features:**
  - All free tier features
  - Newer, faster Haiku 4.5 model
  - Better performance and quality
  - Same rate limits (can be adjusted)

## Cost Comparison

**Free Tier (Haiku 4):**
- 4x cheaper than Haiku 4.5
- 12x cheaper than Sonnet 4

**Paid Tier (Haiku 4.5):**
- 3x cheaper than Sonnet 4
- Still affordable for scaled usage

## Database Setup

1. Run the SQL migration:
```bash
# In Supabase SQL Editor, run:
add-subscription-tier.sql
```

This will:
- Create `user_profiles` table
- Add `subscription_tier` column (free, paid, premium)
- Set up Row Level Security policies
- Auto-create profiles for new users (defaults to 'free')
- Backfill existing users as 'free'

## Managing User Tiers

### Via Supabase Dashboard

1. Go to Supabase Dashboard → Table Editor
2. Open `user_profiles` table
3. Find user by `id` (UUID from auth.users)
4. Update `subscription_tier` to `'paid'`

### Via SQL

```sql
-- Upgrade a user to paid tier
UPDATE public.user_profiles
SET subscription_tier = 'paid', updated_at = NOW()
WHERE id = 'USER_UUID_HERE';

-- Downgrade a user to free tier
UPDATE public.user_profiles
SET subscription_tier = 'free', updated_at = NOW()
WHERE id = 'USER_UUID_HERE';

-- View all paid users
SELECT id, subscription_tier, created_at, updated_at
FROM public.user_profiles
WHERE subscription_tier = 'paid';
```

## Testing the System

### Test Free Tier (Default)
1. Create a new user account
2. Send a chat message
3. Check server logs: Should see `🤖 Using model: claude-haiku-4-20250514 for tier: free`

### Test Paid Tier
1. Upgrade user in Supabase:
   ```sql
   UPDATE public.user_profiles
   SET subscription_tier = 'paid'
   WHERE id = 'YOUR_USER_ID';
   ```
2. Send a chat message
3. Check server logs: Should see `🤖 Using model: claude-haiku-4.5-20250514 for tier: paid`

## Future Enhancements

- [ ] Self-service tier upgrades (Stripe integration)
- [ ] Different rate limits per tier
- [ ] Usage analytics dashboard
- [ ] Admin panel for tier management
- [ ] Email notifications on tier changes
- [ ] Trial periods for paid tier

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
