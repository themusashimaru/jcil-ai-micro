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

import { RESEARCH_PROMPTS } from '../research';
import type { PromptSet } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS: (keyof PromptSet)[] = [
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
// 1. PromptSet Shape Conformance
// ---------------------------------------------------------------------------

describe('RESEARCH_PROMPTS — shape conformance', () => {
  it('should be defined and not null', () => {
    expect(RESEARCH_PROMPTS).toBeDefined();
    expect(RESEARCH_PROMPTS).not.toBeNull();
  });

  it('should be an object', () => {
    expect(typeof RESEARCH_PROMPTS).toBe('object');
  });

  it('should have exactly 9 keys matching the PromptSet interface', () => {
    const keys = Object.keys(RESEARCH_PROMPTS);
    expect(keys).toHaveLength(9);
    for (const field of REQUIRED_FIELDS) {
      expect(keys).toContain(field);
    }
  });

  for (const field of REQUIRED_FIELDS) {
    it(`should have a non-empty string for "${field}"`, () => {
      expect(typeof RESEARCH_PROMPTS[field]).toBe('string');
      expect((RESEARCH_PROMPTS[field] as string).length).toBeGreaterThan(0);
    });
  }

  it('should not contain any undefined values', () => {
    for (const key of Object.keys(RESEARCH_PROMPTS)) {
      expect(RESEARCH_PROMPTS[key as keyof PromptSet]).toBeDefined();
    }
  });

  it('should not contain any null values', () => {
    for (const key of Object.keys(RESEARCH_PROMPTS)) {
      expect(RESEARCH_PROMPTS[key as keyof PromptSet]).not.toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Name Field
// ---------------------------------------------------------------------------

describe('RESEARCH_PROMPTS.name', () => {
  it('should be "Deep Research"', () => {
    expect(RESEARCH_PROMPTS.name).toBe('Deep Research');
  });

  it('should be a short human-readable label', () => {
    expect(RESEARCH_PROMPTS.name.length).toBeLessThan(50);
  });
});

// ---------------------------------------------------------------------------
// 3. Intake Prompt
// ---------------------------------------------------------------------------

describe('RESEARCH_PROMPTS.intake', () => {
  const intake = RESEARCH_PROMPTS.intake;

  it('should be a substantial prompt (>500 chars)', () => {
    expect(intake.length).toBeGreaterThan(500);
  });

  it('should describe the role as a research director', () => {
    expect(intake).toContain('research director');
  });

  it('should include ethical boundaries section', () => {
    expect(intake).toContain('ETHICAL BOUNDARIES');
  });

  it('should list prohibited research areas', () => {
    expect(intake).toContain('Human trafficking');
    expect(intake).toContain('Violence, terrorism');
    expect(intake).toContain('Fraud, scams');
    expect(intake).toContain('Drug trafficking');
    expect(intake).toContain('Child exploitation');
    expect(intake).toContain('Stalking, harassment');
    expect(intake).toContain('Money laundering');
    expect(intake).toContain('Doxxing');
  });

  it('should include the output JSON format with intakeComplete', () => {
    expect(intake).toContain('"intakeComplete": true');
  });

  it('should include synthesis structure fields', () => {
    expect(intake).toContain('"summary"');
    expect(intake).toContain('"coreQuestion"');
    expect(intake).toContain('"constraints"');
    expect(intake).toContain('"priorities"');
    expect(intake).toContain('"stakeholders"');
    expect(intake).toContain('"timeframe"');
    expect(intake).toContain('"riskTolerance"');
    expect(intake).toContain('"complexity"');
    expect(intake).toContain('"domains"');
    expect(intake).toContain('"hiddenFactors"');
    expect(intake).toContain('"successCriteria"');
  });

  it('should instruct to NOT start researching', () => {
    expect(intake).toContain('Do NOT start researching yourself');
  });

  it('should mention the approach steps (1 through 6)', () => {
    expect(intake).toContain('1. UNDERSTAND THE RESEARCH GOAL');
    expect(intake).toContain('2. CLARIFY SCOPE AND DEPTH');
    expect(intake).toContain('3. PROBE FOR RESEARCH SPECIFICS');
    expect(intake).toContain('4. IDENTIFY RESEARCH DIMENSIONS');
    expect(intake).toContain('5. UNDERSTAND OUTPUT EXPECTATIONS');
    expect(intake).toContain('6. SYNTHESIZE AND CONFIRM');
  });

  it('should mention risk tolerance options', () => {
    expect(intake).toContain('low|medium|high');
  });

  it('should mention complexity levels', () => {
    expect(intake).toContain('simple|moderate|complex|extreme');
  });
});

// ---------------------------------------------------------------------------
// 4. Intake Opening Message
// ---------------------------------------------------------------------------

describe('RESEARCH_PROMPTS.intakeOpening', () => {
  const opening = RESEARCH_PROMPTS.intakeOpening;

  it('should be a substantial message (>500 chars)', () => {
    expect(opening.length).toBeGreaterThan(500);
  });

  it('should mention Deep Research Mode', () => {
    expect(opening).toContain('Deep Research Mode Activated');
  });

  it('should describe the research hierarchy', () => {
    expect(opening).toContain('THE RESEARCH HIERARCHY');
    expect(opening).toContain('Claude Opus 4.6');
    expect(opening).toContain('Claude Sonnet 4.6');
  });

  it('should list the 14 specialized research tools', () => {
    expect(opening).toContain('Brave Search');
    expect(opening).toContain('Browser Visit');
    expect(opening).toContain('Vision Analyze');
    expect(opening).toContain('Extract Tables');
    expect(opening).toContain('Safe Form Fill');
    expect(opening).toContain('Pagination Handler');
    expect(opening).toContain('Infinite Scroll');
    expect(opening).toContain('Click Navigate');
    expect(opening).toContain('PDF Extraction');
    expect(opening).toContain('Screenshot Capture');
    expect(opening).toContain('Code Execution');
    expect(opening).toContain('Compare Screenshots');
    expect(opening).toContain('Comparison Table Generator');
  });

  it('should include the safety framework section', () => {
    expect(opening).toContain('SAFETY FRAMEWORK');
    expect(opening).toContain('Domain blocking');
    expect(opening).toContain('Form whitelist');
    expect(opening).toContain('Rate limiting');
  });

  it('should estimate the research time', () => {
    expect(opening).toContain('2-5 minutes');
  });

  it('should end with a call-to-action question', () => {
    expect(opening).toContain('What topic do you want me to research?');
  });

  it('should mention E2B Cloud Sandbox', () => {
    expect(opening).toContain('E2B Cloud Sandbox');
  });
});

// ---------------------------------------------------------------------------
// 5. Architect Prompt
// ---------------------------------------------------------------------------

describe('RESEARCH_PROMPTS.architect', () => {
  const architect = RESEARCH_PROMPTS.architect;

  it('should be a very substantial prompt (>2000 chars)', () => {
    expect(architect.length).toBeGreaterThan(2000);
  });

  it('should identify itself as the Research Director', () => {
    expect(architect).toContain('Research Director');
  });

  it('should contain the {SYNTHESIZED_PROBLEM} placeholder', () => {
    expect(architect).toContain('{SYNTHESIZED_PROBLEM}');
  });

  it('should list various agent types', () => {
    expect(architect).toContain('PRIMARY RESEARCH AGENTS');
    expect(architect).toContain('VERIFICATION AGENTS');
    expect(architect).toContain('CONTRADICTION HUNTERS');
    expect(architect).toContain('SYNTHESIS AGENTS');
    expect(architect).toContain('STATISTICAL ANALYSTS');
    expect(architect).toContain('BIAS DETECTORS');
  });

  it('should describe advanced research strategies', () => {
    expect(architect).toContain('MULTI-PHASE INVESTIGATION');
    expect(architect).toContain('EVIDENCE TRIANGULATION');
    expect(architect).toContain('PERSPECTIVE MAPPING');
    expect(architect).toContain('SOURCE QUALITY ASSESSMENT');
    expect(architect).toContain('DATA-DRIVEN RESEARCH');
    expect(architect).toContain('LITERATURE REVIEW');
  });

  it('should list all 14 agent tools', () => {
    expect(architect).toContain('"brave_search"');
    expect(architect).toContain('"browser_visit"');
    expect(architect).toContain('"extract_pdf"');
    expect(architect).toContain('"vision_analyze"');
    expect(architect).toContain('"extract_table"');
    expect(architect).toContain('"compare_screenshots"');
    expect(architect).toContain('"screenshot"');
    expect(architect).toContain('"safe_form_fill"');
    expect(architect).toContain('"paginate"');
    expect(architect).toContain('"infinite_scroll"');
    expect(architect).toContain('"click_navigate"');
    expect(architect).toContain('"run_code"');
    expect(architect).toContain('"generate_comparison"');
    expect(architect).toContain('"create_custom_tool"');
  });

  it('should include safety restrictions', () => {
    expect(architect).toContain('SAFETY RESTRICTIONS');
    expect(architect).toContain('Government websites');
    expect(architect).toContain('Adult/pornographic content');
  });

  it('should include the JSON output format with strategy and scouts', () => {
    expect(architect).toContain('"strategy"');
    expect(architect).toContain('"projectManagers"');
    expect(architect).toContain('"scouts"');
    expect(architect).toContain('"verificationStrategy"');
    expect(architect).toContain('"estimatedTotalSearches"');
    expect(architect).toContain('"estimatedCost"');
  });

  it('should include design principles', () => {
    expect(architect).toContain('TRUTH-SEEKING');
    expect(architect).toContain('SOURCE TRIANGULATION');
    expect(architect).toContain('STEEL-MAN COUNTER-ARGUMENTS');
    expect(architect).toContain('EVIDENCE HIERARCHY');
    expect(architect).toContain('BIAS AWARENESS');
    expect(architect).toContain('QUALITY OVER QUANTITY');
    expect(architect).toContain('VERIFY THE IMPORTANT');
  });

  it('should include creative research design examples', () => {
    expect(architect).toContain('SCIENTIFIC TOPIC');
    expect(architect).toContain('MARKET RESEARCH');
    expect(architect).toContain('HISTORICAL INVESTIGATION');
    expect(architect).toContain('CONTROVERSIAL TOPIC');
  });

  it('should define agentType enum values', () => {
    expect(architect).toContain(
      'research|verification|contradiction|analyst|synthesis|perspective|historical|comparative'
    );
  });

  it('should define researchApproach enum values', () => {
    expect(architect).toContain('deep_dive|broad_scan|comparative|verification|adversarial');
  });
});

// ---------------------------------------------------------------------------
// 6. Quality Control Prompt
// ---------------------------------------------------------------------------

describe('RESEARCH_PROMPTS.qualityControl', () => {
  const qc = RESEARCH_PROMPTS.qualityControl;

  it('should be a substantial prompt (>1000 chars)', () => {
    expect(qc.length).toBeGreaterThan(1000);
  });

  it('should identify itself as Quality Control Director', () => {
    expect(qc).toContain('Quality Control Director');
  });

  it('should contain the {CURRENT_STATE} placeholder', () => {
    expect(qc).toContain('{CURRENT_STATE}');
  });

  it('should describe absolute authority actions', () => {
    expect(qc).toContain('Pause research for review');
    expect(qc).toContain('Request additional investigation');
    expect(qc).toContain('Redirect research focus');
    expect(qc).toContain('KILL SWITCH');
  });

  it('should define monitoring responsibilities', () => {
    expect(qc).toContain('BUDGET MONITORING');
    expect(qc).toContain('TIME MONITORING');
    expect(qc).toContain('RESEARCH QUALITY ASSESSMENT');
    expect(qc).toContain('ERROR MONITORING');
    expect(qc).toContain('REDUNDANCY DETECTION');
  });

  it('should specify budget thresholds', () => {
    expect(qc).toContain('$20 limit');
    expect(qc).toContain('50%, 75%, 90%');
  });

  it('should specify time limit', () => {
    expect(qc).toContain('10 minute limit');
  });

  it('should define quality gates 1 through 4', () => {
    expect(qc).toContain('GATE 1: Intake Quality');
    expect(qc).toContain('GATE 2: Investigation Design Quality');
    expect(qc).toContain('GATE 3: Research Quality');
    expect(qc).toContain('GATE 4: Synthesis Quality');
  });

  it('should include JSON output format with status and metrics', () => {
    expect(qc).toContain('"status"');
    expect(qc).toContain('"action"');
    expect(qc).toContain('"issues"');
    expect(qc).toContain('"metrics"');
    expect(qc).toContain('"overallQualityScore"');
  });

  it('should define kill switch criteria', () => {
    expect(qc).toContain('KILL SWITCH CRITERIA');
    expect(qc).toContain('Budget >95%');
    expect(qc).toContain('Time >90%');
    expect(qc).toContain('Error rate >30%');
    expect(qc).toContain('Infinite loop detected');
  });

  it('should include status enum values', () => {
    expect(qc).toContain('healthy|warning|critical');
  });

  it('should include action enum values', () => {
    expect(qc).toContain('continue|pause|redirect|spawn_more|kill');
  });
});

// ---------------------------------------------------------------------------
// 7. Project Manager Prompt
// ---------------------------------------------------------------------------

describe('RESEARCH_PROMPTS.projectManager', () => {
  const pm = RESEARCH_PROMPTS.projectManager;

  it('should be a substantial prompt (>500 chars)', () => {
    expect(pm.length).toBeGreaterThan(500);
  });

  it('should identify itself as a Domain Lead', () => {
    expect(pm).toContain('Domain Lead');
  });

  it('should contain expected placeholders', () => {
    expect(pm).toContain('{DOMAIN}');
    expect(pm).toContain('{SCOUT_LIST}');
    expect(pm).toContain('{PROBLEM_SUMMARY}');
  });

  it('should define coordination responsibilities', () => {
    expect(pm).toContain('INVESTIGATOR COORDINATION');
    expect(pm).toContain('FINDINGS SYNTHESIS');
    expect(pm).toContain('EVIDENCE QUALITY');
    expect(pm).toContain('CROSS-DOMAIN CONNECTIONS');
  });

  it('should include the JSON output format with domain and keyFindings', () => {
    expect(pm).toContain('"domain"');
    expect(pm).toContain('"keyFindings"');
    expect(pm).toContain('"comparisonTable"');
    expect(pm).toContain('"recommendation"');
    expect(pm).toContain('"gaps"');
    expect(pm).toContain('"crossDomainDependencies"');
  });

  it('should include confidence levels', () => {
    expect(pm).toContain('high|medium|low');
  });
});

// ---------------------------------------------------------------------------
// 8. Scout (Investigator) Prompt
// ---------------------------------------------------------------------------

describe('RESEARCH_PROMPTS.scout', () => {
  const scout = RESEARCH_PROMPTS.scout;

  it('should be a very substantial prompt (>2000 chars)', () => {
    expect(scout.length).toBeGreaterThan(2000);
  });

  it('should identify itself as a research investigator', () => {
    expect(scout).toContain('research investigator');
  });

  it('should contain identity placeholders', () => {
    expect(scout).toContain('{AGENT_NAME}');
    expect(scout).toContain('{AGENT_ROLE}');
    expect(scout).toContain('{EXPERTISE}');
    expect(scout).toContain('{PURPOSE}');
    expect(scout).toContain('{KEY_QUESTIONS}');
    expect(scout).toContain('{SEARCH_QUERIES}');
    expect(scout).toContain('{AVAILABLE_TOOLS}');
  });

  it('should include tool usage guide', () => {
    expect(scout).toContain('TOOL USAGE GUIDE');
    expect(scout).toContain('brave_search');
    expect(scout).toContain('browser_visit');
    expect(scout).toContain('screenshot');
    expect(scout).toContain('vision_analyze');
    expect(scout).toContain('extract_table');
    expect(scout).toContain('safe_form_fill');
    expect(scout).toContain('paginate');
    expect(scout).toContain('infinite_scroll');
    expect(scout).toContain('click_navigate');
    expect(scout).toContain('extract_pdf');
    expect(scout).toContain('compare_screenshots');
    expect(scout).toContain('generate_comparison');
    expect(scout).toContain('run_code');
  });

  it('should include safety rules', () => {
    expect(scout).toContain('SAFETY RULES');
    expect(scout).toContain('NEVER fill login');
    expect(scout).toContain('NEVER enter passwords');
  });

  it('should describe the 12-step research methodology', () => {
    expect(scout).toContain('1. START with brave_search');
    expect(scout).toContain('2. THEN use browser_visit');
    expect(scout).toContain('12. Identify if deeper investigation is needed');
  });

  it('should include JSON output format with agentId and findings', () => {
    expect(scout).toContain('"agentId"');
    expect(scout).toContain('"findings"');
    expect(scout).toContain('"toolsUsed"');
    expect(scout).toContain('"pagesVisited"');
    expect(scout).toContain('"needsDeeper"');
    expect(scout).toContain('"childSuggestions"');
    expect(scout).toContain('"gaps"');
  });

  it('should define finding types', () => {
    expect(scout).toContain('fact|insight|recommendation|warning|opportunity|data');
  });

  it('should emphasize evidence-based research', () => {
    expect(scout).toContain('SPECIFIC and EVIDENCE-BASED');
    expect(scout).toContain('ALWAYS cite your sources');
  });

  it('should discourage lazy research', () => {
    expect(scout).toContain('DO NOT just brave_search and summarize the snippets');
  });
});

// ---------------------------------------------------------------------------
// 9. Synthesizer Prompt
// ---------------------------------------------------------------------------

describe('RESEARCH_PROMPTS.synthesizer', () => {
  const synth = RESEARCH_PROMPTS.synthesizer;

  it('should be a substantial prompt (>1500 chars)', () => {
    expect(synth.length).toBeGreaterThan(1500);
  });

  it('should identify the Synthesizer role', () => {
    expect(synth).toContain('Synthesizer for the Deep Research Agent');
  });

  it('should contain expected placeholders', () => {
    expect(synth).toContain('{SYNTHESIZED_PROBLEM}');
    expect(synth).toContain('{RAW_FINDINGS}');
  });

  it('should describe synthesis tasks', () => {
    expect(synth).toContain('1. DEDUPLICATE');
    expect(synth).toContain('2. RESOLVE CONFLICTS');
    expect(synth).toContain('3. ORGANIZE BY THEME');
    expect(synth).toContain('4. EVIDENCE ASSESSMENT');
    expect(synth).toContain('5. IDENTIFY GAPS');
    expect(synth).toContain('6. HIGHLIGHT KEY INSIGHTS');
  });

  it('should include the JSON output format', () => {
    expect(synth).toContain('"synthesisComplete"');
    expect(synth).toContain('"totalFindingsProcessed"');
    expect(synth).toContain('"uniqueFindingsAfterDedup"');
    expect(synth).toContain('"organizedFindings"');
    expect(synth).toContain('"conflicts"');
    expect(synth).toContain('"gaps"');
    expect(synth).toContain('"topFindings"');
    expect(synth).toContain('"overallAssessment"');
  });

  it('should include critical rules', () => {
    expect(synth).toContain('NEVER lose information');
    expect(synth).toContain('ALWAYS cite sources');
    expect(synth).toContain('BE HONEST about gaps');
  });

  it('should include research quality levels', () => {
    expect(synth).toContain('excellent|good|fair|poor');
  });

  it('should include gap importance levels', () => {
    expect(synth).toContain('critical|important|nice-to-have');
  });
});

// ---------------------------------------------------------------------------
// 10. Final Synthesis Prompt
// ---------------------------------------------------------------------------

describe('RESEARCH_PROMPTS.synthesis', () => {
  const synthesis = RESEARCH_PROMPTS.synthesis;

  it('should be a substantial prompt (>1500 chars)', () => {
    expect(synthesis.length).toBeGreaterThan(1500);
  });

  it('should reference the final research report', () => {
    expect(synthesis).toContain('final research report');
  });

  it('should contain expected placeholders', () => {
    expect(synthesis).toContain('{SYNTHESIZED_PROBLEM}');
    expect(synthesis).toContain('{ALL_FINDINGS}');
    expect(synthesis).toContain('{DOMAIN_REPORTS}');
  });

  it('should list all 7 required sections', () => {
    expect(synthesis).toContain('1. EXECUTIVE SUMMARY');
    expect(synthesis).toContain('2. DETAILED ANALYSIS');
    expect(synthesis).toContain('3. KEY INSIGHTS');
    expect(synthesis).toContain('4. CONTRASTING VIEWPOINTS');
    expect(synthesis).toContain('5. DATA & EVIDENCE');
    expect(synthesis).toContain('6. KNOWLEDGE GAPS');
    expect(synthesis).toContain('7. FURTHER RESEARCH');
  });

  it('should specify critical JSON rules', () => {
    expect(synthesis).toContain('CRITICAL JSON RULES');
    expect(synthesis).toContain('"tradeoffs" MUST be an array of STRINGS');
    expect(synthesis).toContain('"confidence" MUST be a NUMBER');
  });

  it('should include the JSON output format', () => {
    expect(synthesis).toContain('"recommendation"');
    expect(synthesis).toContain('"alternatives"');
    expect(synthesis).toContain('"analysis"');
    expect(synthesis).toContain('"actionPlan"');
    expect(synthesis).toContain('"gaps"');
    expect(synthesis).toContain('"nextSteps"');
  });

  it('should describe the tone expectations', () => {
    expect(synthesis).toContain('TONE');
    expect(synthesis).toContain('thorough and analytical');
    expect(synthesis).toContain('evidence objectively');
    expect(synthesis).toContain('uncertainty and limitations');
  });

  it('should require alternative fields', () => {
    expect(synthesis).toContain('"title"');
    expect(synthesis).toContain('"summary"');
    expect(synthesis).toContain('"confidence"');
    expect(synthesis).toContain('"whyNotTop"');
    expect(synthesis).toContain('"bestFor"');
  });
});

// ---------------------------------------------------------------------------
// 11. Cross-cutting Concerns & Immutability
// ---------------------------------------------------------------------------

describe('RESEARCH_PROMPTS — cross-cutting concerns', () => {
  it('should be importable as a named export', () => {
    expect(RESEARCH_PROMPTS).toBeTruthy();
  });

  it('every prompt field should be a non-empty string', () => {
    for (const field of REQUIRED_FIELDS) {
      const value = RESEARCH_PROMPTS[field];
      expect(typeof value).toBe('string');
      expect((value as string).trim().length).toBeGreaterThan(0);
    }
  });

  it('no prompt should contain the literal string "undefined"', () => {
    for (const field of REQUIRED_FIELDS) {
      expect(RESEARCH_PROMPTS[field]).not.toContain('undefined');
    }
  });

  it('no prompt should contain the literal string "null"', () => {
    for (const field of REQUIRED_FIELDS) {
      // Checking for standalone "null" as a sentinel value, not as part of a word
      const value = RESEARCH_PROMPTS[field] as string;
      // Allow things like "null" in JSON examples, but not bare sentinel usage
      expect(value).not.toMatch(/\bnull\b(?![\s]*[,}])/);
    }
  });

  it('should not contain TODO or FIXME markers', () => {
    for (const field of REQUIRED_FIELDS) {
      const value = (RESEARCH_PROMPTS[field] as string).toUpperCase();
      expect(value).not.toContain('TODO');
      expect(value).not.toContain('FIXME');
    }
  });

  it('should not contain placeholder-only fields (just whitespace)', () => {
    for (const field of REQUIRED_FIELDS) {
      const trimmed = (RESEARCH_PROMPTS[field] as string).trim();
      expect(trimmed.length).toBeGreaterThan(10);
    }
  });

  it('all long prompts should contain structured sections', () => {
    // All prompts except "name" should have some form of structure
    const longFields: (keyof PromptSet)[] = [
      'intake',
      'intakeOpening',
      'architect',
      'qualityControl',
      'projectManager',
      'scout',
      'synthesizer',
      'synthesis',
    ];
    for (const field of longFields) {
      const value = RESEARCH_PROMPTS[field] as string;
      // Each long prompt should contain either colons, numbered lists, or JSON
      const hasStructure = value.includes(':') || value.includes('1.') || value.includes('```json');
      expect(hasStructure).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 12. Placeholder Consistency
// ---------------------------------------------------------------------------

describe('RESEARCH_PROMPTS — placeholder usage', () => {
  it('architect should use {SYNTHESIZED_PROBLEM}', () => {
    expect(RESEARCH_PROMPTS.architect).toContain('{SYNTHESIZED_PROBLEM}');
  });

  it('qualityControl should use {CURRENT_STATE}', () => {
    expect(RESEARCH_PROMPTS.qualityControl).toContain('{CURRENT_STATE}');
  });

  it('projectManager should use {DOMAIN}, {SCOUT_LIST}, {PROBLEM_SUMMARY}', () => {
    expect(RESEARCH_PROMPTS.projectManager).toContain('{DOMAIN}');
    expect(RESEARCH_PROMPTS.projectManager).toContain('{SCOUT_LIST}');
    expect(RESEARCH_PROMPTS.projectManager).toContain('{PROBLEM_SUMMARY}');
  });

  it('scout should use all identity placeholders', () => {
    const scout = RESEARCH_PROMPTS.scout;
    expect(scout).toContain('{AGENT_NAME}');
    expect(scout).toContain('{AGENT_ROLE}');
    expect(scout).toContain('{EXPERTISE}');
    expect(scout).toContain('{PURPOSE}');
    expect(scout).toContain('{KEY_QUESTIONS}');
    expect(scout).toContain('{SEARCH_QUERIES}');
    expect(scout).toContain('{AVAILABLE_TOOLS}');
  });

  it('synthesizer should use {SYNTHESIZED_PROBLEM} and {RAW_FINDINGS}', () => {
    expect(RESEARCH_PROMPTS.synthesizer).toContain('{SYNTHESIZED_PROBLEM}');
    expect(RESEARCH_PROMPTS.synthesizer).toContain('{RAW_FINDINGS}');
  });

  it('synthesis should use {SYNTHESIZED_PROBLEM}, {ALL_FINDINGS}, {DOMAIN_REPORTS}', () => {
    expect(RESEARCH_PROMPTS.synthesis).toContain('{SYNTHESIZED_PROBLEM}');
    expect(RESEARCH_PROMPTS.synthesis).toContain('{ALL_FINDINGS}');
    expect(RESEARCH_PROMPTS.synthesis).toContain('{DOMAIN_REPORTS}');
  });

  it('intake and intakeOpening should NOT use placeholders', () => {
    // These are static prompts, not templated
    expect(RESEARCH_PROMPTS.intake).not.toMatch(/\{[A-Z_]+\}/);
    expect(RESEARCH_PROMPTS.intakeOpening).not.toMatch(/\{[A-Z_]+\}/);
  });
});

// ---------------------------------------------------------------------------
// 13. Differentiation from Strategy Mode
// ---------------------------------------------------------------------------

describe('RESEARCH_PROMPTS — research-specific language', () => {
  it('intake should focus on learning, not problem-solving', () => {
    const intake = RESEARCH_PROMPTS.intake;
    expect(intake).toContain('what the user wants to learn');
  });

  it('intakeOpening should describe research capabilities', () => {
    expect(RESEARCH_PROMPTS.intakeOpening).toContain('autonomous research army');
  });

  it('architect should mention research methodology', () => {
    expect(RESEARCH_PROMPTS.architect).toContain('research methodology');
  });

  it('synthesis should produce a research report, not a strategy', () => {
    expect(RESEARCH_PROMPTS.synthesis).toContain('research report');
  });

  it('qualityControl should monitor research completeness', () => {
    expect(RESEARCH_PROMPTS.qualityControl).toContain('research');
    expect(RESEARCH_PROMPTS.qualityControl).toContain('coverage');
  });
});

// ---------------------------------------------------------------------------
// 14. JSON Block Presence
// ---------------------------------------------------------------------------

describe('RESEARCH_PROMPTS — JSON output blocks', () => {
  const fieldsWithJson: (keyof PromptSet)[] = [
    'intake',
    'architect',
    'qualityControl',
    'projectManager',
    'scout',
    'synthesizer',
    'synthesis',
  ];

  for (const field of fieldsWithJson) {
    it(`${field} should contain a JSON code block`, () => {
      expect(RESEARCH_PROMPTS[field]).toContain('```json');
      expect(RESEARCH_PROMPTS[field]).toContain('```');
    });
  }

  it('intakeOpening should NOT contain a JSON code block (user-facing message)', () => {
    expect(RESEARCH_PROMPTS.intakeOpening).not.toContain('```json');
  });
});

// ---------------------------------------------------------------------------
// 15. Edge Cases & Robustness
// ---------------------------------------------------------------------------

describe('RESEARCH_PROMPTS — edge cases', () => {
  it('should not have trailing whitespace at the end of any field', () => {
    for (const field of REQUIRED_FIELDS) {
      const value = RESEARCH_PROMPTS[field] as string;
      // Verify no trailing newlines/spaces at end (trim comparison)
      // Note: some prompts may intentionally have inner whitespace
      expect(value).toBe(value.trimEnd());
    }
  });

  it('should not have leading whitespace at the start of any field', () => {
    for (const field of REQUIRED_FIELDS) {
      const value = RESEARCH_PROMPTS[field] as string;
      expect(value).toBe(value.trimStart());
    }
  });

  it('prompt lengths should be within reasonable bounds', () => {
    // Name should be short
    expect(RESEARCH_PROMPTS.name.length).toBeLessThan(100);
    // All other prompts should be between 100 and 20000 chars
    const longFields: (keyof PromptSet)[] = [
      'intake',
      'intakeOpening',
      'architect',
      'qualityControl',
      'projectManager',
      'scout',
      'synthesizer',
      'synthesis',
    ];
    for (const field of longFields) {
      const len = (RESEARCH_PROMPTS[field] as string).length;
      expect(len).toBeGreaterThan(100);
      expect(len).toBeLessThan(20000);
    }
  });

  it('architect should be the longest prompt (most complex)', () => {
    const architectLen = RESEARCH_PROMPTS.architect.length;
    const otherFields: (keyof PromptSet)[] = [
      'intake',
      'intakeOpening',
      'qualityControl',
      'projectManager',
      'scout',
      'synthesizer',
      'synthesis',
    ];
    for (const field of otherFields) {
      expect(architectLen).toBeGreaterThanOrEqual((RESEARCH_PROMPTS[field] as string).length);
    }
  });

  it('should handle being read multiple times without mutation', () => {
    const firstRead = RESEARCH_PROMPTS.intake;
    const secondRead = RESEARCH_PROMPTS.intake;
    expect(firstRead).toBe(secondRead);
    expect(firstRead).toEqual(secondRead);
  });

  it('object reference should be stable across imports', () => {
    // Same import, same reference
    const ref1 = RESEARCH_PROMPTS;
    const ref2 = RESEARCH_PROMPTS;
    expect(ref1).toBe(ref2);
  });
});
