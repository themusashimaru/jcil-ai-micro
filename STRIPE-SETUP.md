# Stripe Integration Setup Guide

## Overview

This guide walks you through setting up Stripe subscriptions for JCIL.AI Slingshot 2.0.

---

## Prerequisites

- Stripe account (test mode for development)
- Products created in Stripe Dashboard
- Price IDs for each tier
- Vercel project with environment variables set

---

## Step 1: Database Migration

Run this SQL in Supabase SQL Editor:

```sql
-- File: add-stripe-customer-id.sql
```

Copy and paste the contents of `add-stripe-customer-id.sql` to add Stripe customer tracking to your database.

---

## Step 2: Environment Variables

### Required Variables (Already Set in Vercel):

```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID_BASIC=price_1SQMllAzsKRnKFXSMk95XaNJ
STRIPE_PRICE_ID_PRO=price_1SQMnIAzsKRnKFXSTMwRPRy5
STRIPE_PRICE_ID_EXECUTIVE=price_1SQMpUAzsKRnKFXSZaiRLpOz
```

### Additional Required Variable:

You need to add ONE more environment variable for webhooks:

```
STRIPE_WEBHOOK_SECRET=whsec_...
```

**How to get it:**
1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Endpoint URL: `https://your-app.vercel.app/api/stripe/webhook`
4. Events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Click "Add endpoint"
6. Copy the **Signing secret** (starts with `whsec_...`)
7. Add it to Vercel as `STRIPE_WEBHOOK_SECRET`

### Optional Variable:

```
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

(Used for success/cancel redirect URLs. Defaults to http://localhost:3000 if not set)

---

## Step 3: Stripe Webhook Configuration

### Development (localhost testing):

Install Stripe CLI:
```bash
# Mac
brew install stripe/stripe-cli/stripe

# Linux/Windows - Download from https://stripe.com/docs/stripe-cli
```

Listen to webhooks locally:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

This will give you a webhook secret starting with `whsec_...` - use this for local testing.

### Production (Vercel):

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Endpoint URL: `https://your-app.vercel.app/api/stripe/webhook`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Click "Add endpoint"
6. Copy the signing secret and add to Vercel environment variables

---

## Step 4: Install Dependencies

```bash
npm install stripe
```

(Or push to Vercel and it will auto-install)

---

## Step 5: Test the Flow

### Test Checkout (Development):

1. Go to http://localhost:3000/settings
2. Click "Upgrade" on Basic ($20/mo)
3. Use Stripe test card: `4242 4242 4242 4242`
4. Expiry: Any future date (e.g., 12/34)
5. CVC: Any 3 digits (e.g., 123)
6. ZIP: Any 5 digits (e.g., 12345)
7. Click "Subscribe"
8. Should redirect back to settings with success message

### Verify Webhook:

Check your terminal running `stripe listen` - you should see:
```
✅ checkout.session.completed
```

Check your Supabase `user_profiles` table:
```sql
SELECT subscription_tier, daily_message_limit, subscription_status
FROM user_profiles
WHERE id = 'YOUR_USER_ID';
```

Should show:
- `subscription_tier` = 'basic'
- `daily_message_limit` = 30
- `subscription_status` = 'active'

### Test Subscription Management:

1. Go to settings page
2. You should now see "Manage Subscription" button
3. Click it → Opens Stripe Customer Portal
4. You can cancel subscription, update payment, view invoices

### Test Cancellation:

1. In Customer Portal, click "Cancel plan"
2. Confirm cancellation
3. Webhook fires: `customer.subscription.deleted`
4. Check database - should be back to:
   - `subscription_tier` = 'free'
   - `daily_message_limit` = 5
   - `subscription_status` = 'canceled'

---

## Step 6: Switch to Production

When ready to go live:

1. **Switch Stripe to Live Mode:**
   - Go to Stripe Dashboard
   - Toggle from "Test mode" to "Live mode" (top right)

2. **Get Live API Keys:**
   - Go to Developers → API Keys
   - Copy **Live Publishable Key** (`pk_live_...`)
   - Copy **Live Secret Key** (`pk_live_...`)

3. **Update Vercel Environment Variables:**
   ```
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_SECRET_KEY=sk_live_...
   ```

4. **Create Live Webhook:**
   - In Live mode, go to Developers → Webhooks
   - Add endpoint with your production URL
   - Copy signing secret
   - Update `STRIPE_WEBHOOK_SECRET` in Vercel

5. **Redeploy on Vercel**

---

## API Endpoints

### `/api/stripe/checkout` (POST)

Creates a Stripe Checkout session for subscription purchase.

**Request:**
```json
{
  "tier": "basic" | "pro" | "executive"
}
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/..."
}
```

**Usage:**
```typescript
const response = await fetch('/api/stripe/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tier: 'basic' }),
});
const { url } = await response.json();
window.location.href = url; // Redirect to Stripe Checkout
```

---

### `/api/stripe/webhook` (POST)

Listens to Stripe events and updates database.

**Events Handled:**
- `checkout.session.completed` - User completed checkout, activate subscription
- `customer.subscription.updated` - Subscription changed (upgrade/downgrade)
- `customer.subscription.deleted` - User canceled, downgrade to free
- `invoice.payment_failed` - Payment failed, mark as past_due

**Webhook Secret:** Required in `STRIPE_WEBHOOK_SECRET` environment variable

---

### `/api/stripe/portal` (POST)

Creates a Stripe Customer Portal session for subscription management.

**Response:**
```json
{
  "url": "https://billing.stripe.com/..."
}
```

**Usage:**
```typescript
const response = await fetch('/api/stripe/portal', { method: 'POST' });
const { url } = await response.json();
window.location.href = url; // Redirect to Customer Portal
```

---

## Database Schema

### `user_profiles` Table (Updated):

```sql
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY,
  subscription_tier TEXT DEFAULT 'free', -- free, basic, pro, executive
  daily_message_limit INTEGER DEFAULT 5,
  monthly_price NUMERIC DEFAULT 0,
  stripe_customer_id TEXT,           -- NEW
  stripe_subscription_id TEXT,       -- NEW
  subscription_status TEXT,          -- NEW: inactive, active, canceled, past_due
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

---

## Troubleshooting

### Webhook not firing:

1. Check webhook endpoint URL is correct
2. Verify `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard
3. Check Vercel logs for errors
4. Use `stripe listen` for local testing

### Checkout session not creating:

1. Verify price IDs are correct
2. Check `STRIPE_SECRET_KEY` is set
3. Check Vercel logs for Stripe API errors

### Subscription not upgrading user:

1. Check webhook logs in Stripe Dashboard → Developers → Webhooks
2. Verify webhook secret matches
3. Check database - does user have `stripe_customer_id`?
4. Check Vercel logs for database errors

---

## Support

For issues:
1. Check Stripe Dashboard → Developers → Logs
2. Check Vercel logs
3. Check Supabase logs
4. Search Stripe docs: https://stripe.com/docs

---

## Security Notes

- ⚠️ NEVER commit API keys to git
- ⚠️ Always verify webhook signatures
- ⚠️ Use test mode for development
- ⚠️ Rotate keys if exposed
- ✅ All secrets stored in Vercel environment variables
- ✅ Webhook verification built-in
- ✅ Row Level Security on database

---

## Next Steps

After Stripe is working:
- [ ] Add email notifications for subscription events
- [ ] Add grace period for failed payments
- [ ] Add annual billing option (save 20%)
- [ ] Add referral program
- [ ] Add usage analytics dashboard
