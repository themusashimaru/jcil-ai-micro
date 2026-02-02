/**
 * MEDICAL-DIAGNOSIS TOOL
 * Clinical decision support for differential diagnosis generation
 *
 * Features:
 * - Symptom-based differential diagnosis
 * - Probability scoring using Bayesian inference
 * - Red flag detection for emergency conditions
 * - Suggested workup and tests
 * - Clinical criteria evaluation (Wells, HEART, CURB-65, etc.)
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// SYMPTOM AND DISEASE DATABASE
// ============================================================================

interface Symptom {
  id: string;
  name: string;
  category: string;
  redFlag: boolean;
  emergencyConditions?: string[];
}

interface Disease {
  id: string;
  name: string;
  icd10: string;
  category: string;
  basePrevalence: number;
  symptoms: { symptomId: string; likelihood: number; }[];
  riskFactors: string[];
  redFlags: string[];
  workup: string[];
  urgency: 'emergent' | 'urgent' | 'routine';
  description: string;
}

const symptomDatabase: Record<string, Symptom> = {
  'chest_pain': {
    id: 'chest_pain',
    name: 'Chest pain',
    category: 'cardiovascular',
    redFlag: true,
    emergencyConditions: ['Acute MI', 'Aortic dissection', 'Pulmonary embolism', 'Tension pneumothorax']
  },
  'dyspnea': {
    id: 'dyspnea',
    name: 'Shortness of breath',
    category: 'respiratory',
    redFlag: true,
    emergencyConditions: ['Pulmonary embolism', 'Acute heart failure', 'Anaphylaxis']
  },
  'fever': {
    id: 'fever',
    name: 'Fever',
    category: 'constitutional',
    redFlag: false
  },
  'cough': {
    id: 'cough',
    name: 'Cough',
    category: 'respiratory',
    redFlag: false
  },
  'headache': {
    id: 'headache',
    name: 'Headache',
    category: 'neurological',
    redFlag: false
  },
  'severe_headache': {
    id: 'severe_headache',
    name: 'Severe sudden headache',
    category: 'neurological',
    redFlag: true,
    emergencyConditions: ['Subarachnoid hemorrhage', 'Meningitis']
  },
  'abdominal_pain': {
    id: 'abdominal_pain',
    name: 'Abdominal pain',
    category: 'gastrointestinal',
    redFlag: false
  },
  'severe_abdominal_pain': {
    id: 'severe_abdominal_pain',
    name: 'Severe abdominal pain',
    category: 'gastrointestinal',
    redFlag: true,
    emergencyConditions: ['Appendicitis', 'Bowel obstruction', 'Ruptured AAA']
  },
  'nausea': {
    id: 'nausea',
    name: 'Nausea',
    category: 'gastrointestinal',
    redFlag: false
  },
  'vomiting': {
    id: 'vomiting',
    name: 'Vomiting',
    category: 'gastrointestinal',
    redFlag: false
  },
  'diarrhea': {
    id: 'diarrhea',
    name: 'Diarrhea',
    category: 'gastrointestinal',
    redFlag: false
  },
  'fatigue': {
    id: 'fatigue',
    name: 'Fatigue',
    category: 'constitutional',
    redFlag: false
  },
  'weight_loss': {
    id: 'weight_loss',
    name: 'Unintentional weight loss',
    category: 'constitutional',
    redFlag: true,
    emergencyConditions: ['Malignancy']
  },
  'syncope': {
    id: 'syncope',
    name: 'Syncope (fainting)',
    category: 'cardiovascular',
    redFlag: true,
    emergencyConditions: ['Cardiac arrhythmia', 'Aortic stenosis']
  },
  'palpitations': {
    id: 'palpitations',
    name: 'Palpitations',
    category: 'cardiovascular',
    redFlag: false
  },
  'edema': {
    id: 'edema',
    name: 'Peripheral edema',
    category: 'cardiovascular',
    redFlag: false
  },
  'confusion': {
    id: 'confusion',
    name: 'Confusion/altered mental status',
    category: 'neurological',
    redFlag: true,
    emergencyConditions: ['Stroke', 'Hypoglycemia', 'Sepsis', 'Meningitis']
  },
  'focal_weakness': {
    id: 'focal_weakness',
    name: 'Focal weakness (one-sided)',
    category: 'neurological',
    redFlag: true,
    emergencyConditions: ['Stroke', 'TIA']
  },
  'hemoptysis': {
    id: 'hemoptysis',
    name: 'Coughing up blood',
    category: 'respiratory',
    redFlag: true,
    emergencyConditions: ['Pulmonary embolism', 'Lung cancer']
  },
  'dysuria': {
    id: 'dysuria',
    name: 'Painful urination',
    category: 'genitourinary',
    redFlag: false
  },
  'urinary_frequency': {
    id: 'urinary_frequency',
    name: 'Urinary frequency',
    category: 'genitourinary',
    redFlag: false
  },
  'back_pain': {
    id: 'back_pain',
    name: 'Back pain',
    category: 'musculoskeletal',
    redFlag: false
  }
};

const diseaseDatabase: Disease[] = [
  {
    id: 'mi',
    name: 'Acute Myocardial Infarction',
    icd10: 'I21',
    category: 'Cardiovascular',
    basePrevalence: 150,
    symptoms: [
      { symptomId: 'chest_pain', likelihood: 0.85 },
      { symptomId: 'dyspnea', likelihood: 0.6 },
      { symptomId: 'nausea', likelihood: 0.4 },
      { symptomId: 'fatigue', likelihood: 0.35 }
    ],
    riskFactors: ['age > 50', 'male', 'diabetes', 'hypertension', 'smoking'],
    redFlags: ['Crushing chest pain', 'Radiation to arm/jaw', 'Diaphoresis'],
    workup: ['ECG', 'Troponin', 'Chest X-ray', 'Echocardiogram'],
    urgency: 'emergent',
    description: 'Heart attack caused by blocked coronary artery'
  },
  {
    id: 'pe',
    name: 'Pulmonary Embolism',
    icd10: 'I26',
    category: 'Cardiovascular',
    basePrevalence: 60,
    symptoms: [
      { symptomId: 'dyspnea', likelihood: 0.8 },
      { symptomId: 'chest_pain', likelihood: 0.6 },
      { symptomId: 'cough', likelihood: 0.35 },
      { symptomId: 'hemoptysis', likelihood: 0.15 }
    ],
    riskFactors: ['immobility', 'recent surgery', 'cancer', 'pregnancy'],
    redFlags: ['Sudden onset dyspnea', 'Hypoxia', 'Tachycardia'],
    workup: ['D-dimer', 'CT pulmonary angiography', 'Lower extremity Doppler'],
    urgency: 'emergent',
    description: 'Blood clot in pulmonary arteries'
  },
  {
    id: 'pneumonia',
    name: 'Community-Acquired Pneumonia',
    icd10: 'J18',
    category: 'Respiratory',
    basePrevalence: 500,
    symptoms: [
      { symptomId: 'cough', likelihood: 0.9 },
      { symptomId: 'fever', likelihood: 0.8 },
      { symptomId: 'dyspnea', likelihood: 0.65 },
      { symptomId: 'chest_pain', likelihood: 0.4 }
    ],
    riskFactors: ['age > 65', 'COPD', 'immunocompromised'],
    redFlags: ['Hypoxia', 'Altered mental status', 'Sepsis'],
    workup: ['Chest X-ray', 'CBC', 'Sputum culture', 'Blood cultures'],
    urgency: 'urgent',
    description: 'Lung infection with consolidation'
  },
  {
    id: 'chf',
    name: 'Congestive Heart Failure',
    icd10: 'I50',
    category: 'Cardiovascular',
    basePrevalence: 200,
    symptoms: [
      { symptomId: 'dyspnea', likelihood: 0.95 },
      { symptomId: 'edema', likelihood: 0.8 },
      { symptomId: 'fatigue', likelihood: 0.7 },
      { symptomId: 'cough', likelihood: 0.5 }
    ],
    riskFactors: ['prior CHF', 'coronary artery disease', 'hypertension'],
    redFlags: ['Severe dyspnea at rest', 'Hypoxia', 'Hypotension'],
    workup: ['BNP', 'Chest X-ray', 'ECG', 'Echocardiogram'],
    urgency: 'urgent',
    description: 'Heart failure with fluid overload'
  },
  {
    id: 'appendicitis',
    name: 'Acute Appendicitis',
    icd10: 'K35',
    category: 'Gastrointestinal',
    basePrevalence: 100,
    symptoms: [
      { symptomId: 'abdominal_pain', likelihood: 0.95 },
      { symptomId: 'severe_abdominal_pain', likelihood: 0.7 },
      { symptomId: 'nausea', likelihood: 0.8 },
      { symptomId: 'vomiting', likelihood: 0.6 },
      { symptomId: 'fever', likelihood: 0.5 }
    ],
    riskFactors: ['age 10-30'],
    redFlags: ['RLQ tenderness', 'Rebound tenderness', 'Peritoneal signs'],
    workup: ['CT abdomen/pelvis', 'CBC', 'CRP', 'Surgical consultation'],
    urgency: 'urgent',
    description: 'Inflammation of the appendix'
  },
  {
    id: 'stroke',
    name: 'Acute Ischemic Stroke',
    icd10: 'I63',
    category: 'Neurological',
    basePrevalence: 150,
    symptoms: [
      { symptomId: 'focal_weakness', likelihood: 0.85 },
      { symptomId: 'confusion', likelihood: 0.5 },
      { symptomId: 'headache', likelihood: 0.3 }
    ],
    riskFactors: ['age > 60', 'hypertension', 'atrial fibrillation', 'diabetes'],
    redFlags: ['Sudden onset', 'Facial droop', 'Arm drift', 'Speech difficulty'],
    workup: ['CT head STAT', 'CT angiography', 'MRI brain'],
    urgency: 'emergent',
    description: 'Brain infarction from blocked cerebral artery'
  },
  {
    id: 'uti',
    name: 'Urinary Tract Infection',
    icd10: 'N39.0',
    category: 'Genitourinary',
    basePrevalence: 800,
    symptoms: [
      { symptomId: 'dysuria', likelihood: 0.9 },
      { symptomId: 'urinary_frequency', likelihood: 0.85 },
      { symptomId: 'abdominal_pain', likelihood: 0.4 },
      { symptomId: 'fever', likelihood: 0.3 }
    ],
    riskFactors: ['female', 'sexual activity', 'catheter use'],
    redFlags: ['Flank pain', 'High fever', 'Sepsis'],
    workup: ['Urinalysis', 'Urine culture'],
    urgency: 'routine',
    description: 'Bacterial infection of the urinary tract'
  },
  {
    id: 'gerd',
    name: 'Gastroesophageal Reflux Disease',
    icd10: 'K21',
    category: 'Gastrointestinal',
    basePrevalence: 2000,
    symptoms: [
      { symptomId: 'chest_pain', likelihood: 0.6 },
      { symptomId: 'cough', likelihood: 0.35 },
      { symptomId: 'nausea', likelihood: 0.3 }
    ],
    riskFactors: ['obesity', 'hiatal hernia', 'pregnancy'],
    redFlags: ['Dysphagia', 'Weight loss', 'GI bleeding'],
    workup: ['Trial of PPI', 'EGD if refractory'],
    urgency: 'routine',
    description: 'Acid reflux causing heartburn'
  }
];

// ============================================================================
// CLINICAL SCORING SYSTEMS
// ============================================================================

interface ScoringResult {
  name: string;
  score: number;
  maxScore: number;
  interpretation: string;
  riskCategory: string;
  recommendation: string;
}

class ClinicalScores {
  static wellsDVT(criteria: Record<string, boolean>): ScoringResult {
    let score = 0;
    if (criteria.activeCancer) score += 1;
    if (criteria.paralysisParesis) score += 1;
    if (criteria.recentBedridden) score += 1;
    if (criteria.localizedTenderness) score += 1;
    if (criteria.entireLegSwollen) score += 1;
    if (criteria.calfSwelling3cm) score += 1;
    if (criteria.pittingEdema) score += 1;
    if (criteria.collateralVeins) score += 1;
    if (criteria.previousDVT) score += 1;
    if (criteria.alternativeDiagnosis) score -= 2;

    let riskCategory: string;
    let recommendation: string;

    if (score >= 3) {
      riskCategory = 'High probability (75%)';
      recommendation = 'Proceed to imaging';
    } else if (score >= 1) {
      riskCategory = 'Moderate probability (17%)';
      recommendation = 'D-dimer testing; if positive, imaging';
    } else {
      riskCategory = 'Low probability (3%)';
      recommendation = 'D-dimer; if negative, DVT unlikely';
    }

    return {
      name: 'Wells Score for DVT',
      score,
      maxScore: 9,
      interpretation: `Score of ${score}`,
      riskCategory,
      recommendation
    };
  }

  static wellsPE(criteria: Record<string, boolean>): ScoringResult {
    let score = 0;
    if (criteria.clinicalDVTSigns) score += 3;
    if (criteria.peMostLikely) score += 3;
    if (criteria.heartRate100) score += 1.5;
    if (criteria.immobilization) score += 1.5;
    if (criteria.previousDVTPE) score += 1.5;
    if (criteria.hemoptysis) score += 1;
    if (criteria.malignancy) score += 1;

    let riskCategory: string;
    let recommendation: string;

    if (score > 6) {
      riskCategory = 'High probability';
      recommendation = 'CT pulmonary angiography';
    } else if (score >= 2) {
      riskCategory = 'Moderate probability';
      recommendation = 'D-dimer or CTPA';
    } else {
      riskCategory = 'Low probability';
      recommendation = 'D-dimer; if negative, PE unlikely';
    }

    return {
      name: 'Wells Score for PE',
      score,
      maxScore: 12.5,
      interpretation: `Score of ${score}`,
      riskCategory,
      recommendation
    };
  }

  static heartScore(criteria: Record<string, boolean>): ScoringResult {
    let score = 0;
    if (criteria.historyHighlySuspicious) score += 2;
    else if (criteria.historyModeratelySuspicious) score += 1;
    if (criteria.ecgSignificantSTDepression) score += 2;
    else if (criteria.ecgNonspecific) score += 1;
    if (criteria.age65Plus) score += 2;
    else if (criteria.age45to65) score += 1;
    if (criteria.riskFactors3Plus) score += 2;
    else if (criteria.riskFactors1or2) score += 1;
    if (criteria.troponinElevated) score += 2;
    else if (criteria.troponinSlightlyElevated) score += 1;

    let riskCategory: string;
    let recommendation: string;

    if (score >= 7) {
      riskCategory = 'High risk (50-65% MACE)';
      recommendation = 'Admit for observation and intervention';
    } else if (score >= 4) {
      riskCategory = 'Moderate risk (12-16.6% MACE)';
      recommendation = 'Observation, serial troponins';
    } else {
      riskCategory = 'Low risk (0.9-1.7% MACE)';
      recommendation = 'Consider discharge with follow-up';
    }

    return {
      name: 'HEART Score',
      score,
      maxScore: 10,
      interpretation: `Score of ${score}`,
      riskCategory,
      recommendation
    };
  }

  static curb65(criteria: Record<string, boolean>): ScoringResult {
    let score = 0;
    if (criteria.confusion) score += 1;
    if (criteria.bun20Plus) score += 1;
    if (criteria.respiratoryRate30Plus) score += 1;
    if (criteria.sbp90OrLess) score += 1;
    if (criteria.age65Plus) score += 1;

    let riskCategory: string;
    let recommendation: string;

    if (score >= 3) {
      riskCategory = 'Severe (mortality 15-40%)';
      recommendation = 'Consider ICU admission';
    } else if (score === 2) {
      riskCategory = 'Moderate (mortality 9%)';
      recommendation = 'Hospital admission';
    } else {
      riskCategory = 'Low (mortality <3%)';
      recommendation = 'May be suitable for outpatient';
    }

    return {
      name: 'CURB-65',
      score,
      maxScore: 5,
      interpretation: `Score of ${score}`,
      riskCategory,
      recommendation
    };
  }

  static cha2ds2vasc(criteria: Record<string, boolean>): ScoringResult {
    let score = 0;
    if (criteria.chf) score += 1;
    if (criteria.hypertension) score += 1;
    if (criteria.age75Plus) score += 2;
    if (criteria.diabetes) score += 1;
    if (criteria.stroke) score += 2;
    if (criteria.vascularDisease) score += 1;
    if (criteria.age65to74) score += 1;
    if (criteria.female) score += 1;

    let riskCategory: string;
    let recommendation: string;

    if (score >= 2) {
      riskCategory = 'High risk';
      recommendation = 'Oral anticoagulation recommended';
    } else if (score === 1) {
      riskCategory = 'Moderate risk';
      recommendation = 'Consider anticoagulation';
    } else {
      riskCategory = 'Low risk';
      recommendation = 'No anticoagulation needed';
    }

    return {
      name: 'CHA2DS2-VASc',
      score,
      maxScore: 9,
      interpretation: `Score of ${score}`,
      riskCategory,
      recommendation
    };
  }
}

// ============================================================================
// DIFFERENTIAL DIAGNOSIS ENGINE
// ============================================================================

interface DiagnosisCandidate {
  disease: Disease;
  probability: number;
  matchingSymptoms: string[];
  matchingRiskFactors: string[];
}

class DiagnosisEngine {
  generateDifferential(
    symptoms: string[],
    riskFactors: string[] = [],
    _age?: number,
    _gender?: 'male' | 'female'
  ): {
    differential: DiagnosisCandidate[];
    redFlagSymptoms: Symptom[];
    emergencyConditions: string[];
    recommendations: string[];
  } {
    const candidates: DiagnosisCandidate[] = [];
    const redFlagSymptoms: Symptom[] = [];
    const emergencyConditions: Set<string> = new Set();

    // Check for red flag symptoms
    for (const symptomId of symptoms) {
      const symptom = symptomDatabase[symptomId];
      if (symptom?.redFlag) {
        redFlagSymptoms.push(symptom);
        symptom.emergencyConditions?.forEach(c => emergencyConditions.add(c));
      }
    }

    // Calculate probability for each disease
    for (const disease of diseaseDatabase) {
      const matchingSymptoms: string[] = [];
      let symptomLikelihood = 1;
      let hasAnyMatch = false;

      for (const symptomId of symptoms) {
        const diseaseSymptom = disease.symptoms.find(s => s.symptomId === symptomId);
        if (diseaseSymptom) {
          matchingSymptoms.push(symptomDatabase[symptomId]?.name || symptomId);
          symptomLikelihood *= diseaseSymptom.likelihood;
          hasAnyMatch = true;
        } else {
          symptomLikelihood *= 0.1;
        }
      }

      if (!hasAnyMatch) continue;

      // Adjust for risk factors
      const matchingRiskFactors: string[] = [];
      let riskFactorMultiplier = 1;

      for (const rf of riskFactors) {
        const rfLower = rf.toLowerCase();
        if (disease.riskFactors.some(drf => drf.toLowerCase().includes(rfLower))) {
          matchingRiskFactors.push(rf);
          riskFactorMultiplier *= 1.5;
        }
      }

      // Calculate final probability
      const basePrior = disease.basePrevalence / 100000;
      const probability = Math.min(0.95, basePrior * symptomLikelihood * riskFactorMultiplier * 1000);

      if (probability > 0.01) {
        candidates.push({
          disease,
          probability,
          matchingSymptoms,
          matchingRiskFactors
        });
      }
    }

    candidates.sort((a, b) => b.probability - a.probability);

    // Generate recommendations
    const recommendations: string[] = [];

    if (redFlagSymptoms.length > 0) {
      recommendations.push('RED FLAG SYMPTOMS PRESENT - Consider emergent evaluation');
    }

    if (emergencyConditions.size > 0) {
      recommendations.push(`Rule out: ${Array.from(emergencyConditions).join(', ')}`);
    }

    const topCandidate = candidates[0];
    if (topCandidate) {
      recommendations.push(`Most likely: ${topCandidate.disease.name}`);
      recommendations.push(`Suggested workup: ${topCandidate.disease.workup.slice(0, 3).join(', ')}`);
    }

    return {
      differential: candidates.slice(0, 10),
      redFlagSymptoms,
      emergencyConditions: Array.from(emergencyConditions),
      recommendations
    };
  }

  listSymptoms(): { id: string; name: string; category: string; redFlag: boolean }[] {
    return Object.values(symptomDatabase).map(s => ({
      id: s.id,
      name: s.name,
      category: s.category,
      redFlag: s.redFlag
    }));
  }
}

// ============================================================================
// TOOL DEFINITION AND EXECUTOR
// ============================================================================

export const medicaldiagnosisTool: UnifiedTool = {
  name: 'medical_diagnosis',
  description: `Clinical decision support tool for differential diagnosis.

Features:
- Symptom-based differential diagnosis with probability scoring
- Red flag detection for emergency conditions
- Risk factor integration
- Clinical scoring systems (Wells, HEART, CURB-65, CHA2DS2-VASc)
- Suggested workup and testing recommendations

Operations:
- differential: Generate differential diagnosis from symptoms
- score: Calculate clinical scoring system
- list_symptoms: List available symptoms
- list_diseases: List diseases in database
- info: Tool documentation
- examples: Usage examples

DISCLAIMER: For educational purposes only. Not a substitute for professional medical advice.`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['differential', 'score', 'list_symptoms', 'list_diseases', 'info', 'examples'],
        description: 'Operation to perform'
      },
      symptoms: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of symptom IDs'
      },
      risk_factors: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of risk factors'
      },
      age: { type: 'number', description: 'Patient age' },
      gender: { type: 'string', enum: ['male', 'female'] },
      score_type: {
        type: 'string',
        enum: ['wells_dvt', 'wells_pe', 'heart', 'curb65', 'cha2ds2vasc'],
        description: 'Type of clinical score'
      },
      criteria: { type: 'object', description: 'Scoring criteria' }
    },
    required: ['operation']
  }
};

export async function executemedicaldiagnosis(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;
    const engine = new DiagnosisEngine();

    switch (operation) {
      case 'differential': {
        const symptoms = args.symptoms;
        if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
          return { toolCallId: id, content: 'Error: at least one symptom required', isError: true };
        }

        const result = engine.generateDifferential(symptoms, args.risk_factors || [], args.age, args.gender);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'differential',
            inputSymptoms: symptoms.map((s: string) => symptomDatabase[s]?.name || s),
            redFlagSymptoms: result.redFlagSymptoms.map(s => s.name),
            emergencyConditions: result.emergencyConditions,
            differential: result.differential.map((d, i) => ({
              rank: i + 1,
              diagnosis: d.disease.name,
              icd10: d.disease.icd10,
              probability: (d.probability * 100).toFixed(1) + '%',
              urgency: d.disease.urgency,
              matchingSymptoms: d.matchingSymptoms,
              workup: d.disease.workup
            })),
            recommendations: result.recommendations,
            disclaimer: 'Clinical correlation required'
          }, null, 2)
        };
      }

      case 'score': {
        const scoreType = args.score_type;
        const criteria = args.criteria || {};
        let result: ScoringResult;

        switch (scoreType) {
          case 'wells_dvt':
            result = ClinicalScores.wellsDVT(criteria);
            break;
          case 'wells_pe':
            result = ClinicalScores.wellsPE(criteria);
            break;
          case 'heart':
            result = ClinicalScores.heartScore(criteria);
            break;
          case 'curb65':
            result = ClinicalScores.curb65(criteria);
            break;
          case 'cha2ds2vasc':
            result = ClinicalScores.cha2ds2vasc(criteria);
            break;
          default:
            return {
              toolCallId: id,
              content: 'Error: Invalid score_type',
              isError: true
            };
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'score',
            scoringSystem: result.name,
            score: result.score,
            maxScore: result.maxScore,
            riskCategory: result.riskCategory,
            recommendation: result.recommendation
          }, null, 2)
        };
      }

      case 'list_symptoms': {
        const symptoms = engine.listSymptoms();
        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'list_symptoms',
            totalSymptoms: symptoms.length,
            symptoms
          }, null, 2)
        };
      }

      case 'list_diseases': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'list_diseases',
            totalDiseases: diseaseDatabase.length,
            diseases: diseaseDatabase.map(d => ({
              id: d.id,
              name: d.name,
              icd10: d.icd10,
              category: d.category,
              urgency: d.urgency
            }))
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'medical_diagnosis',
            version: '1.0.0',
            database: {
              symptoms: Object.keys(symptomDatabase).length,
              diseases: diseaseDatabase.length
            },
            scoringSystems: ['Wells DVT', 'Wells PE', 'HEART', 'CURB-65', 'CHA2DS2-VASc'],
            disclaimer: 'For educational purposes only'
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                name: 'Differential for chest pain',
                call: {
                  operation: 'differential',
                  symptoms: ['chest_pain', 'dyspnea'],
                  risk_factors: ['diabetes', 'hypertension'],
                  age: 55,
                  gender: 'male'
                }
              },
              {
                name: 'HEART Score',
                call: {
                  operation: 'score',
                  score_type: 'heart',
                  criteria: {
                    historyModeratelySuspicious: true,
                    ecgNonspecific: true,
                    age45to65: true
                  }
                }
              }
            ]
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: `Error: Unknown operation '${operation}'`,
          isError: true
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function ismedicaldiagnosisAvailable(): boolean {
  return true;
}
