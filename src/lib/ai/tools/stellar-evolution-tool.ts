/**
 * STELLAR-EVOLUTION TOOL
 * Stellar evolution, HR diagrams, and astrophysics calculations
 * Real physics of star formation, main sequence, and stellar endpoints
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const stellarevolutionTool: UnifiedTool = {
  name: 'stellar_evolution',
  description: `Stellar evolution and astrophysics calculations.

Operations:
- info: Stellar evolution overview and physics
- classify: Classify star by spectral type/luminosity class
- hr_diagram: Place star on Hertzsprung-Russell diagram
- lifetime: Calculate main sequence lifetime
- evolve: Trace evolutionary path for given mass
- luminosity: Calculate stellar luminosity
- radius: Calculate stellar radius
- temperature: Estimate effective temperature
- endpoint: Determine stellar endpoint (WD, NS, BH)
- nucleosynthesis: Show fusion stages

Parameters:
- operation: The operation to perform
- mass: Stellar mass in solar masses (M☉)
- luminosity: Luminosity in solar luminosities (L☉)
- temperature: Effective temperature in Kelvin
- spectral_type: Spectral type (O, B, A, F, G, K, M)
- luminosity_class: Luminosity class (I, II, III, IV, V)`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'classify', 'hr_diagram', 'lifetime', 'evolve', 'luminosity', 'radius', 'temperature', 'endpoint', 'nucleosynthesis'],
        description: 'Operation to perform'
      },
      mass: { type: 'number', description: 'Stellar mass in solar masses' },
      luminosity: { type: 'number', description: 'Luminosity in solar luminosities' },
      temperature: { type: 'number', description: 'Effective temperature in Kelvin' },
      spectral_type: {
        type: 'string',
        enum: ['O', 'B', 'A', 'F', 'G', 'K', 'M'],
        description: 'Spectral type'
      },
      luminosity_class: {
        type: 'string',
        enum: ['Ia', 'Ib', 'II', 'III', 'IV', 'V', 'VI', 'VII'],
        description: 'Luminosity class'
      }
    },
    required: ['operation']
  }
};

// ============================================================================
// ASTROPHYSICAL CONSTANTS
// ============================================================================

const CONSTANTS = {
  // Solar values
  M_SUN: 1.989e30,        // kg
  L_SUN: 3.828e26,        // W
  R_SUN: 6.957e8,         // m
  T_SUN: 5778,            // K

  // Physical constants
  G: 6.674e-11,           // N⋅m²/kg²
  c: 2.998e8,             // m/s
  STEFAN_BOLTZMANN: 5.670e-8,  // W⋅m⁻²⋅K⁻⁴
  k_B: 1.381e-23,         // J/K
  m_p: 1.673e-27,         // kg (proton mass)

  // Time
  YEAR_SECONDS: 3.154e7,

  // Hydrogen burning energy release
  EPSILON_H: 6.3e14       // J/kg (hydrogen to helium)
};

// Spectral type data
const SPECTRAL_TYPES: Record<string, { tempRange: [number, number]; color: string; fraction: number }> = {
  'O': { tempRange: [30000, 60000], color: 'Blue', fraction: 0.00003 },
  'B': { tempRange: [10000, 30000], color: 'Blue-white', fraction: 0.0013 },
  'A': { tempRange: [7500, 10000], color: 'White', fraction: 0.006 },
  'F': { tempRange: [6000, 7500], color: 'Yellow-white', fraction: 0.03 },
  'G': { tempRange: [5200, 6000], color: 'Yellow', fraction: 0.076 },
  'K': { tempRange: [3700, 5200], color: 'Orange', fraction: 0.121 },
  'M': { tempRange: [2400, 3700], color: 'Red', fraction: 0.765 }
};

// Luminosity classes
const LUMINOSITY_CLASSES: Record<string, { name: string; typicalRadius: string }> = {
  'Ia': { name: 'Bright Supergiant', typicalRadius: '100-1000 R☉' },
  'Ib': { name: 'Supergiant', typicalRadius: '30-500 R☉' },
  'II': { name: 'Bright Giant', typicalRadius: '10-100 R☉' },
  'III': { name: 'Giant', typicalRadius: '5-50 R☉' },
  'IV': { name: 'Subgiant', typicalRadius: '2-5 R☉' },
  'V': { name: 'Main Sequence (Dwarf)', typicalRadius: '0.1-10 R☉' },
  'VI': { name: 'Subdwarf', typicalRadius: '< R☉' },
  'VII': { name: 'White Dwarf', typicalRadius: '~0.01 R☉' }
};

// ============================================================================
// STELLAR PHYSICS CALCULATIONS
// ============================================================================

/**
 * Mass-Luminosity relation for main sequence stars
 * L ∝ M^α where α depends on mass
 */
function massToLuminosity(mass: number): number {
  // Different power laws for different mass ranges
  if (mass < 0.43) {
    // Low mass stars: L ∝ M^2.3
    return 0.23 * Math.pow(mass, 2.3);
  } else if (mass < 2) {
    // Solar-type: L ∝ M^4
    return Math.pow(mass, 4);
  } else if (mass < 55) {
    // Intermediate: L ∝ M^3.5
    return 1.4 * Math.pow(mass, 3.5);
  } else {
    // Very massive: L ∝ M
    return 32000 * mass;
  }
}

/**
 * Main sequence lifetime in years
 * τ ≈ M/L × τ_☉ (fuel/burn rate)
 */
function mainSequenceLifetime(mass: number): number {
  const L = massToLuminosity(mass);
  // τ = fuel available / burn rate
  // Only ~10% of H in core is burned, so τ ∝ 0.1M/L
  const tau_sun = 10e9; // 10 billion years
  return tau_sun * (mass / L);
}

/**
 * Stefan-Boltzmann law: L = 4πR²σT⁴
 * Solve for radius: R = √(L / (4πσT⁴))
 */
function calculateRadius(luminosity: number, temperature: number): number {
  // In solar units
  const T_ratio = temperature / CONSTANTS.T_SUN;
  return Math.sqrt(luminosity) / Math.pow(T_ratio, 2);
}

/**
 * Calculate temperature from luminosity and radius
 * T = (L / (4πR²σ))^(1/4)
 */
function calculateTemperature(luminosity: number, radius: number): number {
  // In solar units
  return CONSTANTS.T_SUN * Math.pow(luminosity / (radius * radius), 0.25);
}

/**
 * Calculate luminosity from radius and temperature
 * L = 4πR²σT⁴
 */
function calculateLuminosity(radius: number, temperature: number): number {
  // In solar units
  const T_ratio = temperature / CONSTANTS.T_SUN;
  return radius * radius * Math.pow(T_ratio, 4);
}

/**
 * Spectral type from temperature
 */
function temperatureToSpectralType(temp: number): { type: string; subtype: number } {
  for (const [type, data] of Object.entries(SPECTRAL_TYPES)) {
    if (temp >= data.tempRange[0] && temp <= data.tempRange[1]) {
      // Subtype 0-9, interpolated within range
      const range = data.tempRange[1] - data.tempRange[0];
      const subtype = Math.round(9 * (data.tempRange[1] - temp) / range);
      return { type, subtype: Math.min(9, Math.max(0, subtype)) };
    }
  }
  if (temp > 60000) return { type: 'O', subtype: 0 };
  return { type: 'M', subtype: 9 };
}

/**
 * Stellar endpoint based on mass
 */
function determineEndpoint(mass: number): {
  type: string;
  remnant: string;
  remnantMass: number;
  process: string;
} {
  if (mass < 0.08) {
    return {
      type: 'Brown Dwarf',
      remnant: 'Brown Dwarf (no change)',
      remnantMass: mass,
      process: 'Never achieves hydrogen fusion'
    };
  } else if (mass < 0.5) {
    return {
      type: 'Red Dwarf',
      remnant: 'Helium White Dwarf',
      remnantMass: mass * 0.9,
      process: 'Burns hydrogen for >100 Gyr, becomes He WD'
    };
  } else if (mass < 8) {
    return {
      type: 'Sun-like to intermediate',
      remnant: 'White Dwarf',
      remnantMass: Math.min(1.4, 0.4 + 0.1 * mass),
      process: 'Red giant → Planetary nebula → CO White Dwarf'
    };
  } else if (mass < 25) {
    return {
      type: 'Massive star',
      remnant: 'Neutron Star',
      remnantMass: 1.4 + (mass - 8) * 0.05,
      process: 'Supergiant → Core-collapse supernova → NS'
    };
  } else {
    return {
      type: 'Very massive star',
      remnant: 'Black Hole',
      remnantMass: mass * 0.2,
      process: 'Supergiant → Core-collapse → Black Hole'
    };
  }
}

/**
 * Evolutionary track
 */
function evolutionaryTrack(mass: number): Array<{
  phase: string;
  duration: string;
  luminosity: number;
  temperature: number;
  description: string;
}> {
  const track = [];
  const msLifetime = mainSequenceLifetime(mass);
  const msLuminosity = massToLuminosity(mass);

  // Pre-main sequence
  track.push({
    phase: 'Pre-Main Sequence',
    duration: `~${(msLifetime * 0.001).toExponential(2)} years`,
    luminosity: msLuminosity * 2,
    temperature: mass > 2 ? 10000 : 4000,
    description: 'Gravitational contraction, Hayashi/Henyey track'
  });

  // Main sequence
  track.push({
    phase: 'Main Sequence',
    duration: `${msLifetime.toExponential(2)} years`,
    luminosity: msLuminosity,
    temperature: calculateTemperature(msLuminosity, Math.pow(mass, 0.8)),
    description: 'Hydrogen fusion in core (CNO or pp chain)'
  });

  if (mass < 0.5) {
    track.push({
      phase: 'Helium White Dwarf',
      duration: 'Cooling forever',
      luminosity: 0.001,
      temperature: 10000,
      description: 'Never hot enough for helium fusion'
    });
  } else if (mass < 8) {
    track.push({
      phase: 'Subgiant',
      duration: `${(msLifetime * 0.01).toExponential(2)} years`,
      luminosity: msLuminosity * 3,
      temperature: 5000,
      description: 'H shell burning, core contracts'
    });

    track.push({
      phase: 'Red Giant Branch',
      duration: `${(msLifetime * 0.05).toExponential(2)} years`,
      luminosity: msLuminosity * 100,
      temperature: 4000,
      description: 'Ascending RGB, convective envelope deepens'
    });

    track.push({
      phase: 'Helium Flash / Core He Burning',
      duration: `${(msLifetime * 0.01).toExponential(2)} years`,
      luminosity: msLuminosity * 50,
      temperature: 5000,
      description: 'Triple-alpha process ignites'
    });

    track.push({
      phase: 'Asymptotic Giant Branch',
      duration: `${(msLifetime * 0.001).toExponential(2)} years`,
      luminosity: msLuminosity * 1000,
      temperature: 3500,
      description: 'Double shell burning, thermal pulses'
    });

    track.push({
      phase: 'Planetary Nebula + White Dwarf',
      duration: 'Cooling over billions of years',
      luminosity: 0.001,
      temperature: 100000,
      description: 'Envelope ejected, CO core exposed'
    });
  } else {
    track.push({
      phase: 'Blue Supergiant',
      duration: `${(msLifetime * 0.1).toExponential(2)} years`,
      luminosity: msLuminosity * 10,
      temperature: 20000,
      description: 'Post-MS evolution begins'
    });

    track.push({
      phase: 'Red Supergiant',
      duration: `${(msLifetime * 0.01).toExponential(2)} years`,
      luminosity: msLuminosity * 100,
      temperature: 3500,
      description: 'He, C, Ne, O, Si burning in shells'
    });

    track.push({
      phase: 'Core Collapse Supernova',
      duration: 'Seconds',
      luminosity: 1e10,
      temperature: 50000,
      description: 'Iron core collapse, neutrino-driven explosion'
    });

    if (mass < 25) {
      track.push({
        phase: 'Neutron Star',
        duration: 'Forever',
        luminosity: 0.0001,
        temperature: 1000000,
        description: 'Degenerate neutron matter'
      });
    } else {
      track.push({
        phase: 'Black Hole',
        duration: 'Forever',
        luminosity: 0,
        temperature: 0,
        description: 'Event horizon formed'
      });
    }
  }

  return track;
}

/**
 * Nucleosynthesis stages
 */
function nucleosynthesisStages(mass: number): Array<{
  stage: string;
  fuel: string;
  product: string;
  temperature: string;
  duration: string;
  process: string;
}> {
  const stages = [];

  stages.push({
    stage: 'Hydrogen Burning',
    fuel: '⁴H (protons)',
    product: '⁴He',
    temperature: '15-40 million K',
    duration: mass < 2 ? '~10 Gyr (pp chain)' : '~10 Myr (CNO)',
    process: mass < 2 ? 'pp chain: 4p → He + 2e⁺ + 2νₑ + γ' : 'CNO cycle: catalyzed by C, N, O'
  });

  if (mass >= 0.5) {
    stages.push({
      stage: 'Helium Burning',
      fuel: '⁴He',
      product: '¹²C, ¹⁶O',
      temperature: '100-200 million K',
      duration: '~100 Myr',
      process: 'Triple-alpha: 3 ⁴He → ¹²C + γ, then ¹²C + ⁴He → ¹⁶O'
    });
  }

  if (mass >= 8) {
    stages.push({
      stage: 'Carbon Burning',
      fuel: '¹²C',
      product: '²⁰Ne, ²³Na, ²⁴Mg',
      temperature: '~600 million K',
      duration: '~1000 years',
      process: '¹²C + ¹²C → various products'
    });

    stages.push({
      stage: 'Neon Burning',
      fuel: '²⁰Ne',
      product: '¹⁶O, ²⁴Mg',
      temperature: '~1.2 billion K',
      duration: '~1 year',
      process: 'Photodisintegration: ²⁰Ne + γ → ¹⁶O + ⁴He'
    });

    stages.push({
      stage: 'Oxygen Burning',
      fuel: '¹⁶O',
      product: '²⁸Si, ³¹P, ³²S',
      temperature: '~1.5 billion K',
      duration: '~6 months',
      process: '¹⁶O + ¹⁶O → various products'
    });

    stages.push({
      stage: 'Silicon Burning',
      fuel: '²⁸Si',
      product: '⁵⁶Ni → ⁵⁶Fe',
      temperature: '~2.7 billion K',
      duration: '~1 day',
      process: 'Photodisintegration rearrangement to iron-peak'
    });
  }

  return stages;
}

export async function executestellarevolution(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    switch (operation) {
      case 'info': {
        const result = {
          tool: 'Stellar Evolution',
          description: 'Physics of star formation, evolution, and death',

          fundamentalEquations: {
            massLuminosity: 'L ∝ M³·⁵ to M⁴ (main sequence)',
            stefanBoltzmann: 'L = 4πR²σT⁴',
            lifetime: 'τ ∝ M/L ∝ M⁻²·⁵',
            virial: '2K + U = 0 (hydrostatic equilibrium)',
            eddington: 'L_Edd = 4πGMc/κ (radiation pressure limit)'
          },

          spectralSequence: {
            order: 'O B A F G K M (hot to cool)',
            mnemonic: 'Oh Be A Fine Girl/Guy Kiss Me',
            temperatures: 'O: >30,000K → M: <3,700K'
          },

          hrDiagram: {
            xAxis: 'Temperature (or B-V color) - reversed',
            yAxis: 'Luminosity (or absolute magnitude)',
            mainSequence: 'Diagonal band where H→He fusion occurs',
            giantBranch: 'Upper right - cool, luminous post-MS',
            whiteDwarfSequence: 'Lower left - hot, dim'
          },

          stellarEndpoints: {
            'M < 8 M☉': 'White Dwarf (Chandrasekhar limit 1.4 M☉)',
            '8 < M < 25 M☉': 'Neutron Star (1.4-3 M☉)',
            'M > 25 M☉': 'Black Hole'
          },

          usage: 'Use operation: classify, hr_diagram, lifetime, evolve, luminosity, radius, endpoint, nucleosynthesis'
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'classify': {
        const temp = args.temperature;
        const lumClass = args.luminosity_class || 'V';

        if (!temp) {
          throw new Error('Temperature required for classification');
        }

        const spectral = temperatureToSpectralType(temp);
        const lumInfo = LUMINOSITY_CLASSES[lumClass];

        const result = {
          operation: 'classify',
          input: { temperature: temp, luminosityClass: lumClass },

          classification: {
            spectralType: `${spectral.type}${spectral.subtype}`,
            luminosityClass: lumClass,
            fullClassification: `${spectral.type}${spectral.subtype} ${lumClass}`,
            name: lumInfo?.name || 'Unknown'
          },

          spectralTypeInfo: {
            type: spectral.type,
            color: SPECTRAL_TYPES[spectral.type]?.color,
            temperatureRange: SPECTRAL_TYPES[spectral.type]?.tempRange,
            fractionOfStars: `${(SPECTRAL_TYPES[spectral.type]?.fraction * 100).toFixed(2)}%`
          },

          examples: {
            'O5V': 'Hot blue main sequence (e.g., θ¹ Ori C)',
            'B3V': 'Blue-white MS (e.g., Regulus)',
            'A0V': 'White MS (e.g., Vega, Sirius)',
            'G2V': 'Yellow MS (e.g., Sun)',
            'K5III': 'Orange giant (e.g., Aldebaran)',
            'M2Ia': 'Red supergiant (e.g., Betelgeuse)'
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'hr_diagram': {
        const mass = args.mass || 1;
        const L = args.luminosity || massToLuminosity(mass);
        const T = args.temperature || calculateTemperature(L, Math.pow(mass, 0.8));
        const R = calculateRadius(L, T);

        const spectral = temperatureToSpectralType(T);

        // Determine region of HR diagram
        let region: string;
        if (L < 0.01 && T > 7000) {
          region = 'White Dwarf Sequence';
        } else if (L > 100 && T < 5000) {
          region = 'Red Giant Branch';
        } else if (L > 10000 && T < 5000) {
          region = 'Red Supergiant Region';
        } else if (L > 10000 && T > 10000) {
          region = 'Blue Supergiant Region';
        } else if (Math.abs(Math.log10(L) - 4 * Math.log10(T/5778)) < 0.5) {
          region = 'Main Sequence';
        } else {
          region = 'Subgiant/Giant Region';
        }

        const result = {
          operation: 'hr_diagram',

          starProperties: {
            mass: `${mass} M☉`,
            luminosity: `${L.toFixed(4)} L☉`,
            temperature: `${Math.round(T)} K`,
            radius: `${R.toFixed(4)} R☉`,
            spectralType: `${spectral.type}${spectral.subtype}`
          },

          hrPosition: {
            logL: Math.log10(L).toFixed(2),
            logT: Math.log10(T).toFixed(2),
            absoluteMagnitude: (4.83 - 2.5 * Math.log10(L)).toFixed(2),
            region: region
          },

          diagram: `
            HR DIAGRAM POSITION
            ═══════════════════

                   |  Blue Supergiants
            10⁶ L☉ |     ●
                   |        \\
            10⁴ L☉ |          Red Supergiants
                   |              ●
            10² L☉ |      Giants    ●
                   |        ●
            1 L☉   |  ★ ${mass === 1 ? '← YOU ARE HERE' : ''}
                   | Main Sequence (diagonal)
            10⁻² L☉|     \\
                   |       \\  White Dwarfs
            10⁻⁴ L☉|         ●●●
                   +────────────────────
                  40,000K  10,000K  3,000K
                     Temperature →
          `
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'lifetime': {
        const mass = args.mass || 1;
        const L = massToLuminosity(mass);
        const lifetime = mainSequenceLifetime(mass);

        const result = {
          operation: 'lifetime',
          mass: `${mass} M☉`,
          luminosity: `${L.toFixed(4)} L☉`,

          calculation: {
            formula: 'τ = τ☉ × (M/L) = τ☉ × M/M^α ≈ τ☉ × M^(1-α)',
            solarLifetime: '~10 billion years',
            massLuminosityRelation: mass < 2 ? 'L ∝ M⁴' : 'L ∝ M³·⁵',
            result: `τ ≈ ${lifetime.toExponential(2)} years`
          },

          mainSequenceLifetime: {
            years: lifetime.toExponential(2),
            gigayears: (lifetime / 1e9).toFixed(2) + ' Gyr',
            comparison: lifetime > 1e10 ? 'Longer than current universe age' :
                       lifetime > 1e9 ? 'Comparable to Sun' :
                       lifetime > 1e6 ? 'Short-lived massive star' : 'Very brief'
          },

          comparisonTable: {
            '0.1 M☉': `${mainSequenceLifetime(0.1).toExponential(1)} years (red dwarf)`,
            '0.5 M☉': `${mainSequenceLifetime(0.5).toExponential(1)} years`,
            '1.0 M☉': `${mainSequenceLifetime(1.0).toExponential(1)} years (Sun)`,
            '2.0 M☉': `${mainSequenceLifetime(2.0).toExponential(1)} years`,
            '10 M☉': `${mainSequenceLifetime(10).toExponential(1)} years`,
            '50 M☉': `${mainSequenceLifetime(50).toExponential(1)} years`
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'evolve': {
        const mass = args.mass || 1;
        const track = evolutionaryTrack(mass);
        const endpoint = determineEndpoint(mass);

        const result = {
          operation: 'evolve',
          initialMass: `${mass} M☉`,

          evolutionaryTrack: track.map(phase => ({
            ...phase,
            luminosity: `${phase.luminosity.toExponential(2)} L☉`,
            temperature: `${Math.round(phase.temperature)} K`
          })),

          finalState: endpoint,

          keyPhysics: {
            hydrostaticEquilibrium: 'Pressure balances gravity',
            nuclearTimescale: 'Set by fuel/luminosity ratio',
            thermalTimescale: 'Kelvin-Helmholtz: GM²/RL',
            dynamicalTimescale: '√(R³/GM) ~ hours'
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'luminosity': {
        const mass = args.mass;
        const radius = args.radius;
        const temperature = args.temperature;

        let L: number;
        let method: string;

        if (radius && temperature) {
          L = calculateLuminosity(radius, temperature);
          method = 'Stefan-Boltzmann: L = 4πR²σT⁴';
        } else if (mass) {
          L = massToLuminosity(mass);
          method = 'Mass-Luminosity relation: L ∝ M^α';
        } else {
          throw new Error('Need mass, or radius+temperature');
        }

        const result = {
          operation: 'luminosity',
          method,
          luminosity: {
            solarUnits: `${L.toFixed(4)} L☉`,
            watts: `${(L * CONSTANTS.L_SUN).toExponential(2)} W`,
            absoluteMagnitude: (4.83 - 2.5 * Math.log10(L)).toFixed(2)
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'radius': {
        const L = args.luminosity || 1;
        const T = args.temperature || CONSTANTS.T_SUN;

        const R = calculateRadius(L, T);

        const result = {
          operation: 'radius',
          input: { luminosity: `${L} L☉`, temperature: `${T} K` },

          calculation: {
            formula: 'R = √(L / (4πσT⁴))',
            simplified: 'R/R☉ = √(L/L☉) × (T☉/T)²'
          },

          radius: {
            solarUnits: `${R.toFixed(4)} R☉`,
            meters: `${(R * CONSTANTS.R_SUN).toExponential(2)} m`,
            km: `${(R * CONSTANTS.R_SUN / 1000).toExponential(2)} km`
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'endpoint': {
        const mass = args.mass || 1;
        const endpoint = determineEndpoint(mass);

        const result = {
          operation: 'endpoint',
          initialMass: `${mass} M☉`,
          ...endpoint,

          massLimits: {
            chandrasekhar: '1.4 M☉ - max white dwarf mass',
            tolmanOppenheimerVolkoff: '~2-3 M☉ - max neutron star mass',
            pairInstability: '130-250 M☉ - no remnant (complete disruption)'
          },

          remnantComposition: {
            whiteDwarf: 'Carbon-oxygen (or He for low mass)',
            neutronStar: 'Neutron-degenerate matter + exotic phases',
            blackHole: 'Singularity within event horizon'
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'nucleosynthesis': {
        const mass = args.mass || 10;
        const stages = nucleosynthesisStages(mass);

        const result = {
          operation: 'nucleosynthesis',
          stellarMass: `${mass} M☉`,

          fusionStages: stages,

          elementOrigins: {
            H_He: 'Big Bang nucleosynthesis',
            'Li, Be, B': 'Cosmic ray spallation',
            'C to Fe': 'Stellar nucleosynthesis',
            'Beyond Fe': 's-process (AGB), r-process (supernovae/mergers)'
          },

          energyRelease: {
            'H→He': '6.3 × 10¹⁴ J/kg',
            'He→C': '5.8 × 10¹³ J/kg',
            'C→O': '~10¹³ J/kg',
            'Si→Fe': 'Minimal (approaching Fe peak)'
          },

          ironPeak: 'Fusion stops at Fe-56 (most tightly bound nucleus)'
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      default:
        return {
          toolCallId: id,
          content: `Unknown operation: ${operation}. Use: info, classify, hr_diagram, lifetime, evolve, luminosity, radius, temperature, endpoint, nucleosynthesis`
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isstellarevolutionAvailable(): boolean { return true; }
