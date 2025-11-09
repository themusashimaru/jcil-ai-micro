import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { category, subject, message, name, email } = body;

    // Validate required fields
    if (!category || !subject || !message) {
      return NextResponse.json(
        { error: 'Category, subject, and message are required' },
        { status: 400 }
      );
    }

    // Get user profile for email
    const { data: authData } = await supabase.auth.admin.getUserById(user.id);
    const userEmail = email || authData.user?.email || 'unknown@user.com';
    const userName = name || authData.user?.user_metadata?.full_name || 'User';

    // Category mapping to folders
    const categoryToFolder: Record<string, string> = {
      membership: 'user_inquiries',
      payment: 'user_inquiries',
      suggestions: 'user_inquiries',
      technical: 'user_inquiries',
      business: 'user_inquiries',
      influencer: 'user_inquiries',
      general: 'user_inquiries',
    };

    // Create contact submission record
    const { data: submission, error: submissionError } = await supabase
      .from('contact_submissions')
      .insert({
        submission_type: 'internal',
        user_id: user.id,
        category,
        name: userName,
        email: userEmail,
        subject,
        message,
      })
      .select()
      .single();

    if (submissionError) {
      console.error('Error creating contact submission:', submissionError);
      return NextResponse.json({ error: submissionError.message }, { status: 500 });
    }

    // Create admin message
    const folder = categoryToFolder[category] || 'user_inquiries';
    const { data: adminMessage, error: messageError } = await supabase
      .from('admin_messages')
      .insert({
        message_type: 'user_inquiry',
        category,
        from_user_id: user.id,
        from_email: userEmail,
        from_name: userName,
        subject,
        message,
        status: 'unread',
        folder,
        metadata: {
          submission_id: submission.id,
          category_label: getCategoryLabel(category),
        },
        notification_sent: true,
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error creating admin message:', messageError);
      return NextResponse.json({ error: messageError.message }, { status: 500 });
    }

    // Update submission with admin message ID
    await supabase
      .from('contact_submissions')
      .update({ admin_message_id: adminMessage.id, processed: true })
      .eq('id', submission.id);

    // Create notification for user confirming receipt
    await supabase.from('notifications').insert({
      user_id: user.id,
      title: 'Message Sent to Admin',
      message: `Your inquiry "${subject}" has been sent to our admin team. We'll respond shortly.`,
    });

    return NextResponse.json({
      success: true,
      submissionId: submission.id,
      messageId: adminMessage.id,
      message: 'Your message has been sent to the admin team.',
    });
  } catch (error: any) {
    console.error('Contact submission error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    membership: 'Membership Plan Inquiry',
    payment: 'Payment Inquiry',
    suggestions: 'Improvement Suggestion',
    technical: 'Technical Difficulty',
    business: 'Business Solutions',
    influencer: 'Influencer Inquiry',
    general: 'General Inquiry',
  };
  return labels[category] || 'General Inquiry';
}
