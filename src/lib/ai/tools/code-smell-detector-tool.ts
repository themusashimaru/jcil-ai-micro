/**
 * CODE SMELL DETECTOR TOOL
 * Detect code smells and anti-patterns
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

const CODE_SMELLS = {
  bloaters: {
    longMethod: {
      name: 'Long Method',
      description: 'Method too long (>20 lines)',
      threshold: 20,
      refactoring: ['Extract Method', 'Replace Temp with Query', 'Introduce Parameter Object'],
      severity: 'medium'
    },
    longClass: {
      name: 'Large Class',
      description: 'Class doing too much (>300 lines)',
      threshold: 300,
      refactoring: ['Extract Class', 'Extract Subclass', 'Extract Interface'],
      severity: 'high'
    },
    longParameterList: {
      name: 'Long Parameter List',
      description: 'Too many parameters (>4)',
      threshold: 4,
      refactoring: ['Introduce Parameter Object', 'Preserve Whole Object', 'Replace Parameter with Method Call'],
      severity: 'medium'
    },
    primitiveObsession: {
      name: 'Primitive Obsession',
      description: 'Overuse of primitives instead of small objects',
      signs: ['Multiple related primitives passed together', 'Type codes', 'String constants'],
      refactoring: ['Replace Data Value with Object', 'Replace Type Code with Class', 'Introduce Parameter Object'],
      severity: 'low'
    },
    dataClumps: {
      name: 'Data Clumps',
      description: 'Groups of data that appear together repeatedly',
      signs: ['Same 3+ parameters in multiple methods', 'Fields always used together'],
      refactoring: ['Extract Class', 'Introduce Parameter Object', 'Preserve Whole Object'],
      severity: 'medium'
    }
  },
  objectOrientationAbusers: {
    switchStatements: {
      name: 'Switch Statements',
      description: 'Complex switch/if-else chains on type codes',
      signs: ['Switch on type field', 'Same switch in multiple places'],
      refactoring: ['Replace Conditional with Polymorphism', 'Replace Type Code with Subclasses'],
      severity: 'medium'
    },
    temporaryField: {
      name: 'Temporary Field',
      description: 'Fields only set in certain circumstances',
      signs: ['Field null most of the time', 'Field only used by one method'],
      refactoring: ['Extract Class', 'Replace Method with Method Object', 'Introduce Null Object'],
      severity: 'low'
    },
    refusedBequest: {
      name: 'Refused Bequest',
      description: 'Subclass uses only some of parent\'s behavior',
      signs: ['Empty overrides', 'Throwing NotImplemented', 'Unused inherited methods'],
      refactoring: ['Replace Inheritance with Delegation', 'Extract Subclass'],
      severity: 'medium'
    },
    alternativeClassesDifferentInterfaces: {
      name: 'Alternative Classes with Different Interfaces',
      description: 'Similar classes with different method names',
      signs: ['Classes doing same thing differently', 'Should be interchangeable but aren\'t'],
      refactoring: ['Rename Method', 'Extract Superclass', 'Extract Interface'],
      severity: 'low'
    }
  },
  changePreventers: {
    divergentChange: {
      name: 'Divergent Change',
      description: 'One class changed for multiple unrelated reasons',
      signs: ['Class modified for database AND UI changes', 'Many reasons to modify'],
      refactoring: ['Extract Class', 'Split responsibilities'],
      severity: 'high'
    },
    shotgunSurgery: {
      name: 'Shotgun Surgery',
      description: 'Single change requires many small changes elsewhere',
      signs: ['Adding field requires changes in 5+ places', 'Feature change touches many classes'],
      refactoring: ['Move Method', 'Move Field', 'Inline Class'],
      severity: 'high'
    },
    parallelInheritanceHierarchies: {
      name: 'Parallel Inheritance Hierarchies',
      description: 'Creating subclass in one hierarchy requires another',
      signs: ['Similar prefixes in different hierarchies', 'Always create pairs of classes'],
      refactoring: ['Move Method', 'Move Field to eliminate one hierarchy'],
      severity: 'medium'
    }
  },
  dispensables: {
    deadCode: {
      name: 'Dead Code',
      description: 'Code that is never executed',
      signs: ['Unreachable code', 'Unused variables', 'Unused imports'],
      refactoring: ['Delete'],
      severity: 'low'
    },
    speculativeGenerality: {
      name: 'Speculative Generality',
      description: 'Unused abstraction created "just in case"',
      signs: ['Abstract class with one subclass', 'Unused parameters', 'Methods only called by tests'],
      refactoring: ['Collapse Hierarchy', 'Inline Class', 'Remove Parameter'],
      severity: 'low'
    },
    lazyClass: {
      name: 'Lazy Class',
      description: 'Class that does too little',
      signs: ['Very few methods', 'Barely any behavior', 'Just holds data'],
      refactoring: ['Inline Class', 'Collapse Hierarchy'],
      severity: 'low'
    },
    duplicatedCode: {
      name: 'Duplicated Code',
      description: 'Same code structure in multiple places',
      signs: ['Copy-pasted code', 'Similar algorithms', 'Parallel conditionals'],
      refactoring: ['Extract Method', 'Extract Class', 'Pull Up Method', 'Form Template Method'],
      severity: 'high'
    },
    comments: {
      name: 'Excessive Comments',
      description: 'Comments compensating for bad code',
      signs: ['Comment explains what code does', 'Commented-out code', 'TODO that never gets done'],
      refactoring: ['Extract Method', 'Rename Method', 'Introduce Assertion'],
      severity: 'low'
    }
  },
  couplers: {
    featureEnvy: {
      name: 'Feature Envy',
      description: 'Method uses other class\'s data more than its own',
      signs: ['Many getters from other class', 'Operating on other class\'s fields'],
      refactoring: ['Move Method', 'Extract Method then Move'],
      severity: 'medium'
    },
    inappropriateIntimacy: {
      name: 'Inappropriate Intimacy',
      description: 'Classes know too much about each other',
      signs: ['Accessing private fields', 'Circular dependencies', 'Deep knowledge of internals'],
      refactoring: ['Move Method', 'Move Field', 'Extract Class', 'Hide Delegate'],
      severity: 'high'
    },
    messageChains: {
      name: 'Message Chains',
      description: 'Long chain of method calls',
      signs: ['a.b().c().d().e()', 'Navigation through object graph'],
      refactoring: ['Hide Delegate', 'Extract Method', 'Move Method'],
      severity: 'medium'
    },
    middleMan: {
      name: 'Middle Man',
      description: 'Class delegates most work to another',
      signs: ['Most methods just delegate', 'Class adds no value'],
      refactoring: ['Remove Middle Man', 'Inline Method', 'Replace Delegation with Inheritance'],
      severity: 'low'
    }
  }
};

function detectSmells(code: string): Record<string, unknown> {
  const lines = code.split('\n');
  const detected: Array<{ smell: string; location?: string; severity: string; suggestion: string }> = [];

  // Long method detection
  const methodPattern = /(?:function\s+\w+|(?:async\s+)?(?:\w+)\s*(?:=\s*)?(?:async\s*)?\([^)]*\)\s*(?:=>|{))/g;
  let methodStart = -1;
  let braceCount = 0;

  lines.forEach((line, i) => {
    if (methodPattern.test(line)) {
      methodStart = i;
      braceCount = 0;
    }
    braceCount += (line.match(/{/g) || []).length;
    braceCount -= (line.match(/}/g) || []).length;

    if (methodStart >= 0 && braceCount === 0 && i > methodStart) {
      const methodLength = i - methodStart;
      if (methodLength > 20) {
        detected.push({
          smell: 'Long Method',
          location: `Lines ${methodStart + 1}-${i + 1}`,
          severity: 'medium',
          suggestion: 'Extract smaller methods'
        });
      }
      methodStart = -1;
    }
  });

  // Long parameter list
  const paramPattern = /\(([^)]+)\)/g;
  let match;
  while ((match = paramPattern.exec(code)) !== null) {
    const params = match[1].split(',').filter(p => p.trim());
    if (params.length > 4) {
      detected.push({
        smell: 'Long Parameter List',
        location: `${params.length} parameters`,
        severity: 'medium',
        suggestion: 'Introduce Parameter Object'
      });
    }
  }

  // Dead code (commented blocks)
  const commentedCodePattern = /\/\/\s*(if|for|while|function|const|let|var|return)/g;
  if (commentedCodePattern.test(code)) {
    detected.push({
      smell: 'Dead Code',
      severity: 'low',
      suggestion: 'Remove commented-out code'
    });
  }

  // Message chains
  const chainPattern = /\w+(?:\.\w+\([^)]*\)){3,}/g;
  if (chainPattern.test(code)) {
    detected.push({
      smell: 'Message Chains',
      severity: 'medium',
      suggestion: 'Use Hide Delegate pattern'
    });
  }

  // Duplicated magic numbers
  const numbers = code.match(/(?<!\w)\d{2,}(?!\w)/g) || [];
  const numberCounts: Record<string, number> = {};
  numbers.forEach(n => { numberCounts[n] = (numberCounts[n] || 0) + 1; });
  Object.entries(numberCounts).forEach(([num, count]) => {
    if (count > 2 && num !== '100') {
      detected.push({
        smell: 'Magic Number',
        location: `"${num}" appears ${count} times`,
        severity: 'low',
        suggestion: 'Extract to named constant'
      });
    }
  });

  // Nested conditionals
  const deepNesting = /if\s*\([^)]+\)\s*{[^}]*if\s*\([^)]+\)\s*{[^}]*if/g;
  if (deepNesting.test(code)) {
    detected.push({
      smell: 'Deep Nesting',
      severity: 'medium',
      suggestion: 'Use guard clauses or extract methods'
    });
  }

  return {
    smellsDetected: detected.length,
    smells: detected,
    summary: {
      high: detected.filter(s => s.severity === 'high').length,
      medium: detected.filter(s => s.severity === 'medium').length,
      low: detected.filter(s => s.severity === 'low').length
    },
    overallHealth: detected.length === 0 ? 'Clean' :
                   detected.filter(s => s.severity === 'high').length > 0 ? 'Needs Attention' :
                   detected.filter(s => s.severity === 'medium').length > 2 ? 'Fair' : 'Good'
  };
}

function getSmellCatalog(category?: string): Record<string, unknown> {
  if (category && category in CODE_SMELLS) {
    return {
      category,
      smells: CODE_SMELLS[category as keyof typeof CODE_SMELLS]
    };
  }
  return { catalog: CODE_SMELLS };
}

function suggestRefactoring(smell: string): Record<string, unknown> {
  const allSmells = Object.values(CODE_SMELLS).flatMap(cat => Object.values(cat));
  const found = allSmells.find(s =>
    s.name.toLowerCase().includes(smell.toLowerCase())
  );

  if (!found) {
    return { error: `Smell "${smell}" not found`, availableSmells: allSmells.map(s => s.name) };
  }

  return {
    smell: found.name,
    description: found.description,
    severity: found.severity,
    refactoringTechniques: found.refactoring,
    detailedSteps: found.refactoring.map(r => ({
      technique: r,
      steps: getRefactoringSteps(r)
    }))
  };
}

function getRefactoringSteps(technique: string): string[] {
  const steps: Record<string, string[]> = {
    'Extract Method': [
      '1. Create new method with descriptive name',
      '2. Copy extracted code to new method',
      '3. Replace original code with method call',
      '4. Pass required local variables as parameters',
      '5. Return values as needed'
    ],
    'Extract Class': [
      '1. Identify fields and methods that go together',
      '2. Create new class with appropriate name',
      '3. Move fields to new class',
      '4. Move methods to new class',
      '5. Establish relationship between classes'
    ],
    'Move Method': [
      '1. Examine all features used by the method',
      '2. Check sub/superclasses for other declarations',
      '3. Declare method in target class',
      '4. Copy code, adjusting for new context',
      '5. Turn original method into delegation or remove'
    ],
    'Replace Conditional with Polymorphism': [
      '1. Create subclass for each condition branch',
      '2. Create abstract method in parent',
      '3. Implement method differently in each subclass',
      '4. Replace conditional with polymorphic call'
    ],
    'Introduce Parameter Object': [
      '1. Create new class for parameters',
      '2. Add constructor accepting the parameters',
      '3. Add parameter of new class type to method',
      '4. Replace individual parameters with object fields',
      '5. Remove old parameters'
    ]
  };

  return steps[technique] || [
    '1. Identify the code to refactor',
    '2. Ensure tests cover the functionality',
    '3. Apply the refactoring in small steps',
    '4. Run tests after each step',
    '5. Clean up and verify'
  ];
}

function analyzeMetrics(code: string): Record<string, unknown> {
  const lines = code.split('\n');
  const nonEmptyLines = lines.filter(l => l.trim().length > 0);
  const commentLines = lines.filter(l => l.trim().startsWith('//') || l.trim().startsWith('/*'));

  const classCount = (code.match(/class\s+\w+/g) || []).length;
  const methodCount = (code.match(/(?:function\s+\w+|\w+\s*\([^)]*\)\s*{)/g) || []).length;
  const importCount = (code.match(/import\s+/g) || []).length;
  const exportCount = (code.match(/export\s+/g) || []).length;

  return {
    lines: {
      total: lines.length,
      code: nonEmptyLines.length - commentLines.length,
      comments: commentLines.length,
      blank: lines.length - nonEmptyLines.length
    },
    structure: {
      classes: classCount,
      methods: methodCount,
      imports: importCount,
      exports: exportCount
    },
    ratios: {
      commentRatio: `${Math.round((commentLines.length / nonEmptyLines.length) * 100)}%`,
      codePerClass: classCount > 0 ? Math.round(nonEmptyLines.length / classCount) : 'N/A',
      methodsPerClass: classCount > 0 ? Math.round(methodCount / classCount) : 'N/A'
    },
    recommendations: generateRecommendations(lines.length, classCount, methodCount, commentLines.length)
  };
}

function generateRecommendations(
  totalLines: number,
  classes: number,
  methods: number,
  comments: number
): string[] {
  const recommendations: string[] = [];

  if (totalLines > 500 && classes <= 1) {
    recommendations.push('Consider splitting into multiple files/classes');
  }
  if (methods > 20 && classes <= 1) {
    recommendations.push('Too many methods in one file, consider grouping into classes');
  }
  if (comments < totalLines * 0.05) {
    recommendations.push('Add more documentation comments');
  }
  if (comments > totalLines * 0.3) {
    recommendations.push('High comment ratio - ensure code is self-documenting');
  }

  if (recommendations.length === 0) {
    recommendations.push('Code structure looks reasonable');
  }

  return recommendations;
}

export const codeSmellDetectorTool: UnifiedTool = {
  name: 'code_smell_detector',
  description: 'Code Smell Detector: detect, catalog, refactoring, metrics',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['detect', 'catalog', 'refactoring', 'metrics'] },
      code: { type: 'string' },
      category: { type: 'string' },
      smell: { type: 'string' }
    },
    required: ['operation']
  },
};

export async function executeCodeSmellDetector(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'detect':
        result = detectSmells(args.code || `function example(a, b, c, d, e, f) {
  if (a > 0) {
    if (b > 0) {
      if (c > 0) {
        return a + b + c;
      }
    }
  }
  // const old = true;
  return 0;
}`);
        break;
      case 'catalog':
        result = getSmellCatalog(args.category);
        break;
      case 'refactoring':
        result = suggestRefactoring(args.smell || 'Long Method');
        break;
      case 'metrics':
        result = analyzeMetrics(args.code || 'class Example {\n  method() {}\n}');
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isCodeSmellDetectorAvailable(): boolean { return true; }
