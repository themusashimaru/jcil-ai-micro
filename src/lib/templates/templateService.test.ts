import { describe, it, expect, vi } from 'vitest';

// Mock supabase (used by async functions we don't test)
vi.mock('@/lib/supabase/client', () => ({
  createServerClient: vi.fn(),
}));
vi.mock('@/lib/supabase/workspace-client', () => ({
  untypedFrom: vi.fn(),
}));

import {
  detectCategory,
  extractBusinessInfo,
  applyBusinessInfo,
  type TemplateCategory,
} from './templateService';

// -------------------------------------------------------------------
// detectCategory
// -------------------------------------------------------------------
describe('detectCategory', () => {
  // Business types
  it('should detect restaurant', () => {
    expect(detectCategory('I need a website for my restaurant')).toBe('restaurant');
  });

  it('should detect cafe/coffee shop', () => {
    expect(detectCategory('Create a cafe website')).toBe('cafe');
  });

  it('should detect salon', () => {
    expect(detectCategory('Hair salon website please')).toBe('salon');
  });

  it('should detect gym', () => {
    expect(detectCategory('Build a gym website')).toBe('gym');
  });

  it('should detect dental', () => {
    expect(detectCategory('Dental practice website')).toBe('dental');
  });

  it('should detect real-estate', () => {
    expect(detectCategory('Real estate agency website')).toBe('real-estate');
  });

  it('should detect photography', () => {
    expect(detectCategory('Photography portfolio website')).toBe('photography');
  });

  it('should detect e-commerce', () => {
    expect(detectCategory('I want an online store')).toBe('ecommerce');
  });

  it('should detect church', () => {
    expect(detectCategory('Church website for our congregation')).toBe('church');
  });

  it('should default to landing-page for unknown input', () => {
    expect(detectCategory('I need something online')).toBe('landing-page');
  });

  it('should be case-insensitive', () => {
    expect(detectCategory('RESTAURANT WEBSITE')).toBe('restaurant');
  });

  it('should handle empty string', () => {
    expect(detectCategory('')).toBe('landing-page');
  });
});

// -------------------------------------------------------------------
// extractBusinessInfo
// -------------------------------------------------------------------
describe('extractBusinessInfo', () => {
  it('should extract quoted business name', () => {
    const info = extractBusinessInfo('Create a website for "Acme Corp"');
    expect(info.name).toBe('Acme Corp');
  });

  it('should extract single-quoted business name', () => {
    const info = extractBusinessInfo("Website for 'Smith Photography'");
    expect(info.name).toBe('Smith Photography');
  });

  it('should extract email address', () => {
    const info = extractBusinessInfo('Contact email is john@acme.com');
    expect(info.email).toBe('john@acme.com');
  });

  it('should extract phone number', () => {
    const info = extractBusinessInfo('Phone: (555) 123-4567');
    expect(info.phone).toBeTruthy();
  });

  it('should extract "called X" pattern', () => {
    const info = extractBusinessInfo('Website for a bakery called Sweet Delights');
    expect(info.name).toBe('Sweet Delights');
  });

  it('should extract "named X" pattern', () => {
    const info = extractBusinessInfo('My company is named TechFlow Solutions');
    expect(info.name).toBe('TechFlow Solutions');
  });

  it('should return empty object for vague input', () => {
    const info = extractBusinessInfo('make me a website');
    // Should not extract a business name from this
    expect(info.name).toBeUndefined();
  });

  it('should handle empty string', () => {
    const info = extractBusinessInfo('');
    expect(info.name).toBeUndefined();
  });
});

// -------------------------------------------------------------------
// applyBusinessInfo
// -------------------------------------------------------------------
describe('applyBusinessInfo', () => {
  const mockTemplate = {
    id: 'test',
    name: 'Test Template',
    description: 'Test',
    category: 'landing-page' as TemplateCategory,
    html_template:
      '<h1>{{business_name}}</h1><p>{{tagline}}</p><a>{{cta_text}}</a><span>{{phone}}</span><span>{{email}}</span>',
    thumbnail_url: '',
    is_active: true,
    rating: 5,
    usage_count: 0,
  };

  const businessInfo = {
    name: 'Acme Corp',
    tagline: 'We build things',
    description: 'A great company',
    phone: '555-1234',
    email: 'info@acme.com',
    ctaText: 'Get Started',
    ctaLink: '/contact',
  };

  it('should replace business_name placeholder', () => {
    const result = applyBusinessInfo(mockTemplate, businessInfo);
    expect(result).toContain('Acme Corp');
    expect(result).not.toContain('{{business_name}}');
  });

  it('should replace tagline placeholder', () => {
    const result = applyBusinessInfo(mockTemplate, businessInfo);
    expect(result).toContain('We build things');
  });

  it('should replace phone placeholder', () => {
    const result = applyBusinessInfo(mockTemplate, businessInfo);
    expect(result).toContain('555-1234');
  });

  it('should replace email placeholder', () => {
    const result = applyBusinessInfo(mockTemplate, businessInfo);
    expect(result).toContain('info@acme.com');
  });

  it('should replace CTA text placeholder', () => {
    const result = applyBusinessInfo(mockTemplate, businessInfo);
    expect(result).toContain('Get Started');
  });

  it('should inject logo image when provided', () => {
    const template = {
      ...mockTemplate,
      html_template: '<img src="{{logo_url}}">',
    };
    const result = applyBusinessInfo(template, businessInfo, {
      logo: 'https://cdn.example.com/logo.png',
    });
    expect(result).toContain('https://cdn.example.com/logo.png');
  });

  it('should inject hero image when provided', () => {
    const template = {
      ...mockTemplate,
      html_template: '<img src="{{hero_url}}">',
    };
    const result = applyBusinessInfo(template, businessInfo, {
      hero: 'https://cdn.example.com/hero.jpg',
    });
    expect(result).toContain('https://cdn.example.com/hero.jpg');
  });

  it('should replace logo placeholder src patterns', () => {
    const template = {
      ...mockTemplate,
      html_template: '<img src="logo.png">',
    };
    const result = applyBusinessInfo(template, businessInfo, {
      logo: 'https://cdn.example.com/brand.png',
    });
    expect(result).toContain('https://cdn.example.com/brand.png');
    expect(result).not.toContain('src="logo.png"');
  });

  it('should handle missing optional fields', () => {
    const minInfo = { name: 'TestCo' };
    const result = applyBusinessInfo(mockTemplate, minInfo);
    expect(result).toContain('TestCo');
    // Unreplaced placeholders remain
    expect(result).toContain('{{tagline}}');
  });
});
