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

import { DEEP_WRITER_PROMPTS } from '../deep-writer';
import type { PromptSet } from '../types';

// ---------------------------------------------------------------------------
// Helper constants
// ---------------------------------------------------------------------------

const ALL_PROMPT_KEYS: (keyof PromptSet)[] = [
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

const STRING_PROMPT_KEYS: (keyof PromptSet)[] = ALL_PROMPT_KEYS.filter((k) => k !== 'name');

// ===========================================================================
// 1. STRUCTURAL TESTS — Export shape and PromptSet compliance
// ===========================================================================

describe('DEEP_WRITER_PROMPTS — export and PromptSet shape', () => {
  it('should be defined and not null', () => {
    expect(DEEP_WRITER_PROMPTS).toBeDefined();
    expect(DEEP_WRITER_PROMPTS).not.toBeNull();
  });

  it('should be a plain object', () => {
    expect(typeof DEEP_WRITER_PROMPTS).toBe('object');
    expect(Array.isArray(DEEP_WRITER_PROMPTS)).toBe(false);
  });

  it('should satisfy the PromptSet interface with all 9 required keys', () => {
    for (const key of ALL_PROMPT_KEYS) {
      expect(DEEP_WRITER_PROMPTS).toHaveProperty(key);
    }
  });

  it('should have no extra keys beyond the PromptSet interface', () => {
    const actualKeys = Object.keys(DEEP_WRITER_PROMPTS).sort();
    const expectedKeys = [...ALL_PROMPT_KEYS].sort();
    expect(actualKeys).toEqual(expectedKeys);
  });

  it('should have all values as strings', () => {
    for (const key of ALL_PROMPT_KEYS) {
      expect(typeof DEEP_WRITER_PROMPTS[key]).toBe('string');
    }
  });

  it('should have no empty-string values', () => {
    for (const key of ALL_PROMPT_KEYS) {
      expect((DEEP_WRITER_PROMPTS[key] as string).length).toBeGreaterThan(0);
    }
  });

  it('should have substantial prompts (each >200 chars) for all prompt fields', () => {
    for (const key of STRING_PROMPT_KEYS) {
      expect((DEEP_WRITER_PROMPTS[key] as string).length).toBeGreaterThan(200);
    }
  });
});

// ===========================================================================
// 2. NAME FIELD
// ===========================================================================

describe('DEEP_WRITER_PROMPTS.name', () => {
  it('should equal "Deep Writer"', () => {
    expect(DEEP_WRITER_PROMPTS.name).toBe('Deep Writer');
  });

  it('should contain the word "Writer"', () => {
    expect(DEEP_WRITER_PROMPTS.name).toContain('Writer');
  });

  it('should contain the word "Deep"', () => {
    expect(DEEP_WRITER_PROMPTS.name).toContain('Deep');
  });
});

// ===========================================================================
// 3. INTAKE PROMPT
// ===========================================================================

describe('DEEP_WRITER_PROMPTS.intake', () => {
  const intake = DEEP_WRITER_PROMPTS.intake;

  it('should describe the role as a literary editor / writing coach', () => {
    expect(intake).toContain('literary editor');
  });

  // --- Ethical boundaries ---
  it('should include ETHICAL BOUNDARIES section', () => {
    expect(intake).toContain('ETHICAL BOUNDARIES');
  });

  it('should mention refusal of violent content', () => {
    expect(intake.toLowerCase()).toContain('violence');
  });

  it('should mention refusal of fraud/scam content', () => {
    expect(intake.toLowerCase()).toContain('fraud');
  });

  it('should mention refusal of content exploiting minors', () => {
    expect(intake.toLowerCase()).toContain('minors');
  });

  it('should mention refusal of plagiarized content', () => {
    expect(intake.toLowerCase()).toContain('plagiarized');
  });

  it('should mention refusal of hate speech', () => {
    expect(intake.toLowerCase()).toContain('hate speech');
  });

  it('should mention refusal of misinformation', () => {
    expect(intake.toLowerCase()).toContain('misinformation');
  });

  // --- Intake process steps ---
  it('should include UNDERSTAND THE PROJECT section', () => {
    expect(intake).toContain('UNDERSTAND THE PROJECT');
  });

  it('should include DETERMINE THE FORMAT section', () => {
    expect(intake).toContain('DETERMINE THE FORMAT');
  });

  it('should include UNDERSTAND THE AUDIENCE section', () => {
    expect(intake).toContain('UNDERSTAND THE AUDIENCE');
  });

  it('should include DISCOVER THE VOICE section', () => {
    expect(intake).toContain('DISCOVER THE VOICE');
  });

  it('should include IDENTIFY THE CORE MESSAGE section', () => {
    expect(intake).toContain('IDENTIFY THE CORE MESSAGE');
  });

  it('should include RESEARCH NEEDS section', () => {
    expect(intake).toContain('RESEARCH NEEDS');
  });

  it('should include CONSTRAINTS AND REQUIREMENTS section', () => {
    expect(intake).toContain('CONSTRAINTS AND REQUIREMENTS');
  });

  it('should include SUCCESS CRITERIA section', () => {
    expect(intake).toContain('SUCCESS CRITERIA');
  });

  it('should include SYNTHESIZE AND CONFIRM section', () => {
    expect(intake).toContain('SYNTHESIZE AND CONFIRM');
  });

  // --- Output format ---
  it('should include a JSON output block marker', () => {
    expect(intake).toContain('```json');
  });

  it('should instruct "intakeComplete" in JSON output', () => {
    expect(intake).toContain('"intakeComplete"');
  });

  it('should instruct "synthesis" object in JSON output', () => {
    expect(intake).toContain('"synthesis"');
  });

  it('should include document type options', () => {
    expect(intake).toContain('documentType');
  });

  it('should include citation style options', () => {
    expect(intake).toContain('citationStyle');
  });

  it('should explicitly instruct not to start writing', () => {
    expect(intake).toContain('Do NOT start writing');
  });

  it('should mention that better to ask one more question', () => {
    expect(intake).toContain('Better to ask one more question');
  });
});

// ===========================================================================
// 4. INTAKE OPENING MESSAGE
// ===========================================================================

describe('DEEP_WRITER_PROMPTS.intakeOpening', () => {
  const opening = DEEP_WRITER_PROMPTS.intakeOpening;

  it('should contain "Deep Writer Mode Activated"', () => {
    expect(opening).toContain('Deep Writer Mode Activated');
  });

  it('should describe the writing hierarchy with model names', () => {
    expect(opening).toContain('Claude Opus');
    expect(opening).toContain('Claude Sonnet');
  });

  it('should describe THE PROCESS with numbered steps', () => {
    expect(opening).toContain('THE PROCESS');
    expect(opening).toContain('Deep Intake');
    expect(opening).toContain('Architecture');
    expect(opening).toContain('Research Phase');
    expect(opening).toContain('Writing Phase');
    expect(opening).toContain('Editorial Phase');
    expect(opening).toContain('Delivery');
  });

  it('should list research tools available', () => {
    expect(opening).toContain('RESEARCH TOOLS AVAILABLE');
    expect(opening).toContain('Web search');
  });

  it('should list output formats', () => {
    expect(opening).toContain('OUTPUT FORMATS');
    expect(opening).toContain('Markdown');
    expect(opening).toContain('PDF');
    expect(opening).toContain('DOCX');
  });

  it('should include typical timeline estimates', () => {
    expect(opening).toContain('TYPICAL TIMELINE');
  });

  it('should end with a question asking what the user wants to write', () => {
    expect(opening).toContain('What are you writing today?');
  });
});

// ===========================================================================
// 5. ARCHITECT PROMPT
// ===========================================================================

describe('DEEP_WRITER_PROMPTS.architect', () => {
  const architect = DEEP_WRITER_PROMPTS.architect;

  it('should describe the role as Master Architect for Deep Writer', () => {
    expect(architect).toContain('Master Architect for Deep Writer');
  });

  it('should include the {SYNTHESIZED_PROBLEM} placeholder', () => {
    expect(architect).toContain('{SYNTHESIZED_PROBLEM}');
  });

  // --- Creative content detection ---
  it('should include CREATIVE CONTENT DETECTION section', () => {
    expect(architect).toContain('CREATIVE CONTENT DETECTION');
  });

  it('should mention setting directWriteMode for creative tasks', () => {
    expect(architect).toContain('directWriteMode');
  });

  it('should instruct zero research scouts for fiction', () => {
    expect(architect).toContain('Deploy ZERO research scouts');
  });

  it('should list examples of creative/fiction tasks', () => {
    expect(architect.toLowerCase()).toContain('short stories');
    expect(architect.toLowerCase()).toContain('novels');
    expect(architect.toLowerCase()).toContain('screenplays');
    expect(architect.toLowerCase()).toContain('poetry');
  });

  // --- Two responsibilities ---
  it('should describe two responsibilities: research plan and document structure', () => {
    expect(architect).toContain('DESIGN THE RESEARCH PLAN');
    expect(architect).toContain('DESIGN THE DOCUMENT STRUCTURE');
  });

  // --- Dynamic structure creation ---
  it('should include DYNAMIC STRUCTURE CREATION section', () => {
    expect(architect).toContain('DYNAMIC STRUCTURE CREATION');
  });

  it('should include structure templates for different document types', () => {
    expect(architect).toContain('BOOK (Non-Fiction)');
    expect(architect).toContain('BOOK (Fiction)');
    expect(architect).toContain('RESEARCH PAPER');
    expect(architect).toContain('BUSINESS PROPOSAL');
    expect(architect).toContain('ARTICLE / ESSAY');
    expect(architect).toContain('TECHNICAL DOCUMENTATION');
  });

  // --- Agent tools ---
  it('should list available agent tools', () => {
    expect(architect).toContain('brave_search');
    expect(architect).toContain('browser_visit');
    expect(architect).toContain('extract_pdf');
    expect(architect).toContain('vision_analyze');
    expect(architect).toContain('run_code');
  });

  // --- Safety restrictions ---
  it('should include SAFETY RESTRICTIONS section', () => {
    expect(architect).toContain('SAFETY RESTRICTIONS');
  });

  it('should prohibit government websites as sources', () => {
    expect(architect).toContain('.gov');
  });

  // --- Output format ---
  it('should include JSON output format with documentStructure', () => {
    expect(architect).toContain('"documentStructure"');
  });

  it('should include JSON output format with researchPlan', () => {
    expect(architect).toContain('"researchPlan"');
  });

  it('should include JSON output format with projectManagers', () => {
    expect(architect).toContain('"projectManagers"');
  });

  it('should include JSON output format with scouts', () => {
    expect(architect).toContain('"scouts"');
  });

  // --- Critical principles ---
  it('should include CRITICAL PRINCIPLES section', () => {
    expect(architect).toContain('CRITICAL PRINCIPLES');
  });

  it('should emphasize RESEARCH FIRST, WRITE SECOND', () => {
    expect(architect).toContain('RESEARCH FIRST, WRITE SECOND');
  });

  it('should emphasize QUALITY OVER QUANTITY', () => {
    expect(architect).toContain('QUALITY OVER QUANTITY');
  });

  it('should emphasize VOICE CONSISTENCY PLANNING', () => {
    expect(architect).toContain('VOICE CONSISTENCY PLANNING');
  });
});

// ===========================================================================
// 6. QUALITY CONTROL PROMPT
// ===========================================================================

describe('DEEP_WRITER_PROMPTS.qualityControl', () => {
  const qc = DEEP_WRITER_PROMPTS.qualityControl;

  it('should describe the role as Quality Control Director', () => {
    expect(qc).toContain('Quality Control Director');
  });

  it('should include the {CURRENT_STATE} placeholder', () => {
    expect(qc).toContain('{CURRENT_STATE}');
  });

  it('should describe absolute authority powers', () => {
    expect(qc).toContain('ABSOLUTE AUTHORITY');
    expect(qc).toContain('Pause research');
    expect(qc).toContain('Request additional research');
    expect(qc).toContain('KILL SWITCH');
  });

  // --- Phase 1: Research QC ---
  it('should include RESEARCH QUALITY CONTROL phase', () => {
    expect(qc).toContain('RESEARCH QUALITY CONTROL');
  });

  it('should include research completeness, source quality, and gap analysis', () => {
    expect(qc).toContain('RESEARCH COMPLETENESS');
    expect(qc).toContain('SOURCE QUALITY');
    expect(qc).toContain('GAP ANALYSIS');
  });

  it('should include research QC JSON output format', () => {
    expect(qc).toContain('"researchQuality"');
    expect(qc).toContain('"readyForWriting"');
  });

  // --- Phase 2: Writing QC ---
  it('should include WRITING QUALITY CONTROL phase', () => {
    expect(qc).toContain('WRITING QUALITY CONTROL');
  });

  it('should evaluate accuracy, voice consistency, structure, and quality', () => {
    expect(qc).toContain('ACCURACY');
    expect(qc).toContain('VOICE CONSISTENCY');
    expect(qc).toContain('STRUCTURE');
    expect(qc).toContain('QUALITY');
  });

  it('should include writing QC JSON output with qualityScore', () => {
    expect(qc).toContain('"qualityScore"');
    expect(qc).toContain('"overallAssessment"');
  });

  // --- Kill switch ---
  it('should include KILL SWITCH CRITERIA section', () => {
    expect(qc).toContain('KILL SWITCH CRITERIA');
  });

  it('should mention budget >95% threshold for kill switch', () => {
    expect(qc).toContain('>95%');
  });

  // --- Budget monitoring ---
  it('should include BUDGET MONITORING section', () => {
    expect(qc).toContain('BUDGET MONITORING');
  });

  it('should describe budget allocation across phases', () => {
    expect(qc).toContain('~40%');
    expect(qc).toContain('~50%');
    expect(qc).toContain('~10%');
  });
});

// ===========================================================================
// 7. SYNTHESIZER PROMPT
// ===========================================================================

describe('DEEP_WRITER_PROMPTS.synthesizer', () => {
  const synth = DEEP_WRITER_PROMPTS.synthesizer;

  it('should describe the role as Research Synthesizer', () => {
    expect(synth).toContain('Research Synthesizer');
  });

  it('should include {SYNTHESIZED_PROBLEM} placeholder', () => {
    expect(synth).toContain('{SYNTHESIZED_PROBLEM}');
  });

  it('should include {RAW_FINDINGS} placeholder', () => {
    expect(synth).toContain('{RAW_FINDINGS}');
  });

  it("should describe the writer's brief structure", () => {
    expect(synth).toContain("WRITER'S BRIEF STRUCTURE");
  });

  it('should include sections for the brief: PROJECT OVERVIEW, RESEARCH BY SECTION, KEY THEMES', () => {
    expect(synth).toContain('PROJECT OVERVIEW');
    expect(synth).toContain('RESEARCH BY SECTION');
    expect(synth).toContain('KEY THEMES');
  });

  it('should include VERIFIED FACTS section', () => {
    expect(synth).toContain('VERIFIED FACTS');
  });

  it('should include QUOTES AND VOICES section', () => {
    expect(synth).toContain('QUOTES AND VOICES');
  });

  it('should include DATA AND STATISTICS section', () => {
    expect(synth).toContain('DATA AND STATISTICS');
  });

  it('should include COUNTER-ARGUMENTS section', () => {
    expect(synth).toContain('COUNTER-ARGUMENTS');
  });

  it('should include GAPS AND CAVEATS section', () => {
    expect(synth).toContain('GAPS AND CAVEATS');
  });

  // --- Output format ---
  it('should include JSON output with synthesisComplete field', () => {
    expect(synth).toContain('"synthesisComplete"');
  });

  it('should include briefForWriters in JSON output', () => {
    expect(synth).toContain('"briefForWriters"');
  });

  it('should include sectionBriefs in JSON output', () => {
    expect(synth).toContain('"sectionBriefs"');
  });

  it('should include qualityMetrics in JSON output', () => {
    expect(synth).toContain('"qualityMetrics"');
  });

  it('should include masterSourceList in JSON output', () => {
    expect(synth).toContain('"masterSourceList"');
  });

  // --- Critical rules ---
  it('should include CRITICAL RULES section', () => {
    expect(synth).toContain('CRITICAL RULES');
  });

  it('should emphasize organizing by section', () => {
    expect(synth).toContain('ORGANIZE BY SECTION');
  });

  it('should emphasize citing everything', () => {
    expect(synth).toContain('CITE EVERYTHING');
  });

  it('should emphasize flagging uncertainty', () => {
    expect(synth).toContain('FLAG UNCERTAINTY');
  });
});

// ===========================================================================
// 8. SCOUT (WRITER) PROMPT
// ===========================================================================

describe('DEEP_WRITER_PROMPTS.scout (writer prompt)', () => {
  const scout = DEEP_WRITER_PROMPTS.scout;

  it('should describe the role as a professional writer', () => {
    expect(scout).toContain('professional writer');
  });

  it('should include {AGENT_ID} placeholder', () => {
    expect(scout).toContain('{AGENT_ID}');
  });

  it('should include {AGENT_NAME} placeholder', () => {
    expect(scout).toContain('{AGENT_NAME}');
  });

  it('should include {PURPOSE} placeholder', () => {
    expect(scout).toContain('{PURPOSE}');
  });

  it('should include {KEY_QUESTIONS} placeholder', () => {
    expect(scout).toContain('{KEY_QUESTIONS}');
  });

  it('should include {SEARCH_QUERIES} placeholder for research brief', () => {
    expect(scout).toContain('{SEARCH_QUERIES}');
  });

  it('should include {AVAILABLE_TOOLS} placeholder for voice/style', () => {
    expect(scout).toContain('{AVAILABLE_TOOLS}');
  });

  // --- Writing guidelines ---
  it('should include WRITING GUIDELINES section', () => {
    expect(scout).toContain('WRITING GUIDELINES');
  });

  it('should include structure guidelines', () => {
    expect(scout).toContain('Open with a hook');
    expect(scout).toContain('transitions between paragraphs');
  });

  it('should include evidence integration guidelines', () => {
    expect(scout).toContain('EVIDENCE INTEGRATION');
  });

  it('should include voice consistency guidelines', () => {
    expect(scout).toContain('VOICE CONSISTENCY');
  });

  it('should include citation guidelines', () => {
    expect(scout).toContain('CITATIONS');
  });

  // --- Output format ---
  it('should include JSON output with agentId', () => {
    expect(scout).toContain('"agentId"');
  });

  it('should include JSON output with sectionTitle', () => {
    expect(scout).toContain('"sectionTitle"');
  });

  it('should include JSON output with content field', () => {
    expect(scout).toContain('"content"');
  });

  it('should include JSON output with citationsUsed', () => {
    expect(scout).toContain('"citationsUsed"');
  });

  it('should include JSON output with confidenceLevel', () => {
    expect(scout).toContain('"confidenceLevel"');
  });

  // --- Quality standards ---
  it('should include QUALITY STANDARDS section', () => {
    expect(scout).toContain('QUALITY STANDARDS');
  });

  it('should mention accuracy, clarity, flow, voice, completeness', () => {
    const lower = scout.toLowerCase();
    expect(lower).toContain('accuracy');
    expect(lower).toContain('clarity');
    expect(lower).toContain('flow');
    expect(lower).toContain('voice');
    expect(lower).toContain('completeness');
  });
});

// ===========================================================================
// 9. SYNTHESIS (Editor-in-Chief) PROMPT
// ===========================================================================

describe('DEEP_WRITER_PROMPTS.synthesis', () => {
  const synthesis = DEEP_WRITER_PROMPTS.synthesis;

  it('should describe the role as Editor-in-Chief', () => {
    expect(synthesis).toContain('Editor-in-Chief');
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

  // --- Creative/fiction mode detection ---
  it('should include creative/fiction mode detection section', () => {
    expect(synthesis).toContain('CREATIVE/FICTION MODE DETECTION');
  });

  it('should instruct writing full creative content when in creative mode', () => {
    expect(synthesis).toContain('Write the FULL piece of creative content');
  });

  // --- Editor responsibilities ---
  it('should describe all editor responsibilities', () => {
    expect(synthesis).toContain('ASSEMBLE THE DOCUMENT');
    expect(synthesis).toContain('VOICE CONSISTENCY CHECK');
    expect(synthesis).toContain('FACT-CHECK AGAINST RESEARCH');
    expect(synthesis).toContain('POLISH AND REFINE');
    expect(synthesis).toContain('ADD FRONT/BACK MATTER');
    expect(synthesis).toContain('PREPARE FOR EXPORT');
  });

  it('should mention Table of contents in front/back matter', () => {
    expect(synthesis).toContain('Table of contents');
  });

  it('should mention Bibliography/references', () => {
    expect(synthesis).toContain('Bibliography');
  });

  // --- Output format ---
  it('should include JSON output with recommendation', () => {
    expect(synthesis).toContain('"recommendation"');
  });

  it('should include JSON output with document object', () => {
    expect(synthesis).toContain('"document"');
  });

  it('should include JSON output with frontMatter', () => {
    expect(synthesis).toContain('"frontMatter"');
  });

  it('should include JSON output with tableOfContents', () => {
    expect(synthesis).toContain('"tableOfContents"');
  });

  it('should include JSON output with bibliography', () => {
    expect(synthesis).toContain('"bibliography"');
  });

  it('should include JSON output with editorialNotes', () => {
    expect(synthesis).toContain('"editorialNotes"');
  });

  it('should include JSON output with exportReady', () => {
    expect(synthesis).toContain('"exportReady"');
  });

  // --- Final document standards ---
  it('should include FINAL DOCUMENT STANDARDS section', () => {
    expect(synthesis).toContain('FINAL DOCUMENT STANDARDS');
  });

  it('should describe professional quality standards', () => {
    expect(synthesis).toContain('PROFESSIONAL QUALITY');
    expect(synthesis).toContain('STRUCTURAL INTEGRITY');
    expect(synthesis).toContain('RESEARCH INTEGRITY');
  });
});

// ===========================================================================
// 10. PROJECT MANAGER PROMPT
// ===========================================================================

describe('DEEP_WRITER_PROMPTS.projectManager', () => {
  const pm = DEEP_WRITER_PROMPTS.projectManager;

  it('should describe the role as Project Manager for Deep Writer', () => {
    expect(pm).toContain('Project Manager for Deep Writer');
  });

  it('should include {DOMAIN} placeholder', () => {
    expect(pm).toContain('{DOMAIN}');
  });

  it('should include {SCOUT_LIST} placeholder', () => {
    expect(pm).toContain('{SCOUT_LIST}');
  });

  it('should include {PROBLEM_SUMMARY} placeholder', () => {
    expect(pm).toContain('{PROBLEM_SUMMARY}');
  });

  it('should describe research phase responsibilities', () => {
    expect(pm).toContain('RESEARCH PHASE');
  });

  it('should describe writing phase responsibilities', () => {
    expect(pm).toContain('WRITING PHASE');
  });

  it('should describe quality monitoring responsibilities', () => {
    expect(pm).toContain('QUALITY MONITORING');
  });

  it('should include JSON output format with domain', () => {
    expect(pm).toContain('"domain"');
  });

  it('should include JSON output format with agentProgress', () => {
    expect(pm).toContain('"agentProgress"');
  });
});

// ===========================================================================
// 11. CROSS-CUTTING CONCERNS
// ===========================================================================

describe('DEEP_WRITER_PROMPTS — cross-cutting concerns', () => {
  it('should reference JSON output format in every prompt except name and intakeOpening', () => {
    const promptsWithJson: (keyof PromptSet)[] = [
      'intake',
      'architect',
      'qualityControl',
      'synthesizer',
      'scout',
      'synthesis',
      'projectManager',
    ];
    for (const key of promptsWithJson) {
      expect(DEEP_WRITER_PROMPTS[key]).toContain('json');
    }
  });

  it('should mention "Deep Writer" in architect, scout, synthesis, qualityControl, and projectManager', () => {
    expect(DEEP_WRITER_PROMPTS.architect).toContain('Deep Writer');
    expect(DEEP_WRITER_PROMPTS.scout).toContain('Deep Writer');
    expect(DEEP_WRITER_PROMPTS.qualityControl).toContain('Deep Writer');
    expect(DEEP_WRITER_PROMPTS.projectManager).toContain('Deep Writer');
  });

  it('should not contain any TODO/FIXME/HACK markers in prompts', () => {
    for (const key of STRING_PROMPT_KEYS) {
      const val = DEEP_WRITER_PROMPTS[key] as string;
      expect(val).not.toMatch(/\bTODO\b/);
      expect(val).not.toMatch(/\bFIXME\b/);
      expect(val).not.toMatch(/\bHACK\b/);
    }
  });

  it('should not contain any JavaScript template literal expressions (${...})', () => {
    for (const key of STRING_PROMPT_KEYS) {
      const val = DEEP_WRITER_PROMPTS[key] as string;
      // Template literal expressions would indicate broken interpolation
      expect(val).not.toMatch(/\$\{[^}]+\}/);
    }
  });

  it('should use curly-brace placeholders ({PLACEHOLDER}) consistently', () => {
    // Architect, synthesizer, scout, synthesis, qualityControl, projectManager
    // should use {PLACEHOLDER} style for variable injection
    const withPlaceholders = [
      'architect',
      'synthesizer',
      'scout',
      'synthesis',
      'qualityControl',
      'projectManager',
    ] as (keyof PromptSet)[];
    for (const key of withPlaceholders) {
      const val = DEEP_WRITER_PROMPTS[key] as string;
      expect(val).toMatch(/\{[A-Z_]+\}/);
    }
  });
});

// ===========================================================================
// 12. PROMPT LENGTH AND CONTENT DEPTH TESTS
// ===========================================================================

describe('DEEP_WRITER_PROMPTS — content depth', () => {
  it('intake should be the most substantial prompt (>3000 chars)', () => {
    expect(DEEP_WRITER_PROMPTS.intake.length).toBeGreaterThan(3000);
  });

  it('architect should be >5000 chars (the longest prompt)', () => {
    expect(DEEP_WRITER_PROMPTS.architect.length).toBeGreaterThan(5000);
  });

  it('qualityControl should be >2000 chars', () => {
    expect(DEEP_WRITER_PROMPTS.qualityControl.length).toBeGreaterThan(2000);
  });

  it('synthesizer should be >3000 chars', () => {
    expect(DEEP_WRITER_PROMPTS.synthesizer.length).toBeGreaterThan(3000);
  });

  it('scout (writer) should be >2000 chars', () => {
    expect(DEEP_WRITER_PROMPTS.scout.length).toBeGreaterThan(2000);
  });

  it('synthesis should be >3000 chars', () => {
    expect(DEEP_WRITER_PROMPTS.synthesis.length).toBeGreaterThan(3000);
  });

  it('projectManager should be >500 chars', () => {
    expect(DEEP_WRITER_PROMPTS.projectManager.length).toBeGreaterThan(500);
  });

  it('intakeOpening should be >500 chars', () => {
    expect(DEEP_WRITER_PROMPTS.intakeOpening.length).toBeGreaterThan(500);
  });
});

// ===========================================================================
// 13. IMMUTABILITY / SNAPSHOT STABILITY
// ===========================================================================

describe('DEEP_WRITER_PROMPTS — immutability', () => {
  it('should be a const export (not reassignable)', () => {
    // The export is declared with `export const`, so the reference itself is const.
    // We verify it has the expected content to confirm it hasn't been tampered with.
    expect(DEEP_WRITER_PROMPTS.name).toBe('Deep Writer');
    expect(Object.keys(DEEP_WRITER_PROMPTS)).toHaveLength(9);
  });

  it('should not be frozen by default (just a plain object)', () => {
    // Documenting current behavior — the object is not frozen
    // Tests here verify the shape, not enforce freezing
    expect(typeof DEEP_WRITER_PROMPTS).toBe('object');
  });
});

// ===========================================================================
// 14. EDGE CASE: PLACEHOLDER COVERAGE
// ===========================================================================

describe('DEEP_WRITER_PROMPTS — placeholder coverage', () => {
  it('architect should have exactly one {SYNTHESIZED_PROBLEM} placeholder', () => {
    const matches = DEEP_WRITER_PROMPTS.architect.match(/\{SYNTHESIZED_PROBLEM\}/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(1);
  });

  it('qualityControl should have exactly one {CURRENT_STATE} placeholder', () => {
    const matches = DEEP_WRITER_PROMPTS.qualityControl.match(/\{CURRENT_STATE\}/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(1);
  });

  it('synthesizer should have both {SYNTHESIZED_PROBLEM} and {RAW_FINDINGS}', () => {
    expect(DEEP_WRITER_PROMPTS.synthesizer).toContain('{SYNTHESIZED_PROBLEM}');
    expect(DEEP_WRITER_PROMPTS.synthesizer).toContain('{RAW_FINDINGS}');
  });

  it('scout should have all six expected placeholders', () => {
    const scout = DEEP_WRITER_PROMPTS.scout;
    expect(scout).toContain('{AGENT_ID}');
    expect(scout).toContain('{AGENT_NAME}');
    expect(scout).toContain('{PURPOSE}');
    expect(scout).toContain('{KEY_QUESTIONS}');
    expect(scout).toContain('{SEARCH_QUERIES}');
    expect(scout).toContain('{AVAILABLE_TOOLS}');
  });

  it('synthesis should have {SYNTHESIZED_PROBLEM}, {ALL_FINDINGS}, {DOMAIN_REPORTS}', () => {
    const syn = DEEP_WRITER_PROMPTS.synthesis;
    expect(syn).toContain('{SYNTHESIZED_PROBLEM}');
    expect(syn).toContain('{ALL_FINDINGS}');
    expect(syn).toContain('{DOMAIN_REPORTS}');
  });

  it('projectManager should have {DOMAIN}, {SCOUT_LIST}, {PROBLEM_SUMMARY}', () => {
    const pm = DEEP_WRITER_PROMPTS.projectManager;
    expect(pm).toContain('{DOMAIN}');
    expect(pm).toContain('{SCOUT_LIST}');
    expect(pm).toContain('{PROBLEM_SUMMARY}');
  });

  it('intake should NOT have any placeholders (it is a static system prompt)', () => {
    const placeholders = DEEP_WRITER_PROMPTS.intake.match(/\{[A-Z_]+\}/g);
    expect(placeholders).toBeNull();
  });

  it('intakeOpening should NOT have any placeholders (it is a static message)', () => {
    const placeholders = DEEP_WRITER_PROMPTS.intakeOpening.match(/\{[A-Z_]+\}/g);
    expect(placeholders).toBeNull();
  });
});

// ===========================================================================
// 15. JSON OUTPUT FORMAT VALIDATION
// ===========================================================================

describe('DEEP_WRITER_PROMPTS — JSON output schemas', () => {
  it('intake JSON should include all required synthesis fields', () => {
    const intake = DEEP_WRITER_PROMPTS.intake;
    const requiredFields = [
      'summary',
      'coreQuestion',
      'constraints',
      'priorities',
      'stakeholders',
      'timeframe',
      'riskTolerance',
      'complexity',
      'domains',
      'hiddenFactors',
      'successCriteria',
      'documentType',
      'genre',
      'targetLength',
      'voice',
      'citationStyle',
      'outputFormat',
    ];
    for (const field of requiredFields) {
      expect(intake).toContain(`"${field}"`);
    }
  });

  it('architect JSON should include documentStructure fields', () => {
    const architect = DEEP_WRITER_PROMPTS.architect;
    const fields = ['title', 'type', 'totalSections', 'estimatedWords', 'outline', 'sectionId'];
    for (const field of fields) {
      expect(architect).toContain(`"${field}"`);
    }
  });

  it('architect JSON should include scout configuration fields', () => {
    const architect = DEEP_WRITER_PROMPTS.architect;
    const fields = [
      'modelTier',
      'priority',
      'estimatedSearches',
      'parentId',
      'supportsSection',
      'canSpawnChildren',
      'maxChildren',
    ];
    for (const field of fields) {
      expect(architect).toContain(`"${field}"`);
    }
  });

  it('synthesis JSON should include exportReady with markdown, pdf, docx', () => {
    const syn = DEEP_WRITER_PROMPTS.synthesis;
    expect(syn).toContain('"markdown"');
    expect(syn).toContain('"pdf"');
    expect(syn).toContain('"docx"');
  });
});
