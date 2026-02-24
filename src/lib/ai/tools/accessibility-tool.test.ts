import { describe, it, expect } from 'vitest';

import {
  accessibilityTool,
  isAccessibilityAvailable,
  executeAccessibility,
} from './accessibility-tool';

// ============================================================================
// TOOL DEFINITION
// ============================================================================

describe('accessibilityTool definition', () => {
  it('should have correct name', () => {
    expect(accessibilityTool.name).toBe('check_accessibility');
  });

  it('should have a description', () => {
    expect(accessibilityTool.description.length).toBeGreaterThan(0);
  });

  it('should have parameters schema', () => {
    expect(accessibilityTool.parameters).toBeDefined();
    expect(accessibilityTool.parameters.type).toBe('object');
  });

  it('should require operation parameter', () => {
    expect(accessibilityTool.parameters.required).toContain('operation');
  });
});

describe('isAccessibilityAvailable', () => {
  it('should return true', () => {
    expect(isAccessibilityAvailable()).toBe(true);
  });
});

// ============================================================================
// CHECK OPERATION - IMAGES
// ============================================================================

describe('executeAccessibility - check operation', () => {
  it('should detect missing alt text on images', async () => {
    const result = await executeAccessibility({
      id: 'test-1',
      name: 'check_accessibility',
      arguments: { operation: 'check', html: '<img src="photo.jpg">' },
    });
    const data = JSON.parse(result.content);
    expect(data.summary.critical).toBeGreaterThan(0);
    const altIssue = data.issues.find((i: { type: string }) => i.type === 'missing-alt');
    expect(altIssue).toBeDefined();
    expect(altIssue.severity).toBe('critical');
  });

  it('should flag empty alt text for review', async () => {
    const result = await executeAccessibility({
      id: 'test-2',
      name: 'check_accessibility',
      arguments: { operation: 'check', html: '<img src="photo.jpg" alt="">' },
    });
    const data = JSON.parse(result.content);
    const emptyAlt = data.issues.find((i: { type: string }) => i.type === 'empty-alt');
    expect(emptyAlt).toBeDefined();
    expect(emptyAlt.severity).toBe('minor');
  });

  it('should pass images with valid alt text', async () => {
    const result = await executeAccessibility({
      id: 'test-3',
      name: 'check_accessibility',
      arguments: { operation: 'check', html: '<img src="photo.jpg" alt="A sunset">' },
    });
    const data = JSON.parse(result.content);
    expect(data.passedChecks).toContain('All images have alt attributes');
  });

  // ============================================================================
  // CHECK OPERATION - FORM LABELS
  // ============================================================================

  it('should detect inputs without labels', async () => {
    const result = await executeAccessibility({
      id: 'test-4',
      name: 'check_accessibility',
      arguments: { operation: 'check', html: '<input type="text" id="name">' },
    });
    const data = JSON.parse(result.content);
    const labelIssue = data.issues.find((i: { type: string }) => i.type === 'missing-label');
    expect(labelIssue).toBeDefined();
    expect(labelIssue.severity).toBe('serious');
  });

  it('should pass inputs with aria-label', async () => {
    const result = await executeAccessibility({
      id: 'test-5',
      name: 'check_accessibility',
      arguments: {
        operation: 'check',
        html: '<input type="text" aria-label="Name">',
      },
    });
    const data = JSON.parse(result.content);
    expect(data.passedChecks).toContain('All form inputs have labels');
  });

  it('should pass inputs with associated label', async () => {
    const result = await executeAccessibility({
      id: 'test-6',
      name: 'check_accessibility',
      arguments: {
        operation: 'check',
        html: '<label for="name">Name</label><input type="text" id="name">',
      },
    });
    const data = JSON.parse(result.content);
    expect(data.passedChecks).toContain('All form inputs have labels');
  });

  it('should skip hidden/submit/button inputs for label check', async () => {
    const result = await executeAccessibility({
      id: 'test-7',
      name: 'check_accessibility',
      arguments: {
        operation: 'check',
        html: '<input type="submit" value="Go"><input type="hidden" name="csrf"><input type="button" value="Click">',
      },
    });
    const data = JSON.parse(result.content);
    const labelIssues = data.issues.filter((i: { type: string }) => i.type === 'missing-label');
    expect(labelIssues.length).toBe(0);
  });

  // ============================================================================
  // CHECK OPERATION - HEADING HIERARCHY
  // ============================================================================

  it('should detect skipped heading levels', async () => {
    const result = await executeAccessibility({
      id: 'test-8',
      name: 'check_accessibility',
      arguments: { operation: 'check', html: '<h1>Title</h1><h3>Subtitle</h3>' },
    });
    const data = JSON.parse(result.content);
    const skipIssue = data.issues.find((i: { type: string }) => i.type === 'heading-skip');
    expect(skipIssue).toBeDefined();
    expect(skipIssue.severity).toBe('moderate');
  });

  it('should detect document not starting with h1', async () => {
    const result = await executeAccessibility({
      id: 'test-9',
      name: 'check_accessibility',
      arguments: { operation: 'check', html: '<h2>Not an h1</h2>' },
    });
    const data = JSON.parse(result.content);
    const h1Issue = data.issues.find((i: { type: string }) => i.type === 'missing-h1');
    expect(h1Issue).toBeDefined();
  });

  it('should pass correct heading hierarchy', async () => {
    const result = await executeAccessibility({
      id: 'test-10',
      name: 'check_accessibility',
      arguments: { operation: 'check', html: '<h1>Title</h1><h2>Section</h2><h3>Sub</h3>' },
    });
    const data = JSON.parse(result.content);
    expect(data.passedChecks).toContain('Heading hierarchy is correct');
  });

  // ============================================================================
  // CHECK OPERATION - LINKS, LANG, AUTOPLAY
  // ============================================================================

  it('should detect generic link text', async () => {
    const result = await executeAccessibility({
      id: 'test-11',
      name: 'check_accessibility',
      arguments: { operation: 'check', html: '<a href="/about">click here</a>' },
    });
    const data = JSON.parse(result.content);
    const linkIssue = data.issues.find((i: { type: string }) => i.type === 'generic-link-text');
    expect(linkIssue).toBeDefined();
  });

  it('should detect autoplay media', async () => {
    const result = await executeAccessibility({
      id: 'test-12',
      name: 'check_accessibility',
      arguments: { operation: 'check', html: '<video autoplay src="video.mp4"></video>' },
    });
    const data = JSON.parse(result.content);
    const autoplay = data.issues.find((i: { type: string }) => i.type === 'autoplay-media');
    expect(autoplay).toBeDefined();
  });

  it('should detect missing lang attribute', async () => {
    const result = await executeAccessibility({
      id: 'test-13',
      name: 'check_accessibility',
      arguments: { operation: 'check', html: '<html><body>Content</body></html>' },
    });
    const data = JSON.parse(result.content);
    const langIssue = data.issues.find((i: { type: string }) => i.type === 'missing-lang');
    expect(langIssue).toBeDefined();
  });

  it('should pass html with lang attribute', async () => {
    const result = await executeAccessibility({
      id: 'test-14',
      name: 'check_accessibility',
      arguments: {
        operation: 'check',
        html: '<html lang="en"><body>Content</body></html>',
      },
    });
    const data = JSON.parse(result.content);
    expect(data.passedChecks).toContain('Language is specified');
  });

  it('should detect mouse-only event handlers', async () => {
    const result = await executeAccessibility({
      id: 'test-15',
      name: 'check_accessibility',
      arguments: { operation: 'check', html: '<div onmouseover="highlight()">Hover me</div>' },
    });
    const data = JSON.parse(result.content);
    const mouseIssue = data.issues.find((i: { type: string }) => i.type === 'mouse-only-event');
    expect(mouseIssue).toBeDefined();
  });

  it('should detect positive tabindex', async () => {
    const result = await executeAccessibility({
      id: 'test-16',
      name: 'check_accessibility',
      arguments: { operation: 'check', html: '<div tabindex="5">Focused</div>' },
    });
    const data = JSON.parse(result.content);
    const tabIssue = data.issues.find((i: { type: string }) => i.type === 'positive-tabindex');
    expect(tabIssue).toBeDefined();
  });

  it('should return no issues for clean HTML', async () => {
    const result = await executeAccessibility({
      id: 'test-17',
      name: 'check_accessibility',
      arguments: { operation: 'check', html: '<p>Simple paragraph</p>' },
    });
    const data = JSON.parse(result.content);
    expect(data.summary.totalIssues).toBe(0);
    expect(data.recommendation).toContain('No accessibility issues');
  });

  it('should error without html', async () => {
    const result = await executeAccessibility({
      id: 'test-18',
      name: 'check_accessibility',
      arguments: { operation: 'check' },
    });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('HTML content required');
  });
});

// ============================================================================
// CONTRAST OPERATION
// ============================================================================

describe('executeAccessibility - contrast operation', () => {
  it('should calculate good contrast ratio', async () => {
    const result = await executeAccessibility({
      id: 'test-20',
      name: 'check_accessibility',
      arguments: { operation: 'contrast', foreground: '#000000', background: '#ffffff' },
    });
    const data = JSON.parse(result.content);
    expect(data.contrastRatio).toBe('21.00:1');
    expect(data.wcagAA.normalText).toBe('PASS');
    expect(data.wcagAAA.normalText).toBe('PASS');
  });

  it('should detect poor contrast', async () => {
    const result = await executeAccessibility({
      id: 'test-21',
      name: 'check_accessibility',
      arguments: { operation: 'contrast', foreground: '#777777', background: '#999999' },
    });
    const data = JSON.parse(result.content);
    expect(data.wcagAA.normalText).toBe('FAIL');
  });

  it('should handle medium contrast (large text only)', async () => {
    const result = await executeAccessibility({
      id: 'test-22',
      name: 'check_accessibility',
      arguments: { operation: 'contrast', foreground: '#666666', background: '#ffffff' },
    });
    const data = JSON.parse(result.content);
    expect(data.wcagAA.largeText).toBe('PASS');
  });

  it('should error without colors', async () => {
    const result = await executeAccessibility({
      id: 'test-23',
      name: 'check_accessibility',
      arguments: { operation: 'contrast' },
    });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('Foreground and background');
  });

  it('should error with invalid hex', async () => {
    const result = await executeAccessibility({
      id: 'test-24',
      name: 'check_accessibility',
      arguments: { operation: 'contrast', foreground: 'not-hex', background: '#fff' },
    });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('Invalid color');
  });
});

// ============================================================================
// ARIA OPERATION
// ============================================================================

describe('executeAccessibility - aria operation', () => {
  it('should detect valid ARIA roles', async () => {
    const result = await executeAccessibility({
      id: 'test-30',
      name: 'check_accessibility',
      arguments: {
        operation: 'aria',
        html: '<div role="navigation"><a href="/">Home</a></div>',
      },
    });
    const data = JSON.parse(result.content);
    expect(data.rolesFound).toContain('navigation');
    expect(data.issueCount).toBe(0);
  });

  it('should detect invalid ARIA roles', async () => {
    const result = await executeAccessibility({
      id: 'test-31',
      name: 'check_accessibility',
      arguments: {
        operation: 'aria',
        html: '<div role="notarole">Content</div>',
      },
    });
    const data = JSON.parse(result.content);
    expect(data.issueCount).toBeGreaterThan(0);
    expect(data.issues[0].type).toBe('invalid-role');
  });

  it('should detect aria-hidden on focusable elements', async () => {
    const result = await executeAccessibility({
      id: 'test-32',
      name: 'check_accessibility',
      arguments: {
        operation: 'aria',
        html: '<button aria-hidden="true" tabindex="0">Click</button>',
      },
    });
    const data = JSON.parse(result.content);
    const hiddenFocusable = data.issues.find(
      (i: { type: string }) => i.type === 'hidden-focusable'
    );
    expect(hiddenFocusable).toBeDefined();
    expect(hiddenFocusable.severity).toBe('critical');
  });

  it('should count ARIA attributes', async () => {
    const result = await executeAccessibility({
      id: 'test-33',
      name: 'check_accessibility',
      arguments: {
        operation: 'aria',
        html: '<div aria-label="Main" aria-describedby="desc"><span id="desc">Desc</span></div>',
      },
    });
    const data = JSON.parse(result.content);
    expect(data.ariaAttributesFound).toBeGreaterThanOrEqual(2);
  });

  it('should error without html', async () => {
    const result = await executeAccessibility({
      id: 'test-34',
      name: 'check_accessibility',
      arguments: { operation: 'aria' },
    });
    expect(result.isError).toBe(true);
  });
});

// ============================================================================
// STRUCTURE OPERATION
// ============================================================================

describe('executeAccessibility - structure operation', () => {
  it('should extract headings', async () => {
    const result = await executeAccessibility({
      id: 'test-40',
      name: 'check_accessibility',
      arguments: {
        operation: 'structure',
        html: '<h1>Title</h1><h2>Section A</h2><h2>Section B</h2>',
      },
    });
    const data = JSON.parse(result.content);
    expect(data.headingCount).toBe(3);
    expect(data.headings[0].level).toBe(1);
    expect(data.headings[0].text).toBe('Title');
  });

  it('should detect landmarks', async () => {
    const result = await executeAccessibility({
      id: 'test-41',
      name: 'check_accessibility',
      arguments: {
        operation: 'structure',
        html: '<header>H</header><nav>N</nav><main><h1>T</h1></main><footer>F</footer>',
      },
    });
    const data = JSON.parse(result.content);
    expect(data.landmarks.header).toBe(true);
    expect(data.landmarks.nav).toBe(true);
    expect(data.landmarks.main).toBe(true);
    expect(data.landmarks.footer).toBe(true);
    expect(data.landmarkCount).toBeGreaterThanOrEqual(4);
  });

  it('should detect missing main landmark', async () => {
    const result = await executeAccessibility({
      id: 'test-42',
      name: 'check_accessibility',
      arguments: {
        operation: 'structure',
        html: '<div><h1>Title</h1></div>',
      },
    });
    const data = JSON.parse(result.content);
    expect(data.issues).toContain('Missing main landmark');
  });

  it('should detect missing navigation', async () => {
    const result = await executeAccessibility({
      id: 'test-43',
      name: 'check_accessibility',
      arguments: {
        operation: 'structure',
        html: '<main><h1>Title</h1></main>',
      },
    });
    const data = JSON.parse(result.content);
    expect(data.issues).toContain('Missing navigation landmark');
  });

  it('should detect no headings', async () => {
    const result = await executeAccessibility({
      id: 'test-44',
      name: 'check_accessibility',
      arguments: { operation: 'structure', html: '<main><p>Content</p></main>' },
    });
    const data = JSON.parse(result.content);
    expect(data.issues).toContain('No headings found');
  });

  it('should error without html', async () => {
    const result = await executeAccessibility({
      id: 'test-45',
      name: 'check_accessibility',
      arguments: { operation: 'structure' },
    });
    expect(result.isError).toBe(true);
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

describe('executeAccessibility - errors', () => {
  it('should error on unknown operation', async () => {
    const result = await executeAccessibility({
      id: 'test-50',
      name: 'check_accessibility',
      arguments: { operation: 'unknown' },
    });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('Unknown operation');
  });

  it('should handle string arguments', async () => {
    const result = await executeAccessibility({
      id: 'test-51',
      name: 'check_accessibility',
      arguments: JSON.stringify({ operation: 'check', html: '<p>Test</p>' }),
    });
    expect(result.isError).toBe(false);
  });

  it('should include toolCallId in result', async () => {
    const result = await executeAccessibility({
      id: 'my-tool-call-id',
      name: 'check_accessibility',
      arguments: { operation: 'check', html: '<p>Test</p>' },
    });
    expect(result.toolCallId).toBe('my-tool-call-id');
  });
});
