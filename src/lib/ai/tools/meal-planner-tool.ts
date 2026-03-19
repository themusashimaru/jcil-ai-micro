/**
 * MEAL PLANNER TOOL
 *
 * Structured meal planning with organized grocery lists.
 * Formats meals into printable day-by-day plans with categorized shopping lists.
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

interface MealDay {
  day: string;
  breakfast: string;
  lunch: string;
  dinner: string;
  snacks?: string;
}

type GroceryCategory =
  | 'produce'
  | 'protein'
  | 'dairy'
  | 'grains'
  | 'pantry'
  | 'frozen'
  | 'beverages'
  | 'other';

interface GroceryItem {
  item: string;
  quantity: string;
  category: GroceryCategory;
}

const GROCERY_CATEGORIES: GroceryCategory[] = [
  'produce',
  'protein',
  'dairy',
  'grains',
  'pantry',
  'frozen',
  'beverages',
  'other',
];

const CATEGORY_LABELS: Record<GroceryCategory, string> = {
  produce: 'Produce',
  protein: 'Protein & Meat',
  dairy: 'Dairy',
  grains: 'Grains & Bread',
  pantry: 'Pantry Staples',
  frozen: 'Frozen',
  beverages: 'Beverages',
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

function groupGroceriesByCategory(items: GroceryItem[]): Map<GroceryCategory, GroceryItem[]> {
  const grouped = new Map<GroceryCategory, GroceryItem[]>();
  for (const item of items) {
    const cat = GROCERY_CATEGORIES.includes(item.category) ? item.category : 'other';
    const list = grouped.get(cat) ?? [];
    list.push(item);
    grouped.set(cat, list);
  }
  // Sort items alphabetically within each category
  for (const [cat, list] of grouped) {
    list.sort((a, b) => a.item.localeCompare(b.item));
    grouped.set(cat, list);
  }
  return grouped;
}

function formatMarkdown(
  meals: MealDay[],
  groceries: GroceryItem[],
  servings: number,
  dietaryNotes: string | undefined,
  estimatedCost: string | undefined,
): string {
  const lines: string[] = [];

  // Header
  lines.push(`# Meal Plan (${meals.length} Days, ${servings} Servings per Meal)`);
  lines.push('');

  if (dietaryNotes) {
    lines.push(`> **Dietary Notes:** ${dietaryNotes}`);
    lines.push('');
  }

  if (estimatedCost) {
    lines.push(`**Estimated Weekly Cost:** ${estimatedCost}`);
    lines.push('');
  }

  // Meal table
  lines.push('## Daily Meals');
  lines.push('');
  lines.push('| Day | Breakfast | Lunch | Dinner | Snacks |');
  lines.push('|-----|-----------|-------|--------|--------|');
  for (const day of meals) {
    const snacks = day.snacks ?? '-';
    lines.push(`| ${day.day} | ${day.breakfast} | ${day.lunch} | ${day.dinner} | ${snacks} |`);
  }
  lines.push('');

  // Grocery list
  if (groceries.length > 0) {
    lines.push('## Grocery List');
    lines.push('');
    const grouped = groupGroceriesByCategory(groceries);
    for (const cat of GROCERY_CATEGORIES) {
      const items = grouped.get(cat);
      if (!items || items.length === 0) continue;
      lines.push(`### ${CATEGORY_LABELS[cat]}`);
      lines.push('');
      for (const item of items) {
        lines.push(`- [ ] ${item.item} - ${item.quantity}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

function formatHtml(
  meals: MealDay[],
  groceries: GroceryItem[],
  servings: number,
  dietaryNotes: string | undefined,
  estimatedCost: string | undefined,
): string {
  const parts: string[] = [];

  parts.push('<!DOCTYPE html>');
  parts.push('<html lang="en"><head><meta charset="UTF-8">');
  parts.push('<title>Meal Plan</title>');
  parts.push('<style>');
  parts.push('body{font-family:system-ui,sans-serif;max-width:900px;margin:0 auto;padding:20px;color:#1a1a1a}');
  parts.push('h1{color:#2d5016;border-bottom:2px solid #2d5016;padding-bottom:8px}');
  parts.push('h2{color:#3a6b1e;margin-top:28px}');
  parts.push('h3{color:#4a7c2e;margin-top:18px}');
  parts.push('.note{background:#f0f7e6;padding:12px 16px;border-radius:6px;margin-bottom:16px;border-left:4px solid #2d5016}');
  parts.push('table{width:100%;border-collapse:collapse;margin:12px 0}');
  parts.push('th,td{border:1px solid #ddd;padding:10px 12px;text-align:left}');
  parts.push('th{background:#2d5016;color:#fff}');
  parts.push('tr:nth-child(even){background:#f8f8f8}');
  parts.push('.grocery-section{margin-top:12px}');
  parts.push('.grocery-item{display:flex;align-items:center;padding:4px 0;gap:8px}');
  parts.push('.grocery-item input[type=checkbox]{width:18px;height:18px}');
  parts.push('.cost{font-weight:600;font-size:1.1em;color:#2d5016}');
  parts.push('@media print{body{padding:0}h1{font-size:1.4em}}');
  parts.push('</style></head><body>');

  parts.push(`<h1>Meal Plan &mdash; ${meals.length} Days, ${servings} Servings per Meal</h1>`);

  if (dietaryNotes) {
    parts.push(`<div class="note"><strong>Dietary Notes:</strong> ${escapeHtml(dietaryNotes)}</div>`);
  }

  if (estimatedCost) {
    parts.push(`<p class="cost">Estimated Weekly Cost: ${escapeHtml(estimatedCost)}</p>`);
  }

  // Meal grid
  parts.push('<h2>Daily Meals</h2>');
  parts.push('<table><thead><tr><th>Day</th><th>Breakfast</th><th>Lunch</th><th>Dinner</th><th>Snacks</th></tr></thead><tbody>');
  for (const day of meals) {
    const snacks = day.snacks ? escapeHtml(day.snacks) : '&mdash;';
    parts.push(`<tr><td><strong>${escapeHtml(day.day)}</strong></td><td>${escapeHtml(day.breakfast)}</td><td>${escapeHtml(day.lunch)}</td><td>${escapeHtml(day.dinner)}</td><td>${snacks}</td></tr>`);
  }
  parts.push('</tbody></table>');

  // Grocery checklist
  if (groceries.length > 0) {
    parts.push('<h2>Grocery List</h2>');
    const grouped = groupGroceriesByCategory(groceries);
    for (const cat of GROCERY_CATEGORIES) {
      const items = grouped.get(cat);
      if (!items || items.length === 0) continue;
      parts.push(`<div class="grocery-section"><h3>${CATEGORY_LABELS[cat]}</h3>`);
      for (const item of items) {
        parts.push(`<div class="grocery-item"><input type="checkbox"><span>${escapeHtml(item.item)} &mdash; ${escapeHtml(item.quantity)}</span></div>`);
      }
      parts.push('</div>');
    }
  }

  parts.push('</body></html>');
  return parts.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const mealPlannerTool: UnifiedTool = {
  name: 'meal_planner',
  description: `Create structured meal plans with organized grocery lists. Formats meals into printable day-by-day plans with categorized shopping lists.

Use this when:
- User wants a weekly or daily meal plan
- User asks for grocery lists or shopping lists
- User needs meal prep guidance
- User has dietary restrictions and wants meal suggestions

Returns a formatted meal plan with categorized grocery list, ready to print or reference while shopping.`,
  parameters: {
    type: 'object',
    properties: {
      days: {
        type: 'number',
        description: 'Number of days to plan (1-14)',
      },
      meals: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            day: { type: 'string', description: 'Day label (e.g., "Monday")' },
            breakfast: { type: 'string', description: 'Breakfast meal' },
            lunch: { type: 'string', description: 'Lunch meal' },
            dinner: { type: 'string', description: 'Dinner meal' },
            snacks: { type: 'string', description: 'Snack(s) for the day' },
          },
          required: ['day', 'breakfast', 'lunch', 'dinner'],
        },
        description: 'Array of daily meal entries',
      },
      grocery_list: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            item: { type: 'string', description: 'Grocery item name' },
            quantity: { type: 'string', description: 'Quantity needed (e.g., "2 lbs", "1 dozen")' },
            category: {
              type: 'string',
              enum: ['produce', 'protein', 'dairy', 'grains', 'pantry', 'frozen', 'beverages', 'other'],
              description: 'Grocery category',
            },
          },
          required: ['item', 'quantity', 'category'],
        },
        description: 'Categorized grocery list',
      },
      servings: {
        type: 'number',
        description: 'Number of servings per meal. Default: 4',
      },
      dietary_notes: {
        type: 'string',
        description: 'Any dietary restrictions or preferences summary',
      },
      estimated_weekly_cost: {
        type: 'string',
        description: 'Estimated weekly grocery cost',
      },
      format: {
        type: 'string',
        enum: ['markdown', 'html'],
        description: 'Output format. Default: "markdown"',
      },
    },
    required: ['days', 'meals'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isMealPlannerAvailable(): boolean {
  // Pure formatting — always available
  return true;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeMealPlanner(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    days: number;
    meals: MealDay[];
    grocery_list?: GroceryItem[];
    servings?: number;
    dietary_notes?: string;
    estimated_weekly_cost?: string;
    format?: 'markdown' | 'html';
  };

  // Validate required parameters
  if (typeof args.days !== 'number' || args.days < 1 || args.days > 14) {
    return {
      toolCallId: toolCall.id,
      content: 'Error: days must be a number between 1 and 14',
      isError: true,
    };
  }

  if (!Array.isArray(args.meals) || args.meals.length === 0) {
    return {
      toolCallId: toolCall.id,
      content: 'Error: meals array is required and must not be empty',
      isError: true,
    };
  }

  // Validate each meal entry
  for (let i = 0; i < args.meals.length; i++) {
    const meal = args.meals[i];
    if (!meal.day || !meal.breakfast || !meal.lunch || !meal.dinner) {
      return {
        toolCallId: toolCall.id,
        content: `Error: meal entry at index ${i} is missing required fields (day, breakfast, lunch, dinner)`,
        isError: true,
      };
    }
  }

  // Validate grocery items if provided
  if (args.grocery_list) {
    for (let i = 0; i < args.grocery_list.length; i++) {
      const item = args.grocery_list[i];
      if (!item.item || !item.quantity || !item.category) {
        return {
          toolCallId: toolCall.id,
          content: `Error: grocery item at index ${i} is missing required fields (item, quantity, category)`,
          isError: true,
        };
      }
    }
  }

  const format = args.format ?? 'markdown';
  const servings = args.servings ?? 4;
  const groceries = args.grocery_list ?? [];

  try {
    const formatted =
      format === 'html'
        ? formatHtml(args.meals, groceries, servings, args.dietary_notes, args.estimated_weekly_cost)
        : formatMarkdown(args.meals, groceries, servings, args.dietary_notes, args.estimated_weekly_cost);

    const totalMeals = args.meals.length * 3; // breakfast + lunch + dinner
    const totalSnacks = args.meals.filter((m) => m.snacks).length;

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Meal plan created: ${args.meals.length} days, ${servings} servings per meal`,
        format,
        formatted_output: formatted,
        summary: {
          days_planned: args.meals.length,
          total_meals: totalMeals,
          total_snacks: totalSnacks,
          grocery_item_count: groceries.length,
          servings_per_meal: servings,
          dietary_notes: args.dietary_notes ?? null,
          estimated_weekly_cost: args.estimated_weekly_cost ?? null,
        },
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error generating meal plan: ${(error as Error).message}`,
      isError: true,
    };
  }
}
