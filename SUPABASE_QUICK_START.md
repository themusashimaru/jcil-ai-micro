# 🚀 SUPABASE QUICK START

**Get your database running in 5 minutes!**

---

## STEP 1: Run Database Schema

1. Go to https://supabase.com/dashboard/project/kxsaxrnnhjmhtrzarjgh/sql/new
2. Copy contents of `supabase-schema.sql`
3. Paste and click **Run**
4. Wait for success message

---

## STEP 2: Enable Security

1. Click **New Query** in SQL Editor
2. Copy contents of `supabase-rls-policies.sql`
3. Paste and click **Run**
4. Wait for success message

---

## STEP 3: Create Storage Bucket

1. Go to https://supabase.com/dashboard/project/kxsaxrnnhjmhtrzarjgh/storage/buckets
2. Click **New Bucket**
3. Name: `user-uploads`
4. Public: **OFF**
5. Click **Create**

---

## STEP 4: Enable Auto-Deletion

1. Go to SQL Editor → **New Query**
2. Paste this:

```sql
-- Enable pg_cron first (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup at 2 AM UTC
SELECT cron.schedule(
    'delete-expired-data',
    '0 2 * * *',
    $$SELECT delete_expired_data()$$
);
```

3. Click **Run**

---

## STEP 5: Configure Google OAuth

1. Go to https://supabase.com/dashboard/project/kxsaxrnnhjmhtrzarjgh/auth/providers
2. Enable **Google**
3. Get credentials from https://console.cloud.google.com
4. Add redirect URL: `https://kxsaxrnnhjmhtrzarjgh.supabase.co/auth/v1/callback`

---

## ✅ VERIFY SETUP

Run this to check everything:

```sql
-- Check tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check admin user
SELECT * FROM public.admin_users;

-- Check cron jobs
SELECT * FROM cron.job;
```

You should see:
- ✅ 12 tables created
- ✅ Admin user (m.moser338@gmail.com)
- ✅ 1 cron job scheduled

---

## 🎉 DONE!

Your database is ready. See `SUPABASE_SETUP_GUIDE.md` for detailed instructions.

**Next:** Implement authentication in your Next.js app.
