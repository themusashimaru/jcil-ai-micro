import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { category, subject, message, name, email, phone, company } = body;

    // Validate required fields
    if (!category || !subject || !message || !name || !email) {
      return NextResponse.json(
        { error: 'Category, subject, message, name, and email are required' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Get client IP and user agent for spam prevention
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Create admin supabase client (service role for external submissions)
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Create contact submission record
    const { data: submission, error: submissionError } = await supabase
      .from('contact_submissions')
      .insert({
        submission_type: 'external',
        user_id: null,
        category,
        name,
        email,
        subject,
        message,
        phone: phone || null,
        company: company || null,
        ip_address: ip,
        user_agent: userAgent,
      })
      .select()
      .single();

    if (submissionError) {
      console.error('Error creating external contact submission:', submissionError);
      return NextResponse.json({ error: 'Failed to submit contact form' }, { status: 500 });
    }

    // Create admin message
    const { data: adminMessage, error: messageError } = await supabase
      .from('admin_messages')
      .insert({
        message_type: 'user_inquiry',
        category,
        from_user_id: null,
        from_email: email,
        from_name: name,
        subject: `[External] ${subject}`,
        message: `${message}${phone ? `\n\nPhone: ${phone}` : ''}${company ? `\nCompany: ${company}` : ''}`,
        status: 'unread',
        folder: 'external_inquiries',
        metadata: {
          submission_id: submission.id,
          category_label: getCategoryLabel(category),
          is_external: true,
          phone,
          company,
          ip_address: ip,
        },
        notification_sent: true,
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error creating admin message:', messageError);
      return NextResponse.json({ error: 'Failed to process contact form' }, { status: 500 });
    }

    // Update submission with admin message ID
    await supabase
      .from('contact_submissions')
      .update({ admin_message_id: adminMessage.id, processed: true })
      .eq('id', submission.id);

    // Send email notification to admin
    try {
      await sendEmailNotification({
        to: 'the.musashi.maru@gmail.com',
        subject: `[JCIL.AI Contact] ${subject}`,
        name,
        email,
        category: getCategoryLabel(category),
        message,
        phone,
        company,
      });
    } catch (emailError) {
      console.error('Error sending email notification:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Thank you for contacting us! We will get back to you soon.',
    });
  } catch (error: any) {
    console.error('External contact form error:', error);
    return NextResponse.json({ error: 'Failed to submit contact form' }, { status: 500 });
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
    partnership: 'Partnership Inquiry',
    media: 'Media Inquiry',
    general: 'General Inquiry',
  };
  return labels[category] || 'General Inquiry';
}

async function sendEmailNotification(data: {
  to: string;
  subject: string;
  name: string;
  email: string;
  category: string;
  message: string;
  phone?: string;
  company?: string;
}) {
  // If you have an email service configured (SendGrid, Resend, etc.), use it here
  // For now, this is a placeholder that logs the email

  // Using Resend as an example (you'll need to install: npm install resend)
  // Uncomment and configure if you have Resend API key

  /*
  const { Resend } = require('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: 'JCIL.AI Contact <noreply@jcil.ai>',
    to: data.to,
    subject: data.subject,
    html: `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${data.name}</p>
      <p><strong>Email:</strong> ${data.email}</p>
      <p><strong>Category:</strong> ${data.category}</p>
      ${data.phone ? `<p><strong>Phone:</strong> ${data.phone}</p>` : ''}
      ${data.company ? `<p><strong>Company:</strong> ${data.company}</p>` : ''}
      <p><strong>Message:</strong></p>
      <p>${data.message.replace(/\n/g, '<br>')}</p>
    `,
  });
  */

  console.log('Email notification:', {
    to: data.to,
    subject: data.subject,
    from: data.email,
    category: data.category,
  });
}
