/**
 * TRIP PLANNER TOOL — Travel itinerary builder with day-by-day schedule,
 * packing lists, budget breakdowns, and travel tips.
 * No external dependencies. Created: 2026-03-19
 */
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface ItineraryDay {
  day: number;
  date: string;
  morning: string;
  afternoon: string;
  evening: string;
  meals?: string;
  accommodation?: string;
  estimated_cost?: string;
  notes?: string;
}

type PackingCategory = 'clothing' | 'toiletries' | 'electronics' | 'documents' | 'other';

interface PackingItem {
  item: string;
  category: PackingCategory;
}

interface BudgetBreakdown {
  accommodation: string;
  food: string;
  transportation: string;
  activities: string;
  miscellaneous: string;
  total: string;
}

const PACKING_CATEGORIES: PackingCategory[] = ['documents', 'clothing', 'toiletries', 'electronics', 'other'];
const PACKING_LABELS: Record<PackingCategory, string> = {
  documents: 'Documents & Money',
  clothing: 'Clothing',
  toiletries: 'Toiletries',
  electronics: 'Electronics',
  other: 'Other',
};

// ============================================================================
// HELPERS
// ============================================================================

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function groupPacking(items: PackingItem[]): Map<PackingCategory, PackingItem[]> {
  const grouped = new Map<PackingCategory, PackingItem[]>();
  for (const item of items) {
    const cat = PACKING_CATEGORIES.includes(item.category) ? item.category : 'other';
    const list = grouped.get(cat) ?? [];
    list.push(item);
    grouped.set(cat, list);
  }
  for (const [, list] of grouped) list.sort((a, b) => a.item.localeCompare(b.item));
  return grouped;
}

function duration(start: string, end: string): number {
  return Math.max(1, Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000));
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ============================================================================
// MARKDOWN FORMATTER
// ============================================================================

function formatMarkdown(
  dest: string, start: string, end: string, travelers: number, level: string,
  days: ItineraryDay[], packing: PackingItem[],
  budget: BudgetBreakdown | undefined, tips: string[],
): string {
  const L: string[] = [];
  const dur = duration(start, end);
  L.push(`# Trip to ${dest}`, '', `**Dates:** ${start} to ${end} (${dur} days)`,
    `**Travelers:** ${travelers}`, `**Budget Level:** ${cap(level)}`, '', '## Itinerary', '');
  for (const d of days) {
    L.push(`### Day ${d.day} — ${d.date}`, '',
      '| Time | Activity |', '|------|----------|',
      `| Morning | ${d.morning} |`, `| Afternoon | ${d.afternoon} |`, `| Evening | ${d.evening} |`);
    if (d.meals) L.push(`| Meals | ${d.meals} |`);
    L.push('');
    if (d.accommodation) L.push(`**Accommodation:** ${d.accommodation}`);
    if (d.estimated_cost) L.push(`**Estimated Cost:** ${d.estimated_cost}`);
    if (d.notes) L.push(`> ${d.notes}`);
    L.push('');
  }
  if (budget) {
    L.push('## Budget Breakdown', '', '| Category | Amount |', '|----------|--------|',
      `| Accommodation | ${budget.accommodation} |`, `| Food | ${budget.food} |`,
      `| Transportation | ${budget.transportation} |`, `| Activities | ${budget.activities} |`,
      `| Miscellaneous | ${budget.miscellaneous} |`, `| **Total** | **${budget.total}** |`, '');
  }
  if (packing.length > 0) {
    L.push('## Packing List', '');
    const grouped = groupPacking(packing);
    for (const cat of PACKING_CATEGORIES) {
      const items = grouped.get(cat);
      if (!items?.length) continue;
      L.push(`### ${PACKING_LABELS[cat]}`, '');
      for (const item of items) L.push(`- [ ] ${item.item}`);
      L.push('');
    }
  }
  if (tips.length > 0) {
    L.push('## Travel Tips', '');
    for (const tip of tips) L.push(`- ${tip}`);
    L.push('');
  }
  return L.join('\n');
}

// ============================================================================
// HTML FORMATTER
// ============================================================================

const CSS = [
  'body{font-family:system-ui,sans-serif;max-width:900px;margin:0 auto;padding:20px;color:#1a1a1a}',
  'h1{color:#1a4a7a;border-bottom:2px solid #1a4a7a;padding-bottom:8px}',
  'h2{color:#2a5a8a;margin-top:28px}h3{color:#3a6a9a;margin-top:18px}',
  '.meta{background:#e8f0fa;padding:12px 16px;border-radius:6px;margin-bottom:20px}',
  '.meta span{margin-right:20px}',
  '.day{border:1px solid #ddd;border-radius:8px;padding:16px;margin:12px 0;background:#fafcff}',
  '.day h3{margin-top:0;color:#1a4a7a}',
  'table{width:100%;border-collapse:collapse;margin:8px 0}',
  'th,td{border:1px solid #ddd;padding:8px 12px;text-align:left}',
  'th{background:#1a4a7a;color:#fff}tr:nth-child(even){background:#f5f8fc}',
  '.total{font-weight:700;background:#e8f0fa !important}',
  '.det{font-size:.9em;color:#555;margin-top:6px}.note{font-style:italic;color:#666;margin-top:4px}',
  '.cl{list-style:none;padding:0}.cl li{padding:4px 0;display:flex;align-items:center;gap:8px}',
  '.cl input[type=checkbox]{width:18px;height:18px}',
  '.tips{background:#f0f7e6;padding:12px 16px;border-radius:6px;border-left:4px solid #2d5016}',
  '@media print{body{padding:0}.day{break-inside:avoid}}',
].join('');

function formatHtml(
  dest: string, start: string, end: string, travelers: number, level: string,
  days: ItineraryDay[], packing: PackingItem[],
  budget: BudgetBreakdown | undefined, tips: string[],
): string {
  const h: string[] = [];
  const dur = duration(start, end);
  h.push(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Trip to ${esc(dest)}</title>`);
  h.push(`<style>${CSS}</style></head><body>`);
  h.push(`<h1>Trip to ${esc(dest)}</h1>`);
  h.push(`<div class="meta"><span><strong>Dates:</strong> ${esc(start)} to ${esc(end)} (${dur} days)</span>`);
  h.push(`<span><strong>Travelers:</strong> ${travelers}</span>`);
  h.push(`<span><strong>Budget:</strong> ${esc(cap(level))}</span></div>`);
  h.push('<h2>Itinerary</h2>');
  for (const d of days) {
    h.push(`<div class="day"><h3>Day ${d.day} &mdash; ${esc(d.date)}</h3>`);
    h.push('<table><thead><tr><th>Time</th><th>Activity</th></tr></thead><tbody>');
    h.push(`<tr><td>Morning</td><td>${esc(d.morning)}</td></tr>`);
    h.push(`<tr><td>Afternoon</td><td>${esc(d.afternoon)}</td></tr>`);
    h.push(`<tr><td>Evening</td><td>${esc(d.evening)}</td></tr>`);
    if (d.meals) h.push(`<tr><td>Meals</td><td>${esc(d.meals)}</td></tr>`);
    h.push('</tbody></table>');
    if (d.accommodation) h.push(`<div class="det"><strong>Accommodation:</strong> ${esc(d.accommodation)}</div>`);
    if (d.estimated_cost) h.push(`<div class="det"><strong>Estimated Cost:</strong> ${esc(d.estimated_cost)}</div>`);
    if (d.notes) h.push(`<div class="note">${esc(d.notes)}</div>`);
    h.push('</div>');
  }
  if (budget) {
    h.push('<h2>Budget Breakdown</h2><table><thead><tr><th>Category</th><th>Amount</th></tr></thead><tbody>');
    h.push(`<tr><td>Accommodation</td><td>${esc(budget.accommodation)}</td></tr>`);
    h.push(`<tr><td>Food</td><td>${esc(budget.food)}</td></tr>`);
    h.push(`<tr><td>Transportation</td><td>${esc(budget.transportation)}</td></tr>`);
    h.push(`<tr><td>Activities</td><td>${esc(budget.activities)}</td></tr>`);
    h.push(`<tr><td>Miscellaneous</td><td>${esc(budget.miscellaneous)}</td></tr>`);
    h.push(`<tr class="total"><td><strong>Total</strong></td><td><strong>${esc(budget.total)}</strong></td></tr>`);
    h.push('</tbody></table>');
  }
  if (packing.length > 0) {
    h.push('<h2>Packing List</h2>');
    const grouped = groupPacking(packing);
    for (const cat of PACKING_CATEGORIES) {
      const items = grouped.get(cat);
      if (!items?.length) continue;
      h.push(`<h3>${PACKING_LABELS[cat]}</h3><ul class="cl">`);
      for (const item of items) h.push(`<li><input type="checkbox"><span>${esc(item.item)}</span></li>`);
      h.push('</ul>');
    }
  }
  if (tips.length > 0) {
    h.push('<div class="tips"><h2 style="margin-top:0">Travel Tips</h2><ul>');
    for (const tip of tips) h.push(`<li>${esc(tip)}</li>`);
    h.push('</ul></div>');
  }
  h.push('</body></html>');
  return h.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const tripPlannerTool: UnifiedTool = {
  name: 'plan_trip',
  description: `Build detailed travel itineraries with day-by-day schedules, packing lists, and budget breakdowns.

Use this when:
- User is planning a trip or vacation
- User wants a travel itinerary
- User asks for packing lists
- User needs help budgeting for travel
- User wants travel recommendations organized into a plan

Returns a complete travel plan with daily schedule, packing checklist, budget summary, and travel tips — ready to print or share.`,
  parameters: {
    type: 'object',
    properties: {
      destination: { type: 'string', description: 'Trip destination' },
      start_date: { type: 'string', description: 'Trip start date (e.g., "2026-04-01")' },
      end_date: { type: 'string', description: 'Trip end date (e.g., "2026-04-07")' },
      travelers: { type: 'number', description: 'Number of travelers. Default: 1' },
      budget_level: {
        type: 'string',
        enum: ['budget', 'moderate', 'luxury'],
        description: 'Budget level. Default: "moderate"',
      },
      itinerary: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            day: { type: 'number', description: 'Day number (1, 2, 3...)' },
            date: { type: 'string', description: 'Date string (e.g., "April 1")' },
            morning: { type: 'string', description: 'Morning activity' },
            afternoon: { type: 'string', description: 'Afternoon activity' },
            evening: { type: 'string', description: 'Evening activity' },
            meals: { type: 'string', description: 'Meal plan for the day' },
            accommodation: { type: 'string', description: 'Where to stay' },
            estimated_cost: { type: 'string', description: 'Estimated daily cost' },
            notes: { type: 'string', description: 'Additional notes for this day' },
          },
          required: ['day', 'date', 'morning', 'afternoon', 'evening'],
        },
        description: 'Day-by-day itinerary entries',
      },
      packing_list: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            item: { type: 'string', description: 'Item to pack' },
            category: {
              type: 'string',
              enum: ['clothing', 'toiletries', 'electronics', 'documents', 'other'],
              description: 'Packing category',
            },
          },
          required: ['item', 'category'],
        },
        description: 'Categorized packing list',
      },
      budget_breakdown: { type: 'object', description: 'Budget breakdown by category' },
      travel_tips: {
        type: 'array',
        items: { type: 'string' },
        description: 'Practical travel tips for the destination',
      },
      format: {
        type: 'string',
        enum: ['markdown', 'html'],
        description: 'Output format. Default: "markdown"',
      },
    },
    required: ['destination', 'start_date', 'end_date', 'itinerary'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isTripPlannerAvailable(): boolean {
  return true;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeTripPlanner(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    destination: string;
    start_date: string;
    end_date: string;
    travelers?: number;
    budget_level?: 'budget' | 'moderate' | 'luxury';
    itinerary: ItineraryDay[];
    packing_list?: PackingItem[];
    budget_breakdown?: BudgetBreakdown;
    travel_tips?: string[];
    format?: 'markdown' | 'html';
  };

  if (!args.destination?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: destination parameter is required', isError: true };
  }
  if (!args.start_date) {
    return { toolCallId: toolCall.id, content: 'Error: start_date parameter is required', isError: true };
  }
  if (!args.end_date) {
    return { toolCallId: toolCall.id, content: 'Error: end_date parameter is required', isError: true };
  }
  if (!Array.isArray(args.itinerary) || args.itinerary.length === 0) {
    return { toolCallId: toolCall.id, content: 'Error: itinerary array is required and must not be empty', isError: true };
  }

  for (let i = 0; i < args.itinerary.length; i++) {
    const d = args.itinerary[i];
    if (typeof d.day !== 'number' || !d.date || !d.morning || !d.afternoon || !d.evening) {
      return {
        toolCallId: toolCall.id,
        content: `Error: itinerary entry at index ${i} is missing required fields (day, date, morning, afternoon, evening)`,
        isError: true,
      };
    }
  }

  if (args.packing_list) {
    for (let i = 0; i < args.packing_list.length; i++) {
      const item = args.packing_list[i];
      if (!item.item || !item.category) {
        return {
          toolCallId: toolCall.id,
          content: `Error: packing list item at index ${i} is missing required fields (item, category)`,
          isError: true,
        };
      }
    }
  }

  if (args.budget_breakdown) {
    const b = args.budget_breakdown;
    if (!b.accommodation || !b.food || !b.transportation || !b.activities || !b.miscellaneous || !b.total) {
      return {
        toolCallId: toolCall.id,
        content: 'Error: budget_breakdown must include accommodation, food, transportation, activities, miscellaneous, and total',
        isError: true,
      };
    }
  }

  const fmt = args.format ?? 'markdown';
  const travelers = args.travelers ?? 1;
  const level = args.budget_level ?? 'moderate';
  const packing = args.packing_list ?? [];
  const tips = args.travel_tips ?? [];
  const dur = duration(args.start_date, args.end_date);

  try {
    const formatted = fmt === 'html'
      ? formatHtml(args.destination, args.start_date, args.end_date, travelers, level, args.itinerary, packing, args.budget_breakdown, tips)
      : formatMarkdown(args.destination, args.start_date, args.end_date, travelers, level, args.itinerary, packing, args.budget_breakdown, tips);

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Trip plan created: ${args.destination} (${dur} days)`,
        format: fmt,
        formatted_output: formatted,
        summary: {
          destination: args.destination,
          start_date: args.start_date,
          end_date: args.end_date,
          duration_days: dur,
          travelers,
          budget_level: level,
          itinerary_days: args.itinerary.length,
          packing_items: packing.length,
          travel_tips_count: tips.length,
          has_budget: !!args.budget_breakdown,
        },
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error generating trip plan: ${(error as Error).message}`,
      isError: true,
    };
  }
}
