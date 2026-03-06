import { describe, it, expect } from 'vitest';
import {
  emailTemplateTool,
  executeEmailTemplate,
  isEmailTemplateAvailable,
} from './email-template-tool';

describe('EmailTemplateTool', () => {
  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(emailTemplateTool.name).toBe('create_email_template');
    });

    it('should require layout and subject', () => {
      expect(emailTemplateTool.parameters.required).toEqual(['layout', 'subject']);
    });
  });

  describe('executeEmailTemplate', () => {
    it('should create a basic newsletter email', async () => {
      const result = await executeEmailTemplate({
        id: 'test-1',
        name: 'create_email_template',
        arguments: {
          layout: 'newsletter',
          subject: 'Monthly Update - March 2026',
          brand: {
            name: 'JCIL AI',
            primary_color: '#1a73e8',
          },
          hero: {
            title: 'March 2026 Product Update',
            subtitle: "See what's new this month",
            cta_text: 'Read More',
            cta_url: 'https://example.com',
          },
          sections: [
            { title: 'New Feature', content: 'We launched AI-powered document generation!' },
            { title: 'Coming Soon', content: 'PowerPoint presentations and mail merge.' },
          ],
        },
      });

      expect(result.isError).toBe(false);
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.html).toContain('<!DOCTYPE html>');
      expect(parsed.html).toContain('Monthly Update');
      expect(parsed.html).toContain('JCIL AI');
      expect(parsed.html).toContain('Read More');
    });

    it('should include preheader text', async () => {
      const result = await executeEmailTemplate({
        id: 'test-2',
        name: 'create_email_template',
        arguments: {
          layout: 'promotional',
          subject: 'Special Offer',
          preheader: 'Get 50% off today only!',
        },
      });

      expect(result.isError).toBe(false);
      const parsed = JSON.parse(result.content);
      expect(parsed.html).toContain('Get 50% off today only!');
      expect(parsed.html).toContain('display:none'); // preheader hidden div
    });

    it('should include footer with social links', async () => {
      const result = await executeEmailTemplate({
        id: 'test-3',
        name: 'create_email_template',
        arguments: {
          layout: 'announcement',
          subject: 'Big News',
          footer: {
            company_name: 'Acme Corp',
            address: '123 Main St, Portland OR',
            unsubscribe_url: 'https://example.com/unsubscribe',
            social: {
              twitter: 'https://twitter.com/acme',
              linkedin: 'https://linkedin.com/company/acme',
            },
          },
        },
      });

      expect(result.isError).toBe(false);
      const parsed = JSON.parse(result.content);
      expect(parsed.html).toContain('Acme Corp');
      expect(parsed.html).toContain('Unsubscribe');
      expect(parsed.html).toContain('Twitter');
      expect(parsed.html).toContain('LinkedIn');
    });

    it('should escape HTML in content', async () => {
      const result = await executeEmailTemplate({
        id: 'test-4',
        name: 'create_email_template',
        arguments: {
          layout: 'transactional',
          subject: 'Test <script>alert("xss")</script>',
        },
      });

      expect(result.isError).toBe(false);
      const parsed = JSON.parse(result.content);
      expect(parsed.html).not.toContain('<script>');
      expect(parsed.html).toContain('&lt;script&gt;');
    });

    it('should include Outlook compatibility', async () => {
      const result = await executeEmailTemplate({
        id: 'test-5',
        name: 'create_email_template',
        arguments: {
          layout: 'welcome',
          subject: 'Welcome!',
        },
      });

      expect(result.isError).toBe(false);
      const parsed = JSON.parse(result.content);
      expect(parsed.html).toContain('urn:schemas-microsoft-com:office:office');
      expect(parsed.html).toContain('urn:schemas-microsoft-com:vml');
    });

    it('should reject missing layout', async () => {
      const result = await executeEmailTemplate({
        id: 'test-6',
        name: 'create_email_template',
        arguments: { subject: 'Test' },
      });

      expect(result.isError).toBe(true);
    });

    it('should reject missing subject', async () => {
      const result = await executeEmailTemplate({
        id: 'test-7',
        name: 'create_email_template',
        arguments: { layout: 'newsletter' },
      });

      expect(result.isError).toBe(true);
    });

    it('should handle logo URL in brand', async () => {
      const result = await executeEmailTemplate({
        id: 'test-8',
        name: 'create_email_template',
        arguments: {
          layout: 'newsletter',
          subject: 'Brand Test',
          brand: {
            name: 'My Brand',
            logo_url: 'https://example.com/logo.png',
            primary_color: '#FF5722',
          },
        },
      });

      expect(result.isError).toBe(false);
      const parsed = JSON.parse(result.content);
      expect(parsed.html).toContain('https://example.com/logo.png');
      expect(parsed.html).toContain('#FF5722');
    });
  });

  describe('isEmailTemplateAvailable', () => {
    it('should return true', () => {
      expect(isEmailTemplateAvailable()).toBe(true);
    });
  });
});
