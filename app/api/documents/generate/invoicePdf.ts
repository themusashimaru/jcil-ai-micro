/**
 * INVOICE PDF GENERATION
 *
 * Parses markdown invoice content into structured data and
 * renders it as a professional PDF using jsPDF.
 * Extracted from route.ts for modularity.
 */

import { jsPDF } from 'jspdf';
import { logger } from '@/lib/logger';

const log = logger('DocumentsGenerate');

export interface InvoiceData {
  companyName: string;
  companyAddress: string[];
  invoiceNumber: string;
  invoiceDate: string;
  customerId: string;
  billTo: string[];
  shipTo: string[];
  salesperson: string;
  poNumber: string;
  shipDate: string;
  shipVia: string;
  fob: string;
  terms: string;
  items: Array<{
    itemNumber: string;
    description: string;
    qty: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  taxRate: number;
  tax: number;
  shipping: number;
  other: number;
  total: number;
  notes: string[];
  payableTo: string;
}

/**
 * Parse invoice content from markdown/text to structured data
 */
export function parseInvoiceContent(content: string): InvoiceData {
  // Strip markdown formatting before parsing
  const cleanContent = content
    .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.+?)\*/g, '$1') // Remove italic
    .replace(/^#+\s*/gm, '') // Remove headers
    .replace(/`(.+?)`/g, '$1'); // Remove code formatting

  const lines = cleanContent
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l);

  // Debug: Log first 20 lines to see what we're parsing
  log.info('Invoice Parser: Parsing content', { firstLines: lines.slice(0, 20) });

  const data: InvoiceData = {
    companyName: '[Your Company Name]',
    companyAddress: ['[Street Address]', '[City, ST ZIP]', 'Phone: [000-000-0000]'],
    invoiceNumber: 'INV-' + Date.now().toString().slice(-6),
    invoiceDate: new Date().toLocaleDateString(),
    customerId: '',
    billTo: ['[Customer Name]', '[Company]', '[Address]', '[City, ST ZIP]'],
    shipTo: [],
    salesperson: '',
    poNumber: '',
    shipDate: '',
    shipVia: '',
    fob: '',
    terms: 'Net 30',
    items: [],
    subtotal: 0,
    taxRate: 0,
    tax: 0,
    shipping: 0,
    other: 0,
    total: 0,
    notes: [],
    payableTo: '',
  };

  let currentSection = '';

  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    // Skip common header lines
    if (
      lowerLine === 'invoice draft:' ||
      lowerLine === 'invoice:' ||
      lowerLine === 'invoice draft' ||
      lowerLine === 'invoice' ||
      lowerLine === 'here is your invoice:' ||
      lowerLine === 'here is your invoice'
    ) {
      continue;
    }

    // Extract company name (various formats) - try multiple patterns

    // Pattern 1: "# Company Name" (markdown header)
    if (line.startsWith('# ') && data.companyName.includes('[')) {
      data.companyName = line.slice(2).trim();
      log.info('Invoice Parser: Found company name (header)', { companyName: data.companyName });
      continue;
    }

    // Pattern 2: "Business: Name" or "From: Name" or "Company: Name"
    const businessMatch = line.match(/^(?:business|from|company)[:\s]+(.+)/i);
    if (businessMatch && data.companyName.includes('[')) {
      data.companyName = businessMatch[1].trim();
      log.info('Invoice Parser: Found company name (business/from)', {
        companyName: data.companyName,
      });
      continue;
    }

    // Pattern 3: "Invoice: CompanyName" (AI sometimes outputs company after "Invoice:")
    const invoiceCompanyMatch = line.match(/^invoice[:\s]+([A-Za-z].+)/i);
    if (
      invoiceCompanyMatch &&
      data.companyName.includes('[') &&
      !/\d/.test(invoiceCompanyMatch[1])
    ) {
      data.companyName = invoiceCompanyMatch[1].trim();
      log.info('Invoice Parser: Found company name (invoice:)', { companyName: data.companyName });
      continue;
    }

    // Pattern 4: First meaningful line is company name (no colon, starts with capital)
    // This handles cases like "Kaylan's Bridal" as the first line
    if (data.companyName.includes('[') && data.items.length === 0) {
      // Must start with capital letter, can contain apostrophes, not be a common keyword
      const isCompanyName =
        /^[A-Z][A-Za-z']+/.test(line) &&
        !lowerLine.includes('invoice') &&
        !lowerLine.includes('bill') &&
        !lowerLine.includes('date') &&
        !lowerLine.includes('due') &&
        !lowerLine.includes('total') &&
        !lowerLine.includes('item') &&
        !lowerLine.includes('description') &&
        !lowerLine.includes('subtotal') &&
        !lowerLine.includes('tax') &&
        !lowerLine.includes('payment') &&
        !lowerLine.includes('ship') &&
        !lowerLine.includes('note');

      // Either no colon, or colon is part of time/money
      const hasNoMeaningfulColon = !line.includes(':') || /^[^:]+:\s*\$/.test(line);

      if (isCompanyName && hasNoMeaningfulColon) {
        // Extract company name (might have city/state after it)
        // Handle: "Kaylan's Bridal" or "Kaylan's Bridal New Philadelphia, Ohio"
        const parts = line.split(/\s+(?=[A-Z][a-z]+,?\s+[A-Z]{2})/);
        data.companyName = parts[0].trim();
        if (parts[1]) {
          data.companyAddress = [parts[1].trim()];
        }
        log.info('Invoice Parser: Found company name (first line)', {
          companyName: data.companyName,
        });
        continue;
      }
    }

    // Pattern 5: Address line (city, state) on second line - set as address
    if (
      data.companyName &&
      !data.companyName.includes('[') &&
      data.companyAddress[0]?.includes('[')
    ) {
      const cityStateMatch = line.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),?\s*([A-Z]{2})?$/);
      if (cityStateMatch && !lowerLine.includes(':')) {
        data.companyAddress = [line];
        log.info('Invoice Parser: Found company address', { line });
        continue;
      }
    }

    // Invoice number (only if contains digits)
    const invoiceMatch = line.match(/invoice\s*[#:]\s*([A-Z]*[-]?\d+)/i);
    if (invoiceMatch) {
      data.invoiceNumber = invoiceMatch[1];
    }

    // Date (avoid matching "Due Date", "Ship Date")
    const dateMatch = line.match(/^(?:invoice\s*)?date[:\s]+(.+)/i);
    if (dateMatch && !lowerLine.includes('ship') && !lowerLine.includes('due')) {
      data.invoiceDate = dateMatch[1].trim();
    }

    // Due Date - set terms
    const dueDateMatch = line.match(/due\s*date[:\s]+(.+)/i);
    if (dueDateMatch) {
      data.terms = `Due: ${dueDateMatch[1].trim()}`;
    }

    // Payment terms (various patterns)
    const paymentMatch = line.match(/(?:pay(?:ment)?|terms?)[:\s]+(?:within\s+)?(\d+)\s*days?/i);
    if (paymentMatch) {
      data.terms = `Net ${paymentMatch[1]}`;
    }
    // "Please pay within 7 days" pattern
    const pleasePayMatch = line.match(/please\s+pay\s+within\s+(\d+)\s*days?/i);
    if (pleasePayMatch) {
      data.terms = `Net ${pleasePayMatch[1]}`;
    }

    // Customer ID
    const customerMatch = line.match(/customer\s*(?:id|#)?[:\s]+(.+)/i);
    if (customerMatch) {
      data.customerId = customerMatch[1].trim();
    }

    // Bill To section
    if (
      lowerLine.includes('bill to') ||
      lowerLine.includes('billed to') ||
      lowerLine.startsWith('to:')
    ) {
      currentSection = 'billTo';
      data.billTo = [];
      // If "To: Name" is on the same line, extract the name
      const toNameMatch = line.match(/^to:\s*(.+)/i);
      if (toNameMatch) {
        data.billTo.push(toNameMatch[1].trim());
      }
      continue;
    }

    // Ship To section
    if (lowerLine.includes('ship to') || lowerLine.includes('shipping to')) {
      currentSection = 'shipTo';
      data.shipTo = [];
      continue;
    }

    // From/Company section
    if (lowerLine.startsWith('from:') || lowerLine.includes('company:')) {
      currentSection = 'company';
      const afterFrom = line.replace(/^from:|company:/i, '').trim();
      if (afterFrom) data.companyName = afterFrom;
      continue;
    }

    // Items/Products/Line Items/Description section - catch many variations
    if (
      lowerLine.includes('line item') ||
      lowerLine.includes('description of work') ||
      lowerLine === 'description:' ||
      lowerLine.startsWith('description:') ||
      lowerLine === 'description' ||
      (lowerLine.includes('item') && lowerLine.includes('description')) ||
      lowerLine === 'items:' ||
      lowerLine === 'services:' ||
      lowerLine.includes('services/items') ||
      lowerLine.includes('items/services') ||
      lowerLine.includes('breakdown:') ||
      lowerLine === 'breakdown' ||
      lowerLine.includes('charges:') ||
      lowerLine === 'charges'
    ) {
      currentSection = 'items';
      log.info('Invoice Parser: Entering items section', { line });
      continue;
    }

    // Materials section (AI often puts "Materials:" then items on next lines)
    if (lowerLine === 'materials:' || lowerLine === 'material:' || lowerLine === 'parts:') {
      currentSection = 'materials';
      continue;
    }

    // Labor section (AI often puts "Labor:" then items on next lines)
    if (lowerLine === 'labor:' || lowerLine === 'labour:' || lowerLine === 'services:') {
      currentSection = 'labor';
      continue;
    }

    // Notes section
    if (
      lowerLine.includes('note') ||
      lowerLine.includes('comment') ||
      lowerLine.includes('instruction')
    ) {
      currentSection = 'notes';
      continue;
    }

    // Parse totals
    const subtotalMatch = line.match(/subtotal[:\s]*\$?([\d,]+\.?\d*)/i);
    if (subtotalMatch) {
      data.subtotal = parseFloat(subtotalMatch[1].replace(/,/g, ''));
    }

    const taxRateMatch = line.match(/tax\s*rate[:\s]*([\d.]+)%?/i);
    if (taxRateMatch) {
      data.taxRate = parseFloat(taxRateMatch[1]);
    }

    // Tax amount (various formats)
    const taxMatch = line.match(/^(?:sales\s*)?tax(?:\s*\([\d.]+%\))?[:\s]*\$?([\d,]+\.?\d*)/i);
    if (taxMatch) {
      data.tax = parseFloat(taxMatch[1].replace(/,/g, ''));
    }
    // Also extract tax rate from "Sales Tax (6.75%):" format
    const taxRateInParens = line.match(/tax\s*\(([\d.]+)%\)/i);
    if (taxRateInParens) {
      data.taxRate = parseFloat(taxRateInParens[1]);
    }

    const shippingMatch = line.match(/shipping|s\s*&\s*h[:\s]*\$?([\d,]+\.?\d*)/i);
    if (shippingMatch) {
      data.shipping = parseFloat(shippingMatch[1].replace(/,/g, '')) || 0;
    }

    // Total (various formats: "Total:", "Total Due:", "Grand Total:", "Total Amount Due:")
    const totalMatch = line.match(
      /(?:grand\s*)?total(?:\s*amount)?(?:\s*due)?[:\s]*\$?([\d,]+\.?\d*)/i
    );
    if (totalMatch && !lowerLine.includes('subtotal')) {
      data.total = parseFloat(totalMatch[1].replace(/,/g, ''));
    }

    // Parse terms
    const termsMatch = line.match(/terms?[:\s]+(.+)/i);
    if (termsMatch) {
      data.terms = termsMatch[1].trim();
    }

    // Add to current section (with guards to prevent incorrect data)
    if (currentSection === 'billTo' && line) {
      // Don't add lines that look like invoice metadata, headers, or items
      const isBillToContent =
        !line.includes(':') &&
        !lowerLine.includes('invoice') &&
        !lowerLine.includes('description') &&
        !lowerLine.includes('quantity') &&
        !lowerLine.includes('unit price') &&
        !lowerLine.includes('total') &&
        !lowerLine.includes('items') &&
        !line.includes('|') &&
        !line.includes('@') &&
        !/\$[\d,]+/.test(line);
      if (isBillToContent) {
        data.billTo.push(line.replace(/^[-*•]\s*/, ''));
      }
    } else if (currentSection === 'shipTo' && line && !line.includes(':')) {
      data.shipTo.push(line.replace(/^[-*•]\s*/, ''));
    } else if (currentSection === 'company' && line && !line.includes(':')) {
      data.companyAddress.push(line.replace(/^[-*•]\s*/, ''));
    } else if (currentSection === 'notes' && line) {
      data.notes.push(line.replace(/^[-*•\d.]\s*/, ''));
    }

    // Handle items in ITEMS/DESCRIPTION section: "Fabric Costs: $500.00"
    if (currentSection === 'items') {
      const itemLineMatch = line.match(/^(.+?):\s*\$?([\d,]+\.?\d*)$/);
      if (
        itemLineMatch &&
        !lowerLine.includes('total') &&
        !lowerLine.includes('subtotal') &&
        !lowerLine.includes('tax')
      ) {
        const total = parseFloat(itemLineMatch[2].replace(/,/g, ''));
        if (total > 0) {
          data.items.push({
            itemNumber: '',
            description: itemLineMatch[1].trim(),
            qty: 1,
            unitPrice: total,
            total: total,
          });
          continue;
        }
      }
    }

    // Handle items in MATERIALS section: "Description: $4,500.00"
    if (currentSection === 'materials') {
      const matItemMatch = line.match(/^(.+?):\s*\$?([\d,]+\.?\d*)$/);
      if (matItemMatch && !lowerLine.includes('total')) {
        const total = parseFloat(matItemMatch[2].replace(/,/g, ''));
        if (total > 0) {
          data.items.push({
            itemNumber: '',
            description: `Materials - ${matItemMatch[1].trim()}`,
            qty: 1,
            unitPrice: total,
            total: total,
          });
          continue;
        }
      }
    }

    // Handle items in LABOR section: "Description: N hours @ $rate/hr: $total"
    if (currentSection === 'labor') {
      // Pattern: "Service Name: 25 hours @ $300.00/hr: $7,500.00"
      const labItemMatch = line.match(
        /^(.+?):\s*(\d+)\s*(?:hours?|hrs?)\s*[@x]\s*\$?([\d,]+\.?\d*)(?:\/(?:hour|hr))?[:\s=]*\$?([\d,]+\.?\d*)?/i
      );
      if (labItemMatch) {
        const qty = parseInt(labItemMatch[2]);
        const price = parseFloat(labItemMatch[3].replace(/,/g, ''));
        const total = labItemMatch[4] ? parseFloat(labItemMatch[4].replace(/,/g, '')) : qty * price;
        data.items.push({
          itemNumber: '',
          description: `Labor - ${labItemMatch[1].trim()} (${qty} hrs @ $${price.toFixed(2)}/hr)`,
          qty: qty,
          unitPrice: price,
          total: total,
        });
        continue;
      }
      // Simpler pattern: "Service Name: $amount"
      const simpleLabMatch = line.match(/^(.+?):\s*\$?([\d,]+\.?\d*)$/);
      if (simpleLabMatch && !lowerLine.includes('total')) {
        const total = parseFloat(simpleLabMatch[2].replace(/,/g, ''));
        if (total > 0) {
          data.items.push({
            itemNumber: '',
            description: `Labor - ${simpleLabMatch[1].trim()}`,
            qty: 1,
            unitPrice: total,
            total: total,
          });
          continue;
        }
      }
    }

    // PATTERN: "10 Pepperoni Pizzas @ $25.00: $250.00" (QTY DESC @ PRICE: TOTAL)
    // This common AI format has quantity at the START of the line
    const qtyFirstMatch = line.match(
      /^(\d+)\s+(.+?)\s*@\s*\$?([\d,]+\.?\d*)[:\s]*\$?([\d,]+\.?\d*)$/
    );
    if (qtyFirstMatch) {
      const qty = parseInt(qtyFirstMatch[1]);
      const desc = qtyFirstMatch[2].trim();
      const unitPrice = parseFloat(qtyFirstMatch[3].replace(/,/g, ''));
      const total = qtyFirstMatch[4]
        ? parseFloat(qtyFirstMatch[4].replace(/,/g, ''))
        : qty * unitPrice;
      log.info('Invoice Parser: Matched qty-first format', { desc, qty, unitPrice, total });
      data.items.push({
        itemNumber: '',
        description: desc,
        qty: qty,
        unitPrice: unitPrice,
        total: total,
      });
      continue;
    }

    // Parse item lines (look for patterns like "Product Name | 5 | $100 | $500")
    const itemMatch = line.match(
      /^(.+?)\s*[|]\s*(\d+)\s*[|]\s*\$?([\d,]+\.?\d*)\s*[|]\s*\$?([\d,]+\.?\d*)/
    );
    if (itemMatch) {
      data.items.push({
        itemNumber: '',
        description: itemMatch[1].trim(),
        qty: parseInt(itemMatch[2]),
        unitPrice: parseFloat(itemMatch[3].replace(/,/g, '')),
        total: parseFloat(itemMatch[4].replace(/,/g, '')),
      });
      continue;
    }

    // PATTERN 2: "Description - Qty: 5 @ $100 = $500"
    const altItemMatch = line.match(
      /^(.+?)\s*[-–]\s*(?:qty:?\s*)?(\d+)\s*[@x]\s*\$?([\d,]+\.?\d*)/i
    );
    if (altItemMatch && !itemMatch) {
      const qty = parseInt(altItemMatch[2]);
      const price = parseFloat(altItemMatch[3].replace(/,/g, ''));
      data.items.push({
        itemNumber: '',
        description: altItemMatch[1].trim(),
        qty: qty,
        unitPrice: price,
        total: qty * price,
      });
      continue;
    }

    // PATTERN 3: "Labor: 15 Hours @ $300.00/hr: $4,500.00" (common AI format)
    const laborMatch = line.match(
      /^(.+?):\s*(\d+)\s*(?:hours?|hrs?)\s*[@x]\s*\$?([\d,]+\.?\d*)(?:\/(?:hour|hr))?[:\s=]*\$?([\d,]+\.?\d*)?/i
    );
    if (laborMatch) {
      const qty = parseInt(laborMatch[2]);
      const price = parseFloat(laborMatch[3].replace(/,/g, ''));
      const total = laborMatch[4] ? parseFloat(laborMatch[4].replace(/,/g, '')) : qty * price;
      data.items.push({
        itemNumber: '',
        description: `${laborMatch[1].trim()} (${qty} hours @ $${price.toFixed(2)}/hr)`,
        qty: qty,
        unitPrice: price,
        total: total,
      });
      continue;
    }

    // PATTERN 4: "Materials: Description: $1,200.00" or "Materials (Circuit Breaker): $1200"
    const materialsMatch = line.match(
      /^(materials?|parts?|supplies?|equipment)[:\s]*(.+?)?\s*[:\s]\s*\$?([\d,]+\.?\d*)$/i
    );
    if (materialsMatch) {
      const desc = materialsMatch[2]?.trim().replace(/[:\s]+$/, '') || materialsMatch[1];
      const total = parseFloat(materialsMatch[3].replace(/,/g, ''));
      data.items.push({
        itemNumber: '',
        description: desc,
        qty: 1,
        unitPrice: total,
        total: total,
      });
      continue;
    }

    // PATTERN 5: Bullet point items "- Labor: $4,500.00"
    const bulletItemMatch = line.match(/^[-*•]\s*(.+?):\s*\$?([\d,]+\.?\d*)$/);
    if (
      bulletItemMatch &&
      !lowerLine.includes('total') &&
      !lowerLine.includes('subtotal') &&
      !lowerLine.includes('tax')
    ) {
      const total = parseFloat(bulletItemMatch[2].replace(/,/g, ''));
      data.items.push({
        itemNumber: '',
        description: bulletItemMatch[1].trim(),
        qty: 1,
        unitPrice: total,
        total: total,
      });
      continue;
    }

    // CATCH-ALL PATTERN: Any line with description followed by dollar amount
    // "Fabric Costs: $500.00" or "Design Work $450.00" or "- Wedding gown alterations: $800"
    const catchAllItemMatch = line.match(/^[-*•]?\s*(.+?)[\s:]+\$(\d[\d,]*\.?\d*)$/);
    if (catchAllItemMatch && data.items.length < 50) {
      // Limit to prevent over-matching
      const desc = catchAllItemMatch[1].trim();
      const amount = parseFloat(catchAllItemMatch[2].replace(/,/g, ''));
      // Skip if it looks like a total/subtotal/tax line
      if (
        amount > 0 &&
        !lowerLine.includes('total') &&
        !lowerLine.includes('subtotal') &&
        !lowerLine.includes('tax') &&
        !lowerLine.includes('shipping') &&
        !lowerLine.includes('amount due') &&
        desc.length > 2
      ) {
        log.info('Invoice Parser: Catch-all item', { desc, amount });
        data.items.push({
          itemNumber: '',
          description: desc,
          qty: 1,
          unitPrice: amount,
          total: amount,
        });
        continue;
      }
    }
  }

  // Calculate totals if not provided
  if (data.items.length > 0 && data.subtotal === 0) {
    data.subtotal = data.items.reduce((sum, item) => sum + item.total, 0);
  }
  if (data.tax === 0 && data.taxRate > 0) {
    data.tax = data.subtotal * (data.taxRate / 100);
  }
  if (data.total === 0) {
    data.total = data.subtotal + data.tax + data.shipping + data.other;
  }

  // Set payable to company name
  data.payableTo = data.companyName;

  // Debug: Log final parsed data
  log.info('Invoice Parser: Final parsed data', {
    companyName: data.companyName,
    invoiceNumber: data.invoiceNumber,
    itemCount: data.items.length,
    items: data.items.slice(0, 5), // First 5 items
    subtotal: data.subtotal,
    tax: data.tax,
    total: data.total,
    billTo: data.billTo.slice(0, 2),
  });

  return data;
}

/**
 * Generate professional invoice PDF
 */
export function generateInvoicePDF(doc: jsPDF, invoiceData: InvoiceData): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Colors
  const blueColor: [number, number, number] = [30, 64, 138];
  const darkBlue: [number, number, number] = [20, 45, 100];
  const black: [number, number, number] = [0, 0, 0];
  const gray: [number, number, number] = [100, 100, 100];
  const lightGray: [number, number, number] = [200, 200, 200];

  // === HEADER SECTION ===
  // Company name (left)
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...blueColor);
  doc.text(invoiceData.companyName, margin, y);

  // INVOICE title (right)
  doc.setFontSize(28);
  doc.setTextColor(...blueColor);
  doc.text('INVOICE', pageWidth - margin, y, { align: 'right' });

  y += 6;

  // Company address (left)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...gray);
  for (const line of invoiceData.companyAddress.slice(0, 4)) {
    doc.text(line, margin, y);
    y += 4;
  }

  // Invoice details (right) - Date, Invoice #, Customer ID
  let detailY = margin + 10;
  const detailX = pageWidth - margin - 50;
  const valueX = pageWidth - margin;

  doc.setFontSize(9);
  doc.setTextColor(...gray);
  doc.text('DATE', detailX, detailY);
  doc.setTextColor(...black);
  doc.text(invoiceData.invoiceDate, valueX, detailY, { align: 'right' });

  detailY += 5;
  doc.setTextColor(...gray);
  doc.text('INVOICE #', detailX, detailY);
  doc.setTextColor(...black);
  doc.text(invoiceData.invoiceNumber, valueX, detailY, { align: 'right' });

  if (invoiceData.customerId) {
    detailY += 5;
    doc.setTextColor(...gray);
    doc.text('CUSTOMER ID', detailX, detailY);
    doc.setTextColor(...black);
    doc.text(invoiceData.customerId, valueX, detailY, { align: 'right' });
  }

  y = Math.max(y, detailY) + 10;

  // === BILL TO / SHIP TO SECTION ===
  const billToWidth = contentWidth * 0.45;
  const shipToX = margin + billToWidth + 10;

  // Bill To header
  doc.setFillColor(...darkBlue);
  doc.rect(margin, y, billToWidth, 7, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('BILL TO:', margin + 3, y + 5);

  // Ship To header (if exists)
  if (invoiceData.shipTo.length > 0) {
    doc.rect(shipToX, y, billToWidth, 7, 'F');
    doc.text('SHIP TO:', shipToX + 3, y + 5);
  }

  y += 10;

  // Bill To content
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...black);
  for (const line of invoiceData.billTo.slice(0, 5)) {
    doc.text(line, margin + 3, y);
    y += 4;
  }

  // Ship To content
  if (invoiceData.shipTo.length > 0) {
    let shipY = y - invoiceData.billTo.slice(0, 5).length * 4;
    for (const line of invoiceData.shipTo.slice(0, 5)) {
      doc.text(line, shipToX + 3, shipY);
      shipY += 4;
    }
  }

  y += 8;

  // === SALESPERSON / PO INFO TABLE (if data exists) ===
  if (invoiceData.salesperson || invoiceData.poNumber || invoiceData.terms) {
    doc.setFillColor(...darkBlue);
    doc.rect(margin, y, contentWidth, 7, 'F');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);

    const cols = ['SALESPERSON', 'P.O.#', 'SHIP DATE', 'SHIP VIA', 'F.O.B.', 'TERMS'];
    const colWidth = contentWidth / 6;
    for (let i = 0; i < cols.length; i++) {
      doc.text(cols[i], margin + i * colWidth + 2, y + 5);
    }

    y += 7;

    // Values row
    doc.setDrawColor(...lightGray);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentWidth, 6);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...black);
    const values = [
      invoiceData.salesperson || '',
      invoiceData.poNumber || '',
      invoiceData.shipDate || '',
      invoiceData.shipVia || '',
      invoiceData.fob || '',
      invoiceData.terms || '',
    ];
    for (let i = 0; i < values.length; i++) {
      doc.text(values[i], margin + i * colWidth + 2, y + 4);
    }

    y += 10;
  }

  // === ITEMS TABLE ===
  // Header
  doc.setFillColor(...darkBlue);
  doc.rect(margin, y, contentWidth, 7, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);

  const itemCols = [
    { label: 'ITEM #', width: 25, align: 'left' as const },
    { label: 'DESCRIPTION', width: contentWidth - 95, align: 'left' as const },
    { label: 'QTY', width: 20, align: 'center' as const },
    { label: 'UNIT PRICE', width: 25, align: 'right' as const },
    { label: 'TOTAL', width: 25, align: 'right' as const },
  ];

  let colX = margin;
  for (const col of itemCols) {
    if (col.align === 'right') {
      doc.text(col.label, colX + col.width - 2, y + 5, { align: 'right' });
    } else if (col.align === 'center') {
      doc.text(col.label, colX + col.width / 2, y + 5, { align: 'center' });
    } else {
      doc.text(col.label, colX + 2, y + 5);
    }
    colX += col.width;
  }

  y += 7;

  // Item rows
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...black);

  const rowHeight = 7;
  const maxRows = 10;
  const itemsToShow = invoiceData.items.slice(0, maxRows);

  // Add sample items if none provided
  if (itemsToShow.length === 0) {
    itemsToShow.push({
      itemNumber: '[Item #]',
      description: '[Product/Service Description]',
      qty: 1,
      unitPrice: 0,
      total: 0,
    });
  }

  for (let i = 0; i < maxRows; i++) {
    const item = itemsToShow[i];

    // Alternating row background
    if (i % 2 === 0) {
      doc.setFillColor(248, 248, 248);
      doc.rect(margin, y, contentWidth, rowHeight, 'F');
    }

    // Row border
    doc.setDrawColor(...lightGray);
    doc.setLineWidth(0.2);
    doc.rect(margin, y, contentWidth, rowHeight);

    if (item) {
      doc.setFontSize(9);
      colX = margin;

      // Item number
      doc.text(item.itemNumber || '', colX + 2, y + 5);
      colX += 25;

      // Description
      const descText = doc.splitTextToSize(item.description, itemCols[1].width - 4);
      doc.text(descText[0] || '', colX + 2, y + 5);
      colX += itemCols[1].width;

      // Qty
      doc.text(item.qty.toString(), colX + 10, y + 5, { align: 'center' });
      colX += 20;

      // Unit price
      doc.text(item.unitPrice > 0 ? item.unitPrice.toFixed(2) : '-', colX + 23, y + 5, {
        align: 'right',
      });
      colX += 25;

      // Total
      doc.text(item.total > 0 ? item.total.toFixed(2) : '-', colX + 23, y + 5, { align: 'right' });
    }

    y += rowHeight;
  }

  y += 5;

  // === TOTALS SECTION (right side) ===
  const totalsX = pageWidth - margin - 70;
  const totalsValueX = pageWidth - margin;

  // Notes section (left side)
  const notesWidth = contentWidth - 80;
  if (invoiceData.notes.length > 0) {
    doc.setFillColor(230, 230, 230);
    doc.rect(margin, y - 3, notesWidth, 8, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...black);
    doc.text('Other Comments or Special Instructions', margin + 2, y + 2);

    let notesY = y + 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    for (const note of invoiceData.notes.slice(0, 3)) {
      doc.text(note, margin + 2, notesY);
      notesY += 4;
    }
  }

  // Totals
  doc.setFontSize(9);

  // Subtotal
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...gray);
  doc.text('SUBTOTAL', totalsX, y);
  doc.setTextColor(...black);
  doc.text(invoiceData.subtotal.toFixed(2), totalsValueX, y, { align: 'right' });

  y += 6;

  // Tax rate
  doc.setTextColor(...gray);
  doc.text('TAX RATE', totalsX, y);
  doc.setTextColor(...black);
  doc.text(invoiceData.taxRate > 0 ? invoiceData.taxRate.toFixed(2) + '%' : '-', totalsValueX, y, {
    align: 'right',
  });

  y += 6;

  // Tax
  doc.setTextColor(...gray);
  doc.text('TAX', totalsX, y);
  doc.setTextColor(...black);
  doc.text(invoiceData.tax > 0 ? invoiceData.tax.toFixed(2) : '-', totalsValueX, y, {
    align: 'right',
  });

  y += 6;

  // S&H
  doc.setTextColor(...gray);
  doc.text('S & H', totalsX, y);
  doc.setTextColor(...black);
  doc.text(invoiceData.shipping > 0 ? invoiceData.shipping.toFixed(2) : '-', totalsValueX, y, {
    align: 'right',
  });

  y += 6;

  // Other
  doc.setTextColor(...gray);
  doc.text('OTHER', totalsX, y);
  doc.setTextColor(...black);
  doc.text(invoiceData.other > 0 ? invoiceData.other.toFixed(2) : '-', totalsValueX, y, {
    align: 'right',
  });

  y += 8;

  // Total (bold, with background)
  doc.setFillColor(...darkBlue);
  doc.rect(totalsX - 5, y - 5, 75, 9, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL', totalsX, y);
  doc.text('$  ' + invoiceData.total.toFixed(2), totalsValueX, y, { align: 'right' });

  y += 20;

  // === FOOTER ===
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...gray);
  doc.text('If you have any questions about this invoice, please contact', margin, y);
  y += 4;
  doc.text('[Name, Phone #, E-mail]', margin, y);

  // Make checks payable to (right)
  doc.text('Make all checks payable to', pageWidth - margin - 45, y - 4);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...blueColor);
  doc.text(invoiceData.payableTo || '[Your Company Name]', pageWidth - margin - 45, y);

  y += 8;

  // Thank you message
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bolditalic');
  doc.setTextColor(...darkBlue);
  doc.text('Thank You For Your Business!', pageWidth / 2, y, { align: 'center' });

  y += 10;

  // === REMITTANCE SLIP ===
  doc.setDrawColor(...gray);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setLineDashPattern([], 0);

  y += 3;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...gray);
  doc.text('Please detach the portion below and return it with your payment.', margin, y);

  y += 8;

  // Remittance header
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...blueColor);
  doc.text('REMITTANCE', pageWidth / 2, y, { align: 'center' });

  y += 8;

  // Company info (left)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...black);
  doc.text(invoiceData.companyName, margin, y);

  // Remittance details (right)
  const remitX = pageWidth - margin - 50;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...gray);
  doc.text('DATE', remitX, y);
  doc.setDrawColor(...lightGray);
  doc.rect(remitX + 25, y - 3, 25, 5);

  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...gray);
  for (const line of invoiceData.companyAddress.slice(0, 3)) {
    doc.text(line, margin, y);
    y += 4;
  }

  // Invoice # and Customer ID on right
  let remitY = y - 8;
  doc.text('INVOICE #', remitX, remitY);
  doc.setTextColor(...black);
  doc.text(invoiceData.invoiceNumber, remitX + 35, remitY);

  remitY += 6;
  doc.setTextColor(...gray);
  doc.text('CUSTOMER ID', remitX, remitY);
  doc.setTextColor(...black);
  doc.text(invoiceData.customerId || '-', remitX + 35, remitY);

  y += 4;

  // Amount enclosed
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...black);
  doc.text('AMOUNT ENCLOSED', pageWidth - margin - 60, y);
  doc.setDrawColor(...black);
  doc.rect(pageWidth - margin - 25, y - 4, 25, 7);
}

/**
 * Strip markdown formatting from text for clean PDF output
 */
