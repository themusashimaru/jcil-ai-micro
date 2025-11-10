/**
 * AUTH CALLBACK ROUTE
 *
 * PURPOSE:
 * - Handle OAuth callback from Google
 * - Exchange code for session
 * - Redirect to /chat on success
 *
 * SECURITY/RLS NOTES:
 * - Validate state parameter
 * - PKCE flow for OAuth
 * - Set secure HTTP-only cookies
 *
 * RATE LIMITS:
 * - 10/min per IP
 *
 * DEPENDENCIES/ENVS:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * TODO:
 * - [ ] Implement OAuth callback handler
 * - [ ] Create user record if first login
 * - [ ] Set session cookies
 * - [ ] Redirect to intended destination
 *
 * TEST PLAN:
 * - Test successful OAuth flow
 * - Verify new user creation
 * - Test error handling
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ message: 'Auth callback - implementation pending' });
}
