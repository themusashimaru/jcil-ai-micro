/**
 * INVOICE GENERATOR
 * Creates professional PDF invoices from JSON invoice data
 *
 * Uses PDFKit library to generate professional invoices
 * Supports itemized billing, taxes, and custom formatting
 */

import PDFDocument from 'pdfkit';
import type { InvoiceDocument } from './types';

// Default styling
const DEFAULT_PRIMARY_COLOR = '#1e3a5f'; // Navy blue
const DEFAULT_CURRENCY = 'USD';

/**
 * Generate a PDF invoice from invoice JSON
 */
export async function generateInvoicePdf(invoice: InvoiceDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margin: 50,
        info: {
          Title: `Invoice ${invoice.invoiceNumber}`,
          Author: 'JCIL.AI',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const primaryColor = invoice.format?.primaryColor || DEFAULT_PRIMARY_COLOR;
      const currency = invoice.format?.currency || DEFAULT_CURRENCY;
      const currencySymbol = getCurrencySymbol(currency);

      // ========================================
      // HEADER
      // ========================================
      doc.fontSize(28).fillColor(primaryColor).text('INVOICE', { align: 'right' });
      doc.moveDown(0.5);

      // Invoice details on the right
      doc.fontSize(10).fillColor('#333333');
      doc.text(`Invoice #: ${invoice.invoiceNumber}`, { align: 'right' });
      doc.text(`Date: ${invoice.date}`, { align: 'right' });
      if (invoice.dueDate) {
        doc.text(`Due Date: ${invoice.dueDate}`, { align: 'right' });
      }
      doc.moveDown(2);

      // ========================================
      // FROM / TO SECTIONS
      // ========================================
      const fromToY = doc.y;

      // FROM section (left side)
      doc.fontSize(10).fillColor(primaryColor).text('FROM:', 50, fromToY);
      doc.fontSize(10).fillColor('#333333');
      doc.text(invoice.from.name, 50, doc.y + 5, { width: 200 });
      if (invoice.from.address) {
        invoice.from.address.forEach((line) => {
          doc.text(line, 50, doc.y, { width: 200 });
        });
      }
      if (invoice.from.phone) doc.text(invoice.from.phone);
      if (invoice.from.email) doc.text(invoice.from.email);

      // TO section (right side)
      doc.fontSize(10).fillColor(primaryColor).text('BILL TO:', 350, fromToY);
      doc.fontSize(10).fillColor('#333333');
      doc.text(invoice.to.name, 350, doc.y + 5, { width: 200 });
      if (invoice.to.address) {
        invoice.to.address.forEach((line) => {
          doc.text(line, 350, doc.y, { width: 200 });
        });
      }
      if (invoice.to.phone) doc.text(invoice.to.phone, 350, doc.y);
      if (invoice.to.email) doc.text(invoice.to.email, 350, doc.y);

      doc.moveDown(3);

      // ========================================
      // ITEMS TABLE
      // ========================================
      const tableTop = doc.y;
      const tableLeft = 50;
      const colWidths = {
        description: 250,
        quantity: 70,
        unitPrice: 90,
        total: 90,
      };

      // Table header
      doc.fillColor(primaryColor).rect(tableLeft, tableTop, 500, 25).fill();
      doc.fillColor('#ffffff').fontSize(10);
      doc.text('Description', tableLeft + 10, tableTop + 7, { width: colWidths.description });
      doc.text('Qty', tableLeft + colWidths.description + 10, tableTop + 7, {
        width: colWidths.quantity,
        align: 'center',
      });
      doc.text('Unit Price', tableLeft + colWidths.description + colWidths.quantity + 10, tableTop + 7, {
        width: colWidths.unitPrice,
        align: 'right',
      });
      doc.text(
        'Total',
        tableLeft + colWidths.description + colWidths.quantity + colWidths.unitPrice + 10,
        tableTop + 7,
        { width: colWidths.total, align: 'right' }
      );

      // Table rows
      let rowY = tableTop + 25;
      doc.fillColor('#333333');

      invoice.items.forEach((item, index) => {
        const itemTotal = item.total ?? item.quantity * item.unitPrice;

        // Alternating row colors
        if (index % 2 === 0) {
          doc.fillColor('#f9f9f9').rect(tableLeft, rowY, 500, 25).fill();
        }

        doc.fillColor('#333333').fontSize(10);
        doc.text(item.description, tableLeft + 10, rowY + 7, { width: colWidths.description });
        doc.text(item.quantity.toString(), tableLeft + colWidths.description + 10, rowY + 7, {
          width: colWidths.quantity,
          align: 'center',
        });
        doc.text(
          `${currencySymbol}${item.unitPrice.toFixed(2)}`,
          tableLeft + colWidths.description + colWidths.quantity + 10,
          rowY + 7,
          { width: colWidths.unitPrice, align: 'right' }
        );
        doc.text(
          `${currencySymbol}${itemTotal.toFixed(2)}`,
          tableLeft + colWidths.description + colWidths.quantity + colWidths.unitPrice + 10,
          rowY + 7,
          { width: colWidths.total, align: 'right' }
        );

        rowY += 25;
      });

      // Table border
      doc.strokeColor('#cccccc').rect(tableLeft, tableTop, 500, rowY - tableTop).stroke();

      // ========================================
      // TOTALS
      // ========================================
      const totalsX = 400;
      let totalsY = rowY + 20;

      // Calculate totals
      const subtotal =
        invoice.subtotal ??
        invoice.items.reduce((sum, item) => sum + (item.total ?? item.quantity * item.unitPrice), 0);

      const tax = invoice.tax ?? (invoice.taxRate ? subtotal * (invoice.taxRate / 100) : 0);
      const total = invoice.total ?? subtotal + tax;

      doc.fontSize(10).fillColor('#333333');

      // Subtotal
      doc.text('Subtotal:', totalsX, totalsY);
      doc.text(`${currencySymbol}${subtotal.toFixed(2)}`, totalsX + 70, totalsY, { align: 'right', width: 80 });
      totalsY += 20;

      // Tax (if applicable)
      if (tax > 0 || invoice.taxRate) {
        const taxLabel = invoice.taxRate ? `Tax (${invoice.taxRate}%):` : 'Tax:';
        doc.text(taxLabel, totalsX, totalsY);
        doc.text(`${currencySymbol}${tax.toFixed(2)}`, totalsX + 70, totalsY, { align: 'right', width: 80 });
        totalsY += 20;
      }

      // Total (bold)
      doc.fontSize(12).fillColor(primaryColor).font('Helvetica-Bold');
      doc.text('TOTAL:', totalsX, totalsY);
      doc.text(`${currencySymbol}${total.toFixed(2)}`, totalsX + 70, totalsY, { align: 'right', width: 80 });
      doc.font('Helvetica');

      // ========================================
      // NOTES / PAYMENT TERMS
      // ========================================
      if (invoice.notes || invoice.paymentTerms) {
        doc.moveDown(3);
        doc.fontSize(10).fillColor('#333333');

        if (invoice.paymentTerms) {
          doc.fillColor(primaryColor).text('Payment Terms:', 50, doc.y);
          doc.fillColor('#333333').text(invoice.paymentTerms, 50, doc.y + 5);
          doc.moveDown();
        }

        if (invoice.notes) {
          doc.fillColor(primaryColor).text('Notes:', 50, doc.y);
          doc.fillColor('#333333').text(invoice.notes, 50, doc.y + 5);
        }
      }

      // ========================================
      // FOOTER
      // ========================================
      doc.fontSize(8).fillColor('#999999');
      doc.text('Generated by JCIL.AI', 50, 730, { align: 'center', width: 500 });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Get currency symbol from currency code
 */
function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CAD: 'C$',
    AUD: 'A$',
    CHF: 'CHF ',
    CNY: '¥',
    INR: '₹',
    MXN: 'MX$',
    BRL: 'R$',
  };
  return symbols[currency.toUpperCase()] || `${currency} `;
}
