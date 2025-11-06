# Database Optimization Setup

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
