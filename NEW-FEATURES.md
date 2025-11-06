# 🎉 JCIL.AI Slingshot 2.0 - New Spiritual Features

## Overview

This update introduces THREE major spiritual features to Slingshot 2.0:

1. **Daily Devotional** - Community-wide daily Scripture and reflection
2. **Deep Bible Research** - PhD-level biblical scholarship tool
3. **Share App** - Native sharing functionality for all platforms

---

## 1. Daily Devotional 📖

### What It Is
A beautiful, dedicated devotional page that generates fresh, Scripture-based content once per day. **All users see the same devotional**, creating a shared spiritual experience across the entire Slingshot community.

### Features
- **Scripture Passage** - Relevant Bible verse with citation (from 66 canonical books)
- **Reflection** - 2-3 paragraphs of thoughtful meditation on the passage
- **Application** - Practical ways to apply Scripture today
- **Prayer** - Heartfelt prayer based on the day's passage
- **Beautiful UI** - Gradient blue design with markdown rendering
- **Share Functionality** - Share devotional via native share or clipboard
- **Refresh Button** - Manually reload if needed
- **Community Note** - Reminder that everyone shares this devotional today

### How It Works
1. User visits `/devotional` page
2. System checks if today's devotional exists in database
3. If exists: Return cached version (instant load)
4. If not: Generate new devotional using Claude Sonnet 4, save to database
5. All subsequent users that day see the cached version

### Access
- **Sidebar Button:** "Daily Devotional" in the ✨ Spiritual Tools section
- **Direct URL:** `yourdomain.com/devotional`

### Technical Details
- **API Route:** `/src/app/api/devotional/route.ts`
- **Page:** `/src/app/devotional/page.tsx`
- **Database Table:** `daily_devotionals` (see `daily-devotionals-table.sql`)
- **AI Model:** Claude Sonnet 4 (claude-sonnet-4-20250514)
- **Caching:** Date-based (YYYY-MM-DD format, UTC timezone)

---

## 2. Deep Bible Research 📚

### What It Is
A PhD-level biblical scholarship tool for rigorous study of Scripture. Designed for serious students of the Bible who want original language analysis, historical context, and textual criticism.

### ⚡ Theological Boundaries

**THE 66 CANONICAL BOOKS = AUTHORITATIVE SCRIPTURE**
- Old Testament: Genesis through Malachi (39 books)
- New Testament: Matthew through Revelation (27 books)
- These are the inspired, inerrant Word of God

**NON-CANONICAL SOURCES = RESEARCH ONLY**
These may be referenced for historical/cultural context but are NOT Scripture:
- ✅ Dead Sea Scrolls (textual criticism, historical context)
- ✅ Book of Enoch (historical interest, referenced in Jude)
- ✅ Church Fathers (historical theology, early interpretation)
- ✅ Apocrypha/Deuterocanonical books (historical context only)
- ✅ Josephus, Philo, ancient historians

**⛔ ABSOLUTE REJECTION:**
The tool will immediately reject requests for:
- Satanic texts or grimoires
- Occult literature or witchcraft books
- Demonic texts or rituals
- Any content that blasphemes God or promotes evil

### Research Capabilities

**1. Original Languages**
- Biblical Hebrew (Masoretic text, vowel pointing)
- Koine Greek (NT Greek, Septuagint)
- Aramaic portions (Daniel, Ezra)
- Word studies with Strong's numbers
- Lexical analysis (BDAG, HALOT, BDB)
- Grammatical parsing
- Semantic range of terms

**2. Textual Criticism**
- Manuscript variants
- Textual families (Alexandrian, Byzantine, Western)
- Critical apparatus
- Transmission history
- Dead Sea Scrolls comparison
- Papyri evidence

**3. Historical Context**
- Ancient Near Eastern background
- Greco-Roman world
- Second Temple Judaism
- Archaeological discoveries
- Cultural practices and customs
- Political/social structures

**4. Biblical Theology**
- Covenant theology
- Progressive revelation
- Typology and symbolism
- Intertextual connections
- Redemptive-historical framework

**5. Hermeneutics**
- Grammatical-historical method
- Literary analysis (genre, structure)
- Authorial intent
- Original audience understanding
- Canonical context

### What It DOES NOT Provide
❌ Personal application
❌ Devotional thoughts
❌ Sermon outlines
❌ "What this means for you today"
❌ Spiritual direction

**This is a RESEARCH tool, not a sermon-writer or pastor.**

### Example Research Output

**Passage:** John 1:1

**Greek Analysis:**
- ἐν ἀρχῇ (en archē) - "In beginning" (anarthrous, echoing Genesis 1:1 LXX)
- ἦν (ēn) - Imperfect tense, continuous existence ("was existing")
- ὁ λόγος (ho logos) - "The Word" (definite article, pre-existing person)

**Textual Criticism:**
No significant variants. Solidly attested across all major manuscripts.

**Historical Context:**
Written ~AD 90-100. Johannine community facing early Gnostic challenges...

### Access
- **Sidebar Button:** "Deep Bible Research" in the ✨ Spiritual Tools section
- **Tools Dropdown:** Under "🤖 AI Assistants" section
- **Tool Mode:** Select tool, start new chat, ask research questions

### Technical Details
- **Tool Type:** `deep-bible-research`
- **Configuration:** `/src/lib/tools-config.ts`
- **Category:** AI Assistant
- **System Prompt:** Comprehensive PhD-level scholarship instructions

---

## 3. Share App 🔗

### What It Is
Native sharing functionality that allows users to share Slingshot 2.0 with friends, family, and communities via text, WhatsApp, email, social media, and more.

### Features
- **Native Share API** - Uses device's built-in share menu (iOS, Android, desktop)
- **Automatic Fallback** - Copies link to clipboard if native share unavailable
- **One-Click Sharing** - Single button press to share
- **Cross-Platform** - Works on all devices and browsers

### Share Content
- **Title:** "JCIL.AI Slingshot 2.0"
- **Description:** "Check out Slingshot 2.0 - A Christian Conservative AI assistant powered by Claude"
- **URL:** Your domain homepage

### Access
- **Sidebar Button:** "Share App" in the sidebar footer
- **Icon:** Share2 icon (arrow coming out of box)

### Technical Details
- **Function:** `handleShare()` in `/src/app/page.tsx`
- **API:** `navigator.share()` with clipboard fallback
- **Supported:** iOS Safari, Android Chrome, Desktop Chrome/Edge

---

## UI Changes

### Sidebar Redesign

**New Section Added: ✨ Spiritual Tools**
Located between the conversation list and sidebar footer. Features:
- Beautiful gradient background (blue-50 to slate-50)
- Two prominent buttons:
  - "Daily Devotional" - Opens `/devotional` page
  - "Deep Bible Research" - Starts new chat with research tool

**Sidebar Footer Addition:**
- New "Share App" button with Share2 icon
- Located after "Notifications" button
- Consistent styling with other footer buttons

### Tools Dropdown Addition
The wrench (🔧) tools menu now includes:
- **Deep Bible Research** - Under "🤖 AI Assistants" section
- Listed after "Coding Assistant"
- Same dropdown styling as other tools

---

## Setup Instructions

### 1. Install Dependencies
```bash
npm install react-markdown
```

### 2. Create Database Table
1. Go to Supabase Dashboard → SQL Editor
2. Open `daily-devotionals-table.sql`
3. Copy and run the entire script
4. Verify table created: `SELECT * FROM daily_devotionals LIMIT 1;`

**See `DATABASE-SETUP.md` for detailed instructions.**

### 3. Environment Variables
Ensure your `.env.local` and Vercel environment variables have:
```
ANTHROPIC_API_KEY=your_key_here
```

### 4. Deploy
```bash
git add .
git commit -m "feat: add Daily Devotional, Deep Bible Research, and Share App features"
git push origin main
```

---

## Testing

### Test Daily Devotional
1. Navigate to sidebar → "Daily Devotional" button
2. Verify page loads with blue gradient header
3. Check that devotional generates (or loads cached version)
4. Test share button (should open native share or copy link)
5. Test refresh button
6. Verify markdown rendering (headings, bold text, etc.)

### Test Deep Bible Research
1. Click sidebar → "Deep Bible Research" button
2. Verify new chat starts with research tool active
3. Ask: "Analyze John 1:1 in the original Greek"
4. Verify response includes:
   - Greek text and transliteration
   - Grammatical analysis
   - Textual criticism notes
   - Historical context
   - No devotional/application content
5. Test boundary: Ask about "Book of Enoch"
6. Verify it's labeled as non-canonical research material
7. Test rejection: Ask about occult material
8. Verify immediate rejection with clear message

### Test Share App
1. Click sidebar → "Share App" button
2. **On Mobile (iOS/Android):**
   - Verify native share menu opens
   - Test sharing via text message
   - Test sharing via WhatsApp
   - Test sharing via email
3. **On Desktop (without native share):**
   - Verify alert: "Link copied to clipboard!"
   - Paste clipboard content
   - Verify correct URL

---

## File Changes

### New Files Created
- `/src/app/devotional/page.tsx` - Daily devotional UI
- `/src/app/api/devotional/route.ts` - Devotional API endpoint
- `/daily-devotionals-table.sql` - Database migration
- `/NEW-FEATURES.md` - This documentation

### Modified Files
- `/src/lib/tools-config.ts` - Added `deep-bible-research` tool
- `/src/app/page.tsx` - Added Spiritual Tools section, Share button, tool dropdown entry
- `/DATABASE-SETUP.md` - Added daily devotionals table setup instructions
- `/package.json` - Added `react-markdown` dependency

---

## Theological Notes

### Why 66 Books?
The 66 canonical books of the Protestant Bible represent the inspired, inerrant Word of God as recognized by the historic Christian church. This is the sole authoritative source for faith and practice.

### Why Allow Dead Sea Scrolls / Church Fathers?
These are valuable for **historical research and context** but are NOT Scripture. The Deep Bible Research tool clearly labels these as non-canonical when referenced, maintaining the distinction between Scripture (authoritative) and historical sources (informative).

### Why Reject Occult Material?
Slingshot 2.0 is a Christian Conservative AI. We will not assist with content that opposes the Kingdom of God or promotes evil. This is a firm, non-negotiable boundary.

---

## Support

### Issues?
- Daily devotional not generating? Check `ANTHROPIC_API_KEY` in Vercel
- Database errors? Verify `daily_devotionals` table exists
- Share not working? Test on different browsers/devices
- Deep Bible Research not available? Check tool is added to dropdown

### Questions?
This feature set is designed to provide rich spiritual resources while maintaining theological integrity and biblical fidelity.

---

## Future Enhancements (Potential)

- 📅 Devotional archive/calendar view
- 🔖 Save favorite devotionals
- 📧 Email daily devotional subscription
- 🎨 Devotional background image customization
- 📖 Multi-version Bible comparison in research tool
- 🌍 Community devotional discussion threads

---

**Built with ❤️ for the Kingdom | Powered by Claude Sonnet 4**
