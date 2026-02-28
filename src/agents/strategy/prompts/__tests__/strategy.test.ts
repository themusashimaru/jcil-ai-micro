// @ts-nocheck - Test file with extensive mocking
/** @vitest-environment node */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { STRATEGY_PROMPTS } from '../strategy';
import type { PromptSet } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROMPT_KEYS: (keyof PromptSet)[] = [
  'name',
  'intake',
  'intakeOpening',
  'architect',
  'qualityControl',
  'projectManager',
  'scout',
  'synthesizer',
  'synthesis',
];

// ---------------------------------------------------------------------------
// 1. STRATEGY_PROMPTS — basic export shape
// ---------------------------------------------------------------------------

describe('STRATEGY_PROMPTS export', () => {
  it('should be a non-null object', () => {
    expect(STRATEGY_PROMPTS).toBeDefined();
    expect(typeof STRATEGY_PROMPTS).toBe('object');
    expect(STRATEGY_PROMPTS).not.toBeNull();
  });

  it('should have exactly the PromptSet keys', () => {
    const keys = Object.keys(STRATEGY_PROMPTS).sort();
    const expected = [...PROMPT_KEYS].sort();
    expect(keys).toEqual(expected);
  });

  it('should have all values as strings', () => {
    for (const key of PROMPT_KEYS) {
      expect(typeof STRATEGY_PROMPTS[key]).toBe('string');
    }
  });

  it('should have no undefined or null values', () => {
    for (const key of PROMPT_KEYS) {
      expect(STRATEGY_PROMPTS[key]).not.toBeUndefined();
      expect(STRATEGY_PROMPTS[key]).not.toBeNull();
    }
  });

  it('should have no empty-string values', () => {
    for (const key of PROMPT_KEYS) {
      expect((STRATEGY_PROMPTS[key] as string).length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. name field
// ---------------------------------------------------------------------------

describe('STRATEGY_PROMPTS.name', () => {
  it('should be "Deep Strategy"', () => {
    expect(STRATEGY_PROMPTS.name).toBe('Deep Strategy');
  });

  it('should contain "Strategy"', () => {
    expect(STRATEGY_PROMPTS.name).toContain('Strategy');
  });

  it('should not be excessively long', () => {
    expect(STRATEGY_PROMPTS.name.length).toBeLessThan(100);
  });
});

// ---------------------------------------------------------------------------
// 3. intake prompt — forensic intake
// ---------------------------------------------------------------------------

describe('STRATEGY_PROMPTS.intake', () => {
  const intake = STRATEGY_PROMPTS.intake;

  it('should be a substantial prompt (>500 chars)', () => {
    expect(intake.length).toBeGreaterThan(500);
  });

  it('should mention ethical boundaries', () => {
    expect(intake).toContain('ETHICAL BOUNDARIES');
  });

  it('should list prohibited activities — trafficking', () => {
    expect(intake.toLowerCase()).toContain('trafficking');
  });

  it('should list prohibited activities — violence', () => {
    expect(intake.toLowerCase()).toContain('violence');
  });

  it('should list prohibited activities — fraud', () => {
    expect(intake.toLowerCase()).toContain('fraud');
  });

  it('should list prohibited activities — child exploitation', () => {
    expect(intake.toLowerCase()).toContain('child exploitation');
  });

  it('should list prohibited activities — stalking', () => {
    expect(intake.toLowerCase()).toContain('stalking');
  });

  it('should list prohibited activities — money laundering', () => {
    expect(intake.toLowerCase()).toContain('money laundering');
  });

  it('should encourage full disclosure', () => {
    expect(intake).toContain('ENCOURAGE FULL DISCLOSURE');
  });

  it('should include active listening guidance', () => {
    expect(intake).toContain('ACTIVE LISTENING');
  });

  it('should include probing questions', () => {
    expect(intake).toContain('PROBE DEEPER');
  });

  it('should mention uncovering hidden constraints', () => {
    expect(intake).toContain('UNCOVER HIDDEN CONSTRAINTS');
  });

  it('should mention understanding priorities', () => {
    expect(intake).toContain('UNDERSTAND PRIORITIES');
  });

  it('should mention assessing risk tolerance', () => {
    expect(intake).toContain('ASSESS RISK TOLERANCE');
  });

  it('should mention synthesize and confirm', () => {
    expect(intake).toContain('SYNTHESIZE AND CONFIRM');
  });

  it('should include JSON output format with intakeComplete', () => {
    expect(intake).toContain('"intakeComplete"');
  });

  it('should include synthesis.summary in output format', () => {
    expect(intake).toContain('"summary"');
  });

  it('should include coreQuestion field in output format', () => {
    expect(intake).toContain('"coreQuestion"');
  });

  it('should include riskTolerance field in output format', () => {
    expect(intake).toContain('"riskTolerance"');
  });

  it('should include complexity field in output format', () => {
    expect(intake).toContain('"complexity"');
  });

  it('should include domains field in output format', () => {
    expect(intake).toContain('"domains"');
  });

  it('should state that this is the intake-only phase', () => {
    expect(intake).toContain('Your job is INTAKE only');
  });

  it('should mention 3-5 exchanges before completion', () => {
    expect(intake).toContain('3-5 exchanges');
  });

  it('should reference budget/financial constraints probing', () => {
    expect(intake.toLowerCase()).toContain('budget');
  });

  it('should reference timeline pressure probing', () => {
    expect(intake.toLowerCase()).toContain('timeline');
  });
});

// ---------------------------------------------------------------------------
// 4. intakeOpening prompt
// ---------------------------------------------------------------------------

describe('STRATEGY_PROMPTS.intakeOpening', () => {
  const opening = STRATEGY_PROMPTS.intakeOpening;

  it('should be a substantial prompt (>500 chars)', () => {
    expect(opening.length).toBeGreaterThan(500);
  });

  it('should mention Deep Strategy Mode', () => {
    expect(opening).toContain('Deep Strategy Mode');
  });

  it('should mention the brain hierarchy', () => {
    expect(opening).toContain('BRAIN HIERARCHY');
  });

  it('should mention Claude Opus 4.6 as Master Architect', () => {
    expect(opening).toContain('Claude Opus 4.6');
    expect(opening).toContain('Master Architect');
  });

  it('should mention Claude Sonnet 4.6 agents', () => {
    expect(opening).toContain('Claude Sonnet 4.6');
  });

  it('should mention up to 100 scouts', () => {
    expect(opening).toContain('100');
    expect(opening).toContain('Scout');
  });

  it('should list E2B Cloud Sandbox', () => {
    expect(opening).toContain('E2B Cloud Sandbox');
  });

  it('should list Brave Search tool', () => {
    expect(opening).toContain('Brave Search');
  });

  it('should list PDF Extraction tool', () => {
    expect(opening).toContain('PDF Extraction');
  });

  it('should mention the safety framework', () => {
    expect(opening).toContain('SAFETY FRAMEWORK');
  });

  it('should mention domain blocking', () => {
    expect(opening).toContain('Domain blocking');
  });

  it('should mention rate limiting', () => {
    expect(opening.toLowerCase()).toContain('rate limiting');
  });

  it('should give an estimated time of 2-5 minutes', () => {
    expect(opening).toContain('2-5 minutes');
  });

  it('should end with an open question to the user', () => {
    expect(opening).toContain("What's going on?");
  });
});

// ---------------------------------------------------------------------------
// 5. architect prompt — Master Architect
// ---------------------------------------------------------------------------

describe('STRATEGY_PROMPTS.architect', () => {
  const architect = STRATEGY_PROMPTS.architect;

  it('should be a substantial prompt (>2000 chars)', () => {
    expect(architect.length).toBeGreaterThan(2000);
  });

  it('should identify role as Master Architect', () => {
    expect(architect).toContain('Master Architect');
  });

  it('should include the {SYNTHESIZED_PROBLEM} placeholder', () => {
    expect(architect).toContain('{SYNTHESIZED_PROBLEM}');
  });

  it('should list RESEARCH AGENTS type', () => {
    expect(architect).toContain('RESEARCH AGENTS');
  });

  it('should list VALIDATION AGENTS type', () => {
    expect(architect).toContain('VALIDATION AGENTS');
  });

  it('should list ADVERSARIAL AGENTS type', () => {
    expect(architect).toContain('ADVERSARIAL AGENTS');
  });

  it("should list DEVIL'S ADVOCATE AGENTS type", () => {
    expect(architect).toContain("DEVIL'S ADVOCATE AGENTS");
  });

  it('should describe multi-phase research strategy', () => {
    expect(architect).toContain('MULTI-PHASE RESEARCH');
  });

  it('should describe adversarial validation strategy', () => {
    expect(architect).toContain('ADVERSARIAL VALIDATION');
  });

  it('should describe evidence triangulation strategy', () => {
    expect(architect).toContain('EVIDENCE TRIANGULATION');
  });

  it('should list brave_search tool', () => {
    expect(architect).toContain('brave_search');
  });

  it('should list browser_visit tool', () => {
    expect(architect).toContain('browser_visit');
  });

  it('should list vision_analyze tool', () => {
    expect(architect).toContain('vision_analyze');
  });

  it('should list extract_pdf tool', () => {
    expect(architect).toContain('extract_pdf');
  });

  it('should list run_code tool', () => {
    expect(architect).toContain('run_code');
  });

  it('should list create_custom_tool', () => {
    expect(architect).toContain('create_custom_tool');
  });

  it('should include safety restrictions about .gov sites', () => {
    expect(architect).toContain('.gov');
  });

  it('should include safety restrictions about .mil sites', () => {
    expect(architect).toContain('.mil');
  });

  it('should include JSON output format with strategy field', () => {
    expect(architect).toContain('"strategy"');
  });

  it('should include projectManagers in output format', () => {
    expect(architect).toContain('"projectManagers"');
  });

  it('should include scouts in output format', () => {
    expect(architect).toContain('"scouts"');
  });

  it('should include validationStrategy in output format', () => {
    expect(architect).toContain('"validationStrategy"');
  });

  it('should mention design principles', () => {
    expect(architect).toContain('DESIGN PRINCIPLES');
  });

  it('should mention QUALITY OVER QUANTITY principle', () => {
    expect(architect).toContain('QUALITY OVER QUANTITY');
  });

  it('should include examples — investment decision', () => {
    expect(architect).toContain('INVESTMENT DECISION');
  });

  it('should include examples — relocation decision', () => {
    expect(architect).toContain('RELOCATION DECISION');
  });

  it('should include examples — startup evaluation', () => {
    expect(architect).toContain('STARTUP EVALUATION');
  });

  it('should include agentType enum values in output format', () => {
    expect(architect).toContain(
      'research|validation|adversarial|analyst|comparison|synthesis|devil_advocate'
    );
  });

  it('should include researchApproach enum values', () => {
    expect(architect).toContain('deep_dive|broad_scan|comparative|validation|adversarial');
  });
});

// ---------------------------------------------------------------------------
// 6. qualityControl prompt
// ---------------------------------------------------------------------------

describe('STRATEGY_PROMPTS.qualityControl', () => {
  const qc = STRATEGY_PROMPTS.qualityControl;

  it('should be a substantial prompt (>500 chars)', () => {
    expect(qc.length).toBeGreaterThan(500);
  });

  it('should identify role as Quality Control Director', () => {
    expect(qc).toContain('Quality Control Director');
  });

  it('should include the {CURRENT_STATE} placeholder', () => {
    expect(qc).toContain('{CURRENT_STATE}');
  });

  it('should mention ABSOLUTE AUTHORITY', () => {
    expect(qc).toContain('ABSOLUTE AUTHORITY');
  });

  it('should mention KILL SWITCH', () => {
    expect(qc).toContain('KILL SWITCH');
  });

  it('should mention budget monitoring with $20 limit', () => {
    expect(qc).toContain('$20');
  });

  it('should mention time monitoring with 10 minute limit', () => {
    expect(qc).toContain('10 minute');
  });

  it('should mention budget thresholds — 50%, 75%, 90%', () => {
    expect(qc).toContain('50%');
    expect(qc).toContain('75%');
    expect(qc).toContain('90%');
  });

  it('should mention error rate monitoring at >15%', () => {
    expect(qc).toContain('15%');
  });

  it('should mention loop detection', () => {
    expect(qc).toContain('LOOP DETECTION');
  });

  it('should define quality gates 1-4', () => {
    expect(qc).toContain('GATE 1');
    expect(qc).toContain('GATE 2');
    expect(qc).toContain('GATE 3');
    expect(qc).toContain('GATE 4');
  });

  it('should include JSON output format with status field', () => {
    expect(qc).toContain('"status"');
  });

  it('should include status values — healthy|warning|critical', () => {
    expect(qc).toContain('healthy|warning|critical');
  });

  it('should include action values', () => {
    expect(qc).toContain('continue|pause|redirect|spawn_more|kill');
  });

  it('should include metrics.budgetUsed in output format', () => {
    expect(qc).toContain('"budgetUsed"');
  });

  it('should include overallQualityScore in output format', () => {
    expect(qc).toContain('"overallQualityScore"');
  });

  it('should define kill switch criteria', () => {
    expect(qc).toContain('KILL SWITCH CRITERIA');
  });

  it('should mention kill at Budget >95%', () => {
    expect(qc).toContain('95%');
  });

  it('should mention kill at error rate >30%', () => {
    expect(qc).toContain('30%');
  });
});

// ---------------------------------------------------------------------------
// 7. projectManager prompt
// ---------------------------------------------------------------------------

describe('STRATEGY_PROMPTS.projectManager', () => {
  const pm = STRATEGY_PROMPTS.projectManager;

  it('should be a substantial prompt (>500 chars)', () => {
    expect(pm.length).toBeGreaterThan(500);
  });

  it('should identify role as Project Manager', () => {
    expect(pm).toContain('Project Manager');
  });

  it('should include the {DOMAIN} placeholder', () => {
    expect(pm).toContain('{DOMAIN}');
  });

  it('should include the {SCOUT_LIST} placeholder', () => {
    expect(pm).toContain('{SCOUT_LIST}');
  });

  it('should include the {PROBLEM_SUMMARY} placeholder', () => {
    expect(pm).toContain('{PROBLEM_SUMMARY}');
  });

  it('should mention scout coordination responsibility', () => {
    expect(pm).toContain('SCOUT COORDINATION');
  });

  it('should mention findings synthesis responsibility', () => {
    expect(pm).toContain('FINDINGS SYNTHESIS');
  });

  it('should mention quality assurance responsibility', () => {
    expect(pm).toContain('QUALITY ASSURANCE');
  });

  it('should mention escalation responsibility', () => {
    expect(pm).toContain('ESCALATION');
  });

  it('should include JSON output format with domain field', () => {
    expect(pm).toContain('"domain"');
  });

  it('should include keyFindings in output format', () => {
    expect(pm).toContain('"keyFindings"');
  });

  it('should include comparisonTable in output format', () => {
    expect(pm).toContain('"comparisonTable"');
  });

  it('should include gaps in output format', () => {
    expect(pm).toContain('"gaps"');
  });

  it('should include crossDomainDependencies in output', () => {
    expect(pm).toContain('"crossDomainDependencies"');
  });
});

// ---------------------------------------------------------------------------
// 8. scout prompt
// ---------------------------------------------------------------------------

describe('STRATEGY_PROMPTS.scout', () => {
  const scout = STRATEGY_PROMPTS.scout;

  it('should be a substantial prompt (>1000 chars)', () => {
    expect(scout.length).toBeGreaterThan(1000);
  });

  it('should identify role as research scout', () => {
    expect(scout.toLowerCase()).toContain('research scout');
  });

  it('should include {AGENT_NAME} placeholder', () => {
    expect(scout).toContain('{AGENT_NAME}');
  });

  it('should include {AGENT_ROLE} placeholder', () => {
    expect(scout).toContain('{AGENT_ROLE}');
  });

  it('should include {EXPERTISE} placeholder', () => {
    expect(scout).toContain('{EXPERTISE}');
  });

  it('should include {PURPOSE} placeholder', () => {
    expect(scout).toContain('{PURPOSE}');
  });

  it('should include {KEY_QUESTIONS} placeholder', () => {
    expect(scout).toContain('{KEY_QUESTIONS}');
  });

  it('should include {SEARCH_QUERIES} placeholder', () => {
    expect(scout).toContain('{SEARCH_QUERIES}');
  });

  it('should include {AVAILABLE_TOOLS} placeholder', () => {
    expect(scout).toContain('{AVAILABLE_TOOLS}');
  });

  it('should describe brave_search tool', () => {
    expect(scout).toContain('brave_search');
  });

  it('should describe browser_visit tool', () => {
    expect(scout).toContain('browser_visit');
  });

  it('should describe screenshot tool', () => {
    expect(scout).toContain('screenshot');
  });

  it('should describe vision_analyze tool', () => {
    expect(scout).toContain('vision_analyze');
  });

  it('should describe extract_table tool', () => {
    expect(scout).toContain('extract_table');
  });

  it('should describe safe_form_fill tool', () => {
    expect(scout).toContain('safe_form_fill');
  });

  it('should describe paginate tool', () => {
    expect(scout).toContain('paginate');
  });

  it('should describe infinite_scroll tool', () => {
    expect(scout).toContain('infinite_scroll');
  });

  it('should describe run_code tool', () => {
    expect(scout).toContain('run_code');
  });

  it('should include safety rules about login forms', () => {
    expect(scout).toContain('NEVER fill login');
  });

  it('should include safety rules about passwords', () => {
    expect(scout).toContain('NEVER enter passwords');
  });

  it('should include JSON output format with agentId', () => {
    expect(scout).toContain('"agentId"');
  });

  it('should include findings array in output format', () => {
    expect(scout).toContain('"findings"');
  });

  it('should include toolsUsed in output format', () => {
    expect(scout).toContain('"toolsUsed"');
  });

  it('should include needsDeeper flag in output format', () => {
    expect(scout).toContain('"needsDeeper"');
  });

  it('should include childSuggestions in output format', () => {
    expect(scout).toContain('"childSuggestions"');
  });

  it('should mention citing sources', () => {
    expect(scout).toContain('Cite your sources');
  });

  it('should warn against lazy research', () => {
    expect(scout.toLowerCase()).toContain('lazy research');
  });

  it('should mention confidence levels in finding types', () => {
    expect(scout).toContain('"confidence"');
  });

  it('should include relevanceScore field', () => {
    expect(scout).toContain('"relevanceScore"');
  });
});

// ---------------------------------------------------------------------------
// 9. synthesizer prompt
// ---------------------------------------------------------------------------

describe('STRATEGY_PROMPTS.synthesizer', () => {
  const synth = STRATEGY_PROMPTS.synthesizer;

  it('should be a substantial prompt (>1000 chars)', () => {
    expect(synth.length).toBeGreaterThan(1000);
  });

  it('should identify role as Synthesizer', () => {
    expect(synth).toContain('Synthesizer');
  });

  it('should include {SYNTHESIZED_PROBLEM} placeholder', () => {
    expect(synth).toContain('{SYNTHESIZED_PROBLEM}');
  });

  it('should include {RAW_FINDINGS} placeholder', () => {
    expect(synth).toContain('{RAW_FINDINGS}');
  });

  it('should mention DEDUPLICATE task', () => {
    expect(synth).toContain('DEDUPLICATE');
  });

  it('should mention RESOLVE CONFLICTS task', () => {
    expect(synth).toContain('RESOLVE CONFLICTS');
  });

  it('should mention ORGANIZE BY THEME task', () => {
    expect(synth).toContain('ORGANIZE BY THEME');
  });

  it('should mention QUALITY ASSESSMENT task', () => {
    expect(synth).toContain('QUALITY ASSESSMENT');
  });

  it('should mention IDENTIFY GAPS task', () => {
    expect(synth).toContain('IDENTIFY GAPS');
  });

  it('should mention HIGHLIGHT KEY INSIGHTS task', () => {
    expect(synth).toContain('HIGHLIGHT KEY INSIGHTS');
  });

  it('should include JSON output format with synthesisComplete', () => {
    expect(synth).toContain('"synthesisComplete"');
  });

  it('should include totalFindingsProcessed in output', () => {
    expect(synth).toContain('"totalFindingsProcessed"');
  });

  it('should include uniqueFindingsAfterDedup in output', () => {
    expect(synth).toContain('"uniqueFindingsAfterDedup"');
  });

  it('should include conflicts section in output format', () => {
    expect(synth).toContain('"conflicts"');
  });

  it('should include topFindings in output format', () => {
    expect(synth).toContain('"topFindings"');
  });

  it('should include overallAssessment in output format', () => {
    expect(synth).toContain('"overallAssessment"');
  });

  it('should include readyForQC flag in output format', () => {
    expect(synth).toContain('"readyForQC"');
  });

  it('should state critical rule — NEVER lose information', () => {
    expect(synth).toContain('NEVER lose information');
  });

  it('should state critical rule — ALWAYS cite sources', () => {
    expect(synth).toContain('ALWAYS cite sources');
  });

  it('should state critical rule — BE HONEST about gaps', () => {
    expect(synth).toContain('BE HONEST about gaps');
  });
});

// ---------------------------------------------------------------------------
// 10. synthesis prompt — final strategy output
// ---------------------------------------------------------------------------

describe('STRATEGY_PROMPTS.synthesis', () => {
  const synthesis = STRATEGY_PROMPTS.synthesis;

  it('should be a substantial prompt (>1000 chars)', () => {
    expect(synthesis.length).toBeGreaterThan(1000);
  });

  it('should mention final strategy recommendation', () => {
    expect(synthesis.toLowerCase()).toContain('final strategy recommendation');
  });

  it('should include {SYNTHESIZED_PROBLEM} placeholder', () => {
    expect(synthesis).toContain('{SYNTHESIZED_PROBLEM}');
  });

  it('should include {ALL_FINDINGS} placeholder', () => {
    expect(synthesis).toContain('{ALL_FINDINGS}');
  });

  it('should include {DOMAIN_REPORTS} placeholder', () => {
    expect(synthesis).toContain('{DOMAIN_REPORTS}');
  });

  it('should require CLEAR RECOMMENDATION', () => {
    expect(synthesis).toContain('CLEAR RECOMMENDATION');
  });

  it('should require ALTERNATIVES', () => {
    expect(synthesis).toContain('ALTERNATIVES');
  });

  it('should require RISK ASSESSMENT', () => {
    expect(synthesis).toContain('RISK ASSESSMENT');
  });

  it('should require ACTION PLAN', () => {
    expect(synthesis).toContain('ACTION PLAN');
  });

  it('should require TIMELINE', () => {
    expect(synthesis).toContain('TIMELINE');
  });

  it('should require GAPS disclosure', () => {
    expect(synthesis).toContain('GAPS');
  });

  it('should include JSON output format with recommendation', () => {
    expect(synthesis).toContain('"recommendation"');
  });

  it('should include alternatives in output format', () => {
    expect(synthesis).toContain('"alternatives"');
  });

  it('should include actionPlan in output format', () => {
    expect(synthesis).toContain('"actionPlan"');
  });

  it('should include riskAssessment in output format', () => {
    expect(synthesis).toContain('"riskAssessment"');
  });

  it('should include nextSteps in output format', () => {
    expect(synthesis).toContain('"nextSteps"');
  });

  it('should specify that confidence MUST be a NUMBER', () => {
    expect(synthesis).toContain('MUST be a NUMBER');
  });

  it('should specify that tradeoffs MUST be strings', () => {
    expect(synthesis).toContain('MUST be an array of STRINGS');
  });

  it('should require whyNotTop field for alternatives', () => {
    expect(synthesis).toContain('"whyNotTop"');
  });

  it('should require bestFor field for alternatives', () => {
    expect(synthesis).toContain('"bestFor"');
  });

  it('should mention REAL DATA in tone guidance', () => {
    expect(synthesis).toContain('REAL DATA');
  });

  it('should mention delivering REAL VALUE', () => {
    expect(synthesis).toContain('REAL VALUE');
  });
});

// ---------------------------------------------------------------------------
// 11. Cross-cutting: placeholder consistency
// ---------------------------------------------------------------------------

describe('Placeholder consistency', () => {
  it('architect and synthesizer both use {SYNTHESIZED_PROBLEM}', () => {
    expect(STRATEGY_PROMPTS.architect).toContain('{SYNTHESIZED_PROBLEM}');
    expect(STRATEGY_PROMPTS.synthesizer).toContain('{SYNTHESIZED_PROBLEM}');
  });

  it('synthesis uses {SYNTHESIZED_PROBLEM}', () => {
    expect(STRATEGY_PROMPTS.synthesis).toContain('{SYNTHESIZED_PROBLEM}');
  });

  it('qualityControl uses {CURRENT_STATE}', () => {
    expect(STRATEGY_PROMPTS.qualityControl).toContain('{CURRENT_STATE}');
  });

  it('projectManager uses {DOMAIN}, {SCOUT_LIST}, {PROBLEM_SUMMARY}', () => {
    expect(STRATEGY_PROMPTS.projectManager).toContain('{DOMAIN}');
    expect(STRATEGY_PROMPTS.projectManager).toContain('{SCOUT_LIST}');
    expect(STRATEGY_PROMPTS.projectManager).toContain('{PROBLEM_SUMMARY}');
  });

  it('scout uses all agent identity placeholders', () => {
    expect(STRATEGY_PROMPTS.scout).toContain('{AGENT_NAME}');
    expect(STRATEGY_PROMPTS.scout).toContain('{AGENT_ROLE}');
    expect(STRATEGY_PROMPTS.scout).toContain('{EXPERTISE}');
    expect(STRATEGY_PROMPTS.scout).toContain('{PURPOSE}');
    expect(STRATEGY_PROMPTS.scout).toContain('{KEY_QUESTIONS}');
    expect(STRATEGY_PROMPTS.scout).toContain('{SEARCH_QUERIES}');
    expect(STRATEGY_PROMPTS.scout).toContain('{AVAILABLE_TOOLS}');
  });
});

// ---------------------------------------------------------------------------
// 12. Cross-cutting: safety / ethical content in all relevant prompts
// ---------------------------------------------------------------------------

describe('Safety content across prompts', () => {
  it('intake contains ethics/boundaries content', () => {
    expect(STRATEGY_PROMPTS.intake).toContain('ETHICAL BOUNDARIES');
  });

  it('architect contains safety restrictions', () => {
    expect(STRATEGY_PROMPTS.architect).toContain('SAFETY RESTRICTIONS');
  });

  it('scout contains safety rules', () => {
    expect(STRATEGY_PROMPTS.scout).toContain('SAFETY RULES');
  });

  it('qualityControl can trigger kill switch', () => {
    expect(STRATEGY_PROMPTS.qualityControl).toContain('KILL SWITCH');
  });

  it('intakeOpening mentions safety framework', () => {
    expect(STRATEGY_PROMPTS.intakeOpening).toContain('SAFETY FRAMEWORK');
  });
});

// ---------------------------------------------------------------------------
// 13. Cross-cutting: JSON output format presence
// ---------------------------------------------------------------------------

describe('JSON output blocks in prompts', () => {
  const promptsWithJson: (keyof PromptSet)[] = [
    'intake',
    'architect',
    'qualityControl',
    'projectManager',
    'scout',
    'synthesizer',
    'synthesis',
  ];

  for (const key of promptsWithJson) {
    it(`${key} should contain a JSON code block`, () => {
      expect(STRATEGY_PROMPTS[key]).toContain('```json');
    });
  }

  it('intakeOpening should NOT contain a JSON code block (it is a user-facing message)', () => {
    expect(STRATEGY_PROMPTS.intakeOpening).not.toContain('```json');
  });
});

// ---------------------------------------------------------------------------
// 14. Edge case: immutability / no accidental mutation
// ---------------------------------------------------------------------------

describe('Immutability checks', () => {
  it('should return the same object reference on repeated import', async () => {
    const { STRATEGY_PROMPTS: secondImport } = await import('../strategy');
    expect(secondImport).toBe(STRATEGY_PROMPTS);
  });

  it('should survive Object.keys enumeration without error', () => {
    expect(() => Object.keys(STRATEGY_PROMPTS)).not.toThrow();
  });

  it('should survive JSON.stringify without error', () => {
    expect(() => JSON.stringify(STRATEGY_PROMPTS)).not.toThrow();
  });

  it('JSON.stringify round-trip preserves all fields', () => {
    const parsed = JSON.parse(JSON.stringify(STRATEGY_PROMPTS));
    for (const key of PROMPT_KEYS) {
      expect(parsed[key]).toBe(STRATEGY_PROMPTS[key]);
    }
  });
});

// ---------------------------------------------------------------------------
// 15. Prompt length relative comparisons
// ---------------------------------------------------------------------------

describe('Relative prompt lengths', () => {
  it('architect should be the longest prompt', () => {
    const lengths = PROMPT_KEYS.filter((k) => k !== 'name').map(
      (k) => (STRATEGY_PROMPTS[k] as string).length
    );
    const maxLen = Math.max(...lengths);
    expect(STRATEGY_PROMPTS.architect.length).toBe(maxLen);
  });

  it('name should be the shortest field', () => {
    const lengths = PROMPT_KEYS.map((k) => (STRATEGY_PROMPTS[k] as string).length);
    const minLen = Math.min(...lengths);
    expect(STRATEGY_PROMPTS.name.length).toBe(minLen);
  });

  it('all prompts except name should be >200 chars', () => {
    for (const key of PROMPT_KEYS) {
      if (key === 'name') continue;
      expect((STRATEGY_PROMPTS[key] as string).length).toBeGreaterThan(200);
    }
  });
});

// ---------------------------------------------------------------------------
// 16. No accidental HTML or script injection markers
// ---------------------------------------------------------------------------

describe('No accidental injection markers', () => {
  for (const key of PROMPT_KEYS) {
    it(`${key} should not contain <script> tags`, () => {
      expect((STRATEGY_PROMPTS[key] as string).toLowerCase()).not.toContain('<script');
    });

    it(`${key} should not contain javascript: protocol`, () => {
      expect((STRATEGY_PROMPTS[key] as string).toLowerCase()).not.toContain('javascript:');
    });
  }
});

// ---------------------------------------------------------------------------
// 17. PromptSet type conformance
// ---------------------------------------------------------------------------

describe('Type conformance', () => {
  it('should satisfy the PromptSet interface at runtime', () => {
    const requiredKeys: (keyof PromptSet)[] = [
      'name',
      'intake',
      'intakeOpening',
      'architect',
      'qualityControl',
      'projectManager',
      'scout',
      'synthesizer',
      'synthesis',
    ];

    for (const key of requiredKeys) {
      expect(key in STRATEGY_PROMPTS).toBe(true);
      expect(typeof STRATEGY_PROMPTS[key]).toBe('string');
    }
  });

  it('should have no extra keys beyond PromptSet', () => {
    const allowedKeys = new Set<string>([
      'name',
      'intake',
      'intakeOpening',
      'architect',
      'qualityControl',
      'projectManager',
      'scout',
      'synthesizer',
      'synthesis',
    ]);
    for (const key of Object.keys(STRATEGY_PROMPTS)) {
      expect(allowedKeys.has(key)).toBe(true);
    }
  });
});
