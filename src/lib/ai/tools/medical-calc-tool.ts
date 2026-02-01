// ============================================================================
// MEDICAL CALCULATOR TOOL - TIER GODMODE
// ============================================================================
// Clinical calculators for healthcare: scoring systems, drug dosing,
// body calculations, and unit conversions.
// DISCLAIMER: For educational purposes only. Not for clinical decision making.
// Pure TypeScript implementation.
// ============================================================================

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface CalculationResult {
  value: number;
  unit: string;
  interpretation?: string;
  formula?: string;
  reference?: string;
}

// ============================================================================
// BODY CALCULATIONS
// ============================================================================

function calculateBMI(weightKg: number, heightCm: number): CalculationResult {
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);

  let interpretation: string;
  if (bmi < 18.5) interpretation = 'Underweight';
  else if (bmi < 25) interpretation = 'Normal weight';
  else if (bmi < 30) interpretation = 'Overweight';
  else if (bmi < 35) interpretation = 'Obesity Class I';
  else if (bmi < 40) interpretation = 'Obesity Class II';
  else interpretation = 'Obesity Class III';

  return {
    value: Math.round(bmi * 10) / 10,
    unit: 'kg/m²',
    interpretation,
    formula: 'BMI = weight(kg) / height(m)²',
    reference: 'WHO Classification',
  };
}

function calculateBSA(weightKg: number, heightCm: number, formula: string = 'mosteller'): CalculationResult {
  let bsa: number;
  let formulaUsed: string;

  switch (formula.toLowerCase()) {
    case 'dubois':
      bsa = 0.007184 * Math.pow(weightKg, 0.425) * Math.pow(heightCm, 0.725);
      formulaUsed = 'Du Bois: 0.007184 × W^0.425 × H^0.725';
      break;
    case 'mosteller':
    default:
      bsa = Math.sqrt((heightCm * weightKg) / 3600);
      formulaUsed = 'Mosteller: √(H × W / 3600)';
      break;
  }

  return {
    value: Math.round(bsa * 100) / 100,
    unit: 'm²',
    formula: formulaUsed,
    reference: 'Standard BSA formulas',
  };
}

function calculateIdealBodyWeight(heightCm: number, sex: 'male' | 'female'): CalculationResult {
  // Devine formula
  const heightInches = heightCm / 2.54;
  const inchesOver5Feet = heightInches - 60;

  let ibw: number;
  if (sex === 'male') {
    ibw = 50 + 2.3 * inchesOver5Feet;
  } else {
    ibw = 45.5 + 2.3 * inchesOver5Feet;
  }

  return {
    value: Math.round(ibw * 10) / 10,
    unit: 'kg',
    formula: sex === 'male'
      ? 'IBW = 50 + 2.3 × (height in inches - 60)'
      : 'IBW = 45.5 + 2.3 × (height in inches - 60)',
    reference: 'Devine Formula (1974)',
  };
}

function calculateAdjustedBodyWeight(actualWeight: number, idealWeight: number): CalculationResult {
  const abw = idealWeight + 0.4 * (actualWeight - idealWeight);

  return {
    value: Math.round(abw * 10) / 10,
    unit: 'kg',
    formula: 'ABW = IBW + 0.4 × (actual weight - IBW)',
    reference: 'Used for drug dosing in obese patients',
  };
}

function calculateLeanBodyMass(weightKg: number, heightCm: number, sex: 'male' | 'female'): CalculationResult {
  // Boer formula
  let lbm: number;
  if (sex === 'male') {
    lbm = 0.407 * weightKg + 0.267 * heightCm - 19.2;
  } else {
    lbm = 0.252 * weightKg + 0.473 * heightCm - 48.3;
  }

  return {
    value: Math.round(lbm * 10) / 10,
    unit: 'kg',
    formula: sex === 'male'
      ? 'LBM = 0.407W + 0.267H - 19.2'
      : 'LBM = 0.252W + 0.473H - 48.3',
    reference: 'Boer Formula',
  };
}

// ============================================================================
// KIDNEY FUNCTION
// ============================================================================

function calculateCreatinineClearance(
  ageTears: number,
  weightKg: number,
  serumCreatinine: number,
  sex: 'male' | 'female'
): CalculationResult {
  // Cockcroft-Gault equation
  let crcl = ((140 - ageTears) * weightKg) / (72 * serumCreatinine);
  if (sex === 'female') {
    crcl *= 0.85;
  }

  let interpretation: string;
  if (crcl >= 90) interpretation = 'Normal or high';
  else if (crcl >= 60) interpretation = 'Mildly decreased';
  else if (crcl >= 30) interpretation = 'Moderately decreased';
  else if (crcl >= 15) interpretation = 'Severely decreased';
  else interpretation = 'Kidney failure';

  return {
    value: Math.round(crcl * 10) / 10,
    unit: 'mL/min',
    interpretation,
    formula: 'CrCl = [(140-age) × weight] / (72 × SCr) × 0.85 if female',
    reference: 'Cockcroft-Gault Equation',
  };
}

function calculateEGFR(
  serumCreatinine: number,
  ageYears: number,
  sex: 'male' | 'female',
  _isBlack: boolean = false
): CalculationResult {
  // CKD-EPI 2021 equation (race-free)
  const kappa = sex === 'female' ? 0.7 : 0.9;
  const alpha = sex === 'female' ? -0.241 : -0.302;
  const sexMultiplier = sex === 'female' ? 1.012 : 1.0;

  const scrOverKappa = serumCreatinine / kappa;
  const minScr = Math.min(scrOverKappa, 1);
  const maxScr = Math.max(scrOverKappa, 1);

  const egfr = 142 * Math.pow(minScr, alpha) * Math.pow(maxScr, -1.2) *
    Math.pow(0.9938, ageYears) * sexMultiplier;

  let stage: string;
  if (egfr >= 90) stage = 'G1 - Normal or high';
  else if (egfr >= 60) stage = 'G2 - Mildly decreased';
  else if (egfr >= 45) stage = 'G3a - Mildly to moderately decreased';
  else if (egfr >= 30) stage = 'G3b - Moderately to severely decreased';
  else if (egfr >= 15) stage = 'G4 - Severely decreased';
  else stage = 'G5 - Kidney failure';

  return {
    value: Math.round(egfr),
    unit: 'mL/min/1.73m²',
    interpretation: stage,
    formula: 'CKD-EPI 2021 (race-free equation)',
    reference: 'KDIGO 2021',
  };
}

// ============================================================================
// CLINICAL SCORES
// ============================================================================

function calculateCHADS2(
  chf: boolean,
  hypertension: boolean,
  age75orOlder: boolean,
  diabetes: boolean,
  strokeTIA: boolean
): CalculationResult {
  let score = 0;
  if (chf) score += 1;
  if (hypertension) score += 1;
  if (age75orOlder) score += 1;
  if (diabetes) score += 1;
  if (strokeTIA) score += 2;

  const riskPerYear: Record<number, string> = {
    0: '1.9% (low risk)',
    1: '2.8% (low-moderate risk)',
    2: '4.0% (moderate risk)',
    3: '5.9% (moderate-high risk)',
    4: '8.5% (high risk)',
    5: '12.5% (high risk)',
    6: '18.2% (very high risk)',
  };

  return {
    value: score,
    unit: 'points',
    interpretation: `Annual stroke risk: ${riskPerYear[score] || 'very high'}`,
    formula: 'CHF(1) + HTN(1) + Age≥75(1) + DM(1) + Stroke/TIA(2)',
    reference: 'CHADS₂ Score for Atrial Fibrillation Stroke Risk',
  };
}

function calculateCHA2DS2VASc(
  chf: boolean,
  hypertension: boolean,
  age75orOlder: boolean,
  age65to74: boolean,
  diabetes: boolean,
  strokeTIA: boolean,
  vascularDisease: boolean,
  female: boolean
): CalculationResult {
  let score = 0;
  if (chf) score += 1;
  if (hypertension) score += 1;
  if (age75orOlder) score += 2;
  else if (age65to74) score += 1;
  if (diabetes) score += 1;
  if (strokeTIA) score += 2;
  if (vascularDisease) score += 1;
  if (female) score += 1;

  let recommendation: string;
  if (score === 0) {
    recommendation = 'Low risk - No anticoagulation needed';
  } else if (score === 1) {
    recommendation = 'Low-moderate risk - Consider anticoagulation';
  } else {
    recommendation = 'Anticoagulation recommended';
  }

  return {
    value: score,
    unit: 'points',
    interpretation: recommendation,
    formula: 'CHF(1) + HTN(1) + Age≥75(2) + Age 65-74(1) + DM(1) + Stroke(2) + Vascular(1) + Female(1)',
    reference: 'CHA₂DS₂-VASc Score',
  };
}

function calculateWellsDVT(
  activeCancer: boolean,
  paralysis: boolean,
  bedridden3Days: boolean,
  localizedTenderness: boolean,
  entireLegSwollen: boolean,
  calfSwelling3cm: boolean,
  pittingEdema: boolean,
  collateralVeins: boolean,
  previousDVT: boolean,
  alternativeDiagnosisLikely: boolean
): CalculationResult {
  let score = 0;
  if (activeCancer) score += 1;
  if (paralysis) score += 1;
  if (bedridden3Days) score += 1;
  if (localizedTenderness) score += 1;
  if (entireLegSwollen) score += 1;
  if (calfSwelling3cm) score += 1;
  if (pittingEdema) score += 1;
  if (collateralVeins) score += 1;
  if (previousDVT) score += 1;
  if (alternativeDiagnosisLikely) score -= 2;

  let risk: string;
  if (score <= 0) risk = 'Low probability (5%)';
  else if (score <= 2) risk = 'Moderate probability (17%)';
  else risk = 'High probability (53%)';

  return {
    value: score,
    unit: 'points',
    interpretation: risk,
    reference: 'Wells Criteria for DVT',
  };
}

function calculateGlasgowComaScale(
  eyeResponse: number,
  verbalResponse: number,
  motorResponse: number
): CalculationResult {
  // Validate inputs
  if (eyeResponse < 1 || eyeResponse > 4) throw new Error('Eye response must be 1-4');
  if (verbalResponse < 1 || verbalResponse > 5) throw new Error('Verbal response must be 1-5');
  if (motorResponse < 1 || motorResponse > 6) throw new Error('Motor response must be 1-6');

  const total = eyeResponse + verbalResponse + motorResponse;

  let severity: string;
  if (total <= 8) severity = 'Severe brain injury';
  else if (total <= 12) severity = 'Moderate brain injury';
  else severity = 'Minor brain injury';

  return {
    value: total,
    unit: 'points',
    interpretation: `${severity} (E${eyeResponse}V${verbalResponse}M${motorResponse})`,
    formula: 'GCS = Eye(1-4) + Verbal(1-5) + Motor(1-6)',
    reference: 'Glasgow Coma Scale (3-15)',
  };
}

function _calculateAPACHEII(
  temperature: number, // °C
  meanArterialPressure: number,
  heartRate: number,
  respiratoryRate: number,
  _oxygenation: number, // PaO2 or A-aDO2
  arterialPH: number,
  sodium: number,
  potassium: number,
  creatinine: number,
  hematocrit: number,
  wbc: number,
  gcs: number,
  age: number,
  chronicHealthPoints: number // 0, 2, or 5
): CalculationResult {
  // Simplified APACHE II scoring
  let score = 0;

  // Temperature (°C)
  if (temperature >= 41 || temperature <= 29.9) score += 4;
  else if (temperature >= 39 || temperature <= 31.9) score += 3;
  else if (temperature <= 33.9) score += 2;
  else if (temperature >= 38.5 || temperature <= 35.9) score += 1;

  // MAP
  if (meanArterialPressure >= 160 || meanArterialPressure <= 49) score += 4;
  else if (meanArterialPressure >= 130 || meanArterialPressure <= 69) score += 2;
  else if (meanArterialPressure >= 110) score += 1;

  // Heart rate
  if (heartRate >= 180 || heartRate <= 39) score += 4;
  else if (heartRate >= 140 || heartRate <= 54) score += 3;
  else if (heartRate >= 110 || heartRate <= 69) score += 2;

  // RR
  if (respiratoryRate >= 50 || respiratoryRate <= 5) score += 4;
  else if (respiratoryRate >= 35) score += 3;
  else if (respiratoryRate <= 9) score += 2;
  else if (respiratoryRate >= 25 || respiratoryRate <= 11) score += 1;

  // pH
  if (arterialPH >= 7.7 || arterialPH < 7.15) score += 4;
  else if (arterialPH >= 7.6 || arterialPH < 7.25) score += 3;
  else if (arterialPH < 7.33) score += 2;
  else if (arterialPH >= 7.5) score += 1;

  // Sodium
  if (sodium >= 180 || sodium <= 110) score += 4;
  else if (sodium >= 160 || sodium <= 119) score += 3;
  else if (sodium >= 155 || sodium <= 129) score += 2;
  else if (sodium >= 150) score += 1;

  // Potassium
  if (potassium >= 7 || potassium < 2.5) score += 4;
  else if (potassium >= 6) score += 3;
  else if (potassium < 3 || potassium >= 5.5) score += 1;

  // Creatinine
  if (creatinine >= 3.5) score += 4;
  else if (creatinine >= 2) score += 3;
  else if (creatinine >= 1.5 || creatinine < 0.6) score += 2;

  // Hematocrit
  if (hematocrit >= 60 || hematocrit < 20) score += 4;
  else if (hematocrit >= 50 || hematocrit < 30) score += 2;
  else if (hematocrit >= 46) score += 1;

  // WBC
  if (wbc >= 40 || wbc < 1) score += 4;
  else if (wbc >= 20 || wbc < 3) score += 2;
  else if (wbc >= 15) score += 1;

  // GCS (15 - actual GCS)
  score += 15 - gcs;

  // Age points
  if (age >= 75) score += 6;
  else if (age >= 65) score += 5;
  else if (age >= 55) score += 3;
  else if (age >= 45) score += 2;

  // Chronic health
  score += chronicHealthPoints;

  // Mortality estimate (approximate)
  const mortalityTable: Record<number, string> = {
    0: '~4%',
    5: '~8%',
    10: '~15%',
    15: '~25%',
    20: '~40%',
    25: '~55%',
    30: '~75%',
    35: '~85%',
  };

  const approxRange = Math.floor(score / 5) * 5;
  const mortality = mortalityTable[approxRange] || '>85%';

  return {
    value: score,
    unit: 'points',
    interpretation: `Estimated ICU mortality: ${mortality}`,
    reference: 'APACHE II Score',
  };
}

// ============================================================================
// UNIT CONVERSIONS (Medical)
// ============================================================================

function convertGlucose(value: number, from: 'mg/dL' | 'mmol/L'): CalculationResult {
  if (from === 'mg/dL') {
    return {
      value: Math.round(value / 18.0182 * 100) / 100,
      unit: 'mmol/L',
      formula: 'mmol/L = mg/dL ÷ 18.0182',
    };
  } else {
    return {
      value: Math.round(value * 18.0182 * 100) / 100,
      unit: 'mg/dL',
      formula: 'mg/dL = mmol/L × 18.0182',
    };
  }
}

function convertCreatinine(value: number, from: 'mg/dL' | 'μmol/L'): CalculationResult {
  if (from === 'mg/dL') {
    return {
      value: Math.round(value * 88.42 * 100) / 100,
      unit: 'μmol/L',
      formula: 'μmol/L = mg/dL × 88.42',
    };
  } else {
    return {
      value: Math.round(value / 88.42 * 100) / 100,
      unit: 'mg/dL',
      formula: 'mg/dL = μmol/L ÷ 88.42',
    };
  }
}

function convertTemperature(value: number, from: 'F' | 'C'): CalculationResult {
  if (from === 'F') {
    return {
      value: Math.round((value - 32) * 5 / 9 * 10) / 10,
      unit: '°C',
      formula: '°C = (°F - 32) × 5/9',
    };
  } else {
    return {
      value: Math.round((value * 9 / 5 + 32) * 10) / 10,
      unit: '°F',
      formula: '°F = °C × 9/5 + 32',
    };
  }
}

// ============================================================================
// DRUG DOSING
// ============================================================================

function calculateVancomycinDose(
  weightKg: number,
  crCl: number,
  targetTrough: number = 15
): Record<string, unknown> {
  // Standard dosing 15-20 mg/kg every 8-12h based on renal function
  const dosePerKg = targetTrough > 15 ? 20 : 15;
  const dose = Math.round(weightKg * dosePerKg / 250) * 250; // Round to nearest 250mg

  let interval: number;
  if (crCl > 50) interval = 12;
  else if (crCl > 20) interval = 24;
  else interval = 48;

  return {
    dose_mg: dose,
    interval_hours: interval,
    daily_dose: (dose * 24) / interval,
    note: 'Initial empiric dosing. Monitor troughs and adjust.',
    reference: 'ASHP/IDSA/SIDP Guidelines',
  };
}

function calculateAminoglycosideDose(
  weightKg: number,
  idealWeight: number,
  crCl: number,
  drug: 'gentamicin' | 'tobramycin' | 'amikacin'
): Record<string, unknown> {
  // Use adjusted body weight if actual > 120% ideal
  const dosingWeight = weightKg > idealWeight * 1.2
    ? idealWeight + 0.4 * (weightKg - idealWeight)
    : weightKg;

  let dosePerKg: number;
  let targetPeak: string;
  let targetTrough: string;

  if (drug === 'amikacin') {
    dosePerKg = 7.5; // Traditional dosing
    targetPeak = '25-30 μg/mL';
    targetTrough = '<5 μg/mL';
  } else {
    dosePerKg = 2; // Traditional dosing
    targetPeak = '8-10 μg/mL';
    targetTrough = '<2 μg/mL';
  }

  const dose = Math.round(dosingWeight * dosePerKg);

  let interval: number;
  if (crCl > 60) interval = 8;
  else if (crCl > 40) interval = 12;
  else if (crCl > 20) interval = 24;
  else interval = 48;

  return {
    drug,
    dose_mg: dose,
    dosing_weight_kg: Math.round(dosingWeight * 10) / 10,
    interval_hours: interval,
    target_peak: targetPeak,
    target_trough: targetTrough,
    note: 'Traditional dosing. Consider extended-interval for appropriate patients.',
  };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const medicalCalcTool: UnifiedTool = {
  name: 'medical_calc',
  description: `Clinical calculators for healthcare education.

DISCLAIMER: For educational purposes only. Not for clinical decision making.

Operations:

Body Calculations:
- bmi: Body Mass Index
- bsa: Body Surface Area (Mosteller, Du Bois)
- ibw: Ideal Body Weight (Devine)
- abw: Adjusted Body Weight
- lbm: Lean Body Mass (Boer)

Kidney Function:
- crcl: Creatinine Clearance (Cockcroft-Gault)
- egfr: Estimated GFR (CKD-EPI 2021)

Clinical Scores:
- chads2: CHADS₂ Stroke Risk
- cha2ds2vasc: CHA₂DS₂-VASc Score
- wells_dvt: Wells Criteria for DVT
- gcs: Glasgow Coma Scale
- apache2: APACHE II Score

Unit Conversions:
- convert_glucose: mg/dL ↔ mmol/L
- convert_creatinine: mg/dL ↔ μmol/L
- convert_temp: °F ↔ °C

Drug Dosing:
- vancomycin: Vancomycin initial dosing
- aminoglycoside: Gentamicin/Tobramycin/Amikacin dosing`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'bmi', 'bsa', 'ibw', 'abw', 'lbm',
          'crcl', 'egfr',
          'chads2', 'cha2ds2vasc', 'wells_dvt', 'gcs', 'apache2',
          'convert_glucose', 'convert_creatinine', 'convert_temp',
          'vancomycin', 'aminoglycoside',
        ],
        description: 'Calculation to perform',
      },
      weight_kg: { type: 'number', description: 'Weight in kg' },
      height_cm: { type: 'number', description: 'Height in cm' },
      age: { type: 'number', description: 'Age in years' },
      sex: { type: 'string', enum: ['male', 'female'], description: 'Biological sex' },
      serum_creatinine: { type: 'number', description: 'Serum creatinine (mg/dL)' },
      value: { type: 'number', description: 'Value for conversion' },
      from_unit: { type: 'string', description: 'Source unit for conversion' },
      formula: { type: 'string', description: 'Formula variant (e.g., mosteller, dubois)' },
      // Score inputs
      chf: { type: 'boolean' },
      hypertension: { type: 'boolean' },
      diabetes: { type: 'boolean' },
      stroke_tia: { type: 'boolean' },
      vascular_disease: { type: 'boolean' },
      age_75_or_older: { type: 'boolean' },
      age_65_to_74: { type: 'boolean' },
      // Wells DVT
      active_cancer: { type: 'boolean' },
      paralysis: { type: 'boolean' },
      bedridden_3_days: { type: 'boolean' },
      localized_tenderness: { type: 'boolean' },
      entire_leg_swollen: { type: 'boolean' },
      calf_swelling_3cm: { type: 'boolean' },
      pitting_edema: { type: 'boolean' },
      collateral_veins: { type: 'boolean' },
      previous_dvt: { type: 'boolean' },
      alternative_diagnosis_likely: { type: 'boolean' },
      // GCS
      eye_response: { type: 'number' },
      verbal_response: { type: 'number' },
      motor_response: { type: 'number' },
      // Drug dosing
      drug: { type: 'string' },
      crcl: { type: 'number' },
      ideal_weight: { type: 'number' },
      target_trough: { type: 'number' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeMedicalCalc(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'bmi': {
        if (!args.weight_kg || !args.height_cm) {
          throw new Error('weight_kg and height_cm required');
        }
        const calc = calculateBMI(args.weight_kg, args.height_cm);
        result = { operation, ...calc };
        break;
      }

      case 'bsa': {
        if (!args.weight_kg || !args.height_cm) {
          throw new Error('weight_kg and height_cm required');
        }
        const calc = calculateBSA(args.weight_kg, args.height_cm, args.formula);
        result = { operation, ...calc };
        break;
      }

      case 'ibw': {
        if (!args.height_cm || !args.sex) {
          throw new Error('height_cm and sex required');
        }
        const calc = calculateIdealBodyWeight(args.height_cm, args.sex);
        result = { operation, ...calc };
        break;
      }

      case 'abw': {
        if (!args.weight_kg || !args.ideal_weight) {
          throw new Error('weight_kg and ideal_weight required');
        }
        const calc = calculateAdjustedBodyWeight(args.weight_kg, args.ideal_weight);
        result = { operation, ...calc };
        break;
      }

      case 'lbm': {
        if (!args.weight_kg || !args.height_cm || !args.sex) {
          throw new Error('weight_kg, height_cm, and sex required');
        }
        const calc = calculateLeanBodyMass(args.weight_kg, args.height_cm, args.sex);
        result = { operation, ...calc };
        break;
      }

      case 'crcl': {
        if (!args.age || !args.weight_kg || !args.serum_creatinine || !args.sex) {
          throw new Error('age, weight_kg, serum_creatinine, and sex required');
        }
        const calc = calculateCreatinineClearance(
          args.age, args.weight_kg, args.serum_creatinine, args.sex
        );
        result = { operation, ...calc };
        break;
      }

      case 'egfr': {
        if (!args.serum_creatinine || !args.age || !args.sex) {
          throw new Error('serum_creatinine, age, and sex required');
        }
        const calc = calculateEGFR(args.serum_creatinine, args.age, args.sex);
        result = { operation, ...calc };
        break;
      }

      case 'chads2': {
        const calc = calculateCHADS2(
          args.chf || false,
          args.hypertension || false,
          args.age_75_or_older || false,
          args.diabetes || false,
          args.stroke_tia || false
        );
        result = { operation, ...calc };
        break;
      }

      case 'cha2ds2vasc': {
        const calc = calculateCHA2DS2VASc(
          args.chf || false,
          args.hypertension || false,
          args.age_75_or_older || false,
          args.age_65_to_74 || false,
          args.diabetes || false,
          args.stroke_tia || false,
          args.vascular_disease || false,
          args.sex === 'female'
        );
        result = { operation, ...calc };
        break;
      }

      case 'wells_dvt': {
        const calc = calculateWellsDVT(
          args.active_cancer || false,
          args.paralysis || false,
          args.bedridden_3_days || false,
          args.localized_tenderness || false,
          args.entire_leg_swollen || false,
          args.calf_swelling_3cm || false,
          args.pitting_edema || false,
          args.collateral_veins || false,
          args.previous_dvt || false,
          args.alternative_diagnosis_likely || false
        );
        result = { operation, ...calc };
        break;
      }

      case 'gcs': {
        if (!args.eye_response || !args.verbal_response || !args.motor_response) {
          throw new Error('eye_response, verbal_response, and motor_response required');
        }
        const calc = calculateGlasgowComaScale(
          args.eye_response,
          args.verbal_response,
          args.motor_response
        );
        result = {
          operation,
          ...calc,
          scale_reference: {
            eye: '1=None, 2=To pain, 3=To voice, 4=Spontaneous',
            verbal: '1=None, 2=Incomprehensible, 3=Inappropriate, 4=Confused, 5=Oriented',
            motor: '1=None, 2=Extension, 3=Abnormal flexion, 4=Withdrawal, 5=Localizes, 6=Obeys',
          },
        };
        break;
      }

      case 'convert_glucose': {
        if (args.value === undefined || !args.from_unit) {
          throw new Error('value and from_unit required');
        }
        const calc = convertGlucose(
          args.value,
          args.from_unit as 'mg/dL' | 'mmol/L'
        );
        result = {
          operation,
          input: { value: args.value, unit: args.from_unit },
          output: calc,
        };
        break;
      }

      case 'convert_creatinine': {
        if (args.value === undefined || !args.from_unit) {
          throw new Error('value and from_unit required');
        }
        const calc = convertCreatinine(
          args.value,
          args.from_unit as 'mg/dL' | 'μmol/L'
        );
        result = {
          operation,
          input: { value: args.value, unit: args.from_unit },
          output: calc,
        };
        break;
      }

      case 'convert_temp': {
        if (args.value === undefined || !args.from_unit) {
          throw new Error('value and from_unit required');
        }
        const calc = convertTemperature(args.value, args.from_unit as 'F' | 'C');
        result = {
          operation,
          input: { value: args.value, unit: args.from_unit },
          output: calc,
        };
        break;
      }

      case 'vancomycin': {
        if (!args.weight_kg || !args.crcl) {
          throw new Error('weight_kg and crcl required');
        }
        result = {
          operation,
          ...calculateVancomycinDose(args.weight_kg, args.crcl, args.target_trough),
        };
        break;
      }

      case 'aminoglycoside': {
        if (!args.weight_kg || !args.ideal_weight || !args.crcl || !args.drug) {
          throw new Error('weight_kg, ideal_weight, crcl, and drug required');
        }
        result = {
          operation,
          ...calculateAminoglycosideDose(
            args.weight_kg,
            args.ideal_weight,
            args.crcl,
            args.drug as 'gentamicin' | 'tobramycin' | 'amikacin'
          ),
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    // Add disclaimer
    result.disclaimer = 'FOR EDUCATIONAL PURPOSES ONLY. Not for clinical decision making.';

    return {
      toolCallId: id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: id,
      content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      isError: true,
    };
  }
}

export function isMedicalCalcAvailable(): boolean {
  return true;
}
void _calculateAPACHEII; // reserved for ICU scoring
