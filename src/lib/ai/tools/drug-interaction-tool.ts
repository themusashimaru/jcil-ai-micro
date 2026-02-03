/**
 * DRUG-INTERACTION TOOL
 * Comprehensive drug interaction checker with pharmacology analysis
 *
 * Features:
 * - Drug-drug interaction checking
 * - Drug-food interaction analysis
 * - CYP450 metabolism interactions
 * - P-glycoprotein interactions
 * - Severity classification
 * - Clinical recommendations
 * - Mechanism explanations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// INTERACTION DATABASE TYPES
// ============================================================================

type SeverityLevel = 'contraindicated' | 'major' | 'moderate' | 'minor';
type InteractionType = 'pharmacokinetic' | 'pharmacodynamic' | 'mixed';
type CYPEnzyme = 'CYP1A2' | 'CYP2B6' | 'CYP2C8' | 'CYP2C9' | 'CYP2C19' | 'CYP2D6' | 'CYP2E1' | 'CYP3A4' | 'CYP3A5';
type EnzymeEffect = 'inhibitor' | 'inducer' | 'substrate' | 'strong_inhibitor' | 'strong_inducer';

interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: SeverityLevel;
  interactionType: InteractionType;
  mechanism: string;
  clinicalEffect: string;
  recommendation: string;
  documentation: 'excellent' | 'good' | 'fair' | 'poor';
}

interface DrugProfile {
  name: string;
  genericName: string;
  drugClass: string;
  cyp450: Partial<Record<CYPEnzyme, EnzymeEffect[]>>;
  pgp: ('substrate' | 'inhibitor' | 'inducer')[];
  renalElimination: number; // percentage
  hepaticMetabolism: number; // percentage
  halfLife: number; // hours
  proteinBinding: number; // percentage
  narrowTherapeuticIndex: boolean;
  qtProlongation: boolean;
  serotoninergic: boolean;
  anticholinergic: boolean;
  cnsDepressant: boolean;
  nephrotoxic: boolean;
  hepatotoxic: boolean;
  bleeedingRisk: boolean;
  foodInteractions: string[];
}

interface FoodInteraction {
  food: string;
  drugs: string[];
  effect: string;
  mechanism: string;
  recommendation: string;
}

// ============================================================================
// DRUG DATABASE
// ============================================================================

const drugProfiles: Record<string, DrugProfile> = {
  warfarin: {
    name: 'Warfarin',
    genericName: 'warfarin',
    drugClass: 'Anticoagulant',
    cyp450: {
      CYP2C9: ['substrate'],
      CYP1A2: ['substrate'],
      CYP3A4: ['substrate']
    },
    pgp: [],
    renalElimination: 10,
    hepaticMetabolism: 90,
    halfLife: 40,
    proteinBinding: 99,
    narrowTherapeuticIndex: true,
    qtProlongation: false,
    serotoninergic: false,
    anticholinergic: false,
    cnsDepressant: false,
    nephrotoxic: false,
    hepatotoxic: false,
    bleeedingRisk: true,
    foodInteractions: ['vitamin K rich foods', 'grapefruit', 'cranberry juice', 'alcohol']
  },
  amiodarone: {
    name: 'Amiodarone',
    genericName: 'amiodarone',
    drugClass: 'Antiarrhythmic',
    cyp450: {
      CYP3A4: ['inhibitor', 'substrate'],
      CYP2C9: ['inhibitor'],
      CYP2D6: ['inhibitor']
    },
    pgp: ['inhibitor'],
    renalElimination: 10,
    hepaticMetabolism: 90,
    halfLife: 1200, // ~50 days
    proteinBinding: 96,
    narrowTherapeuticIndex: true,
    qtProlongation: true,
    serotoninergic: false,
    anticholinergic: false,
    cnsDepressant: false,
    nephrotoxic: false,
    hepatotoxic: true,
    bleeedingRisk: false,
    foodInteractions: ['grapefruit']
  },
  simvastatin: {
    name: 'Simvastatin',
    genericName: 'simvastatin',
    drugClass: 'HMG-CoA reductase inhibitor',
    cyp450: {
      CYP3A4: ['substrate']
    },
    pgp: ['substrate'],
    renalElimination: 13,
    hepaticMetabolism: 87,
    halfLife: 3,
    proteinBinding: 95,
    narrowTherapeuticIndex: false,
    qtProlongation: false,
    serotoninergic: false,
    anticholinergic: false,
    cnsDepressant: false,
    nephrotoxic: false,
    hepatotoxic: true,
    bleeedingRisk: false,
    foodInteractions: ['grapefruit']
  },
  fluoxetine: {
    name: 'Fluoxetine',
    genericName: 'fluoxetine',
    drugClass: 'SSRI',
    cyp450: {
      CYP2D6: ['strong_inhibitor', 'substrate'],
      CYP2C19: ['inhibitor'],
      CYP3A4: ['inhibitor']
    },
    pgp: [],
    renalElimination: 15,
    hepaticMetabolism: 85,
    halfLife: 72,
    proteinBinding: 94,
    narrowTherapeuticIndex: false,
    qtProlongation: true,
    serotoninergic: true,
    anticholinergic: false,
    cnsDepressant: false,
    nephrotoxic: false,
    hepatotoxic: false,
    bleeedingRisk: true,
    foodInteractions: []
  },
  tramadol: {
    name: 'Tramadol',
    genericName: 'tramadol',
    drugClass: 'Opioid analgesic',
    cyp450: {
      CYP2D6: ['substrate'],
      CYP3A4: ['substrate']
    },
    pgp: [],
    renalElimination: 30,
    hepaticMetabolism: 70,
    halfLife: 6,
    proteinBinding: 20,
    narrowTherapeuticIndex: false,
    qtProlongation: false,
    serotoninergic: true,
    anticholinergic: false,
    cnsDepressant: true,
    nephrotoxic: false,
    hepatotoxic: false,
    bleeedingRisk: false,
    foodInteractions: ['alcohol']
  },
  metoprolol: {
    name: 'Metoprolol',
    genericName: 'metoprolol',
    drugClass: 'Beta-blocker',
    cyp450: {
      CYP2D6: ['substrate']
    },
    pgp: [],
    renalElimination: 10,
    hepaticMetabolism: 90,
    halfLife: 4,
    proteinBinding: 12,
    narrowTherapeuticIndex: false,
    qtProlongation: false,
    serotoninergic: false,
    anticholinergic: false,
    cnsDepressant: false,
    nephrotoxic: false,
    hepatotoxic: false,
    bleeedingRisk: false,
    foodInteractions: []
  },
  omeprazole: {
    name: 'Omeprazole',
    genericName: 'omeprazole',
    drugClass: 'Proton pump inhibitor',
    cyp450: {
      CYP2C19: ['inhibitor', 'substrate'],
      CYP3A4: ['substrate']
    },
    pgp: [],
    renalElimination: 20,
    hepaticMetabolism: 80,
    halfLife: 1,
    proteinBinding: 95,
    narrowTherapeuticIndex: false,
    qtProlongation: false,
    serotoninergic: false,
    anticholinergic: false,
    cnsDepressant: false,
    nephrotoxic: false,
    hepatotoxic: false,
    bleeedingRisk: false,
    foodInteractions: []
  },
  clopidogrel: {
    name: 'Clopidogrel',
    genericName: 'clopidogrel',
    drugClass: 'Antiplatelet',
    cyp450: {
      CYP2C19: ['substrate'],
      CYP3A4: ['substrate']
    },
    pgp: [],
    renalElimination: 50,
    hepaticMetabolism: 50,
    halfLife: 8,
    proteinBinding: 98,
    narrowTherapeuticIndex: false,
    qtProlongation: false,
    serotoninergic: false,
    anticholinergic: false,
    cnsDepressant: false,
    nephrotoxic: false,
    hepatotoxic: false,
    bleeedingRisk: true,
    foodInteractions: []
  },
  digoxin: {
    name: 'Digoxin',
    genericName: 'digoxin',
    drugClass: 'Cardiac glycoside',
    cyp450: {},
    pgp: ['substrate'],
    renalElimination: 70,
    hepaticMetabolism: 30,
    halfLife: 40,
    proteinBinding: 25,
    narrowTherapeuticIndex: true,
    qtProlongation: false,
    serotoninergic: false,
    anticholinergic: false,
    cnsDepressant: false,
    nephrotoxic: false,
    hepatotoxic: false,
    bleeedingRisk: false,
    foodInteractions: ['high fiber foods']
  },
  phenytoin: {
    name: 'Phenytoin',
    genericName: 'phenytoin',
    drugClass: 'Anticonvulsant',
    cyp450: {
      CYP2C9: ['substrate'],
      CYP2C19: ['substrate'],
      CYP3A4: ['strong_inducer']
    },
    pgp: ['inducer'],
    renalElimination: 5,
    hepaticMetabolism: 95,
    halfLife: 22,
    proteinBinding: 90,
    narrowTherapeuticIndex: true,
    qtProlongation: false,
    serotoninergic: false,
    anticholinergic: false,
    cnsDepressant: true,
    nephrotoxic: false,
    hepatotoxic: true,
    bleeedingRisk: false,
    foodInteractions: ['enteral feeds', 'folic acid']
  },
  metformin: {
    name: 'Metformin',
    genericName: 'metformin',
    drugClass: 'Biguanide',
    cyp450: {},
    pgp: [],
    renalElimination: 90,
    hepaticMetabolism: 10,
    halfLife: 5,
    proteinBinding: 0,
    narrowTherapeuticIndex: false,
    qtProlongation: false,
    serotoninergic: false,
    anticholinergic: false,
    cnsDepressant: false,
    nephrotoxic: false,
    hepatotoxic: false,
    bleeedingRisk: false,
    foodInteractions: ['alcohol']
  },
  lithium: {
    name: 'Lithium',
    genericName: 'lithium',
    drugClass: 'Mood stabilizer',
    cyp450: {},
    pgp: [],
    renalElimination: 95,
    hepaticMetabolism: 5,
    halfLife: 24,
    proteinBinding: 0,
    narrowTherapeuticIndex: true,
    qtProlongation: false,
    serotoninergic: false,
    anticholinergic: false,
    cnsDepressant: true,
    nephrotoxic: true,
    hepatotoxic: false,
    bleeedingRisk: false,
    foodInteractions: ['caffeine', 'sodium']
  },
  ketoconazole: {
    name: 'Ketoconazole',
    genericName: 'ketoconazole',
    drugClass: 'Antifungal',
    cyp450: {
      CYP3A4: ['strong_inhibitor']
    },
    pgp: ['inhibitor'],
    renalElimination: 13,
    hepaticMetabolism: 87,
    halfLife: 8,
    proteinBinding: 99,
    narrowTherapeuticIndex: false,
    qtProlongation: true,
    serotoninergic: false,
    anticholinergic: false,
    cnsDepressant: false,
    nephrotoxic: false,
    hepatotoxic: true,
    bleeedingRisk: false,
    foodInteractions: ['alcohol']
  },
  rifampin: {
    name: 'Rifampin',
    genericName: 'rifampin',
    drugClass: 'Antibiotic',
    cyp450: {
      CYP3A4: ['strong_inducer'],
      CYP2C9: ['inducer'],
      CYP2C19: ['inducer'],
      CYP1A2: ['inducer']
    },
    pgp: ['inducer'],
    renalElimination: 30,
    hepaticMetabolism: 70,
    halfLife: 3,
    proteinBinding: 80,
    narrowTherapeuticIndex: false,
    qtProlongation: false,
    serotoninergic: false,
    anticholinergic: false,
    cnsDepressant: false,
    nephrotoxic: false,
    hepatotoxic: true,
    bleeedingRisk: false,
    foodInteractions: []
  }
};

// Known drug-drug interactions
const knownInteractions: DrugInteraction[] = [
  {
    drug1: 'warfarin',
    drug2: 'amiodarone',
    severity: 'major',
    interactionType: 'pharmacokinetic',
    mechanism: 'Amiodarone inhibits CYP2C9 and CYP3A4, reducing warfarin metabolism',
    clinicalEffect: 'Increased INR and bleeding risk (30-50% INR increase expected)',
    recommendation: 'Reduce warfarin dose by 30-50% when starting amiodarone. Monitor INR closely.',
    documentation: 'excellent'
  },
  {
    drug1: 'simvastatin',
    drug2: 'amiodarone',
    severity: 'major',
    interactionType: 'pharmacokinetic',
    mechanism: 'Amiodarone inhibits CYP3A4, increasing simvastatin levels',
    clinicalEffect: 'Increased risk of myopathy and rhabdomyolysis',
    recommendation: 'Maximum simvastatin dose 20mg/day with amiodarone. Consider alternative statin.',
    documentation: 'excellent'
  },
  {
    drug1: 'fluoxetine',
    drug2: 'tramadol',
    severity: 'major',
    interactionType: 'mixed',
    mechanism: 'Both drugs increase serotonin; fluoxetine inhibits CYP2D6 reducing tramadol activation',
    clinicalEffect: 'Risk of serotonin syndrome; reduced tramadol analgesic effect',
    recommendation: 'Avoid combination. If necessary, use lowest doses and monitor for serotonin syndrome.',
    documentation: 'good'
  },
  {
    drug1: 'fluoxetine',
    drug2: 'metoprolol',
    severity: 'moderate',
    interactionType: 'pharmacokinetic',
    mechanism: 'Fluoxetine inhibits CYP2D6, increasing metoprolol levels',
    clinicalEffect: 'Enhanced beta-blockade, bradycardia, hypotension',
    recommendation: 'Monitor heart rate and blood pressure. May need to reduce metoprolol dose.',
    documentation: 'good'
  },
  {
    drug1: 'omeprazole',
    drug2: 'clopidogrel',
    severity: 'major',
    interactionType: 'pharmacokinetic',
    mechanism: 'Omeprazole inhibits CYP2C19, reducing clopidogrel activation',
    clinicalEffect: 'Reduced antiplatelet effect, increased cardiovascular event risk',
    recommendation: 'Use pantoprazole instead (does not inhibit CYP2C19 significantly).',
    documentation: 'good'
  },
  {
    drug1: 'amiodarone',
    drug2: 'digoxin',
    severity: 'major',
    interactionType: 'pharmacokinetic',
    mechanism: 'Amiodarone inhibits P-glycoprotein, reducing digoxin elimination',
    clinicalEffect: 'Increased digoxin levels (up to 100%), risk of toxicity',
    recommendation: 'Reduce digoxin dose by 50% when starting amiodarone. Monitor levels.',
    documentation: 'excellent'
  },
  {
    drug1: 'phenytoin',
    drug2: 'warfarin',
    severity: 'major',
    interactionType: 'pharmacokinetic',
    mechanism: 'Complex: initial inhibition then induction of warfarin metabolism',
    clinicalEffect: 'Unpredictable changes in INR',
    recommendation: 'Monitor INR frequently. May need significant warfarin dose adjustments.',
    documentation: 'good'
  },
  {
    drug1: 'ketoconazole',
    drug2: 'simvastatin',
    severity: 'contraindicated',
    interactionType: 'pharmacokinetic',
    mechanism: 'Ketoconazole strongly inhibits CYP3A4, dramatically increasing statin levels',
    clinicalEffect: 'High risk of rhabdomyolysis',
    recommendation: 'Combination is contraindicated. Use alternative antifungal or statin.',
    documentation: 'excellent'
  },
  {
    drug1: 'rifampin',
    drug2: 'warfarin',
    severity: 'major',
    interactionType: 'pharmacokinetic',
    mechanism: 'Rifampin strongly induces CYP enzymes, increasing warfarin metabolism',
    clinicalEffect: 'Significantly reduced anticoagulation (INR may decrease 50% or more)',
    recommendation: 'May need 2-3x warfarin dose. Monitor INR frequently. Consider alternative.',
    documentation: 'excellent'
  },
  {
    drug1: 'lithium',
    drug2: 'metformin',
    severity: 'moderate',
    interactionType: 'pharmacokinetic',
    mechanism: 'Both drugs are renally eliminated; competition at transporters',
    clinicalEffect: 'Potential for increased lithium levels',
    recommendation: 'Monitor lithium levels when starting or adjusting metformin.',
    documentation: 'fair'
  }
];

// Food interactions database
const foodInteractions: FoodInteraction[] = [
  {
    food: 'Grapefruit',
    drugs: ['simvastatin', 'amiodarone', 'felodipine', 'cyclosporine'],
    effect: 'Increases drug levels significantly',
    mechanism: 'Inhibits intestinal CYP3A4 and P-glycoprotein',
    recommendation: 'Avoid grapefruit products with these medications'
  },
  {
    food: 'Vitamin K rich foods',
    drugs: ['warfarin'],
    effect: 'Reduces anticoagulation effect',
    mechanism: 'Vitamin K antagonizes warfarin mechanism',
    recommendation: 'Maintain consistent vitamin K intake; avoid dramatic changes'
  },
  {
    food: 'Alcohol',
    drugs: ['metformin', 'tramadol', 'warfarin', 'ketoconazole'],
    effect: 'Variable effects depending on drug',
    mechanism: 'Competes for metabolism; enhances CNS depression; increases bleeding risk',
    recommendation: 'Limit or avoid alcohol with these medications'
  },
  {
    food: 'Tyramine-rich foods',
    drugs: ['MAO inhibitors', 'linezolid'],
    effect: 'Hypertensive crisis',
    mechanism: 'Tyramine accumulation due to MAO inhibition',
    recommendation: 'Avoid aged cheeses, cured meats, fermented foods'
  },
  {
    food: 'Caffeine',
    drugs: ['lithium', 'theophylline', 'clozapine'],
    effect: 'Altered drug levels',
    mechanism: 'CYP1A2 substrate interactions; renal effects',
    recommendation: 'Maintain consistent caffeine intake'
  }
];

// ============================================================================
// INTERACTION CHECKER ENGINE
// ============================================================================

interface InteractionResult {
  found: boolean;
  severity?: SeverityLevel;
  interactions: DrugInteraction[];
  cypInteractions: {
    enzyme: CYPEnzyme;
    drug1Effect: string;
    drug2Effect: string;
    concern: string;
  }[];
  pharmacodynamicConcerns: string[];
  recommendations: string[];
}

class InteractionChecker {
  checkDrugPair(drug1Name: string, drug2Name: string): InteractionResult {
    const drug1 = drugProfiles[drug1Name.toLowerCase()];
    const drug2 = drugProfiles[drug2Name.toLowerCase()];

    const result: InteractionResult = {
      found: false,
      interactions: [],
      cypInteractions: [],
      pharmacodynamicConcerns: [],
      recommendations: []
    };

    // Check known interactions database
    const knownInteraction = this.findKnownInteraction(drug1Name, drug2Name);
    if (knownInteraction) {
      result.found = true;
      result.severity = knownInteraction.severity;
      result.interactions.push(knownInteraction);
      result.recommendations.push(knownInteraction.recommendation);
    }

    // If we have profiles, analyze CYP interactions
    if (drug1 && drug2) {
      const cypResults = this.analyzeCYPInteractions(drug1, drug2);
      if (cypResults.length > 0) {
        result.found = true;
        result.cypInteractions = cypResults;

        // Determine severity from CYP interactions if not already set
        if (!result.severity) {
          const hasStrongInteraction = cypResults.some(
            r => r.drug1Effect.includes('strong') || r.drug2Effect.includes('strong')
          );
          result.severity = hasStrongInteraction ? 'major' : 'moderate';
        }
      }

      // Check pharmacodynamic interactions
      const pdConcerns = this.analyzePharmacodynamicInteractions(drug1, drug2);
      if (pdConcerns.length > 0) {
        result.found = true;
        result.pharmacodynamicConcerns = pdConcerns;
        if (!result.severity || result.severity === 'minor') {
          result.severity = 'moderate';
        }
      }

      // Check P-glycoprotein interactions
      const pgpConcerns = this.analyzePgpInteractions(drug1, drug2);
      if (pgpConcerns) {
        result.pharmacodynamicConcerns.push(pgpConcerns);
      }

      // Generate recommendations
      this.generateRecommendations(result, drug1, drug2);
    }

    return result;
  }

  private findKnownInteraction(drug1: string, drug2: string): DrugInteraction | null {
    const d1 = drug1.toLowerCase();
    const d2 = drug2.toLowerCase();

    return knownInteractions.find(
      i => (i.drug1 === d1 && i.drug2 === d2) || (i.drug1 === d2 && i.drug2 === d1)
    ) || null;
  }

  private analyzeCYPInteractions(drug1: DrugProfile, drug2: DrugProfile): {
    enzyme: CYPEnzyme;
    drug1Effect: string;
    drug2Effect: string;
    concern: string;
  }[] {
    const results: {
      enzyme: CYPEnzyme;
      drug1Effect: string;
      drug2Effect: string;
      concern: string;
    }[] = [];

    const enzymes: CYPEnzyme[] = ['CYP1A2', 'CYP2B6', 'CYP2C8', 'CYP2C9', 'CYP2C19', 'CYP2D6', 'CYP2E1', 'CYP3A4', 'CYP3A5'];

    for (const enzyme of enzymes) {
      const d1Effects = drug1.cyp450[enzyme] || [];
      const d2Effects = drug2.cyp450[enzyme] || [];

      if (d1Effects.length === 0 && d2Effects.length === 0) continue;

      // Check for inhibitor + substrate combinations
      const d1Inhibits = d1Effects.some(e => e.includes('inhibitor'));
      const d2Inhibits = d2Effects.some(e => e.includes('inhibitor'));
      const d1Substrate = d1Effects.includes('substrate');
      const d2Substrate = d2Effects.includes('substrate');
      const d1Induces = d1Effects.some(e => e.includes('inducer'));
      const d2Induces = d2Effects.some(e => e.includes('inducer'));

      if (d1Inhibits && d2Substrate) {
        const strength = d1Effects.includes('strong_inhibitor') ? 'strong' : 'moderate';
        results.push({
          enzyme,
          drug1Effect: d1Effects.join(', '),
          drug2Effect: d2Effects.join(', '),
          concern: `${drug1.name} (${strength} ${enzyme} inhibitor) may increase ${drug2.name} levels`
        });
      }

      if (d2Inhibits && d1Substrate) {
        const strength = d2Effects.includes('strong_inhibitor') ? 'strong' : 'moderate';
        results.push({
          enzyme,
          drug1Effect: d1Effects.join(', '),
          drug2Effect: d2Effects.join(', '),
          concern: `${drug2.name} (${strength} ${enzyme} inhibitor) may increase ${drug1.name} levels`
        });
      }

      if (d1Induces && d2Substrate) {
        const strength = d1Effects.includes('strong_inducer') ? 'strong' : 'moderate';
        results.push({
          enzyme,
          drug1Effect: d1Effects.join(', '),
          drug2Effect: d2Effects.join(', '),
          concern: `${drug1.name} (${strength} ${enzyme} inducer) may decrease ${drug2.name} levels`
        });
      }

      if (d2Induces && d1Substrate) {
        const strength = d2Effects.includes('strong_inducer') ? 'strong' : 'moderate';
        results.push({
          enzyme,
          drug1Effect: d1Effects.join(', '),
          drug2Effect: d2Effects.join(', '),
          concern: `${drug2.name} (${strength} ${enzyme} inducer) may decrease ${drug1.name} levels`
        });
      }
    }

    return results;
  }

  private analyzePharmacodynamicInteractions(drug1: DrugProfile, drug2: DrugProfile): string[] {
    const concerns: string[] = [];

    // QT prolongation
    if (drug1.qtProlongation && drug2.qtProlongation) {
      concerns.push('Additive QT prolongation risk - monitor ECG for QTc changes');
    }

    // Serotonin syndrome
    if (drug1.serotoninergic && drug2.serotoninergic) {
      concerns.push('Risk of serotonin syndrome - monitor for hyperthermia, rigidity, myoclonus');
    }

    // CNS depression
    if (drug1.cnsDepressant && drug2.cnsDepressant) {
      concerns.push('Additive CNS depression - increased sedation, respiratory depression risk');
    }

    // Bleeding risk
    if (drug1.bleeedingRisk && drug2.bleeedingRisk) {
      concerns.push('Additive bleeding risk - monitor for signs of bleeding');
    }

    // Nephrotoxicity
    if (drug1.nephrotoxic && drug2.nephrotoxic) {
      concerns.push('Combined nephrotoxicity risk - monitor renal function closely');
    }

    // Hepatotoxicity
    if (drug1.hepatotoxic && drug2.hepatotoxic) {
      concerns.push('Combined hepatotoxicity risk - monitor liver function');
    }

    // Anticholinergic effects
    if (drug1.anticholinergic && drug2.anticholinergic) {
      concerns.push('Additive anticholinergic effects - risk of confusion, urinary retention');
    }

    return concerns;
  }

  private analyzePgpInteractions(drug1: DrugProfile, drug2: DrugProfile): string | null {
    const d1IsSubstrate = drug1.pgp.includes('substrate');
    const d2IsSubstrate = drug2.pgp.includes('substrate');
    const d1Inhibits = drug1.pgp.includes('inhibitor');
    const d2Inhibits = drug2.pgp.includes('inhibitor');
    const d1Induces = drug1.pgp.includes('inducer');
    const d2Induces = drug2.pgp.includes('inducer');

    if (d1Inhibits && d2IsSubstrate) {
      return `${drug1.name} inhibits P-glycoprotein, potentially increasing ${drug2.name} absorption/levels`;
    }
    if (d2Inhibits && d1IsSubstrate) {
      return `${drug2.name} inhibits P-glycoprotein, potentially increasing ${drug1.name} absorption/levels`;
    }
    if (d1Induces && d2IsSubstrate) {
      return `${drug1.name} induces P-glycoprotein, potentially decreasing ${drug2.name} levels`;
    }
    if (d2Induces && d1IsSubstrate) {
      return `${drug2.name} induces P-glycoprotein, potentially decreasing ${drug1.name} levels`;
    }

    return null;
  }

  private generateRecommendations(result: InteractionResult, drug1: DrugProfile, drug2: DrugProfile): void {
    // Add general monitoring recommendations
    if (drug1.narrowTherapeuticIndex || drug2.narrowTherapeuticIndex) {
      result.recommendations.push('One or both drugs have narrow therapeutic index - close monitoring required');
    }

    if (result.pharmacodynamicConcerns.some(c => c.includes('QT'))) {
      result.recommendations.push('Obtain baseline ECG and monitor QTc interval');
    }

    if (result.pharmacodynamicConcerns.some(c => c.includes('serotonin'))) {
      result.recommendations.push('Educate patient on serotonin syndrome symptoms');
    }

    if (result.cypInteractions.some(c => c.concern.includes('increase'))) {
      result.recommendations.push('Consider dose reduction of affected drug');
    }

    if (result.cypInteractions.some(c => c.concern.includes('decrease'))) {
      result.recommendations.push('Consider dose increase of affected drug or alternative therapy');
    }
  }

  checkFoodInteraction(drugName: string): FoodInteraction[] {
    const drug = drugProfiles[drugName.toLowerCase()];
    const interactions: FoodInteraction[] = [];

    // Check drug profile for food interactions
    if (drug && drug.foodInteractions.length > 0) {
      for (const food of drug.foodInteractions) {
        const foodInt = foodInteractions.find(
          f => f.food.toLowerCase().includes(food.toLowerCase()) ||
               food.toLowerCase().includes(f.food.toLowerCase())
        );
        if (foodInt) {
          interactions.push(foodInt);
        } else {
          interactions.push({
            food,
            drugs: [drugName],
            effect: 'Potential interaction',
            mechanism: 'See drug-specific information',
            recommendation: `Use caution with ${food} when taking ${drugName}`
          });
        }
      }
    }

    // Check food database
    for (const foodInt of foodInteractions) {
      if (foodInt.drugs.some(d => d.toLowerCase() === drugName.toLowerCase())) {
        if (!interactions.find(i => i.food === foodInt.food)) {
          interactions.push(foodInt);
        }
      }
    }

    return interactions;
  }

  checkMultipleDrugs(drugs: string[]): {
    pairs: { drugs: string[]; result: InteractionResult }[];
    summary: {
      totalInteractions: number;
      contraindicated: number;
      major: number;
      moderate: number;
      minor: number;
    };
    highestSeverity: SeverityLevel | null;
  } {
    const pairs: { drugs: string[]; result: InteractionResult }[] = [];
    let contraindicated = 0;
    let major = 0;
    let moderate = 0;
    let minor = 0;
    let highestSeverity: SeverityLevel | null = null;

    // Check all pairs
    for (let i = 0; i < drugs.length; i++) {
      for (let j = i + 1; j < drugs.length; j++) {
        const result = this.checkDrugPair(drugs[i], drugs[j]);
        if (result.found) {
          pairs.push({
            drugs: [drugs[i], drugs[j]],
            result
          });

          switch (result.severity) {
            case 'contraindicated':
              contraindicated++;
              if (!highestSeverity) highestSeverity = 'contraindicated';
              break;
            case 'major':
              major++;
              if (!highestSeverity || highestSeverity !== 'contraindicated') {
                highestSeverity = 'major';
              }
              break;
            case 'moderate':
              moderate++;
              if (!highestSeverity || (highestSeverity !== 'contraindicated' && highestSeverity !== 'major')) {
                highestSeverity = 'moderate';
              }
              break;
            case 'minor':
              minor++;
              if (!highestSeverity) highestSeverity = 'minor';
              break;
          }
        }
      }
    }

    return {
      pairs,
      summary: {
        totalInteractions: pairs.length,
        contraindicated,
        major,
        moderate,
        minor
      },
      highestSeverity
    };
  }
}

// ============================================================================
// TOOL DEFINITION AND EXECUTOR
// ============================================================================

export const druginteractionTool: UnifiedTool = {
  name: 'drug_interaction',
  description: `Comprehensive drug interaction checker with pharmacology analysis for clinical decision support.

Features:
- Drug-drug interaction checking with severity classification
- CYP450 enzyme interaction analysis
- P-glycoprotein transporter interactions
- Pharmacodynamic interaction detection (QT, serotonin, CNS depression)
- Drug-food interaction checking
- Multiple drug regimen analysis
- Clinical recommendations

Severity Levels:
- Contraindicated: Combination should be avoided
- Major: Life-threatening or permanent damage possible
- Moderate: May require intervention or monitoring
- Minor: Minimal clinical significance

Operations:
- check_pair: Check interaction between two drugs
- check_list: Check all interactions in a medication list
- food_interaction: Check food interactions for a drug
- drug_profile: Get pharmacological profile of a drug
- cyp450_info: Get CYP450 enzyme information
- info: Tool documentation
- examples: Usage examples

DISCLAIMER: This tool is for educational purposes only. Always consult
clinical pharmacists and current drug references for patient care decisions.`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['check_pair', 'check_list', 'food_interaction', 'drug_profile', 'cyp450_info', 'info', 'examples'],
        description: 'Operation to perform'
      },
      drug1: { type: 'string', description: 'First drug name' },
      drug2: { type: 'string', description: 'Second drug name' },
      drugs: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of drugs to check for interactions'
      },
      drug_name: { type: 'string', description: 'Drug name for profile lookup' }
    },
    required: ['operation']
  }
};

export async function executedruginteraction(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;
    const checker = new InteractionChecker();

    switch (operation) {
      case 'check_pair': {
        const drug1 = args.drug1;
        const drug2 = args.drug2;

        if (!drug1 || !drug2) {
          return { toolCallId: id, content: 'Error: drug1 and drug2 are required', isError: true };
        }

        const result = checker.checkDrugPair(drug1, drug2);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'check_pair',
            drugs: [drug1, drug2],
            interactionFound: result.found,
            severity: result.severity || 'none',
            knownInteractions: result.interactions.map(i => ({
              severity: i.severity,
              type: i.interactionType,
              mechanism: i.mechanism,
              clinicalEffect: i.clinicalEffect,
              recommendation: i.recommendation,
              documentation: i.documentation
            })),
            cypInteractions: result.cypInteractions,
            pharmacodynamicConcerns: result.pharmacodynamicConcerns,
            recommendations: result.recommendations
          }, null, 2)
        };
      }

      case 'check_list': {
        const drugs = args.drugs;

        if (!drugs || !Array.isArray(drugs) || drugs.length < 2) {
          return { toolCallId: id, content: 'Error: at least 2 drugs required in drugs array', isError: true };
        }

        const result = checker.checkMultipleDrugs(drugs);

        const formattedPairs = result.pairs.map(p => ({
          drugPair: p.drugs.join(' + '),
          severity: p.result.severity,
          concerns: [
            ...p.result.interactions.map(i => i.clinicalEffect),
            ...p.result.pharmacodynamicConcerns
          ],
          recommendations: p.result.recommendations
        }));

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'check_list',
            drugsChecked: drugs,
            summary: result.summary,
            highestSeverity: result.highestSeverity || 'none',
            interactions: formattedPairs,
            overallRecommendation: result.summary.contraindicated > 0
              ? 'REVIEW REQUIRED: Contraindicated combination(s) found'
              : result.summary.major > 0
                ? 'CAUTION: Major interaction(s) found - clinical review recommended'
                : result.summary.moderate > 0
                  ? 'Note: Moderate interaction(s) found - monitoring advised'
                  : 'No significant interactions detected'
          }, null, 2)
        };
      }

      case 'food_interaction': {
        const drugName = args.drug_name || args.drug1;

        if (!drugName) {
          return { toolCallId: id, content: 'Error: drug_name is required', isError: true };
        }

        const interactions = checker.checkFoodInteraction(drugName);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'food_interaction',
            drug: drugName,
            interactionsFound: interactions.length > 0,
            interactions: interactions.map(i => ({
              food: i.food,
              effect: i.effect,
              mechanism: i.mechanism,
              recommendation: i.recommendation
            })),
            generalAdvice: 'Patients should inform healthcare providers about their dietary habits'
          }, null, 2)
        };
      }

      case 'drug_profile': {
        const drugName = args.drug_name?.toLowerCase();

        if (!drugName) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'drug_profile',
              availableDrugs: Object.keys(drugProfiles),
              note: 'Provide drug_name parameter to get profile'
            }, null, 2)
          };
        }

        const profile = drugProfiles[drugName];
        if (!profile) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              error: `Drug "${drugName}" not found in database`,
              availableDrugs: Object.keys(drugProfiles)
            }, null, 2),
            isError: true
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'drug_profile',
            profile: {
              name: profile.name,
              class: profile.drugClass,
              cyp450Metabolism: profile.cyp450,
              pgpTransporter: profile.pgp,
              elimination: {
                renal: profile.renalElimination + '%',
                hepatic: profile.hepaticMetabolism + '%'
              },
              halfLife: profile.halfLife + ' hours',
              proteinBinding: profile.proteinBinding + '%',
              warnings: {
                narrowTherapeuticIndex: profile.narrowTherapeuticIndex,
                qtProlongation: profile.qtProlongation,
                serotoninergic: profile.serotoninergic,
                cnsDepressant: profile.cnsDepressant,
                nephrotoxic: profile.nephrotoxic,
                hepatotoxic: profile.hepatotoxic,
                bleedingRisk: profile.bleeedingRisk
              },
              foodInteractions: profile.foodInteractions
            }
          }, null, 2)
        };
      }

      case 'cyp450_info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'cyp450_info',
            enzymes: {
              CYP1A2: {
                substrates: 'caffeine, theophylline, clozapine, duloxetine',
                inhibitors: 'fluvoxamine, ciprofloxacin',
                inducers: 'smoking, omeprazole, rifampin'
              },
              CYP2C9: {
                substrates: 'warfarin, phenytoin, NSAIDs, losartan',
                inhibitors: 'fluconazole, amiodarone, metronidazole',
                inducers: 'rifampin, carbamazepine'
              },
              CYP2C19: {
                substrates: 'clopidogrel, omeprazole, diazepam, citalopram',
                inhibitors: 'omeprazole, fluoxetine, fluvoxamine',
                inducers: 'rifampin, carbamazepine'
              },
              CYP2D6: {
                substrates: 'codeine, tramadol, metoprolol, tamoxifen, antidepressants',
                inhibitors: 'fluoxetine, paroxetine, bupropion, quinidine',
                inducers: 'None significant (not inducible)'
              },
              CYP3A4: {
                substrates: 'statins, calcium channel blockers, HIV protease inhibitors, benzodiazepines',
                inhibitors: 'ketoconazole, itraconazole, clarithromycin, grapefruit',
                inducers: 'rifampin, phenytoin, carbamazepine, St. Johns Wort'
              }
            },
            clinicalPearls: [
              'CYP3A4 metabolizes ~50% of all drugs',
              'CYP2D6 shows significant genetic polymorphism',
              'Multiple CYP inhibitors have additive effects',
              'Induction takes 1-2 weeks to reach maximum effect'
            ]
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'drug_interaction',
            version: '1.0.0',
            description: 'Drug interaction checker with pharmacology analysis',
            capabilities: {
              interactions: ['Drug-drug', 'Drug-food', 'Multiple drug regimen'],
              mechanisms: ['CYP450 metabolism', 'P-glycoprotein transport', 'Pharmacodynamic'],
              severityLevels: ['Contraindicated', 'Major', 'Moderate', 'Minor']
            },
            database: {
              drugs: Object.keys(drugProfiles).length,
              knownInteractions: knownInteractions.length,
              foodInteractions: foodInteractions.length
            },
            disclaimer: 'This tool is for educational purposes only. Always consult clinical pharmacists and current drug references for patient care decisions.'
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                name: 'Check two drugs',
                call: {
                  operation: 'check_pair',
                  drug1: 'warfarin',
                  drug2: 'amiodarone'
                }
              },
              {
                name: 'Check medication list',
                call: {
                  operation: 'check_list',
                  drugs: ['warfarin', 'amiodarone', 'simvastatin', 'metoprolol']
                }
              },
              {
                name: 'Check food interactions',
                call: {
                  operation: 'food_interaction',
                  drug_name: 'simvastatin'
                }
              },
              {
                name: 'Get drug profile',
                call: {
                  operation: 'drug_profile',
                  drug_name: 'fluoxetine'
                }
              }
            ]
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: `Error: Unknown operation '${operation}'. Valid operations: check_pair, check_list, food_interaction, drug_profile, cyp450_info, info, examples`,
          isError: true
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isdruginteractionAvailable(): boolean {
  return true;
}
