/**
 * CONTACT FORM API - External inbox submission
 * TODO: Implement contact form handler, spam filtering, admin notification
 */

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ success: true });
}
