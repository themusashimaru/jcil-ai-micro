import { describe, it, expect } from 'vitest';
import {
  FLUX_MODELS,
  DEFAULT_MODEL,
  getModelConfig,
  calculateCost,
  validateDimensions,
  getModelsWithCapability,
  ASPECT_RATIOS,
} from './models';

// -------------------------------------------------------------------
// FLUX_MODELS constants
// -------------------------------------------------------------------
describe('FLUX_MODELS', () => {
  it('should have 5 model entries', () => {
    expect(Object.keys(FLUX_MODELS)).toHaveLength(5);
  });

  it('should include all expected model IDs', () => {
    const ids = Object.keys(FLUX_MODELS);
    expect(ids).toContain('flux-2-pro');
    expect(ids).toContain('flux-2-max');
    expect(ids).toContain('flux-2-flex');
    expect(ids).toContain('flux-2-klein-4b');
    expect(ids).toContain('flux-2-klein-9b');
  });

  it('should have matching id field for each key', () => {
    for (const [key, config] of Object.entries(FLUX_MODELS)) {
      expect(config.id).toBe(key);
    }
  });

  it('should have positive price for every model', () => {
    for (const config of Object.values(FLUX_MODELS)) {
      expect(config.pricePerMegapixel).toBeGreaterThan(0);
    }
  });

  it('should have valid quality/speed tiers (1-3)', () => {
    for (const config of Object.values(FLUX_MODELS)) {
      expect(config.qualityTier).toBeGreaterThanOrEqual(1);
      expect(config.qualityTier).toBeLessThanOrEqual(3);
      expect(config.speedTier).toBeGreaterThanOrEqual(1);
      expect(config.speedTier).toBeLessThanOrEqual(3);
    }
  });

  it('should have min < max for all limit ranges', () => {
    for (const config of Object.values(FLUX_MODELS)) {
      const { limits } = config;
      expect(limits.minWidth).toBeLessThan(limits.maxWidth);
      expect(limits.minHeight).toBeLessThan(limits.maxHeight);
      expect(limits.minGuidance).toBeLessThan(limits.maxGuidance);
      expect(limits.minSteps).toBeLessThan(limits.maxSteps);
    }
  });

  it('should have defaults within limits', () => {
    for (const config of Object.values(FLUX_MODELS)) {
      const { defaults, limits } = config;
      expect(defaults.width).toBeGreaterThanOrEqual(limits.minWidth);
      expect(defaults.width).toBeLessThanOrEqual(limits.maxWidth);
      expect(defaults.height).toBeGreaterThanOrEqual(limits.minHeight);
      expect(defaults.height).toBeLessThanOrEqual(limits.maxHeight);
      expect(defaults.guidance).toBeGreaterThanOrEqual(limits.minGuidance);
      expect(defaults.guidance).toBeLessThanOrEqual(limits.maxGuidance);
      expect(defaults.steps).toBeGreaterThanOrEqual(limits.minSteps);
      expect(defaults.steps).toBeLessThanOrEqual(limits.maxSteps);
    }
  });

  it('should have valid output format in defaults', () => {
    const validFormats = ['jpeg', 'png', 'webp'];
    for (const config of Object.values(FLUX_MODELS)) {
      expect(validFormats).toContain(config.defaults.outputFormat);
    }
  });
});

// -------------------------------------------------------------------
// DEFAULT_MODEL
// -------------------------------------------------------------------
describe('DEFAULT_MODEL', () => {
  it('should be flux-2-pro', () => {
    expect(DEFAULT_MODEL).toBe('flux-2-pro');
  });

  it('should be a valid model key', () => {
    expect(FLUX_MODELS[DEFAULT_MODEL]).toBeDefined();
  });
});

// -------------------------------------------------------------------
// getModelConfig
// -------------------------------------------------------------------
describe('getModelConfig', () => {
  it('should return config for flux-2-pro', () => {
    const config = getModelConfig('flux-2-pro');
    expect(config.name).toBe('FLUX.2 Pro');
    expect(config.endpoint).toBe('/v1/flux-2-pro');
  });

  it('should return config for flux-2-max', () => {
    const config = getModelConfig('flux-2-max');
    expect(config.name).toBe('FLUX.2 Max');
  });

  it('should return config for flux-2-flex', () => {
    const config = getModelConfig('flux-2-flex');
    expect(config.name).toBe('FLUX.2 Flex');
  });

  it('should return config for flux-2-klein-4b', () => {
    const config = getModelConfig('flux-2-klein-4b');
    expect(config.capabilities.textToImage).toBe(true);
    expect(config.capabilities.imageEditing).toBe(false);
  });

  it('should return config for flux-2-klein-9b', () => {
    const config = getModelConfig('flux-2-klein-9b');
    expect(config.capabilities.textToImage).toBe(true);
    expect(config.capabilities.imageEditing).toBe(false);
  });

  it('should return same reference as FLUX_MODELS entry', () => {
    expect(getModelConfig('flux-2-pro')).toBe(FLUX_MODELS['flux-2-pro']);
  });
});

// -------------------------------------------------------------------
// calculateCost
// -------------------------------------------------------------------
describe('calculateCost', () => {
  it('should calculate cost for 1MP (1024x1024 ≈ 1.048576 MP)', () => {
    const cost = calculateCost('flux-2-pro', 1024, 1024);
    const expected = ((1024 * 1024) / 1_000_000) * 0.03;
    expect(cost).toBeCloseTo(expected, 6);
  });

  it('should calculate cost for exact 1 megapixel', () => {
    const cost = calculateCost('flux-2-pro', 1000, 1000);
    expect(cost).toBeCloseTo(0.03, 6);
  });

  it('should scale with dimension size', () => {
    const small = calculateCost('flux-2-pro', 512, 512);
    const large = calculateCost('flux-2-pro', 1024, 1024);
    expect(large).toBeGreaterThan(small);
    // 4x the pixels = 4x the cost
    expect(large / small).toBeCloseTo(4, 1);
  });

  it('should differ by model pricing', () => {
    const proCost = calculateCost('flux-2-pro', 1024, 1024);
    const maxCost = calculateCost('flux-2-max', 1024, 1024);
    const kleinCost = calculateCost('flux-2-klein-4b', 1024, 1024);
    expect(maxCost).toBeGreaterThan(proCost);
    expect(proCost).toBeGreaterThan(kleinCost);
  });

  it('should return 0 for zero dimensions', () => {
    expect(calculateCost('flux-2-pro', 0, 1024)).toBe(0);
    expect(calculateCost('flux-2-pro', 1024, 0)).toBe(0);
  });

  it('should handle landscape dimensions', () => {
    const cost = calculateCost('flux-2-pro', 1280, 720);
    const expected = ((1280 * 720) / 1_000_000) * 0.03;
    expect(cost).toBeCloseTo(expected, 6);
  });
});

// -------------------------------------------------------------------
// validateDimensions
// -------------------------------------------------------------------
describe('validateDimensions', () => {
  it('should accept valid default dimensions', () => {
    const result = validateDimensions('flux-2-pro', 1024, 1024);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should reject width below minimum', () => {
    const result = validateDimensions('flux-2-pro', 128, 1024);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Width');
    expect(result.error).toContain('256');
    expect(result.error).toContain('2048');
  });

  it('should reject width above maximum', () => {
    const result = validateDimensions('flux-2-pro', 3000, 1024);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Width');
  });

  it('should reject height below minimum', () => {
    const result = validateDimensions('flux-2-pro', 1024, 100);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Height');
  });

  it('should reject height above maximum', () => {
    const result = validateDimensions('flux-2-pro', 1024, 3000);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Height');
  });

  it('should reject total megapixels exceeding 4MP', () => {
    // 2048 x 2048 = 4.194 MP > 4
    const result = validateDimensions('flux-2-pro', 2048, 2048);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('4 megapixels');
  });

  it('should accept dimensions just under 4MP', () => {
    // 2000 x 2000 = 4 MP exactly — check boundary
    const result = validateDimensions('flux-2-pro', 2000, 2000);
    expect(result.valid).toBe(true);
  });

  it('should use model-specific limits for klein models', () => {
    // Klein 4b has maxWidth/maxHeight of 1536
    const result = validateDimensions('flux-2-klein-4b', 2000, 1024);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('1536');
  });

  it('should accept boundary minimum dimensions', () => {
    const result = validateDimensions('flux-2-pro', 256, 256);
    expect(result.valid).toBe(true);
  });

  it('should accept boundary maximum dimensions within 4MP', () => {
    // 2048 x 1024 = 2.097 MP < 4
    const result = validateDimensions('flux-2-pro', 2048, 1024);
    expect(result.valid).toBe(true);
  });
});

// -------------------------------------------------------------------
// getModelsWithCapability
// -------------------------------------------------------------------
describe('getModelsWithCapability', () => {
  it('should return all models for textToImage', () => {
    const models = getModelsWithCapability('textToImage');
    expect(models).toHaveLength(5);
  });

  it('should return only editing-capable models for imageEditing', () => {
    const models = getModelsWithCapability('imageEditing');
    const ids = models.map((m) => m.id);
    expect(ids).toContain('flux-2-pro');
    expect(ids).toContain('flux-2-max');
    expect(ids).toContain('flux-2-flex');
    expect(ids).not.toContain('flux-2-klein-4b');
    expect(ids).not.toContain('flux-2-klein-9b');
  });

  it('should return models with promptUpsampling', () => {
    const models = getModelsWithCapability('promptUpsampling');
    const ids = models.map((m) => m.id);
    expect(ids).toContain('flux-2-pro');
    expect(ids).toContain('flux-2-max');
    expect(ids).toContain('flux-2-flex');
    expect(ids).not.toContain('flux-2-klein-4b');
    expect(ids).not.toContain('flux-2-klein-9b');
  });

  it('should return only redux-capable models', () => {
    const models = getModelsWithCapability('redux');
    const ids = models.map((m) => m.id);
    expect(ids).toContain('flux-2-pro');
    expect(ids).toContain('flux-2-max');
    expect(ids).not.toContain('flux-2-flex');
  });

  it('should return models with maxReferenceImages > 0', () => {
    const models = getModelsWithCapability('maxReferenceImages');
    const ids = models.map((m) => m.id);
    expect(ids).toContain('flux-2-pro');
    expect(ids).toContain('flux-2-max');
    expect(ids).toContain('flux-2-flex');
    // Klein models have maxReferenceImages: 0
    expect(ids).not.toContain('flux-2-klein-4b');
    expect(ids).not.toContain('flux-2-klein-9b');
  });

  it('should return FluxModelConfig objects', () => {
    const models = getModelsWithCapability('textToImage');
    for (const model of models) {
      expect(model).toHaveProperty('id');
      expect(model).toHaveProperty('name');
      expect(model).toHaveProperty('capabilities');
      expect(model).toHaveProperty('defaults');
      expect(model).toHaveProperty('limits');
    }
  });
});

// -------------------------------------------------------------------
// ASPECT_RATIOS
// -------------------------------------------------------------------
describe('ASPECT_RATIOS', () => {
  it('should have 7 aspect ratio entries', () => {
    expect(Object.keys(ASPECT_RATIOS)).toHaveLength(7);
  });

  it('should include standard ratios', () => {
    const ratios = Object.keys(ASPECT_RATIOS);
    expect(ratios).toContain('1:1');
    expect(ratios).toContain('4:3');
    expect(ratios).toContain('16:9');
    expect(ratios).toContain('9:16');
  });

  it('should have square 1:1 with equal dimensions', () => {
    expect(ASPECT_RATIOS['1:1'].width).toBe(ASPECT_RATIOS['1:1'].height);
  });

  it('should have landscape wider than tall', () => {
    expect(ASPECT_RATIOS['16:9'].width).toBeGreaterThan(ASPECT_RATIOS['16:9'].height);
    expect(ASPECT_RATIOS['4:3'].width).toBeGreaterThan(ASPECT_RATIOS['4:3'].height);
  });

  it('should have portrait taller than wide', () => {
    expect(ASPECT_RATIOS['9:16'].height).toBeGreaterThan(ASPECT_RATIOS['9:16'].width);
    expect(ASPECT_RATIOS['3:4'].height).toBeGreaterThan(ASPECT_RATIOS['3:4'].width);
  });

  it('should have labels for all ratios', () => {
    for (const ratio of Object.values(ASPECT_RATIOS)) {
      expect(ratio.label).toBeTruthy();
      expect(typeof ratio.label).toBe('string');
    }
  });

  it('should have positive dimensions', () => {
    for (const ratio of Object.values(ASPECT_RATIOS)) {
      expect(ratio.width).toBeGreaterThan(0);
      expect(ratio.height).toBeGreaterThan(0);
    }
  });
});
