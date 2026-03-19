import { describe, it, expect } from 'vitest';
import { contractTool, executeContract, isContractAvailable } from './contract-tool';

describe('ContractTool', () => {
  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(contractTool.name).toBe('create_contract');
    });

    it('should have a description', () => {
      expect(contractTool.description).toBeTruthy();
    });

    it('should require title, contract_type, and parties', () => {
      expect(contractTool.parameters.required).toEqual(['title', 'contract_type', 'parties']);
    });
  });

  describe('isContractAvailable', () => {
    it('should return true', () => {
      expect(isContractAvailable()).toBe(true);
    });
  });

  describe('executeContract', () => {
    it('should create an NDA contract with valid input', async () => {
      const result = await executeContract({
        id: 'test-1',
        name: 'create_contract',
        arguments: {
          title: 'Mutual Non-Disclosure Agreement',
          contract_type: 'nda',
          parties: [
            { name: 'Acme Corp', role: 'Disclosing Party' },
            { name: 'Beta LLC', role: 'Receiving Party' },
          ],
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.toolCallId).toBe('test-1');
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.formatted_output).toContain('Mutual Non-Disclosure Agreement');
      expect(parsed.formatted_output).toContain('Acme Corp');
      expect(parsed.formatted_output).toContain('Beta LLC');
    });

    it('should create an HTML format contract', async () => {
      const result = await executeContract({
        id: 'test-2',
        name: 'create_contract',
        arguments: {
          title: 'Service Agreement',
          contract_type: 'service_agreement',
          parties: [
            { name: 'Client Inc', role: 'Client' },
            { name: 'Vendor Co', role: 'Vendor' },
          ],
          format: 'html',
        },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.format).toBe('html');
      expect(parsed.formatted_output).toContain('Service Agreement');
      expect(parsed.formatted_output).toContain('Client Inc');
    });

    it('should create a markdown format contract', async () => {
      const result = await executeContract({
        id: 'test-3',
        name: 'create_contract',
        arguments: {
          title: 'Employment Contract',
          contract_type: 'employment',
          parties: [
            { name: 'TechCo', role: 'Employer' },
            { name: 'Jane Doe', role: 'Employee' },
          ],
          format: 'markdown',
        },
      });

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content);
      expect(parsed.success).toBe(true);
      expect(parsed.format).toBe('markdown');
      expect(parsed.formatted_output).toContain('Employment Contract');
    });

    it('should error when title is missing', async () => {
      const result = await executeContract({
        id: 'test-4',
        name: 'create_contract',
        arguments: {
          contract_type: 'nda',
          parties: [
            { name: 'A', role: 'Party A' },
            { name: 'B', role: 'Party B' },
          ],
        },
      });

      expect(result.isError).toBe(true);
    });

    it('should error when contract_type is missing', async () => {
      const result = await executeContract({
        id: 'test-5',
        name: 'create_contract',
        arguments: {
          title: 'Test Contract',
          parties: [
            { name: 'A', role: 'Party A' },
            { name: 'B', role: 'Party B' },
          ],
        },
      });

      expect(result.isError).toBe(true);
    });

    it('should error when parties is missing', async () => {
      const result = await executeContract({
        id: 'test-6',
        name: 'create_contract',
        arguments: {
          title: 'Test Contract',
          contract_type: 'general',
        },
      });

      expect(result.isError).toBe(true);
    });

    it('should return toolCallId on error', async () => {
      const result = await executeContract({
        id: 'err-id',
        name: 'create_contract',
        arguments: {},
      });

      expect(result.toolCallId).toBe('err-id');
      expect(result.isError).toBe(true);
    });
  });
});
