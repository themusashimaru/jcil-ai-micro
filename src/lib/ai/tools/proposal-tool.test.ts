import { describe, it, expect } from 'vitest';
import { executeProposal, isProposalAvailable, proposalTool } from './proposal-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'create_proposal', arguments: args };
}

function basicArgs(overrides?: Record<string, unknown>) {
  return {
    title: 'Digital Transformation Proposal',
    client_name: 'Acme Corporation',
    executive_summary: 'We propose a comprehensive digital transformation initiative to modernize operations.',
    scope_of_work: [
      { deliverable: 'Cloud Migration', description: 'Migrate on-premise servers to AWS' },
      { deliverable: 'CI/CD Pipeline', description: 'Implement automated build and deployment' },
    ],
    ...overrides,
  };
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('proposalTool metadata', () => {
  it('should have correct name', () => {
    expect(proposalTool.name).toBe('create_proposal');
  });

  it('should have a description', () => {
    expect(proposalTool.description).toBeTruthy();
  });

  it('should require title, client_name, executive_summary, scope_of_work', () => {
    expect(proposalTool.parameters.required).toContain('title');
    expect(proposalTool.parameters.required).toContain('client_name');
    expect(proposalTool.parameters.required).toContain('executive_summary');
    expect(proposalTool.parameters.required).toContain('scope_of_work');
  });
});

describe('isProposalAvailable', () => {
  it('should return true', () => {
    expect(isProposalAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// Execution — valid input
// -------------------------------------------------------------------
describe('executeProposal - creation', () => {
  it('should create proposal with valid input', async () => {
    const res = await executeProposal(makeCall(basicArgs()));
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('Digital Transformation');
    expect(res.content).toContain('Acme Corporation');
  });

  it('should include scope of work', async () => {
    const res = await executeProposal(makeCall(basicArgs()));
    expect(res.content).toContain('Cloud Migration');
    expect(res.content).toContain('CI/CD Pipeline');
  });

  it('should include executive summary', async () => {
    const res = await executeProposal(makeCall(basicArgs()));
    expect(res.content).toContain('digital transformation');
  });

  it('should support html format', async () => {
    const res = await executeProposal(makeCall(basicArgs({ format: 'html' })));
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('<');
  });

  it('should default to markdown format', async () => {
    const res = await executeProposal(makeCall(basicArgs()));
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('#');
  });

  it('should return toolCallId', async () => {
    const res = await executeProposal({
      id: 'my-id',
      name: 'create_proposal',
      arguments: basicArgs(),
    });
    expect(res.toolCallId).toBe('my-id');
  });
});

// -------------------------------------------------------------------
// Validation — missing fields
// -------------------------------------------------------------------
describe('executeProposal - validation', () => {
  it('should error without title', async () => {
    const res = await executeProposal(
      makeCall({ client_name: 'Test', executive_summary: 'Test', scope_of_work: [] })
    );
    expect(res.isError).toBe(true);
  });

  it('should error without client_name', async () => {
    const res = await executeProposal(
      makeCall({ title: 'Test', executive_summary: 'Test', scope_of_work: [] })
    );
    expect(res.isError).toBe(true);
  });

  it('should error with empty arguments', async () => {
    const res = await executeProposal({
      id: 'test',
      name: 'create_proposal',
      arguments: {},
    });
    expect(res.isError).toBe(true);
  });
});
