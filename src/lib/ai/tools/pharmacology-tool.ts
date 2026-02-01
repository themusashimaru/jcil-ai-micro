/**
 * PHARMACOLOGY TOOL
 *
 * Drug calculations: pharmacokinetics, dosing, half-life,
 * drug interactions, and bioavailability.
 *
 * Part of TIER MEDICAL - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// PHARMACOKINETIC MODELS
// ============================================================================

function firstOrderElimination(C0: number, ke: number, t: number): number {
  // C(t) = C0 × e^(-ke × t)
  return C0 * Math.exp(-ke * t);
}

function halfLife(ke: number): number {
  // t½ = ln(2) / ke
  return Math.log(2) / ke;
}

function eliminationConstant(halfLifeHours: number): number {
  return Math.log(2) / halfLifeHours;
}

function clearance(dose: number, auc: number): number {
  // CL = Dose / AUC
  return dose / auc;
}

function volumeOfDistribution(dose: number, C0: number): number {
  // Vd = Dose / C0
  return dose / C0;
}

// ============================================================================
// DOSING CALCULATIONS
// ============================================================================

function maintenanceDose(targetConc: number, clearance: number, bioavailability: number, interval: number): number {
  // MD = (Css × CL × τ) / F
  return (targetConc * clearance * interval) / bioavailability;
}

function loadingDose(targetConc: number, Vd: number, bioavailability: number): number {
  // LD = (Css × Vd) / F
  return (targetConc * Vd) / bioavailability;
}

function steadyStateTime(halfLifeHours: number): number {
  // Time to reach ~97% steady state = 5 × t½
  return 5 * halfLifeHours;
}

function peakConcentration(dose: number, Vd: number, bioavailability: number): number {
  return (dose * bioavailability) / Vd;
}

function troughConcentration(Cmax: number, ke: number, interval: number): number {
  return Cmax * Math.exp(-ke * interval);
}

// ============================================================================
// RENAL DOSING
// ============================================================================

function cockcroftGault(age: number, weight: number, creatinine: number, female: boolean): number {
  // CrCl (mL/min) = ((140 - age) × weight) / (72 × SCr) × 0.85 if female
  let crCl = ((140 - age) * weight) / (72 * creatinine);
  if (female) crCl *= 0.85;
  return crCl;
}

function renalDoseAdjustment(normalDose: number, crCl: number): { dose: number; frequency: string } {
  if (crCl >= 50) return { dose: normalDose, frequency: 'Normal' };
  if (crCl >= 30) return { dose: normalDose * 0.75, frequency: 'q12h instead of q8h' };
  if (crCl >= 10) return { dose: normalDose * 0.5, frequency: 'q24h' };
  return { dose: normalDose * 0.25, frequency: 'q48h or avoid' };
}

// ============================================================================
// BODY SURFACE AREA
// ============================================================================

function bodyWeight(heightCm: number, isMale: boolean): { ideal: number; adjusted: number } {
  // Devine formula for IBW
  const heightInches = heightCm / 2.54;
  let ibw: number;
  if (isMale) {
    ibw = 50 + 2.3 * (heightInches - 60);
  } else {
    ibw = 45.5 + 2.3 * (heightInches - 60);
  }
  return { ideal: Math.max(ibw, 0), adjusted: ibw * 1.2 };
}

function bodySurfaceArea(weightKg: number, heightCm: number): number {
  // Mosteller formula
  return Math.sqrt((weightKg * heightCm) / 3600);
}

// ============================================================================
// INFUSION CALCULATIONS
// ============================================================================

function infusionRate(dose: number, concentration: number, time: number): number {
  // mL/hr
  return (dose / concentration) / time * 60;
}

function dripRate(volume: number, timeMinutes: number, dropFactor: number): number {
  // drops/min
  return (volume * dropFactor) / timeMinutes;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const pharmacologyTool: UnifiedTool = {
  name: 'pharmacology',
  description: `Pharmacokinetic and drug dosing calculations.

Operations:
- kinetics: First-order elimination, half-life, clearance
- dosing: Loading dose, maintenance dose, steady state
- renal: Creatinine clearance and renal dose adjustment
- infusion: IV infusion and drip rate calculations
- concentration: Peak and trough concentrations`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['kinetics', 'dosing', 'renal', 'infusion', 'concentration'],
        description: 'Pharmacology operation',
      },
      dose: { type: 'number', description: 'Drug dose (mg)' },
      concentration: { type: 'number', description: 'Drug concentration (mg/L or mg/mL)' },
      half_life: { type: 'number', description: 'Half-life (hours)' },
      time: { type: 'number', description: 'Time (hours)' },
      interval: { type: 'number', description: 'Dosing interval (hours)' },
      clearance: { type: 'number', description: 'Clearance (L/hr)' },
      Vd: { type: 'number', description: 'Volume of distribution (L)' },
      bioavailability: { type: 'number', description: 'Bioavailability (0-1)' },
      target_concentration: { type: 'number', description: 'Target concentration (mg/L)' },
      age: { type: 'number', description: 'Patient age (years)' },
      weight: { type: 'number', description: 'Patient weight (kg)' },
      height: { type: 'number', description: 'Patient height (cm)' },
      creatinine: { type: 'number', description: 'Serum creatinine (mg/dL)' },
      female: { type: 'boolean', description: 'Patient is female' },
      volume: { type: 'number', description: 'Volume to infuse (mL)' },
      infusion_time: { type: 'number', description: 'Infusion time (minutes)' },
      drop_factor: { type: 'number', description: 'Drop factor (drops/mL)' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executePharmacology(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'kinetics': {
        const { dose = 500, concentration = 20, half_life = 6, time = 12 } = args;
        const ke = eliminationConstant(half_life);
        const Vd = volumeOfDistribution(dose, concentration);
        const Ct = firstOrderElimination(concentration, ke, time);

        result = {
          operation: 'kinetics',
          initial_dose_mg: dose,
          initial_concentration_mg_L: concentration,
          half_life_hours: half_life,
          elimination_constant_per_hour: Math.round(ke * 1000) / 1000,
          volume_of_distribution_L: Math.round(Vd * 10) / 10,
          concentration_at_time: {
            time_hours: time,
            concentration_mg_L: Math.round(Ct * 100) / 100,
            percent_remaining: Math.round(Ct / concentration * 100),
          },
          steady_state_time_hours: steadyStateTime(half_life),
        };
        break;
      }

      case 'dosing': {
        const {
          target_concentration = 10,
          clearance = 5,
          Vd = 50,
          bioavailability = 1,
          interval = 8
        } = args;

        const ld = loadingDose(target_concentration, Vd, bioavailability);
        const md = maintenanceDose(target_concentration, clearance, bioavailability, interval);
        const ke = clearance / Vd;
        const t12 = halfLife(ke);

        result = {
          operation: 'dosing',
          target_concentration_mg_L: target_concentration,
          clearance_L_hr: clearance,
          volume_of_distribution_L: Vd,
          bioavailability: bioavailability,
          dosing_interval_hours: interval,
          calculated: {
            loading_dose_mg: Math.round(ld),
            maintenance_dose_mg: Math.round(md),
            half_life_hours: Math.round(t12 * 10) / 10,
            time_to_steady_state_hours: Math.round(steadyStateTime(t12)),
          },
        };
        break;
      }

      case 'renal': {
        const { age = 65, weight = 70, creatinine = 1.5, female = false, dose = 500 } = args;
        const crCl = cockcroftGault(age, weight, creatinine, female);
        const adjustment = renalDoseAdjustment(dose, crCl);

        let renalFunction = 'Normal';
        if (crCl < 15) renalFunction = 'Severe impairment / ESRD';
        else if (crCl < 30) renalFunction = 'Severe impairment';
        else if (crCl < 60) renalFunction = 'Moderate impairment';
        else if (crCl < 90) renalFunction = 'Mild impairment';

        result = {
          operation: 'renal',
          patient: { age, weight_kg: weight, serum_creatinine_mg_dL: creatinine, female },
          creatinine_clearance_mL_min: Math.round(crCl),
          renal_function: renalFunction,
          dose_adjustment: {
            original_dose_mg: dose,
            adjusted_dose_mg: Math.round(adjustment.dose),
            frequency_change: adjustment.frequency,
          },
          warning: crCl < 30 ? 'Consider nephrotoxicity and drug accumulation' : null,
        };
        break;
      }

      case 'infusion': {
        const { dose = 1000, concentration = 10, volume = 100, infusion_time = 60, drop_factor = 20 } = args;
        const rate = infusionRate(dose, concentration, infusion_time / 60);
        const drip = dripRate(volume, infusion_time, drop_factor);

        result = {
          operation: 'infusion',
          dose_mg: dose,
          concentration_mg_mL: concentration,
          volume_mL: volume,
          infusion_time_minutes: infusion_time,
          drop_factor: drop_factor,
          calculated: {
            infusion_rate_mL_hr: Math.round(rate * 10) / 10,
            drip_rate_drops_min: Math.round(drip),
            total_drug_delivered_mg: dose,
          },
        };
        break;
      }

      case 'concentration': {
        const { dose = 500, Vd = 50, bioavailability = 1, half_life = 6, interval = 8 } = args;
        const ke = eliminationConstant(half_life);
        const Cmax = peakConcentration(dose, Vd, bioavailability);
        const Cmin = troughConcentration(Cmax, ke, interval);

        // Accumulation factor at steady state
        const R = 1 / (1 - Math.exp(-ke * interval));
        const CmaxSS = Cmax * R;
        const CminSS = Cmin * R;

        result = {
          operation: 'concentration',
          dose_mg: dose,
          Vd_L: Vd,
          bioavailability: bioavailability,
          half_life_hours: half_life,
          interval_hours: interval,
          single_dose: {
            peak_mg_L: Math.round(Cmax * 100) / 100,
            trough_mg_L: Math.round(Cmin * 100) / 100,
          },
          steady_state: {
            accumulation_factor: Math.round(R * 100) / 100,
            peak_mg_L: Math.round(CmaxSS * 100) / 100,
            trough_mg_L: Math.round(CminSS * 100) / 100,
            fluctuation_percent: Math.round((CmaxSS - CminSS) / CminSS * 100),
          },
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Pharmacology Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isPharmacologyAvailable(): boolean { return true; }
