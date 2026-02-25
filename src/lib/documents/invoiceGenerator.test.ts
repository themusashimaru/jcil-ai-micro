/**
 * Tests for Invoice PDF Generator
 *
 * Tests generateInvoicePdf with mocked PDFKit
 */

vi.mock('pdfkit', () => {
  class SimpleEmitter {
    private _listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
    on(event: string, fn: (...args: unknown[]) => void) {
      (this._listeners[event] ??= []).push(fn);
      return this;
    }
    emit(event: string, ...args: unknown[]) {
      this._listeners[event]?.forEach((fn) => fn(...args));
      return true;
    }
  }

  class MockPDFDocument extends SimpleEmitter {
    page = {
      width: 612,
      height: 792,
    };
    y = 50;

    constructor(public options?: Record<string, unknown>) {
      super();
    }
    font() {
      return this;
    }
    fontSize() {
      return this;
    }
    fillColor() {
      return this;
    }
    strokeColor() {
      return this;
    }
    lineWidth() {
      return this;
    }
    text(_text: string, _x?: number, _y?: number, _opts?: unknown) {
      return this;
    }
    moveDown(n: number = 1) {
      this.y += n * 12;
      return this;
    }
    moveTo() {
      return this;
    }
    lineTo() {
      return this;
    }
    stroke() {
      return this;
    }
    rect(_x: number, _y: number, _w: number, _h: number) {
      return this;
    }
    fill() {
      return this;
    }
    addPage() {
      this.y = 50;
      return this;
    }
    end() {
      this.emit('data', Buffer.from('%PDF-invoice-mock'));
      this.emit('end');
    }
  }

  return { default: MockPDFDocument };
});

import { describe, it, expect, vi } from 'vitest';
import { generateInvoicePdf } from './invoiceGenerator';
import type { InvoiceDocument } from './types';

const baseInvoice: InvoiceDocument = {
  type: 'invoice',
  invoiceNumber: 'INV-2026-001',
  date: '2026-02-25',
  from: { name: 'Business Inc.' },
  to: { name: 'Client Corp.' },
  items: [{ description: 'Consulting Service', quantity: 10, unitPrice: 150 }],
};

describe('generateInvoicePdf', () => {
  it('should generate a PDF buffer from a basic invoice', async () => {
    const buffer = await generateInvoicePdf(baseInvoice);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should handle invoice with multiple items', async () => {
    const invoice: InvoiceDocument = {
      ...baseInvoice,
      items: [
        { description: 'Service A', quantity: 5, unitPrice: 100 },
        { description: 'Service B', quantity: 3, unitPrice: 200 },
        { description: 'Service C', quantity: 1, unitPrice: 500 },
      ],
    };

    const buffer = await generateInvoicePdf(invoice);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle invoice with due date', async () => {
    const invoice: InvoiceDocument = {
      ...baseInvoice,
      dueDate: '2026-03-25',
    };

    const buffer = await generateInvoicePdf(invoice);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle invoice with full from/to addresses', async () => {
    const invoice: InvoiceDocument = {
      ...baseInvoice,
      from: {
        name: 'Business Inc.',
        address: ['123 Main St', 'Suite 100', 'New York, NY 10001'],
        phone: '555-123-4567',
        email: 'billing@business.com',
      },
      to: {
        name: 'Client Corp.',
        address: ['456 Oak Ave', 'Boston, MA 02101'],
        phone: '555-987-6543',
        email: 'accounts@client.com',
      },
    };

    const buffer = await generateInvoicePdf(invoice);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle invoice with tax rate', async () => {
    const invoice: InvoiceDocument = {
      ...baseInvoice,
      taxRate: 8.25,
    };

    const buffer = await generateInvoicePdf(invoice);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle invoice with pre-calculated totals', async () => {
    const invoice: InvoiceDocument = {
      ...baseInvoice,
      subtotal: 1500,
      tax: 123.75,
      total: 1623.75,
    };

    const buffer = await generateInvoicePdf(invoice);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle invoice items with pre-calculated totals', async () => {
    const invoice: InvoiceDocument = {
      ...baseInvoice,
      items: [{ description: 'Discounted Service', quantity: 10, unitPrice: 100, total: 900 }],
    };

    const buffer = await generateInvoicePdf(invoice);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle invoice with notes and payment terms', async () => {
    const invoice: InvoiceDocument = {
      ...baseInvoice,
      notes: 'Thank you for your business!',
      paymentTerms: 'Net 30 - Please pay within 30 days',
    };

    const buffer = await generateInvoicePdf(invoice);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle invoice with custom primary color', async () => {
    const invoice: InvoiceDocument = {
      ...baseInvoice,
      format: {
        primaryColor: '#ff0000',
      },
    };

    const buffer = await generateInvoicePdf(invoice);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle invoice with EUR currency', async () => {
    const invoice: InvoiceDocument = {
      ...baseInvoice,
      format: {
        currency: 'EUR',
      },
    };

    const buffer = await generateInvoicePdf(invoice);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle invoice with GBP currency', async () => {
    const invoice: InvoiceDocument = {
      ...baseInvoice,
      format: {
        currency: 'GBP',
      },
    };

    const buffer = await generateInvoicePdf(invoice);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle invoice with unknown currency code', async () => {
    const invoice: InvoiceDocument = {
      ...baseInvoice,
      format: {
        currency: 'XYZ',
      },
    };

    const buffer = await generateInvoicePdf(invoice);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle invoice with only notes (no payment terms)', async () => {
    const invoice: InvoiceDocument = {
      ...baseInvoice,
      notes: 'A note',
    };

    const buffer = await generateInvoicePdf(invoice);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle invoice with only payment terms (no notes)', async () => {
    const invoice: InvoiceDocument = {
      ...baseInvoice,
      paymentTerms: 'Due on receipt',
    };

    const buffer = await generateInvoicePdf(invoice);
    expect(buffer).toBeInstanceOf(Buffer);
  });
});
