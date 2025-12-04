# Stripe Setup Guide for JCIL.AI

## Overview
This guide will help you configure Stripe for subscription payments on JCIL.AI.

## Prerequisites
- Stripe account (sign up at https://stripe.com)
- Access to Stripe Dashboard
- Vercel deployment with environment variables configured

---

## Step 1: Get API Keys

1. Go to https://dashboard.stripe.com/apikeys
2. Copy your **Publishable key** and **Secret key**
3. Add to Vercel environment variables:
   ```
   STRIPE_SECRET_KEY=sk_live_... (or sk_test_... for testing)
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_... (or pk_test_... for testing)
   ```

---

## Step 2: Create Products and Prices

### Basic Tier - $10/month
1. Go to https://dashboard.stripe.com/products
2. Click **"+ Add product"**
3. Configure:
   - **Name:** JCIL.AI Basic
   - **Description:** 100 messages per day, enhanced AI responses, priority support
   - **Pricing:** Recurring
   - **Price:** $10.00 USD
   - **Billing period:** Monthly
4. Click **"Save product"**
5. **Copy the Price ID** (starts with `price_...`)
6. Add to Vercel environment variables:
   ```
   STRIPE_PRICE_ID_BASIC=price_...
   ```

### Pro Tier - $20/month
1. Click **"+ Add product"**
2. Configure:
   - **Name:** JCIL.AI Pro
   - **Description:** 200 messages per day, premium AI, 5 image generations/day
   - **Pricing:** Recurring
   - **Price:** $20.00 USD
   - **Billing period:** Monthly
3. Click **"Save product"**
4. **Copy the Price ID**
5. Add to Vercel environment variables:
   ```
   STRIPE_PRICE_ID_PRO=price_...
   ```

### Executive Tier - $150/month
1. Click **"+ Add product"**
2. Configure:
   - **Name:** JCIL.AI Executive
   - **Description:** 1,000 messages per day, premium AI, 10 image generations/day, dedicated support
   - **Pricing:** Recurring
   - **Price:** $150.00 USD
   - **Billing period:** Monthly
3. Click **"Save product"**
4. **Copy the Price ID**
5. Add to Vercel environment variables:
   ```
   STRIPE_PRICE_ID_EXECUTIVE=price_...
   ```

---

## Step 3: Configure Webhooks

1. Go to https://dashboard.stripe.com/webhooks
2. Click **"+ Add endpoint"**
3. Configure:
   - **Endpoint URL:** `https://jcil.ai/api/stripe/webhook`
   - **Description:** JCIL.AI Subscription Events
   - **Events to send:** Select these events:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
4. Click **"Add endpoint"**
5. Click on the newly created endpoint
6. Click **"Reveal"** next to **Signing secret**
7. **Copy the webhook signing secret** (starts with `whsec_...`)
8. Add to Vercel environment variables:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

---

## Step 4: Configure Customer Portal (Optional but Recommended)

This allows users to manage their subscriptions, update payment methods, and view invoices.

1. Go to https://dashboard.stripe.com/settings/billing/portal
2. Click **"Activate"** or **"Configure"**
3. Configure settings:
   - **Headline:** Manage your JCIL.AI subscription
   - **Features:**
     - ✅ Allow customers to update payment methods
     - ✅ Allow customers to cancel subscriptions
     - ✅ Allow customers to view invoice history
   - **Business information:**
     - Company name: JCIL.AI
     - Support email: info@jcil.ai
4. Click **"Save changes"**

---

## Step 5: Update Vercel Environment Variables

Make sure all environment variables are set in Vercel:

```bash
# Site Configuration
NEXT_PUBLIC_SITE_URL=https://jcil.ai

# Stripe Keys
STRIPE_SECRET_KEY=sk_live_... (or sk_test_...)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_... (or pk_test_...)
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs
STRIPE_PRICE_ID_BASIC=price_...
STRIPE_PRICE_ID_PRO=price_...
STRIPE_PRICE_ID_EXECUTIVE=price_...

# Existing Variables
OPENAI_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

After adding/updating variables, **redeploy** your Vercel project.

---

## Step 6: Test the Integration

### Test Mode (Recommended First)
1. Use test API keys (sk_test_... and pk_test_...)
2. Use test webhook endpoint
3. Test with Stripe test cards:
   - **Success:** 4242 4242 4242 4242
   - **Decline:** 4000 0000 0000 0002
   - Any future expiry date, any CVC

### Test Flow
1. Go to https://jcil.ai
2. Click on a paid tier (Basic, Pro, or Executive)
3. Complete Stripe Checkout
4. Verify webhook received in Stripe Dashboard → Webhooks → [your endpoint]
5. Verify user subscription updated in Supabase:
   ```sql
   SELECT id, email, subscription_tier, subscription_status, stripe_customer_id
   FROM users
   WHERE email = 'test@example.com';
   ```
6. Verify subscription history logged:
   ```sql
   SELECT * FROM subscription_history ORDER BY created_at DESC LIMIT 5;
   ```

---

## Step 7: Go Live

### Switch to Production
1. Replace test keys with live keys in Vercel
2. Update webhook endpoint to production URL
3. Redeploy

### Enable Live Mode in Stripe
1. Go to https://dashboard.stripe.com
2. Toggle switch from "Test mode" to "Live mode" (top right)
3. Verify all products and webhooks are configured in Live mode

---

## Troubleshooting

### Webhook Not Receiving Events
- Verify webhook URL is correct: `https://jcil.ai/api/stripe/webhook`
- Check Stripe Dashboard → Webhooks → [endpoint] → "Attempted events"
- Verify `STRIPE_WEBHOOK_SECRET` matches the signing secret in Stripe
- Check Vercel logs for errors

### Checkout Session Not Creating
- Verify `STRIPE_SECRET_KEY` is set correctly
- Check that price IDs match the products in Stripe
- Look for errors in Vercel logs

### User Not Redirected After Payment
- Verify `NEXT_PUBLIC_SITE_URL` is set to `https://jcil.ai`
- Check success_url in checkout session creation

### Subscription Not Updating in Database
- Check webhook events in Stripe Dashboard
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- Review webhook handler logs in Vercel

---

## Support

For additional help:
- Stripe Documentation: https://stripe.com/docs
- Stripe Support: https://support.stripe.com
- JCIL.AI Issues: [Your GitHub repo]/issues

---

## Security Notes

- **Never** commit API keys to git
- Use test mode for development
- Monitor webhook events for suspicious activity
- Regularly review Stripe Dashboard for anomalies
