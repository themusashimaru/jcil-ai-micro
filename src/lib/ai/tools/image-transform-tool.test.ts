// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  executeImageTransform,
  isImageTransformAvailable,
  imageTransformTool,
} from './image-transform-tool';

// Create a tiny 4x4 red PNG for testing (generated via sharp)
let testImageBase64: string;

async function createTestImage(): Promise<string> {
  if (testImageBase64) return testImageBase64;
  const sharp = (await import('sharp')).default;
  const buf = await sharp({
    create: { width: 20, height: 20, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
  testImageBase64 = buf.toString('base64');
  return testImageBase64;
}

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'transform_image', arguments: args };
}

async function getResult(args: Record<string, unknown>) {
  const res = await executeImageTransform(makeCall(args));
  return JSON.parse(res.content);
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('imageTransformTool metadata', () => {
  it('should have correct name', () => {
    expect(imageTransformTool.name).toBe('transform_image');
  });

  it('should require operations', () => {
    expect(imageTransformTool.parameters.required).toContain('operations');
  });
});

describe('isImageTransformAvailable', () => {
  it('should return true (sharp installed)', async () => {
    expect(await isImageTransformAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// resize operation
// -------------------------------------------------------------------
describe('executeImageTransform - resize', () => {
  it('should resize image', async () => {
    const base64 = await createTestImage();
    const result = await getResult({
      image_base64: base64,
      operations: [{ type: 'resize', width: 10, height: 10 }],
    });
    expect(result.success).toBe(true);
    expect(result.operations).toContain('resize');
    expect(result.imageData).toBeDefined();
  });

  it('should resize width only (preserve aspect)', async () => {
    const base64 = await createTestImage();
    const result = await getResult({
      image_base64: base64,
      operations: [{ type: 'resize', width: 10 }],
    });
    expect(result.success).toBe(true);
    expect(result.dimensions).toContain('10');
  });
});

// -------------------------------------------------------------------
// grayscale operation
// -------------------------------------------------------------------
describe('executeImageTransform - grayscale', () => {
  it('should convert to grayscale', async () => {
    const base64 = await createTestImage();
    const result = await getResult({
      image_base64: base64,
      operations: [{ type: 'grayscale' }],
    });
    expect(result.success).toBe(true);
    expect(result.operations).toContain('grayscale');
  });
});

// -------------------------------------------------------------------
// blur operation
// -------------------------------------------------------------------
describe('executeImageTransform - blur', () => {
  it('should apply blur', async () => {
    const base64 = await createTestImage();
    const result = await getResult({
      image_base64: base64,
      operations: [{ type: 'blur', sigma: 2 }],
    });
    expect(result.success).toBe(true);
    expect(result.operations).toContain('blur');
  });
});

// -------------------------------------------------------------------
// sharpen operation
// -------------------------------------------------------------------
describe('executeImageTransform - sharpen', () => {
  it('should sharpen image', async () => {
    const base64 = await createTestImage();
    const result = await getResult({
      image_base64: base64,
      operations: [{ type: 'sharpen' }],
    });
    expect(result.success).toBe(true);
    expect(result.operations).toContain('sharpen');
  });
});

// -------------------------------------------------------------------
// negate / flip / flop
// -------------------------------------------------------------------
describe('executeImageTransform - effects', () => {
  it('should negate image', async () => {
    const base64 = await createTestImage();
    const result = await getResult({
      image_base64: base64,
      operations: [{ type: 'negate' }],
    });
    expect(result.success).toBe(true);
  });

  it('should flip image vertically', async () => {
    const base64 = await createTestImage();
    const result = await getResult({
      image_base64: base64,
      operations: [{ type: 'flip' }],
    });
    expect(result.success).toBe(true);
  });

  it('should flop image horizontally', async () => {
    const base64 = await createTestImage();
    const result = await getResult({
      image_base64: base64,
      operations: [{ type: 'flop' }],
    });
    expect(result.success).toBe(true);
  });
});

// -------------------------------------------------------------------
// rotate operation
// -------------------------------------------------------------------
describe('executeImageTransform - rotate', () => {
  it('should rotate image', async () => {
    const base64 = await createTestImage();
    const result = await getResult({
      image_base64: base64,
      operations: [{ type: 'rotate', angle: 90 }],
    });
    expect(result.success).toBe(true);
    expect(result.operations).toContain('rotate');
  });
});

// -------------------------------------------------------------------
// multiple operations
// -------------------------------------------------------------------
describe('executeImageTransform - multiple ops', () => {
  it('should apply multiple operations in order', async () => {
    const base64 = await createTestImage();
    const result = await getResult({
      image_base64: base64,
      operations: [
        { type: 'resize', width: 10 },
        { type: 'grayscale' },
        { type: 'blur', sigma: 1 },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.operations).toEqual(['resize', 'grayscale', 'blur']);
    expect(result.message).toContain('3 operation(s)');
  });
});

// -------------------------------------------------------------------
// format conversion
// -------------------------------------------------------------------
describe('executeImageTransform - format', () => {
  it('should output as JPEG', async () => {
    const base64 = await createTestImage();
    const result = await getResult({
      image_base64: base64,
      operations: [{ type: 'grayscale' }],
      output_format: 'jpeg',
      quality: 90,
    });
    expect(result.success).toBe(true);
    expect(result.format).toBe('jpeg');
    expect(result.mimeType).toBe('image/jpeg');
  });

  it('should output as WebP', async () => {
    const base64 = await createTestImage();
    const result = await getResult({
      image_base64: base64,
      operations: [{ type: 'grayscale' }],
      output_format: 'webp',
    });
    expect(result.success).toBe(true);
    expect(result.format).toBe('webp');
    expect(result.mimeType).toBe('image/webp');
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeImageTransform - errors', () => {
  it('should error without image source', async () => {
    const res = await executeImageTransform(makeCall({ operations: [{ type: 'grayscale' }] }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('image_url or image_base64');
  });

  it('should error without operations', async () => {
    const base64 = await createTestImage();
    const res = await executeImageTransform(makeCall({ image_base64: base64 }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('operation');
  });

  it('should error with empty operations array', async () => {
    const base64 = await createTestImage();
    const res = await executeImageTransform(makeCall({ image_base64: base64, operations: [] }));
    expect(res.isError).toBe(true);
  });

  it('should return toolCallId', async () => {
    const base64 = await createTestImage();
    const res = await executeImageTransform({
      id: 'my-id',
      name: 'transform_image',
      arguments: {
        image_base64: base64,
        operations: [{ type: 'grayscale' }],
      },
    });
    expect(res.toolCallId).toBe('my-id');
  });
});
