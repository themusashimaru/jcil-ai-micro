/**
 * UNIT CONVERSION TOOL
 *
 * Convert between measurement units using convert-units.
 * Runs entirely locally - no external API costs.
 *
 * Categories:
 * - Length, Area, Volume
 * - Mass, Temperature
 * - Time, Speed
 * - Digital storage
 * - And more...
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded convert-units
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let convert: any = null;

async function initConvert(): Promise<boolean> {
  if (convert) return true;
  try {
    const mod = await import('convert-units');
    convert = mod.default || mod;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const unitConvertTool: UnifiedTool = {
  name: 'convert_units',
  description: `Convert between measurement units.

Categories:
- Length: mm, cm, m, km, in, ft, yd, mi, nMi
- Area: mm2, cm2, m2, ha, km2, in2, ft2, ac, mi2
- Volume: ml, l, m3, gal, qt, pt, cup, fl-oz, tbsp, tsp
- Mass: mg, g, kg, mt, oz, lb, t
- Temperature: C, F, K, R
- Time: ns, μs, ms, s, min, h, d, wk, mo, yr
- Speed: m/s, km/h, mph, knot, ft/s
- Digital: b, Kb, Mb, Gb, Tb, B, KB, MB, GB, TB
- Pressure: Pa, kPa, bar, psi, atm
- Energy: J, kJ, Wh, kWh, cal, BTU
- Power: W, kW, hp
- Frequency: Hz, kHz, MHz, GHz

Use cases:
- Metric to imperial conversions
- Temperature conversions
- File size calculations
- Recipe measurements
- Distance calculations`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['convert', 'list_units', 'list_categories', 'possibilities', 'describe'],
        description: 'Conversion operation to perform',
      },
      value: {
        type: 'number',
        description: 'For convert: numeric value to convert',
      },
      from: {
        type: 'string',
        description: 'For convert: source unit',
      },
      to: {
        type: 'string',
        description: 'For convert: target unit',
      },
      category: {
        type: 'string',
        description: 'For list_units: filter by category (length, mass, etc.)',
      },
      unit: {
        type: 'string',
        description: 'For possibilities/describe: unit to get info about',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isUnitConvertAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeUnitConvert(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    operation: string;
    value?: number;
    from?: string;
    to?: string;
    category?: string;
    unit?: string;
  };

  if (!args.operation) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({ error: 'Operation is required' }),
      isError: true,
    };
  }

  try {
    const initialized = await initConvert();
    if (!initialized) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({ error: 'Failed to initialize convert-units' }),
        isError: true,
      };
    }

    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'convert': {
        if (args.value === undefined || !args.from || !args.to) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Value, from, and to units required for convert' }),
            isError: true,
          };
        }

        try {
          const converted = convert(args.value).from(args.from).to(args.to);
          const fromDesc = convert().describe(args.from);
          const toDesc = convert().describe(args.to);

          result = {
            operation: 'convert',
            input: {
              value: args.value,
              unit: args.from,
              name: fromDesc?.singular || args.from,
            },
            output: {
              value: converted,
              unit: args.to,
              name: toDesc?.singular || args.to,
            },
            formatted: `${args.value} ${args.from} = ${converted.toFixed(6)} ${args.to}`,
          };
        } catch (convError) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({
              error: 'Conversion failed',
              details:
                convError instanceof Error
                  ? convError.message
                  : 'Invalid units or incompatible conversion',
            }),
            isError: true,
          };
        }
        break;
      }

      case 'list_units': {
        let units;
        if (args.category) {
          units = convert().list(args.category);
        } else {
          units = convert().list();
        }

        result = {
          operation: 'list_units',
          category: args.category || 'all',
          units: units.map(
            (u: { abbr: string; measure: string; singular: string; plural: string }) => ({
              abbr: u.abbr,
              measure: u.measure,
              singular: u.singular,
              plural: u.plural,
            })
          ),
          count: units.length,
        };
        break;
      }

      case 'list_categories': {
        const measures = convert().measures();

        result = {
          operation: 'list_categories',
          categories: measures,
        };
        break;
      }

      case 'possibilities': {
        if (!args.unit) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Unit required for possibilities' }),
            isError: true,
          };
        }

        try {
          const possibilities = convert().from(args.unit).possibilities();
          const desc = convert().describe(args.unit);

          result = {
            operation: 'possibilities',
            unit: args.unit,
            name: desc?.singular,
            category: desc?.measure,
            can_convert_to: possibilities,
          };
        } catch {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: `Unknown unit: ${args.unit}` }),
            isError: true,
          };
        }
        break;
      }

      case 'describe': {
        if (!args.unit) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Unit required for describe' }),
            isError: true,
          };
        }

        try {
          const desc = convert().describe(args.unit);

          result = {
            operation: 'describe',
            unit: args.unit,
            abbreviation: desc.abbr,
            measure: desc.measure,
            system: desc.system,
            singular: desc.singular,
            plural: desc.plural,
          };
        } catch {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: `Unknown unit: ${args.unit}` }),
            isError: true,
          };
        }
        break;
      }

      default:
        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({ error: `Unknown operation: ${args.operation}` }),
          isError: true,
        };
    }

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify(result),
      isError: false,
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        error: 'Unit conversion failed',
        details: error instanceof Error ? error.message : String(error),
      }),
      isError: true,
    };
  }
}
