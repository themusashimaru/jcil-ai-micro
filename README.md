This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


# 🔧 JCIL.AI MEMORY & FILE STORAGE FIX

## 🔴 Problems Fixed

### 1. Memory System Not Working
- ❌ AI couldn't remember previous conversations
- ❌ Cross-chat memory only worked on NEW conversations
- ❌ Current chat history was ignored when conversationId existed
- ✅ NOW: AI has access to last 100 messages across ALL conversations

### 2. Files Being Deleted After 3 Days
- ❌ Automatic cleanup ran daily via cron job
- ❌ All uploaded files deleted after 3 days
- ✅ NOW: Files stored permanently (cleanup disabled)

### 3. Wrong OpenAI Model
- ❌ Using non-existent "gpt-4.1-mini"
- ✅ NOW: Using "gpt-4o-mini"

---

## 📝 STEP-BY-STEP FIX

### Step 1: Replace Chat Route
Replace your `/src/app/api/chat/route.ts` with the fixed version:

**Location:** `/src/app/api/chat/route.ts`

**Key Changes:**
```typescript
// OLD (BROKEN) - Only loaded current conversation
if (conversationId) {
  const { data } = await supabase
    .from("messages")
    .eq("conversation_id", conversationId) // ❌
    .limit(200);
}

// NEW (FIXED) - Loads ALL user messages
const { data: allMessages } = await supabase
  .from("messages")
  .select("role, content, conversation_id, created_at")
  .eq("user_id", userId)
  .order("created_at", { ascending: false })
  .limit(100); // Last 100 messages across ALL chats ✅
```

### Step 2: Disable File Cleanup
Replace your `/src/lib/file-cleanup.ts` with the fixed version:

**Location:** `/src/lib/file-cleanup.ts`

**Key Change:**
```typescript
// Add this at the top
const CLEANUP_ENABLED = false; // ✅ Files kept permanently
```

### Step 3: Fix Supabase Server Client (Async Cookies)
Update `/src/lib/supabase/server.ts`:

```typescript
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

// ✅ FIXED - Made async
export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies(); // ✅ Added await

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options, maxAge: 0 });
        },
      },
    }
  ) as unknown as SupabaseClient;
}
```

### Step 4: Update ALL Files That Import createClient

You need to update these files to handle async:

**Files to update:**
1. `/src/app/api/chat/route.ts` (already fixed in new version)
2. `/src/app/auth/callback/route.ts`
3. Any other server files using `createClient()`

**Example fix:**
```typescript
// OLD
const supabase = createClient();

// NEW
const supabase = await createClient();
```

### Step 5: Fix RLS Policies in Supabase

Your messages table needs proper RLS policies. Run these in Supabase SQL Editor:

```sql
-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own messages
CREATE POLICY "Users can insert own messages"
  ON messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to read their own messages
CREATE POLICY "Users can read own messages"
  ON messages
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to delete their own messages
CREATE POLICY "Users can delete own messages"
  ON messages
  FOR DELETE
  USING (auth.uid() = user_id);
```

---

## 🧪 TESTING THE FIXES

### Test 1: Memory Across Chats
1. Start a new chat
2. Tell AI: "My favorite color is blue"
3. Start ANOTHER new chat
4. Ask: "What's my favorite color?"
5. ✅ AI should remember "blue" from previous chat

### Test 2: Memory Within Chat
1. Start a new chat
2. Tell AI: "I'm learning Python"
3. In the SAME chat, ask: "What am I learning?"
4. ✅ AI should respond "Python"

### Test 3: File Storage
1. Upload an image
2. Wait more than 3 days
3. ✅ Image should still be accessible (not deleted)

---

## ⚙️ HOW THE MEMORY SYSTEM WORKS NOW

### Before (Broken):
```
User starts Chat A → AI only sees Chat A messages
User starts Chat B → AI only sees last 50 messages (reversed)
User continues Chat A → AI forgets Chat B existed
```

### After (Fixed):
```
User starts Chat A → AI sees last 100 messages from ALL chats
User starts Chat B → AI STILL sees last 100 messages from ALL chats
User continues Chat A → AI remembers EVERYTHING from all chats

Memory Flow:
[System Prompt] 
  ↓
[Last 100 messages from ALL conversations]
  ↓
[Current conversation history from UI]
  ↓
[New user message]
  ↓
[AI Response]
```

---

## 🎯 MEMORY TUNING

### Adjust Memory Size
In `/src/app/api/chat/route.ts`, line 57:

```typescript
.limit(100); // ← Change this number

// Options:
// 50  = Less memory, faster, cheaper
// 100 = Balanced (recommended)
// 200 = More memory, slower, more expensive
// 500 = Maximum memory (may hit token limits)
```

### Token Limit Warning
- GPT-4o-mini has ~128k token context window
- 100 messages ≈ 10-30k tokens (depends on length)
- If you get "context too large" errors, reduce the limit

---

## 💰 COST IMPLICATIONS

### Before:
- Memory: Only current chat (cheap)
- Storage: Auto-delete after 3 days (free)

### After:
- Memory: Last 100 messages (slightly more expensive per request)
- Storage: Permanent (will grow over time)

**Cost Estimates (GPT-4o-mini):**
- Without memory: ~$0.0001 per request
- With 100-message memory: ~$0.0003 per request
- Still very cheap! 1,000 requests = ~$0.30

**Storage Costs (Supabase):**
- Free tier: 1 GB storage
- After that: ~$0.021/GB/month
- Images: ~1-5 MB each
- 1 GB = ~200-1000 images

---

## 🔒 SECURITY NOTES

### RLS is Critical
Make sure RLS policies are enabled! Without them:
- Users could read OTHER users' messages
- Users could insert messages as OTHER users
- Major security vulnerability!

### Test RLS:
```sql
-- In Supabase SQL Editor, test as a specific user:
SELECT auth.uid(); -- Check current user
SELECT * FROM messages WHERE user_id = auth.uid(); -- Should only see own
```

---

## 🐛 DEBUGGING

### Memory Not Working?

**Check 1: Verify messages are saved**
```sql
SELECT * FROM messages 
WHERE user_id = 'YOUR_USER_ID' 
ORDER BY created_at DESC 
LIMIT 10;
```

**Check 2: Check API logs**
In `/src/app/api/chat/route.ts`, add:
```typescript
console.log('Global memory loaded:', globalMemory.length, 'messages');
```

**Check 3: Verify RLS policies**
```sql
SELECT * FROM pg_policies WHERE tablename = 'messages';
```

### Files Still Being Deleted?

**Check 1: Verify cleanup is disabled**
In `/src/lib/file-cleanup.ts`:
```typescript
const CLEANUP_ENABLED = false; // ✅ Must be false
```

**Check 2: Check Vercel cron logs**
- Go to Vercel Dashboard
- Your Project → Deployments → Functions
- Check `/api/cleanup` logs
- Should say "Cleanup is DISABLED"

---

## 📚 ADDITIONAL IMPROVEMENTS (Optional)

### 1. Add Memory Summary
Instead of sending ALL 100 messages, summarize older ones:

```typescript
// In /src/app/api/chat/route.ts
const summary = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{
    role: "user",
    content: `Summarize these conversations in 3-5 sentences:\n${oldMessages}`
  }],
  max_tokens: 200
});

// Then use summary instead of full messages
```

### 2. Add User Preferences Table
Store long-term facts in a separate table:

```sql
CREATE TABLE user_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, key)
);

-- Example: Store "favorite_color" = "blue"
```

### 3. Add Message Search
Let users search their chat history:

```typescript
// New API endpoint: /api/search
const { data } = await supabase
  .from('messages')
  .select('*')
  .eq('user_id', userId)
  .textSearch('content', searchQuery);
```

---

## ✅ CHECKLIST

- [ ] Replace `/src/app/api/chat/route.ts`
- [ ] Replace `/src/lib/file-cleanup.ts`
- [ ] Fix `/src/lib/supabase/server.ts` (add await)
- [ ] Update RLS policies in Supabase
- [ ] Test memory across different chats
- [ ] Verify files aren't being deleted
- [ ] Check Vercel logs for any errors
- [ ] Monitor token usage (should be slightly higher)
- [ ] Monitor storage usage (will grow over time)

---

## 🆘 NEED HELP?

If something's still not working:

1. Check browser console for errors (F12)
2. Check Vercel function logs
3. Check Supabase logs
4. Verify environment variables are set
5. Make sure you're using the latest deployment

**Common Issues:**
- "Authentication required" → RLS policies not set correctly
- "context_length_exceeded" → Reduce memory limit (line 57)
- Files still deleting → Check CLEANUP_ENABLED = false
- Memory not working → Verify messages are being saved to DB

---

## 🎉 YOU'RE DONE!

Your AI should now:
- ✅ Remember conversations across ALL chats
- ✅ Store files permanently
- ✅ Use the correct OpenAI model
- ✅ Have proper error handling

Deploy to Vercel and test! 🚀