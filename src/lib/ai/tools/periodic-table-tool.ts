/**
 * PERIODIC TABLE TOOL
 *
 * Element data and periodic table lookups.
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - Look up element properties by symbol or name
 * - Get atomic mass, number, electron configuration
 * - Find elements by property criteria
 * - Calculate molecular masses
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// ELEMENT DATA
// ============================================================================

interface Element {
  symbol: string;
  name: string;
  atomicNumber: number;
  atomicMass: number;
  category: string;
  electronConfiguration: string;
  electronegativity: number | null;
  density: number | null;
  meltingPoint: number | null;
  boilingPoint: number | null;
  discoveryYear: number | null;
  group: number | null;
  period: number;
}

const ELEMENTS: Element[] = [
  {
    symbol: 'H',
    name: 'Hydrogen',
    atomicNumber: 1,
    atomicMass: 1.008,
    category: 'Nonmetal',
    electronConfiguration: '1s¹',
    electronegativity: 2.2,
    density: 0.00008988,
    meltingPoint: -259.16,
    boilingPoint: -252.87,
    discoveryYear: 1766,
    group: 1,
    period: 1,
  },
  {
    symbol: 'He',
    name: 'Helium',
    atomicNumber: 2,
    atomicMass: 4.003,
    category: 'Noble gas',
    electronConfiguration: '1s²',
    electronegativity: null,
    density: 0.0001785,
    meltingPoint: -272.2,
    boilingPoint: -268.93,
    discoveryYear: 1868,
    group: 18,
    period: 1,
  },
  {
    symbol: 'Li',
    name: 'Lithium',
    atomicNumber: 3,
    atomicMass: 6.941,
    category: 'Alkali metal',
    electronConfiguration: '[He] 2s¹',
    electronegativity: 0.98,
    density: 0.534,
    meltingPoint: 180.54,
    boilingPoint: 1342,
    discoveryYear: 1817,
    group: 1,
    period: 2,
  },
  {
    symbol: 'Be',
    name: 'Beryllium',
    atomicNumber: 4,
    atomicMass: 9.012,
    category: 'Alkaline earth metal',
    electronConfiguration: '[He] 2s²',
    electronegativity: 1.57,
    density: 1.85,
    meltingPoint: 1287,
    boilingPoint: 2469,
    discoveryYear: 1798,
    group: 2,
    period: 2,
  },
  {
    symbol: 'B',
    name: 'Boron',
    atomicNumber: 5,
    atomicMass: 10.81,
    category: 'Metalloid',
    electronConfiguration: '[He] 2s² 2p¹',
    electronegativity: 2.04,
    density: 2.34,
    meltingPoint: 2076,
    boilingPoint: 3927,
    discoveryYear: 1808,
    group: 13,
    period: 2,
  },
  {
    symbol: 'C',
    name: 'Carbon',
    atomicNumber: 6,
    atomicMass: 12.011,
    category: 'Nonmetal',
    electronConfiguration: '[He] 2s² 2p²',
    electronegativity: 2.55,
    density: 2.267,
    meltingPoint: 3550,
    boilingPoint: 4027,
    discoveryYear: null,
    group: 14,
    period: 2,
  },
  {
    symbol: 'N',
    name: 'Nitrogen',
    atomicNumber: 7,
    atomicMass: 14.007,
    category: 'Nonmetal',
    electronConfiguration: '[He] 2s² 2p³',
    electronegativity: 3.04,
    density: 0.0012506,
    meltingPoint: -210.0,
    boilingPoint: -195.79,
    discoveryYear: 1772,
    group: 15,
    period: 2,
  },
  {
    symbol: 'O',
    name: 'Oxygen',
    atomicNumber: 8,
    atomicMass: 15.999,
    category: 'Nonmetal',
    electronConfiguration: '[He] 2s² 2p⁴',
    electronegativity: 3.44,
    density: 0.001429,
    meltingPoint: -218.79,
    boilingPoint: -182.95,
    discoveryYear: 1774,
    group: 16,
    period: 2,
  },
  {
    symbol: 'F',
    name: 'Fluorine',
    atomicNumber: 9,
    atomicMass: 18.998,
    category: 'Halogen',
    electronConfiguration: '[He] 2s² 2p⁵',
    electronegativity: 3.98,
    density: 0.001696,
    meltingPoint: -219.67,
    boilingPoint: -188.11,
    discoveryYear: 1886,
    group: 17,
    period: 2,
  },
  {
    symbol: 'Ne',
    name: 'Neon',
    atomicNumber: 10,
    atomicMass: 20.18,
    category: 'Noble gas',
    electronConfiguration: '[He] 2s² 2p⁶',
    electronegativity: null,
    density: 0.0008999,
    meltingPoint: -248.59,
    boilingPoint: -246.08,
    discoveryYear: 1898,
    group: 18,
    period: 2,
  },
  {
    symbol: 'Na',
    name: 'Sodium',
    atomicNumber: 11,
    atomicMass: 22.99,
    category: 'Alkali metal',
    electronConfiguration: '[Ne] 3s¹',
    electronegativity: 0.93,
    density: 0.971,
    meltingPoint: 97.79,
    boilingPoint: 883,
    discoveryYear: 1807,
    group: 1,
    period: 3,
  },
  {
    symbol: 'Mg',
    name: 'Magnesium',
    atomicNumber: 12,
    atomicMass: 24.305,
    category: 'Alkaline earth metal',
    electronConfiguration: '[Ne] 3s²',
    electronegativity: 1.31,
    density: 1.738,
    meltingPoint: 650,
    boilingPoint: 1090,
    discoveryYear: 1755,
    group: 2,
    period: 3,
  },
  {
    symbol: 'Al',
    name: 'Aluminum',
    atomicNumber: 13,
    atomicMass: 26.982,
    category: 'Post-transition metal',
    electronConfiguration: '[Ne] 3s² 3p¹',
    electronegativity: 1.61,
    density: 2.698,
    meltingPoint: 660.32,
    boilingPoint: 2519,
    discoveryYear: 1825,
    group: 13,
    period: 3,
  },
  {
    symbol: 'Si',
    name: 'Silicon',
    atomicNumber: 14,
    atomicMass: 28.086,
    category: 'Metalloid',
    electronConfiguration: '[Ne] 3s² 3p²',
    electronegativity: 1.9,
    density: 2.3296,
    meltingPoint: 1414,
    boilingPoint: 3265,
    discoveryYear: 1824,
    group: 14,
    period: 3,
  },
  {
    symbol: 'P',
    name: 'Phosphorus',
    atomicNumber: 15,
    atomicMass: 30.974,
    category: 'Nonmetal',
    electronConfiguration: '[Ne] 3s² 3p³',
    electronegativity: 2.19,
    density: 1.82,
    meltingPoint: 44.15,
    boilingPoint: 280.5,
    discoveryYear: 1669,
    group: 15,
    period: 3,
  },
  {
    symbol: 'S',
    name: 'Sulfur',
    atomicNumber: 16,
    atomicMass: 32.065,
    category: 'Nonmetal',
    electronConfiguration: '[Ne] 3s² 3p⁴',
    electronegativity: 2.58,
    density: 2.067,
    meltingPoint: 115.21,
    boilingPoint: 444.6,
    discoveryYear: null,
    group: 16,
    period: 3,
  },
  {
    symbol: 'Cl',
    name: 'Chlorine',
    atomicNumber: 17,
    atomicMass: 35.453,
    category: 'Halogen',
    electronConfiguration: '[Ne] 3s² 3p⁵',
    electronegativity: 3.16,
    density: 0.003214,
    meltingPoint: -101.5,
    boilingPoint: -34.04,
    discoveryYear: 1774,
    group: 17,
    period: 3,
  },
  {
    symbol: 'Ar',
    name: 'Argon',
    atomicNumber: 18,
    atomicMass: 39.948,
    category: 'Noble gas',
    electronConfiguration: '[Ne] 3s² 3p⁶',
    electronegativity: null,
    density: 0.0017837,
    meltingPoint: -189.35,
    boilingPoint: -185.85,
    discoveryYear: 1894,
    group: 18,
    period: 3,
  },
  {
    symbol: 'K',
    name: 'Potassium',
    atomicNumber: 19,
    atomicMass: 39.098,
    category: 'Alkali metal',
    electronConfiguration: '[Ar] 4s¹',
    electronegativity: 0.82,
    density: 0.862,
    meltingPoint: 63.38,
    boilingPoint: 759,
    discoveryYear: 1807,
    group: 1,
    period: 4,
  },
  {
    symbol: 'Ca',
    name: 'Calcium',
    atomicNumber: 20,
    atomicMass: 40.078,
    category: 'Alkaline earth metal',
    electronConfiguration: '[Ar] 4s²',
    electronegativity: 1.0,
    density: 1.54,
    meltingPoint: 842,
    boilingPoint: 1484,
    discoveryYear: 1808,
    group: 2,
    period: 4,
  },
  {
    symbol: 'Fe',
    name: 'Iron',
    atomicNumber: 26,
    atomicMass: 55.845,
    category: 'Transition metal',
    electronConfiguration: '[Ar] 3d⁶ 4s²',
    electronegativity: 1.83,
    density: 7.874,
    meltingPoint: 1538,
    boilingPoint: 2861,
    discoveryYear: null,
    group: 8,
    period: 4,
  },
  {
    symbol: 'Cu',
    name: 'Copper',
    atomicNumber: 29,
    atomicMass: 63.546,
    category: 'Transition metal',
    electronConfiguration: '[Ar] 3d¹⁰ 4s¹',
    electronegativity: 1.9,
    density: 8.96,
    meltingPoint: 1084.62,
    boilingPoint: 2562,
    discoveryYear: null,
    group: 11,
    period: 4,
  },
  {
    symbol: 'Zn',
    name: 'Zinc',
    atomicNumber: 30,
    atomicMass: 65.38,
    category: 'Transition metal',
    electronConfiguration: '[Ar] 3d¹⁰ 4s²',
    electronegativity: 1.65,
    density: 7.134,
    meltingPoint: 419.53,
    boilingPoint: 907,
    discoveryYear: null,
    group: 12,
    period: 4,
  },
  {
    symbol: 'Br',
    name: 'Bromine',
    atomicNumber: 35,
    atomicMass: 79.904,
    category: 'Halogen',
    electronConfiguration: '[Ar] 3d¹⁰ 4s² 4p⁵',
    electronegativity: 2.96,
    density: 3.122,
    meltingPoint: -7.2,
    boilingPoint: 58.8,
    discoveryYear: 1826,
    group: 17,
    period: 4,
  },
  {
    symbol: 'Kr',
    name: 'Krypton',
    atomicNumber: 36,
    atomicMass: 83.798,
    category: 'Noble gas',
    electronConfiguration: '[Ar] 3d¹⁰ 4s² 4p⁶',
    electronegativity: 3.0,
    density: 0.003733,
    meltingPoint: -157.36,
    boilingPoint: -153.22,
    discoveryYear: 1898,
    group: 18,
    period: 4,
  },
  {
    symbol: 'Ag',
    name: 'Silver',
    atomicNumber: 47,
    atomicMass: 107.868,
    category: 'Transition metal',
    electronConfiguration: '[Kr] 4d¹⁰ 5s¹',
    electronegativity: 1.93,
    density: 10.501,
    meltingPoint: 961.78,
    boilingPoint: 2162,
    discoveryYear: null,
    group: 11,
    period: 5,
  },
  {
    symbol: 'I',
    name: 'Iodine',
    atomicNumber: 53,
    atomicMass: 126.904,
    category: 'Halogen',
    electronConfiguration: '[Kr] 4d¹⁰ 5s² 5p⁵',
    electronegativity: 2.66,
    density: 4.93,
    meltingPoint: 113.7,
    boilingPoint: 184.3,
    discoveryYear: 1811,
    group: 17,
    period: 5,
  },
  {
    symbol: 'Xe',
    name: 'Xenon',
    atomicNumber: 54,
    atomicMass: 131.293,
    category: 'Noble gas',
    electronConfiguration: '[Kr] 4d¹⁰ 5s² 5p⁶',
    electronegativity: 2.6,
    density: 0.005887,
    meltingPoint: -111.75,
    boilingPoint: -108.12,
    discoveryYear: 1898,
    group: 18,
    period: 5,
  },
  {
    symbol: 'Au',
    name: 'Gold',
    atomicNumber: 79,
    atomicMass: 196.967,
    category: 'Transition metal',
    electronConfiguration: '[Xe] 4f¹⁴ 5d¹⁰ 6s¹',
    electronegativity: 2.54,
    density: 19.282,
    meltingPoint: 1064.18,
    boilingPoint: 2856,
    discoveryYear: null,
    group: 11,
    period: 6,
  },
  {
    symbol: 'Pb',
    name: 'Lead',
    atomicNumber: 82,
    atomicMass: 207.2,
    category: 'Post-transition metal',
    electronConfiguration: '[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p²',
    electronegativity: 1.87,
    density: 11.342,
    meltingPoint: 327.46,
    boilingPoint: 1749,
    discoveryYear: null,
    group: 14,
    period: 6,
  },
  {
    symbol: 'U',
    name: 'Uranium',
    atomicNumber: 92,
    atomicMass: 238.029,
    category: 'Actinide',
    electronConfiguration: '[Rn] 5f³ 6d¹ 7s²',
    electronegativity: 1.38,
    density: 18.95,
    meltingPoint: 1135,
    boilingPoint: 4131,
    discoveryYear: 1789,
    group: null,
    period: 7,
  },
];

// Create lookup maps
const elementsBySymbol = new Map<string, Element>();
const elementsByName = new Map<string, Element>();
const elementsByNumber = new Map<number, Element>();

ELEMENTS.forEach((el) => {
  elementsBySymbol.set(el.symbol.toUpperCase(), el);
  elementsByName.set(el.name.toUpperCase(), el);
  elementsByNumber.set(el.atomicNumber, el);
});

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const periodicTableTool: UnifiedTool = {
  name: 'periodic_table',
  description: `Look up chemical element properties and calculate molecular masses.

Operations:
- lookup: Get element properties by symbol, name, or atomic number
- molecular_mass: Calculate molecular mass from formula (e.g., H2O, NaCl, C6H12O6)
- compare: Compare properties of multiple elements
- search: Find elements by category or property range

Properties available:
- Atomic number, mass, symbol, name
- Electron configuration
- Electronegativity, density
- Melting and boiling points
- Element category (metal, nonmetal, etc.)

Use cases:
- Chemistry education
- Molecular weight calculations
- Element property comparisons
- Scientific research`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['lookup', 'molecular_mass', 'compare', 'search'],
        description: 'Operation to perform',
      },
      element: {
        type: 'string',
        description: 'Element symbol (e.g., "Fe"), name (e.g., "Iron"), or atomic number',
      },
      formula: {
        type: 'string',
        description: 'Molecular formula for mass calculation (e.g., "H2O", "NaCl", "C6H12O6")',
      },
      elements: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of elements for comparison',
      },
      category: {
        type: 'string',
        description: 'Element category to search (e.g., "Noble gas", "Transition metal")',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isPeriodicTableAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executePeriodicTable(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args =
    typeof toolCall.arguments === 'string' ? JSON.parse(toolCall.arguments) : toolCall.arguments;

  const { operation, element, formula, elements, category } = args;

  try {
    let result: Record<string, unknown>;

    switch (operation) {
      case 'lookup': {
        if (!element) {
          throw new Error('Element symbol, name, or atomic number required');
        }

        let el: Element | undefined;

        // Try atomic number first
        const atomicNum = parseInt(element);
        if (!isNaN(atomicNum)) {
          el = elementsByNumber.get(atomicNum);
        }

        // Try symbol
        if (!el) {
          el = elementsBySymbol.get(element.toUpperCase());
        }

        // Try name
        if (!el) {
          el = elementsByName.get(element.toUpperCase());
        }

        if (!el) {
          throw new Error(`Element "${element}" not found`);
        }

        result = {
          operation: 'lookup',
          element: {
            ...el,
            meltingPointUnit: '°C',
            boilingPointUnit: '°C',
            densityUnit: 'g/cm³',
          },
        };
        break;
      }

      case 'molecular_mass': {
        if (!formula) {
          throw new Error('Molecular formula required');
        }

        // Parse formula like H2O, NaCl, C6H12O6
        const regex = /([A-Z][a-z]?)(\d*)/g;
        let match;
        const composition: Array<{ element: string; count: number; mass: number }> = [];
        let totalMass = 0;

        while ((match = regex.exec(formula)) !== null) {
          const symbol = match[1];
          const count = parseInt(match[2]) || 1;
          const el = elementsBySymbol.get(symbol.toUpperCase());

          if (!el) {
            throw new Error(`Unknown element: ${symbol}`);
          }

          const mass = el.atomicMass * count;
          totalMass += mass;
          composition.push({
            element: el.name,
            count,
            mass: parseFloat(mass.toFixed(4)),
          });
        }

        result = {
          operation: 'molecular_mass',
          formula,
          molecularMass: parseFloat(totalMass.toFixed(4)),
          unit: 'g/mol',
          composition,
          formatted: `${totalMass.toFixed(4)} g/mol`,
        };
        break;
      }

      case 'compare': {
        if (!elements || elements.length < 2) {
          throw new Error('At least 2 elements required for comparison');
        }

        const comparedElements: Element[] = [];
        for (const e of elements) {
          let el = elementsBySymbol.get(e.toUpperCase()) || elementsByName.get(e.toUpperCase());
          if (!el) {
            const num = parseInt(e);
            if (!isNaN(num)) {
              el = elementsByNumber.get(num);
            }
          }
          if (el) {
            comparedElements.push(el);
          }
        }

        if (comparedElements.length < 2) {
          throw new Error('Could not find enough valid elements');
        }

        result = {
          operation: 'compare',
          elements: comparedElements.map((el) => ({
            symbol: el.symbol,
            name: el.name,
            atomicNumber: el.atomicNumber,
            atomicMass: el.atomicMass,
            category: el.category,
            electronegativity: el.electronegativity,
            meltingPoint: el.meltingPoint,
            boilingPoint: el.boilingPoint,
          })),
          heaviest: comparedElements.reduce((a, b) => (a.atomicMass > b.atomicMass ? a : b)).name,
          mostElectronegative:
            comparedElements
              .filter((e) => e.electronegativity !== null)
              .reduce((a, b) => ((a.electronegativity || 0) > (b.electronegativity || 0) ? a : b))
              ?.name || 'N/A',
        };
        break;
      }

      case 'search': {
        let matches = [...ELEMENTS];

        if (category) {
          const lowerCat = category.toLowerCase();
          matches = matches.filter((el) => el.category.toLowerCase().includes(lowerCat));
        }

        result = {
          operation: 'search',
          criteria: { category },
          matchCount: matches.length,
          elements: matches.slice(0, 20).map((el) => ({
            symbol: el.symbol,
            name: el.name,
            atomicNumber: el.atomicNumber,
            category: el.category,
          })),
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify(result, null, 2),
      isError: false,
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Periodic table error: ${(error as Error).message}`,
      isError: true,
    };
  }
}
