/**
 * TRIP PLANNER TOOL
 *
 * Travel itinerary builder with day-by-day schedule, packing lists,
 * budget breakdowns, and travel tips.
 * Opus generates the content, this tool structures the output.
 *
 * No external dependencies.
 *
 * Created: 2026-03-19
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

const PACKING_CATEGORIES: PackingCategory[] = [
  'documents',
  'clothing',
  'toiletries',
  'electronics',
  'other',
];

const PACKING_CATEGORY_LABELS: Record<PackingCategory, string> = {
  documents: 'Documents & Money',
  clothing: 'Clothing',
  toiletries: 'Toiletries',
  electronics: 'Electronics',
  other: 'Other',
};

// ============================================================================
// HELPERS
// ============================================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function groupPackingByCategory(items: PackingItem[]): Map<PackingCategory, PackingItem[]> {
  const grouped = new Map<PackingCategory, PackingItem[]>();
  for (const item of items) {
    const cat = PACKING_CATEGORIES.includes(item.category) ? item.category : 'other';
    const list = grouped.get(cat) ?? [];
    list.push(item);
    grouped.set(cat, list);
  }
  for (const [cat, list] of grouped) {
    list.sort((a, b) => a.item.localeCompare(b.item));
    grouped.set(cat, list);
  }
  return grouped;
}

function computeDuration(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

// ============================================================================
// MARKDOWN FORMATTER
// ============================================================================

function formatMarkdown(
  destination: string,
  startDate: string,
  endDate: string,
  travelers: number,
  budgetLevel: string,
  itinerary: ItineraryDay[],
  packingList: PackingItem[],
  budget: BudgetBreakdown | undefined,
  travelTips: string[],
): string {
  const lines: string[] = [];
  const duration = computeDuration(startDate, endDate);

  lines.push(`# Trip to ${destination}`);
  lines.push('');
  lines.push(`**Dates:** ${startDate} to ${endDate} (${duration} days)`);
  lines.push(`**Travelers:** ${travelers}`);
  lines.push(`**Budget Level:** ${budgetLevel.charAt(0).toUpperCase() + budgetLevel.slice(1)}`);
  lines.push('');

  // Itinerary
  lines.push('## Itinerary');
  lines.push('');
  for (const day of itinerary) {
    lines.push(`### Day ${day.day} — ${day.date}`);
    lines.push('');
    lines.push(`| Time | Activity |`);
    lines.push(`|------|----------|`);
    lines.push(`| Morning | ${day.morning} |`);
    lines.push(`| Afternoon | ${day.afternoon} |`);
    lines.push(`| Evening | ${day.evening} |`);
    if (day.meals) {
      lines.push(`| Meals | ${day.meals} |`);
    }
    lines.push('');
    if (day.accommodation) {
      lines.push(`**Accommodation:** ${day.accommodation}`);
    }
    if (day.estimated_cost) {
      lines.push(`**Estimated Cost:** ${day.estimated_cost}`);
    }
    if (day.notes) {
      lines.push(`> ${day.notes}`);
    }
    lines.push('');
  }

  // Budget breakdown
  if (budget) {
    lines.push('## Budget Breakdown');
    lines.push('');
    lines.push('| Category | Amount |');
    lines.push('|----------|--------|');
    lines.push(`| Accommodation | ${budget.accommodation} |`);
    lines.push(`| Food | ${budget.food} |`);
    lines.push(`| Transportation | ${budget.transportation} |`);
    lines.push(`| Activities | ${budget.activities} |`);
    lines.push(`| Miscellaneous | ${budget.miscellaneous} |`);
    lines.push(`| **Total** | **${budget.total}** |`);
    lines.push('');
  }

  // Packing list
  if (packingList.length > 0) {
    lines.push('## Packing List');
    lines.push('');
    const grouped = groupPackingByCategory(packingList);
    for (const cat of PACKING_CATEGORIES) {
      const items = grouped.get(cat);
      if (!items || items.length === 0) continue;
      lines.push(`### ${PACKING_CATEGORY_LABELS[cat]}`);
      lines.push('');
      for (const item of items) {
        lines.push(`- [ ] ${item.item}`);
      }
      lines.push('');
    }
  }

  // Travel tips
  if (travelTips.length > 0) {
    lines.push('## Travel Tips');
    lines.push('');
    for (const tip of travelTips) {
      lines.push(`- ${tip}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// HTML FORMATTER
// ============================================================================

function formatHtml(
  destination: string,
  startDate: string,
  endDate: string,
  travelers: number,
  budgetLevel: string,
  itinerary: ItineraryDay[],
  packingList: PackingItem[],
  budget: BudgetBreakdown | undefined,
  travelTips: string[],
): string {
  const p: string[] = [];
  const duration = computeDuration(startDate, endDate);

  p.push('<!DOCTYPE html>');
  p.push('<html lang="en"><head><meta charset="UTF-8">');
  p.push(`<title>Trip to ${escapeHtml(destination)}</title>`);
  p.push('<style>');
  p.push('body{font-family:system-ui,sans-serif;max-width:900px;margin:0 auto;padding:20px;color:#1a1a1a}');
  p.push('h1{color:#1a4a7a;border-bottom:2px solid #1a4a7a;padding-bottom:8px}');
  p.push('h2{color:#2a5a8a;margin-top:28px}');
  p.push('h3{color:#3a6a9a;margin-top:18px}');
  p.push('.meta{background:#e8f0fa;padding:12px 16px;border-radius:6px;margin-bottom:20px}');
  p.push('.meta span{margin-right:20px}');
  p.push('.day-card{border:1px solid #ddd;border-radius:8px;padding:16px;margin:12px 0;background:#fafcff}');
  p.push('.day-card h3{margin-top:0;color:#1a4a7a}');
  p.push('table{width:100%;border-collapse:collapse;margin:8px 0}');
  p.push('th,td{border:1px solid #ddd;padding:8px 12px;text-align:left}');
  p.push('th{background:#1a4a7a;color:#fff}');
  p.push('tr:nth-child(even){background:#f5f8fc}');
  p.push('.budget-total{font-weight:700;background:#e8f0fa !important}');
  p.push('.detail{font-size:0.9em;color:#555;margin-top:6px}');
  p.push('.note{font-style:italic;color:#666;margin-top:4px}');
  p.push('.checklist{list-style:none;padding:0}');
  p.push('.checklist li{padding:4px 0;display:flex;align-items:center;gap:8px}');
  p.push('.checklist input[type=checkbox]{width:18px;height:18px}');
  p.push('.tips{background:#f0f7e6;padding:12px 16px;border-radius:6px;border-left:4px solid #2d5016}');
  p.push('.tips ul{margin:8px 0;padding-left:20px}');
  p.push('@media print{body{padding:0}.day-card{break-inside:avoid}}');
  p.push('</style></head><body>');

  p.push(`<h1>Trip to ${escapeHtml(destination)}</h1>`);
  p.push('<div class="meta">');
  p.push(`<span><strong>Dates:</strong> ${escapeHtml(startDate)} to ${escapeHtml(endDate)} (${duration} days)</span>`);
  p.push(`<span><strong>Travelers:</strong> ${travelers}</span>`);
  p.push(`<span><strong>Budget:</strong> ${escapeHtml(budgetLevel.charAt(0).toUpperCase() + budgetLevel.slice(1))}</span>`);
  p.push('</div>');

  // Itinerary
  p.push('<h2>Itinerary</h2>');
  for (const day of itinerary) {
    p.push('<div class="day-card">');
    p.push(`<h3>Day ${day.day} &mdash; ${escapeHtml(day.date)}</h3>`);
    p.push('<table><thead><tr><th>Time</th><th>Activity</th></tr></thead><tbody>');
    p.push(`<tr><td>Morning</td><td>${escapeHtml(day.morning)}</td></tr>`);
    p.push(`<tr><td>Afternoon</td><td>${escapeHtml(day.afternoon)}</td></tr>`);
    p.push(`<tr><td>Evening</td><td>${escapeHtml(day.evening)}</td></tr>`);
    if (day.meals) {
      p.push(`<tr><td>Meals</td><td>${escapeHtml(day.meals)}</td></tr>`);
    }
    p.push('</tbody></table>');
    if (day.accommodation) {
      p.push(`<div class="detail"><strong>Accommodation:</strong> ${escapeHtml(day.accommodation)}</div>`);
    }
    if (day.estimated_cost) {
      p.push(`<div class="detail"><strong>Estimated Cost:</strong> ${escapeHtml(day.estimated_cost)}</div>`);
    }
    if (day.notes) {
      p.push(`<div class="note">${escapeHtml(day.notes)}</div>`);
    }
    p.push('</div>');
  }

  // Budget
  if (budget) {
    p.push('<h2>Budget Breakdown</h2>');
    p.push('<table><thead><tr><th>Category</th><th>Amount</th></tr></thead><tbody>');
    p.push(`<tr><td>Accommodation</td><td>${escapeHtml(budget.accommodation)}</td></tr>`);
    p.push(`<tr><td>Food</td><td>${escapeHtml(budget.food)}</td></tr>`);
    p.push(`<tr><td>Transportation</td><td>${escapeHtml(budget.transportation)}</td></tr>`);
    p.push(`<tr><td>Activities</td><td>${escapeHtml(budget.activities)}</td></tr>`);
    p.push(`<tr><td>Miscellaneous</td><td>${escapeHtml(budget.miscellaneous)}</td></tr>`);
    p.push(`<tr class="budget-total"><td><strong>Total</strong></td><td><strong>${escapeHtml(budget.total)}</strong></td></tr>`);
    p.push('</tbody></table>');
  }

  // Packing list
  if (packingList.length > 0) {
    p.push('<h2>Packing List</h2>');
    const grouped = groupPackingByCategory(packingList);
    for (const cat of PACKING_CATEGORIES) {
      const items = grouped.get(cat);
      if (!items || items.length === 0) continue;
      p.push(`<h3>${PACKING_CATEGORY_LABELS[cat]}</h3>`);
      p.push('<ul class="checklist">');
      for (const item of items) {
        p.push(`<li><input type="checkbox"><span>${escapeHtml(item.item)}</span></li>`);
      }
      p.push('</ul>');
    }
  }

  // Travel tips
  if (travelTips.length > 0) {
    p.push('<div class="tips"><h2 style="margin-top:0">Travel Tips</h2><ul>');
    for (const tip of travelTips) {
      p.push(`<li>${escapeHtml(tip)}</li>`);
    }
    p.push('</ul></div>');
  }

  p.push('</body></html>');
  return p.join('\n');
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
      destination: {
        type: 'string',
        description: 'Trip destination',
      },
      start_date: {
        type: 'string',
        description: 'Trip start date (e.g., "2026-04-01")',
      },
      end_date: {
        type: 'string',
        description: 'Trip end date (e.g., "2026-04-07")',
      },
      travelers: {
        type: 'number',
        description: 'Number of travelers. Default: 1',
      },
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
      budget_breakdown: {
        type: 'object',
        description: 'Budget breakdown by category',
      },
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
  // Pure formatting — always available
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

  // Validate required parameters
  if (!args.destination || !args.destination.trim()) {
    return {
      toolCallId: toolCall.id,
      content: 'Error: destination parameter is required',
      isError: true,
    };
  }

  if (!args.start_date) {
    return {
      toolCallId: toolCall.id,
      content: 'Error: start_date parameter is required',
      isError: true,
    };
  }

  if (!args.end_date) {
    return {
      toolCallId: toolCall.id,
      content: 'Error: end_date parameter is required',
      isError: true,
    };
  }

  if (!Array.isArray(args.itinerary) || args.itinerary.length === 0) {
    return {
      toolCallId: toolCall.id,
      content: 'Error: itinerary array is required and must not be empty',
      isError: true,
    };
  }

  // Validate each itinerary day
  for (let i = 0; i < args.itinerary.length; i++) {
    const day = args.itinerary[i];
    if (typeof day.day !== 'number' || !day.date || !day.morning || !day.afternoon || !day.evening) {
      return {
        toolCallId: toolCall.id,
        content: `Error: itinerary entry at index ${i} is missing required fields (day, date, morning, afternoon, evening)`,
        isError: true,
      };
    }
  }

  // Validate packing list items if provided
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

  // Validate budget breakdown if provided
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

  const format = args.format ?? 'markdown';
  const travelers = args.travelers ?? 1;
  const budgetLevel = args.budget_level ?? 'moderate';
  const packingList = args.packing_list ?? [];
  const travelTips = args.travel_tips ?? [];
  const duration = computeDuration(args.start_date, args.end_date);

  try {
    const formatted =
      format === 'html'
        ? formatHtml(
            args.destination,
            args.start_date,
            args.end_date,
            travelers,
            budgetLevel,
            args.itinerary,
            packingList,
            args.budget_breakdown,
            travelTips,
          )
        : formatMarkdown(
            args.destination,
            args.start_date,
            args.end_date,
            travelers,
            budgetLevel,
            args.itinerary,
            packingList,
            args.budget_breakdown,
            travelTips,
          );

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Trip plan created: ${args.destination} (${duration} days)`,
        format,
        formatted_output: formatted,
        summary: {
          destination: args.destination,
          start_date: args.start_date,
          end_date: args.end_date,
          duration_days: duration,
          travelers,
          budget_level: budgetLevel,
          itinerary_days: args.itinerary.length,
          packing_items: packingList.length,
          travel_tips_count: travelTips.length,
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
