import { describe, it, expect } from 'vitest';
import {
  getDocumentTypeName,
  detectDocumentIntent,
  detectDocumentSubtype,
  extractPreviousDocumentContext,
  buildDocumentContext,
  detectStyleMatchRequest,
  generateStyleMatchInstructions,
  detectMultiDocumentRequest,
  generateMultiDocInstructions,
  hasEnoughDetailToGenerate,
  generateDocumentResponseMessage,
  getDocumentSchemaPrompt,
} from '../documents';

// -------------------------------------------------------------------
// getDocumentTypeName
// -------------------------------------------------------------------
describe('getDocumentTypeName', () => {
  it('should return correct name for xlsx', () => {
    expect(getDocumentTypeName('xlsx')).toBe('Excel spreadsheet');
  });

  it('should return correct name for docx', () => {
    expect(getDocumentTypeName('docx')).toBe('Word document');
  });

  it('should return correct name for pptx', () => {
    expect(getDocumentTypeName('pptx')).toBe('PowerPoint presentation');
  });

  it('should return correct name for pdf', () => {
    expect(getDocumentTypeName('pdf')).toBe('PDF');
  });

  it('should return "document" for unknown type', () => {
    expect(getDocumentTypeName('txt')).toBe('document');
  });
});

// -------------------------------------------------------------------
// detectDocumentIntent
// -------------------------------------------------------------------
describe('detectDocumentIntent', () => {
  it('should detect Excel intent', () => {
    expect(detectDocumentIntent('Create a budget spreadsheet for me')).toBe('xlsx');
  });

  it('should detect Excel from tracker pattern', () => {
    expect(detectDocumentIntent('I need an expense tracker')).toBe('xlsx');
  });

  it('should detect Word intent', () => {
    expect(detectDocumentIntent('Write a formal letter to my employer')).toBe('docx');
  });

  it('should detect Word from contract pattern', () => {
    expect(detectDocumentIntent('Draft an NDA agreement')).toBe('docx');
  });

  it('should detect PDF intent', () => {
    expect(detectDocumentIntent('Create a PDF invoice for my client')).toBe('pdf');
  });

  it('should detect PDF from certificate pattern', () => {
    expect(detectDocumentIntent('Generate a certificate of completion')).toBe('pdf');
  });

  it('should detect PowerPoint intent', () => {
    expect(detectDocumentIntent('Create a presentation about marketing')).toBe('pptx');
  });

  it('should return null for non-document request', () => {
    expect(detectDocumentIntent('What is the capital of France?')).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(detectDocumentIntent('')).toBeNull();
  });

  it('should detect edit request with conversation history', () => {
    const history = [
      { role: 'assistant', content: 'Created your doc [document_download:{"type":"xlsx"}]' },
    ];
    const result = detectDocumentIntent('Change the column headers', history);
    expect(result).toBe('xlsx');
  });

  it('should detect PDF edit from history', () => {
    const history = [
      { role: 'assistant', content: 'Here is your invoice [document_download:{"type":"pdf"}]' },
    ];
    expect(detectDocumentIntent('Fix the date on it', history)).toBe('pdf');
  });
});

// -------------------------------------------------------------------
// detectDocumentSubtype
// -------------------------------------------------------------------
describe('detectDocumentSubtype', () => {
  // Excel subtypes
  it('should detect budget subtype', () => {
    expect(detectDocumentSubtype('xlsx', 'Create a monthly budget')).toBe('budget');
  });

  it('should detect expense_tracker subtype', () => {
    expect(detectDocumentSubtype('xlsx', 'Track my expenses')).toBe('expense_tracker');
  });

  it('should detect inventory subtype', () => {
    expect(detectDocumentSubtype('xlsx', 'Inventory stock management')).toBe('inventory');
  });

  it('should detect timesheet subtype', () => {
    expect(detectDocumentSubtype('xlsx', 'Create a timesheet for employees')).toBe('timesheet');
  });

  it('should default to general_spreadsheet', () => {
    expect(detectDocumentSubtype('xlsx', 'Create a spreadsheet')).toBe('general_spreadsheet');
  });

  // Word subtypes
  it('should detect cover_letter subtype', () => {
    expect(detectDocumentSubtype('docx', 'Write a cover letter')).toBe('cover_letter');
  });

  it('should detect memo subtype', () => {
    expect(detectDocumentSubtype('docx', 'Create a memo about policy changes')).toBe('memo');
  });

  it('should detect contract subtype', () => {
    expect(detectDocumentSubtype('docx', 'Draft a service agreement')).toBe('contract');
  });

  it('should detect proposal subtype', () => {
    expect(detectDocumentSubtype('docx', 'Write a business proposal')).toBe('proposal');
  });

  it('should default to general_document for docx', () => {
    expect(detectDocumentSubtype('docx', 'Create a document')).toBe('general_document');
  });

  // PDF subtypes
  it('should detect invoice subtype', () => {
    expect(detectDocumentSubtype('pdf', 'Generate an invoice')).toBe('invoice');
  });

  it('should detect certificate subtype', () => {
    expect(detectDocumentSubtype('pdf', 'Create a certificate')).toBe('certificate');
  });

  it('should detect flyer subtype', () => {
    expect(detectDocumentSubtype('pdf', 'Make a flyer for our event')).toBe('flyer');
  });

  it('should default to general_pdf', () => {
    expect(detectDocumentSubtype('pdf', 'Create a PDF')).toBe('general_pdf');
  });

  // Unknown type
  it('should return general for unknown type', () => {
    expect(detectDocumentSubtype('unknown', 'something')).toBe('general');
  });
});

// -------------------------------------------------------------------
// extractPreviousDocumentContext
// -------------------------------------------------------------------
describe('extractPreviousDocumentContext', () => {
  it('should extract context from DOCUMENT_DOWNLOAD marker', () => {
    const messages = [
      { role: 'user', content: 'Create a budget spreadsheet' },
      {
        role: 'assistant',
        content:
          'Here is your document [DOCUMENT_DOWNLOAD:{"type":"xlsx","filename":"budget.xlsx"}]',
      },
    ];
    const result = extractPreviousDocumentContext(messages);
    expect(result.originalRequest).toBe('Create a budget spreadsheet');
    expect(result.documentType).toBe('xlsx');
  });

  it('should return nulls when no document found', () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ];
    const result = extractPreviousDocumentContext(messages);
    expect(result.originalRequest).toBeNull();
    expect(result.documentType).toBeNull();
    expect(result.documentDescription).toBeNull();
  });

  it('should handle empty messages array', () => {
    const result = extractPreviousDocumentContext([]);
    expect(result.originalRequest).toBeNull();
  });
});

// -------------------------------------------------------------------
// buildDocumentContext
// -------------------------------------------------------------------
describe('buildDocumentContext', () => {
  it('should build context with memory', () => {
    const result = buildDocumentContext(
      'Create invoice',
      'Company: ACME Corp',
      {
        originalRequest: null,
        documentType: null,
        documentDescription: null,
      },
      false
    );
    expect(result).toContain('ACME Corp');
    expect(result).toContain('USER CONTEXT');
  });

  it('should build edit context', () => {
    const result = buildDocumentContext(
      'Change the date',
      null,
      {
        originalRequest: 'Create invoice',
        documentType: 'pdf',
        documentDescription: 'Invoice for client',
      },
      true
    );
    expect(result).toContain('EDIT MODE');
    expect(result).toContain('Create invoice');
    expect(result).toContain('Change the date');
  });

  it('should return empty string with no context', () => {
    const result = buildDocumentContext(
      'Create something',
      null,
      {
        originalRequest: null,
        documentType: null,
        documentDescription: null,
      },
      false
    );
    expect(result).toBe('');
  });
});

// -------------------------------------------------------------------
// detectStyleMatchRequest
// -------------------------------------------------------------------
describe('detectStyleMatchRequest', () => {
  it('should detect "make it like this" pattern', () => {
    const result = detectStyleMatchRequest('Make one like this uploaded file');
    expect(result.wantsStyleMatch).toBe(true);
  });

  it('should detect "same style as" pattern', () => {
    const result = detectStyleMatchRequest('Use the same style as my template');
    expect(result.wantsStyleMatch).toBe(true);
  });

  it('should not detect style match for regular request', () => {
    const result = detectStyleMatchRequest('Create a new spreadsheet');
    expect(result.wantsStyleMatch).toBe(false);
  });

  it('should extract uploaded file info from conversation history', () => {
    const history = [
      { role: 'user', content: '=== Sheet: Budget ===\nCategory\tAmount\nRent\t1500' },
    ];
    const result = detectStyleMatchRequest('Make one like this', history);
    expect(result.wantsStyleMatch).toBe(true);
    expect(result.uploadedFileInfo).toContain('Sheet: Budget');
  });
});

// -------------------------------------------------------------------
// generateStyleMatchInstructions
// -------------------------------------------------------------------
describe('generateStyleMatchInstructions', () => {
  it('should generate spreadsheet style instructions', () => {
    const content = '=== Sheet: Budget ===\nCategory\tAmount\nRent\t1500';
    const result = generateStyleMatchInstructions(content);
    expect(result).toContain('STYLE MATCHING INSTRUCTIONS');
    expect(result).toContain('spreadsheet');
  });

  it('should generate PDF style instructions', () => {
    const content =
      'Pages: 3\nEXPERIENCE\nSoftware Engineer at ACME\nEDUCATION\nBS Computer Science';
    const result = generateStyleMatchInstructions(content);
    expect(result).toContain('resume');
  });

  it('should return empty string for unrecognized content', () => {
    const result = generateStyleMatchInstructions('some random text');
    expect(result).toBe('');
  });
});

// -------------------------------------------------------------------
// detectMultiDocumentRequest
// -------------------------------------------------------------------
describe('detectMultiDocumentRequest', () => {
  it('should detect combine documents request', () => {
    const result = detectMultiDocumentRequest('Combine the two documents into one');
    expect(result.isMultiDoc).toBe(true);
  });

  it('should detect merge data request', () => {
    const result = detectMultiDocumentRequest('Merge data from both files');
    expect(result.isMultiDoc).toBe(true);
  });

  it('should not detect for single document request', () => {
    const result = detectMultiDocumentRequest('Create a spreadsheet');
    expect(result.isMultiDoc).toBe(false);
  });

  it('should find uploaded docs in history', () => {
    const history = [
      { role: 'user', content: '=== Sheet: Data ===\nCol1\tCol2\nA\tB' },
      {
        role: 'user',
        content:
          'Pages: 2\nSome PDF content here that is longer than 100 chars. This text needs to be long enough to be detected as PDF content by the function.',
      },
    ];
    const result = detectMultiDocumentRequest(
      'Combine the documents and merge data from both files',
      history
    );
    expect(result.isMultiDoc).toBe(true);
    expect(result.uploadedDocs).toHaveLength(2);
    expect(result.uploadedDocs[0].type).toBe('spreadsheet');
    expect(result.uploadedDocs[1].type).toBe('pdf');
  });
});

// -------------------------------------------------------------------
// generateMultiDocInstructions
// -------------------------------------------------------------------
describe('generateMultiDocInstructions', () => {
  it('should return empty string for no docs', () => {
    expect(generateMultiDocInstructions([], [], 'combine')).toBe('');
  });

  it('should describe spreadsheet document', () => {
    const docs = [
      { content: '=== Sheet: Sales ===\nItem\tPrice\nWidget\t10', type: 'spreadsheet' as const },
    ];
    const result = generateMultiDocInstructions(docs, [], 'combine them');
    expect(result).toContain('DOCUMENT 1 (Spreadsheet)');
    expect(result).toContain('MULTI-DOCUMENT EXTRACTION MODE');
  });

  it('should describe PDF document', () => {
    const docs = [{ content: 'Pages: 1\nDear Mr. Smith,\nSincerely,\nJohn', type: 'pdf' as const }];
    const result = generateMultiDocInstructions(docs, [], 'extract info');
    expect(result).toContain('PDF');
  });
});

// -------------------------------------------------------------------
// hasEnoughDetailToGenerate
// -------------------------------------------------------------------
describe('hasEnoughDetailToGenerate', () => {
  it('should return true for "just create it"', () => {
    expect(hasEnoughDetailToGenerate('just create it', 'pdf')).toBe(true);
  });

  it('should return true for "go ahead"', () => {
    expect(hasEnoughDetailToGenerate('go ahead', 'xlsx')).toBe(true);
  });

  it('should return true for "proceed"', () => {
    expect(hasEnoughDetailToGenerate('proceed', 'docx')).toBe(true);
  });

  it('should return true for edit requests', () => {
    expect(hasEnoughDetailToGenerate('Change the title to something better', 'pdf')).toBe(true);
  });

  it('should return true when conversation has AI asking questions', () => {
    const history = [{ role: 'assistant', content: 'What type of spreadsheet would you like?' }];
    expect(hasEnoughDetailToGenerate('a budget one', 'xlsx', history)).toBe(true);
  });

  it('should return true for detailed messages with amounts', () => {
    expect(
      hasEnoughDetailToGenerate(
        'Create an invoice for $500 to John Smith for consulting services',
        'pdf'
      )
    ).toBe(true);
  });

  it('should return false for vague requests', () => {
    expect(hasEnoughDetailToGenerate('make me one', 'pdf')).toBe(false);
  });
});

// -------------------------------------------------------------------
// generateDocumentResponseMessage
// -------------------------------------------------------------------
describe('generateDocumentResponseMessage', () => {
  it('should include filename in message', () => {
    const result = generateDocumentResponseMessage('xlsx', 'budget.xlsx', 'budget');
    expect(result).toContain('budget.xlsx');
  });

  it('should include Excel-specific content for xlsx', () => {
    const result = generateDocumentResponseMessage('xlsx', 'budget.xlsx', 'budget');
    expect(result).toContain('formulas');
    expect(result).toContain('Excel spreadsheet');
  });

  it('should include PDF preview tip', () => {
    const result = generateDocumentResponseMessage('pdf', 'invoice.pdf', 'invoice');
    expect(result).toContain('Preview');
    expect(result).toContain('PDF');
  });

  it('should include Word customize message', () => {
    const result = generateDocumentResponseMessage('docx', 'letter.docx', 'formal_letter');
    expect(result).toContain('Word');
    expect(result).toContain('customize');
  });

  it('should include download and edit options', () => {
    const result = generateDocumentResponseMessage('pdf', 'doc.pdf', 'general_pdf');
    expect(result).toContain('Download');
    expect(result).toContain('Edit');
  });
});

// -------------------------------------------------------------------
// getDocumentSchemaPrompt
// -------------------------------------------------------------------
describe('getDocumentSchemaPrompt', () => {
  it('should return xlsx prompt for spreadsheet type', () => {
    const result = getDocumentSchemaPrompt('xlsx', 'Create a budget');
    expect(result).toContain('spreadsheet');
    expect(result).toContain('JSON');
    expect(result).toContain('BUDGET SPREADSHEET');
  });

  it('should return docx prompt for document type', () => {
    const result = getDocumentSchemaPrompt('docx', 'Write a cover letter');
    expect(result).toContain('document');
    expect(result).toContain('COVER LETTER');
  });

  it('should return pdf invoice prompt', () => {
    const result = getDocumentSchemaPrompt('pdf', 'Create an invoice');
    expect(result).toContain('invoice');
  });

  it('should return pdf certificate prompt', () => {
    const result = getDocumentSchemaPrompt('pdf', 'Generate a certificate');
    expect(result).toContain('certificate');
  });

  it('should return general pdf prompt for generic request', () => {
    const result = getDocumentSchemaPrompt('pdf', 'Create a PDF');
    expect(result).toContain('general_pdf');
  });

  it('should return fallback for unknown type', () => {
    const result = getDocumentSchemaPrompt('unknown');
    expect(result).toContain('document');
  });
});
