/**
 * DOSAGE-CALCULATOR TOOL
 * Comprehensive medication dosage calculator with pharmacokinetic modeling
 *
 * Features:
 * - Weight-based dosing (mg/kg)
 * - Body surface area (BSA) dosing
 * - Creatinine clearance and renal adjustment
 * - Pediatric dosing calculations
 * - IV drip rate calculations
 * - Pharmacokinetic calculations (Vd, Clearance, half-life)
 * - Loading and maintenance dose calculations
 * - Unit conversions
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// BODY MEASUREMENT CALCULATORS
// ============================================================================

class BodyMetrics {
  // Calculate Body Surface Area using various formulas
  static calculateBSA(weight: number, height: number, formula: string = 'mosteller'): number {
    // Weight in kg, height in cm
    switch (formula.toLowerCase()) {
      case 'mosteller':
        // Mosteller formula (most commonly used)
        return Math.sqrt((weight * height) / 3600);

      case 'dubois':
        // DuBois and DuBois formula
        return 0.007184 * Math.pow(weight, 0.425) * Math.pow(height, 0.725);

      case 'haycock':
        // Haycock formula (preferred for children)
        return 0.024265 * Math.pow(weight, 0.5378) * Math.pow(height, 0.3964);

      case 'gehan':
        // Gehan and George formula
        return 0.0235 * Math.pow(weight, 0.51456) * Math.pow(height, 0.42246);

      case 'boyd':
        // Boyd formula
        const weightGrams = weight * 1000;
        return 0.0003207 * Math.pow(weightGrams, 0.7285 - 0.0188 * Math.log10(weightGrams)) * Math.pow(height, 0.3);

      default:
        return Math.sqrt((weight * height) / 3600);
    }
  }

  // Calculate Ideal Body Weight
  static calculateIBW(height: number, gender: 'male' | 'female'): number {
    // Height in cm
    const heightInches = height / 2.54;
    const baseHeight = 60; // 5 feet in inches

    if (gender === 'male') {
      // Devine formula for males
      return 50 + 2.3 * (heightInches - baseHeight);
    } else {
      // Devine formula for females
      return 45.5 + 2.3 * (heightInches - baseHeight);
    }
  }

  // Calculate Adjusted Body Weight (for obese patients)
  static calculateABW(actualWeight: number, ibw: number, factor: number = 0.4): number {
    return ibw + factor * (actualWeight - ibw);
  }

  // Calculate BMI
  static calculateBMI(weight: number, height: number): number {
    // Height in cm
    const heightM = height / 100;
    return weight / (heightM * heightM);
  }

  // Calculate Lean Body Mass
  static calculateLBM(weight: number, height: number, gender: 'male' | 'female'): number {
    // Boer formula
    const heightCm = height;
    if (gender === 'male') {
      return 0.407 * weight + 0.267 * heightCm - 19.2;
    } else {
      return 0.252 * weight + 0.473 * heightCm - 48.3;
    }
  }
}

// ============================================================================
// RENAL FUNCTION CALCULATORS
// ============================================================================

class RenalFunction {
  // Calculate Creatinine Clearance using Cockcroft-Gault equation
  static cockcroftGault(
    age: number,
    weight: number,
    serumCreatinine: number,
    gender: 'male' | 'female'
  ): number {
    let crcl = ((140 - age) * weight) / (72 * serumCreatinine);
    if (gender === 'female') {
      crcl *= 0.85;
    }
    return crcl;
  }

  // Calculate eGFR using CKD-EPI equation (2021)
  static ckdEpi(
    serumCreatinine: number,
    age: number,
    gender: 'male' | 'female'
  ): number {
    const kappa = gender === 'female' ? 0.7 : 0.9;
    const alpha = gender === 'female' ? -0.241 : -0.302;
    const female_mult = gender === 'female' ? 1.012 : 1.0;

    const cr_ratio = serumCreatinine / kappa;
    const min_ratio = Math.min(cr_ratio, 1);
    const max_ratio = Math.max(cr_ratio, 1);

    return 142 * Math.pow(min_ratio, alpha) * Math.pow(max_ratio, -1.200) *
           Math.pow(0.9938, age) * female_mult;
  }

  // Calculate eGFR using MDRD equation
  static mdrd(
    serumCreatinine: number,
    age: number,
    gender: 'male' | 'female',
    isAfricanAmerican: boolean = false
  ): number {
    let gfr = 175 * Math.pow(serumCreatinine, -1.154) * Math.pow(age, -0.203);
    if (gender === 'female') gfr *= 0.742;
    if (isAfricanAmerican) gfr *= 1.212;
    return gfr;
  }

  // Determine CKD stage from eGFR
  static getCKDStage(egfr: number): { stage: string; description: string; } {
    if (egfr >= 90) {
      return { stage: 'G1', description: 'Normal or high kidney function' };
    } else if (egfr >= 60) {
      return { stage: 'G2', description: 'Mildly decreased kidney function' };
    } else if (egfr >= 45) {
      return { stage: 'G3a', description: 'Mild to moderately decreased' };
    } else if (egfr >= 30) {
      return { stage: 'G3b', description: 'Moderately to severely decreased' };
    } else if (egfr >= 15) {
      return { stage: 'G4', description: 'Severely decreased kidney function' };
    } else {
      return { stage: 'G5', description: 'Kidney failure' };
    }
  }

  // Get renal dose adjustment factor
  static getRenalAdjustment(crcl: number): { factor: number; description: string; } {
    if (crcl >= 50) {
      return { factor: 1.0, description: 'No adjustment needed' };
    } else if (crcl >= 30) {
      return { factor: 0.75, description: 'Mild reduction (25%)' };
    } else if (crcl >= 10) {
      return { factor: 0.5, description: 'Moderate reduction (50%)' };
    } else {
      return { factor: 0.25, description: 'Severe reduction (75%)' };
    }
  }
}

// ============================================================================
// PEDIATRIC DOSING CALCULATORS
// ============================================================================

class PediatricDosing {
  // Clark's rule (weight-based)
  static clarksRule(childWeight: number, adultDose: number): number {
    // Weight in pounds
    return (childWeight / 150) * adultDose;
  }

  // Young's rule (age-based)
  static youngsRule(childAge: number, adultDose: number): number {
    // Age in years
    return (childAge / (childAge + 12)) * adultDose;
  }

  // Fried's rule (for infants)
  static friedsRule(childAgeMonths: number, adultDose: number): number {
    return (childAgeMonths / 150) * adultDose;
  }

  // Webster's rule
  static webstersRule(childAge: number, adultDose: number): number {
    return ((childAge + 1) / (childAge + 7)) * adultDose;
  }

  // BSA-based dosing (most accurate)
  static bsaBasedDose(childBSA: number, adultDose: number, adultBSA: number = 1.73): number {
    return (childBSA / adultBSA) * adultDose;
  }

  // Safe dose range check
  static checkSafeDoseRange(
    calculatedDose: number,
    minDosePerKg: number,
    maxDosePerKg: number,
    weight: number
  ): { isSafe: boolean; minDose: number; maxDose: number; message: string; } {
    const minDose = minDosePerKg * weight;
    const maxDose = maxDosePerKg * weight;

    if (calculatedDose < minDose) {
      return {
        isSafe: false,
        minDose,
        maxDose,
        message: `Dose is below minimum safe range (${minDose.toFixed(2)} mg)`
      };
    } else if (calculatedDose > maxDose) {
      return {
        isSafe: false,
        minDose,
        maxDose,
        message: `Dose exceeds maximum safe range (${maxDose.toFixed(2)} mg)`
      };
    }

    return {
      isSafe: true,
      minDose,
      maxDose,
      message: 'Dose is within safe range'
    };
  }
}

// ============================================================================
// IV DRIP RATE CALCULATORS
// ============================================================================

class IVCalculations {
  // Calculate drip rate in drops per minute
  static calculateDripRate(
    volumeMl: number,
    timeHours: number,
    dropFactorGttsPerMl: number
  ): number {
    const timeMinutes = timeHours * 60;
    return (volumeMl * dropFactorGttsPerMl) / timeMinutes;
  }

  // Calculate flow rate in mL/hr
  static calculateFlowRate(volumeMl: number, timeHours: number): number {
    return volumeMl / timeHours;
  }

  // Calculate infusion time
  static calculateInfusionTime(volumeMl: number, flowRateMlPerHr: number): number {
    return volumeMl / flowRateMlPerHr;
  }

  // Calculate dose per minute for weight-based infusions
  static calculateDosePerMinute(
    concentrationMgPerMl: number,
    flowRateMlPerHr: number,
    weightKg: number
  ): { mgPerMin: number; mcgPerKgPerMin: number; } {
    const mlPerMin = flowRateMlPerHr / 60;
    const mgPerMin = concentrationMgPerMl * mlPerMin;
    const mcgPerKgPerMin = (mgPerMin * 1000) / weightKg;

    return { mgPerMin, mcgPerKgPerMin };
  }

  // Calculate flow rate for target dose
  static calculateFlowRateForDose(
    targetMcgPerKgPerMin: number,
    concentrationMgPerMl: number,
    weightKg: number
  ): number {
    // Convert target to mg/min
    const targetMgPerMin = (targetMcgPerKgPerMin * weightKg) / 1000;
    // Calculate mL/min needed
    const mlPerMin = targetMgPerMin / concentrationMgPerMl;
    // Convert to mL/hr
    return mlPerMin * 60;
  }

  // Common drop factors
  static readonly dropFactors = {
    standard: 15,      // Standard adult tubing (15 gtts/mL)
    macro: 10,         // Macro drip (10 gtts/mL)
    micro: 60,         // Micro/pediatric (60 gtts/mL)
    blood: 10          // Blood administration set (10 gtts/mL)
  };
}

// ============================================================================
// PHARMACOKINETIC CALCULATORS
// ============================================================================

class Pharmacokinetics {
  // Calculate Volume of Distribution
  static calculateVd(dose: number, peakConcentration: number): number {
    return dose / peakConcentration;
  }

  // Calculate Clearance
  static calculateClearance(dose: number, auc: number): number {
    return dose / auc;
  }

  // Calculate half-life from elimination rate constant
  static calculateHalfLife(ke: number): number {
    return 0.693 / ke;
  }

  // Calculate elimination rate constant from half-life
  static calculateKe(halfLife: number): number {
    return 0.693 / halfLife;
  }

  // Calculate loading dose
  static calculateLoadingDose(
    targetConcentration: number,
    volumeOfDistribution: number,
    bioavailability: number = 1
  ): number {
    return (targetConcentration * volumeOfDistribution) / bioavailability;
  }

  // Calculate maintenance dose
  static calculateMaintenanceDose(
    targetConcentration: number,
    clearance: number,
    dosingInterval: number,
    bioavailability: number = 1
  ): number {
    return (targetConcentration * clearance * dosingInterval) / bioavailability;
  }

  // Calculate steady-state concentration
  static calculateSteadyStateConcentration(
    dose: number,
    bioavailability: number,
    clearance: number,
    dosingInterval: number
  ): number {
    return (dose * bioavailability) / (clearance * dosingInterval);
  }

  // Calculate time to reach steady state
  static calculateTimeToSteadyState(halfLife: number): number {
    // Approximately 4-5 half-lives to reach steady state
    return 4.5 * halfLife;
  }

  // Calculate concentration at time t (first-order kinetics)
  static calculateConcentrationAtTime(
    initialConcentration: number,
    ke: number,
    time: number
  ): number {
    return initialConcentration * Math.exp(-ke * time);
  }

  // Calculate peak and trough for multiple dosing
  static calculatePeakTrough(
    dose: number,
    vd: number,
    ke: number,
    dosingInterval: number,
    infusionTime: number = 0
  ): { peak: number; trough: number; } {
    const accumFactor = 1 / (1 - Math.exp(-ke * dosingInterval));
    const peak = (dose / vd) * accumFactor;
    const trough = peak * Math.exp(-ke * (dosingInterval - infusionTime));

    return { peak, trough };
  }
}

// ============================================================================
// UNIT CONVERSIONS
// ============================================================================

class UnitConverter {
  // Weight conversions
  static kgToLb(kg: number): number { return kg * 2.205; }
  static lbToKg(lb: number): number { return lb / 2.205; }

  // Height conversions
  static cmToIn(cm: number): number { return cm / 2.54; }
  static inToCm(inches: number): number { return inches * 2.54; }

  // Dose conversions
  static mgToMcg(mg: number): number { return mg * 1000; }
  static mcgToMg(mcg: number): number { return mcg / 1000; }
  static gToMg(g: number): number { return g * 1000; }
  static mgToG(mg: number): number { return mg / 1000; }

  // Volume conversions
  static mlToL(ml: number): number { return ml / 1000; }
  static lToMl(l: number): number { return l * 1000; }
  static mlToOz(ml: number): number { return ml / 29.574; }
  static ozToMl(oz: number): number { return oz * 29.574; }

  // Concentration conversions
  static percentToMgPerMl(percent: number): number { return percent * 10; }
  static mgPerMlToPercent(mgPerMl: number): number { return mgPerMl / 10; }

  // Temperature conversions
  static celsiusToFahrenheit(c: number): number { return (c * 9/5) + 32; }
  static fahrenheitToCelsius(f: number): number { return (f - 32) * 5/9; }

  // Creatinine conversions
  static mgDlToUmolL(mgDl: number): number { return mgDl * 88.4; }
  static umolLToMgDl(umolL: number): number { return umolL / 88.4; }
}

// ============================================================================
// COMMON DRUG DOSING DATABASE
// ============================================================================

interface DrugInfo {
  name: string;
  class: string;
  standardDose: string;
  maxDose: string;
  pediatricDose?: string;
  renalAdjustment: boolean;
  hepaticAdjustment: boolean;
  halfLife: string;
  notes: string[];
}

const drugDatabase: Record<string, DrugInfo> = {
  'amoxicillin': {
    name: 'Amoxicillin',
    class: 'Antibiotic (Penicillin)',
    standardDose: '500mg PO q8h or 875mg PO q12h',
    maxDose: '3g/day',
    pediatricDose: '25-50 mg/kg/day divided q8h',
    renalAdjustment: true,
    hepaticAdjustment: false,
    halfLife: '1-1.3 hours',
    notes: ['Reduce dose if CrCl < 30', 'Check for penicillin allergy']
  },
  'vancomycin': {
    name: 'Vancomycin',
    class: 'Antibiotic (Glycopeptide)',
    standardDose: '15-20 mg/kg IV q8-12h',
    maxDose: '4g/day',
    pediatricDose: '40-60 mg/kg/day divided q6h',
    renalAdjustment: true,
    hepaticAdjustment: false,
    halfLife: '4-6 hours (normal renal function)',
    notes: ['Target trough 15-20 mg/L for serious infections', 'Monitor renal function', 'Adjust based on levels']
  },
  'gentamicin': {
    name: 'Gentamicin',
    class: 'Antibiotic (Aminoglycoside)',
    standardDose: '5-7 mg/kg IV q24h (extended interval)',
    maxDose: '7 mg/kg/day',
    pediatricDose: '2.5 mg/kg IV q8h',
    renalAdjustment: true,
    hepaticAdjustment: false,
    halfLife: '2-3 hours',
    notes: ['Nephrotoxic and ototoxic', 'Monitor levels and renal function', 'Extended interval dosing preferred']
  },
  'metformin': {
    name: 'Metformin',
    class: 'Antidiabetic (Biguanide)',
    standardDose: '500-1000mg PO BID',
    maxDose: '2550mg/day',
    renalAdjustment: true,
    hepaticAdjustment: true,
    halfLife: '4-8.7 hours',
    notes: ['Contraindicated if eGFR < 30', 'Hold before contrast procedures', 'Reduce dose if eGFR 30-45']
  },
  'lisinopril': {
    name: 'Lisinopril',
    class: 'Antihypertensive (ACE Inhibitor)',
    standardDose: '10-40mg PO daily',
    maxDose: '80mg/day',
    renalAdjustment: true,
    hepaticAdjustment: false,
    halfLife: '12 hours',
    notes: ['Monitor potassium and creatinine', 'Start low in renal impairment', 'Avoid in pregnancy']
  },
  'warfarin': {
    name: 'Warfarin',
    class: 'Anticoagulant (Vitamin K Antagonist)',
    standardDose: '2-5mg PO daily (INR guided)',
    maxDose: 'INR guided',
    renalAdjustment: false,
    hepaticAdjustment: true,
    halfLife: '36-42 hours',
    notes: ['Multiple drug interactions', 'Monitor INR regularly', 'Vitamin K is antidote']
  },
  'morphine': {
    name: 'Morphine',
    class: 'Opioid Analgesic',
    standardDose: '2.5-10mg IV q3-4h PRN',
    maxDose: 'Patient specific',
    renalAdjustment: true,
    hepaticAdjustment: true,
    halfLife: '2-4 hours',
    notes: ['Active metabolite accumulates in renal impairment', 'Reduce dose in hepatic impairment', 'Risk of respiratory depression']
  },
  'furosemide': {
    name: 'Furosemide',
    class: 'Diuretic (Loop)',
    standardDose: '20-80mg PO/IV daily-BID',
    maxDose: '600mg/day',
    pediatricDose: '1-2 mg/kg/dose',
    renalAdjustment: true,
    hepaticAdjustment: false,
    halfLife: '2 hours',
    notes: ['Higher doses needed in renal impairment', 'Monitor electrolytes', 'Ototoxic at high doses']
  }
};

// ============================================================================
// MAIN DOSAGE CALCULATOR
// ============================================================================

interface DoseCalculationResult {
  calculatedDose: number;
  doseUnit: string;
  frequency?: string;
  adjustments: string[];
  warnings: string[];
  method: string;
}

class DosageCalculator {
  // Weight-based dosing
  calculateWeightBasedDose(
    dosePerKg: number,
    weight: number,
    frequency: number = 1,
    maxSingleDose?: number,
    maxDailyDose?: number
  ): DoseCalculationResult {
    let singleDose = dosePerKg * weight;
    const dailyDose = singleDose * frequency;
    const adjustments: string[] = [];
    const warnings: string[] = [];

    if (maxSingleDose && singleDose > maxSingleDose) {
      adjustments.push(`Single dose capped at ${maxSingleDose}mg (calculated: ${singleDose.toFixed(2)}mg)`);
      singleDose = maxSingleDose;
    }

    if (maxDailyDose && dailyDose > maxDailyDose) {
      const adjustedSingle = maxDailyDose / frequency;
      if (adjustedSingle < singleDose) {
        adjustments.push(`Daily dose capped at ${maxDailyDose}mg`);
        singleDose = adjustedSingle;
      }
    }

    return {
      calculatedDose: singleDose,
      doseUnit: 'mg',
      frequency: `${frequency}x daily`,
      adjustments,
      warnings,
      method: 'Weight-based (mg/kg)'
    };
  }

  // BSA-based dosing (for chemotherapy, etc.)
  calculateBSADose(
    dosePerM2: number,
    bsa: number,
    maxDose?: number
  ): DoseCalculationResult {
    let dose = dosePerM2 * bsa;
    const adjustments: string[] = [];
    const warnings: string[] = [];

    if (maxDose && dose > maxDose) {
      adjustments.push(`Dose capped at ${maxDose}mg (calculated: ${dose.toFixed(2)}mg)`);
      dose = maxDose;
    }

    return {
      calculatedDose: dose,
      doseUnit: 'mg',
      adjustments,
      warnings,
      method: `BSA-based (${dosePerM2} mg/m²)`
    };
  }

  // Renal-adjusted dosing
  calculateRenalAdjustedDose(
    normalDose: number,
    crcl: number,
    adjustmentTable?: { minCrCl: number; maxCrCl: number; factor: number; }[]
  ): DoseCalculationResult {
    const adjustments: string[] = [];
    const warnings: string[] = [];

    let adjustmentFactor = 1.0;

    if (adjustmentTable) {
      for (const range of adjustmentTable) {
        if (crcl >= range.minCrCl && crcl < range.maxCrCl) {
          adjustmentFactor = range.factor;
          break;
        }
      }
    } else {
      // Default adjustment
      const renalAdj = RenalFunction.getRenalAdjustment(crcl);
      adjustmentFactor = renalAdj.factor;
      adjustments.push(renalAdj.description);
    }

    const adjustedDose = normalDose * adjustmentFactor;
    adjustments.push(`CrCl: ${crcl.toFixed(1)} mL/min`);
    adjustments.push(`Adjustment factor: ${(adjustmentFactor * 100).toFixed(0)}%`);

    if (crcl < 15) {
      warnings.push('Severe renal impairment - consider alternative drug or dialysis dosing');
    }

    return {
      calculatedDose: adjustedDose,
      doseUnit: 'mg',
      adjustments,
      warnings,
      method: 'Renal-adjusted dosing'
    };
  }
}

// ============================================================================
// TOOL DEFINITION AND EXECUTOR
// ============================================================================

export const dosagecalculatorTool: UnifiedTool = {
  name: 'dosage_calculator',
  description: `Comprehensive medication dosage calculator with pharmacokinetic modeling for clinical decision support.

Features:
- Weight-based dosing (mg/kg) with maximum dose caps
- Body Surface Area (BSA) dosing for chemotherapy
- Creatinine clearance calculation (Cockcroft-Gault, CKD-EPI, MDRD)
- Renal dose adjustments based on eGFR/CrCl
- Pediatric dosing (Clark's, Young's, Fried's, BSA-based)
- IV drip rate calculations (gtts/min, mL/hr)
- Pharmacokinetic calculations (Vd, clearance, half-life, loading dose)
- Body metrics (BSA, IBW, ABW, BMI, LBM)
- Unit conversions
- Common drug reference database

Operations:
- weight_based: Calculate dose based on mg/kg
- bsa_dose: Calculate BSA-based dose
- renal_adjust: Adjust dose for renal impairment
- pediatric: Calculate pediatric dose
- iv_rate: Calculate IV drip rates
- pharmacokinetics: PK calculations
- creatinine_clearance: Calculate CrCl/eGFR
- body_metrics: Calculate BSA, IBW, ABW, BMI
- convert: Unit conversions
- drug_info: Look up drug dosing information
- info: Tool documentation
- examples: Usage examples

DISCLAIMER: This tool is for educational purposes only. Always verify calculations
and consult appropriate references before clinical use.`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['weight_based', 'bsa_dose', 'renal_adjust', 'pediatric', 'iv_rate', 'pharmacokinetics', 'creatinine_clearance', 'body_metrics', 'convert', 'drug_info', 'info', 'examples'],
        description: 'Operation to perform'
      },
      dose_per_kg: { type: 'number', description: 'Dose per kg body weight (mg/kg)' },
      dose_per_m2: { type: 'number', description: 'Dose per m² BSA (mg/m²)' },
      normal_dose: { type: 'number', description: 'Normal dose before adjustment (mg)' },
      weight: { type: 'number', description: 'Patient weight in kg' },
      height: { type: 'number', description: 'Patient height in cm' },
      age: { type: 'number', description: 'Patient age in years' },
      gender: { type: 'string', enum: ['male', 'female'], description: 'Patient gender' },
      serum_creatinine: { type: 'number', description: 'Serum creatinine in mg/dL' },
      frequency: { type: 'number', description: 'Doses per day' },
      max_single_dose: { type: 'number', description: 'Maximum single dose (mg)' },
      max_daily_dose: { type: 'number', description: 'Maximum daily dose (mg)' },
      adult_dose: { type: 'number', description: 'Standard adult dose (mg)' },
      volume_ml: { type: 'number', description: 'IV volume in mL' },
      time_hours: { type: 'number', description: 'Infusion time in hours' },
      drop_factor: { type: 'number', description: 'Drop factor (gtts/mL)' },
      concentration: { type: 'number', description: 'Drug concentration (mg/mL)' },
      target_dose: { type: 'number', description: 'Target dose (mcg/kg/min)' },
      vd: { type: 'number', description: 'Volume of distribution (L)' },
      clearance: { type: 'number', description: 'Drug clearance (L/hr)' },
      half_life: { type: 'number', description: 'Drug half-life (hours)' },
      target_concentration: { type: 'number', description: 'Target plasma concentration' },
      dosing_interval: { type: 'number', description: 'Dosing interval (hours)' },
      bioavailability: { type: 'number', description: 'Bioavailability (0-1)' },
      from_unit: { type: 'string', description: 'Unit to convert from' },
      to_unit: { type: 'string', description: 'Unit to convert to' },
      value: { type: 'number', description: 'Value to convert' },
      drug_name: { type: 'string', description: 'Drug name for lookup' },
      bsa_formula: { type: 'string', enum: ['mosteller', 'dubois', 'haycock', 'gehan', 'boyd'], description: 'BSA calculation formula' },
      crcl_formula: { type: 'string', enum: ['cockcroft_gault', 'ckd_epi', 'mdrd'], description: 'CrCl/eGFR calculation formula' }
    },
    required: ['operation']
  }
};

export async function executedosagecalculator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;
    const calculator = new DosageCalculator();

    switch (operation) {
      case 'weight_based': {
        const dosePerKg = args.dose_per_kg;
        const weight = args.weight;

        if (!dosePerKg || !weight) {
          return { toolCallId: id, content: 'Error: dose_per_kg and weight are required', isError: true };
        }

        const result = calculator.calculateWeightBasedDose(
          dosePerKg,
          weight,
          args.frequency || 1,
          args.max_single_dose,
          args.max_daily_dose
        );

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'weight_based',
            input: {
              dosePerKg: dosePerKg + ' mg/kg',
              weight: weight + ' kg',
              frequency: args.frequency || 1
            },
            result: {
              singleDose: result.calculatedDose.toFixed(2) + ' mg',
              dailyDose: (result.calculatedDose * (args.frequency || 1)).toFixed(2) + ' mg',
              frequency: result.frequency
            },
            adjustments: result.adjustments,
            warnings: result.warnings,
            method: result.method
          }, null, 2)
        };
      }

      case 'bsa_dose': {
        const dosePerM2 = args.dose_per_m2;
        const weight = args.weight;
        const height = args.height;

        if (!dosePerM2 || !weight || !height) {
          return { toolCallId: id, content: 'Error: dose_per_m2, weight, and height are required', isError: true };
        }

        const bsa = BodyMetrics.calculateBSA(weight, height, args.bsa_formula || 'mosteller');
        const result = calculator.calculateBSADose(dosePerM2, bsa, args.max_single_dose);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'bsa_dose',
            input: {
              dosePerM2: dosePerM2 + ' mg/m²',
              weight: weight + ' kg',
              height: height + ' cm'
            },
            bodyMetrics: {
              bsa: bsa.toFixed(2) + ' m²',
              formula: args.bsa_formula || 'mosteller'
            },
            result: {
              calculatedDose: result.calculatedDose.toFixed(2) + ' mg'
            },
            adjustments: result.adjustments,
            warnings: result.warnings,
            method: result.method
          }, null, 2)
        };
      }

      case 'renal_adjust': {
        const normalDose = args.normal_dose;
        const weight = args.weight;
        const age = args.age;
        const gender = args.gender;
        const serumCreatinine = args.serum_creatinine;

        if (!normalDose || !weight || !age || !gender || !serumCreatinine) {
          return { toolCallId: id, content: 'Error: normal_dose, weight, age, gender, and serum_creatinine are required', isError: true };
        }

        const crcl = RenalFunction.cockcroftGault(age, weight, serumCreatinine, gender);
        const egfr = RenalFunction.ckdEpi(serumCreatinine, age, gender);
        const ckdStage = RenalFunction.getCKDStage(egfr);
        const result = calculator.calculateRenalAdjustedDose(normalDose, crcl);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'renal_adjust',
            input: {
              normalDose: normalDose + ' mg',
              weight: weight + ' kg',
              age: age + ' years',
              gender,
              serumCreatinine: serumCreatinine + ' mg/dL'
            },
            renalFunction: {
              crclCockcroftGault: crcl.toFixed(1) + ' mL/min',
              egfrCkdEpi: egfr.toFixed(1) + ' mL/min/1.73m²',
              ckdStage: ckdStage.stage,
              ckdDescription: ckdStage.description
            },
            result: {
              adjustedDose: result.calculatedDose.toFixed(2) + ' mg'
            },
            adjustments: result.adjustments,
            warnings: result.warnings,
            method: result.method
          }, null, 2)
        };
      }

      case 'pediatric': {
        const adultDose = args.adult_dose;
        const weight = args.weight;
        const age = args.age;
        const height = args.height;

        if (!adultDose) {
          return { toolCallId: id, content: 'Error: adult_dose is required', isError: true };
        }

        const results: Record<string, string> = {};

        if (weight) {
          const weightLb = UnitConverter.kgToLb(weight);
          results.clarksRule = PediatricDosing.clarksRule(weightLb, adultDose).toFixed(2) + ' mg';
        }

        if (age !== undefined) {
          if (age < 1 && args.age_months) {
            results.friedsRule = PediatricDosing.friedsRule(args.age_months, adultDose).toFixed(2) + ' mg';
          } else {
            results.youngsRule = PediatricDosing.youngsRule(age, adultDose).toFixed(2) + ' mg';
            results.webstersRule = PediatricDosing.webstersRule(age, adultDose).toFixed(2) + ' mg';
          }
        }

        if (weight && height) {
          const childBSA = BodyMetrics.calculateBSA(weight, height, 'haycock');
          results.bsaBased = PediatricDosing.bsaBasedDose(childBSA, adultDose).toFixed(2) + ' mg';
          results.childBSA = childBSA.toFixed(2) + ' m²';
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'pediatric',
            input: {
              adultDose: adultDose + ' mg',
              weight: weight ? weight + ' kg' : 'not provided',
              age: age !== undefined ? age + ' years' : 'not provided',
              height: height ? height + ' cm' : 'not provided'
            },
            calculatedDoses: results,
            recommendation: 'BSA-based dosing is most accurate when height and weight are available',
            note: 'Always verify against established pediatric dosing guidelines'
          }, null, 2)
        };
      }

      case 'iv_rate': {
        const volumeMl = args.volume_ml;
        const timeHours = args.time_hours;
        const dropFactor = args.drop_factor || 15;
        const weight = args.weight;
        const concentration = args.concentration;
        const targetDose = args.target_dose;

        const result: Record<string, any> = {
          operation: 'iv_rate'
        };

        if (volumeMl && timeHours) {
          const flowRate = IVCalculations.calculateFlowRate(volumeMl, timeHours);
          const dripRate = IVCalculations.calculateDripRate(volumeMl, timeHours, dropFactor);

          result.volumeBasedCalculation = {
            volume: volumeMl + ' mL',
            time: timeHours + ' hours',
            dropFactor: dropFactor + ' gtts/mL',
            flowRate: flowRate.toFixed(1) + ' mL/hr',
            dripRate: Math.round(dripRate) + ' gtts/min'
          };
        }

        if (targetDose && concentration && weight) {
          const flowRate = IVCalculations.calculateFlowRateForDose(targetDose, concentration, weight);
          result.doseBasedCalculation = {
            targetDose: targetDose + ' mcg/kg/min',
            concentration: concentration + ' mg/mL',
            weight: weight + ' kg',
            requiredFlowRate: flowRate.toFixed(1) + ' mL/hr'
          };
        }

        result.commonDropFactors = {
          'Standard adult (15 gtts/mL)': 15,
          'Macro drip (10 gtts/mL)': 10,
          'Micro/Pediatric (60 gtts/mL)': 60,
          'Blood set (10 gtts/mL)': 10
        };

        return {
          toolCallId: id,
          content: JSON.stringify(result, null, 2)
        };
      }

      case 'pharmacokinetics': {
        const result: Record<string, any> = {
          operation: 'pharmacokinetics',
          calculations: {}
        };

        const halfLife = args.half_life;
        const vd = args.vd;
        const clearance = args.clearance;
        const targetConc = args.target_concentration;
        const dosingInterval = args.dosing_interval;
        const bioavailability = args.bioavailability || 1;

        if (halfLife) {
          const ke = Pharmacokinetics.calculateKe(halfLife);
          const timeToSS = Pharmacokinetics.calculateTimeToSteadyState(halfLife);

          result.calculations.eliminationRate = ke.toFixed(4) + ' /hr';
          result.calculations.timeToSteadyState = timeToSS.toFixed(1) + ' hours (' + (timeToSS/24).toFixed(1) + ' days)';
        }

        if (targetConc && vd) {
          const loadingDose = Pharmacokinetics.calculateLoadingDose(targetConc, vd, bioavailability);
          result.calculations.loadingDose = loadingDose.toFixed(2) + ' mg';
        }

        if (targetConc && clearance && dosingInterval) {
          const maintenanceDose = Pharmacokinetics.calculateMaintenanceDose(targetConc, clearance, dosingInterval, bioavailability);
          result.calculations.maintenanceDose = maintenanceDose.toFixed(2) + ' mg every ' + dosingInterval + ' hours';
        }

        if (vd && halfLife && args.normal_dose && dosingInterval) {
          const ke = Pharmacokinetics.calculateKe(halfLife);
          const peakTrough = Pharmacokinetics.calculatePeakTrough(args.normal_dose, vd, ke, dosingInterval);
          result.calculations.predictedPeak = peakTrough.peak.toFixed(2);
          result.calculations.predictedTrough = peakTrough.trough.toFixed(2);
        }

        result.parameters = {
          halfLife: halfLife ? halfLife + ' hours' : 'not provided',
          vd: vd ? vd + ' L' : 'not provided',
          clearance: clearance ? clearance + ' L/hr' : 'not provided',
          bioavailability: (bioavailability * 100) + '%'
        };

        return {
          toolCallId: id,
          content: JSON.stringify(result, null, 2)
        };
      }

      case 'creatinine_clearance': {
        const age = args.age;
        const weight = args.weight;
        const serumCreatinine = args.serum_creatinine;
        const gender = args.gender;

        if (!age || !weight || !serumCreatinine || !gender) {
          return { toolCallId: id, content: 'Error: age, weight, serum_creatinine, and gender are required', isError: true };
        }

        const crclCG = RenalFunction.cockcroftGault(age, weight, serumCreatinine, gender);
        const egfrCKD = RenalFunction.ckdEpi(serumCreatinine, age, gender);
        const egfrMDRD = RenalFunction.mdrd(serumCreatinine, age, gender);
        const ckdStage = RenalFunction.getCKDStage(egfrCKD);
        const renalAdj = RenalFunction.getRenalAdjustment(crclCG);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'creatinine_clearance',
            input: {
              age: age + ' years',
              weight: weight + ' kg',
              serumCreatinine: serumCreatinine + ' mg/dL',
              gender
            },
            results: {
              cockcroftGault: crclCG.toFixed(1) + ' mL/min',
              ckdEpi: egfrCKD.toFixed(1) + ' mL/min/1.73m²',
              mdrd: egfrMDRD.toFixed(1) + ' mL/min/1.73m²'
            },
            interpretation: {
              ckdStage: ckdStage.stage,
              description: ckdStage.description,
              doseAdjustment: renalAdj.description,
              adjustmentFactor: (renalAdj.factor * 100) + '%'
            },
            notes: [
              'Cockcroft-Gault: Used for drug dosing adjustments',
              'CKD-EPI: Most accurate for staging CKD',
              'MDRD: Less accurate at higher GFR values'
            ]
          }, null, 2)
        };
      }

      case 'body_metrics': {
        const weight = args.weight;
        const height = args.height;
        const gender = args.gender;

        if (!weight || !height) {
          return { toolCallId: id, content: 'Error: weight and height are required', isError: true };
        }

        const bsaMosteller = BodyMetrics.calculateBSA(weight, height, 'mosteller');
        const bsaDubois = BodyMetrics.calculateBSA(weight, height, 'dubois');
        const bmi = BodyMetrics.calculateBMI(weight, height);

        const result: Record<string, any> = {
          operation: 'body_metrics',
          input: {
            weight: weight + ' kg',
            height: height + ' cm',
            gender: gender || 'not specified'
          },
          bsa: {
            mosteller: bsaMosteller.toFixed(2) + ' m²',
            dubois: bsaDubois.toFixed(2) + ' m²'
          },
          bmi: {
            value: bmi.toFixed(1) + ' kg/m²',
            category: bmi < 18.5 ? 'Underweight' :
                     bmi < 25 ? 'Normal' :
                     bmi < 30 ? 'Overweight' : 'Obese'
          }
        };

        if (gender) {
          const ibw = BodyMetrics.calculateIBW(height, gender);
          const abw = BodyMetrics.calculateABW(weight, ibw);
          const lbm = BodyMetrics.calculateLBM(weight, height, gender);

          result.idealBodyWeight = ibw.toFixed(1) + ' kg';
          result.adjustedBodyWeight = abw.toFixed(1) + ' kg';
          result.leanBodyMass = lbm.toFixed(1) + ' kg';

          if (weight > ibw * 1.3) {
            result.note = 'Actual weight >130% IBW - consider using ABW for dosing';
          }
        }

        return {
          toolCallId: id,
          content: JSON.stringify(result, null, 2)
        };
      }

      case 'convert': {
        const value = args.value;
        const fromUnit = args.from_unit?.toLowerCase();
        const toUnit = args.to_unit?.toLowerCase();

        if (value === undefined || !fromUnit || !toUnit) {
          return { toolCallId: id, content: 'Error: value, from_unit, and to_unit are required', isError: true };
        }

        let converted: number | null = null;
        const conversionKey = `${fromUnit}_to_${toUnit}`;

        const conversions: Record<string, (v: number) => number> = {
          'kg_to_lb': UnitConverter.kgToLb,
          'lb_to_kg': UnitConverter.lbToKg,
          'cm_to_in': UnitConverter.cmToIn,
          'in_to_cm': UnitConverter.inToCm,
          'mg_to_mcg': UnitConverter.mgToMcg,
          'mcg_to_mg': UnitConverter.mcgToMg,
          'g_to_mg': UnitConverter.gToMg,
          'mg_to_g': UnitConverter.mgToG,
          'ml_to_l': UnitConverter.mlToL,
          'l_to_ml': UnitConverter.lToMl,
          'c_to_f': UnitConverter.celsiusToFahrenheit,
          'f_to_c': UnitConverter.fahrenheitToCelsius,
          'mgdl_to_umoll': UnitConverter.mgDlToUmolL,
          'umoll_to_mgdl': UnitConverter.umolLToMgDl,
          'percent_to_mg/ml': UnitConverter.percentToMgPerMl,
          'mg/ml_to_percent': UnitConverter.mgPerMlToPercent
        };

        const converter = conversions[conversionKey];
        if (converter) {
          converted = converter(value);
        }

        if (converted === null) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              error: `Unknown conversion: ${fromUnit} to ${toUnit}`,
              availableConversions: Object.keys(conversions).map(k => k.replace('_to_', ' → '))
            }, null, 2),
            isError: true
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'convert',
            input: { value, fromUnit, toUnit },
            result: converted,
            display: `${value} ${fromUnit} = ${converted.toFixed(4)} ${toUnit}`
          }, null, 2)
        };
      }

      case 'drug_info': {
        const drugName = args.drug_name?.toLowerCase();

        if (!drugName) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'drug_info',
              availableDrugs: Object.keys(drugDatabase),
              note: 'Provide drug_name parameter to look up specific drug information'
            }, null, 2)
          };
        }

        const drug = drugDatabase[drugName];
        if (!drug) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              error: `Drug "${drugName}" not found in database`,
              availableDrugs: Object.keys(drugDatabase),
              note: 'Database contains common drugs for reference only'
            }, null, 2),
            isError: true
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'drug_info',
            drug: drug,
            disclaimer: 'This is reference information only. Always consult current prescribing information and clinical guidelines.'
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'dosage_calculator',
            version: '1.0.0',
            description: 'Comprehensive medication dosage calculator',
            capabilities: {
              dosing: ['Weight-based', 'BSA-based', 'Renal-adjusted', 'Pediatric'],
              renalFunction: ['Cockcroft-Gault CrCl', 'CKD-EPI eGFR', 'MDRD eGFR'],
              ivCalculations: ['Drip rates', 'Flow rates', 'Dose-based rates'],
              pharmacokinetics: ['Loading dose', 'Maintenance dose', 'Half-life', 'Peak/trough'],
              bodyMetrics: ['BSA', 'IBW', 'ABW', 'BMI', 'LBM'],
              drugDatabase: Object.keys(drugDatabase).length + ' common drugs'
            },
            formulas: {
              bsa: ['Mosteller', 'DuBois', 'Haycock', 'Gehan', 'Boyd'],
              pediatric: ["Clark's rule", "Young's rule", "Fried's rule", "Webster's rule", 'BSA-based']
            },
            disclaimer: 'This tool is for educational and reference purposes only. All calculations should be verified by qualified healthcare professionals before clinical use.'
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                name: 'Weight-based dosing',
                call: {
                  operation: 'weight_based',
                  dose_per_kg: 10,
                  weight: 70,
                  frequency: 3,
                  max_daily_dose: 3000
                }
              },
              {
                name: 'BSA-based chemotherapy dosing',
                call: {
                  operation: 'bsa_dose',
                  dose_per_m2: 75,
                  weight: 70,
                  height: 170
                }
              },
              {
                name: 'Renal dose adjustment',
                call: {
                  operation: 'renal_adjust',
                  normal_dose: 500,
                  weight: 70,
                  age: 65,
                  gender: 'male',
                  serum_creatinine: 1.8
                }
              },
              {
                name: 'Pediatric dose calculation',
                call: {
                  operation: 'pediatric',
                  adult_dose: 500,
                  weight: 20,
                  age: 6,
                  height: 115
                }
              },
              {
                name: 'IV drip rate calculation',
                call: {
                  operation: 'iv_rate',
                  volume_ml: 1000,
                  time_hours: 8,
                  drop_factor: 15
                }
              },
              {
                name: 'Creatinine clearance',
                call: {
                  operation: 'creatinine_clearance',
                  age: 70,
                  weight: 80,
                  serum_creatinine: 1.5,
                  gender: 'male'
                }
              }
            ]
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: `Error: Unknown operation '${operation}'. Valid operations: weight_based, bsa_dose, renal_adjust, pediatric, iv_rate, pharmacokinetics, creatinine_clearance, body_metrics, convert, drug_info, info, examples`,
          isError: true
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isdosagecalculatorAvailable(): boolean {
  return true;
}
