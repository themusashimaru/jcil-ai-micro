import { describe, it, expect } from 'vitest';
import {
  documentTemplatesTool,
  executeDocumentTemplate,
  isDocumentTemplateAvailable,
} from './document-templates-tool';

describe('DocumentTemplatesTool', () => {
  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(documentTemplatesTool.name).toBe('document_template');
    });

    it('should require template_type and data', () => {
      expect(documentTemplatesTool.parameters.required).toEqual(['template_type', 'data']);
    });
  });

  describe('invoice template', () => {
    it('should generate a complete invoice', async () => {
      const result = await executeDocumentTemplate({
        id: 'test-1',
        name: 'document_template',
        arguments: {
          template_type: 'invoice',
          data: {
            company: 'Acme Corp',
            client: 'Widget Inc',
            invoice_number: 'INV-2026-001',
            items: [
              { description: 'Web Development', quantity: 40, rate: 150 },
              { description: 'Design Work', quantity: 20, rate: 125 },
            ],
            tax_rate: 8.5,
          },
        },
      });

      expect(result.isError).toBe(false);
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.markdown).toContain('INVOICE');
      expect(parsed.markdown).toContain('Acme Corp');
      expect(parsed.markdown).toContain('Web Development');
      expect(parsed.markdown).toContain('$6000.00'); // 40 * 150
    });
  });

  describe('contract template', () => {
    it('should generate a service agreement', async () => {
      const result = await executeDocumentTemplate({
        id: 'test-2',
        name: 'document_template',
        arguments: {
          template_type: 'contract',
          data: {
            party_a: 'Acme Corp',
            party_b: 'Client LLC',
            effective_date: 'March 6, 2026',
            term: '6 months',
            scope: 'Software development services',
          },
        },
      });

      expect(result.isError).toBe(false);
      const parsed = JSON.parse(result.content);
      expect(parsed.markdown).toContain('SERVICE AGREEMENT');
      expect(parsed.markdown).toContain('Acme Corp');
      expect(parsed.markdown).toContain('6 months');
    });
  });

  describe('resume template', () => {
    it('should generate a resume', async () => {
      const result = await executeDocumentTemplate({
        id: 'test-3',
        name: 'document_template',
        arguments: {
          template_type: 'resume',
          data: {
            name: 'John Doe',
            title: 'Senior Software Engineer',
            email: 'john@example.com',
            experience: [
              {
                company: 'TechCo',
                role: 'Lead Engineer',
                dates: '2024-Present',
                achievements: ['Led team of 8', 'Shipped 3 products'],
              },
            ],
            skills: ['TypeScript', 'React', 'Node.js'],
          },
        },
      });

      expect(result.isError).toBe(false);
      const parsed = JSON.parse(result.content);
      expect(parsed.markdown).toContain('John Doe');
      expect(parsed.markdown).toContain('Senior Software Engineer');
      expect(parsed.markdown).toContain('TypeScript');
    });
  });

  describe('onboarding template', () => {
    it('should generate an onboarding packet', async () => {
      const result = await executeDocumentTemplate({
        id: 'test-4',
        name: 'document_template',
        arguments: {
          template_type: 'onboarding',
          data: {
            company: 'Pasquale Bruni',
            employee_name: 'Maria Rossi',
            role: 'Jewelry Designer',
            department: 'Design',
            start_date: 'April 1, 2026',
            manager: 'Giovanni Bruni',
          },
        },
      });

      expect(result.isError).toBe(false);
      const parsed = JSON.parse(result.content);
      expect(parsed.markdown).toContain('Pasquale Bruni');
      expect(parsed.markdown).toContain('Maria Rossi');
      expect(parsed.markdown).toContain('Jewelry Designer');
    });
  });

  describe('all template types', () => {
    const templateTypes = [
      'invoice',
      'contract',
      'proposal',
      'resume',
      'onboarding',
      'meeting_minutes',
      'status_report',
      'nda',
      'receipt',
      'certificate',
    ];

    templateTypes.forEach((type) => {
      it(`should generate ${type} template`, async () => {
        const result = await executeDocumentTemplate({
          id: `test-${type}`,
          name: 'document_template',
          arguments: {
            template_type: type,
            data: { company: 'Test Co', name: 'Test User' },
          },
        });

        expect(result.isError).toBe(false);
        const parsed = JSON.parse(result.content);
        expect(parsed.success).toBe(true);
        expect(parsed.template_type).toBe(type);
        expect(parsed.markdown.length).toBeGreaterThan(50);
      });
    });
  });

  describe('error handling', () => {
    it('should reject unknown template type', async () => {
      const result = await executeDocumentTemplate({
        id: 'test-err-1',
        name: 'document_template',
        arguments: { template_type: 'unknown', data: {} },
      });

      expect(result.isError).toBe(true);
      expect(result.content).toContain('Unknown template');
    });

    it('should reject missing data', async () => {
      const result = await executeDocumentTemplate({
        id: 'test-err-2',
        name: 'document_template',
        arguments: { template_type: 'invoice' },
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('isDocumentTemplateAvailable', () => {
    it('should return true', () => {
      expect(isDocumentTemplateAvailable()).toBe(true);
    });
  });
});
