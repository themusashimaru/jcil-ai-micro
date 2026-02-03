/**
 * LAB-VALUES TOOL
 * Comprehensive laboratory value interpreter with reference ranges,
 * critical value detection, and clinical significance analysis
 *
 * Features:
 * - Reference ranges for common lab tests (age/gender-specific)
 * - Critical value detection with alerts
 * - Panel interpretation (CBC, BMP, CMP, LFTs, lipids, thyroid, coagulation)
 * - Unit conversions between SI and conventional units
 * - Clinical significance explanations
 * - Trending analysis for serial values
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// LAB TEST DEFINITIONS
// ============================================================================

interface ReferenceRange {
  low: number;
  high: number;
  criticalLow?: number;
  criticalHigh?: number;
  unit: string;
  siUnit?: string;
  siConversion?: number;
}

interface LabTestDefinition {
  name: string;
  abbreviation: string;
  category: string;
  referenceRanges: {
    adult_male?: ReferenceRange;
    adult_female?: ReferenceRange;
    adult?: ReferenceRange;
    pediatric?: ReferenceRange;
    newborn?: ReferenceRange;
  };
  description: string;
  clinicalSignificance: {
    high: string[];
    low: string[];
  };
}

// ============================================================================
// LAB TEST DATABASE
// ============================================================================

const labTests: Record<string, LabTestDefinition> = {
  // Complete Blood Count (CBC)
  wbc: {
    name: 'White Blood Cell Count',
    abbreviation: 'WBC',
    category: 'CBC',
    referenceRanges: {
      adult: {
        low: 4.5,
        high: 11.0,
        criticalLow: 2.0,
        criticalHigh: 30.0,
        unit: 'x10^3/µL',
        siUnit: 'x10^9/L',
        siConversion: 1,
      },
    },
    description: 'Measures the number of white blood cells in blood',
    clinicalSignificance: {
      high: ['Infection', 'Inflammation', 'Leukemia', 'Stress response', 'Corticosteroid use'],
      low: [
        'Bone marrow suppression',
        'Chemotherapy',
        'Viral infection',
        'Autoimmune disorders',
        'Aplastic anemia',
      ],
    },
  },
  rbc: {
    name: 'Red Blood Cell Count',
    abbreviation: 'RBC',
    category: 'CBC',
    referenceRanges: {
      adult_male: {
        low: 4.5,
        high: 5.5,
        criticalLow: 2.0,
        criticalHigh: 7.0,
        unit: 'x10^6/µL',
        siUnit: 'x10^12/L',
        siConversion: 1,
      },
      adult_female: {
        low: 4.0,
        high: 5.0,
        criticalLow: 2.0,
        criticalHigh: 7.0,
        unit: 'x10^6/µL',
        siUnit: 'x10^12/L',
        siConversion: 1,
      },
    },
    description: 'Measures the number of red blood cells in blood',
    clinicalSignificance: {
      high: ['Polycythemia vera', 'Dehydration', 'Chronic hypoxia', 'High altitude', 'Smoking'],
      low: ['Anemia', 'Blood loss', 'Bone marrow failure', 'Hemolysis', 'Nutritional deficiency'],
    },
  },
  hemoglobin: {
    name: 'Hemoglobin',
    abbreviation: 'Hgb',
    category: 'CBC',
    referenceRanges: {
      adult_male: {
        low: 13.5,
        high: 17.5,
        criticalLow: 7.0,
        criticalHigh: 20.0,
        unit: 'g/dL',
        siUnit: 'g/L',
        siConversion: 10,
      },
      adult_female: {
        low: 12.0,
        high: 16.0,
        criticalLow: 7.0,
        criticalHigh: 20.0,
        unit: 'g/dL',
        siUnit: 'g/L',
        siConversion: 10,
      },
    },
    description: 'Oxygen-carrying protein in red blood cells',
    clinicalSignificance: {
      high: ['Polycythemia', 'Dehydration', 'Chronic lung disease', 'Congenital heart disease'],
      low: ['Anemia', 'Blood loss', 'Hemolysis', 'Bone marrow suppression', 'Chronic disease'],
    },
  },
  hematocrit: {
    name: 'Hematocrit',
    abbreviation: 'Hct',
    category: 'CBC',
    referenceRanges: {
      adult_male: {
        low: 38.8,
        high: 50.0,
        criticalLow: 20.0,
        criticalHigh: 60.0,
        unit: '%',
        siUnit: 'L/L',
        siConversion: 0.01,
      },
      adult_female: {
        low: 34.9,
        high: 44.5,
        criticalLow: 20.0,
        criticalHigh: 60.0,
        unit: '%',
        siUnit: 'L/L',
        siConversion: 0.01,
      },
    },
    description: 'Percentage of blood volume occupied by red blood cells',
    clinicalSignificance: {
      high: ['Polycythemia', 'Dehydration', 'Burns', 'COPD'],
      low: ['Anemia', 'Overhydration', 'Blood loss', 'Hemolysis'],
    },
  },
  platelets: {
    name: 'Platelet Count',
    abbreviation: 'PLT',
    category: 'CBC',
    referenceRanges: {
      adult: {
        low: 150,
        high: 400,
        criticalLow: 50,
        criticalHigh: 1000,
        unit: 'x10^3/µL',
        siUnit: 'x10^9/L',
        siConversion: 1,
      },
    },
    description: 'Cell fragments essential for blood clotting',
    clinicalSignificance: {
      high: [
        'Reactive thrombocytosis',
        'Essential thrombocythemia',
        'Iron deficiency',
        'Infection',
        'Malignancy',
      ],
      low: [
        'Thrombocytopenia',
        'Bone marrow failure',
        'ITP',
        'DIC',
        'Heparin-induced',
        'Chemotherapy',
      ],
    },
  },
  mcv: {
    name: 'Mean Corpuscular Volume',
    abbreviation: 'MCV',
    category: 'CBC',
    referenceRanges: {
      adult: { low: 80, high: 100, unit: 'fL' },
    },
    description: 'Average size of red blood cells',
    clinicalSignificance: {
      high: ['B12/folate deficiency', 'Liver disease', 'Hypothyroidism', 'Reticulocytosis', 'MDS'],
      low: ['Iron deficiency', 'Thalassemia', 'Chronic disease', 'Sideroblastic anemia'],
    },
  },
  mch: {
    name: 'Mean Corpuscular Hemoglobin',
    abbreviation: 'MCH',
    category: 'CBC',
    referenceRanges: {
      adult: { low: 27, high: 33, unit: 'pg' },
    },
    description: 'Average amount of hemoglobin per red blood cell',
    clinicalSignificance: {
      high: ['Macrocytic anemia', 'B12/folate deficiency'],
      low: ['Iron deficiency', 'Thalassemia', 'Chronic disease'],
    },
  },
  mchc: {
    name: 'Mean Corpuscular Hemoglobin Concentration',
    abbreviation: 'MCHC',
    category: 'CBC',
    referenceRanges: {
      adult: { low: 32, high: 36, unit: 'g/dL' },
    },
    description: 'Average concentration of hemoglobin in red blood cells',
    clinicalSignificance: {
      high: ['Spherocytosis', 'Severe dehydration'],
      low: ['Iron deficiency', 'Thalassemia'],
    },
  },
  rdw: {
    name: 'Red Cell Distribution Width',
    abbreviation: 'RDW',
    category: 'CBC',
    referenceRanges: {
      adult: { low: 11.5, high: 14.5, unit: '%' },
    },
    description: 'Variation in red blood cell size (anisocytosis)',
    clinicalSignificance: {
      high: [
        'Mixed anemia',
        'Iron deficiency',
        'B12/folate deficiency',
        'Hemolysis',
        'Reticulocytosis',
      ],
      low: ['Generally not clinically significant'],
    },
  },

  // Basic Metabolic Panel (BMP)
  glucose: {
    name: 'Glucose',
    abbreviation: 'Glu',
    category: 'BMP',
    referenceRanges: {
      adult: {
        low: 70,
        high: 100,
        criticalLow: 40,
        criticalHigh: 500,
        unit: 'mg/dL',
        siUnit: 'mmol/L',
        siConversion: 0.0555,
      },
    },
    description: 'Blood sugar level (fasting)',
    clinicalSignificance: {
      high: [
        'Diabetes mellitus',
        'Stress response',
        'Pancreatitis',
        'Cushing syndrome',
        'Medications',
      ],
      low: ['Insulin overdose', 'Insulinoma', 'Adrenal insufficiency', 'Liver failure', 'Sepsis'],
    },
  },
  bun: {
    name: 'Blood Urea Nitrogen',
    abbreviation: 'BUN',
    category: 'BMP',
    referenceRanges: {
      adult: {
        low: 7,
        high: 20,
        criticalHigh: 100,
        unit: 'mg/dL',
        siUnit: 'mmol/L',
        siConversion: 0.357,
      },
    },
    description: 'Waste product from protein metabolism filtered by kidneys',
    clinicalSignificance: {
      high: [
        'Renal failure',
        'Dehydration',
        'GI bleeding',
        'High protein diet',
        'Catabolic states',
      ],
      low: ['Liver failure', 'Malnutrition', 'Overhydration', 'SIADH'],
    },
  },
  creatinine: {
    name: 'Creatinine',
    abbreviation: 'Cr',
    category: 'BMP',
    referenceRanges: {
      adult_male: {
        low: 0.7,
        high: 1.3,
        criticalHigh: 10.0,
        unit: 'mg/dL',
        siUnit: 'µmol/L',
        siConversion: 88.4,
      },
      adult_female: {
        low: 0.6,
        high: 1.1,
        criticalHigh: 10.0,
        unit: 'mg/dL',
        siUnit: 'µmol/L',
        siConversion: 88.4,
      },
    },
    description: 'Waste product from muscle metabolism filtered by kidneys',
    clinicalSignificance: {
      high: ['Acute/chronic kidney disease', 'Dehydration', 'Rhabdomyolysis', 'Nephrotoxic drugs'],
      low: ['Decreased muscle mass', 'Severe liver disease', 'Pregnancy'],
    },
  },
  sodium: {
    name: 'Sodium',
    abbreviation: 'Na',
    category: 'BMP',
    referenceRanges: {
      adult: {
        low: 136,
        high: 145,
        criticalLow: 120,
        criticalHigh: 160,
        unit: 'mEq/L',
        siUnit: 'mmol/L',
        siConversion: 1,
      },
    },
    description: 'Major extracellular cation, important for fluid balance',
    clinicalSignificance: {
      high: ['Dehydration', 'Diabetes insipidus', 'Hyperaldosteronism', 'Salt ingestion'],
      low: ['SIADH', 'Diuretics', 'Heart failure', 'Cirrhosis', 'Adrenal insufficiency'],
    },
  },
  potassium: {
    name: 'Potassium',
    abbreviation: 'K',
    category: 'BMP',
    referenceRanges: {
      adult: {
        low: 3.5,
        high: 5.0,
        criticalLow: 2.5,
        criticalHigh: 6.5,
        unit: 'mEq/L',
        siUnit: 'mmol/L',
        siConversion: 1,
      },
    },
    description: 'Major intracellular cation, critical for cardiac function',
    clinicalSignificance: {
      high: [
        'Renal failure',
        'Acidosis',
        'Tissue destruction',
        'ACE inhibitors',
        'K-sparing diuretics',
      ],
      low: ['Diuretics', 'Vomiting/diarrhea', 'Hyperaldosteronism', 'Insulin', 'Alkalosis'],
    },
  },
  chloride: {
    name: 'Chloride',
    abbreviation: 'Cl',
    category: 'BMP',
    referenceRanges: {
      adult: {
        low: 98,
        high: 106,
        criticalLow: 80,
        criticalHigh: 120,
        unit: 'mEq/L',
        siUnit: 'mmol/L',
        siConversion: 1,
      },
    },
    description: 'Major extracellular anion, important for acid-base balance',
    clinicalSignificance: {
      high: ['Dehydration', 'Renal tubular acidosis', 'Hyperventilation', 'Metabolic acidosis'],
      low: ['Vomiting', 'Diuretics', 'SIADH', 'Metabolic alkalosis', 'Addison disease'],
    },
  },
  co2: {
    name: 'Carbon Dioxide (Bicarbonate)',
    abbreviation: 'CO2',
    category: 'BMP',
    referenceRanges: {
      adult: {
        low: 22,
        high: 28,
        criticalLow: 10,
        criticalHigh: 40,
        unit: 'mEq/L',
        siUnit: 'mmol/L',
        siConversion: 1,
      },
    },
    description: 'Bicarbonate level, reflects acid-base status',
    clinicalSignificance: {
      high: ['Metabolic alkalosis', 'Respiratory acidosis (compensation)', 'Vomiting', 'Diuretics'],
      low: [
        'Metabolic acidosis',
        'Respiratory alkalosis (compensation)',
        'Diarrhea',
        'Renal failure',
      ],
    },
  },
  calcium: {
    name: 'Calcium',
    abbreviation: 'Ca',
    category: 'BMP',
    referenceRanges: {
      adult: {
        low: 8.5,
        high: 10.5,
        criticalLow: 6.0,
        criticalHigh: 14.0,
        unit: 'mg/dL',
        siUnit: 'mmol/L',
        siConversion: 0.25,
      },
    },
    description: 'Important for bone health, muscle function, and nerve conduction',
    clinicalSignificance: {
      high: [
        'Hyperparathyroidism',
        'Malignancy',
        'Vitamin D toxicity',
        'Thiazides',
        'Immobilization',
      ],
      low: [
        'Hypoparathyroidism',
        'Vitamin D deficiency',
        'Chronic kidney disease',
        'Pancreatitis',
        'Hypomagnesemia',
      ],
    },
  },

  // Liver Function Tests (LFTs)
  alt: {
    name: 'Alanine Aminotransferase',
    abbreviation: 'ALT',
    category: 'LFT',
    referenceRanges: {
      adult_male: { low: 7, high: 56, criticalHigh: 1000, unit: 'U/L' },
      adult_female: { low: 7, high: 45, criticalHigh: 1000, unit: 'U/L' },
    },
    description: 'Liver enzyme, more specific for liver than AST',
    clinicalSignificance: {
      high: ['Hepatitis', 'Liver damage', 'NAFLD', 'Medications', 'Celiac disease'],
      low: ['Generally not clinically significant'],
    },
  },
  ast: {
    name: 'Aspartate Aminotransferase',
    abbreviation: 'AST',
    category: 'LFT',
    referenceRanges: {
      adult_male: { low: 10, high: 40, criticalHigh: 1000, unit: 'U/L' },
      adult_female: { low: 9, high: 32, criticalHigh: 1000, unit: 'U/L' },
    },
    description: 'Enzyme found in liver, heart, muscle, and other tissues',
    clinicalSignificance: {
      high: ['Liver disease', 'MI', 'Muscle damage', 'Hemolysis', 'Medications'],
      low: ['B6 deficiency', 'Dialysis', 'Uremia'],
    },
  },
  alp: {
    name: 'Alkaline Phosphatase',
    abbreviation: 'ALP',
    category: 'LFT',
    referenceRanges: {
      adult: { low: 44, high: 147, unit: 'U/L' },
    },
    description: 'Enzyme from liver, bone, and other tissues',
    clinicalSignificance: {
      high: ['Cholestasis', 'Bone disease', 'Paget disease', 'Pregnancy', 'Growth (pediatric)'],
      low: ['Hypothyroidism', 'Malnutrition', 'Zinc deficiency', 'Pernicious anemia'],
    },
  },
  ggt: {
    name: 'Gamma-Glutamyl Transferase',
    abbreviation: 'GGT',
    category: 'LFT',
    referenceRanges: {
      adult_male: { low: 8, high: 61, unit: 'U/L' },
      adult_female: { low: 5, high: 36, unit: 'U/L' },
    },
    description: 'Enzyme sensitive to liver damage and alcohol use',
    clinicalSignificance: {
      high: ['Alcohol use', 'Cholestasis', 'Hepatitis', 'Medications', 'Pancreatitis'],
      low: ['Generally not clinically significant'],
    },
  },
  bilirubin_total: {
    name: 'Total Bilirubin',
    abbreviation: 'T.Bili',
    category: 'LFT',
    referenceRanges: {
      adult: {
        low: 0.1,
        high: 1.2,
        criticalHigh: 15.0,
        unit: 'mg/dL',
        siUnit: 'µmol/L',
        siConversion: 17.1,
      },
    },
    description: 'Product of hemoglobin breakdown',
    clinicalSignificance: {
      high: [
        'Hemolysis',
        'Liver disease',
        'Biliary obstruction',
        'Gilbert syndrome',
        'Ineffective erythropoiesis',
      ],
      low: ['Generally not clinically significant'],
    },
  },
  bilirubin_direct: {
    name: 'Direct Bilirubin',
    abbreviation: 'D.Bili',
    category: 'LFT',
    referenceRanges: {
      adult: { low: 0.0, high: 0.3, unit: 'mg/dL', siUnit: 'µmol/L', siConversion: 17.1 },
    },
    description: 'Conjugated bilirubin processed by liver',
    clinicalSignificance: {
      high: ['Biliary obstruction', 'Hepatocellular disease', 'Dubin-Johnson syndrome'],
      low: ['Generally not clinically significant'],
    },
  },
  albumin: {
    name: 'Albumin',
    abbreviation: 'Alb',
    category: 'LFT',
    referenceRanges: {
      adult: {
        low: 3.5,
        high: 5.0,
        criticalLow: 1.5,
        unit: 'g/dL',
        siUnit: 'g/L',
        siConversion: 10,
      },
    },
    description: 'Major plasma protein synthesized by liver',
    clinicalSignificance: {
      high: ['Dehydration'],
      low: [
        'Liver disease',
        'Malnutrition',
        'Nephrotic syndrome',
        'Burns',
        'Sepsis',
        'Protein-losing enteropathy',
      ],
    },
  },
  total_protein: {
    name: 'Total Protein',
    abbreviation: 'TP',
    category: 'LFT',
    referenceRanges: {
      adult: { low: 6.0, high: 8.3, unit: 'g/dL', siUnit: 'g/L', siConversion: 10 },
    },
    description: 'Sum of albumin and globulins',
    clinicalSignificance: {
      high: ['Dehydration', 'Multiple myeloma', 'Chronic infection', 'Autoimmune disease'],
      low: ['Liver disease', 'Malnutrition', 'Nephrotic syndrome', 'Malabsorption'],
    },
  },

  // Lipid Panel
  cholesterol_total: {
    name: 'Total Cholesterol',
    abbreviation: 'TC',
    category: 'Lipid',
    referenceRanges: {
      adult: { low: 0, high: 200, unit: 'mg/dL', siUnit: 'mmol/L', siConversion: 0.0259 },
    },
    description: 'Total blood cholesterol level',
    clinicalSignificance: {
      high: [
        'Hyperlipidemia',
        'Cardiovascular risk',
        'Hypothyroidism',
        'Nephrotic syndrome',
        'Diet',
      ],
      low: ['Hyperthyroidism', 'Malnutrition', 'Liver disease', 'Malabsorption'],
    },
  },
  ldl: {
    name: 'LDL Cholesterol',
    abbreviation: 'LDL-C',
    category: 'Lipid',
    referenceRanges: {
      adult: { low: 0, high: 100, unit: 'mg/dL', siUnit: 'mmol/L', siConversion: 0.0259 },
    },
    description: 'Low-density lipoprotein ("bad" cholesterol)',
    clinicalSignificance: {
      high: ['Cardiovascular risk', 'Hyperlipidemia', 'Familial hypercholesterolemia', 'Diet'],
      low: ['Hyperthyroidism', 'Malnutrition', 'Malabsorption', 'Sepsis'],
    },
  },
  hdl: {
    name: 'HDL Cholesterol',
    abbreviation: 'HDL-C',
    category: 'Lipid',
    referenceRanges: {
      adult_male: { low: 40, high: 999, unit: 'mg/dL', siUnit: 'mmol/L', siConversion: 0.0259 },
      adult_female: { low: 50, high: 999, unit: 'mg/dL', siUnit: 'mmol/L', siConversion: 0.0259 },
    },
    description: 'High-density lipoprotein ("good" cholesterol)',
    clinicalSignificance: {
      high: ['Generally cardioprotective', 'Exercise', 'Moderate alcohol intake'],
      low: [
        'Cardiovascular risk',
        'Metabolic syndrome',
        'Smoking',
        'Obesity',
        'Sedentary lifestyle',
      ],
    },
  },
  triglycerides: {
    name: 'Triglycerides',
    abbreviation: 'TG',
    category: 'Lipid',
    referenceRanges: {
      adult: {
        low: 0,
        high: 150,
        criticalHigh: 500,
        unit: 'mg/dL',
        siUnit: 'mmol/L',
        siConversion: 0.0113,
      },
    },
    description: 'Fat in the blood',
    clinicalSignificance: {
      high: [
        'Cardiovascular risk',
        'Metabolic syndrome',
        'Diabetes',
        'Alcohol',
        'Diet',
        'Pancreatitis risk >500',
      ],
      low: ['Hyperthyroidism', 'Malnutrition', 'Malabsorption'],
    },
  },

  // Thyroid Function
  tsh: {
    name: 'Thyroid Stimulating Hormone',
    abbreviation: 'TSH',
    category: 'Thyroid',
    referenceRanges: {
      adult: { low: 0.4, high: 4.0, unit: 'mIU/L' },
    },
    description: 'Pituitary hormone that regulates thyroid function',
    clinicalSignificance: {
      high: ['Primary hypothyroidism', 'Recovery from hyperthyroidism', 'TSH-secreting adenoma'],
      low: [
        'Hyperthyroidism',
        'Secondary hypothyroidism',
        'Sick euthyroid syndrome',
        'Medications',
      ],
    },
  },
  free_t4: {
    name: 'Free Thyroxine',
    abbreviation: 'Free T4',
    category: 'Thyroid',
    referenceRanges: {
      adult: { low: 0.8, high: 1.8, unit: 'ng/dL', siUnit: 'pmol/L', siConversion: 12.87 },
    },
    description: 'Active form of thyroid hormone',
    clinicalSignificance: {
      high: ['Hyperthyroidism', 'Excess thyroid hormone replacement', 'Thyroiditis'],
      low: ['Hypothyroidism', 'Sick euthyroid syndrome', 'Pituitary disease'],
    },
  },
  free_t3: {
    name: 'Free Triiodothyronine',
    abbreviation: 'Free T3',
    category: 'Thyroid',
    referenceRanges: {
      adult: { low: 2.3, high: 4.2, unit: 'pg/mL', siUnit: 'pmol/L', siConversion: 1.54 },
    },
    description: 'Most active thyroid hormone',
    clinicalSignificance: {
      high: ['Hyperthyroidism', 'T3 thyrotoxicosis'],
      low: ['Hypothyroidism', 'Sick euthyroid syndrome', 'Starvation'],
    },
  },

  // Coagulation
  pt: {
    name: 'Prothrombin Time',
    abbreviation: 'PT',
    category: 'Coagulation',
    referenceRanges: {
      adult: { low: 11, high: 13.5, criticalHigh: 30, unit: 'seconds' },
    },
    description: 'Measures extrinsic and common coagulation pathways',
    clinicalSignificance: {
      high: [
        'Warfarin therapy',
        'Liver disease',
        'Vitamin K deficiency',
        'DIC',
        'Factor deficiency',
      ],
      low: ['Generally not clinically significant', 'May indicate hypercoagulable state'],
    },
  },
  inr: {
    name: 'International Normalized Ratio',
    abbreviation: 'INR',
    category: 'Coagulation',
    referenceRanges: {
      adult: { low: 0.9, high: 1.1, criticalHigh: 5.0, unit: 'ratio' },
    },
    description: 'Standardized PT ratio for anticoagulation monitoring',
    clinicalSignificance: {
      high: [
        'Anticoagulation (therapeutic 2-3 for most indications)',
        'Liver disease',
        'Vitamin K deficiency',
        'DIC',
      ],
      low: ['Generally not clinically significant'],
    },
  },
  ptt: {
    name: 'Partial Thromboplastin Time',
    abbreviation: 'PTT/aPTT',
    category: 'Coagulation',
    referenceRanges: {
      adult: { low: 25, high: 35, criticalHigh: 100, unit: 'seconds' },
    },
    description: 'Measures intrinsic and common coagulation pathways',
    clinicalSignificance: {
      high: [
        'Heparin therapy',
        'Hemophilia',
        'vWD',
        'Lupus anticoagulant',
        'Factor deficiency',
        'DIC',
      ],
      low: ['Generally not clinically significant'],
    },
  },
  d_dimer: {
    name: 'D-Dimer',
    abbreviation: 'D-Dimer',
    category: 'Coagulation',
    referenceRanges: {
      adult: { low: 0, high: 500, unit: 'ng/mL FEU' },
    },
    description: 'Fibrin degradation product indicating clot breakdown',
    clinicalSignificance: {
      high: ['DVT/PE', 'DIC', 'Surgery', 'Trauma', 'Malignancy', 'Pregnancy', 'Inflammation'],
      low: ['Generally not clinically significant'],
    },
  },
  fibrinogen: {
    name: 'Fibrinogen',
    abbreviation: 'Fib',
    category: 'Coagulation',
    referenceRanges: {
      adult: {
        low: 200,
        high: 400,
        criticalLow: 100,
        unit: 'mg/dL',
        siUnit: 'g/L',
        siConversion: 0.01,
      },
    },
    description: 'Clotting factor and acute phase reactant',
    clinicalSignificance: {
      high: ['Acute phase response', 'Infection', 'Malignancy', 'Pregnancy', 'Smoking'],
      low: ['DIC', 'Liver disease', 'Massive transfusion', 'Fibrinolysis', 'Congenital deficiency'],
    },
  },

  // Cardiac Markers
  troponin_i: {
    name: 'Troponin I',
    abbreviation: 'TnI',
    category: 'Cardiac',
    referenceRanges: {
      adult: { low: 0, high: 0.04, criticalHigh: 0.5, unit: 'ng/mL' },
    },
    description: 'Highly specific marker of myocardial injury',
    clinicalSignificance: {
      high: [
        'Acute MI',
        'Myocarditis',
        'PE',
        'Heart failure',
        'Sepsis',
        'Renal failure',
        'Cardiac contusion',
      ],
      low: ['Normal'],
    },
  },
  bnp: {
    name: 'B-type Natriuretic Peptide',
    abbreviation: 'BNP',
    category: 'Cardiac',
    referenceRanges: {
      adult: { low: 0, high: 100, unit: 'pg/mL' },
    },
    description: 'Marker of cardiac wall stress and heart failure',
    clinicalSignificance: {
      high: ['Heart failure', 'ACS', 'PE', 'Renal failure', 'Sepsis', 'Advanced age'],
      low: ['Normal', 'Obesity may falsely lower'],
    },
  },
  ck_mb: {
    name: 'Creatine Kinase-MB',
    abbreviation: 'CK-MB',
    category: 'Cardiac',
    referenceRanges: {
      adult: { low: 0, high: 5.0, unit: 'ng/mL' },
    },
    description: 'Cardiac isoenzyme of creatine kinase',
    clinicalSignificance: {
      high: [
        'Acute MI',
        'Cardiac surgery',
        'Myocarditis',
        'Rhabdomyolysis with cardiac involvement',
      ],
      low: ['Normal'],
    },
  },

  // Inflammatory Markers
  crp: {
    name: 'C-Reactive Protein',
    abbreviation: 'CRP',
    category: 'Inflammatory',
    referenceRanges: {
      adult: { low: 0, high: 10, unit: 'mg/L' },
    },
    description: 'Acute phase reactant indicating inflammation',
    clinicalSignificance: {
      high: ['Infection', 'Autoimmune disease', 'Malignancy', 'Tissue injury', 'Post-surgical'],
      low: ['Normal'],
    },
  },
  esr: {
    name: 'Erythrocyte Sedimentation Rate',
    abbreviation: 'ESR',
    category: 'Inflammatory',
    referenceRanges: {
      adult_male: { low: 0, high: 15, unit: 'mm/hr' },
      adult_female: { low: 0, high: 20, unit: 'mm/hr' },
    },
    description: 'Non-specific marker of inflammation',
    clinicalSignificance: {
      high: [
        'Infection',
        'Inflammation',
        'Malignancy',
        'Autoimmune disease',
        'Anemia',
        'Advanced age',
      ],
      low: ['Polycythemia', 'Sickle cell disease', 'Severe leukocytosis'],
    },
  },

  // Other Common Tests
  uric_acid: {
    name: 'Uric Acid',
    abbreviation: 'UA',
    category: 'Metabolic',
    referenceRanges: {
      adult_male: { low: 3.5, high: 7.2, unit: 'mg/dL', siUnit: 'µmol/L', siConversion: 59.48 },
      adult_female: { low: 2.5, high: 6.2, unit: 'mg/dL', siUnit: 'µmol/L', siConversion: 59.48 },
    },
    description: 'End product of purine metabolism',
    clinicalSignificance: {
      high: ['Gout', 'Kidney disease', 'Tumor lysis syndrome', 'Diuretics', 'Alcohol', 'Diet'],
      low: ['Low purine diet', 'SIADH', 'Liver disease', 'Medications'],
    },
  },
  magnesium: {
    name: 'Magnesium',
    abbreviation: 'Mg',
    category: 'Metabolic',
    referenceRanges: {
      adult: {
        low: 1.7,
        high: 2.2,
        criticalLow: 1.0,
        criticalHigh: 4.0,
        unit: 'mg/dL',
        siUnit: 'mmol/L',
        siConversion: 0.411,
      },
    },
    description: 'Important for muscle and nerve function',
    clinicalSignificance: {
      high: ['Renal failure', 'Mg-containing antacids', 'Hypothyroidism', 'Adrenal insufficiency'],
      low: ['Malnutrition', 'Alcoholism', 'Diuretics', 'Diarrhea', 'Diabetes', 'Medications'],
    },
  },
  phosphorus: {
    name: 'Phosphorus',
    abbreviation: 'Phos',
    category: 'Metabolic',
    referenceRanges: {
      adult: {
        low: 2.5,
        high: 4.5,
        criticalLow: 1.0,
        unit: 'mg/dL',
        siUnit: 'mmol/L',
        siConversion: 0.323,
      },
    },
    description: 'Important for bone health and energy metabolism',
    clinicalSignificance: {
      high: ['Renal failure', 'Hypoparathyroidism', 'Tumor lysis syndrome', 'Vitamin D toxicity'],
      low: [
        'Refeeding syndrome',
        'Alcoholism',
        'Hyperparathyroidism',
        'Vitamin D deficiency',
        'Antacids',
      ],
    },
  },
  hba1c: {
    name: 'Hemoglobin A1c',
    abbreviation: 'HbA1c',
    category: 'Metabolic',
    referenceRanges: {
      adult: { low: 4.0, high: 5.6, unit: '%' },
    },
    description: 'Average blood glucose over past 2-3 months',
    clinicalSignificance: {
      high: ['Diabetes mellitus (≥6.5%)', 'Prediabetes (5.7-6.4%)', 'Poor glycemic control'],
      low: ['Hypoglycemia', 'Hemolytic anemia', 'Recent blood loss', 'Hemoglobin variants'],
    },
  },
  ferritin: {
    name: 'Ferritin',
    abbreviation: 'Fer',
    category: 'Iron Studies',
    referenceRanges: {
      adult_male: { low: 20, high: 250, unit: 'ng/mL', siUnit: 'µg/L', siConversion: 1 },
      adult_female: { low: 10, high: 120, unit: 'ng/mL', siUnit: 'µg/L', siConversion: 1 },
    },
    description: 'Iron storage protein',
    clinicalSignificance: {
      high: ['Iron overload', 'Hemochromatosis', 'Inflammation', 'Liver disease', 'Malignancy'],
      low: ['Iron deficiency', 'Blood loss'],
    },
  },
  iron: {
    name: 'Serum Iron',
    abbreviation: 'Fe',
    category: 'Iron Studies',
    referenceRanges: {
      adult: { low: 60, high: 170, unit: 'µg/dL', siUnit: 'µmol/L', siConversion: 0.179 },
    },
    description: 'Iron level in blood',
    clinicalSignificance: {
      high: ['Iron overload', 'Hemochromatosis', 'Hemolysis', 'Hepatitis', 'Lead poisoning'],
      low: ['Iron deficiency', 'Chronic disease', 'Malabsorption'],
    },
  },
  tibc: {
    name: 'Total Iron Binding Capacity',
    abbreviation: 'TIBC',
    category: 'Iron Studies',
    referenceRanges: {
      adult: { low: 250, high: 370, unit: 'µg/dL', siUnit: 'µmol/L', siConversion: 0.179 },
    },
    description: 'Capacity of transferrin to bind iron',
    clinicalSignificance: {
      high: ['Iron deficiency', 'Pregnancy', 'Oral contraceptives'],
      low: ['Iron overload', 'Chronic disease', 'Malnutrition', 'Liver disease'],
    },
  },
};

// ============================================================================
// PANEL DEFINITIONS
// ============================================================================

const panels: Record<string, string[]> = {
  cbc: ['wbc', 'rbc', 'hemoglobin', 'hematocrit', 'platelets', 'mcv', 'mch', 'mchc', 'rdw'],
  bmp: ['glucose', 'bun', 'creatinine', 'sodium', 'potassium', 'chloride', 'co2', 'calcium'],
  cmp: [
    'glucose',
    'bun',
    'creatinine',
    'sodium',
    'potassium',
    'chloride',
    'co2',
    'calcium',
    'alt',
    'ast',
    'alp',
    'bilirubin_total',
    'albumin',
    'total_protein',
  ],
  lft: [
    'alt',
    'ast',
    'alp',
    'ggt',
    'bilirubin_total',
    'bilirubin_direct',
    'albumin',
    'total_protein',
  ],
  lipid: ['cholesterol_total', 'ldl', 'hdl', 'triglycerides'],
  thyroid: ['tsh', 'free_t4', 'free_t3'],
  coagulation: ['pt', 'inr', 'ptt', 'd_dimer', 'fibrinogen'],
  cardiac: ['troponin_i', 'bnp', 'ck_mb'],
  iron_studies: ['ferritin', 'iron', 'tibc'],
};

// ============================================================================
// ANALYZER CLASSES
// ============================================================================

interface InterpretedValue {
  test: string;
  value: number;
  unit: string;
  referenceRange: string;
  status: 'normal' | 'low' | 'high' | 'critical_low' | 'critical_high';
  interpretation: string;
  clinicalNotes: string[];
}

interface AnionGapResult {
  value: number;
  interpretation: string;
  acidosisType?: string;
}

interface BunCreatinineRatioResult {
  value: number;
  interpretation: string;
}

class LabValueInterpreter {
  interpretValue(
    testKey: string,
    value: number,
    gender?: 'male' | 'female',
    age?: number
  ): InterpretedValue | null {
    const test = labTests[testKey.toLowerCase()];
    if (!test) return null;

    // Determine which reference range to use
    let range: ReferenceRange | undefined;

    if (age !== undefined && age < 18 && test.referenceRanges.pediatric) {
      range = test.referenceRanges.pediatric;
    } else if (gender === 'male' && test.referenceRanges.adult_male) {
      range = test.referenceRanges.adult_male;
    } else if (gender === 'female' && test.referenceRanges.adult_female) {
      range = test.referenceRanges.adult_female;
    } else {
      range = test.referenceRanges.adult;
    }

    if (!range) {
      range = test.referenceRanges.adult || Object.values(test.referenceRanges)[0];
    }

    // Determine status
    let status: 'normal' | 'low' | 'high' | 'critical_low' | 'critical_high' = 'normal';
    let interpretation = 'Within normal limits';
    const clinicalNotes: string[] = [];

    if (range.criticalLow !== undefined && value < range.criticalLow) {
      status = 'critical_low';
      interpretation = 'CRITICAL LOW - Immediate attention required';
      clinicalNotes.push(...test.clinicalSignificance.low);
    } else if (range.criticalHigh !== undefined && value > range.criticalHigh) {
      status = 'critical_high';
      interpretation = 'CRITICAL HIGH - Immediate attention required';
      clinicalNotes.push(...test.clinicalSignificance.high);
    } else if (value < range.low) {
      status = 'low';
      interpretation = 'Below reference range';
      clinicalNotes.push(...test.clinicalSignificance.low);
    } else if (value > range.high) {
      status = 'high';
      interpretation = 'Above reference range';
      clinicalNotes.push(...test.clinicalSignificance.high);
    }

    return {
      test: test.name,
      value,
      unit: range.unit,
      referenceRange: `${range.low}-${range.high} ${range.unit}`,
      status,
      interpretation,
      clinicalNotes,
    };
  }

  calculateAnionGap(sodium: number, chloride: number, bicarbonate: number): AnionGapResult {
    const ag = sodium - (chloride + bicarbonate);

    let interpretation: string;
    let acidosisType: string | undefined;

    if (ag >= 8 && ag <= 12) {
      interpretation = 'Normal anion gap';
    } else if (ag > 12) {
      interpretation = 'Elevated anion gap - suggests metabolic acidosis';
      acidosisType =
        'Consider: Ketoacidosis (DKA, alcoholic, starvation), Lactic acidosis, Uremia, Toxins (methanol, ethylene glycol, salicylate)';
    } else {
      interpretation =
        'Low anion gap - may indicate hypoalbuminemia, multiple myeloma, or lab error';
    }

    return { value: ag, interpretation, acidosisType };
  }

  calculateBunCreatinineRatio(bun: number, creatinine: number): BunCreatinineRatioResult {
    const ratio = bun / creatinine;

    let interpretation: string;

    if (ratio >= 10 && ratio <= 20) {
      interpretation = 'Normal BUN/Cr ratio';
    } else if (ratio > 20) {
      interpretation =
        'Elevated ratio - consider: GI bleeding, dehydration, high protein diet, catabolic state, post-renal obstruction';
    } else {
      interpretation = 'Low ratio - consider: liver disease, malnutrition, SIADH, rhabdomyolysis';
    }

    return { value: ratio, interpretation };
  }

  calculateAST_ALT_Ratio(ast: number, alt: number): { value: number; interpretation: string } {
    const ratio = ast / alt;

    let interpretation: string;

    if (ratio > 2) {
      interpretation = 'AST/ALT > 2:1 - highly suggestive of alcoholic liver disease';
    } else if (ratio > 1) {
      interpretation = 'AST/ALT > 1 - may suggest cirrhosis or alcoholic hepatitis';
    } else {
      interpretation = 'AST/ALT < 1 - typical pattern for NAFLD, viral hepatitis';
    }

    return { value: ratio, interpretation };
  }

  assessAnemiaType(mcv: number, mchc: number): { type: string; differentials: string[] } {
    let type: string;
    let differentials: string[];

    if (mcv < 80) {
      type = 'Microcytic anemia';
      differentials = ['Iron deficiency', 'Thalassemia', 'Chronic disease', 'Sideroblastic anemia'];
    } else if (mcv > 100) {
      type = 'Macrocytic anemia';
      differentials = [
        'B12 deficiency',
        'Folate deficiency',
        'Liver disease',
        'Hypothyroidism',
        'MDS',
        'Medications',
      ];
    } else {
      type = 'Normocytic anemia';
      differentials = [
        'Acute blood loss',
        'Chronic disease',
        'Renal failure',
        'Hemolysis',
        'Mixed deficiency',
      ];
    }

    if (mchc < 32) {
      type += ' (hypochromic)';
    }

    return { type, differentials };
  }

  convertUnits(
    testKey: string,
    value: number,
    toSI: boolean
  ): { value: number; unit: string } | null {
    const test = labTests[testKey.toLowerCase()];
    if (!test) return null;

    const range =
      test.referenceRanges.adult ||
      test.referenceRanges.adult_male ||
      Object.values(test.referenceRanges)[0];

    if (!range.siConversion || !range.siUnit) {
      return null;
    }

    if (toSI) {
      return { value: value * range.siConversion, unit: range.siUnit };
    } else {
      return { value: value / range.siConversion, unit: range.unit };
    }
  }

  analyzePanel(
    panelName: string,
    values: Record<string, number>,
    gender?: 'male' | 'female'
  ): {
    results: InterpretedValue[];
    summary: string;
    abnormalCount: number;
    criticalCount: number;
  } {
    const panelTests = panels[panelName.toLowerCase()];
    if (!panelTests) {
      return {
        results: [],
        summary: `Unknown panel: ${panelName}`,
        abnormalCount: 0,
        criticalCount: 0,
      };
    }

    const results: InterpretedValue[] = [];
    let abnormalCount = 0;
    let criticalCount = 0;

    for (const testKey of panelTests) {
      const value = values[testKey];
      if (value !== undefined) {
        const interpreted = this.interpretValue(testKey, value, gender);
        if (interpreted) {
          results.push(interpreted);
          if (interpreted.status !== 'normal') {
            abnormalCount++;
            if (interpreted.status.startsWith('critical')) {
              criticalCount++;
            }
          }
        }
      }
    }

    let summary = `${panelName.toUpperCase()} Panel Analysis: `;
    if (criticalCount > 0) {
      summary += `${criticalCount} CRITICAL value(s), `;
    }
    summary += `${abnormalCount} abnormal of ${results.length} tests analyzed`;

    return { results, summary, abnormalCount, criticalCount };
  }

  analyzeTrend(
    values: { value: number; date: string }[],
    testKey: string
  ): {
    trend: 'increasing' | 'decreasing' | 'stable' | 'fluctuating';
    percentChange: number;
    interpretation: string;
  } {
    if (values.length < 2) {
      return {
        trend: 'stable',
        percentChange: 0,
        interpretation: 'Insufficient data for trend analysis',
      };
    }

    const first = values[0].value;
    const last = values[values.length - 1].value;
    const percentChange = ((last - first) / first) * 100;

    // Check for fluctuation
    let increases = 0;
    let decreases = 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i].value > values[i - 1].value) increases++;
      else if (values[i].value < values[i - 1].value) decreases++;
    }

    let trend: 'increasing' | 'decreasing' | 'stable' | 'fluctuating';

    if (increases > 0 && decreases > 0 && Math.abs(increases - decreases) <= 1) {
      trend = 'fluctuating';
    } else if (percentChange > 10) {
      trend = 'increasing';
    } else if (percentChange < -10) {
      trend = 'decreasing';
    } else {
      trend = 'stable';
    }

    const test = labTests[testKey.toLowerCase()];
    let interpretation = `${trend.charAt(0).toUpperCase() + trend.slice(1)} trend (${percentChange > 0 ? '+' : ''}${percentChange.toFixed(1)}%)`;

    if (test && trend !== 'stable') {
      if (trend === 'increasing') {
        interpretation += `. Consider: ${test.clinicalSignificance.high.slice(0, 2).join(', ')}`;
      } else if (trend === 'decreasing') {
        interpretation += `. Consider: ${test.clinicalSignificance.low.slice(0, 2).join(', ')}`;
      }
    }

    return { trend, percentChange, interpretation };
  }
}

// ============================================================================
// TOOL DEFINITION AND EXECUTOR
// ============================================================================

export const labvaluesTool: UnifiedTool = {
  name: 'lab_values',
  description: `Comprehensive laboratory value interpreter with reference ranges, critical value detection,
and clinical significance analysis.

Features:
- Interpret individual lab values with age/gender-specific reference ranges
- Critical value detection with immediate alerts
- Panel analysis (CBC, BMP, CMP, LFTs, lipid, thyroid, coagulation, cardiac, iron studies)
- Unit conversions between conventional and SI units
- Calculated values (anion gap, BUN/Cr ratio, AST/ALT ratio)
- Anemia classification based on RBC indices
- Trend analysis for serial values
- Clinical significance explanations

Operations:
- interpret: Interpret a single lab value
- panel: Analyze a complete panel
- convert: Convert between conventional and SI units
- calculate: Calculate derived values (anion_gap, bun_cr_ratio, ast_alt_ratio)
- anemia: Classify anemia type from RBC indices
- trend: Analyze trend from serial values
- lookup: Look up test information and reference ranges
- list_tests: List available tests by category
- list_panels: List available panels
- info: Tool documentation
- examples: Usage examples`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'interpret',
          'panel',
          'convert',
          'calculate',
          'anemia',
          'trend',
          'lookup',
          'list_tests',
          'list_panels',
          'info',
          'examples',
        ],
        description: 'Operation to perform',
      },
      test: {
        type: 'string',
        description: 'Lab test abbreviation (e.g., "hemoglobin", "glucose", "sodium")',
      },
      value: {
        type: 'number',
        description: 'Lab value',
      },
      values: {
        type: 'object',
        description: 'Object with test names as keys and values',
      },
      panel: {
        type: 'string',
        enum: [
          'cbc',
          'bmp',
          'cmp',
          'lft',
          'lipid',
          'thyroid',
          'coagulation',
          'cardiac',
          'iron_studies',
        ],
        description: 'Panel name for panel analysis',
      },
      gender: {
        type: 'string',
        enum: ['male', 'female'],
        description: 'Patient gender for gender-specific ranges',
      },
      age: {
        type: 'number',
        description: 'Patient age in years',
      },
      to_si: {
        type: 'boolean',
        description: 'Convert to SI units (true) or from SI units (false)',
      },
      calculation: {
        type: 'string',
        enum: ['anion_gap', 'bun_cr_ratio', 'ast_alt_ratio'],
        description: 'Type of calculation',
      },
      serial_values: {
        type: 'array',
        items: { type: 'object' },
        description:
          'Array of values with dates for trend analysis. Each entry has: value (number), date (string)',
      },
      category: {
        type: 'string',
        description: 'Filter tests by category',
      },
    },
    required: ['operation'],
  },
};

export async function executelabvalues(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;
    const interpreter = new LabValueInterpreter();

    switch (operation) {
      case 'interpret': {
        const test = args.test;
        const value = args.value;

        if (!test || value === undefined) {
          return { toolCallId: id, content: 'Error: test and value are required', isError: true };
        }

        const result = interpreter.interpretValue(test, value, args.gender, args.age);

        if (!result) {
          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                error: `Unknown test: ${test}`,
                availableTests: Object.keys(labTests).slice(0, 20),
                note: 'Use list_tests operation to see all available tests',
              },
              null,
              2
            ),
            isError: true,
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'interpret',
              result,
              alert: result.status.startsWith('critical')
                ? 'CRITICAL VALUE - IMMEDIATE ATTENTION REQUIRED'
                : undefined,
            },
            null,
            2
          ),
        };
      }

      case 'panel': {
        const panelName = args.panel;
        const values = args.values;

        if (!panelName || !values) {
          return { toolCallId: id, content: 'Error: panel and values are required', isError: true };
        }

        const result = interpreter.analyzePanel(panelName, values, args.gender);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'panel',
              panel: panelName.toUpperCase(),
              summary: result.summary,
              criticalCount: result.criticalCount,
              abnormalCount: result.abnormalCount,
              totalTests: result.results.length,
              results: result.results,
              alert:
                result.criticalCount > 0
                  ? 'CRITICAL VALUES PRESENT - IMMEDIATE ATTENTION REQUIRED'
                  : undefined,
            },
            null,
            2
          ),
        };
      }

      case 'convert': {
        const test = args.test;
        const value = args.value;
        const toSI = args.to_si !== false;

        if (!test || value === undefined) {
          return { toolCallId: id, content: 'Error: test and value are required', isError: true };
        }

        const result = interpreter.convertUnits(test, value, toSI);

        if (!result) {
          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                error: `Conversion not available for test: ${test}`,
                note: 'Not all tests have SI unit conversions defined',
              },
              null,
              2
            ),
            isError: true,
          };
        }

        const testDef = labTests[test.toLowerCase()];
        const range =
          testDef?.referenceRanges.adult || Object.values(testDef?.referenceRanges || {})[0];

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'convert',
              test: testDef?.name || test,
              original: { value, unit: toSI ? range?.unit : range?.siUnit },
              converted: result,
              direction: toSI ? 'conventional → SI' : 'SI → conventional',
            },
            null,
            2
          ),
        };
      }

      case 'calculate': {
        const calculation = args.calculation;
        const values = args.values || {};

        switch (calculation) {
          case 'anion_gap': {
            const { sodium, chloride, co2 } = values;
            if (sodium === undefined || chloride === undefined || co2 === undefined) {
              return {
                toolCallId: id,
                content: 'Error: sodium, chloride, and co2 values are required',
                isError: true,
              };
            }
            const result = interpreter.calculateAnionGap(sodium, chloride, co2);
            return {
              toolCallId: id,
              content: JSON.stringify(
                {
                  operation: 'calculate',
                  calculation: 'anion_gap',
                  formula: 'Na - (Cl + HCO3)',
                  input: { sodium, chloride, bicarbonate: co2 },
                  result: {
                    anionGap: result.value.toFixed(1) + ' mEq/L',
                    normalRange: '8-12 mEq/L',
                    interpretation: result.interpretation,
                    acidosisType: result.acidosisType,
                  },
                },
                null,
                2
              ),
            };
          }

          case 'bun_cr_ratio': {
            const { bun, creatinine } = values;
            if (bun === undefined || creatinine === undefined) {
              return {
                toolCallId: id,
                content: 'Error: bun and creatinine values are required',
                isError: true,
              };
            }
            const result = interpreter.calculateBunCreatinineRatio(bun, creatinine);
            return {
              toolCallId: id,
              content: JSON.stringify(
                {
                  operation: 'calculate',
                  calculation: 'bun_cr_ratio',
                  formula: 'BUN / Creatinine',
                  input: { bun, creatinine },
                  result: {
                    ratio: result.value.toFixed(1),
                    normalRange: '10-20',
                    interpretation: result.interpretation,
                  },
                },
                null,
                2
              ),
            };
          }

          case 'ast_alt_ratio': {
            const { ast, alt } = values;
            if (ast === undefined || alt === undefined) {
              return {
                toolCallId: id,
                content: 'Error: ast and alt values are required',
                isError: true,
              };
            }
            const result = interpreter.calculateAST_ALT_Ratio(ast, alt);
            return {
              toolCallId: id,
              content: JSON.stringify(
                {
                  operation: 'calculate',
                  calculation: 'ast_alt_ratio',
                  formula: 'AST / ALT',
                  input: { ast, alt },
                  result: {
                    ratio: result.value.toFixed(2),
                    interpretation: result.interpretation,
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
              content: `Error: Unknown calculation '${calculation}'. Valid: anion_gap, bun_cr_ratio, ast_alt_ratio`,
              isError: true,
            };
        }
      }

      case 'anemia': {
        const values = args.values || {};
        const { mcv, mchc } = values;

        if (mcv === undefined) {
          return { toolCallId: id, content: 'Error: mcv value is required', isError: true };
        }

        const result = interpreter.assessAnemiaType(mcv, mchc || 34);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'anemia',
              input: { mcv: mcv + ' fL', mchc: mchc ? mchc + ' g/dL' : 'not provided' },
              result: {
                classification: result.type,
                differentialDiagnosis: result.differentials,
              },
              notes: [
                'Classification based on MCV and MCHC',
                'Clinical correlation and additional testing recommended',
                'Consider: reticulocyte count, iron studies, B12/folate levels',
              ],
            },
            null,
            2
          ),
        };
      }

      case 'trend': {
        const test = args.test;
        const serialValues = args.serial_values;

        if (!test || !serialValues || serialValues.length < 2) {
          return {
            toolCallId: id,
            content: 'Error: test and at least 2 serial_values are required',
            isError: true,
          };
        }

        const result = interpreter.analyzeTrend(serialValues, test);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'trend',
              test,
              dataPoints: serialValues.length,
              result: {
                trend: result.trend,
                percentChange: result.percentChange.toFixed(1) + '%',
                interpretation: result.interpretation,
              },
              values: serialValues,
            },
            null,
            2
          ),
        };
      }

      case 'lookup': {
        const test = args.test;

        if (!test) {
          return { toolCallId: id, content: 'Error: test parameter is required', isError: true };
        }

        const testDef = labTests[test.toLowerCase()];
        if (!testDef) {
          return {
            toolCallId: id,
            content: JSON.stringify(
              {
                error: `Unknown test: ${test}`,
                suggestion: Object.keys(labTests).filter((k) => k.includes(test.toLowerCase())),
                note: 'Use list_tests operation to see all available tests',
              },
              null,
              2
            ),
            isError: true,
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'lookup',
              test: testDef,
            },
            null,
            2
          ),
        };
      }

      case 'list_tests': {
        const category = args.category;

        const testsByCategory: Record<string, string[]> = {};
        for (const [key, test] of Object.entries(labTests)) {
          if (!category || test.category.toLowerCase() === category.toLowerCase()) {
            if (!testsByCategory[test.category]) {
              testsByCategory[test.category] = [];
            }
            testsByCategory[test.category].push(`${test.abbreviation} (${key})`);
          }
        }

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'list_tests',
              filter: category || 'all',
              categories: Object.keys(testsByCategory),
              tests: testsByCategory,
              totalTests: Object.keys(labTests).length,
            },
            null,
            2
          ),
        };
      }

      case 'list_panels': {
        const panelInfo: Record<string, { tests: string[]; description: string }> = {
          cbc: {
            tests: panels.cbc,
            description: 'Complete Blood Count - Red and white blood cell indices',
          },
          bmp: {
            tests: panels.bmp,
            description: 'Basic Metabolic Panel - Electrolytes and kidney function',
          },
          cmp: {
            tests: panels.cmp,
            description: 'Comprehensive Metabolic Panel - BMP plus liver function',
          },
          lft: {
            tests: panels.lft,
            description: 'Liver Function Tests - Hepatic enzymes and proteins',
          },
          lipid: {
            tests: panels.lipid,
            description: 'Lipid Panel - Cholesterol and triglycerides',
          },
          thyroid: {
            tests: panels.thyroid,
            description: 'Thyroid Function - TSH and thyroid hormones',
          },
          coagulation: {
            tests: panels.coagulation,
            description: 'Coagulation Studies - Clotting factors and times',
          },
          cardiac: {
            tests: panels.cardiac,
            description: 'Cardiac Markers - Heart damage indicators',
          },
          iron_studies: {
            tests: panels.iron_studies,
            description: 'Iron Studies - Iron stores and transport',
          },
        };

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'list_panels',
              panels: panelInfo,
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
              tool: 'lab_values',
              version: '1.0.0',
              description: 'Comprehensive laboratory value interpreter',
              capabilities: {
                testsAvailable: Object.keys(labTests).length,
                panels: Object.keys(panels),
                features: [
                  'Gender and age-specific reference ranges',
                  'Critical value detection',
                  'Panel interpretation',
                  'Unit conversions (conventional ↔ SI)',
                  'Calculated values (anion gap, ratios)',
                  'Anemia classification',
                  'Trend analysis',
                ],
              },
              categories: [...new Set(Object.values(labTests).map((t) => t.category))],
              disclaimer:
                'This tool is for educational purposes only. All results should be interpreted by qualified healthcare professionals in clinical context.',
            },
            null,
            2
          ),
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              examples: [
                {
                  name: 'Interpret single value',
                  call: {
                    operation: 'interpret',
                    test: 'hemoglobin',
                    value: 10.5,
                    gender: 'female',
                  },
                },
                {
                  name: 'Analyze CBC panel',
                  call: {
                    operation: 'panel',
                    panel: 'cbc',
                    values: {
                      wbc: 12.5,
                      rbc: 4.2,
                      hemoglobin: 12.0,
                      hematocrit: 36,
                      platelets: 250,
                      mcv: 85,
                    },
                    gender: 'female',
                  },
                },
                {
                  name: 'Calculate anion gap',
                  call: {
                    operation: 'calculate',
                    calculation: 'anion_gap',
                    values: { sodium: 140, chloride: 102, co2: 24 },
                  },
                },
                {
                  name: 'Classify anemia',
                  call: {
                    operation: 'anemia',
                    values: { mcv: 72, mchc: 30 },
                  },
                },
                {
                  name: 'Analyze trend',
                  call: {
                    operation: 'trend',
                    test: 'creatinine',
                    serial_values: [
                      { value: 1.2, date: '2024-01-01' },
                      { value: 1.4, date: '2024-02-01' },
                      { value: 1.8, date: '2024-03-01' },
                    ],
                  },
                },
                {
                  name: 'Convert units',
                  call: { operation: 'convert', test: 'glucose', value: 126, to_si: true },
                },
              ],
            },
            null,
            2
          ),
        };
      }

      default:
        return {
          toolCallId: id,
          content: `Error: Unknown operation '${operation}'. Valid: interpret, panel, convert, calculate, anemia, trend, lookup, list_tests, list_panels, info, examples`,
          isError: true,
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function islabvaluesAvailable(): boolean {
  return true;
}
