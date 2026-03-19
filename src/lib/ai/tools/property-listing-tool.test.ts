import { describe, it, expect } from 'vitest';
import { propertyListingTool, executePropertyListing, isPropertyListingAvailable } from './property-listing-tool';

describe('PropertyListingTool', () => {
  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(propertyListingTool.name).toBe('create_property_listing');
    });

    it('should have a description', () => {
      expect(propertyListingTool.description).toBeTruthy();
    });

    it('should require address, price, property_type, bedrooms, bathrooms, and square_feet', () => {
      expect(propertyListingTool.parameters.required).toEqual(['address', 'price', 'property_type', 'bedrooms', 'bathrooms', 'square_feet']);
    });
  });

  describe('isPropertyListingAvailable', () => {
    it('should return true', () => {
      expect(isPropertyListingAvailable()).toBe(true);
    });
  });

  describe('executePropertyListing', () => {
    it('should create a property listing with valid input', async () => {
      const result = await executePropertyListing({
        id: 'test-1',
        name: 'create_property_listing',
        arguments: {
          address: '123 Oak Street, Portland, OR 97201',
          price: '$450,000',
          property_type: 'single_family',
          bedrooms: 3,
          bathrooms: 2,
          square_feet: 1800,
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.toolCallId).toBe('test-1');
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.formatted_output).toContain('123 Oak Street');
      expect(parsed.formatted_output).toContain('$450,000');
    });

    it('should create an HTML format listing', async () => {
      const result = await executePropertyListing({
        id: 'test-2',
        name: 'create_property_listing',
        arguments: {
          address: '456 Elm Ave, Seattle, WA 98101',
          price: '$725,000',
          property_type: 'single_family',
          bedrooms: 4,
          bathrooms: 3,
          square_feet: 2400,
          format: 'html',
        },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.format).toBe('html');
      expect(parsed.formatted_output).toContain('456 Elm Ave');
      expect(parsed.formatted_output).toContain('$725,000');
    });

    it('should create a markdown format listing', async () => {
      const result = await executePropertyListing({
        id: 'test-3',
        name: 'create_property_listing',
        arguments: {
          address: '789 Pine Rd, Denver, CO 80201',
          price: '$350,000',
          property_type: 'single_family',
          bedrooms: 2,
          bathrooms: 1,
          square_feet: 1200,
          format: 'markdown',
        },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.format).toBe('markdown');
      expect(parsed.formatted_output).toContain('789 Pine Rd');
    });

    it('should error when address is missing', async () => {
      const result = await executePropertyListing({
        id: 'test-4',
        name: 'create_property_listing',
        arguments: {
          price: '$300,000',
          property_type: 'single_family',
          bedrooms: 2,
          bathrooms: 1,
          square_feet: 1000,
        },
      });

      expect(result.isError).toBe(true);
    });

    it('should error when price is missing', async () => {
      const result = await executePropertyListing({
        id: 'test-5',
        name: 'create_property_listing',
        arguments: {
          address: '123 Test St',
          property_type: 'single_family',
          bedrooms: 2,
          bathrooms: 1,
          square_feet: 1000,
        },
      });

      expect(result.isError).toBe(true);
    });

    it('should error when numeric fields are missing', async () => {
      const result = await executePropertyListing({
        id: 'test-6',
        name: 'create_property_listing',
        arguments: {
          address: '123 Test St',
          price: '$300,000',
          property_type: 'single_family',
        },
      });

      expect(result.isError).toBe(true);
    });

    it('should return toolCallId on error', async () => {
      const result = await executePropertyListing({
        id: 'err-id',
        name: 'create_property_listing',
        arguments: {},
      });

      expect(result.toolCallId).toBe('err-id');
      expect(result.isError).toBe(true);
    });
  });
});
