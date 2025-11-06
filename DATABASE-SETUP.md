# Database Setup

This guide covers setting up your Supabase database for JCIL.AI Slingshot 2.0.

## Table of Contents
1. [Add Database Indexes](#add-database-indexes) (Performance Optimization)
2. [Create Daily Devotionals Table](#create-daily-devotionals-table) (New Feature)
3. [Create Daily News Summaries Table](#create-daily-news-summaries-table) (New Feature)

---

# Add Database Indexes

## Quick Start: Add Indexes to Supabase

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**

### Step 2: Run the Index Creation Script
1. Open the file `database-indexes.sql` in this repository
2. Copy the entire SQL script
3. Paste it into the Supabase SQL Editor
4. Click **RUN** (or press `Ctrl+Enter`)

### Step 3: Verify Indexes Were Created
Run this query to confirm:
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'messages';
```

You should see 4 new indexes:
- `idx_messages_user_created` ⭐ **MOST IMPORTANT**
- `idx_messages_user_id`
- `idx_messages_created_at`
- `idx_messages_conversation_user`

---

## What These Indexes Do

### Performance Impact
- **Before:** Queries scan entire messages table (slow with many messages)
- **After:** Queries use indexes (10-100x faster)

### Memory System Protection
✅ **Your memory system is SAFE**
- Indexes only speed up queries
- They do NOT change query results
- Memory system works exactly the same way
- No code changes needed

### Key Benefits
1. **Global Memory Query** - 100x faster loading of last 100 messages
2. **User History** - Instant retrieval of user conversations
3. **Conversation Lookup** - Fast loading of specific chats
4. **Scalability** - App stays fast as database grows

---

## Technical Details

### Primary Index (Most Critical)
```sql
CREATE INDEX idx_messages_user_created ON messages (user_id, created_at DESC);
```

This optimizes the main query in `/src/app/api/chat/route.ts`:
```typescript
const { data: allMessages } = await supabase
  .from("messages")
  .select("role, content, conversation_id, created_at")
  .eq("user_id", userId)
  .order("created_at", { ascending: false })
  .limit(100);
```

### How It Works
1. Database uses index to quickly find all messages for the user
2. Results are already sorted (created_at DESC)
3. Database just returns first 100 rows
4. No table scan needed!

### Storage Overhead
- ~1-2% of table size per index
- Minimal cost for huge performance gain
- Automatically maintained by PostgreSQL

---

## Troubleshooting

### "Index already exists" error
✅ **This is fine!** The script uses `IF NOT EXISTS` to be safe.

### Query still slow after adding indexes
1. Check if indexes were created (see Step 3 above)
2. Wait a few minutes for PostgreSQL to update query planner
3. Try running `ANALYZE messages;` in SQL Editor

### Need to remove indexes?
```sql
DROP INDEX IF EXISTS idx_messages_user_created;
DROP INDEX IF EXISTS idx_messages_user_id;
DROP INDEX IF EXISTS idx_messages_created_at;
DROP INDEX IF EXISTS idx_messages_conversation_user;
```

---

## Questions?
These indexes are standard PostgreSQL best practices for this query pattern. They're safe to add and will significantly improve performance as your user base grows.

---

# Create Daily Devotionals Table

## Quick Start: Add Daily Devotionals Table

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**

### Step 2: Run the Table Creation Script
1. Open the file `daily-devotionals-table.sql` in this repository
2. Copy the entire SQL script
3. Paste it into the Supabase SQL Editor
4. Click **RUN** (or press `Ctrl+Enter`)

### Step 3: Verify Table Was Created
Run this query to confirm:
```sql
SELECT * FROM daily_devotionals LIMIT 1;
```

You should see an empty table with these columns:
- `id` (UUID, primary key)
- `date_key` (TEXT, unique - format: YYYY-MM-DD)
- `content` (TEXT - markdown content)
- `generated_at` (TIMESTAMPTZ)
- `created_at` (TIMESTAMPTZ)

---

## What This Table Does

### Daily Devotional Feature
- **Community Experience:** All users see the same devotional each day
- **Generated Once:** Each devotional is created once at midnight (UTC) and cached
- **Automatic Creation:** When a user visits `/devotional`, the system checks if today's devotional exists. If not, it generates it using Claude AI.
- **Rich Content:** Devotionals include Scripture passage, reflection, application, and prayer

### Performance & Storage
- **Efficient Caching:** After first generation, all subsequent requests return cached content
- **Automatic Indexing:** Date lookups are extremely fast due to index
- **Low Storage:** Text-only content, very small database footprint
- **No Manual Work:** Devotionals generate automatically, no admin intervention needed

### Data Structure
```sql
{
  "id": "uuid-here",
  "date_key": "2025-01-15",
  "content": "# Walking in Faith\n\n**Scripture:** ...",
  "generated_at": "2025-01-15T00:00:12Z",
  "created_at": "2025-01-15T00:00:12Z"
}
```

---

## Troubleshooting

### "Table already exists" error
✅ **This is fine!** The script uses `IF NOT EXISTS` to be safe.

### Devotional not generating
1. Check your `ANTHROPIC_API_KEY` environment variable in Vercel
2. Verify the table was created (see Step 3 above)
3. Check the `/api/devotional` route logs for errors

### Need to reset devotionals?
```sql
-- Delete all devotionals (they will regenerate on next visit)
TRUNCATE TABLE daily_devotionals;

-- Or delete just one day
DELETE FROM daily_devotionals WHERE date_key = '2025-01-15';
```

---

## Questions?
The daily devotionals table is a simple, efficient way to provide community-wide spiritual content. It's designed to be maintenance-free and automatically managed.

---

# Create Daily News Summaries Table

## Quick Start: Add Daily News Summaries Table

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**

### Step 2: Run the Table Creation Script
1. Open the file `daily-news-summaries-table.sql` in this repository
2. Copy the entire SQL script
3. Paste it into the Supabase SQL Editor
4. Click **RUN** (or press `Ctrl+Enter`)

### Step 3: Verify Table Was Created
Run this query to confirm:
```sql
SELECT * FROM daily_news_summaries LIMIT 1;
```

You should see an empty table with these columns:
- `id` (UUID, primary key)
- `timestamp_key` (TEXT, unique - format: YYYY-MM-DD-HH-MM)
- `content` (JSONB - structured news data)
- `generated_at` (TIMESTAMPTZ)
- `created_at` (TIMESTAMPTZ)

---

## What This Table Does

### Daily News Summary Feature
- **Conservative Christian Perspective:** News summaries from a center-right, biblical worldview
- **Updated Every 30 Minutes:** Fresh news every half hour using Claude Sonnet 4.5
- **10 Major Categories:**
  1. U.S. Breaking News
  2. International News
  3. Economics & Business
  4. National Defense
  5. International Espionage
  6. Christian Persecution Worldwide
  7. China (Adversarial Summary)
  8. Russia (Adversarial Summary)
  9. Iran (Adversarial Summary)
  10. North Korea (Adversarial Summary)
- **Verified Sources:** Fox News, WSJ, AP, Reuters, Christian Post, National Review, etc.
- **Digital Newspaper Format:** Clean, readable layout like traditional newspapers

### Purpose
Help believers stay informed without being overwhelmed by 24/7 news saturation. Provides curated, factual summaries with conservative Christian framing.

### Performance & Storage
- **30-Minute Caching:** Summaries cached for 30 minutes, all users see same content
- **Automatic Cleanup:** Optional cleanup of summaries older than 7 days
- **JSONB Storage:** Structured data for efficient querying
- **AI-Generated:** Claude Sonnet 4.5 analyzes and summarizes verified sources

### Data Structure
```json
{
  "generated_at": "2025-01-15T14:30:00Z",
  "summary": "**U.S. BREAKING NEWS**\n• Headline: Summary...\n\n**INTERNATIONAL NEWS**\n• Headline: Summary..."
}
```

---

## Troubleshooting

### "Table already exists" error
✅ **This is fine!** The script uses `IF NOT EXISTS` to be safe.

### News not generating
1. Check your `ANTHROPIC_API_KEY` environment variable in Vercel
2. Verify the table was created (see Step 3 above)
3. Check the `/api/news-summary` route logs for errors
4. Ensure Claude Sonnet 4.5 model is available

### Need to reset news summaries?
```sql
-- Delete all news summaries (they will regenerate on next visit)
TRUNCATE TABLE daily_news_summaries;

-- Or delete just one timestamp
DELETE FROM daily_news_summaries WHERE timestamp_key = '2025-01-15-14-30';

-- Cleanup old summaries (keep only last 7 days)
DELETE FROM daily_news_summaries
WHERE generated_at < NOW() - INTERVAL '7 days';
```

### Share functionality
- **Native Share:** Works on iOS, Android, modern desktop browsers
- **URL Sharing:** Users can share direct link to news page
- **Clipboard Fallback:** Automatically copies link if native share unavailable
- **PDF Export:** (Future feature - coming soon)

---

## Questions?
The daily news summaries table provides believers with fact-based news from a conservative Christian perspective, helping reduce unhealthy news consumption while staying informed.
