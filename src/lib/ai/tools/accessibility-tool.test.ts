import { describe, it, expect } from 'vitest';
import {
  executeAccessibility,
  isAccessibilityAvailable,
  accessibilityTool,
} from './accessibility-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'check_accessibility', arguments: args };
}

async function getResult(args: Record<string, unknown>) {
  const res = await executeAccessibility(makeCall(args));
  return JSON.parse(res.content);
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('accessibilityTool metadata', () => {
  it('should have correct name', () => {
    expect(accessibilityTool.name).toBe('check_accessibility');
  });

  it('should require operation', () => {
    expect(accessibilityTool.parameters.required).toContain('operation');
  });
});

describe('isAccessibilityAvailable', () => {
  it('should return true', () => {
    expect(isAccessibilityAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// check operation
// -------------------------------------------------------------------
describe('executeAccessibility - check', () => {
  it('should find missing alt text', async () => {
    const result = await getResult({
      operation: 'check',
      html: '<img src="test.png">',
    });
    expect(result.summary.totalIssues).toBeGreaterThan(0);
    const types = result.issues.map((i: { type: string }) => i.type);
    expect(types).toContain('missing-alt');
  });

  it('should flag empty alt text', async () => {
    const result = await getResult({
      operation: 'check',
      html: '<img src="test.png" alt="">',
    });
    const types = result.issues.map((i: { type: string }) => i.type);
    expect(types).toContain('empty-alt');
  });

  it('should pass when alt is present', async () => {
    const result = await getResult({
      operation: 'check',
      html: '<img src="test.png" alt="A test image">',
    });
    const altIssues = result.issues.filter((i: { type: string }) => i.type === 'missing-alt');
    expect(altIssues).toHaveLength(0);
  });

  it('should find missing form labels', async () => {
    const result = await getResult({
      operation: 'check',
      html: '<input type="text">',
    });
    const types = result.issues.map((i: { type: string }) => i.type);
    expect(types).toContain('missing-label');
  });

  it('should not flag hidden inputs', async () => {
    const result = await getResult({
      operation: 'check',
      html: '<input type="hidden" name="csrf">',
    });
    const labelIssues = result.issues.filter((i: { type: string }) => i.type === 'missing-label');
    expect(labelIssues).toHaveLength(0);
  });

  it('should detect heading hierarchy skip', async () => {
    const result = await getResult({
      operation: 'check',
      html: '<h1>Title</h1><h3>Skipped h2</h3>',
    });
    const types = result.issues.map((i: { type: string }) => i.type);
    expect(types).toContain('heading-skip');
  });

  it('should flag document not starting with h1', async () => {
    const result = await getResult({
      operation: 'check',
      html: '<h2>Starting with h2</h2>',
    });
    const types = result.issues.map((i: { type: string }) => i.type);
    expect(types).toContain('missing-h1');
  });

  it('should flag generic link text', async () => {
    const result = await getResult({
      operation: 'check',
      html: '<a href="/page">click here</a>',
    });
    const types = result.issues.map((i: { type: string }) => i.type);
    expect(types).toContain('generic-link-text');
  });

  it('should flag autoplay media', async () => {
    const result = await getResult({
      operation: 'check',
      html: '<video autoplay src="video.mp4"></video>',
    });
    const types = result.issues.map((i: { type: string }) => i.type);
    expect(types).toContain('autoplay-media');
  });

  it('should flag missing lang attribute', async () => {
    const result = await getResult({
      operation: 'check',
      html: '<html><body>No lang</body></html>',
    });
    const types = result.issues.map((i: { type: string }) => i.type);
    expect(types).toContain('missing-lang');
  });

  it('should flag positive tabindex', async () => {
    const result = await getResult({
      operation: 'check',
      html: '<div tabindex="5">Bad tabindex</div>',
    });
    const types = result.issues.map((i: { type: string }) => i.type);
    expect(types).toContain('positive-tabindex');
  });

  it('should error without html', async () => {
    const res = await executeAccessibility(makeCall({ operation: 'check' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// contrast operation
// -------------------------------------------------------------------
describe('executeAccessibility - contrast', () => {
  it('should pass high contrast (black on white)', async () => {
    const result = await getResult({
      operation: 'contrast',
      foreground: '#000000',
      background: '#ffffff',
    });
    expect(result.wcagAA.normalText).toBe('PASS');
    expect(result.wcagAAA.normalText).toBe('PASS');
    expect(result.contrastRatio).toBe('21.00:1');
  });

  it('should fail low contrast (gray on white)', async () => {
    const result = await getResult({
      operation: 'contrast',
      foreground: '#cccccc',
      background: '#ffffff',
    });
    expect(result.wcagAA.normalText).toBe('FAIL');
  });

  it('should error without both colors', async () => {
    const res = await executeAccessibility(
      makeCall({ operation: 'contrast', foreground: '#000000' })
    );
    expect(res.isError).toBe(true);
  });

  it('should error with invalid color format', async () => {
    const res = await executeAccessibility(
      makeCall({ operation: 'contrast', foreground: 'red', background: 'blue' })
    );
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// aria operation
// -------------------------------------------------------------------
describe('executeAccessibility - aria', () => {
  it('should validate valid ARIA roles', async () => {
    const result = await getResult({
      operation: 'aria',
      html: '<nav role="navigation"><button role="button">Click</button></nav>',
    });
    expect(result.rolesFound).toContain('navigation');
    expect(result.rolesFound).toContain('button');
    expect(result.issueCount).toBe(0);
  });

  it('should flag invalid ARIA roles', async () => {
    const result = await getResult({
      operation: 'aria',
      html: '<div role="foobar">Invalid</div>',
    });
    expect(result.issueCount).toBeGreaterThan(0);
    expect(result.issues[0].type).toBe('invalid-role');
  });

  it('should count ARIA attributes', async () => {
    const result = await getResult({
      operation: 'aria',
      html: '<div aria-label="test" aria-hidden="false">Content</div>',
    });
    expect(result.ariaAttributesFound).toBe(2);
  });
});

// -------------------------------------------------------------------
// structure operation
// -------------------------------------------------------------------
describe('executeAccessibility - structure', () => {
  it('should detect landmarks', async () => {
    const result = await getResult({
      operation: 'structure',
      html: '<header>H</header><nav>N</nav><main>M</main><footer>F</footer>',
    });
    expect(result.landmarks.header).toBe(true);
    expect(result.landmarks.nav).toBe(true);
    expect(result.landmarks.main).toBe(true);
    expect(result.landmarks.footer).toBe(true);
    expect(result.landmarkCount).toBe(4);
  });

  it('should detect missing landmarks', async () => {
    const result = await getResult({
      operation: 'structure',
      html: '<div>No landmarks</div>',
    });
    expect(result.landmarks.main).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('should extract headings', async () => {
    const result = await getResult({
      operation: 'structure',
      html: '<h1>Title</h1><h2>Section</h2><h3>Subsection</h3>',
    });
    expect(result.headingCount).toBe(3);
    expect(result.headings[0].level).toBe(1);
    expect(result.headings[0].text).toBe('Title');
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeAccessibility - errors', () => {
  it('should return error for unknown operation', async () => {
    const res = await executeAccessibility(makeCall({ operation: 'unknown' }));
    expect(res.isError).toBe(true);
  });

  it('should return toolCallId', async () => {
    const res = await executeAccessibility({
      id: 'my-id',
      name: 'check_accessibility',
      arguments: { operation: 'check', html: '<p>Test</p>' },
    });
    expect(res.toolCallId).toBe('my-id');
  });
});
