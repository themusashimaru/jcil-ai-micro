import { describe, it, expect } from 'vitest';
import {
  executeJobDescription,
  isJobDescriptionAvailable,
  jobDescriptionTool,
} from './job-description-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'create_job_description', arguments: args };
}

function basicArgs(overrides?: Record<string, unknown>) {
  return {
    job_title: 'Senior Software Engineer',
    department: 'Engineering',
    responsibilities: [
      'Design and implement scalable backend services',
      'Conduct code reviews and mentor junior engineers',
      'Participate in architecture discussions',
    ],
    ...overrides,
  };
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('jobDescriptionTool metadata', () => {
  it('should have correct name', () => {
    expect(jobDescriptionTool.name).toBe('create_job_description');
  });

  it('should have a description', () => {
    expect(jobDescriptionTool.description).toBeTruthy();
  });

  it('should require job_title, department, responsibilities', () => {
    expect(jobDescriptionTool.parameters.required).toContain('job_title');
    expect(jobDescriptionTool.parameters.required).toContain('department');
    expect(jobDescriptionTool.parameters.required).toContain('responsibilities');
  });
});

describe('isJobDescriptionAvailable', () => {
  it('should return true', () => {
    expect(isJobDescriptionAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// Execution — valid input
// -------------------------------------------------------------------
describe('executeJobDescription - creation', () => {
  it('should create job description with valid input', async () => {
    const res = await executeJobDescription(makeCall(basicArgs()));
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('Senior Software Engineer');
    expect(res.content).toContain('Engineering');
  });

  it('should include responsibilities in output', async () => {
    const res = await executeJobDescription(makeCall(basicArgs()));
    expect(res.content).toContain('code reviews');
  });

  it('should support html format', async () => {
    const res = await executeJobDescription(makeCall(basicArgs({ format: 'html' })));
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('<');
  });

  it('should default to markdown format', async () => {
    const res = await executeJobDescription(makeCall(basicArgs()));
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('#');
  });

  it('should handle optional fields', async () => {
    const res = await executeJobDescription(
      makeCall(basicArgs({ company: 'Acme Corp', location: 'San Francisco, CA' }))
    );
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('Acme Corp');
  });

  it('should return toolCallId', async () => {
    const res = await executeJobDescription({
      id: 'my-id',
      name: 'create_job_description',
      arguments: basicArgs(),
    });
    expect(res.toolCallId).toBe('my-id');
  });
});

// -------------------------------------------------------------------
// Validation — missing fields
// -------------------------------------------------------------------
describe('executeJobDescription - validation', () => {
  it('should error without job_title', async () => {
    const res = await executeJobDescription(
      makeCall({ department: 'Eng', responsibilities: ['Do things'] })
    );
    expect(res.isError).toBe(true);
  });

  it('should error without department', async () => {
    const res = await executeJobDescription(
      makeCall({ job_title: 'Engineer', responsibilities: ['Do things'] })
    );
    expect(res.isError).toBe(true);
  });

  it('should error with empty arguments', async () => {
    const res = await executeJobDescription({
      id: 'test',
      name: 'create_job_description',
      arguments: {},
    });
    expect(res.isError).toBe(true);
  });
});
