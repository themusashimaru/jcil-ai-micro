# Admin Inbox & Contact System - Setup Instructions

## Overview

A comprehensive Master Admin Inbox system has been implemented with the following features:

### ✅ What Was Built

1. **Master Admin Inbox (Outlook-style)**
   - Organized folder system (User Inquiries, Cyber Emergencies, Admin Emergencies, External Inquiries)
   - Real-time message filtering and status management
   - AI-powered response writer using Grok (xAI)
   - Internal reply system with user notifications
   - Full message threading and history

2. **Critical Alert Notification System**
   - Automatic notifications for admin on critical security events
   - Notifications for high-severity moderation events
   - Notifications for prompt injection attempts
   - Notifications for failed login attempts and suspicious IPs
   - Summary alerts with severity levels in notification bell

3. **User Contact Forms**
   - **Settings Page**: Internal contact form for logged-in users
   - **Landing Page**: External contact form in footer for visitors
   - Multiple inquiry categories (Membership, Payment, Technical, Business, Influencer, etc.)
   - Automatic routing to admin inbox folders

4. **AI Response Writer**
   - Admin describes intent in plain language
   - AI reads user's message and generates professional response
   - Tone selection (Professional, Friendly, Apologetic, Formal)
   - Edit before sending capability

## 🚀 Deployment Steps

### Step 1: Run Database Migration

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Copy the entire contents of: `supabase/migrations/admin_inbox_system.sql`
4. Paste and execute in Supabase SQL Editor
5. Verify tables were created:
   - `admin_messages`
   - `contact_submissions`
   - `alert_rules`

### Step 2: Verify API Routes

The following API routes have been created and should work automatically:

- `POST /api/admin/inbox/messages` - Get inbox messages
- `PATCH /api/admin/inbox/messages` - Update message status
- `POST /api/admin/inbox/reply` - Reply to messages
- `POST /api/admin/inbox/ai-draft` - Generate AI draft response
- `POST /api/contact/submit` - Internal user contact form
- `POST /api/contact/external` - External visitor contact form

### Step 3: Test the System

1. **Test Admin Inbox**:
   - Log in as admin user
   - Navigate to Admin Panel → Inbox tab
   - Verify folders and message list appear

2. **Test User Contact Form**:
   - Log in as regular user
   - Go to Settings
   - Scroll to "Contact Admin" section
   - Submit a test message
   - Check admin inbox for the message

3. **Test Landing Page Contact**:
   - Visit landing page (logged out)
   - Scroll to footer
   - Click "Send Message" button
   - Fill out and submit external inquiry

4. **Test AI Response Writer**:
   - In admin inbox, select a user message
   - Click "Reply to User"
   - Enter your intent (e.g., "Tell them their payment was successful")
   - Click "Generate Draft"
   - Review, edit, and send

### Step 4: Email Forwarding (Optional)

To enable email forwarding for external inquiries:

1. Install an email service (recommended: Resend)
   ```bash
   npm install resend
   ```

2. Add Resend API key to `.env.local`:
   ```
   RESEND_API_KEY=your_api_key_here
   ```

3. Uncomment email sending code in:
   `app/api/contact/external/route.ts` (lines with Resend)

4. Update the "from" email domain to match your verified domain

## 📋 Features by Location

### Admin Panel → Inbox Tab
- View all messages organized by folder
- Filter by status (Unread, Read, Replied, Archived)
- Click message to view details
- Reply with AI-generated drafts
- Mark as read/replied/archived

### Settings Page
- "Contact Admin" card
- Category dropdown with 7 inquiry types
- Subject and message fields
- Success/error notifications
- Automatic inbox routing

### Landing Page Footer
- "Send Message" button opens modal
- Full contact form with name, email, phone, company
- 8 inquiry categories
- External inquiries routed to separate folder
- Email forwarding to: the.musashi.maru@gmail.com

## 🔒 Security & Permissions

### Database Row Level Security (RLS)
- Only admins can view/manage admin_messages
- All users can submit contact forms
- System can auto-create messages via triggers

### Automatic Triggers
The following events automatically create admin inbox messages:

1. **Security Events** (Critical/High severity)
   - Trigger: `trigger_security_event_alert`
   - Folder: `cyber_emergencies`

2. **Prompt Injections** (Confidence > 60%)
   - Trigger: `trigger_prompt_injection_alert`
   - Folder: `cyber_emergencies`

3. **Moderation Events** (High/Critical severity)
   - Trigger: `trigger_moderation_alert`
   - Folder: `admin_emergencies`

4. **New Inbox Messages**
   - Trigger: `trigger_notify_admins`
   - Creates notification for all admin users

## 🎯 Admin Notification Bell

Critical alerts appear in the notification bell with:
- 🚨 Critical Security Alert
- ⚠️ Safety Alert
- 📧 New User Inquiry
- Full message summary
- Click to open Admin Inbox

## 🛠️ Customization

### Add New Inquiry Categories

**Settings Form**: Edit `/src/app/settings/page.tsx`
```tsx
<SelectItem value="new_category">New Category Name</SelectItem>
```

**Landing Form**: Edit `/src/app/landing/page.tsx`
```tsx
<SelectItem value="new_category">New Category Name</SelectItem>
```

**API Handler**: Update category labels in:
- `/app/api/contact/submit/route.ts`
- `/app/api/contact/external/route.ts`

### Modify Alert Rules

Edit the `alert_rules` table in Supabase to:
- Enable/disable specific alert types
- Change severity thresholds
- Customize notification behavior
- Change folder routing

### Customize AI Response Tones

Edit `/app/api/admin/inbox/ai-draft/route.ts`:
```typescript
const toneInstructions = {
  professional: 'Your instructions here',
  friendly: 'Your instructions here',
  // Add more tones...
};
```

## 📊 Monitoring

### Check Inbox Activity
```sql
-- Total messages by folder
SELECT folder, COUNT(*)
FROM admin_messages
GROUP BY folder;

-- Unread messages
SELECT COUNT(*)
FROM admin_messages
WHERE status = 'unread';

-- Response rate
SELECT
  COUNT(CASE WHEN status = 'replied' THEN 1 END) * 100.0 / COUNT(*) as response_rate
FROM admin_messages
WHERE message_type = 'user_inquiry';
```

## 🆘 Troubleshooting

### Messages Not Appearing in Inbox
1. Check RLS policies - ensure your user has `is_admin = true`
2. Verify database triggers are active
3. Check browser console for API errors

### AI Draft Not Working
1. Verify XAI_API_KEY is set in environment
2. Check API route logs for errors
3. Ensure Grok API has sufficient credits

### Notifications Not Sending
1. Check `trigger_notify_admins` is active
2. Verify admin user exists in user_profiles
3. Check notifications table for entries

### Email Forwarding Not Working
1. Ensure Resend is installed and configured
2. Verify RESEND_API_KEY is valid
3. Check email sending code is uncommented
4. Verify domain is verified in Resend

## 📝 Next Steps

1. **Run the migration** - Copy/paste SQL into Supabase
2. **Test all features** - Go through each test scenario
3. **Configure email** - Set up Resend for external inquiries
4. **Customize categories** - Add/remove inquiry types as needed
5. **Monitor inbox** - Check regularly for user messages

## 🎉 You're All Set!

Your Master Admin Inbox is ready to handle:
- ✅ User inquiries from settings
- ✅ External contact form submissions
- ✅ Critical security alerts
- ✅ Moderation notifications
- ✅ AI-powered responses
- ✅ Full message threading

Access it via: **Admin Panel → Inbox Tab**
