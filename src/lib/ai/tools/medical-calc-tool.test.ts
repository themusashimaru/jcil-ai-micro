import { describe, it, expect } from 'vitest';
import { executeMedicalCalc, isMedicalCalcAvailable, medicalCalcTool } from './medical-calc-tool';

// Helper to create a tool call
function makeCall(args: Record<string, unknown>) {
  return { id: 'test-call', name: 'medical_calc', arguments: args };
}

// Helper to parse result content
async function getResult(args: Record<string, unknown>) {
  const res = await executeMedicalCalc(makeCall(args));
  return JSON.parse(res.content);
}

// -------------------------------------------------------------------
// Tool metadata
// -------------------------------------------------------------------
describe('medicalCalcTool metadata', () => {
  it('should have name medical_calc', () => {
    expect(medicalCalcTool.name).toBe('medical_calc');
  });

  it('should have operation as required parameter', () => {
    expect(medicalCalcTool.parameters.required).toContain('operation');
  });

  it('should list all operation types in enum', () => {
    const ops = medicalCalcTool.parameters.properties.operation.enum;
    expect(ops).toContain('bmi');
    expect(ops).toContain('bsa');
    expect(ops).toContain('crcl');
    expect(ops).toContain('egfr');
    expect(ops).toContain('chads2');
    expect(ops).toContain('convert_temp');
    expect(ops).toContain('vancomycin');
  });
});

describe('isMedicalCalcAvailable', () => {
  it('should return true', () => {
    expect(isMedicalCalcAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// BMI
// -------------------------------------------------------------------
describe('executeMedicalCalc - BMI', () => {
  it('should calculate BMI for normal weight', async () => {
    const result = await getResult({ operation: 'bmi', weight_kg: 70, height_cm: 175 });
    expect(result.value).toBeCloseTo(22.9, 0);
    expect(result.unit).toBe('kg/m²');
    expect(result.interpretation).toBe('Normal weight');
  });

  it('should classify underweight', async () => {
    const result = await getResult({ operation: 'bmi', weight_kg: 45, height_cm: 175 });
    expect(result.interpretation).toBe('Underweight');
  });

  it('should classify overweight', async () => {
    const result = await getResult({ operation: 'bmi', weight_kg: 85, height_cm: 175 });
    expect(result.interpretation).toBe('Overweight');
  });

  it('should classify obese', async () => {
    const result = await getResult({ operation: 'bmi', weight_kg: 120, height_cm: 175 });
    expect(result.interpretation).toContain('Obesity');
  });

  it('should require weight_kg and height_cm', async () => {
    const res = await executeMedicalCalc(makeCall({ operation: 'bmi' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('weight_kg');
  });

  it('should include disclaimer', async () => {
    const result = await getResult({ operation: 'bmi', weight_kg: 70, height_cm: 175 });
    expect(result.disclaimer).toContain('EDUCATIONAL');
  });
});

// -------------------------------------------------------------------
// BSA
// -------------------------------------------------------------------
describe('executeMedicalCalc - BSA', () => {
  it('should calculate BSA with Mosteller formula', async () => {
    const result = await getResult({ operation: 'bsa', weight_kg: 70, height_cm: 175 });
    // Mosteller: sqrt(175 * 70 / 3600) ≈ 1.84
    expect(result.value).toBeGreaterThan(1.5);
    expect(result.value).toBeLessThan(2.5);
    expect(result.unit).toBe('m²');
  });

  it('should support Du Bois formula', async () => {
    const result = await getResult({
      operation: 'bsa',
      weight_kg: 70,
      height_cm: 175,
      formula: 'dubois',
    });
    expect(result.value).toBeGreaterThan(1.5);
    expect(result.formula).toContain('Du Bois');
  });
});

// -------------------------------------------------------------------
// Ideal Body Weight
// -------------------------------------------------------------------
describe('executeMedicalCalc - IBW', () => {
  it('should calculate IBW for male', async () => {
    const result = await getResult({ operation: 'ibw', height_cm: 175, sex: 'male' });
    // Devine: 50 + 2.3 * (68.9 - 60) ≈ 70.5
    expect(result.value).toBeGreaterThan(60);
    expect(result.value).toBeLessThan(85);
    expect(result.unit).toBe('kg');
  });

  it('should calculate IBW for female', async () => {
    const result = await getResult({ operation: 'ibw', height_cm: 165, sex: 'female' });
    // Devine: 45.5 + 2.3 * (65 - 60) ≈ 57.0
    expect(result.value).toBeGreaterThan(50);
    expect(result.value).toBeLessThan(70);
  });

  it('should require height_cm and sex', async () => {
    const res = await executeMedicalCalc(makeCall({ operation: 'ibw' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// Adjusted Body Weight
// -------------------------------------------------------------------
describe('executeMedicalCalc - ABW', () => {
  it('should calculate ABW', async () => {
    const result = await getResult({
      operation: 'abw',
      weight_kg: 100,
      ideal_weight: 70,
    });
    // ABW = 70 + 0.4 * (100 - 70) = 82
    expect(result.value).toBeCloseTo(82, 0);
    expect(result.unit).toBe('kg');
  });
});

// -------------------------------------------------------------------
// Lean Body Mass
// -------------------------------------------------------------------
describe('executeMedicalCalc - LBM', () => {
  it('should calculate LBM for male', async () => {
    const result = await getResult({
      operation: 'lbm',
      weight_kg: 80,
      height_cm: 180,
      sex: 'male',
    });
    // Boer: 0.407*80 + 0.267*180 - 19.2 = 32.56 + 48.06 - 19.2 = 61.42
    expect(result.value).toBeGreaterThan(50);
    expect(result.value).toBeLessThan(75);
    expect(result.unit).toBe('kg');
  });

  it('should calculate LBM for female', async () => {
    const result = await getResult({
      operation: 'lbm',
      weight_kg: 65,
      height_cm: 165,
      sex: 'female',
    });
    expect(result.value).toBeGreaterThan(30);
    expect(result.value).toBeLessThan(55);
  });
});

// -------------------------------------------------------------------
// Creatinine Clearance
// -------------------------------------------------------------------
describe('executeMedicalCalc - CrCl', () => {
  it('should calculate CrCl for male', async () => {
    const result = await getResult({
      operation: 'crcl',
      age: 50,
      weight_kg: 75,
      serum_creatinine: 1.0,
      sex: 'male',
    });
    // CrCl = (140-50)*75 / (72*1.0) = 93.75
    expect(result.value).toBeCloseTo(93.8, 0);
    expect(result.unit).toBe('mL/min');
    expect(result.interpretation).toBe('Normal or high');
  });

  it('should apply female correction factor', async () => {
    const male = await getResult({
      operation: 'crcl',
      age: 50,
      weight_kg: 75,
      serum_creatinine: 1.0,
      sex: 'male',
    });
    const female = await getResult({
      operation: 'crcl',
      age: 50,
      weight_kg: 75,
      serum_creatinine: 1.0,
      sex: 'female',
    });
    expect(female.value).toBeCloseTo(male.value * 0.85, 0);
  });

  it('should classify kidney stages correctly', async () => {
    // Severely decreased: CrCl 15-29
    const result = await getResult({
      operation: 'crcl',
      age: 80,
      weight_kg: 50,
      serum_creatinine: 3.0,
      sex: 'male',
    });
    expect(result.value).toBeLessThan(30);
  });
});

// -------------------------------------------------------------------
// eGFR
// -------------------------------------------------------------------
describe('executeMedicalCalc - eGFR', () => {
  it('should calculate eGFR', async () => {
    const result = await getResult({
      operation: 'egfr',
      serum_creatinine: 1.0,
      age: 50,
      sex: 'male',
    });
    expect(result.value).toBeGreaterThan(0);
    expect(result.unit).toBe('mL/min/1.73m²');
    expect(result.interpretation).toBeDefined();
  });

  it('should require all parameters', async () => {
    const res = await executeMedicalCalc(makeCall({ operation: 'egfr' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// CHADS2
// -------------------------------------------------------------------
describe('executeMedicalCalc - CHADS2', () => {
  it('should return 0 for no risk factors', async () => {
    const result = await getResult({ operation: 'chads2' });
    expect(result.value).toBe(0);
    expect(result.unit).toBe('points');
  });

  it('should score 1 for single factor', async () => {
    const result = await getResult({ operation: 'chads2', hypertension: true });
    expect(result.value).toBe(1);
  });

  it('should score 2 for stroke/TIA (double weight)', async () => {
    const result = await getResult({ operation: 'chads2', stroke_tia: true });
    expect(result.value).toBe(2);
  });

  it('should sum all factors to max 6', async () => {
    const result = await getResult({
      operation: 'chads2',
      chf: true,
      hypertension: true,
      age_75_or_older: true,
      diabetes: true,
      stroke_tia: true,
    });
    expect(result.value).toBe(6);
  });
});

// -------------------------------------------------------------------
// CHA2DS2-VASc
// -------------------------------------------------------------------
describe('executeMedicalCalc - CHA2DS2-VASc', () => {
  it('should return 0 for no risk factors', async () => {
    const result = await getResult({ operation: 'cha2ds2vasc' });
    expect(result.value).toBe(0);
  });

  it('should score age≥75 as 2 points', async () => {
    const result = await getResult({ operation: 'cha2ds2vasc', age_75_or_older: true });
    expect(result.value).toBe(2);
  });

  it('should score female as 1 point', async () => {
    const result = await getResult({ operation: 'cha2ds2vasc', sex: 'female' });
    expect(result.value).toBe(1);
  });
});

// -------------------------------------------------------------------
// Wells DVT
// -------------------------------------------------------------------
describe('executeMedicalCalc - Wells DVT', () => {
  it('should return 0 for no risk factors', async () => {
    const result = await getResult({ operation: 'wells_dvt' });
    expect(result.value).toBe(0);
    expect(result.interpretation).toContain('Low');
  });

  it('should add points for risk factors', async () => {
    const result = await getResult({
      operation: 'wells_dvt',
      active_cancer: true,
      localized_tenderness: true,
    });
    expect(result.value).toBeGreaterThan(0);
  });

  it('should subtract for alternative diagnosis', async () => {
    const with_alt = await getResult({
      operation: 'wells_dvt',
      active_cancer: true,
      alternative_diagnosis_likely: true,
    });
    const without_alt = await getResult({
      operation: 'wells_dvt',
      active_cancer: true,
    });
    expect(with_alt.value).toBeLessThan(without_alt.value);
  });
});

// -------------------------------------------------------------------
// Glasgow Coma Scale
// -------------------------------------------------------------------
describe('executeMedicalCalc - GCS', () => {
  it('should calculate perfect GCS score of 15', async () => {
    const result = await getResult({
      operation: 'gcs',
      eye_response: 4,
      verbal_response: 5,
      motor_response: 6,
    });
    expect(result.value).toBe(15);
    expect(result.interpretation).toContain('Minor brain injury');
  });

  it('should calculate minimum GCS score of 3', async () => {
    const result = await getResult({
      operation: 'gcs',
      eye_response: 1,
      verbal_response: 1,
      motor_response: 1,
    });
    expect(result.value).toBe(3);
  });

  it('should include scale reference', async () => {
    const result = await getResult({
      operation: 'gcs',
      eye_response: 4,
      verbal_response: 5,
      motor_response: 6,
    });
    expect(result.scale_reference).toBeDefined();
    expect(result.scale_reference.eye).toBeDefined();
  });

  it('should require all three parameters', async () => {
    const res = await executeMedicalCalc(makeCall({ operation: 'gcs' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// Unit conversions
// -------------------------------------------------------------------
describe('executeMedicalCalc - Conversions', () => {
  it('should convert glucose mg/dL to mmol/L', async () => {
    const result = await getResult({
      operation: 'convert_glucose',
      value: 100,
      from_unit: 'mg/dL',
    });
    // 100 mg/dL ÷ 18.0182 ≈ 5.55 mmol/L
    expect(result.output.value).toBeCloseTo(5.6, 0);
  });

  it('should convert glucose mmol/L to mg/dL', async () => {
    const result = await getResult({
      operation: 'convert_glucose',
      value: 5.5,
      from_unit: 'mmol/L',
    });
    expect(result.output.value).toBeCloseTo(99, 0);
  });

  it('should convert temperature F to C', async () => {
    const result = await getResult({
      operation: 'convert_temp',
      value: 98.6,
      from_unit: 'F',
    });
    expect(result.output.value).toBeCloseTo(37, 0);
  });

  it('should convert temperature C to F', async () => {
    const result = await getResult({
      operation: 'convert_temp',
      value: 37,
      from_unit: 'C',
    });
    expect(result.output.value).toBeCloseTo(98.6, 0);
  });

  it('should convert creatinine mg/dL to μmol/L', async () => {
    const result = await getResult({
      operation: 'convert_creatinine',
      value: 1.0,
      from_unit: 'mg/dL',
    });
    // 1.0 mg/dL * 88.4 = 88.4 μmol/L
    expect(result.output.value).toBeCloseTo(88.4, 0);
  });

  it('should require value and from_unit', async () => {
    const res = await executeMedicalCalc(makeCall({ operation: 'convert_temp' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// Drug dosing
// -------------------------------------------------------------------
describe('executeMedicalCalc - Drug dosing', () => {
  it('should calculate vancomycin dose', async () => {
    const result = await getResult({
      operation: 'vancomycin',
      weight_kg: 70,
      crcl: 90,
    });
    expect(result.operation).toBe('vancomycin');
    expect(result.disclaimer).toContain('EDUCATIONAL');
  });

  it('should require weight and crcl for vancomycin', async () => {
    const res = await executeMedicalCalc(makeCall({ operation: 'vancomycin' }));
    expect(res.isError).toBe(true);
  });

  it('should calculate aminoglycoside dose', async () => {
    const result = await getResult({
      operation: 'aminoglycoside',
      weight_kg: 80,
      ideal_weight: 70,
      crcl: 90,
      drug: 'gentamicin',
    });
    expect(result.operation).toBe('aminoglycoside');
  });

  it('should require all params for aminoglycoside', async () => {
    const res = await executeMedicalCalc(makeCall({ operation: 'aminoglycoside' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeMedicalCalc - errors', () => {
  it('should return error for unknown operation', async () => {
    const res = await executeMedicalCalc(makeCall({ operation: 'unknown_op' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Unknown operation');
  });

  it('should handle string arguments (JSON string)', async () => {
    const res = await executeMedicalCalc({
      id: 'test',
      name: 'medical_calc',
      arguments: JSON.stringify({ operation: 'bmi', weight_kg: 70, height_cm: 175 }),
    });
    expect(res.isError).toBeUndefined();
    const parsed = JSON.parse(res.content);
    expect(parsed.value).toBeGreaterThan(0);
  });

  it('should return toolCallId matching input', async () => {
    const res = await executeMedicalCalc({
      id: 'my-unique-id',
      name: 'medical_calc',
      arguments: { operation: 'bmi', weight_kg: 70, height_cm: 175 },
    });
    expect(res.toolCallId).toBe('my-unique-id');
  });
});
