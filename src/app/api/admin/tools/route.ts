export const runtime = 'nodejs';

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET - Fetch all tools (optionally filtered by category)
export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // Verify admin access
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const categoryKey = searchParams.get('category');

    let query = supabase
      .from('tools')
      .select('*')
      .order('display_order', { ascending: true });

    if (categoryKey) {
      query = query.eq('category_key', categoryKey);
    }

    const { data: tools, error } = await query;

    if (error) {
      console.error('Error fetching tools:', error);
      return NextResponse.json({ error: 'Failed to fetch tools' }, { status: 500 });
    }

    return NextResponse.json({ tools });
  } catch (error: any) {
    console.error('Error in GET /api/admin/tools:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create new tool
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Verify admin access
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const {
      tool_key,
      tool_name,
      category_key,
      description,
      welcome_message,
      system_prompt,
      display_order,
      is_active,
      allowed_tiers
    } = body;

    if (!tool_key || !tool_name || !category_key || !description || !welcome_message || !system_prompt) {
      return NextResponse.json({
        error: 'tool_key, tool_name, category_key, description, welcome_message, and system_prompt are required'
      }, { status: 400 });
    }

    // Insert new tool
    const { data, error } = await supabase
      .from('tools')
      .insert({
        tool_key,
        tool_name,
        category_key,
        description,
        welcome_message,
        system_prompt,
        display_order: display_order || 0,
        is_active: is_active !== undefined ? is_active : true,
        allowed_tiers: allowed_tiers || ['free', 'basic', 'pro', 'executive'],
        updated_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating tool:', error);
      return NextResponse.json({ error: 'Failed to create tool' }, { status: 500 });
    }

    return NextResponse.json({ success: true, tool: data });
  } catch (error: any) {
    console.error('Error in POST /api/admin/tools:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH - Update tool
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();

    // Verify admin access
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const {
      id,
      tool_name,
      category_key,
      description,
      welcome_message,
      system_prompt,
      display_order,
      is_active,
      allowed_tiers
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Build update object
    const updates: any = { updated_by: user.id };
    if (tool_name !== undefined) updates.tool_name = tool_name;
    if (category_key !== undefined) updates.category_key = category_key;
    if (description !== undefined) updates.description = description;
    if (welcome_message !== undefined) updates.welcome_message = welcome_message;
    if (system_prompt !== undefined) updates.system_prompt = system_prompt;
    if (display_order !== undefined) updates.display_order = display_order;
    if (is_active !== undefined) updates.is_active = is_active;
    if (allowed_tiers !== undefined) updates.allowed_tiers = allowed_tiers;

    const { data, error } = await supabase
      .from('tools')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating tool:', error);
      return NextResponse.json({ error: 'Failed to update tool' }, { status: 500 });
    }

    return NextResponse.json({ success: true, tool: data });
  } catch (error: any) {
    console.error('Error in PATCH /api/admin/tools:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Delete tool
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();

    // Verify admin access
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('tools')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting tool:', error);
      return NextResponse.json({ error: 'Failed to delete tool' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/tools:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
