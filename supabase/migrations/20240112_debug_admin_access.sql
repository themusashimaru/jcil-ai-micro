-- DEBUG: Check admin_users table contents
-- Run this in Supabase SQL Editor to see what's in the admin_users table

SELECT
    au.id,
    au.email,
    au.user_id,
    u.email as user_table_email,
    au.created_at
FROM public.admin_users au
LEFT JOIN public.users u ON au.user_id = u.id
ORDER BY au.created_at DESC;

-- Check if RLS is enabled
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'admin_users';

-- Check total count
SELECT COUNT(*) as total_admin_users FROM public.admin_users;
SELECT COUNT(*) as total_users FROM public.users;
