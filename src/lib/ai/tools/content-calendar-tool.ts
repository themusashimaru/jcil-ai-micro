/**
 * CONTENT CALENDAR TOOL — Social media content calendar with planned posts
 * across platforms. Includes copy, hashtags, image specs, and posting schedule.
 * No external dependencies. Created: 2026-03-19
 */
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

type ContentType = 'image' | 'video' | 'carousel' | 'story' | 'reel' | 'text' | 'link';
type PostStatus = 'draft' | 'scheduled' | 'published';

interface Post {
  date: string;
  platform: string;
  content_type?: ContentType;
  copy: string;
  hashtags?: string;
  media_notes?: string;
  time?: string;
  status?: PostStatus;
  campaign?: string;
}

interface Campaign {
  name: string;
  goal?: string;
  hashtag?: string;
}

const PLATFORM_ABBR: Record<string, string> = {
  instagram: 'IG', twitter: 'TW', 'twitter/x': 'TW', x: 'TW',
  linkedin: 'LI', facebook: 'FB', tiktok: 'TT', youtube: 'YT',
};

const PLATFORM_COLORS: Record<string, string> = {
  ig: '#e1306c', tw: '#1da1f2', li: '#0077b5', fb: '#1877f2', tt: '#000000', yt: '#ff0000',
};

// ============================================================================
// HELPERS
// ============================================================================

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function abbr(platform: string): string {
  return PLATFORM_ABBR[platform.toLowerCase()] ?? platform.slice(0, 2).toUpperCase();
}

function colorFor(platform: string): string {
  const key = abbr(platform).toLowerCase();
  return PLATFORM_COLORS[key] ?? '#666666';
}

function preview(copy: string, max = 50): string {
  return copy.length <= max ? copy : copy.slice(0, max - 3) + '...';
}

function collectHashtags(posts: Post[]): string[] {
  const set = new Set<string>();
  for (const p of posts) {
    if (!p.hashtags) continue;
    for (const tag of p.hashtags.split(/[\s,]+/)) {
      const t = tag.trim();
      if (t) set.add(t.startsWith('#') ? t : `#${t}`);
    }
  }
  return [...set].sort();
}

function countBy<T>(arr: T[], key: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of arr) {
    const k = key(item);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

// ============================================================================
// MARKDOWN FORMATTER
// ============================================================================

function formatMarkdown(
  title: string, dateRange: { start: string; end: string }, platforms: string[],
  posts: Post[], campaigns: Campaign[], contentMix: string | undefined,
): string {
  const L: string[] = [];
  L.push(`# ${title}`, '', `**Date Range:** ${dateRange.start} to ${dateRange.end}`);
  if (platforms.length > 0) L.push(`**Platforms:** ${platforms.join(', ')}`);
  L.push(`**Total Posts:** ${posts.length}`, '');

  if (campaigns.length > 0) {
    L.push('## Campaigns', '');
    for (const c of campaigns) {
      L.push(`### ${c.name}`);
      if (c.goal) L.push(`- **Goal:** ${c.goal}`);
      if (c.hashtag) L.push(`- **Hashtag:** ${c.hashtag}`);
      L.push('');
    }
  }

  if (contentMix) { L.push('## Content Strategy', '', contentMix, ''); }

  L.push('## Content Calendar', '',
    '| Date | Platform | Type | Copy Preview | Time | Status |',
    '|------|----------|------|-------------|------|--------|');
  for (const p of posts) {
    const type = p.content_type ?? '-';
    const time = p.time ?? '-';
    const status = p.status ?? 'draft';
    L.push(`| ${p.date} | ${abbr(p.platform)} | ${type} | ${preview(p.copy)} | ${time} | ${status} |`);
  }
  L.push('');

  const hashtags = collectHashtags(posts);
  if (hashtags.length > 0) {
    L.push('## Hashtag Bank', '', hashtags.join(' '), '');
  }

  const byPlatform = countBy(posts, (p) => abbr(p.platform));
  L.push('## Platform Summary', '', '| Platform | Posts |', '|----------|-------|');
  for (const [plat, count] of Object.entries(byPlatform)) {
    L.push(`| ${plat} | ${count} |`);
  }
  L.push('');

  return L.join('\n');
}

// ============================================================================
// HTML FORMATTER
// ============================================================================

const CSS = [
  'body{font-family:system-ui,sans-serif;max-width:960px;margin:0 auto;padding:20px;color:#1a1a1a}',
  '.hdr{background:linear-gradient(135deg,#e1306c,#1da1f2);color:#fff;padding:20px 24px;border-radius:8px;margin-bottom:20px}',
  '.hdr h1{margin:0 0 6px}.hdr p{margin:2px 0;opacity:.9}',
  'h2{color:#333;margin-top:28px;border-bottom:1px solid #ddd;padding-bottom:6px}',
  '.campaigns{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin:12px 0}',
  '.camp{border:1px solid #ddd;border-radius:6px;padding:12px 14px;background:#fafafa}',
  '.camp h3{margin:0 0 6px;font-size:1em}',
  '.strategy{background:#f5f5ff;border-left:4px solid #6366f1;padding:12px 16px;border-radius:4px;margin:12px 0}',
  '.grid{display:grid;gap:10px;margin:12px 0}',
  '.post{border:1px solid #ddd;border-radius:6px;padding:12px 14px;border-left:4px solid #666}',
  '.post .top{display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap}',
  '.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:.75em;font-weight:600}',
  '.plat{color:#fff}.type{background:#eee;color:#555}',
  '.s-draft{background:#9ca3af;color:#fff}.s-scheduled{background:#3b82f6;color:#fff}.s-published{background:#22c55e;color:#fff}',
  '.copy{margin:6px 0;font-size:.95em}.meta{font-size:.85em;color:#666}',
  '.tags{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}',
  '.tag{background:#e0e7ff;color:#4338ca;padding:3px 10px;border-radius:12px;font-size:.85em}',
  '.summary td,.summary th{border:1px solid #ddd;padding:8px 12px;text-align:left}',
  '.summary th{background:#333;color:#fff}.summary{border-collapse:collapse;width:100%;margin:12px 0}',
  '@media print{body{padding:0}.post{break-inside:avoid}.hdr{-webkit-print-color-adjust:exact;print-color-adjust:exact}}',
].join('');

function formatHtml(
  title: string, dateRange: { start: string; end: string }, platforms: string[],
  posts: Post[], campaigns: Campaign[], contentMix: string | undefined,
): string {
  const h: string[] = [];
  h.push(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(title)}</title>`);
  h.push(`<style>${CSS}</style></head><body>`);

  // Header
  h.push(`<div class="hdr"><h1>${esc(title)}</h1>`);
  h.push(`<p>${esc(dateRange.start)} to ${esc(dateRange.end)}</p>`);
  if (platforms.length > 0) h.push(`<p>${platforms.map(esc).join(', ')}</p>`);
  h.push(`<p>${posts.length} planned posts</p></div>`);

  // Campaigns
  if (campaigns.length > 0) {
    h.push('<h2>Campaigns</h2><div class="campaigns">');
    for (const c of campaigns) {
      h.push(`<div class="camp"><h3>${esc(c.name)}</h3>`);
      if (c.goal) h.push(`<p><strong>Goal:</strong> ${esc(c.goal)}</p>`);
      if (c.hashtag) h.push(`<p><strong>Hashtag:</strong> ${esc(c.hashtag)}</p>`);
      h.push('</div>');
    }
    h.push('</div>');
  }

  // Strategy
  if (contentMix) {
    h.push(`<div class="strategy"><strong>Content Strategy:</strong> ${esc(contentMix)}</div>`);
  }

  // Posts grid
  h.push('<h2>Content Calendar</h2><div class="grid">');
  for (const p of posts) {
    const pColor = colorFor(p.platform);
    const status = p.status ?? 'draft';
    h.push(`<div class="post" style="border-left-color:${pColor}">`);
    h.push('<div class="top">');
    h.push(`<span class="badge plat" style="background:${pColor}">${esc(abbr(p.platform))}</span>`);
    if (p.content_type) h.push(`<span class="badge type">${esc(p.content_type)}</span>`);
    h.push(`<span class="badge s-${status}">${esc(status)}</span>`);
    if (p.campaign) h.push(`<span class="meta">${esc(p.campaign)}</span>`);
    h.push('</div>');
    h.push(`<div class="copy">${esc(p.copy)}</div>`);
    h.push(`<div class="meta"><strong>${esc(p.date)}</strong>`);
    if (p.time) h.push(` &middot; ${esc(p.time)}`);
    if (p.media_notes) h.push(` &middot; ${esc(p.media_notes)}`);
    h.push('</div>');
    if (p.hashtags) h.push(`<div class="meta" style="margin-top:4px">${esc(p.hashtags)}</div>`);
    h.push('</div>');
  }
  h.push('</div>');

  // Hashtag cloud
  const hashtags = collectHashtags(posts);
  if (hashtags.length > 0) {
    h.push('<h2>Hashtag Bank</h2><div class="tags">');
    for (const tag of hashtags) h.push(`<span class="tag">${esc(tag)}</span>`);
    h.push('</div>');
  }

  // Platform summary
  const byPlatform = countBy(posts, (p) => abbr(p.platform));
  h.push('<h2>Platform Summary</h2><table class="summary"><thead><tr><th>Platform</th><th>Posts</th></tr></thead><tbody>');
  for (const [plat, count] of Object.entries(byPlatform)) {
    h.push(`<tr><td>${esc(plat)}</td><td>${count}</td></tr>`);
  }
  h.push('</tbody></table>');

  h.push('</body></html>');
  return h.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const contentCalendarTool: UnifiedTool = {
  name: 'content_calendar',
  description: `Create social media content calendars with planned posts across platforms.

Use this when:
- User wants to plan social media content
- User needs a posting schedule across platforms
- User wants to organize campaigns with hashtags and copy
- User needs a content calendar for Instagram, Twitter/X, LinkedIn, Facebook, TikTok, or YouTube

Returns a formatted content calendar with post details, hashtag bank, and platform summary.`,
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Calendar title (e.g., "March 2026 Content Plan")' },
      date_range: {
        type: 'object',
        properties: {
          start: { type: 'string', description: 'Start date' },
          end: { type: 'string', description: 'End date' },
        },
        required: ['start', 'end'],
        description: 'Date range for the calendar',
      },
      platforms: {
        type: 'array', items: { type: 'string' },
        description: 'Target platforms (e.g., ["Instagram", "Twitter/X", "LinkedIn"])',
      },
      posts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'Post date' },
            platform: { type: 'string', description: 'Target platform' },
            content_type: { type: 'string', enum: ['image', 'video', 'carousel', 'story', 'reel', 'text', 'link'], description: 'Content type' },
            copy: { type: 'string', description: 'Post copy / caption' },
            hashtags: { type: 'string', description: 'Hashtags for the post' },
            media_notes: { type: 'string', description: 'Image/video specs or notes' },
            time: { type: 'string', description: 'Best posting time' },
            status: { type: 'string', enum: ['draft', 'scheduled', 'published'], description: 'Post status' },
            campaign: { type: 'string', description: 'Associated campaign name' },
          },
          required: ['date', 'platform', 'copy'],
        },
        description: 'Array of planned posts',
      },
      campaigns: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Campaign name' },
            goal: { type: 'string', description: 'Campaign goal' },
            hashtag: { type: 'string', description: 'Campaign hashtag' },
          },
          required: ['name'],
        },
        description: 'Campaign definitions',
      },
      content_mix: { type: 'string', description: 'Content strategy notes' },
      format: { type: 'string', enum: ['markdown', 'html'], description: 'Output format. Default: "markdown"' },
    },
    required: ['title', 'date_range', 'posts'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isContentCalendarAvailable(): boolean {
  return true;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeContentCalendar(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    title: string;
    date_range: { start: string; end: string };
    platforms?: string[];
    posts: Post[];
    campaigns?: Campaign[];
    content_mix?: string;
    format?: 'markdown' | 'html';
  };

  if (!args.title?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: title parameter is required', isError: true };
  }
  if (!args.date_range?.start || !args.date_range?.end) {
    return { toolCallId: toolCall.id, content: 'Error: date_range with start and end is required', isError: true };
  }
  if (!Array.isArray(args.posts) || args.posts.length === 0) {
    return { toolCallId: toolCall.id, content: 'Error: posts array is required and must not be empty', isError: true };
  }

  for (let i = 0; i < args.posts.length; i++) {
    const p = args.posts[i];
    if (!p.date || !p.platform || !p.copy) {
      return {
        toolCallId: toolCall.id,
        content: `Error: post at index ${i} is missing required fields (date, platform, copy)`,
        isError: true,
      };
    }
  }

  const fmt = args.format ?? 'markdown';
  const platforms = args.platforms ?? [];
  const campaigns = args.campaigns ?? [];
  const postsByPlatform = countBy(args.posts, (p) => abbr(p.platform));
  const postsByStatus = countBy(args.posts, (p) => p.status ?? 'draft');
  const contentTypes = [...new Set(args.posts.map((p) => p.content_type).filter(Boolean))];
  const platformsUsed = [...new Set(args.posts.map((p) => p.platform))];

  try {
    const formatted = fmt === 'html'
      ? formatHtml(args.title, args.date_range, platforms, args.posts, campaigns, args.content_mix)
      : formatMarkdown(args.title, args.date_range, platforms, args.posts, campaigns, args.content_mix);

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Content calendar created: ${args.title} (${args.posts.length} posts)`,
        format: fmt,
        formatted_output: formatted,
        summary: {
          title: args.title,
          date_range: args.date_range,
          total_posts: args.posts.length,
          platforms_used: platformsUsed,
          posts_by_platform: postsByPlatform,
          posts_by_status: postsByStatus,
          campaigns_count: campaigns.length,
          content_types_used: contentTypes,
        },
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error generating content calendar: ${(error as Error).message}`,
      isError: true,
    };
  }
}
