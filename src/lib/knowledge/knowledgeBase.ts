/**
 * KNOWLEDGE BASE SERVICE
 *
 * Fetches relevant prompt content from Supabase based on conversation topic.
 * Only loads what's needed, reducing token usage by ~90%.
 *
 * =================== ARCHITECTURE NOTES ===================
 *
 * This is the RETRIEVAL layer of the prompt system.
 * It fetches faith content from Supabase only when needed.
 *
 * FLOW:
 * 1. slimPrompt.ts → isFaithTopic() detects if faith content needed
 * 2. slimPrompt.ts → getRelevantCategories() determines which categories
 * 3. THIS FILE → getKnowledgeBaseContent() fetches from Supabase
 * 4. chat/route.ts → Appends KB content to system prompt
 *
 * SUPABASE TABLE: knowledge_base
 * Columns: id, category, subcategory, title, content, keywords, priority
 * Categories: worldview, apologetics, pastoral, cults, gospel
 *
 * TO ADD NEW FAITH CONTENT:
 * - Add rows to knowledge_base table in Supabase (NOT in code)
 * - Use existing categories OR add new ones and update getRelevantCategories()
 *
 * TO ADD NEW CATEGORY:
 * 1. Add content to Supabase with new category name
 * 2. Update getRelevantCategories() in slimPrompt.ts with trigger keywords
 * 3. Optionally add fallback in getFallbackContent() below
 *
 * CACHING:
 * - Results cached for 1 minute (CACHE_TTL_MS)
 * - Call clearKnowledgeBaseCache() to force refresh
 *
 * FALLBACK:
 * - If Supabase fails, getFallbackContent() provides minimal guidance
 * - This ensures chat works even without database
 *
 * SEE ALSO: src/lib/prompts/slimPrompt.ts for full architecture docs
 * =========================================================
 */

import { createClient } from '@supabase/supabase-js';

// Cache to avoid repeated DB calls for same categories
const contentCache = new Map<string, { content: string; timestamp: number }>();
const CACHE_TTL_MS = 60000; // 1 minute cache

/**
 * Get Supabase admin client
 */
function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[KnowledgeBase] Supabase not configured');
    return null;
  }

  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Fetch knowledge base content by categories
 */
export async function getKnowledgeBaseContent(categories: string[]): Promise<string> {
  if (categories.length === 0) {
    return '';
  }

  // Check cache first
  const cacheKey = categories.sort().join(',');
  const cached = contentCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[KnowledgeBase] Cache hit for: ${cacheKey}`);
    return cached.content;
  }

  const supabase = getSupabase();
  if (!supabase) {
    console.log('[KnowledgeBase] Supabase not available, using fallback');
    return getFallbackContent(categories);
  }

  try {
    const { data, error } = await supabase
      .from('knowledge_base')
      .select('category, title, content, priority')
      .in('category', categories)
      .eq('is_active', true)
      .order('priority', { ascending: true })
      .order('category', { ascending: true });

    if (error) {
      console.error('[KnowledgeBase] Query error:', error);
      return getFallbackContent(categories);
    }

    if (!data || data.length === 0) {
      console.log(`[KnowledgeBase] No content found for: ${categories.join(', ')}`);
      return getFallbackContent(categories);
    }

    // Combine all content
    const content = data
      .map((entry) => entry.content)
      .join('\n\n---\n\n');

    // Cache the result
    contentCache.set(cacheKey, { content, timestamp: Date.now() });

    console.log(`[KnowledgeBase] Loaded ${data.length} entries for: ${categories.join(', ')}`);
    return content;
  } catch (error) {
    console.error('[KnowledgeBase] Error:', error);
    return getFallbackContent(categories);
  }
}

/**
 * Fallback content when database is not available
 * This ensures the chat still works even if KB query fails
 */
function getFallbackContent(categories: string[]): string {
  const fallbacks: Record<string, string> = {
    worldview: `
## CHRISTIAN WORLDVIEW GUIDANCE

When answering questions about morality, ethics, or biblical topics:
- Ground answers in Scripture
- Be direct and confident, not wishy-washy
- Speak truth with love
- Acknowledge complexity while maintaining clarity on core truths
`,
    apologetics: `
## APOLOGETICS GUIDANCE

When defending the faith or answering skeptical questions:
- Use evidence and reason alongside Scripture
- Address the actual objection, not a strawman
- Be respectful but don't compromise truth
- Point to the evidence for the resurrection as the cornerstone
`,
    pastoral: `
## PASTORAL CARE GUIDANCE

When someone is struggling with serious life issues:
- Lead with compassion, not judgment
- Take suicidal thoughts VERY seriously - encourage professional help
- Point to hope in Christ while being practically helpful
- Recommend they speak with a pastor, counselor, or trusted friend
- For crisis: National Suicide Prevention Lifeline: 988
`,
    cults: `
## CULT/FALSE TEACHING GUIDANCE

When addressing cults or false teachings:
- Be clear that these teach a different Jesus/gospel
- Focus on the core doctrinal differences
- Show love for the person while opposing the false teaching
- Point them to biblical truth as the standard
`,
    gospel: `
## GOSPEL PRESENTATION

When presenting the gospel:
1. God created us for relationship with Him
2. Sin broke that relationship (Romans 3:23)
3. The penalty is death/separation (Romans 6:23)
4. Jesus paid that penalty (Romans 5:8)
5. Faith in Jesus restores the relationship (John 3:16, Romans 10:9)
6. This is a gift, not earned (Ephesians 2:8-9)
`,
  };

  const parts: string[] = [];
  for (const category of categories) {
    if (fallbacks[category]) {
      parts.push(fallbacks[category]);
    }
  }

  return parts.join('\n\n');
}

/**
 * Extract keywords from a message for knowledge base matching
 */
export function extractKeywords(message: string): string[] {
  const lowerMessage = message.toLowerCase();

  // Remove common stop words and punctuation
  const cleaned = lowerMessage
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2)
    .filter(word => !STOP_WORDS.has(word));

  // Return unique keywords
  return [...new Set(cleaned)];
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it',
  'we', 'they', 'what', 'which', 'who', 'whom', 'whose', 'where', 'when',
  'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 'just', 'also', 'now', 'here', 'there', 'then',
  'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'under', 'again', 'further', 'once', 'me', 'my', 'myself',
  'your', 'yourself', 'him', 'his', 'her', 'its', 'our', 'their', 'them',
]);

/**
 * Clear the content cache (useful for testing or forcing refresh)
 */
export function clearKnowledgeBaseCache(): void {
  contentCache.clear();
  console.log('[KnowledgeBase] Cache cleared');
}
