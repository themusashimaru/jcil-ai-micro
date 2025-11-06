-- Add Stripe customer ID to user profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive';

-- Create index for faster Stripe customer lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer
  ON public.user_profiles(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_subscription
  ON public.user_profiles(stripe_subscription_id);

-- Add comments
COMMENT ON COLUMN public.user_profiles.stripe_customer_id IS 'Stripe customer ID for billing';
COMMENT ON COLUMN public.user_profiles.stripe_subscription_id IS 'Active Stripe subscription ID';
COMMENT ON COLUMN public.user_profiles.subscription_status IS 'Subscription status: inactive, active, canceled, past_due';
