export const runtime = 'nodejs';

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET - Fetch all tool categories
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

    // Fetch all tool categories
    const { data: categories, error } = await supabase
      .from('tool_categories')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching tool categories:', error);
      return NextResponse.json({ error: 'Failed to fetch tool categories' }, { status: 500 });
    }

    return NextResponse.json({ categories });
  } catch (error: any) {
    console.error('Error in GET /api/admin/tool-categories:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create new tool category
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
    const { category_key, category_name, description, display_order, is_active, allowed_tiers } = body;

    if (!category_key || !category_name) {
      return NextResponse.json({ error: 'category_key and category_name are required' }, { status: 400 });
    }

    // Insert new category
    const { data, error } = await supabase
      .from('tool_categories')
      .insert({
        category_key,
        category_name,
        description: description || null,
        display_order: display_order || 0,
        is_active: is_active !== undefined ? is_active : true,
        allowed_tiers: allowed_tiers || ['free', 'basic', 'pro', 'executive'],
        updated_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating tool category:', error);
      return NextResponse.json({ error: 'Failed to create tool category' }, { status: 500 });
    }

    return NextResponse.json({ success: true, category: data });
  } catch (error: any) {
    console.error('Error in POST /api/admin/tool-categories:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH - Update tool category
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
    const { id, category_name, description, display_order, is_active, allowed_tiers } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Build update object
    const updates: any = { updated_by: user.id };
    if (category_name !== undefined) updates.category_name = category_name;
    if (description !== undefined) updates.description = description;
    if (display_order !== undefined) updates.display_order = display_order;
    if (is_active !== undefined) updates.is_active = is_active;
    if (allowed_tiers !== undefined) updates.allowed_tiers = allowed_tiers;

    const { data, error } = await supabase
      .from('tool_categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating tool category:', error);
      return NextResponse.json({ error: 'Failed to update tool category' }, { status: 500 });
    }

    return NextResponse.json({ success: true, category: data });
  } catch (error: any) {
    console.error('Error in PATCH /api/admin/tool-categories:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Delete tool category
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
      .from('tool_categories')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting tool category:', error);
      return NextResponse.json({ error: 'Failed to delete tool category' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/tool-categories:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
