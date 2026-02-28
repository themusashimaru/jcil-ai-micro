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

import { QUICK_WRITER_PROMPTS } from '../quick-writer';
import type { PromptSet } from '../types';

// ---------------------------------------------------------------------------
// Helper: all required PromptSet keys
// ---------------------------------------------------------------------------
const REQUIRED_KEYS: (keyof PromptSet)[] = [
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
// 1. Export existence & type
// ---------------------------------------------------------------------------
describe('QUICK_WRITER_PROMPTS — export', () => {
  it('should be defined', () => {
    expect(QUICK_WRITER_PROMPTS).toBeDefined();
  });

  it('should be a plain object', () => {
    expect(typeof QUICK_WRITER_PROMPTS).toBe('object');
    expect(QUICK_WRITER_PROMPTS).not.toBeNull();
    expect(Array.isArray(QUICK_WRITER_PROMPTS)).toBe(false);
  });

  it('should satisfy the PromptSet interface (all required keys present)', () => {
    for (const key of REQUIRED_KEYS) {
      expect(QUICK_WRITER_PROMPTS).toHaveProperty(key);
    }
  });

  it('should not have extra unexpected keys beyond PromptSet fields', () => {
    const actualKeys = Object.keys(QUICK_WRITER_PROMPTS);
    for (const key of actualKeys) {
      expect(REQUIRED_KEYS).toContain(key);
    }
  });

  it('should have exactly the number of keys defined in PromptSet', () => {
    expect(Object.keys(QUICK_WRITER_PROMPTS).length).toBe(REQUIRED_KEYS.length);
  });
});

// ---------------------------------------------------------------------------
// 2. Every field is a non-empty string
// ---------------------------------------------------------------------------
describe('QUICK_WRITER_PROMPTS — all fields are non-empty strings', () => {
  for (const key of REQUIRED_KEYS) {
    it(`"${key}" should be a string`, () => {
      expect(typeof QUICK_WRITER_PROMPTS[key]).toBe('string');
    });

    it(`"${key}" should not be empty`, () => {
      expect((QUICK_WRITER_PROMPTS[key] as string).length).toBeGreaterThan(0);
    });

    it(`"${key}" should not be only whitespace`, () => {
      expect((QUICK_WRITER_PROMPTS[key] as string).trim().length).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// 3. name field
// ---------------------------------------------------------------------------
describe('QUICK_WRITER_PROMPTS.name', () => {
  it('should equal "Quick Writer"', () => {
    expect(QUICK_WRITER_PROMPTS.name).toBe('Quick Writer');
  });

  it('should be short (under 50 chars)', () => {
    expect(QUICK_WRITER_PROMPTS.name.length).toBeLessThan(50);
  });
});

// ---------------------------------------------------------------------------
// 4. intake prompt
// ---------------------------------------------------------------------------
describe('QUICK_WRITER_PROMPTS.intake', () => {
  const intake = QUICK_WRITER_PROMPTS.intake;

  it('should mention "writing assistant"', () => {
    expect(intake.toLowerCase()).toContain('writing assistant');
  });

  it('should mention "Quick Writer"', () => {
    expect(intake).toContain('Quick Writer');
  });

  it('should include ethical boundaries section', () => {
    expect(intake).toContain('ETHICAL BOUNDARIES');
  });

  it('should mention violence refusal', () => {
    expect(intake.toLowerCase()).toContain('violence');
  });

  it('should mention plagiarism refusal', () => {
    expect(intake.toLowerCase()).toContain('plagiarized');
  });

  it('should mention misinformation refusal', () => {
    expect(intake.toLowerCase()).toContain('misinformation');
  });

  it('should mention hate speech refusal', () => {
    expect(intake.toLowerCase()).toContain('hate speech');
  });

  it('should include intakeComplete JSON field', () => {
    expect(intake).toContain('"intakeComplete"');
  });

  it('should include synthesis JSON field', () => {
    expect(intake).toContain('"synthesis"');
  });

  it('should reference documentType options', () => {
    expect(intake).toContain('article');
    expect(intake).toContain('blog');
    expect(intake).toContain('email');
    expect(intake).toContain('report');
  });

  it('should reference voice options', () => {
    expect(intake).toContain('professional');
    expect(intake).toContain('casual');
    expect(intake).toContain('academic');
  });

  it('should reference citationStyle options', () => {
    expect(intake).toContain('APA');
    expect(intake).toContain('MLA');
  });

  it('should encourage speed over perfect understanding', () => {
    expect(intake.toLowerCase()).toContain('speed');
  });

  it('should instruct to avoid over-questioning', () => {
    expect(intake).toContain("DON'T OVER-QUESTION");
  });

  it('should contain JSON code block', () => {
    expect(intake).toContain('```json');
  });

  it('should have substantial length (> 500 chars)', () => {
    expect(intake.length).toBeGreaterThan(500);
  });
});

// ---------------------------------------------------------------------------
// 5. intakeOpening prompt
// ---------------------------------------------------------------------------
describe('QUICK_WRITER_PROMPTS.intakeOpening', () => {
  const opening = QUICK_WRITER_PROMPTS.intakeOpening;

  it('should mention "Quick Writer Mode"', () => {
    expect(opening).toContain('Quick Writer Mode');
  });

  it('should mention research scouts', () => {
    expect(opening).toContain('research scouts');
  });

  it('should mention Sonnet model tier', () => {
    expect(opening).toContain('Sonnet');
  });

  it('should mention Opus model tier', () => {
    expect(opening).toContain('Opus');
  });

  it('should describe turnaround time', () => {
    expect(opening).toContain('2-3 minutes');
  });

  it('should list content types it is best for', () => {
    expect(opening).toContain('Blog posts');
    expect(opening).toContain('emails');
    expect(opening).toContain('reports');
  });

  it('should end by asking the user what to write', () => {
    expect(opening).toContain('What do you want me to write?');
  });

  it('should contain markdown formatting', () => {
    expect(opening).toContain('##');
    expect(opening).toContain('**');
  });

  it('should mention 10-15 scouts', () => {
    expect(opening).toContain('10-15');
  });
});

// ---------------------------------------------------------------------------
// 6. architect prompt
// ---------------------------------------------------------------------------
describe('QUICK_WRITER_PROMPTS.architect', () => {
  const architect = QUICK_WRITER_PROMPTS.architect;

  it('should reference the {SYNTHESIZED_PROBLEM} placeholder', () => {
    expect(architect).toContain('{SYNTHESIZED_PROBLEM}');
  });

  it('should include creative content detection section', () => {
    expect(architect).toContain('CREATIVE CONTENT DETECTION');
  });

  it('should mention directWriteMode for creative tasks', () => {
    expect(architect).toContain('"directWriteMode"');
  });

  it('should specify maximum 15 scouts', () => {
    expect(architect).toContain('MAXIMUM 15 SCOUTS');
  });

  it('should specify maximum 2-3 writers', () => {
    expect(architect).toContain('MAXIMUM 2-3 WRITERS');
  });

  it('should specify budget limit of $2-3', () => {
    expect(architect).toContain('$2-3');
  });

  it('should specify time target of 2-3 minutes', () => {
    expect(architect).toContain('2-3 minutes');
  });

  it('should include documentStructure in JSON output', () => {
    expect(architect).toContain('"documentStructure"');
  });

  it('should include researchPlan in JSON output', () => {
    expect(architect).toContain('"researchPlan"');
  });

  it('should include projectManagers in JSON output', () => {
    expect(architect).toContain('"projectManagers"');
  });

  it('should include scouts in JSON output', () => {
    expect(architect).toContain('"scouts"');
  });

  it('should list available tools: brave_search, browser_visit, extract_pdf', () => {
    expect(architect).toContain('brave_search');
    expect(architect).toContain('browser_visit');
    expect(architect).toContain('extract_pdf');
  });

  it('should include vision tools', () => {
    expect(architect).toContain('vision_analyze');
    expect(architect).toContain('screenshot');
  });

  it('should mention run_code tool', () => {
    expect(architect).toContain('run_code');
  });

  it('should give creative fiction example with zero scouts', () => {
    expect(architect).toContain('ZERO scouts');
  });

  it('should give a research-based blog post example', () => {
    expect(architect).toContain('BLOG POST ABOUT AI PRODUCTIVITY TOOLS');
  });

  it('should include estimatedTotalSearches field', () => {
    expect(architect).toContain('"estimatedTotalSearches"');
  });

  it('should include estimatedCost field', () => {
    expect(architect).toContain('"estimatedCost"');
  });

  it('should list guide for when to use fewer scouts', () => {
    expect(architect).toContain('WHEN TO USE FEWER SCOUTS');
  });

  it('should contain JSON code blocks', () => {
    expect(architect).toContain('```json');
  });

  it('should be the longest prompt (over 2000 chars)', () => {
    expect(architect.length).toBeGreaterThan(2000);
  });
});

// ---------------------------------------------------------------------------
// 7. qualityControl prompt
// ---------------------------------------------------------------------------
describe('QUICK_WRITER_PROMPTS.qualityControl', () => {
  const qc = QUICK_WRITER_PROMPTS.qualityControl;

  it('should reference {CURRENT_STATE} placeholder', () => {
    expect(qc).toContain('{CURRENT_STATE}');
  });

  it('should specify budget limit of $3 max', () => {
    expect(qc).toContain('$3 max');
  });

  it('should specify time limit of 3 minutes', () => {
    expect(qc).toContain('3 minutes max');
  });

  it('should specify scout limit of 15', () => {
    expect(qc).toContain('15 max');
  });

  it('should specify writer limit of 3', () => {
    expect(qc).toContain('3 max');
  });

  it('should include status field with healthy/warning/critical', () => {
    expect(qc).toContain('"status"');
    expect(qc).toContain('healthy');
    expect(qc).toContain('warning');
    expect(qc).toContain('critical');
  });

  it('should include action field with continue/kill', () => {
    expect(qc).toContain('"action"');
    expect(qc).toContain('continue');
    expect(qc).toContain('kill');
  });

  it('should include metrics block', () => {
    expect(qc).toContain('"metrics"');
    expect(qc).toContain('"budgetUsed"');
    expect(qc).toContain('"timeElapsed"');
    expect(qc).toContain('"errorRate"');
  });

  it('should include quality scores for research and writing', () => {
    expect(qc).toContain('"researchQuality"');
    expect(qc).toContain('"writingQuality"');
  });

  it('should define kill conditions', () => {
    expect(qc).toContain('KILL ONLY IF');
    expect(qc).toContain('Budget >95%');
    expect(qc).toContain('Error rate >50%');
  });

  it('should contain JSON code block', () => {
    expect(qc).toContain('```json');
  });
});

// ---------------------------------------------------------------------------
// 8. projectManager prompt
// ---------------------------------------------------------------------------
describe('QUICK_WRITER_PROMPTS.projectManager', () => {
  const pm = QUICK_WRITER_PROMPTS.projectManager;

  it('should reference {DOMAIN} placeholder', () => {
    expect(pm).toContain('{DOMAIN}');
  });

  it('should reference {SCOUT_LIST} placeholder', () => {
    expect(pm).toContain('{SCOUT_LIST}');
  });

  it('should reference {PROBLEM_SUMMARY} placeholder', () => {
    expect(pm).toContain('{PROBLEM_SUMMARY}');
  });

  it('should include keyFindings in output format', () => {
    expect(pm).toContain('"keyFindings"');
  });

  it('should include confidence levels', () => {
    expect(pm).toContain('high');
    expect(pm).toContain('medium');
    expect(pm).toContain('low');
  });

  it('should include phase tracking (research/writing)', () => {
    expect(pm).toContain('"phase"');
    expect(pm).toContain('research');
    expect(pm).toContain('writing');
  });

  it('should contain JSON code block', () => {
    expect(pm).toContain('```json');
  });

  it('should mention efficiency', () => {
    expect(pm.toLowerCase()).toContain('efficiency');
  });
});

// ---------------------------------------------------------------------------
// 9. scout prompt
// ---------------------------------------------------------------------------
describe('QUICK_WRITER_PROMPTS.scout', () => {
  const scout = QUICK_WRITER_PROMPTS.scout;

  it('should reference {AGENT_NAME} placeholder', () => {
    expect(scout).toContain('{AGENT_NAME}');
  });

  it('should reference {AGENT_ROLE} placeholder', () => {
    expect(scout).toContain('{AGENT_ROLE}');
  });

  it('should reference {EXPERTISE} placeholder', () => {
    expect(scout).toContain('{EXPERTISE}');
  });

  it('should reference {PURPOSE} placeholder', () => {
    expect(scout).toContain('{PURPOSE}');
  });

  it('should reference {KEY_QUESTIONS} placeholder', () => {
    expect(scout).toContain('{KEY_QUESTIONS}');
  });

  it('should reference {SEARCH_QUERIES} placeholder', () => {
    expect(scout).toContain('{SEARCH_QUERIES}');
  });

  it('should reference {AVAILABLE_TOOLS} placeholder', () => {
    expect(scout).toContain('{AVAILABLE_TOOLS}');
  });

  it('should instruct to use brave_search first', () => {
    expect(scout).toContain('brave_search');
  });

  it('should instruct to use browser_visit for deep research', () => {
    expect(scout).toContain('browser_visit');
  });

  it('should mention extract_table for data extraction', () => {
    expect(scout).toContain('extract_table');
  });

  it('should mention vision_analyze for visual data', () => {
    expect(scout).toContain('vision_analyze');
  });

  it('should mention extract_pdf for research papers', () => {
    expect(scout).toContain('extract_pdf');
  });

  it('should mention run_code for calculations', () => {
    expect(scout).toContain('run_code');
  });

  it('should specify 3-8 searches per scout', () => {
    expect(scout).toContain('3-8');
  });

  it('should include safety rules about login forms', () => {
    expect(scout).toContain('NEVER fill login/payment forms');
  });

  it('should include findings output format', () => {
    expect(scout).toContain('"findings"');
    expect(scout).toContain('"agentId"');
  });

  it('should include finding types: fact, statistic, quote, example, trend', () => {
    expect(scout).toContain('fact');
    expect(scout).toContain('statistic');
    expect(scout).toContain('quote');
    expect(scout).toContain('example');
    expect(scout).toContain('trend');
  });

  it('should include confidence levels in output', () => {
    expect(scout).toContain('"confidence"');
  });

  it('should include sources array in output', () => {
    expect(scout).toContain('"sources"');
  });

  it('should include gaps field in output', () => {
    expect(scout).toContain('"gaps"');
  });

  it('should emphasize citable/specific data', () => {
    expect(scout).toContain('CITABLE');
    expect(scout).toContain('SPECIFIC');
  });

  it('should contain JSON code block', () => {
    expect(scout).toContain('```json');
  });
});

// ---------------------------------------------------------------------------
// 10. synthesizer prompt
// ---------------------------------------------------------------------------
describe('QUICK_WRITER_PROMPTS.synthesizer', () => {
  const synth = QUICK_WRITER_PROMPTS.synthesizer;

  it('should reference {SYNTHESIZED_PROBLEM} placeholder', () => {
    expect(synth).toContain('{SYNTHESIZED_PROBLEM}');
  });

  it('should reference {RAW_FINDINGS} placeholder', () => {
    expect(synth).toContain('{RAW_FINDINGS}');
  });

  it('should include briefForWriters in output', () => {
    expect(synth).toContain('"briefForWriters"');
  });

  it('should include projectSummary in output', () => {
    expect(synth).toContain('"projectSummary"');
  });

  it('should include sectionBriefs in output', () => {
    expect(synth).toContain('"sectionBriefs"');
  });

  it('should include bestQuotes in output', () => {
    expect(synth).toContain('"bestQuotes"');
  });

  it('should include keyStats in output', () => {
    expect(synth).toContain('"keyStats"');
  });

  it('should include qualityMetrics in output', () => {
    expect(synth).toContain('"qualityMetrics"');
  });

  it('should include synthesisComplete flag', () => {
    expect(synth).toContain('"synthesisComplete"');
  });

  it('should include gaps field', () => {
    expect(synth).toContain('"gaps"');
  });

  it('should mention deduplication step', () => {
    expect(synth.toLowerCase()).toContain('deduplicate');
  });

  it('should prioritize speed over perfection', () => {
    expect(synth).toContain('Speed over perfection');
  });

  it('should contain JSON code block', () => {
    expect(synth).toContain('```json');
  });
});

// ---------------------------------------------------------------------------
// 11. synthesis (final) prompt
// ---------------------------------------------------------------------------
describe('QUICK_WRITER_PROMPTS.synthesis', () => {
  const synth = QUICK_WRITER_PROMPTS.synthesis;

  it('should reference {SYNTHESIZED_PROBLEM} placeholder', () => {
    expect(synth).toContain('{SYNTHESIZED_PROBLEM}');
  });

  it('should reference {ALL_FINDINGS} placeholder', () => {
    expect(synth).toContain('{ALL_FINDINGS}');
  });

  it('should reference {DOMAIN_REPORTS} placeholder', () => {
    expect(synth).toContain('{DOMAIN_REPORTS}');
  });

  it('should include creative/fiction mode detection', () => {
    expect(synth).toContain('CREATIVE/FICTION MODE DETECTION');
  });

  it('should include recommendation object in output', () => {
    expect(synth).toContain('"recommendation"');
  });

  it('should include document object in output', () => {
    expect(synth).toContain('"document"');
  });

  it('should include editorialNotes in output', () => {
    expect(synth).toContain('"editorialNotes"');
  });

  it('should include exportReady formats', () => {
    expect(synth).toContain('"exportReady"');
    expect(synth).toContain('"markdown"');
    expect(synth).toContain('"pdf"');
    expect(synth).toContain('"docx"');
  });

  it('should include confidence as a numeric field', () => {
    expect(synth).toContain('"confidence"');
  });

  it('should include wordCount field', () => {
    expect(synth).toContain('"wordCount"');
  });

  it('should include citations array', () => {
    expect(synth).toContain('"citations"');
  });

  it('should describe assembly responsibilities', () => {
    expect(synth).toContain('ASSEMBLE THE CONTENT');
    expect(synth).toContain('POLISH AND REFINE');
    expect(synth).toContain('FINAL CHECK');
  });

  it('should instruct creative mode to write from scratch', () => {
    expect(synth).toContain('YOU write the content from scratch');
  });

  it('should contain JSON code block', () => {
    expect(synth).toContain('```json');
  });
});

// ---------------------------------------------------------------------------
// 12. Cross-cutting concerns: placeholders used consistently
// ---------------------------------------------------------------------------
describe('QUICK_WRITER_PROMPTS — placeholder consistency', () => {
  it('architect and synthesis both reference {SYNTHESIZED_PROBLEM}', () => {
    expect(QUICK_WRITER_PROMPTS.architect).toContain('{SYNTHESIZED_PROBLEM}');
    expect(QUICK_WRITER_PROMPTS.synthesis).toContain('{SYNTHESIZED_PROBLEM}');
    expect(QUICK_WRITER_PROMPTS.synthesizer).toContain('{SYNTHESIZED_PROBLEM}');
  });

  it('qualityControl references {CURRENT_STATE}', () => {
    expect(QUICK_WRITER_PROMPTS.qualityControl).toContain('{CURRENT_STATE}');
  });

  it('projectManager references {DOMAIN}, {SCOUT_LIST}, {PROBLEM_SUMMARY}', () => {
    expect(QUICK_WRITER_PROMPTS.projectManager).toContain('{DOMAIN}');
    expect(QUICK_WRITER_PROMPTS.projectManager).toContain('{SCOUT_LIST}');
    expect(QUICK_WRITER_PROMPTS.projectManager).toContain('{PROBLEM_SUMMARY}');
  });

  it('scout references all agent identity placeholders', () => {
    expect(QUICK_WRITER_PROMPTS.scout).toContain('{AGENT_NAME}');
    expect(QUICK_WRITER_PROMPTS.scout).toContain('{AGENT_ROLE}');
    expect(QUICK_WRITER_PROMPTS.scout).toContain('{EXPERTISE}');
    expect(QUICK_WRITER_PROMPTS.scout).toContain('{PURPOSE}');
    expect(QUICK_WRITER_PROMPTS.scout).toContain('{KEY_QUESTIONS}');
    expect(QUICK_WRITER_PROMPTS.scout).toContain('{SEARCH_QUERIES}');
    expect(QUICK_WRITER_PROMPTS.scout).toContain('{AVAILABLE_TOOLS}');
  });

  it('synthesis references {ALL_FINDINGS} and {DOMAIN_REPORTS}', () => {
    expect(QUICK_WRITER_PROMPTS.synthesis).toContain('{ALL_FINDINGS}');
    expect(QUICK_WRITER_PROMPTS.synthesis).toContain('{DOMAIN_REPORTS}');
  });
});

// ---------------------------------------------------------------------------
// 13. Edge case: immutability (frozen-like behavior)
// ---------------------------------------------------------------------------
describe('QUICK_WRITER_PROMPTS — immutability expectations', () => {
  it('should not change name when read multiple times', () => {
    const first = QUICK_WRITER_PROMPTS.name;
    const second = QUICK_WRITER_PROMPTS.name;
    expect(first).toBe(second);
  });

  it('should return the same reference across accesses', () => {
    const ref1 = QUICK_WRITER_PROMPTS;
    const ref2 = QUICK_WRITER_PROMPTS;
    expect(ref1).toBe(ref2);
  });
});

// ---------------------------------------------------------------------------
// 14. Content-length sanity checks
// ---------------------------------------------------------------------------
describe('QUICK_WRITER_PROMPTS — content length sanity', () => {
  it('intake should be between 500 and 10000 chars', () => {
    expect(QUICK_WRITER_PROMPTS.intake.length).toBeGreaterThan(500);
    expect(QUICK_WRITER_PROMPTS.intake.length).toBeLessThan(10000);
  });

  it('intakeOpening should be between 100 and 3000 chars', () => {
    expect(QUICK_WRITER_PROMPTS.intakeOpening.length).toBeGreaterThan(100);
    expect(QUICK_WRITER_PROMPTS.intakeOpening.length).toBeLessThan(3000);
  });

  it('architect should be the longest prompt', () => {
    const lengths = REQUIRED_KEYS.filter((k) => k !== 'name').map(
      (k) => (QUICK_WRITER_PROMPTS[k] as string).length
    );
    const maxLen = Math.max(...lengths);
    expect(QUICK_WRITER_PROMPTS.architect.length).toBe(maxLen);
  });

  it('name should be the shortest field', () => {
    const lengths = REQUIRED_KEYS.map((k) => (QUICK_WRITER_PROMPTS[k] as string).length);
    const minLen = Math.min(...lengths);
    expect(QUICK_WRITER_PROMPTS.name.length).toBe(minLen);
  });

  it('every prompt (except name) should exceed 200 chars', () => {
    for (const key of REQUIRED_KEYS) {
      if (key === 'name') continue;
      expect(
        (QUICK_WRITER_PROMPTS[key] as string).length,
        `${key} should exceed 200 chars`
      ).toBeGreaterThan(200);
    }
  });
});

// ---------------------------------------------------------------------------
// 15. JSON code block presence in all prompts that define output formats
// ---------------------------------------------------------------------------
describe('QUICK_WRITER_PROMPTS — JSON output format blocks', () => {
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
    it(`"${key}" should contain a JSON code block`, () => {
      expect(QUICK_WRITER_PROMPTS[key]).toContain('```json');
      expect(QUICK_WRITER_PROMPTS[key]).toContain('```');
    });
  }

  it('intakeOpening should NOT contain a JSON code block (user-facing)', () => {
    expect(QUICK_WRITER_PROMPTS.intakeOpening).not.toContain('```json');
  });
});

// ---------------------------------------------------------------------------
// 16. Ethical boundaries present in intake
// ---------------------------------------------------------------------------
describe('QUICK_WRITER_PROMPTS.intake — ethical boundaries completeness', () => {
  const ethical_topics = [
    'violence',
    'terrorism',
    'fraud',
    'scam',
    'minors',
    'harassment',
    'stalking',
    'plagiarized',
    'misinformation',
    'hate speech',
    'discrimination',
    'illegal activities',
  ];

  for (const topic of ethical_topics) {
    it(`should mention "${topic}" in ethical boundaries`, () => {
      expect(QUICK_WRITER_PROMPTS.intake.toLowerCase()).toContain(topic);
    });
  }
});

// ---------------------------------------------------------------------------
// 17. Creative mode detection in architect and synthesis
// ---------------------------------------------------------------------------
describe('QUICK_WRITER_PROMPTS — creative mode references', () => {
  it('architect should list creative content types', () => {
    const arch = QUICK_WRITER_PROMPTS.architect.toLowerCase();
    expect(arch).toContain('short stories');
    expect(arch).toContain('poetry');
    expect(arch).toContain('screenplays');
    expect(arch).toContain('fiction');
  });

  it('architect should instruct zero scouts for creative tasks', () => {
    expect(QUICK_WRITER_PROMPTS.architect).toContain('Deploy ZERO research scouts');
  });

  it('architect directWriteMode should be true for creative tasks', () => {
    expect(QUICK_WRITER_PROMPTS.architect).toContain('"directWriteMode": true');
  });

  it('synthesis should detect creative/fiction mode', () => {
    expect(QUICK_WRITER_PROMPTS.synthesis).toContain('creative writing');
  });

  it('synthesis should instruct writing full creative content', () => {
    expect(QUICK_WRITER_PROMPTS.synthesis.toLowerCase()).toContain('vivid prose');
  });
});

// ---------------------------------------------------------------------------
// 18. Tool references across prompts
// ---------------------------------------------------------------------------
describe('QUICK_WRITER_PROMPTS — tool availability', () => {
  const toolNames = ['brave_search', 'browser_visit', 'extract_pdf', 'vision_analyze', 'run_code'];

  for (const tool of toolNames) {
    it(`architect should reference "${tool}"`, () => {
      expect(QUICK_WRITER_PROMPTS.architect).toContain(tool);
    });
  }

  for (const tool of toolNames) {
    it(`scout should reference "${tool}"`, () => {
      expect(QUICK_WRITER_PROMPTS.scout).toContain(tool);
    });
  }
});
