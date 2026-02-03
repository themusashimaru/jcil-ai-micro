/**
 * KINSHIP-SYSTEM TOOL
 * Anthropological kinship analysis with descent systems, marriage rules, and terminology
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Kinship terminology systems
type KinshipSystem = 'Eskimo' | 'Hawaiian' | 'Sudanese' | 'Omaha' | 'Crow' | 'Iroquois';

// Descent types
type DescentType = 'patrilineal' | 'matrilineal' | 'bilateral' | 'ambilineal' | 'double';

// Marriage rules
export type MarriageRule = 'monogamy' | 'polygyny' | 'polyandry' | 'polygynandry' | 'group';

interface KinshipTerminology {
  system: KinshipSystem;
  description: string;
  characteristics: string[];
  merging_patterns: Record<string, string[]>;
  societies: string[];
  diagram: string[];
}

export interface RelationshipInfo {
  relationship: string;
  term: string;
  sex_of_relative: 'male' | 'female' | 'any';
  generation: number;
  lineage: 'paternal' | 'maternal' | 'ego';
  consanguinity: 'consanguineal' | 'affinal';
}

// Kinship terminology systems data
const KINSHIP_SYSTEMS: Record<KinshipSystem, KinshipTerminology> = {
  Eskimo: {
    system: 'Eskimo',
    description:
      'Distinguishes lineal relatives (parents, children) from collateral relatives (aunts, uncles, cousins)',
    characteristics: [
      'Nuclear family emphasized',
      'Aunts/uncles distinguished from parents',
      'All cousins grouped together',
      'Common in bilateral descent societies',
    ],
    merging_patterns: {
      Father: ['Father'],
      Mother: ['Mother'],
      Uncle: ["Father's Brother", "Mother's Brother"],
      Aunt: ["Father's Sister", "Mother's Sister"],
      Cousin: ['All parallel and cross cousins'],
      Brother: ['Brother'],
      Sister: ['Sister'],
    },
    societies: ['Inuit', 'North Americans', 'Europeans', 'Most Western societies'],
    diagram: [
      '        GF=GM         GF=GM        ',
      '           |             |         ',
      '    U---F===M---U     A---F===M---A',
      '        |   |             |   |    ',
      '    C---Ego---C       C---Ego---C  ',
      '',
      'GF/GM = Grandparents, F = Father, M = Mother',
      'U = Uncle, A = Aunt, C = Cousin, Ego = Self',
    ],
  },
  Hawaiian: {
    system: 'Hawaiian',
    description:
      'The most classificatory system - merges all relatives of the same generation and sex',
    characteristics: [
      'Simplest terminology system',
      'Generation and sex are key distinctions',
      'All male relatives of parent\'s generation called "father"',
      'All female relatives of parent\'s generation called "mother"',
      'All cousins are "siblings"',
    ],
    merging_patterns: {
      Father: ['Father', "Father's Brother", "Mother's Brother"],
      Mother: ['Mother', "Father's Sister", "Mother's Sister"],
      Brother: ['Brother', 'All male cousins'],
      Sister: ['Sister', 'All female cousins'],
    },
    societies: ['Hawaii (traditional)', 'Polynesia', 'Parts of Africa'],
    diagram: [
      '     "Father"  "Mother"  "Father"  "Mother"',
      '         \\      /            \\      /      ',
      '          \\    /              \\    /       ',
      '       "Brother/Sister"   "Brother/Sister" ',
      '',
      'All same-generation same-sex relatives share terms',
    ],
  },
  Sudanese: {
    system: 'Sudanese',
    description: 'The most descriptive system - separate terms for every type of relative',
    characteristics: [
      'Most complex terminology',
      'No two types of relatives share a term',
      'Eight different terms for aunts/uncles',
      'Distinguishes all types of cousins',
      'Often associated with patrilineal descent',
    ],
    merging_patterns: {
      Father: ['Father only'],
      Mother: ['Mother only'],
      "Father's Brother": ["Father's Brother only"],
      "Father's Sister": ["Father's Sister only"],
      "Mother's Brother": ["Mother's Brother only"],
      "Mother's Sister": ["Mother's Sister only"],
      FBS: ["Father's Brother's Son only"],
      FBD: ["Father's Brother's Daughter only"],
      MBS: ["Mother's Brother's Son only"],
      MBD: ["Mother's Brother's Daughter only"],
    },
    societies: ['Sudan', 'Turkey', 'China (traditional)', 'Parts of Middle East'],
    diagram: [
      'FB ≠ MB ≠ F    FS ≠ MS ≠ M',
      'FBS ≠ FBD ≠ MBS ≠ MBD ≠ B ≠ S',
      '',
      'Every relationship has a unique term',
    ],
  },
  Omaha: {
    system: 'Omaha',
    description: "Merges relatives across generations on the mother's side (matrilateral skewing)",
    characteristics: [
      'Associated with patrilineal descent',
      "Mother's brother = Mother's brother's son",
      "Mother's brother's daughter = Mother",
      'Lineage membership overrides generation',
      'Emphasizes patrilineal group membership',
    ],
    merging_patterns: {
      Father: ['Father'],
      Mother: ['Mother', "Mother's Brother's Daughter"],
      "Mother's Brother": ["Mother's Brother", "Mother's Brother's Son"],
      "Father's Sister": ["Father's Sister"],
      "Father's Sister's Children": ["Father's Sister's Children - junior generation terms"],
    },
    societies: ['Omaha (Native American)', 'Many African patrilineal societies', 'Igbo'],
    diagram: [
      'Patrilineal group: standard generational terms',
      'Matrilateral relatives: lineage trumps generation',
      '',
      'MB = MBS (same term across generations)',
      "M = MBD (mother's term extends to niece)",
    ],
  },
  Crow: {
    system: 'Crow',
    description:
      "Mirror of Omaha - merges relatives across generations on father's side (patrilateral skewing)",
    characteristics: [
      'Associated with matrilineal descent',
      "Father's sister = Father's sister's daughter",
      "Father = Father's sister's son",
      'Lineage membership overrides generation',
      'Emphasizes matrilineal group membership',
    ],
    merging_patterns: {
      Father: ['Father', "Father's Sister's Son"],
      Mother: ['Mother'],
      "Father's Sister": ["Father's Sister", "Father's Sister's Daughter"],
      "Mother's Brother": ["Mother's Brother"],
      "Mother's Brother's Children": ["Mother's Brother's Children - junior generation terms"],
    },
    societies: ['Crow (Native American)', 'Hopi', 'Navajo', 'Many matrilineal societies'],
    diagram: [
      'Matrilineal group: standard generational terms',
      'Patrilateral relatives: lineage trumps generation',
      '',
      'FS = FSD (same term across generations)',
      "F = FSS (father's term extends to nephew)",
    ],
  },
  Iroquois: {
    system: 'Iroquois',
    description:
      'Distinguishes parallel from cross relatives, merging parallel relatives with lineal',
    characteristics: [
      'Bifurcate merging system',
      "Father and Father's Brother merged",
      "Mother and Mother's Sister merged",
      'Cross cousins distinguished from parallel cousins',
      'Parallel cousins called siblings',
      'Often allows cross-cousin marriage',
    ],
    merging_patterns: {
      Father: ['Father', "Father's Brother"],
      Mother: ['Mother', "Mother's Sister"],
      Uncle: ["Mother's Brother"],
      Aunt: ["Father's Sister"],
      'Brother/Sister': ['Siblings', 'Parallel Cousins'],
      'Cross Cousin': ["Mother's Brother's Children", "Father's Sister's Children"],
    },
    societies: [
      'Iroquois Confederacy',
      'Many Native American groups',
      'Dravidian societies in India',
    ],
    diagram: [
      'FB = F (father), MS = M (mother)',
      'FBC = B/S (siblings), MSC = B/S (siblings)',
      'MBC = Cross-cousin, FSC = Cross-cousin',
      '',
      'Parallel = same sex sibling of parent',
      'Cross = opposite sex sibling of parent',
    ],
  },
};

// Descent system information
const DESCENT_SYSTEMS: Record<
  DescentType,
  {
    description: string;
    inheritance: string;
    residence: string[];
    examples: string[];
    characteristics: string[];
  }
> = {
  patrilineal: {
    description: 'Descent traced through male line; group membership from father',
    inheritance: 'Property and titles pass from father to son',
    residence: ['Patrilocal', 'Virilocal'],
    examples: ['Traditional Chinese', 'Ancient Romans', 'Many Middle Eastern societies', 'Maasai'],
    characteristics: [
      "Father's family is primary reference group",
      'Surname typically from father',
      "Women join husband's lineage at marriage",
      'Male ancestors emphasized in genealogies',
    ],
  },
  matrilineal: {
    description: 'Descent traced through female line; group membership from mother',
    inheritance: "Property passes from mother's brother to sister's son",
    residence: ['Matrilocal', 'Uxorilocal', 'Avunculocal'],
    examples: ['Minangkabau', 'Khasi', 'Mosuo', 'Akan', 'Navajo'],
    characteristics: [
      "Mother's family is primary reference group",
      "Mother's brother often has authority over children",
      "Men may join wife's household",
      'Female ancestors emphasized',
    ],
  },
  bilateral: {
    description: 'Descent traced equally through both parents; no unilineal groups',
    inheritance: 'Property may go to children of either sex',
    residence: ['Neolocal', 'Ambilocal'],
    examples: ['Most Western societies', 'United States', 'Canada', 'Most of Europe'],
    characteristics: [
      'Kindred rather than lineage-based',
      'Both maternal and paternal relatives equally important',
      'Flexible residence patterns',
      'Individual-centered kinship network',
    ],
  },
  ambilineal: {
    description: 'Descent may be traced through either parent, but one must be chosen',
    inheritance: 'Depends on which lineage is selected',
    residence: ['Flexible based on affiliation'],
    examples: ['Samoa', 'Maori', 'Some Philippine groups'],
    characteristics: [
      'Individual chooses which lineage to affiliate with',
      'Choice may be based on land, resources, or status',
      'Can change affiliation under some circumstances',
      'Creates overlapping group memberships',
    ],
  },
  double: {
    description: 'Two parallel descent systems, one patrilineal and one matrilineal',
    inheritance: 'Different types of property follow different lines',
    residence: ['Variable'],
    examples: ['Herero', 'Yako', 'Ashanti (some aspects)'],
    characteristics: [
      'Belongs to two non-overlapping groups',
      'Movable property may be matrilineal',
      'Immovable property may be patrilineal',
      'Different rights from each line',
    ],
  },
};

// Marriage rules
const MARRIAGE_RULES: Record<
  string,
  {
    description: string;
    variations: string[];
    social_functions: string[];
    examples: string[];
  }
> = {
  exogamy: {
    description: "Marriage outside one's own social group (clan, lineage, village)",
    variations: ['Clan exogamy', 'Village exogamy', 'Lineage exogamy', 'Caste exogamy'],
    social_functions: ['Creates alliances', 'Prevents inbreeding', 'Extends social networks'],
    examples: ['Most societies practice some form', 'Native American clan systems'],
  },
  endogamy: {
    description: "Marriage within one's own social group",
    variations: ['Caste endogamy', 'Religious endogamy', 'Class endogamy', 'Ethnic endogamy'],
    social_functions: [
      'Maintains group boundaries',
      'Preserves wealth/status',
      'Cultural continuity',
    ],
    examples: ['Indian caste system', 'Royal marriages', 'Some religious communities'],
  },
  cross_cousin_marriage: {
    description: "Marriage with mother's brother's child or father's sister's child",
    variations: ['Matrilateral (MBD)', 'Patrilateral (FZD)', 'Bilateral (either)'],
    social_functions: ['Reinforces alliances', 'Keeps property in family', 'Asymmetric exchange'],
    examples: ['Dravidian kinship', 'Australian Aboriginal', 'Some African societies'],
  },
  parallel_cousin_marriage: {
    description: "Marriage with father's brother's child or mother's sister's child",
    variations: ['FBD marriage (patrilateral parallel)', 'MZD marriage (matrilateral parallel)'],
    social_functions: ['Keeps property in lineage', 'Strengthens lineage solidarity'],
    examples: ['Middle Eastern societies (FBD)', 'Some Arab groups'],
  },
  levirate: {
    description: "Widow marries deceased husband's brother",
    variations: ['Ghost marriage', 'Junior levirate', 'Senior levirate'],
    social_functions: ['Provides for widow', 'Continues lineage', 'Maintains alliances'],
    examples: ['Ancient Hebrews', 'Many African societies', 'Traditional India'],
  },
  sororate: {
    description: "Widower marries deceased wife's sister",
    variations: ['Junior sororate', 'Senior sororate'],
    social_functions: ["Maintains alliance with wife's family", 'Provides mother for children'],
    examples: ['Many Native American groups', 'Parts of Africa', 'Traditional China'],
  },
};

export const kinshipsystemTool: UnifiedTool = {
  name: 'kinship_system',
  description:
    'Anthropological kinship analysis - descent systems, marriage rules, terminology systems, relationship calculations',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'descent',
          'marriage',
          'terminology',
          'analyze',
          'relationship',
          'compare',
          'info',
          'examples',
        ],
        description: 'Operation type',
      },
      system: {
        type: 'string',
        enum: ['Eskimo', 'Hawaiian', 'Sudanese', 'Omaha', 'Crow', 'Iroquois'],
        description: 'Kinship terminology system',
      },
      descent_type: {
        type: 'string',
        enum: ['patrilineal', 'matrilineal', 'bilateral', 'ambilineal', 'double'],
        description: 'Descent system type',
      },
      marriage_rule: { type: 'string', description: 'Marriage rule to analyze' },
      ego_sex: {
        type: 'string',
        enum: ['male', 'female'],
        description: 'Sex of ego (reference person)',
      },
      relationship_path: {
        type: 'string',
        description: 'Relationship path (e.g., "MBS" for Mother\'s Brother\'s Son)',
      },
      systems_to_compare: { type: 'array', description: 'Systems to compare' },
    },
    required: ['operation'],
  },
};

export async function executekinshipsystem(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'descent':
        result = analyzeDescentSystem(args);
        break;

      case 'marriage':
        result = analyzeMarriageRules(args);
        break;

      case 'terminology':
        result = analyzeTerminology(args);
        break;

      case 'analyze':
        result = analyzeKinshipSystem(args);
        break;

      case 'relationship':
        result = calculateRelationship(args);
        break;

      case 'compare':
        result = compareSystems(args);
        break;

      case 'examples':
        result = getExamples();
        break;

      case 'info':
      default:
        result = getInfo();
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

function analyzeDescentSystem(args: Record<string, unknown>): Record<string, unknown> {
  const descentType = (args.descent_type as DescentType) || 'bilateral';

  const system = DESCENT_SYSTEMS[descentType];

  // Calculate implications
  const implications = {
    group_membership:
      descentType === 'bilateral'
        ? 'Kindred-based, ego-centered network'
        : `Lineage membership through ${descentType.replace('lineal', '')} line`,
    authority_patterns:
      descentType === 'matrilineal'
        ? "Mother's brother often has authority"
        : descentType === 'patrilineal'
          ? "Father/father's brothers have authority"
          : 'Variable based on situation',
    naming_conventions:
      descentType === 'patrilineal'
        ? 'Typically patrinymic'
        : descentType === 'matrilineal'
          ? 'May be matronymic'
          : 'Variable or bilateral surnames',
    economic_implications: system.inheritance,
  };

  return {
    operation: 'descent',
    descent_type: descentType,
    system_info: system,
    implications,
    common_terminology_systems: {
      patrilineal: ['Omaha', 'Sudanese'],
      matrilineal: ['Crow', 'Iroquois'],
      bilateral: ['Eskimo', 'Hawaiian'],
      ambilineal: ['Polynesian', 'Various'],
      double: ['Ashanti', 'Yako'],
    }[descentType] || ['Various'],
    diagram: generateDescentDiagram(descentType),
  };
}

function generateDescentDiagram(type: DescentType): string[] {
  switch (type) {
    case 'patrilineal':
      return [
        '    ▲ = Ancestor (traced through males)',
        '    │',
        '    ├── Son ──── Grandson',
        '    │              │',
        '    │              └── Great-grandson',
        '    │',
        '    └── Daughter (lineage ends or transfers)',
        '',
        'Solid line = lineage membership',
      ];
    case 'matrilineal':
      return [
        '    ▲ = Ancestor (traced through females)',
        '    │',
        '    ├── Daughter ──── Granddaughter',
        '    │                     │',
        '    │                     └── Great-granddaughter',
        '    │',
        '    └── Son (lineage continues through sisters)',
        '',
        'Solid line = lineage membership',
      ];
    case 'bilateral':
      return [
        "    Father's kin ═══ EGO ═══ Mother's kin",
        '         │              │',
        '    Equal relationship to both sides',
        '',
        'No discrete lineage groups',
      ];
    default:
      return ['Descent traced through multiple paths'];
  }
}

function analyzeMarriageRules(args: Record<string, unknown>): Record<string, unknown> {
  const marriageRule = (args.marriage_rule as string) || 'exogamy';

  const rule = MARRIAGE_RULES[marriageRule];

  if (!rule) {
    return {
      operation: 'marriage',
      available_rules: Object.keys(MARRIAGE_RULES),
      message: 'Specify a marriage_rule to analyze',
    };
  }

  return {
    operation: 'marriage',
    rule: marriageRule,
    ...rule,
    relationship_to_descent:
      {
        exogamy: 'Often correlates with unilineal descent - creates external alliances',
        endogamy: 'Common in societies with strong stratification or caste',
        cross_cousin_marriage:
          'Common in unilineal systems, especially with Iroquois/Dravidian terminology',
        parallel_cousin_marriage: 'Strengthens patrilineages, common in Middle East',
        levirate: 'Maintains alliance and supports widows in patrilineal systems',
        sororate: 'Maintains alliance in systems where marriage creates lasting bonds',
      }[marriageRule] || 'Variable relationship',
    exchange_theory: marriageRule.includes('cousin')
      ? {
          type: marriageRule.includes('cross')
            ? 'Generalized or Restricted Exchange'
            : 'Direct Exchange',
          description: marriageRule.includes('cross')
            ? 'Creates ongoing exchange relationships between groups'
            : 'Keeps exchanges within the lineage',
        }
      : null,
  };
}

function analyzeTerminology(args: Record<string, unknown>): Record<string, unknown> {
  const system = (args.system as KinshipSystem) || 'Eskimo';

  const terminology = KINSHIP_SYSTEMS[system];

  // Generate relationship terms
  const relationshipTerms = generateRelationshipTerms(system);

  return {
    operation: 'terminology',
    system,
    terminology_info: terminology,
    relationship_terms: relationshipTerms,
    classification_type: getClassificationType(system),
    associated_features: {
      typical_descent: {
        Eskimo: 'Bilateral',
        Hawaiian: 'Ambilineal or Bilateral',
        Sudanese: 'Any (most descriptive)',
        Omaha: 'Patrilineal',
        Crow: 'Matrilineal',
        Iroquois: 'Unilineal (either)',
      }[system],
      marriage_patterns: {
        Eskimo: 'Generally exogamous outside nuclear family',
        Hawaiian: 'Various, often with status considerations',
        Sudanese: 'Various, highly specific rules possible',
        Omaha: 'Typically exogamous by lineage',
        Crow: 'Typically exogamous by clan',
        Iroquois: 'Cross-cousin marriage often preferred',
      }[system],
    },
  };
}

function generateRelationshipTerms(system: KinshipSystem): Record<string, string> {
  const terms: Record<KinshipSystem, Record<string, string>> = {
    Eskimo: {
      F: 'Father',
      M: 'Mother',
      FB: 'Uncle',
      MB: 'Uncle',
      FZ: 'Aunt',
      MZ: 'Aunt',
      B: 'Brother',
      Z: 'Sister',
      FBC: 'Cousin',
      MBC: 'Cousin',
      FZC: 'Cousin',
      MZC: 'Cousin',
    },
    Hawaiian: {
      F: 'Father',
      M: 'Mother',
      FB: 'Father',
      MB: 'Father',
      FZ: 'Mother',
      MZ: 'Mother',
      B: 'Brother',
      Z: 'Sister',
      FBC: 'Brother/Sister',
      MBC: 'Brother/Sister',
      FZC: 'Brother/Sister',
      MZC: 'Brother/Sister',
    },
    Sudanese: {
      F: 'Father',
      M: 'Mother',
      FB: "Father's Brother",
      MB: "Mother's Brother",
      FZ: "Father's Sister",
      MZ: "Mother's Sister",
      B: 'Brother',
      Z: 'Sister',
      FBS: 'FBS',
      FBD: 'FBD',
      MBS: 'MBS',
      MBD: 'MBD',
      FZS: 'FZS',
      FZD: 'FZD',
      MZS: 'MZS',
      MZD: 'MZD',
    },
    Omaha: {
      F: 'Father',
      M: 'Mother',
      FB: 'Father',
      MB: "Mother's Brother",
      FZ: "Father's Sister",
      MZ: 'Mother',
      B: 'Brother',
      Z: 'Sister',
      FBC: 'Brother/Sister',
      MBC: "Mother's Brother/Mother",
      FZC: 'Child',
      MZC: 'Brother/Sister',
    },
    Crow: {
      F: 'Father',
      M: 'Mother',
      FB: 'Father',
      MB: "Mother's Brother",
      FZ: "Father's Sister",
      MZ: 'Mother',
      B: 'Brother',
      Z: 'Sister',
      FBC: 'Brother/Sister',
      MBC: 'Child',
      FZC: "Father/Father's Sister",
      MZC: 'Brother/Sister',
    },
    Iroquois: {
      F: 'Father',
      M: 'Mother',
      FB: 'Father',
      MB: 'Uncle',
      FZ: 'Aunt',
      MZ: 'Mother',
      B: 'Brother',
      Z: 'Sister',
      FBC: 'Brother/Sister',
      MBC: 'Cross-Cousin',
      FZC: 'Cross-Cousin',
      MZC: 'Brother/Sister',
    },
  };

  return terms[system] || terms['Eskimo'];
}

function getClassificationType(system: KinshipSystem): Record<string, unknown> {
  const types: Record<
    KinshipSystem,
    { type: string; merging_level: string; bifurcation: boolean }
  > = {
    Eskimo: { type: 'Lineal', merging_level: 'Low', bifurcation: false },
    Hawaiian: { type: 'Generational', merging_level: 'High', bifurcation: false },
    Sudanese: { type: 'Descriptive', merging_level: 'None', bifurcation: true },
    Omaha: { type: 'Bifurcate Merging with Skewing', merging_level: 'Medium', bifurcation: true },
    Crow: { type: 'Bifurcate Merging with Skewing', merging_level: 'Medium', bifurcation: true },
    Iroquois: { type: 'Bifurcate Merging', merging_level: 'Medium', bifurcation: true },
  };

  return types[system];
}

function analyzeKinshipSystem(args: Record<string, unknown>): Record<string, unknown> {
  const system = (args.system as KinshipSystem) || 'Eskimo';

  const terminology = KINSHIP_SYSTEMS[system];

  return {
    operation: 'analyze',
    system,
    comprehensive_analysis: {
      terminology: terminology,
      classification: getClassificationType(system),
      relationship_terms: generateRelationshipTerms(system),
      typical_features: {
        descent: {
          Eskimo: 'bilateral',
          Hawaiian: 'ambilineal',
          Sudanese: 'varies (often patrilineal)',
          Omaha: 'patrilineal',
          Crow: 'matrilineal',
          Iroquois: 'unilineal',
        }[system],
        residence: {
          Eskimo: 'neolocal',
          Hawaiian: 'ambilocal',
          Sudanese: 'varies',
          Omaha: 'patrilocal',
          Crow: 'matrilocal',
          Iroquois: 'varies',
        }[system],
        marriage_preference: {
          Eskimo: 'no specific cousin preference',
          Hawaiian: 'varies by status',
          Sudanese: 'varies',
          Omaha: 'exogamous',
          Crow: 'exogamous',
          Iroquois: 'cross-cousin marriage often preferred',
        }[system],
      },
    },
    structural_principles: analyzeStructuralPrinciples(system),
    social_implications: analyzeSocialImplications(system),
  };
}

function analyzeStructuralPrinciples(system: KinshipSystem): Record<string, unknown> {
  return {
    generation_principle:
      system === 'Hawaiian'
        ? 'Primary (all relatives of same generation merged)'
        : system === 'Sudanese'
          ? 'Important but with many distinctions'
          : 'Important, modified by other principles',
    sex_principle: 'Present in all systems',
    bifurcation_principle: ['Omaha', 'Crow', 'Iroquois', 'Sudanese'].includes(system)
      ? "Present - distinguishes father's side from mother's side"
      : 'Not significant',
    collaterality_principle:
      system === 'Eskimo'
        ? 'Primary - distinguishes lineal from collateral'
        : system === 'Sudanese'
          ? 'Fully distinguished'
          : 'Modified by merging',
    relative_age: 'May be present in some societies using this system',
    lineage_skewing:
      system === 'Omaha'
        ? "Matrilateral skewing (across mother's line)"
        : system === 'Crow'
          ? "Patrilateral skewing (across father's line)"
          : 'Not present',
  };
}

function analyzeSocialImplications(system: KinshipSystem): Record<string, unknown> {
  return {
    inheritance_patterns: {
      Eskimo: 'Often bilateral inheritance',
      Hawaiian: 'Based on generation/status',
      Sudanese: 'Complex, may depend on many factors',
      Omaha: 'Typically patrilineal inheritance',
      Crow: 'Typically matrilineal inheritance',
      Iroquois: 'Follows lineage rules',
    }[system],
    authority_structure: {
      Eskimo: 'Nuclear family-centered',
      Hawaiian: 'Generation-based',
      Sudanese: 'Highly specific to relationship',
      Omaha: 'Patrilineal elders',
      Crow: "Matrilineal elders, often mother's brother",
      Iroquois: 'Lineage-based',
    }[system],
    alliance_formation: {
      Eskimo: 'Individual-based networking',
      Hawaiian: 'Status-based alliances',
      Sudanese: 'Complex alliance networks',
      Omaha: 'Lineage-based, wife-givers vs wife-takers',
      Crow: 'Clan-based alliances',
      Iroquois: 'Cross-cousin marriage creates ongoing alliances',
    }[system],
  };
}

function calculateRelationship(args: Record<string, unknown>): Record<string, unknown> {
  const path = (args.relationship_path as string) || 'MBS';
  const system = (args.system as KinshipSystem) || 'Eskimo';
  const egoSex = (args.ego_sex as string) || 'male';

  // Parse relationship path
  const parsed = parseRelationshipPath(path);

  // Get term in specified system
  const terms = generateRelationshipTerms(system);
  const term = terms[path] || 'Specific term varies';

  return {
    operation: 'relationship',
    path,
    parsed_path: parsed,
    system,
    ego_sex: egoSex,
    kinship_term: term,
    relationship_properties: {
      generation: parsed.generation,
      lineage: parsed.lineage,
      consanguinity: 'consanguineal',
      marriage_eligibility: getMarriageEligibility(path, system),
    },
    path_in_other_systems: Object.fromEntries(
      Object.keys(KINSHIP_SYSTEMS).map((s) => [
        s,
        generateRelationshipTerms(s as KinshipSystem)[path] || 'varies',
      ])
    ),
  };
}

function parseRelationshipPath(path: string): {
  steps: string[];
  generation: number;
  lineage: string;
} {
  const steps: string[] = [];
  const chars = path.split('');
  let generation = 0;
  let lineage = 'ego';

  for (const char of chars) {
    switch (char) {
      case 'F':
        steps.push('Father');
        generation++;
        lineage = 'paternal';
        break;
      case 'M':
        steps.push('Mother');
        generation++;
        lineage = lineage === 'paternal' ? 'paternal' : 'maternal';
        break;
      case 'B':
        steps.push('Brother');
        break;
      case 'Z':
        steps.push('Sister');
        break;
      case 'S':
        steps.push('Son');
        generation--;
        break;
      case 'D':
        steps.push('Daughter');
        generation--;
        break;
      case 'H':
        steps.push('Husband');
        break;
      case 'W':
        steps.push('Wife');
        break;
    }
  }

  return { steps, generation, lineage };
}

function getMarriageEligibility(path: string, system: KinshipSystem): string {
  // Cross-cousins (MBC, FZC)
  if (path === 'MBS' || path === 'MBD' || path === 'FZS' || path === 'FZD') {
    if (system === 'Iroquois') return 'Often preferred marriage partner';
    return 'Usually permitted, may be preferred in some societies';
  }

  // Parallel cousins (FBC, MZC)
  if (path === 'FBS' || path === 'FBD' || path === 'MZS' || path === 'MZD') {
    return 'Often prohibited (treated as siblings in many systems)';
  }

  // Direct relatives
  if (path.length <= 2 && !path.includes('C')) {
    return 'Prohibited in most societies';
  }

  return 'Depends on specific cultural rules';
}

function compareSystems(args: Record<string, unknown>): Record<string, unknown> {
  const systemsToCompare = (args.systems_to_compare as string[]) || ['Eskimo', 'Iroquois', 'Omaha'];

  const comparison: Record<string, Record<string, string>> = {};
  const relationships = ['FB', 'MB', 'FZ', 'MZ', 'FBC', 'MBC', 'FZC', 'MZC'];

  for (const rel of relationships) {
    comparison[rel] = {};
    for (const sys of systemsToCompare) {
      const terms = generateRelationshipTerms(sys as KinshipSystem);
      comparison[rel][sys] = terms[rel] || 'varies';
    }
  }

  return {
    operation: 'compare',
    systems: systemsToCompare,
    term_comparison: comparison,
    structural_comparison: systemsToCompare.map((sys) => ({
      system: sys,
      classification: getClassificationType(sys as KinshipSystem),
      typical_descent: {
        Eskimo: 'bilateral',
        Hawaiian: 'ambilineal',
        Sudanese: 'varies',
        Omaha: 'patrilineal',
        Crow: 'matrilineal',
        Iroquois: 'unilineal',
      }[sys],
    })),
    key_differences: generateKeyDifferences(systemsToCompare as KinshipSystem[]),
  };
}

function generateKeyDifferences(systems: KinshipSystem[]): string[] {
  const differences: string[] = [];

  if (systems.includes('Eskimo') && systems.includes('Hawaiian')) {
    differences.push(
      'Eskimo distinguishes lineal/collateral; Hawaiian merges all same-generation relatives'
    );
  }

  if (systems.includes('Omaha') && systems.includes('Crow')) {
    differences.push('Omaha skews matrilateral relatives; Crow skews patrilateral relatives');
  }

  if (systems.includes('Iroquois')) {
    differences.push('Iroquois distinguishes parallel from cross cousins; parallel = siblings');
  }

  if (systems.includes('Sudanese')) {
    differences.push('Sudanese has unique term for every relationship type');
  }

  return differences;
}

function getExamples(): Record<string, unknown> {
  return {
    operation: 'examples',
    examples: [
      {
        name: 'Analyze Iroquois terminology',
        call: { operation: 'terminology', system: 'Iroquois' },
      },
      {
        name: 'Analyze patrilineal descent',
        call: { operation: 'descent', descent_type: 'patrilineal' },
      },
      {
        name: 'Analyze cross-cousin marriage',
        call: { operation: 'marriage', marriage_rule: 'cross_cousin_marriage' },
      },
      {
        name: 'Calculate relationship term',
        call: { operation: 'relationship', relationship_path: 'MBS', system: 'Iroquois' },
      },
      {
        name: 'Compare kinship systems',
        call: { operation: 'compare', systems_to_compare: ['Eskimo', 'Crow', 'Omaha'] },
      },
      {
        name: 'Full system analysis',
        call: { operation: 'analyze', system: 'Crow' },
      },
    ],
  };
}

function getInfo(): Record<string, unknown> {
  return {
    operation: 'info',
    tool: 'kinship_system',
    description:
      'Anthropological analysis of kinship systems, descent rules, and marriage patterns',
    capabilities: [
      'Kinship terminology analysis (6 systems)',
      'Descent system analysis (5 types)',
      'Marriage rule analysis',
      'Relationship path calculation',
      'Cross-system comparison',
      'Structural principle analysis',
    ],
    terminology_systems: Object.keys(KINSHIP_SYSTEMS),
    descent_types: Object.keys(DESCENT_SYSTEMS),
    marriage_rules: Object.keys(MARRIAGE_RULES),
    relationship_notation: {
      F: 'Father',
      M: 'Mother',
      B: 'Brother',
      Z: 'Sister',
      S: 'Son',
      D: 'Daughter',
      H: 'Husband',
      W: 'Wife',
      C: 'Child (generic)',
      P: 'Parent (generic)',
    },
    key_concepts: [
      'Consanguineal (blood) vs Affinal (marriage) relations',
      'Lineal (direct ancestors/descendants) vs Collateral (siblings, cousins)',
      'Parallel (same-sex sibling of parent) vs Cross (opposite-sex sibling of parent)',
      "Bifurcation (distinguishing mother's vs father's side)",
      'Generational skewing (merging across generations)',
    ],
    references: [
      'Kinship and Marriage by Robin Fox',
      'Elementary Structures of Kinship by Lévi-Strauss',
      "Morgan's Systems of Consanguinity and Affinity",
      "Murdock's Social Structure",
    ],
  };
}

export function iskinshipsystemAvailable(): boolean {
  return true;
}
