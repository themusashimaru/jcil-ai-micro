/**
 * STELLAR-EVOLUTION TOOL
 * Stellar evolution modeling, HR diagrams, and stellar physics
 * Complete implementation with mass-luminosity relations, evolutionary tracks, and stellar endpoints
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// CONSTANTS
// ============================================================================

const SOLAR_MASS = 1.989e30; // kg
const SOLAR_LUMINOSITY = 3.828e26; // W
const SOLAR_RADIUS = 6.957e8; // m
const SOLAR_TEMPERATURE = 5778; // K
const STEFAN_BOLTZMANN = 5.670374419e-8; // W/(m²K⁴)
const CHANDRASEKHAR_LIMIT = 1.4; // Solar masses
const TOV_LIMIT = 2.1; // Solar masses (approximate Tolman-Oppenheimer-Volkoff limit)

// ============================================================================
// SPECTRAL CLASSIFICATION
// ============================================================================

interface SpectralClass {
  class: string;
  temperatureRange: [number, number];
  color: string;
  absorptionLines: string;
  examples: string[];
  fraction: number; // Percentage of stars
}

const SPECTRAL_CLASSES: SpectralClass[] = [
  {
    class: 'O',
    temperatureRange: [30000, 60000],
    color: 'Blue',
    absorptionLines: 'Ionized helium (He II), weak hydrogen',
    examples: ['ζ Ophiuchi', '10 Lacertae'],
    fraction: 0.00003,
  },
  {
    class: 'B',
    temperatureRange: [10000, 30000],
    color: 'Blue-white',
    absorptionLines: 'Neutral helium, hydrogen',
    examples: ['Rigel', 'Spica'],
    fraction: 0.13,
  },
  {
    class: 'A',
    temperatureRange: [7500, 10000],
    color: 'White',
    absorptionLines: 'Strong hydrogen (Balmer series)',
    examples: ['Sirius', 'Vega'],
    fraction: 0.6,
  },
  {
    class: 'F',
    temperatureRange: [6000, 7500],
    color: 'Yellow-white',
    absorptionLines: 'Hydrogen, ionized calcium',
    examples: ['Canopus', 'Procyon'],
    fraction: 3.0,
  },
  {
    class: 'G',
    temperatureRange: [5200, 6000],
    color: 'Yellow',
    absorptionLines: 'Calcium, iron, other metals',
    examples: ['Sun', 'Alpha Centauri A'],
    fraction: 7.6,
  },
  {
    class: 'K',
    temperatureRange: [3700, 5200],
    color: 'Orange',
    absorptionLines: 'Neutral metals, molecules',
    examples: ['Arcturus', 'Aldebaran'],
    fraction: 12.1,
  },
  {
    class: 'M',
    temperatureRange: [2400, 3700],
    color: 'Red',
    absorptionLines: 'Titanium oxide, molecules',
    examples: ['Betelgeuse', 'Proxima Centauri'],
    fraction: 76.5,
  },
];

// ============================================================================
// LUMINOSITY CLASSES
// ============================================================================

interface LuminosityClass {
  class: string;
  name: string;
  description: string;
  typicalRadius: string;
}

const LUMINOSITY_CLASSES: LuminosityClass[] = [
  {
    class: 'Ia',
    name: 'Luminous Supergiant',
    description: 'Most luminous supergiants',
    typicalRadius: '100-1000 R☉',
  },
  {
    class: 'Ib',
    name: 'Supergiant',
    description: 'Less luminous supergiants',
    typicalRadius: '50-500 R☉',
  },
  {
    class: 'II',
    name: 'Bright Giant',
    description: 'Intermediate between giants and supergiants',
    typicalRadius: '25-100 R☉',
  },
  {
    class: 'III',
    name: 'Giant',
    description: 'Stars that have left the main sequence',
    typicalRadius: '10-50 R☉',
  },
  {
    class: 'IV',
    name: 'Subgiant',
    description: 'Between main sequence and giants',
    typicalRadius: '2-10 R☉',
  },
  {
    class: 'V',
    name: 'Main Sequence (Dwarf)',
    description: 'Core hydrogen burning stars',
    typicalRadius: '0.1-10 R☉',
  },
  {
    class: 'VI',
    name: 'Subdwarf',
    description: 'Below main sequence in luminosity',
    typicalRadius: '0.1-0.5 R☉',
  },
  {
    class: 'VII',
    name: 'White Dwarf',
    description: 'Degenerate stellar remnants',
    typicalRadius: '~0.01 R☉',
  },
];

// ============================================================================
// STELLAR PHYSICS CALCULATIONS
// ============================================================================

/**
 * Mass-Luminosity relation for main sequence stars
 * L/L☉ ≈ (M/M☉)^α where α varies with mass
 */
function massLuminosityRelation(mass: number): number {
  // mass in solar masses
  if (mass < 0.43) {
    return Math.pow(mass, 2.3);
  } else if (mass < 2) {
    return Math.pow(mass, 4);
  } else if (mass < 20) {
    return 1.4 * Math.pow(mass, 3.5);
  } else {
    return 32000 * mass; // Very massive stars
  }
}

/**
 * Mass-Radius relation for main sequence stars
 */
function massRadiusRelation(mass: number): number {
  // mass in solar masses, returns radius in solar radii
  if (mass < 1) {
    return Math.pow(mass, 0.8);
  } else {
    return Math.pow(mass, 0.57);
  }
}

/**
 * Main sequence lifetime
 * τ ≈ (M/M☉) / (L/L☉) × 10^10 years
 */
function mainSequenceLifetime(mass: number): number {
  const luminosity = massLuminosityRelation(mass);
  return (mass / luminosity) * 1e10; // years
}

/**
 * Effective temperature from luminosity and radius
 * L = 4πR²σT⁴
 */
function effectiveTemperature(luminosity: number, radius: number): number {
  // luminosity in L☉, radius in R☉, returns temperature in K
  const L = luminosity * SOLAR_LUMINOSITY;
  const R = radius * SOLAR_RADIUS;
  return Math.pow(L / (4 * Math.PI * R * R * STEFAN_BOLTZMANN), 0.25);
}

/**
 * Absolute magnitude from luminosity
 * M = M☉ - 2.5 log₁₀(L/L☉)
 */
function absoluteMagnitude(luminosity: number): number {
  const SOLAR_ABSOLUTE_MAG = 4.83;
  return SOLAR_ABSOLUTE_MAG - 2.5 * Math.log10(luminosity);
}

/**
 * Schwarzschild radius
 */
function schwarzschildRadius(mass: number): number {
  // mass in solar masses, returns radius in km
  return 2.95 * mass; // km
}

/**
 * Eddington luminosity (maximum luminosity before radiation pressure dominates)
 */
function eddingtonLuminosity(mass: number): number {
  // Returns luminosity in L☉
  return 3.2e4 * mass;
}

// ============================================================================
// STELLAR EVOLUTION STAGES
// ============================================================================

interface EvolutionStage {
  name: string;
  duration: string;
  description: string;
  processes: string[];
  hrPosition: string;
}

interface EvolutionaryTrack {
  initialMass: number;
  stages: EvolutionStage[];
  finalState: string;
  totalLifetime: string;
}

function getEvolutionaryTrack(mass: number): EvolutionaryTrack {
  const msLifetime = mainSequenceLifetime(mass);

  // Low mass stars (< 0.5 M☉)
  if (mass < 0.5) {
    return {
      initialMass: mass,
      stages: [
        {
          name: 'Pre-Main Sequence',
          duration: '~100 million years',
          description: 'Gravitational contraction, Hayashi track',
          processes: ['Gravitational contraction', 'Deuterium burning'],
          hrPosition: 'Upper right, moving left',
        },
        {
          name: 'Main Sequence',
          duration: `>${1e11} years (longer than universe age)`,
          description: 'Slow hydrogen burning via pp-chain',
          processes: ['Proton-proton chain'],
          hrPosition: 'Lower main sequence',
        },
      ],
      finalState: 'Will become helium white dwarf (not yet)',
      totalLifetime: 'Longer than current age of universe',
    };
  }

  // Sun-like stars (0.5-2 M☉)
  if (mass < 2) {
    return {
      initialMass: mass,
      stages: [
        {
          name: 'Pre-Main Sequence',
          duration: '~50 million years',
          description: 'T Tauri phase, gravitational contraction',
          processes: ['Gravitational contraction', 'Convective mixing'],
          hrPosition: 'Upper right, descending Hayashi track',
        },
        {
          name: 'Main Sequence',
          duration: `${(msLifetime / 1e9).toFixed(1)} billion years`,
          description: 'Core hydrogen burning',
          processes: ['pp-chain (dominant)', 'CNO cycle (minor for M>1.3M☉)'],
          hrPosition: 'Main sequence band',
        },
        {
          name: 'Subgiant Branch',
          duration: '~1 billion years',
          description: 'Hydrogen shell burning, core contracts',
          processes: ['Hydrogen shell burning', 'Core contraction'],
          hrPosition: 'Above main sequence, moving right',
        },
        {
          name: 'Red Giant Branch',
          duration: '~1 billion years',
          description: 'Envelope expansion, core degeneracy',
          processes: ['Hydrogen shell burning', 'Convective dredge-up'],
          hrPosition: 'Upper right',
        },
        {
          name: 'Helium Flash',
          duration: 'Minutes',
          description: 'Explosive helium ignition in degenerate core',
          processes: ['Triple-alpha process ignition'],
          hrPosition: 'Tip of RGB',
        },
        {
          name: 'Horizontal Branch',
          duration: '~100 million years',
          description: 'Core helium burning',
          processes: ['Triple-alpha process', 'Hydrogen shell burning'],
          hrPosition: 'Horizontal branch or red clump',
        },
        {
          name: 'Asymptotic Giant Branch',
          duration: '~1 million years',
          description: 'Double shell burning, thermal pulses',
          processes: ['Helium shell flashes', 's-process nucleosynthesis'],
          hrPosition: 'Upper right, above RGB',
        },
        {
          name: 'Planetary Nebula',
          duration: '~10,000 years',
          description: 'Mass loss exposes hot core',
          processes: ['Superwind mass loss', 'UV ionization of nebula'],
          hrPosition: 'Moving left at constant luminosity',
        },
        {
          name: 'White Dwarf',
          duration: 'Indefinite cooling',
          description: 'Degenerate carbon-oxygen core',
          processes: ['Thermal radiation', 'Crystallization'],
          hrPosition: 'Lower left',
        },
      ],
      finalState: 'Carbon-Oxygen White Dwarf',
      totalLifetime: `~${((msLifetime + 2e9) / 1e9).toFixed(1)} billion years`,
    };
  }

  // Intermediate mass stars (2-8 M☉)
  if (mass < 8) {
    return {
      initialMass: mass,
      stages: [
        {
          name: 'Pre-Main Sequence',
          duration: '~1-10 million years',
          description: 'Herbig Ae/Be star phase',
          processes: ['Gravitational contraction', 'Radiative core development'],
          hrPosition: 'Upper right',
        },
        {
          name: 'Main Sequence',
          duration: `${(msLifetime / 1e6).toFixed(0)} million years`,
          description: 'Core hydrogen burning via CNO cycle',
          processes: ['CNO cycle (dominant)', 'Convective core'],
          hrPosition: 'Upper main sequence',
        },
        {
          name: 'Hertzsprung Gap',
          duration: '~1 million years',
          description: 'Rapid evolution across HR diagram',
          processes: ['Core contraction', 'Envelope expansion'],
          hrPosition: 'Moving rapidly rightward',
        },
        {
          name: 'Red Giant / Supergiant',
          duration: '~10 million years',
          description: 'Shell burning and dredge-up',
          processes: ['Shell burning', 'Second dredge-up'],
          hrPosition: 'Upper right',
        },
        {
          name: 'Blue Loop (some stars)',
          duration: '~1 million years',
          description: 'Core helium burning causes contraction',
          processes: ['Core helium burning'],
          hrPosition: 'Loop to upper left and back',
        },
        {
          name: 'AGB Phase',
          duration: '~1 million years',
          description: 'Thermal pulses and mass loss',
          processes: ['Thermal pulses', 'Hot bottom burning', 's-process'],
          hrPosition: 'Upper right',
        },
        {
          name: 'Planetary Nebula / White Dwarf',
          duration: 'Cooling',
          description: 'More massive CO or ONe white dwarf',
          processes: ['Mass loss', 'Cooling'],
          hrPosition: 'Lower left',
        },
      ],
      finalState: mass < 6 ? 'CO White Dwarf (0.6-1.0 M☉)' : 'ONeMg White Dwarf (1.0-1.4 M☉)',
      totalLifetime: `~${((msLifetime + 1e7) / 1e6).toFixed(0)} million years`,
    };
  }

  // Massive stars (8-25 M☉)
  if (mass < 25) {
    return {
      initialMass: mass,
      stages: [
        {
          name: 'Pre-Main Sequence',
          duration: '~100,000 years',
          description: 'Rapid collapse, no visible PMS phase',
          processes: ['Rapid accretion', 'Disk formation'],
          hrPosition: 'Emerges on upper main sequence',
        },
        {
          name: 'Main Sequence',
          duration: `${(msLifetime / 1e6).toFixed(0)} million years`,
          description: 'CNO cycle with convective core',
          processes: ['CNO cycle', 'Mass loss via stellar wind'],
          hrPosition: 'Upper main sequence',
        },
        {
          name: 'Blue Supergiant',
          duration: '~1 million years',
          description: 'Core helium burning',
          processes: ['Triple-alpha', 'Carbon burning begins'],
          hrPosition: 'Upper left',
        },
        {
          name: 'Red Supergiant',
          duration: '~1 million years',
          description: 'Advanced nuclear burning',
          processes: ['Shell burning', 'Neon burning', 'Oxygen burning'],
          hrPosition: 'Upper right',
        },
        {
          name: 'Advanced Burning',
          duration: 'Years to days',
          description: 'Rapid progression through burning stages',
          processes: ['Silicon burning', 'Iron core formation'],
          hrPosition: 'Upper region',
        },
        {
          name: 'Core Collapse',
          duration: 'Milliseconds',
          description: 'Iron core exceeds Chandrasekhar limit',
          processes: ['Electron capture', 'Neutronization'],
          hrPosition: 'N/A',
        },
        {
          name: 'Supernova Type II',
          duration: 'Seconds to months',
          description: 'Explosive ejection of envelope',
          processes: ['Neutrino burst', 'Shock wave', 'r-process'],
          hrPosition: 'Transient bright event',
        },
      ],
      finalState: 'Neutron Star (1.4-2.1 M☉)',
      totalLifetime: `~${((msLifetime + 2e6) / 1e6).toFixed(0)} million years`,
    };
  }

  // Very massive stars (>25 M☉)
  return {
    initialMass: mass,
    stages: [
      {
        name: 'Formation',
        duration: '~50,000 years',
        description: 'Forms within dense molecular cloud',
        processes: ['Massive accretion', 'Strong stellar wind'],
        hrPosition: 'Appears on upper main sequence',
      },
      {
        name: 'Main Sequence',
        duration: `${(msLifetime / 1e6).toFixed(1)} million years`,
        description: 'Near Eddington luminosity',
        processes: ['CNO cycle', 'Severe mass loss'],
        hrPosition: 'Upper left main sequence',
      },
      {
        name: 'Wolf-Rayet Phase',
        duration: '~0.5 million years',
        description: 'Strong mass loss exposes core',
        processes: ['Extreme stellar wind', 'Helium/carbon/oxygen exposed'],
        hrPosition: 'Upper left, high temperature',
      },
      {
        name: 'Core Collapse',
        duration: 'Milliseconds',
        description: 'Catastrophic core collapse',
        processes: ['Direct collapse or explosion'],
        hrPosition: 'N/A',
      },
    ],
    finalState: mass > 40 ? 'Black Hole (direct collapse possible)' : 'Black Hole or Neutron Star',
    totalLifetime: `~${((msLifetime + 1e6) / 1e6).toFixed(1)} million years`,
  };
}

// ============================================================================
// STELLAR CLASSIFICATION
// ============================================================================

interface StellarClassification {
  spectralType: string;
  luminosityClass: string;
  fullClassification: string;
  estimatedMass: number;
  estimatedTemperature: number;
  description: string;
}

function classifyStar(temperature: number, luminosity: number): StellarClassification {
  // Find spectral class
  let spectralClass = 'M';
  for (const sc of SPECTRAL_CLASSES) {
    if (temperature >= sc.temperatureRange[0] && temperature < sc.temperatureRange[1]) {
      spectralClass = sc.class;
      break;
    }
  }
  if (temperature >= 60000) spectralClass = 'O';

  // Estimate mass from luminosity (rough, assuming main sequence)
  let estimatedMass = Math.pow(luminosity, 0.25); // Rough inverse of L ∝ M^4

  // Determine luminosity class
  let luminosityClass = 'V';
  const msLuminosity = massLuminosityRelation(estimatedMass);

  if (luminosity > msLuminosity * 1000) {
    luminosityClass = 'Ia';
  } else if (luminosity > msLuminosity * 100) {
    luminosityClass = 'Ib';
  } else if (luminosity > msLuminosity * 25) {
    luminosityClass = 'II';
  } else if (luminosity > msLuminosity * 10) {
    luminosityClass = 'III';
  } else if (luminosity > msLuminosity * 2) {
    luminosityClass = 'IV';
  } else if (luminosity < 0.01 && temperature > 10000) {
    luminosityClass = 'VII'; // White dwarf
    estimatedMass = 0.6;
  }

  const lcName = LUMINOSITY_CLASSES.find((lc) => lc.class === luminosityClass)?.name || 'Unknown';

  return {
    spectralType: spectralClass,
    luminosityClass,
    fullClassification: `${spectralClass}${luminosityClass}`,
    estimatedMass,
    estimatedTemperature: temperature,
    description: `${spectralClass}-type ${lcName}`,
  };
}

// ============================================================================
// HR DIAGRAM GENERATION
// ============================================================================

interface HRDiagramPoint {
  name: string;
  temperature: number;
  luminosity: number;
  spectralType: string;
  region: string;
}

function generateHRDiagram(): HRDiagramPoint[] {
  const points: HRDiagramPoint[] = [];

  // Main sequence
  const msMasses = [0.1, 0.3, 0.5, 0.8, 1.0, 1.5, 2.0, 5.0, 10, 20, 50];
  for (const mass of msMasses) {
    const L = massLuminosityRelation(mass);
    const R = massRadiusRelation(mass);
    const T = effectiveTemperature(L, R);
    const classification = classifyStar(T, L);
    points.push({
      name: `MS ${mass}M☉`,
      temperature: Math.round(T),
      luminosity: L,
      spectralType: classification.spectralType,
      region: 'Main Sequence',
    });
  }

  // Reference stars
  const referenceStars: Array<{ name: string; temp: number; lum: number }> = [
    { name: 'Sun', temp: 5778, lum: 1 },
    { name: 'Sirius A', temp: 9940, lum: 25 },
    { name: 'Betelgeuse', temp: 3500, lum: 126000 },
    { name: 'Rigel', temp: 12100, lum: 120000 },
    { name: 'Proxima Centauri', temp: 3042, lum: 0.0017 },
    { name: 'Sirius B (WD)', temp: 25200, lum: 0.026 },
    { name: 'Vega', temp: 9602, lum: 40 },
    { name: 'Arcturus', temp: 4286, lum: 170 },
  ];

  for (const star of referenceStars) {
    const classification = classifyStar(star.temp, star.lum);
    points.push({
      name: star.name,
      temperature: star.temp,
      luminosity: star.lum,
      spectralType: classification.fullClassification,
      region:
        classification.luminosityClass === 'V'
          ? 'Main Sequence'
          : classification.luminosityClass === 'VII'
            ? 'White Dwarf'
            : classification.luminosityClass.startsWith('I')
              ? 'Supergiant'
              : 'Giant',
    });
  }

  return points;
}

// ============================================================================
// TOOL INTERFACE
// ============================================================================

export const stellarevolutionTool: UnifiedTool = {
  name: 'stellar_evolution',
  description:
    'Stellar evolution and HR diagram modeling - mass-luminosity relations, evolutionary tracks, spectral classification, and stellar endpoints',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['evolve', 'classify', 'hr_diagram', 'properties', 'lifetime', 'endpoint', 'info'],
        description: 'Operation type',
      },
      mass: {
        type: 'number',
        description: 'Stellar mass in solar masses',
      },
      temperature: {
        type: 'number',
        description: 'Effective temperature in Kelvin',
      },
      luminosity: {
        type: 'number',
        description: 'Luminosity in solar luminosities',
      },
      star_type: {
        type: 'string',
        enum: ['main_sequence', 'red_giant', 'white_dwarf', 'neutron_star', 'black_hole'],
        description: 'Star type filter',
      },
    },
    required: ['operation'],
  },
};

export async function executestellarevolution(
  toolCall: UnifiedToolCall
): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation as string;

    switch (operation) {
      case 'evolve': {
        const mass = args.mass || 1.0;

        if (mass <= 0 || mass > 150) {
          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                error: 'Mass must be between 0.08 and 150 solar masses',
                note: 'Below 0.08 M☉ = brown dwarf, above ~150 M☉ = pair-instability limit',
              },
              null,
              2
            ),
            isError: true,
          };
        }

        const track = getEvolutionaryTrack(mass);
        const properties = {
          mainSequenceLuminosity: massLuminosityRelation(mass),
          mainSequenceRadius: massRadiusRelation(mass),
          mainSequenceTemperature: effectiveTemperature(
            massLuminosityRelation(mass),
            massRadiusRelation(mass)
          ),
          mainSequenceLifetime: mainSequenceLifetime(mass),
        };

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'evolve',
              initialMass: `${mass} M☉`,
              evolutionaryTrack: track,
              mainSequenceProperties: {
                luminosity: `${properties.mainSequenceLuminosity.toExponential(2)} L☉`,
                radius: `${properties.mainSequenceRadius.toFixed(2)} R☉`,
                temperature: `${Math.round(properties.mainSequenceTemperature)} K`,
                lifetime:
                  properties.mainSequenceLifetime > 1e9
                    ? `${(properties.mainSequenceLifetime / 1e9).toFixed(1)} billion years`
                    : `${(properties.mainSequenceLifetime / 1e6).toFixed(0)} million years`,
              },
            },
            null,
            2
          ),
        };
      }

      case 'classify': {
        const temp = args.temperature || 5778;
        const lum = args.luminosity || 1.0;

        const classification = classifyStar(temp, lum);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'classify',
              input: { temperature: temp, luminosity: lum },
              classification,
              spectralClasses: SPECTRAL_CLASSES,
              luminosityClasses: LUMINOSITY_CLASSES,
            },
            null,
            2
          ),
        };
      }

      case 'hr_diagram': {
        const diagram = generateHRDiagram();

        // ASCII representation
        const ascii = `
        HR DIAGRAM

        10⁶ L☉ |     O    B  A
               |        ★Rigel
               |      ★Betelgeuse
        10⁴ L☉ |
               |
        10² L☉ |           ★Arcturus
               |       ★Vega
          1 L☉ |    ★Sun
               |
        10⁻²L☉|           ★Sirius B
               |                  (WD)
        10⁻⁴L☉|              ★Proxima
               ├─────────────────────────
               40000  10000  5000  3000 K
               Blue ←───────────→ Red
        `;

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'hr_diagram',
              description: 'Hertzsprung-Russell Diagram',
              axes: {
                x: 'Effective Temperature (K) - decreasing rightward',
                y: 'Luminosity (L☉) - logarithmic scale',
              },
              regions: {
                mainSequence: 'Diagonal band from upper-left to lower-right',
                giants: 'Upper-right region',
                supergiants: 'Uppermost region',
                whiteDwarfs: 'Lower-left region',
              },
              referencPoints: diagram,
              asciiDiagram: ascii,
            },
            null,
            2
          ),
        };
      }

      case 'properties': {
        const mass = args.mass || 1.0;

        const L = massLuminosityRelation(mass);
        const R = massRadiusRelation(mass);
        const T = effectiveTemperature(L, R);
        const lifetime = mainSequenceLifetime(mass);
        const mag = absoluteMagnitude(L);
        const eddington = eddingtonLuminosity(mass);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'properties',
              mass: `${mass} M☉`,
              mainSequenceProperties: {
                luminosity: {
                  value: L,
                  unit: 'L☉',
                  watts: (L * SOLAR_LUMINOSITY).toExponential(2),
                },
                radius: {
                  value: R,
                  unit: 'R☉',
                  meters: (R * SOLAR_RADIUS).toExponential(2),
                },
                temperature: {
                  value: Math.round(T),
                  unit: 'K',
                },
                absoluteMagnitude: mag.toFixed(2),
                lifetime: {
                  years: lifetime.toExponential(2),
                  formatted:
                    lifetime > 1e9
                      ? `${(lifetime / 1e9).toFixed(1)} Gyr`
                      : `${(lifetime / 1e6).toFixed(0)} Myr`,
                },
              },
              physicalLimits: {
                eddingtonLuminosity: `${eddington.toExponential(2)} L☉`,
                schwarzschildRadius:
                  mass > 3
                    ? `${schwarzschildRadius(mass).toFixed(1)} km`
                    : 'N/A (not massive enough)',
              },
              scalingRelations: {
                massLuminosity: 'L ∝ M^(3.5-4) for main sequence',
                massRadius: 'R ∝ M^(0.57-0.8) for main sequence',
                massLifetime: 'τ ∝ M/L ∝ M^(-2.5 to -3)',
              },
            },
            null,
            2
          ),
        };
      }

      case 'lifetime': {
        const mass = args.mass || 1.0;
        const lifetime = mainSequenceLifetime(mass);

        // Compare to other masses
        const comparisons = [0.1, 0.5, 1.0, 2.0, 5.0, 10, 20, 50].map((m) => ({
          mass: `${m} M☉`,
          lifetime:
            mainSequenceLifetime(m) > 1e9
              ? `${(mainSequenceLifetime(m) / 1e9).toFixed(1)} Gyr`
              : `${(mainSequenceLifetime(m) / 1e6).toFixed(0)} Myr`,
        }));

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'lifetime',
              inputMass: `${mass} M☉`,
              mainSequenceLifetime:
                lifetime > 1e9
                  ? `${(lifetime / 1e9).toFixed(1)} billion years`
                  : `${(lifetime / 1e6).toFixed(0)} million years`,
              comparedToSun: `${(lifetime / 1e10).toFixed(2)}× solar lifetime`,
              explanation:
                'More massive stars burn fuel faster despite having more, so they live shorter lives',
              comparisons,
            },
            null,
            2
          ),
        };
      }

      case 'endpoint': {
        const mass = args.mass || 1.0;

        let endpoint: Record<string, unknown>;

        if (mass < 0.08) {
          endpoint = {
            type: 'Brown Dwarf',
            description: 'Never achieved sustained hydrogen fusion',
            remnant: 'None - gradually cools as brown dwarf',
          };
        } else if (mass < 0.5) {
          endpoint = {
            type: 'Helium White Dwarf',
            description: 'Will not reach helium burning (universe not old enough yet)',
            remnantMass: '~0.4 M☉',
            composition: 'Helium',
          };
        } else if (mass < 8) {
          endpoint = {
            type: 'White Dwarf',
            description: 'Planetary nebula phase followed by white dwarf',
            remnantMass: mass < 2 ? '~0.6 M☉' : `~${(0.4 + 0.1 * mass).toFixed(1)} M☉`,
            composition: mass < 6 ? 'Carbon-Oxygen' : 'Oxygen-Neon-Magnesium',
            coolingTime: 'Billions of years to black dwarf',
          };
        } else if (mass < 25) {
          endpoint = {
            type: 'Neutron Star',
            description: 'Core-collapse supernova Type II',
            supernovaEnergy: '~10^44 J',
            remnantMass: '1.4-2.1 M☉',
            radius: '~10 km',
            density: '~10^17 kg/m³',
            possiblePulsar: true,
          };
        } else if (mass < 40) {
          endpoint = {
            type: 'Black Hole (via supernova)',
            description: 'Core collapse with fallback, supernova',
            remnantMass: `~${(mass * 0.1).toFixed(0)}-${(mass * 0.3).toFixed(0)} M☉`,
            schwarzschildRadius: `${schwarzschildRadius(mass * 0.2).toFixed(0)} km`,
          };
        } else {
          endpoint = {
            type: 'Black Hole (direct collapse possible)',
            description: 'May collapse directly without supernova',
            remnantMass: `~${(mass * 0.3).toFixed(0)}-${(mass * 0.5).toFixed(0)} M☉`,
            schwarzschildRadius: `${schwarzschildRadius(mass * 0.4).toFixed(0)} km`,
            pairInstability: mass > 130 ? 'Pair-instability supernova possible - no remnant' : 'No',
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'endpoint',
              initialMass: `${mass} M☉`,
              endpoint,
              massLimits: {
                brownDwarf: '< 0.08 M☉',
                whiteDwarf: '0.08 - 8 M☉',
                neutronStar: '8 - 25 M☉',
                blackHole: '> 25 M☉',
                chandrasekharLimit: `${CHANDRASEKHAR_LIMIT} M☉ (white dwarf max)`,
                tovLimit: `~${TOV_LIMIT} M☉ (neutron star max)`,
              },
            },
            null,
            2
          ),
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              tool: 'Stellar Evolution',
              description: 'Models stellar evolution, HR diagrams, and stellar physics',

              operations: [
                'evolve: Full evolutionary track for a given mass',
                'classify: Spectral and luminosity classification',
                'hr_diagram: Generate HR diagram with reference stars',
                'properties: Calculate stellar properties from mass',
                'lifetime: Main sequence lifetime calculations',
                'endpoint: Determine final evolutionary state',
                'info: This documentation',
              ],

              keyRelations: {
                massLuminosity: 'L ∝ M^(3.5-4) for main sequence',
                massRadius: 'R ∝ M^(0.57-0.8) for main sequence',
                stefanBoltzmann: 'L = 4πR²σT⁴',
                lifetime: 'τ ∝ M/L × 10^10 years',
              },

              spectralSequence: 'O B A F G K M (hot to cool)',
              luminosityClasses: 'I (supergiant) to VII (white dwarf)',

              examples: [
                { operation: 'evolve', mass: 1.0 },
                { operation: 'classify', temperature: 10000, luminosity: 100 },
                { operation: 'endpoint', mass: 20 },
              ],

              constants: {
                solarMass: `${SOLAR_MASS} kg`,
                solarLuminosity: `${SOLAR_LUMINOSITY} W`,
                solarRadius: `${SOLAR_RADIUS} m`,
                solarTemperature: `${SOLAR_TEMPERATURE} K`,
              },
            },
            null,
            2
          ),
        };
      }

      default:
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              error: `Unknown operation: ${operation}`,
              validOperations: [
                'evolve',
                'classify',
                'hr_diagram',
                'properties',
                'lifetime',
                'endpoint',
                'info',
              ],
            },
            null,
            2
          ),
          isError: true,
        };
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return {
      toolCallId: id,
      content: `Error in stellar evolution: ${errorMessage}`,
      isError: true,
    };
  }
}

export function isstellarevolutionAvailable(): boolean {
  return true;
}
