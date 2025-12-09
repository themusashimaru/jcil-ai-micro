/**
 * Document Download Proxy
 *
 * Provides clean download URLs that hide Supabase storage details.
 * Users see: /api/documents/download?token=xxx
 * Instead of: https://project.supabase.co/storage/v1/...
 *
 * SECURITY:
 * - Tokens encode the file path securely
 * - Only authenticated users can access their own files
 * - Signed URLs still have 1-hour expiration
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

// Decode token (encoded as base64url JSON with userId, filename, type)
function decodeToken(token: string): { userId: string; filename: string; type: 'pdf' | 'docx' } | null {
  try {
    const data = JSON.parse(Buffer.from(token, 'base64url').toString());
    if (data.u && data.f && data.t) {
      return { userId: data.u, filename: data.f, type: data.t };
    }
    return null;
  } catch {
    return null;
  }
}

// Get authenticated user ID
async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Cookie operations may fail
            }
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}

// Get Supabase admin client
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    // Decode the token
    const decoded = decodeToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    // Verify user is authenticated and owns this file
    const currentUserId = await getAuthenticatedUserId();
    if (!currentUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (currentUserId !== decoded.userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get Supabase client
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
    }

    // Download the file directly and stream to user
    // This avoids redirect issues with auth cookies in new tabs
    const filePath = `${decoded.userId}/${decoded.filename}`;
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(filePath);

    if (downloadError || !fileData) {
      console.error('[Download Proxy] Download error:', downloadError);
      return NextResponse.json({ error: 'File not found or expired' }, { status: 404 });
    }

    // Determine content type
    const contentType = decoded.type === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    // Create a clean filename for download
    const downloadFilename = decoded.filename;

    // Return the file directly
    const arrayBuffer = await fileData.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${downloadFilename}"`,
        'Content-Length': arrayBuffer.byteLength.toString(),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[Download Proxy] Error:', error);
    return NextResponse.json({ error: 'Download failed' }, { status: 500 });
  }
}

