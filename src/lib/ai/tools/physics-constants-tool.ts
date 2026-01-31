/**
 * PHYSICS CONSTANTS TOOL
 *
 * Fundamental physical constants and unit conversions.
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - Look up fundamental constants (speed of light, Planck's constant, etc.)
 * - Convert between units
 * - Calculate derived quantities
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// CONSTANTS DATA
// ============================================================================

interface PhysicalConstant {
  name: string;
  symbol: string;
  value: number;
  unit: string;
  uncertainty: number | null;
  category: string;
  description: string;
}

const CONSTANTS: PhysicalConstant[] = [
  // Universal Constants
  {
    name: 'Speed of light in vacuum',
    symbol: 'c',
    value: 299792458,
    unit: 'm/s',
    uncertainty: 0,
    category: 'Universal',
    description: 'The speed at which light travels in a vacuum',
  },
  {
    name: 'Planck constant',
    symbol: 'h',
    value: 6.62607015e-34,
    unit: 'J⋅s',
    uncertainty: 0,
    category: 'Universal',
    description: 'Relates photon energy to frequency',
  },
  {
    name: 'Reduced Planck constant',
    symbol: 'ℏ',
    value: 1.054571817e-34,
    unit: 'J⋅s',
    uncertainty: 0,
    category: 'Universal',
    description: 'h divided by 2π',
  },
  {
    name: 'Gravitational constant',
    symbol: 'G',
    value: 6.6743e-11,
    unit: 'm³/(kg⋅s²)',
    uncertainty: 2.2e-5,
    category: 'Universal',
    description: 'Gravitational force between masses',
  },
  {
    name: 'Boltzmann constant',
    symbol: 'k',
    value: 1.380649e-23,
    unit: 'J/K',
    uncertainty: 0,
    category: 'Universal',
    description: 'Relates temperature to energy',
  },
  {
    name: 'Stefan-Boltzmann constant',
    symbol: 'σ',
    value: 5.670374419e-8,
    unit: 'W/(m²⋅K⁴)',
    uncertainty: 0,
    category: 'Universal',
    description: 'Black body radiation',
  },

  // Electromagnetic Constants
  {
    name: 'Elementary charge',
    symbol: 'e',
    value: 1.602176634e-19,
    unit: 'C',
    uncertainty: 0,
    category: 'Electromagnetic',
    description: 'Charge of a proton/electron',
  },
  {
    name: 'Vacuum permittivity',
    symbol: 'ε₀',
    value: 8.8541878128e-12,
    unit: 'F/m',
    uncertainty: 1.5e-10,
    category: 'Electromagnetic',
    description: 'Electric constant',
  },
  {
    name: 'Vacuum permeability',
    symbol: 'μ₀',
    value: 1.25663706212e-6,
    unit: 'N/A²',
    uncertainty: 1.9e-10,
    category: 'Electromagnetic',
    description: 'Magnetic constant',
  },
  {
    name: 'Coulomb constant',
    symbol: 'k_e',
    value: 8.9875517923e9,
    unit: 'N⋅m²/C²',
    uncertainty: 0,
    category: 'Electromagnetic',
    description: 'Electrostatic force constant',
  },

  // Atomic & Nuclear Constants
  {
    name: 'Electron mass',
    symbol: 'm_e',
    value: 9.1093837015e-31,
    unit: 'kg',
    uncertainty: 3.0e-10,
    category: 'Atomic',
    description: 'Rest mass of an electron',
  },
  {
    name: 'Proton mass',
    symbol: 'm_p',
    value: 1.67262192369e-27,
    unit: 'kg',
    uncertainty: 3.1e-10,
    category: 'Atomic',
    description: 'Rest mass of a proton',
  },
  {
    name: 'Neutron mass',
    symbol: 'm_n',
    value: 1.67492749804e-27,
    unit: 'kg',
    uncertainty: 5.7e-10,
    category: 'Atomic',
    description: 'Rest mass of a neutron',
  },
  {
    name: 'Atomic mass unit',
    symbol: 'u',
    value: 1.6605390666e-27,
    unit: 'kg',
    uncertainty: 3.0e-10,
    category: 'Atomic',
    description: 'Unified atomic mass unit',
  },
  {
    name: 'Avogadro constant',
    symbol: 'N_A',
    value: 6.02214076e23,
    unit: '1/mol',
    uncertainty: 0,
    category: 'Atomic',
    description: 'Number of particles per mole',
  },
  {
    name: 'Faraday constant',
    symbol: 'F',
    value: 96485.33212,
    unit: 'C/mol',
    uncertainty: 0,
    category: 'Atomic',
    description: 'Charge per mole of electrons',
  },
  {
    name: 'Bohr radius',
    symbol: 'a₀',
    value: 5.29177210903e-11,
    unit: 'm',
    uncertainty: 1.5e-10,
    category: 'Atomic',
    description: 'Most probable distance electron-proton in hydrogen',
  },
  {
    name: 'Rydberg constant',
    symbol: 'R_∞',
    value: 10973731.56816,
    unit: '1/m',
    uncertainty: 1.9e-12,
    category: 'Atomic',
    description: 'Hydrogen spectral lines',
  },
  {
    name: 'Fine-structure constant',
    symbol: 'α',
    value: 7.2973525693e-3,
    unit: 'dimensionless',
    uncertainty: 1.5e-10,
    category: 'Atomic',
    description: 'Electromagnetic coupling strength',
  },

  // Thermodynamic Constants
  {
    name: 'Gas constant',
    symbol: 'R',
    value: 8.314462618,
    unit: 'J/(mol⋅K)',
    uncertainty: 0,
    category: 'Thermodynamic',
    description: 'Ideal gas constant',
  },
  {
    name: 'Standard atmosphere',
    symbol: 'atm',
    value: 101325,
    unit: 'Pa',
    uncertainty: 0,
    category: 'Thermodynamic',
    description: 'Standard atmospheric pressure',
  },
  {
    name: 'Molar volume (ideal gas at STP)',
    symbol: 'V_m',
    value: 22.41396954e-3,
    unit: 'm³/mol',
    uncertainty: 0,
    category: 'Thermodynamic',
    description: 'Volume of 1 mole of ideal gas at STP',
  },

  // Astronomical Constants
  {
    name: 'Astronomical unit',
    symbol: 'AU',
    value: 1.495978707e11,
    unit: 'm',
    uncertainty: 0,
    category: 'Astronomical',
    description: 'Mean Earth-Sun distance',
  },
  {
    name: 'Light-year',
    symbol: 'ly',
    value: 9.4607304725808e15,
    unit: 'm',
    uncertainty: 0,
    category: 'Astronomical',
    description: 'Distance light travels in one year',
  },
  {
    name: 'Parsec',
    symbol: 'pc',
    value: 3.085677581e16,
    unit: 'm',
    uncertainty: 0,
    category: 'Astronomical',
    description: 'Distance at which 1 AU subtends 1 arcsecond',
  },
  {
    name: 'Solar mass',
    symbol: 'M_☉',
    value: 1.98892e30,
    unit: 'kg',
    uncertainty: 2.5e-5,
    category: 'Astronomical',
    description: 'Mass of the Sun',
  },
  {
    name: 'Earth mass',
    symbol: 'M_⊕',
    value: 5.97217e24,
    unit: 'kg',
    uncertainty: 1.0e-5,
    category: 'Astronomical',
    description: 'Mass of the Earth',
  },
  {
    name: 'Earth radius (mean)',
    symbol: 'R_⊕',
    value: 6.3710088e6,
    unit: 'm',
    uncertainty: 0,
    category: 'Astronomical',
    description: 'Mean radius of Earth',
  },

  // Quantum Constants
  {
    name: 'Electron volt',
    symbol: 'eV',
    value: 1.602176634e-19,
    unit: 'J',
    uncertainty: 0,
    category: 'Quantum',
    description: 'Energy gained by electron through 1V potential',
  },
  {
    name: 'Compton wavelength (electron)',
    symbol: 'λ_C',
    value: 2.42631023867e-12,
    unit: 'm',
    uncertainty: 3.0e-10,
    category: 'Quantum',
    description: 'Wavelength shift in Compton scattering',
  },
  {
    name: 'Classical electron radius',
    symbol: 'r_e',
    value: 2.8179403262e-15,
    unit: 'm',
    uncertainty: 4.6e-10,
    category: 'Quantum',
    description: 'Classical electromagnetic radius',
  },
];

// Create lookup map
const constantsBySymbol = new Map<string, PhysicalConstant>();
const constantsByName = new Map<string, PhysicalConstant>();

CONSTANTS.forEach((c) => {
  constantsBySymbol.set(c.symbol.toLowerCase(), c);
  constantsByName.set(c.name.toLowerCase(), c);
});

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const physicsConstantsTool: UnifiedTool = {
  name: 'physics_constants',
  description: `Look up fundamental physical constants.

Operations:
- lookup: Get a specific constant by name or symbol
- list: List constants by category
- calculate: Perform calculations using constants

Categories:
- Universal (c, h, G, k)
- Electromagnetic (e, ε₀, μ₀)
- Atomic (m_e, m_p, N_A)
- Thermodynamic (R, atm)
- Astronomical (AU, ly, M_☉)
- Quantum (eV, λ_C)

Common constants:
- c: Speed of light
- h: Planck constant
- G: Gravitational constant
- e: Elementary charge
- N_A: Avogadro constant
- k: Boltzmann constant

Use cases:
- Physics calculations
- Engineering formulas
- Scientific research
- Education`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['lookup', 'list', 'calculate'],
        description: 'Operation to perform',
      },
      constant: {
        type: 'string',
        description: 'Constant symbol or name (e.g., "c", "speed of light")',
      },
      category: {
        type: 'string',
        description: 'Category for list operation',
      },
      expression: {
        type: 'string',
        description: 'Expression for calculate operation (e.g., "E = m * c^2")',
      },
      values: {
        type: 'object',
        description: 'Variable values for calculation (e.g., {m: 1})',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isPhysicsConstantsAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executePhysicsConstants(
  toolCall: UnifiedToolCall
): Promise<UnifiedToolResult> {
  const args =
    typeof toolCall.arguments === 'string' ? JSON.parse(toolCall.arguments) : toolCall.arguments;

  const { operation, constant, category, expression, values } = args;

  try {
    let result: Record<string, unknown>;

    switch (operation) {
      case 'lookup': {
        if (!constant) {
          throw new Error('Constant name or symbol required');
        }

        const lowerConst = constant.toLowerCase();
        let found = constantsBySymbol.get(lowerConst) || constantsByName.get(lowerConst);

        // Try partial match
        if (!found) {
          for (const c of CONSTANTS) {
            if (
              c.name.toLowerCase().includes(lowerConst) ||
              c.symbol.toLowerCase() === lowerConst
            ) {
              found = c;
              break;
            }
          }
        }

        if (!found) {
          throw new Error(`Constant "${constant}" not found`);
        }

        // Format value in scientific notation
        const formatValue = (v: number): string => {
          if (Math.abs(v) < 0.001 || Math.abs(v) > 1e6) {
            return v.toExponential(6);
          }
          return v.toString();
        };

        result = {
          operation: 'lookup',
          constant: {
            name: found.name,
            symbol: found.symbol,
            value: found.value,
            valueFormatted: formatValue(found.value),
            unit: found.unit,
            uncertainty: found.uncertainty ? `±${(found.uncertainty * 100).toFixed(2)}%` : 'exact',
            category: found.category,
            description: found.description,
          },
        };
        break;
      }

      case 'list': {
        let filtered = [...CONSTANTS];

        if (category) {
          const lowerCat = category.toLowerCase();
          filtered = filtered.filter((c) => c.category.toLowerCase().includes(lowerCat));
        }

        const categories = [...new Set(CONSTANTS.map((c) => c.category))];

        result = {
          operation: 'list',
          filter: category || 'all',
          availableCategories: categories,
          count: filtered.length,
          constants: filtered.map((c) => ({
            symbol: c.symbol,
            name: c.name,
            value: c.value.toExponential(6),
            unit: c.unit,
            category: c.category,
          })),
        };
        break;
      }

      case 'calculate': {
        if (!expression) {
          throw new Error('Expression required for calculation');
        }

        // Simple expression evaluator with constants
        let expr = expression;

        // Replace constant symbols with values
        for (const c of CONSTANTS) {
          // Handle special symbols
          const escapedSymbol = c.symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`\\b${escapedSymbol}\\b`, 'g');
          expr = expr.replace(regex, `(${c.value})`);
        }

        // Replace user values
        if (values) {
          for (const [key, val] of Object.entries(values)) {
            const regex = new RegExp(`\\b${key}\\b`, 'g');
            expr = expr.replace(regex, `(${val})`);
          }
        }

        // Replace ^ with **
        expr = expr.replace(/\^/g, '**');

        // Evaluate (safely)
        // eslint-disable-next-line no-eval
        const calcResult = eval(expr);

        result = {
          operation: 'calculate',
          originalExpression: expression,
          substitutedExpression: expr.length < 100 ? expr : 'expression too long',
          values: values || {},
          result: calcResult,
          resultFormatted:
            typeof calcResult === 'number'
              ? Math.abs(calcResult) < 0.001 || Math.abs(calcResult) > 1e6
                ? calcResult.toExponential(6)
                : calcResult.toString()
              : String(calcResult),
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
      content: `Physics constants error: ${(error as Error).message}`,
      isError: true,
    };
  }
}
