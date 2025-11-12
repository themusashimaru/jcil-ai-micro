# SUPABASE SETUP GUIDE - JCIL AI MICRO

Complete step-by-step guide to set up your Supabase backend with all security and data retention features.

---

## 📋 PREREQUISITES

- ✅ Supabase project created
- ✅ Environment keys configured in `.env.local` and Vercel
- ✅ Connection tested successfully

---

## 🚀 STEP 1: RUN DATABASE SCHEMA

### 1.1 Open Supabase SQL Editor

1. Go to https://supabase.com/dashboard
2. Select your project: `kxsaxrnnhjmhtrzarjgh`
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### 1.2 Copy and Run Schema

1. Open `supabase-schema.sql` file
2. Copy **ALL contents**
3. Paste into Supabase SQL Editor
4. Click **Run** (or press Cmd/Ctrl + Enter)

**Expected Output:**
```
✓ Tables created successfully
✓ Indexes created
✓ Triggers created
✓ Functions created
✓ Views created
NOTICE: JCIL-AI-MICRO DATABASE SCHEMA INSTALLED SUCCESSFULLY
```

---

## 🔒 STEP 2: ENABLE ROW LEVEL SECURITY

### 2.1 Run RLS Policies

1. In Supabase SQL Editor, click **New Query**
2. Open `supabase-rls-policies.sql` file
3. Copy **ALL contents**
4. Paste into Supabase SQL Editor
5. Click **Run**

**Expected Output:**
```
✓ RLS enabled on all tables
✓ Security policies created
✓ Admin functions created
NOTICE: ROW LEVEL SECURITY POLICIES INSTALLED SUCCESSFULLY
```

---

## 📦 STEP 3: CREATE STORAGE BUCKET

### 3.1 Create User Uploads Bucket

1. Go to **Storage** in left sidebar
2. Click **New Bucket**
3. Configure:
   - **Name:** `user-uploads`
   - **Public:** ❌ OFF (private bucket)
   - **File size limit:** 50 MB
   - **Allowed MIME types:** Leave empty (allow all)
4. Click **Create Bucket**

### 3.2 Configure Storage Policies

The storage policies are already created in the RLS script, but verify:

1. Click on `user-uploads` bucket
2. Click **Policies** tab
3. You should see:
   - ✅ "Users can upload own files"
   - ✅ "Users can view own files"
   - ✅ "Users can delete own files"
   - ✅ "Admins can view all files"

---

## 🔐 STEP 4: CONFIGURE AUTHENTICATION

### 4.1 Enable Google OAuth

1. Go to **Authentication** → **Providers**
2. Find **Google** provider
3. Toggle **Enabled** to ON
4. Configure:
   - **Client ID:** (from Google Cloud Console)
   - **Client Secret:** (from Google Cloud Console)
   - **Redirect URL:** Copy this URL, you'll need it in Google Console

### 4.2 Get Google OAuth Credentials

1. Go to https://console.cloud.google.com
2. Create new project or select existing
3. Go to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure:
   - **Application type:** Web application
   - **Authorized JavaScript origins:**
     - `http://localhost:3000`
     - `https://your-domain.vercel.app`
   - **Authorized redirect URIs:**
     - `https://kxsaxrnnhjmhtrzarjgh.supabase.co/auth/v1/callback`
6. Copy **Client ID** and **Client Secret** back to Supabase

### 4.3 Configure Email Templates (Optional)

1. Go to **Authentication** → **Email Templates**
2. Customize:
   - Confirm signup
   - Reset password
   - Magic link

---

## ⏰ STEP 5: SET UP AUTO-DELETION (3-Month Retention)

### 5.1 Enable pg_cron Extension

1. Go to **Database** → **Extensions**
2. Search for `pg_cron`
3. Click **Enable**

### 5.2 Create Cron Job

1. Go to **SQL Editor** → **New Query**
2. Paste this code:

```sql
-- Schedule daily cleanup at 2 AM UTC
SELECT cron.schedule(
    'delete-expired-data',
    '0 2 * * *', -- Every day at 2 AM
    $$SELECT delete_expired_data()$$
);
```

3. Click **Run**

### 5.3 Verify Cron Job

```sql
-- Check scheduled jobs
SELECT * FROM cron.job;
```

You should see `delete-expired-data` job listed.

---

## 👤 STEP 6: VERIFY ADMIN ACCESS

### 6.1 Check Admin User

1. Go to **SQL Editor** → **New Query**
2. Run:

```sql
SELECT * FROM public.admin_users WHERE email = 'm.moser338@gmail.com';
```

3. You should see your admin record

### 6.2 Test Admin Access

After logging in with `m.moser338@gmail.com`, you'll have full access to:
- View all users
- Edit user accounts
- View all conversations
- Export data
- Ban users
- Manage subscriptions

---

## 📊 STEP 7: INITIALIZE DAILY STATS

### 7.1 Create First Stats Record

1. Go to **SQL Editor** → **New Query**
2. Run:

```sql
INSERT INTO public.daily_stats (stat_date)
VALUES (CURRENT_DATE)
ON CONFLICT (stat_date) DO NOTHING;
```

### 7.2 Schedule Daily Stats Update (Optional)

```sql
-- Update stats daily at 11:59 PM
SELECT cron.schedule(
    'update-daily-stats',
    '59 23 * * *',
    $$
    INSERT INTO public.daily_stats (
        stat_date,
        total_users,
        active_users,
        free_users,
        basic_users,
        pro_users,
        executive_users,
        total_messages,
        total_conversations
    )
    SELECT
        CURRENT_DATE,
        COUNT(*) as total_users,
        COUNT(CASE WHEN last_login_at > NOW() - INTERVAL '24 hours' THEN 1 END) as active_users,
        COUNT(CASE WHEN subscription_tier = 'free' THEN 1 END) as free_users,
        COUNT(CASE WHEN subscription_tier = 'basic' THEN 1 END) as basic_users,
        COUNT(CASE WHEN subscription_tier = 'pro' THEN 1 END) as pro_users,
        COUNT(CASE WHEN subscription_tier = 'executive' THEN 1 END) as executive_users,
        (SELECT SUM(message_count) FROM public.conversations WHERE deleted_at IS NULL) as total_messages,
        (SELECT COUNT(*) FROM public.conversations WHERE deleted_at IS NULL) as total_conversations
    FROM public.users
    WHERE deleted_at IS NULL
    ON CONFLICT (stat_date) DO UPDATE SET
        total_users = EXCLUDED.total_users,
        active_users = EXCLUDED.active_users,
        free_users = EXCLUDED.free_users,
        basic_users = EXCLUDED.basic_users,
        pro_users = EXCLUDED.pro_users,
        executive_users = EXCLUDED.executive_users,
        total_messages = EXCLUDED.total_messages,
        total_conversations = EXCLUDED.total_conversations,
        updated_at = NOW();
    $$
);
```

---

## 🧪 STEP 8: TEST THE SETUP

### 8.1 Test User Creation

```sql
-- Create test user
INSERT INTO public.users (email, full_name, subscription_tier)
VALUES ('test@example.com', 'Test User', 'free')
RETURNING *;
```

### 8.2 Test Conversation Creation

```sql
-- Create test conversation (replace USER_ID with the ID from previous query)
INSERT INTO public.conversations (user_id, title, tool_context)
VALUES ('USER_ID_HERE', 'Test Chat', 'general')
RETURNING *;
```

### 8.3 Test Message Creation

```sql
-- Create test message (replace IDs)
INSERT INTO public.messages (conversation_id, user_id, role, content)
VALUES ('CONVERSATION_ID_HERE', 'USER_ID_HERE', 'user', 'Hello, this is a test message')
RETURNING *;
```

### 8.4 Test RLS Policies

Try querying as different users to verify RLS is working.

### 8.5 Clean Up Test Data

```sql
-- Delete test data
DELETE FROM public.users WHERE email = 'test@example.com';
```

---

## 🔄 STEP 9: MANUAL DATA RETENTION TEST

### 9.1 Test Expiration Function

```sql
-- Manually run the deletion function
SELECT delete_expired_data();
```

This should soft-delete any data older than 3 months.

### 9.2 Check Deleted Data

```sql
-- View soft-deleted conversations
SELECT id, title, deleted_at, retention_until
FROM public.conversations
WHERE deleted_at IS NOT NULL;
```

---

## ✅ VERIFICATION CHECKLIST

After completing all steps, verify:

- [ ] All tables created successfully
- [ ] RLS policies enabled on all tables
- [ ] Storage bucket `user-uploads` created with policies
- [ ] Google OAuth configured
- [ ] Admin user (m.moser338@gmail.com) exists
- [ ] pg_cron extension enabled
- [ ] Auto-deletion cron job scheduled
- [ ] Daily stats initialized
- [ ] Test user/conversation/message created successfully
- [ ] RLS policies working (users can only see own data)
- [ ] Admin can view all data

---

## 🔧 TROUBLESHOOTING

### Issue: RLS blocks all access

**Solution:** Check if user is authenticated and has proper user record.

```sql
-- Check authentication
SELECT auth.jwt();

-- Create user record if missing
INSERT INTO public.users (id, email)
VALUES (auth.uid(), auth.jwt() ->> 'email')
ON CONFLICT (id) DO NOTHING;
```

### Issue: Admin can't access data

**Solution:** Verify admin user exists.

```sql
-- Add admin if missing
INSERT INTO public.admin_users (email)
VALUES ('m.moser338@gmail.com')
ON CONFLICT (email) DO NOTHING;
```

### Issue: Storage upload fails

**Solution:** Check bucket policies and folder structure.

Files should be uploaded to: `user-uploads/{user_id}/{filename}`

### Issue: Cron job not running

**Solution:** Check cron job status.

```sql
-- View cron job history
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

---

## 🎉 NEXT STEPS

After Supabase is fully configured:

1. **Implement Authentication** - Connect login/signup pages to Supabase Auth
2. **Add Stripe Integration** - For subscription management
3. **Build Admin Panel** - Connect admin UI to database
4. **Implement Rate Limiting** - Using Redis and subscription tiers
5. **Add Export Functionality** - PDF/Excel export for conversations
6. **Test Security** - Penetration testing for SQL injection, XSS, etc.

---

## 📞 SUPPORT

If you encounter issues:
- Check Supabase logs: Dashboard → Logs
- Check RLS policies: Dashboard → Authentication → Policies
- Check storage policies: Dashboard → Storage → Policies
- Review error messages in SQL Editor

---

**Database Version:** 1.0
**Last Updated:** 2025-11-12
**Admin:** m.moser338@gmail.com
