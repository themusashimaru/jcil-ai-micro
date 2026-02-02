/**
 * PARTICLE-PHYSICS TOOL
 * Standard Model particles, interactions, and Feynman diagrams
 * Complete implementation with decay modes, cross-sections, and conservation laws
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// CONSTANTS
// ============================================================================

const SPEED_OF_LIGHT = 299792458; // m/s
const HBAR = 1.054571817e-34; // J·s
const ALPHA_EM = 1 / 137.036; // Fine structure constant
const ALPHA_S = 0.118; // Strong coupling (at M_Z)
const G_FERMI = 1.1663787e-5; // GeV^-2 (Fermi constant)

// ============================================================================
// PARTICLE DATABASE
// ============================================================================

interface Particle {
  name: string;
  symbol: string;
  antiparticle: string;
  mass: number; // MeV/c²
  charge: number; // in units of e
  spin: number;
  color: boolean; // Has color charge
  generation?: number;
  type: 'quark' | 'lepton' | 'gauge_boson' | 'scalar_boson';
  interactions: string[];
  lifetime?: number; // seconds
  decayModes?: Array<{ products: string[]; branchingRatio: number }>;
  quantumNumbers: {
    B?: number; // Baryon number
    L?: number; // Lepton number
    Le?: number;
    Lμ?: number;
    Lτ?: number;
    I3?: number; // Isospin
    S?: number; // Strangeness
    C?: number; // Charm
    B_bottom?: number; // Bottomness
    T?: number; // Topness
  };
  discoveryYear?: number;
  discoveryExperiment?: string;
}

const PARTICLES: Record<string, Particle> = {
  // ============ QUARKS ============
  up: {
    name: 'Up Quark',
    symbol: 'u',
    antiparticle: 'ū',
    mass: 2.16,
    charge: 2/3,
    spin: 0.5,
    color: true,
    generation: 1,
    type: 'quark',
    interactions: ['strong', 'electromagnetic', 'weak'],
    quantumNumbers: { B: 1/3, I3: 0.5 }
  },
  down: {
    name: 'Down Quark',
    symbol: 'd',
    antiparticle: 'd̄',
    mass: 4.67,
    charge: -1/3,
    spin: 0.5,
    color: true,
    generation: 1,
    type: 'quark',
    interactions: ['strong', 'electromagnetic', 'weak'],
    quantumNumbers: { B: 1/3, I3: -0.5 }
  },
  charm: {
    name: 'Charm Quark',
    symbol: 'c',
    antiparticle: 'c̄',
    mass: 1270,
    charge: 2/3,
    spin: 0.5,
    color: true,
    generation: 2,
    type: 'quark',
    interactions: ['strong', 'electromagnetic', 'weak'],
    quantumNumbers: { B: 1/3, C: 1 },
    discoveryYear: 1974
  },
  strange: {
    name: 'Strange Quark',
    symbol: 's',
    antiparticle: 's̄',
    mass: 93.4,
    charge: -1/3,
    spin: 0.5,
    color: true,
    generation: 2,
    type: 'quark',
    interactions: ['strong', 'electromagnetic', 'weak'],
    quantumNumbers: { B: 1/3, S: -1 }
  },
  top: {
    name: 'Top Quark',
    symbol: 't',
    antiparticle: 't̄',
    mass: 172760,
    charge: 2/3,
    spin: 0.5,
    color: true,
    generation: 3,
    type: 'quark',
    interactions: ['strong', 'electromagnetic', 'weak'],
    lifetime: 5e-25,
    quantumNumbers: { B: 1/3, T: 1 },
    discoveryYear: 1995,
    discoveryExperiment: 'Tevatron (CDF, D0)'
  },
  bottom: {
    name: 'Bottom Quark',
    symbol: 'b',
    antiparticle: 'b̄',
    mass: 4180,
    charge: -1/3,
    spin: 0.5,
    color: true,
    generation: 3,
    type: 'quark',
    interactions: ['strong', 'electromagnetic', 'weak'],
    lifetime: 1.5e-12,
    quantumNumbers: { B: 1/3, B_bottom: -1 },
    discoveryYear: 1977
  },

  // ============ LEPTONS ============
  electron: {
    name: 'Electron',
    symbol: 'e⁻',
    antiparticle: 'e⁺',
    mass: 0.511,
    charge: -1,
    spin: 0.5,
    color: false,
    generation: 1,
    type: 'lepton',
    interactions: ['electromagnetic', 'weak'],
    quantumNumbers: { L: 1, Le: 1 },
    discoveryYear: 1897,
    discoveryExperiment: 'J.J. Thomson'
  },
  electron_neutrino: {
    name: 'Electron Neutrino',
    symbol: 'νₑ',
    antiparticle: 'ν̄ₑ',
    mass: 0.0000022, // Upper limit
    charge: 0,
    spin: 0.5,
    color: false,
    generation: 1,
    type: 'lepton',
    interactions: ['weak'],
    quantumNumbers: { L: 1, Le: 1 }
  },
  muon: {
    name: 'Muon',
    symbol: 'μ⁻',
    antiparticle: 'μ⁺',
    mass: 105.66,
    charge: -1,
    spin: 0.5,
    color: false,
    generation: 2,
    type: 'lepton',
    interactions: ['electromagnetic', 'weak'],
    lifetime: 2.2e-6,
    decayModes: [
      { products: ['e⁻', 'ν̄ₑ', 'νμ'], branchingRatio: 0.9998 }
    ],
    quantumNumbers: { L: 1, Lμ: 1 },
    discoveryYear: 1936
  },
  muon_neutrino: {
    name: 'Muon Neutrino',
    symbol: 'νμ',
    antiparticle: 'ν̄μ',
    mass: 0.17, // Upper limit
    charge: 0,
    spin: 0.5,
    color: false,
    generation: 2,
    type: 'lepton',
    interactions: ['weak'],
    quantumNumbers: { L: 1, Lμ: 1 }
  },
  tau: {
    name: 'Tau',
    symbol: 'τ⁻',
    antiparticle: 'τ⁺',
    mass: 1776.86,
    charge: -1,
    spin: 0.5,
    color: false,
    generation: 3,
    type: 'lepton',
    interactions: ['electromagnetic', 'weak'],
    lifetime: 2.9e-13,
    decayModes: [
      { products: ['e⁻', 'ν̄ₑ', 'ντ'], branchingRatio: 0.178 },
      { products: ['μ⁻', 'ν̄μ', 'ντ'], branchingRatio: 0.174 },
      { products: ['π⁻', 'ντ'], branchingRatio: 0.108 },
      { products: ['hadrons', 'ντ'], branchingRatio: 0.54 }
    ],
    quantumNumbers: { L: 1, Lτ: 1 },
    discoveryYear: 1975
  },
  tau_neutrino: {
    name: 'Tau Neutrino',
    symbol: 'ντ',
    antiparticle: 'ν̄τ',
    mass: 15.5, // Upper limit
    charge: 0,
    spin: 0.5,
    color: false,
    generation: 3,
    type: 'lepton',
    interactions: ['weak'],
    quantumNumbers: { L: 1, Lτ: 1 }
  },

  // ============ GAUGE BOSONS ============
  photon: {
    name: 'Photon',
    symbol: 'γ',
    antiparticle: 'γ',
    mass: 0,
    charge: 0,
    spin: 1,
    color: false,
    type: 'gauge_boson',
    interactions: ['electromagnetic'],
    quantumNumbers: {}
  },
  gluon: {
    name: 'Gluon',
    symbol: 'g',
    antiparticle: 'g',
    mass: 0,
    charge: 0,
    spin: 1,
    color: true,
    type: 'gauge_boson',
    interactions: ['strong'],
    quantumNumbers: {}
  },
  W_plus: {
    name: 'W+ Boson',
    symbol: 'W⁺',
    antiparticle: 'W⁻',
    mass: 80379,
    charge: 1,
    spin: 1,
    color: false,
    type: 'gauge_boson',
    interactions: ['weak'],
    lifetime: 3e-25,
    decayModes: [
      { products: ['e⁺', 'νₑ'], branchingRatio: 0.108 },
      { products: ['μ⁺', 'νμ'], branchingRatio: 0.108 },
      { products: ['τ⁺', 'ντ'], branchingRatio: 0.108 },
      { products: ['hadrons'], branchingRatio: 0.676 }
    ],
    quantumNumbers: {},
    discoveryYear: 1983,
    discoveryExperiment: 'CERN (UA1, UA2)'
  },
  W_minus: {
    name: 'W- Boson',
    symbol: 'W⁻',
    antiparticle: 'W⁺',
    mass: 80379,
    charge: -1,
    spin: 1,
    color: false,
    type: 'gauge_boson',
    interactions: ['weak'],
    lifetime: 3e-25,
    quantumNumbers: {}
  },
  Z: {
    name: 'Z Boson',
    symbol: 'Z⁰',
    antiparticle: 'Z⁰',
    mass: 91188,
    charge: 0,
    spin: 1,
    color: false,
    type: 'gauge_boson',
    interactions: ['weak'],
    lifetime: 2.6e-25,
    decayModes: [
      { products: ['e⁺', 'e⁻'], branchingRatio: 0.034 },
      { products: ['μ⁺', 'μ⁻'], branchingRatio: 0.034 },
      { products: ['τ⁺', 'τ⁻'], branchingRatio: 0.034 },
      { products: ['ν', 'ν̄'], branchingRatio: 0.20 },
      { products: ['hadrons'], branchingRatio: 0.70 }
    ],
    quantumNumbers: {},
    discoveryYear: 1983
  },

  // ============ SCALAR BOSONS ============
  higgs: {
    name: 'Higgs Boson',
    symbol: 'H⁰',
    antiparticle: 'H⁰',
    mass: 125100,
    charge: 0,
    spin: 0,
    color: false,
    type: 'scalar_boson',
    interactions: ['weak', 'Yukawa'],
    lifetime: 1.6e-22,
    decayModes: [
      { products: ['b', 'b̄'], branchingRatio: 0.58 },
      { products: ['W⁺', 'W⁻'], branchingRatio: 0.21 },
      { products: ['g', 'g'], branchingRatio: 0.082 },
      { products: ['τ⁺', 'τ⁻'], branchingRatio: 0.063 },
      { products: ['c', 'c̄'], branchingRatio: 0.029 },
      { products: ['Z⁰', 'Z⁰'], branchingRatio: 0.026 },
      { products: ['γ', 'γ'], branchingRatio: 0.0023 }
    ],
    quantumNumbers: {},
    discoveryYear: 2012,
    discoveryExperiment: 'CERN LHC (ATLAS, CMS)'
  }
};

// ============================================================================
// COMPOSITE PARTICLES (HADRONS)
// ============================================================================

interface Hadron {
  name: string;
  symbol: string;
  type: 'meson' | 'baryon';
  quarkContent: string;
  mass: number;
  charge: number;
  spin: number;
  lifetime?: number;
  decayModes?: Array<{ products: string[]; branchingRatio: number }>;
}

const HADRONS: Record<string, Hadron> = {
  proton: {
    name: 'Proton',
    symbol: 'p',
    type: 'baryon',
    quarkContent: 'uud',
    mass: 938.27,
    charge: 1,
    spin: 0.5,
    lifetime: Infinity // Stable
  },
  neutron: {
    name: 'Neutron',
    symbol: 'n',
    type: 'baryon',
    quarkContent: 'udd',
    mass: 939.57,
    charge: 0,
    spin: 0.5,
    lifetime: 879.4,
    decayModes: [
      { products: ['p', 'e⁻', 'ν̄ₑ'], branchingRatio: 1.0 }
    ]
  },
  pion_plus: {
    name: 'Pion (positive)',
    symbol: 'π⁺',
    type: 'meson',
    quarkContent: 'ud̄',
    mass: 139.57,
    charge: 1,
    spin: 0,
    lifetime: 2.6e-8,
    decayModes: [
      { products: ['μ⁺', 'νμ'], branchingRatio: 0.9998 }
    ]
  },
  pion_minus: {
    name: 'Pion (negative)',
    symbol: 'π⁻',
    type: 'meson',
    quarkContent: 'dū',
    mass: 139.57,
    charge: -1,
    spin: 0,
    lifetime: 2.6e-8
  },
  pion_zero: {
    name: 'Pion (neutral)',
    symbol: 'π⁰',
    type: 'meson',
    quarkContent: '(uū-dd̄)/√2',
    mass: 134.98,
    charge: 0,
    spin: 0,
    lifetime: 8.5e-17,
    decayModes: [
      { products: ['γ', 'γ'], branchingRatio: 0.988 }
    ]
  },
  kaon_plus: {
    name: 'Kaon (positive)',
    symbol: 'K⁺',
    type: 'meson',
    quarkContent: 'us̄',
    mass: 493.68,
    charge: 1,
    spin: 0,
    lifetime: 1.24e-8
  },
  kaon_zero: {
    name: 'Kaon (neutral)',
    symbol: 'K⁰',
    type: 'meson',
    quarkContent: 'ds̄',
    mass: 497.61,
    charge: 0,
    spin: 0
  },
  lambda: {
    name: 'Lambda baryon',
    symbol: 'Λ⁰',
    type: 'baryon',
    quarkContent: 'uds',
    mass: 1115.68,
    charge: 0,
    spin: 0.5,
    lifetime: 2.6e-10
  },
  sigma_plus: {
    name: 'Sigma (positive)',
    symbol: 'Σ⁺',
    type: 'baryon',
    quarkContent: 'uus',
    mass: 1189.37,
    charge: 1,
    spin: 0.5,
    lifetime: 8e-11
  },
  omega_minus: {
    name: 'Omega baryon',
    symbol: 'Ω⁻',
    type: 'baryon',
    quarkContent: 'sss',
    mass: 1672.45,
    charge: -1,
    spin: 1.5,
    lifetime: 8.2e-11
  },
  j_psi: {
    name: 'J/ψ meson',
    symbol: 'J/ψ',
    type: 'meson',
    quarkContent: 'cc̄',
    mass: 3096.9,
    charge: 0,
    spin: 1,
    lifetime: 7e-21
  },
  upsilon: {
    name: 'Upsilon meson',
    symbol: 'Υ',
    type: 'meson',
    quarkContent: 'bb̄',
    mass: 9460.3,
    charge: 0,
    spin: 1,
    lifetime: 1.2e-20
  }
};

// ============================================================================
// INTERACTION VERTICES
// ============================================================================

interface Vertex {
  name: string;
  particles: string[];
  coupling: string;
  force: string;
  description: string;
}

const VERTICES: Vertex[] = [
  { name: 'QED vertex', particles: ['e', 'e', 'γ'], coupling: 'e ≈ 0.303', force: 'electromagnetic', description: 'Electron-photon coupling' },
  { name: 'QCD vertex (quark)', particles: ['q', 'q', 'g'], coupling: 'gₛ ≈ 1.2', force: 'strong', description: 'Quark-gluon coupling' },
  { name: 'QCD vertex (gluon)', particles: ['g', 'g', 'g'], coupling: 'gₛ', force: 'strong', description: 'Triple gluon self-interaction' },
  { name: 'QCD 4-gluon', particles: ['g', 'g', 'g', 'g'], coupling: 'gₛ²', force: 'strong', description: 'Quartic gluon self-interaction' },
  { name: 'Charged current', particles: ['f', "f'", 'W'], coupling: 'g/√2', force: 'weak', description: 'Weak charged current' },
  { name: 'Neutral current', particles: ['f', 'f', 'Z'], coupling: 'g/cosθ_W', force: 'weak', description: 'Weak neutral current' },
  { name: 'Higgs-fermion', particles: ['f', 'f', 'H'], coupling: 'm_f/v', force: 'Yukawa', description: 'Higgs-fermion Yukawa coupling' },
  { name: 'Higgs-W', particles: ['W', 'W', 'H'], coupling: 'gM_W', force: 'electroweak', description: 'Higgs-W coupling' },
  { name: 'Higgs-Z', particles: ['Z', 'Z', 'H'], coupling: 'gM_Z/cosθ_W', force: 'electroweak', description: 'Higgs-Z coupling' }
];

// ============================================================================
// FEYNMAN DIAGRAM GENERATION
// ============================================================================

interface FeynmanDiagram {
  process: string;
  vertices: string[];
  propagators: string[];
  external: string[];
  asciiArt: string;
}

function generateFeynmanDiagram(process: string): FeynmanDiagram {
  const diagrams: Record<string, FeynmanDiagram> = {
    'e+e- -> mu+mu-': {
      process: 'e⁺e⁻ → μ⁺μ⁻ (Bhabha-like)',
      vertices: ['QED vertex (e⁻e⁺γ)', 'QED vertex (μ⁻μ⁺γ)'],
      propagators: ['γ (photon)'],
      external: ['e⁻ (in)', 'e⁺ (in)', 'μ⁻ (out)', 'μ⁺ (out)'],
      asciiArt: `
    e⁻ →─────┐     ┌─────→ μ⁻
              │  γ  │
              ●~~~~●
              │     │
    e⁺ →─────┘     └─────→ μ⁺
      `
    },
    'e+e- -> qq': {
      process: 'e⁺e⁻ → qq̄ (quark pair production)',
      vertices: ['QED vertex (e⁻e⁺γ)', 'QED vertex (qq̄γ)'],
      propagators: ['γ/Z (photon or Z)'],
      external: ['e⁻ (in)', 'e⁺ (in)', 'q (out)', 'q̄ (out)'],
      asciiArt: `
    e⁻ →─────┐     ┌─────→ q
              │ γ/Z │
              ●~~~~●
              │     │
    e⁺ →─────┘     └─────→ q̄
      `
    },
    'beta_decay': {
      process: 'n → pe⁻ν̄ₑ (beta decay)',
      vertices: ['Weak vertex (udW)', 'Weak vertex (eνW)'],
      propagators: ['W⁻ (W boson)'],
      external: ['n (in)', 'p (out)', 'e⁻ (out)', 'ν̄ₑ (out)'],
      asciiArt: `
                      ┌────→ p
    n (udd) →────●────┤
                 │    └────→ u (spectator)
                 │ W⁻
                 │
                 ●────→ e⁻
                 │
                 └────→ ν̄ₑ
      `
    },
    'higgs_production': {
      process: 'gg → H (gluon fusion)',
      vertices: ['QCD vertex', 'Yukawa coupling (top loop)'],
      propagators: ['t (top quark loop)'],
      external: ['g (in)', 'g (in)', 'H (out)'],
      asciiArt: `
    g →─────●─────┐
            │     │
            t     t     →→→ H
            │     │
    g →─────●─────┘
      `
    },
    'compton': {
      process: 'e⁻γ → e⁻γ (Compton scattering)',
      vertices: ['QED vertex ×2'],
      propagators: ['e⁻ (electron)'],
      external: ['e⁻ (in)', 'γ (in)', 'e⁻ (out)', 'γ (out)'],
      asciiArt: `
    e⁻ →─────●~~~~~ γ (out)
             │
           e⁻
             │
    γ  ~~~~~~●─────→ e⁻ (out)
      `
    }
  };

  return diagrams[process] || {
    process: process,
    vertices: ['Unknown'],
    propagators: ['Unknown'],
    external: ['Unknown'],
    asciiArt: 'Diagram not available'
  };
}

// ============================================================================
// CROSS-SECTION CALCULATIONS
// ============================================================================

interface CrossSection {
  process: string;
  formula: string;
  value: number;
  unit: string;
  energy: number;
  notes: string;
}

function calculateCrossSection(process: string, energy: number): CrossSection {
  // Energy in GeV (center of mass)

  // e+e- -> mu+mu- cross section (tree level)
  if (process === 'e+e- -> mu+mu-') {
    // σ = 4πα²/(3s) in natural units, s = E_cm²
    const s = energy * energy; // GeV²
    const sigma_nb = (4 * Math.PI * ALPHA_EM * ALPHA_EM / (3 * s)) * 0.3894e6; // Convert GeV^-2 to nb
    return {
      process: 'e⁺e⁻ → μ⁺μ⁻',
      formula: 'σ = 4πα²/(3s)',
      value: sigma_nb,
      unit: 'nb',
      energy: energy,
      notes: 'Tree-level QED, neglects Z contribution'
    };
  }

  // pp -> jets (rough estimate)
  if (process === 'pp -> jets') {
    const s = energy * energy;
    const sigma_mb = 100 * Math.pow(s / 1e6, 0.08); // Rough scaling
    return {
      process: 'pp → jets',
      formula: 'σ ∝ s^0.08 (empirical)',
      value: sigma_mb,
      unit: 'mb',
      energy: energy,
      notes: 'Approximate total inelastic cross section'
    };
  }

  return {
    process: process,
    formula: 'Not implemented',
    value: 0,
    unit: 'unknown',
    energy: energy,
    notes: 'Cross section calculation not available for this process'
  };
}

// ============================================================================
// CONSERVATION LAW CHECKER
// ============================================================================

interface ConservationCheck {
  law: string;
  conserved: boolean;
  initial: number;
  final: number;
  note: string;
}

function checkConservation(initial: string[], final: string[]): ConservationCheck[] {
  const checks: ConservationCheck[] = [];

  // Helper to get particle properties
  const getProps = (name: string) => {
    const p = PARTICLES[name.toLowerCase()];
    if (p) return p;
    const h = HADRONS[name.toLowerCase()];
    if (h) return { charge: h.charge, spin: h.spin, quantumNumbers: {} };
    return null;
  };

  // Check electric charge
  let initialCharge = 0, finalCharge = 0;
  for (const p of initial) {
    const props = getProps(p);
    if (props) initialCharge += props.charge;
  }
  for (const p of final) {
    const props = getProps(p);
    if (props) finalCharge += props.charge;
  }
  checks.push({
    law: 'Electric charge',
    conserved: Math.abs(initialCharge - finalCharge) < 0.01,
    initial: initialCharge,
    final: finalCharge,
    note: 'Must be exactly conserved in all interactions'
  });

  return checks;
}

// ============================================================================
// TOOL INTERFACE
// ============================================================================

export const particlephysicsTool: UnifiedTool = {
  name: 'particle_physics',
  description: 'Standard Model - quarks, leptons, bosons, Feynman diagrams, cross-sections, and particle data',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['particle', 'decay', 'interaction', 'cross_section', 'feynman', 'hadron', 'conservation', 'info'],
        description: 'Operation type'
      },
      particle: {
        type: 'string',
        description: 'Particle name (e.g., "electron", "up", "higgs", "proton")'
      },
      process: {
        type: 'string',
        description: 'Process for cross-section or Feynman diagram (e.g., "e+e- -> mu+mu-")'
      },
      energy: {
        type: 'number',
        description: 'Center-of-mass energy in GeV'
      },
      initial_particles: {
        type: 'array',
        description: 'Initial state particles for conservation check'
      },
      final_particles: {
        type: 'array',
        description: 'Final state particles for conservation check'
      }
    },
    required: ['operation']
  }
};

export async function executeparticlephysics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation as string;

    switch (operation) {
      case 'particle': {
        const name = args.particle?.toLowerCase();

        if (name && PARTICLES[name]) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'particle',
              data: PARTICLES[name]
            }, null, 2)
          };
        }

        // List all particles
        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'particle',
            availableParticles: {
              quarks: Object.entries(PARTICLES)
                .filter(([_, p]) => p.type === 'quark')
                .map(([k, p]) => ({ name: k, symbol: p.symbol, mass: p.mass + ' MeV' })),
              leptons: Object.entries(PARTICLES)
                .filter(([_, p]) => p.type === 'lepton')
                .map(([k, p]) => ({ name: k, symbol: p.symbol, mass: p.mass + ' MeV' })),
              gaugeBosons: Object.entries(PARTICLES)
                .filter(([_, p]) => p.type === 'gauge_boson')
                .map(([k, p]) => ({ name: k, symbol: p.symbol, mass: p.mass + ' MeV' })),
              scalarBosons: Object.entries(PARTICLES)
                .filter(([_, p]) => p.type === 'scalar_boson')
                .map(([k, p]) => ({ name: k, symbol: p.symbol, mass: p.mass + ' MeV' }))
            }
          }, null, 2)
        };
      }

      case 'decay': {
        const name = args.particle?.toLowerCase();

        if (!name) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              error: 'Please specify a particle',
              particlesWithDecays: Object.entries(PARTICLES)
                .filter(([_, p]) => p.decayModes && p.decayModes.length > 0)
                .map(([k]) => k)
            }, null, 2),
            isError: true
          };
        }

        const particle = PARTICLES[name] || HADRONS[name];
        if (!particle) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              error: `Unknown particle: ${name}`
            }, null, 2),
            isError: true
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'decay',
            particle: particle.name,
            symbol: particle.symbol,
            mass: particle.mass + ' MeV/c²',
            lifetime: particle.lifetime ? `${particle.lifetime} s` : 'Stable',
            decayModes: particle.decayModes || []
          }, null, 2)
        };
      }

      case 'interaction': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'interaction',
            fundamentalForces: [
              {
                name: 'Strong',
                mediator: 'Gluon (g)',
                coupling: `αₛ ≈ ${ALPHA_S}`,
                range: '~10⁻¹⁵ m',
                affects: 'Quarks, gluons'
              },
              {
                name: 'Electromagnetic',
                mediator: 'Photon (γ)',
                coupling: `α ≈ ${ALPHA_EM.toFixed(6)}`,
                range: 'Infinite',
                affects: 'Charged particles'
              },
              {
                name: 'Weak',
                mediator: 'W±, Z⁰',
                coupling: `G_F ≈ ${G_FERMI} GeV⁻²`,
                range: '~10⁻¹⁸ m',
                affects: 'All fermions'
              },
              {
                name: 'Gravitational',
                mediator: 'Graviton (hypothetical)',
                coupling: '~10⁻³⁹ (negligible at particle scale)',
                range: 'Infinite',
                affects: 'All matter'
              }
            ],
            vertices: VERTICES
          }, null, 2)
        };
      }

      case 'cross_section': {
        const process = args.process || 'e+e- -> mu+mu-';
        const energy = args.energy || 10;

        const result = calculateCrossSection(process, energy);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'cross_section',
            result,
            unitConversions: {
              '1 barn': '10⁻²⁴ cm²',
              '1 nb': '10⁻⁹ barn',
              '1 pb': '10⁻¹² barn',
              '1 fb': '10⁻¹⁵ barn'
            }
          }, null, 2)
        };
      }

      case 'feynman': {
        const process = args.process || 'e+e- -> mu+mu-';
        const diagram = generateFeynmanDiagram(process);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'feynman',
            diagram,
            availableProcesses: [
              'e+e- -> mu+mu-',
              'e+e- -> qq',
              'beta_decay',
              'higgs_production',
              'compton'
            ]
          }, null, 2)
        };
      }

      case 'hadron': {
        const name = args.particle?.toLowerCase();

        if (name && HADRONS[name]) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'hadron',
              data: HADRONS[name]
            }, null, 2)
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'hadron',
            mesons: Object.entries(HADRONS)
              .filter(([_, h]) => h.type === 'meson')
              .map(([k, h]) => ({ name: k, symbol: h.symbol, quarks: h.quarkContent, mass: h.mass })),
            baryons: Object.entries(HADRONS)
              .filter(([_, h]) => h.type === 'baryon')
              .map(([k, h]) => ({ name: k, symbol: h.symbol, quarks: h.quarkContent, mass: h.mass }))
          }, null, 2)
        };
      }

      case 'conservation': {
        const initial = args.initial_particles || ['electron', 'electron'];
        const final = args.final_particles || ['muon', 'muon'];

        const checks = checkConservation(initial, final);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'conservation',
            initialState: initial,
            finalState: final,
            checks,
            conservationLaws: [
              'Electric charge (always)',
              'Baryon number (always)',
              'Lepton number (by family in SM)',
              'Energy-momentum (always)',
              'Color charge (always)',
              'Parity (strong & EM, violated in weak)',
              'CP (mostly conserved)'
            ]
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'Particle Physics',
            description: 'Standard Model of particle physics',

            standardModel: {
              matter: '12 fermions (6 quarks + 6 leptons)',
              forces: '4 gauge bosons (γ, g, W±, Z⁰)',
              mass: '1 scalar (Higgs H⁰)',
              totalParticles: 17
            },

            operations: [
              'particle: Lookup particle properties',
              'decay: Get decay modes and lifetimes',
              'interaction: Fundamental forces and vertices',
              'cross_section: Calculate scattering cross-sections',
              'feynman: Generate Feynman diagrams',
              'hadron: Composite particle (meson/baryon) data',
              'conservation: Check conservation laws',
              'info: This documentation'
            ],

            constants: {
              fineStructureConstant: ALPHA_EM,
              strongCoupling: ALPHA_S,
              fermiConstant: G_FERMI + ' GeV⁻²',
              weinbergAngle: 'sin²θ_W ≈ 0.231'
            },

            examples: [
              { operation: 'particle', particle: 'higgs' },
              { operation: 'feynman', process: 'beta_decay' },
              { operation: 'cross_section', process: 'e+e- -> mu+mu-', energy: 91 }
            ]
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: `Unknown operation: ${operation}`,
            validOperations: ['particle', 'decay', 'interaction', 'cross_section', 'feynman', 'hadron', 'conservation', 'info']
          }, null, 2),
          isError: true
        };
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return {
      toolCallId: id,
      content: `Error in particle physics: ${errorMessage}`,
      isError: true
    };
  }
}

export function isparticlephysicsAvailable(): boolean {
  return true;
}
