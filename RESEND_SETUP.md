# Resend Email Setup Guide

## What Was Done

✅ **Installed Resend Package** (`npm install resend`)
✅ **Added Missing UI Components** (dialog, select from shadcn/ui)
✅ **Enabled Email Integration** - Email forwarding is now active
✅ **Professional Email Template** - Beautiful HTML emails with your branding

## Email Configuration

All external contact form submissions will be forwarded to:
📧 **the.musashi.maru@gmail.com**

## Setup Steps (Required)

### 1. Get Your Resend API Key

1. Go to [resend.com](https://resend.com)
2. Sign up or log in
3. Navigate to **API Keys**
4. Create a new API key
5. Copy the key (starts with `re_...`)

### 2. Add to Vercel Environment Variables

1. Go to your Vercel dashboard
2. Select your project: `jcil-ai-micro`
3. Go to **Settings** → **Environment Variables**
4. Add new variable:
   - **Name**: `RESEND_API_KEY`
   - **Value**: `re_your_api_key_here`
   - **Environments**: Check all (Production, Preview, Development)
5. Click **Save**

### 3. Verify Your Domain (Optional but Recommended)

**Current Setup**: Using Resend's test domain (`onboarding@resend.dev`)
- ✅ Works immediately
- ⚠️ Limited to 100 emails/day
- ⚠️ May be marked as spam

**For Production**: Verify your own domain
1. In Resend dashboard, go to **Domains**
2. Click **Add Domain**
3. Enter your domain (e.g., `jcil.ai`)
4. Add the DNS records Resend provides
5. Wait for verification (usually 5-10 minutes)

### 4. Update Email "From" Address (After Domain Verification)

Once your domain is verified, update the sender address:

**File**: `/src/app/api/contact/external/route.ts`

**Line 158**: Change from:
```typescript
from: 'JCIL.AI Contact <onboarding@resend.dev>',
```

To:
```typescript
from: 'JCIL.AI Contact <noreply@jcil.ai>',
```
Or any email from your verified domain.

## Email Features

### What Gets Sent
- **Beautiful HTML Template** with your branding
- **Contact Details**: Name, email, phone, company
- **Inquiry Category**: Labeled (e.g., "Membership Plan Inquiry")
- **Full Message**: With proper formatting
- **Reply-To**: Set to the sender's email for easy responses

### Example Email Preview
```
🔔 New Contact Form Submission
JCIL.AI External Contact

Name: John Doe
Email: john@example.com
Category: Business Solutions
Phone: (555) 123-4567
Company: ABC Corp

Message:
I'm interested in discussing enterprise solutions
for our organization...

────────────────────────────────
This message was sent from the JCIL.AI contact form.
Reply directly to respond to John Doe.
```

## Testing

1. After adding `RESEND_API_KEY` to Vercel, redeploy your app
2. Go to your landing page: `https://your-domain.com/landing`
3. Scroll to footer → Click "Send Message"
4. Fill out the form and submit
5. Check the.musashi.maru@gmail.com for the email

## Fallback Behavior

**If RESEND_API_KEY is not set:**
- Contact forms still work
- Messages saved to database
- Admin inbox still receives them
- Email is skipped with console warning (no error)

**This means:**
- Your app won't crash if email fails
- Users still get confirmation
- You can still see messages in Admin Inbox

## Current Email Flow

1. **User submits contact form** → Landing page or Settings
2. **Data saved to database** → `contact_submissions` + `admin_messages`
3. **Email sent via Resend** → to the.musashi.maru@gmail.com
4. **Admin notification created** → Shows in notification bell
5. **Message appears in Admin Inbox** → External Inquiries folder

## Cost

Resend Pricing:
- **Free Tier**: 100 emails/day, 3,000/month
- **Pro Plan**: $20/mo for 50,000 emails/month

For a contact form, the free tier is usually sufficient.

## Troubleshooting

### Email not received?
1. Check spam/junk folder
2. Verify `RESEND_API_KEY` is set in Vercel
3. Check Vercel deployment logs for errors
4. Test with Resend test domain first

### Need to change recipient email?
Update line 95 in `/src/app/api/contact/external/route.ts`:
```typescript
to: 'your-new-email@example.com',
```

### Want to add more recipients?
Change `to` to an array:
```typescript
to: ['email1@example.com', 'email2@example.com'],
```

## Next Steps

1. ✅ Get Resend API key
2. ✅ Add to Vercel environment variables
3. ✅ Redeploy (happens automatically)
4. ✅ Test the contact form
5. 🔜 (Optional) Verify your domain
6. 🔜 (Optional) Customize email template

---

**Questions?** Check the [Resend documentation](https://resend.com/docs) or the code comments in `/src/app/api/contact/external/route.ts`
