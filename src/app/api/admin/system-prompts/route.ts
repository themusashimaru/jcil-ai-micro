import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const promptType = searchParams.get('type');

    let query = supabase
      .from('system_prompts')
      .select('*')
      .order('created_at', { ascending: true });

    if (promptType) {
      query = query.eq('prompt_type', promptType);
    }

    const { data: prompts, error } = await query;

    if (error) {
      console.error('Error fetching system prompts:', error);
      return NextResponse.json({ error: 'Failed to fetch system prompts' }, { status: 500 });
    }

    return NextResponse.json({ prompts });
  } catch (error: any) {
    console.error('System prompts error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { promptType, promptContent, isActive } = body;

    if (!promptType || !promptContent) {
      return NextResponse.json(
        { error: 'Missing required fields: promptType, promptContent' },
        { status: 400 }
      );
    }

    const updateData: any = {
      prompt_content: promptContent,
      updated_by: user.id,
    };

    if (typeof isActive === 'boolean') {
      updateData.is_active = isActive;
    }

    const { data, error } = await supabase
      .from('system_prompts')
      .update(updateData)
      .eq('prompt_type', promptType)
      .select()
      .single();

    if (error) {
      console.error('Error updating system prompt:', error);
      return NextResponse.json({ error: 'Failed to update system prompt' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'System prompt updated successfully',
      prompt: data,
    });
  } catch (error: any) {
    console.error('Update system prompt error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { promptType, promptName, promptContent, isActive } = body;

    if (!promptType || !promptName || !promptContent) {
      return NextResponse.json(
        { error: 'Missing required fields: promptType, promptName, promptContent' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('system_prompts')
      .insert({
        prompt_type: promptType,
        prompt_name: promptName,
        prompt_content: promptContent,
        is_active: isActive ?? true,
        updated_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating system prompt:', error);
      return NextResponse.json({ error: 'Failed to create system prompt' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'System prompt created successfully',
      prompt: data,
    });
  } catch (error: any) {
    console.error('Create system prompt error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
