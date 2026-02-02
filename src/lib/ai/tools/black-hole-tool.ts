/**
 * BLACK-HOLE TOOL
 * Real black hole physics calculations
 * Schwarzschild, Kerr, Hawking radiation, accretion disks, tidal forces
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Physical constants
const G = 6.67430e-11;  // Gravitational constant (m³/kg/s²)
const c = 2.99792458e8; // Speed of light (m/s)
const h = 6.62607015e-34; // Planck constant (J·s)
const hbar = h / (2 * Math.PI); // Reduced Planck constant
const k_B = 1.380649e-23; // Boltzmann constant (J/K)
const sigma = 5.670374419e-8; // Stefan-Boltzmann constant (W/m²/K⁴)
const M_sun = 1.989e30; // Solar mass (kg)

export const blackholeTool: UnifiedTool = {
  name: 'black_hole',
  description: 'Black hole physics - Schwarzschild radius, Kerr metrics, Hawking radiation, accretion disks, tidal forces',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['schwarzschild', 'kerr', 'hawking', 'accretion', 'tidal', 'photon_sphere', 'isco', 'info'],
        description: 'Calculation type'
      },
      mass: { type: 'number', description: 'Black hole mass in solar masses' },
      spin: { type: 'number', description: 'Dimensionless spin parameter (0 to 1) for Kerr black holes' },
      distance: { type: 'number', description: 'Distance from black hole center in Schwarzschild radii' },
      accretion_rate: { type: 'number', description: 'Mass accretion rate in solar masses per year' },
      object_size: { type: 'number', description: 'Size of infalling object in meters (for tidal calculations)' }
    },
    required: ['operation']
  }
};

interface BlackHoleArgs {
  operation: string;
  mass?: number;
  spin?: number;
  distance?: number;
  accretion_rate?: number;
  object_size?: number;
}

/**
 * Calculate Schwarzschild radius (event horizon for non-rotating black hole)
 * r_s = 2GM/c²
 */
function schwarzschildRadius(massSolar: number): number {
  const massKg = massSolar * M_sun;
  return (2 * G * massKg) / (c * c);
}

/**
 * Calculate Schwarzschild black hole properties
 */
function calculateSchwarzschild(massSolar: number) {
  const massKg = massSolar * M_sun;
  const r_s = schwarzschildRadius(massSolar);

  // Surface gravity at event horizon
  // κ = c⁴/(4GM) for Schwarzschild
  const surfaceGravity = (c * c * c * c) / (4 * G * massKg);

  // Event horizon area
  const area = 4 * Math.PI * r_s * r_s;

  // Bekenstein-Hawking entropy S = k_B * c³ * A / (4 * G * ħ)
  const entropy = (k_B * c * c * c * area) / (4 * G * hbar);

  // Time dilation at distance r: dt_far/dt_local = 1/sqrt(1 - r_s/r)
  // At 2*r_s: factor = 1/sqrt(0.5) ≈ 1.414

  return {
    schwarzschild_radius_m: r_s,
    schwarzschild_radius_km: r_s / 1000,
    schwarzschild_radius_au: r_s / 1.496e11,
    event_horizon_area_m2: area,
    surface_gravity_m_s2: surfaceGravity,
    entropy_joules_per_kelvin: entropy,
    entropy_bits: entropy / (k_B * Math.log(2)),
    mass_kg: massKg,
    mass_solar: massSolar,
    formulas: {
      schwarzschild_radius: 'r_s = 2GM/c²',
      surface_gravity: 'κ = c⁴/(4GM)',
      entropy: 'S = k_B·c³·A/(4·G·ħ)'
    }
  };
}

/**
 * Calculate Kerr black hole properties (rotating black hole)
 * Using Boyer-Lindquist coordinates
 */
function calculateKerr(massSolar: number, spinParam: number) {
  const massKg = massSolar * M_sun;
  const r_s = schwarzschildRadius(massSolar);

  // Spin parameter a = J/(Mc), dimensionless: a* = a·c/(GM) = spin (0 to 1)
  const a = spinParam * G * massKg / c; // in meters

  // Outer event horizon: r+ = GM/c² + sqrt((GM/c²)² - a²)
  const rg = G * massKg / (c * c); // gravitational radius
  const r_plus = rg + Math.sqrt(rg * rg - a * a / (c * c));
  const r_minus = rg - Math.sqrt(rg * rg - a * a / (c * c));

  // Ergosphere outer boundary at equator: r_ergo = GM/c² + sqrt((GM/c²)² - a²cos²θ)
  // At equator (θ = π/2), cos²θ = 0, so r_ergo = 2*rg = r_s
  const r_ergosphere_equator = r_s;

  // Angular velocity of event horizon
  const omega_H = (a / (c * c)) / (2 * r_plus);

  // Irreducible mass: M_irr = M * sqrt((1 + sqrt(1-a*²))/2)
  const M_irr = massKg * Math.sqrt((1 + Math.sqrt(1 - spinParam * spinParam)) / 2);

  // Maximum extractable energy via Penrose process
  const extractableEnergy = (massKg - M_irr) * c * c;
  const extractableFraction = 1 - M_irr / massKg;

  return {
    spin_parameter: spinParam,
    outer_horizon_m: r_plus,
    inner_horizon_m: r_minus,
    ergosphere_equator_m: r_ergosphere_equator,
    schwarzschild_radius_m: r_s,
    angular_momentum_kg_m2_s: spinParam * G * massKg * massKg / c,
    horizon_angular_velocity_rad_s: omega_H,
    irreducible_mass_kg: M_irr,
    extractable_energy_joules: extractableEnergy,
    extractable_fraction: extractableFraction,
    max_efficiency_percent: extractableFraction * 100,
    is_extremal: spinParam >= 0.998,
    formulas: {
      outer_horizon: 'r+ = GM/c² + √((GM/c²)² - a²)',
      ergosphere: 'r_ergo = GM/c² + √((GM/c²)² - a²cos²θ)',
      extractable_energy: 'E = (M - M_irr)c²'
    }
  };
}

/**
 * Calculate Hawking radiation properties
 * Black holes emit thermal radiation due to quantum effects
 */
function calculateHawking(massSolar: number) {
  const massKg = massSolar * M_sun;
  const r_s = schwarzschildRadius(massSolar);

  // Hawking temperature: T = ħc³/(8πGMk_B)
  const T_hawking = (hbar * c * c * c) / (8 * Math.PI * G * massKg * k_B);

  // Luminosity: L = ħc⁶/(15360πG²M²)
  const L_hawking = (hbar * Math.pow(c, 6)) / (15360 * Math.PI * G * G * massKg * massKg);

  // Evaporation time: t = 5120πG²M³/(ħc⁴)
  const t_evap = (5120 * Math.PI * G * G * Math.pow(massKg, 3)) / (hbar * Math.pow(c, 4));

  // Page time (when half the entropy is radiated)
  const t_page = t_evap / 2;

  // Peak wavelength (Wien's law): λ_peak = 2.898e-3 / T
  const lambda_peak = 2.898e-3 / T_hawking;

  // Characteristic photon energy
  const E_photon = k_B * T_hawking;

  return {
    hawking_temperature_kelvin: T_hawking,
    hawking_luminosity_watts: L_hawking,
    evaporation_time_seconds: t_evap,
    evaporation_time_years: t_evap / (365.25 * 24 * 3600),
    page_time_seconds: t_page,
    peak_wavelength_m: lambda_peak,
    characteristic_photon_energy_joules: E_photon,
    characteristic_photon_energy_eV: E_photon / 1.602e-19,
    is_cosmologically_significant: t_evap > 4.35e17, // > age of universe
    comparison: {
      stellar_bh_temp: 'T ≈ 6e-8 K for 10 M☉ (colder than CMB)',
      primordial_bh: 'M ≈ 5e11 kg would be evaporating now'
    },
    formulas: {
      temperature: 'T = ħc³/(8πGMk_B)',
      luminosity: 'L = ħc⁶/(15360πG²M²)',
      evaporation_time: 't = 5120πG²M³/(ħc⁴)'
    }
  };
}

/**
 * Calculate accretion disk properties
 * Standard thin disk model (Shakura-Sunyaev)
 */
function calculateAccretion(massSolar: number, accretionRateSolarPerYear: number) {
  const massKg = massSolar * M_sun;
  const r_s = schwarzschildRadius(massSolar);
  const r_isco = 3 * r_s; // ISCO for Schwarzschild

  // Convert accretion rate to kg/s
  const mdot = accretionRateSolarPerYear * M_sun / (365.25 * 24 * 3600);

  // Eddington luminosity: L_Edd = 4πGMm_p·c/σ_T
  const m_p = 1.6726e-27; // proton mass
  const sigma_T = 6.6524e-29; // Thomson cross-section
  const L_edd = (4 * Math.PI * G * massKg * m_p * c) / sigma_T;

  // Eddington accretion rate
  const eta = 0.1; // radiative efficiency ~10% for Schwarzschild
  const mdot_edd = L_edd / (eta * c * c);

  // Actual luminosity
  const L_actual = eta * mdot * c * c;
  const eddington_ratio = L_actual / L_edd;

  // Inner disk temperature (at ISCO)
  // T_inner ≈ (3GMṁ/(8πσr³))^(1/4)
  const T_inner = Math.pow((3 * G * massKg * mdot) / (8 * Math.PI * sigma * Math.pow(r_isco, 3)), 0.25);

  // Peak wavelength
  const lambda_peak = 2.898e-3 / T_inner;

  return {
    luminosity_watts: L_actual,
    luminosity_solar: L_actual / 3.828e26,
    eddington_luminosity_watts: L_edd,
    eddington_ratio: eddington_ratio,
    is_super_eddington: eddington_ratio > 1,
    accretion_rate_kg_s: mdot,
    eddington_accretion_rate_kg_s: mdot_edd,
    radiative_efficiency: eta,
    inner_disk_temperature_K: T_inner,
    peak_wavelength_m: lambda_peak,
    spectrum_peak: lambda_peak < 1e-8 ? 'X-ray' : lambda_peak < 4e-7 ? 'UV' : 'Visible/IR',
    isco_radius_m: r_isco,
    schwarzschild_radius_m: r_s,
    formulas: {
      eddington_luminosity: 'L_Edd = 4πGMm_p·c/σ_T',
      disk_luminosity: 'L = η·ṁ·c²',
      disk_temperature: 'T ∝ (GMṁ/r³)^(1/4)'
    }
  };
}

/**
 * Calculate tidal forces (spaghettification)
 */
function calculateTidal(massSolar: number, distance: number, objectSize: number) {
  const massKg = massSolar * M_sun;
  const r_s = schwarzschildRadius(massSolar);
  const r = distance * r_s; // actual distance in meters

  // Tidal acceleration difference across object
  // Δa = 2GMΔr/r³
  const tidal_accel = (2 * G * massKg * objectSize) / (r * r * r);

  // Compare to human tolerance (~10g ≈ 100 m/s²)
  const g_force = tidal_accel / 9.81;

  // Tidal radius (where tidal forces overcome object's self-gravity)
  // For a human (density ~1000 kg/m³, size ~2m)
  const rho_object = 1000; // kg/m³
  const r_tidal = Math.pow((massKg / (4 * Math.PI * rho_object / 3)), 1/3);

  // Radial stretching force on 70kg human
  const human_mass = 70;
  const stretch_force = tidal_accel * human_mass;

  // Time to reach singularity from event horizon (proper time)
  // τ = πGM/c³ for radial infall from r_s
  const proper_time_from_horizon = Math.PI * G * massKg / (c * c * c);

  return {
    distance_schwarzschild_radii: distance,
    distance_m: r,
    tidal_acceleration_m_s2: tidal_accel,
    tidal_g_force: g_force,
    is_lethal: g_force > 10,
    stretch_force_on_human_N: stretch_force,
    tidal_radius_m: r_tidal,
    tidal_radius_schwarzschild: r_tidal / r_s,
    proper_time_to_singularity_s: proper_time_from_horizon,
    spaghettification_zone: distance < r_tidal / r_s ? 'INSIDE' : 'OUTSIDE',
    survival_note: massSolar > 1e6 ?
      'Supermassive BH: survivable crossing of event horizon' :
      'Stellar BH: fatal tidal forces before horizon',
    formulas: {
      tidal_acceleration: 'Δa = 2GMΔr/r³',
      tidal_radius: 'r_t = (M/ρ)^(1/3)'
    }
  };
}

/**
 * Calculate photon sphere radius
 */
function calculatePhotonSphere(massSolar: number, spinParam: number = 0) {
  const r_s = schwarzschildRadius(massSolar);

  if (spinParam === 0) {
    // Schwarzschild: r_ph = 1.5 * r_s
    return {
      photon_sphere_radius_m: 1.5 * r_s,
      photon_sphere_schwarzschild: 1.5,
      shadow_radius_m: Math.sqrt(27) * r_s / 2, // ≈ 2.6 r_s
      description: 'Unstable circular photon orbits'
    };
  } else {
    // Kerr: prograde and retrograde orbits differ
    const rg = r_s / 2;
    // Approximate formulas
    const r_ph_prograde = 2 * rg * (1 + Math.cos((2/3) * Math.acos(-spinParam)));
    const r_ph_retrograde = 2 * rg * (1 + Math.cos((2/3) * Math.acos(spinParam)));

    return {
      photon_sphere_prograde_m: r_ph_prograde,
      photon_sphere_retrograde_m: r_ph_retrograde,
      schwarzschild_radius_m: r_s,
      spin_parameter: spinParam,
      description: 'Kerr black hole has different prograde/retrograde photon orbits'
    };
  }
}

/**
 * Calculate Innermost Stable Circular Orbit (ISCO)
 */
function calculateISCO(massSolar: number, spinParam: number = 0) {
  const r_s = schwarzschildRadius(massSolar);
  const rg = r_s / 2;

  if (spinParam === 0) {
    // Schwarzschild: r_isco = 6 * rg = 3 * r_s
    const r_isco = 3 * r_s;
    const orbital_velocity = c / Math.sqrt(6);
    const orbital_period = 2 * Math.PI * r_isco / orbital_velocity;

    return {
      isco_radius_m: r_isco,
      isco_schwarzschild_radii: 3,
      orbital_velocity_m_s: orbital_velocity,
      orbital_velocity_c: orbital_velocity / c,
      orbital_period_s: orbital_period,
      binding_energy_fraction: 1 - Math.sqrt(8/9), // ~5.7%
      description: 'Innermost stable circular orbit for Schwarzschild'
    };
  } else {
    // Kerr ISCO (prograde)
    const Z1 = 1 + Math.pow(1 - spinParam * spinParam, 1/3) *
               (Math.pow(1 + spinParam, 1/3) + Math.pow(1 - spinParam, 1/3));
    const Z2 = Math.sqrt(3 * spinParam * spinParam + Z1 * Z1);
    const r_isco_prograde = rg * (3 + Z2 - Math.sqrt((3 - Z1) * (3 + Z1 + 2 * Z2)));
    const r_isco_retrograde = rg * (3 + Z2 + Math.sqrt((3 - Z1) * (3 + Z1 + 2 * Z2)));

    // Binding energy at ISCO
    const E_isco_prograde = Math.sqrt(1 - 2 * rg / (3 * r_isco_prograde));
    const efficiency_prograde = 1 - E_isco_prograde;

    return {
      isco_prograde_m: r_isco_prograde,
      isco_retrograde_m: r_isco_retrograde,
      isco_prograde_rg: r_isco_prograde / rg,
      isco_retrograde_rg: r_isco_retrograde / rg,
      radiative_efficiency_prograde: efficiency_prograde,
      spin_parameter: spinParam,
      note: spinParam > 0.9 ? 'High spin: efficiency can exceed 30%' : 'Moderate spin',
      description: 'Kerr ISCO depends on spin direction'
    };
  }
}

export async function executeblackhole(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args: BlackHoleArgs = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, mass = 10, spin = 0, distance = 5, accretion_rate = 1e-8, object_size = 2 } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'schwarzschild':
        result = {
          operation: 'schwarzschild',
          input: { mass_solar: mass },
          ...calculateSchwarzschild(mass)
        };
        break;

      case 'kerr':
        if (spin < 0 || spin > 1) {
          throw new Error('Spin parameter must be between 0 and 1');
        }
        result = {
          operation: 'kerr',
          input: { mass_solar: mass, spin_parameter: spin },
          ...calculateKerr(mass, spin)
        };
        break;

      case 'hawking':
        result = {
          operation: 'hawking_radiation',
          input: { mass_solar: mass },
          ...calculateHawking(mass)
        };
        break;

      case 'accretion':
        result = {
          operation: 'accretion_disk',
          input: { mass_solar: mass, accretion_rate_solar_per_year: accretion_rate },
          ...calculateAccretion(mass, accretion_rate)
        };
        break;

      case 'tidal':
        result = {
          operation: 'tidal_forces',
          input: { mass_solar: mass, distance_schwarzschild_radii: distance, object_size_m: object_size },
          ...calculateTidal(mass, distance, object_size)
        };
        break;

      case 'photon_sphere':
        result = {
          operation: 'photon_sphere',
          input: { mass_solar: mass, spin_parameter: spin },
          ...calculatePhotonSphere(mass, spin)
        };
        break;

      case 'isco':
        result = {
          operation: 'isco',
          input: { mass_solar: mass, spin_parameter: spin },
          ...calculateISCO(mass, spin)
        };
        break;

      case 'info':
      default:
        result = {
          operation: 'info',
          description: 'Black hole physics calculator',
          operations: {
            schwarzschild: 'Calculate Schwarzschild (non-rotating) black hole properties',
            kerr: 'Calculate Kerr (rotating) black hole properties',
            hawking: 'Calculate Hawking radiation temperature and evaporation time',
            accretion: 'Calculate accretion disk luminosity and temperature',
            tidal: 'Calculate tidal forces and spaghettification effects',
            photon_sphere: 'Calculate photon sphere radius',
            isco: 'Calculate innermost stable circular orbit'
          },
          parameters: {
            mass: 'Black hole mass in solar masses (default: 10)',
            spin: 'Dimensionless spin parameter 0-1 for Kerr (default: 0)',
            distance: 'Distance in Schwarzschild radii for tidal calc (default: 5)',
            accretion_rate: 'Mass accretion rate in M☉/year (default: 1e-8)',
            object_size: 'Object size in meters for tidal calc (default: 2)'
          },
          constants_used: {
            G: '6.67430e-11 m³/kg/s²',
            c: '2.998e8 m/s',
            M_sun: '1.989e30 kg'
          },
          examples: [
            { operation: 'schwarzschild', mass: 10, description: '10 solar mass stellar black hole' },
            { operation: 'kerr', mass: 4e6, spin: 0.9, description: 'Sgr A* like supermassive black hole' },
            { operation: 'hawking', mass: 1e-19, description: 'Primordial black hole evaporating now' }
          ]
        };
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isblackholeAvailable(): boolean { return true; }
