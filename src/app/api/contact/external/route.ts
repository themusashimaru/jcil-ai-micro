import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

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
    const supabase = await createClient();

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
  // Send email using Resend
  // Note: Make sure to verify your domain in Resend dashboard and update the 'from' address
  // Also add RESEND_API_KEY to your environment variables

  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured - email will not be sent');
    return;
  }

  try {
    await resend.emails.send({
      from: 'JCIL.AI Contact <onboarding@resend.dev>', // Update this to your verified domain
      to: data.to,
      subject: data.subject,
      replyTo: data.email, // Allow direct reply to the person who submitted the form
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; }
              .field { margin-bottom: 15px; }
              .label { font-weight: bold; color: #6b7280; }
              .value { color: #111827; margin-top: 5px; }
              .message-box { background: white; padding: 15px; border-left: 4px solid #667eea; margin-top: 10px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2 style="margin: 0;">🔔 New Contact Form Submission</h2>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">JCIL.AI External Contact</p>
              </div>
              <div class="content">
                <div class="field">
                  <div class="label">Name:</div>
                  <div class="value">${data.name}</div>
                </div>
                <div class="field">
                  <div class="label">Email:</div>
                  <div class="value"><a href="mailto:${data.email}">${data.email}</a></div>
                </div>
                <div class="field">
                  <div class="label">Category:</div>
                  <div class="value">${data.category}</div>
                </div>
                ${data.phone ? `
                <div class="field">
                  <div class="label">Phone:</div>
                  <div class="value"><a href="tel:${data.phone}">${data.phone}</a></div>
                </div>
                ` : ''}
                ${data.company ? `
                <div class="field">
                  <div class="label">Company:</div>
                  <div class="value">${data.company}</div>
                </div>
                ` : ''}
                <div class="field">
                  <div class="label">Message:</div>
                  <div class="message-box">${data.message.replace(/\n/g, '<br>')}</div>
                </div>
                <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
                <p style="font-size: 12px; color: #9ca3af; margin: 0;">
                  This message was sent from the JCIL.AI contact form. Reply directly to respond to ${data.name}.
                </p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    console.log('Email sent successfully to:', data.to);
  } catch (error) {
    console.error('Failed to send email via Resend:', error);
    throw error; // Re-throw so the calling function knows it failed
  }
}
