/**
 * Document Generation API
 *
 * Generates downloadable PDF and Word documents from markdown content.
 * Uploads to Supabase Storage and returns signed URLs for secure download.
 *
 * SECURITY:
 * - Documents are stored in user-specific paths: documents/{userId}/{filename}
 * - Uses signed URLs with 1-hour expiration
 * - Only the document owner can access their files
 */

import { NextRequest, NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import QRCode from 'qrcode';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface DocumentRequest {
  content: string;
  title?: string;
  format?: 'pdf' | 'word' | 'both';
}

// Invoice data structure
interface InvoiceData {
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

// Business Plan data structure
interface BusinessPlanData {
  companyName: string;
  confidentialityNotice: string;
  executiveSummary: {
    missionStatement: string;
    companyOverview: string;
    leadershipTeam: string;
    financialHighlights: Array<{ metric: string; year1: string; year2: string; year3: string; year4: string; year5: string }>;
    objectives: string[];
  };
  companyDescription: {
    overview: string;
    competitiveAdvantages: string;
    legalStructure: string;
  };
  marketAnalysis: {
    industryAnalysis: string;
    targetMarket: string;
    competitiveAnalysis: Array<{ factor: string; yourBusiness: string; competitorA: string; competitorB: string; competitorC: string }>;
  };
  organizationManagement: {
    orgStructure: string;
    managementTeam: string;
    advisoryBoard: string;
  };
  productsServices: {
    description: string;
    intellectualProperty: string;
    researchDevelopment: string;
  };
  marketingSales: {
    marketingStrategy: string;
    salesStrategy: string;
    distributionChannels: string;
  };
  financialProjections: {
    assumptions: string[];
    incomeStatement: Array<{ category: string; year1: string; year2: string; year3: string; year4: string; year5: string }>;
    cashFlow: Array<{ category: string; year1: string; year2: string; year3: string; year4: string; year5: string }>;
    balanceSheet: Array<{ category: string; year1: string; year2: string; year3: string; year4: string; year5: string }>;
    breakEvenAnalysis: string;
  };
  fundingRequest: {
    currentFunding: string;
    requirements: string;
    futureFunding: string;
  };
  appendix: string[];
}

/**
 * Parse invoice content from markdown/text to structured data
 */
function parseInvoiceContent(content: string): InvoiceData {
  // Strip markdown formatting before parsing
  const cleanContent = content
    .replace(/\*\*(.+?)\*\*/g, '$1')  // Remove bold
    .replace(/\*(.+?)\*/g, '$1')       // Remove italic
    .replace(/^#+\s*/gm, '')           // Remove headers
    .replace(/`(.+?)`/g, '$1');        // Remove code formatting

  const lines = cleanContent.split('\n').map(l => l.trim()).filter(l => l);

  // Debug: Log first 20 lines to see what we're parsing
  console.log('[Invoice Parser] Parsing content, first 20 lines:', lines.slice(0, 20));

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
    payableTo: ''
  };

  let currentSection = '';

  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    // Skip common header lines
    if (lowerLine === 'invoice draft:' || lowerLine === 'invoice:' ||
        lowerLine === 'invoice draft' || lowerLine === 'invoice' ||
        lowerLine === 'here is your invoice:' || lowerLine === 'here is your invoice') {
      continue;
    }

    // Extract company name (various formats) - try multiple patterns

    // Pattern 1: "# Company Name" (markdown header)
    if (line.startsWith('# ') && data.companyName.includes('[')) {
      data.companyName = line.slice(2).trim();
      console.log('[Invoice Parser] Found company name (header):', data.companyName);
      continue;
    }

    // Pattern 2: "Business: Name" or "From: Name" or "Company: Name"
    const businessMatch = line.match(/^(?:business|from|company)[:\s]+(.+)/i);
    if (businessMatch && data.companyName.includes('[')) {
      data.companyName = businessMatch[1].trim();
      console.log('[Invoice Parser] Found company name (business/from):', data.companyName);
      continue;
    }

    // Pattern 3: "Invoice: CompanyName" (AI sometimes outputs company after "Invoice:")
    const invoiceCompanyMatch = line.match(/^invoice[:\s]+([A-Za-z].+)/i);
    if (invoiceCompanyMatch && data.companyName.includes('[') && !/\d/.test(invoiceCompanyMatch[1])) {
      data.companyName = invoiceCompanyMatch[1].trim();
      console.log('[Invoice Parser] Found company name (invoice:):', data.companyName);
      continue;
    }

    // Pattern 4: First meaningful line is company name (no colon, starts with capital)
    // This handles cases like "Kaylan's Bridal" as the first line
    if (data.companyName.includes('[') && data.items.length === 0) {
      // Must start with capital letter, can contain apostrophes, not be a common keyword
      const isCompanyName = /^[A-Z][A-Za-z']+/.test(line) &&
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
        console.log('[Invoice Parser] Found company name (first line):', data.companyName);
        continue;
      }
    }

    // Pattern 5: Address line (city, state) on second line - set as address
    if (data.companyName && !data.companyName.includes('[') && data.companyAddress[0]?.includes('[')) {
      const cityStateMatch = line.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),?\s*([A-Z]{2})?$/);
      if (cityStateMatch && !lowerLine.includes(':')) {
        data.companyAddress = [line];
        console.log('[Invoice Parser] Found company address:', line);
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
    if (lowerLine.includes('bill to') || lowerLine.includes('billed to') || lowerLine.startsWith('to:')) {
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
    if (lowerLine.includes('line item') ||
        lowerLine.includes('description of work') ||
        lowerLine === 'description:' ||
        lowerLine.startsWith('description:') ||
        lowerLine === 'description' ||
        (lowerLine.includes('item') && lowerLine.includes('description')) ||
        lowerLine === 'items:' || lowerLine === 'services:' ||
        lowerLine.includes('services/items') ||
        lowerLine.includes('items/services') ||
        lowerLine.includes('breakdown:') ||
        lowerLine === 'breakdown' ||
        lowerLine.includes('charges:') ||
        lowerLine === 'charges') {
      currentSection = 'items';
      console.log('[Invoice Parser] Entering items section at:', line);
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
    if (lowerLine.includes('note') || lowerLine.includes('comment') || lowerLine.includes('instruction')) {
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
    const totalMatch = line.match(/(?:grand\s*)?total(?:\s*amount)?(?:\s*due)?[:\s]*\$?([\d,]+\.?\d*)/i);
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
      const isBillToContent = !line.includes(':') &&
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
      if (itemLineMatch && !lowerLine.includes('total') && !lowerLine.includes('subtotal') && !lowerLine.includes('tax')) {
        const total = parseFloat(itemLineMatch[2].replace(/,/g, ''));
        if (total > 0) {
          data.items.push({
            itemNumber: '',
            description: itemLineMatch[1].trim(),
            qty: 1,
            unitPrice: total,
            total: total
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
            total: total
          });
          continue;
        }
      }
    }

    // Handle items in LABOR section: "Description: N hours @ $rate/hr: $total"
    if (currentSection === 'labor') {
      // Pattern: "Service Name: 25 hours @ $300.00/hr: $7,500.00"
      const labItemMatch = line.match(/^(.+?):\s*(\d+)\s*(?:hours?|hrs?)\s*[@x]\s*\$?([\d,]+\.?\d*)(?:\/(?:hour|hr))?[:\s=]*\$?([\d,]+\.?\d*)?/i);
      if (labItemMatch) {
        const qty = parseInt(labItemMatch[2]);
        const price = parseFloat(labItemMatch[3].replace(/,/g, ''));
        const total = labItemMatch[4] ? parseFloat(labItemMatch[4].replace(/,/g, '')) : qty * price;
        data.items.push({
          itemNumber: '',
          description: `Labor - ${labItemMatch[1].trim()} (${qty} hrs @ $${price.toFixed(2)}/hr)`,
          qty: qty,
          unitPrice: price,
          total: total
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
            total: total
          });
          continue;
        }
      }
    }

    // PATTERN: "10 Pepperoni Pizzas @ $25.00: $250.00" (QTY DESC @ PRICE: TOTAL)
    // This common AI format has quantity at the START of the line
    const qtyFirstMatch = line.match(/^(\d+)\s+(.+?)\s*@\s*\$?([\d,]+\.?\d*)[:\s]*\$?([\d,]+\.?\d*)$/);
    if (qtyFirstMatch) {
      const qty = parseInt(qtyFirstMatch[1]);
      const desc = qtyFirstMatch[2].trim();
      const unitPrice = parseFloat(qtyFirstMatch[3].replace(/,/g, ''));
      const total = qtyFirstMatch[4] ? parseFloat(qtyFirstMatch[4].replace(/,/g, '')) : qty * unitPrice;
      console.log('[Invoice Parser] Matched qty-first format:', desc, qty, unitPrice, total);
      data.items.push({
        itemNumber: '',
        description: desc,
        qty: qty,
        unitPrice: unitPrice,
        total: total
      });
      continue;
    }

    // Parse item lines (look for patterns like "Product Name | 5 | $100 | $500")
    const itemMatch = line.match(/^(.+?)\s*[|]\s*(\d+)\s*[|]\s*\$?([\d,]+\.?\d*)\s*[|]\s*\$?([\d,]+\.?\d*)/);
    if (itemMatch) {
      data.items.push({
        itemNumber: '',
        description: itemMatch[1].trim(),
        qty: parseInt(itemMatch[2]),
        unitPrice: parseFloat(itemMatch[3].replace(/,/g, '')),
        total: parseFloat(itemMatch[4].replace(/,/g, ''))
      });
      continue;
    }

    // PATTERN 2: "Description - Qty: 5 @ $100 = $500"
    const altItemMatch = line.match(/^(.+?)\s*[-–]\s*(?:qty:?\s*)?(\d+)\s*[@x]\s*\$?([\d,]+\.?\d*)/i);
    if (altItemMatch && !itemMatch) {
      const qty = parseInt(altItemMatch[2]);
      const price = parseFloat(altItemMatch[3].replace(/,/g, ''));
      data.items.push({
        itemNumber: '',
        description: altItemMatch[1].trim(),
        qty: qty,
        unitPrice: price,
        total: qty * price
      });
      continue;
    }

    // PATTERN 3: "Labor: 15 Hours @ $300.00/hr: $4,500.00" (common AI format)
    const laborMatch = line.match(/^(.+?):\s*(\d+)\s*(?:hours?|hrs?)\s*[@x]\s*\$?([\d,]+\.?\d*)(?:\/(?:hour|hr))?[:\s=]*\$?([\d,]+\.?\d*)?/i);
    if (laborMatch) {
      const qty = parseInt(laborMatch[2]);
      const price = parseFloat(laborMatch[3].replace(/,/g, ''));
      const total = laborMatch[4] ? parseFloat(laborMatch[4].replace(/,/g, '')) : qty * price;
      data.items.push({
        itemNumber: '',
        description: `${laborMatch[1].trim()} (${qty} hours @ $${price.toFixed(2)}/hr)`,
        qty: qty,
        unitPrice: price,
        total: total
      });
      continue;
    }

    // PATTERN 4: "Materials: Description: $1,200.00" or "Materials (Circuit Breaker): $1200"
    const materialsMatch = line.match(/^(materials?|parts?|supplies?|equipment)[:\s]*(.+?)?\s*[:\s]\s*\$?([\d,]+\.?\d*)$/i);
    if (materialsMatch) {
      const desc = materialsMatch[2]?.trim().replace(/[:\s]+$/, '') || materialsMatch[1];
      const total = parseFloat(materialsMatch[3].replace(/,/g, ''));
      data.items.push({
        itemNumber: '',
        description: desc,
        qty: 1,
        unitPrice: total,
        total: total
      });
      continue;
    }

    // PATTERN 5: Bullet point items "- Labor: $4,500.00"
    const bulletItemMatch = line.match(/^[-*•]\s*(.+?):\s*\$?([\d,]+\.?\d*)$/);
    if (bulletItemMatch && !lowerLine.includes('total') && !lowerLine.includes('subtotal') && !lowerLine.includes('tax')) {
      const total = parseFloat(bulletItemMatch[2].replace(/,/g, ''));
      data.items.push({
        itemNumber: '',
        description: bulletItemMatch[1].trim(),
        qty: 1,
        unitPrice: total,
        total: total
      });
      continue;
    }

    // CATCH-ALL PATTERN: Any line with description followed by dollar amount
    // "Fabric Costs: $500.00" or "Design Work $450.00" or "- Wedding gown alterations: $800"
    const catchAllItemMatch = line.match(/^[-*•]?\s*(.+?)[\s:]+\$(\d[\d,]*\.?\d*)$/);
    if (catchAllItemMatch && data.items.length < 50) {  // Limit to prevent over-matching
      const desc = catchAllItemMatch[1].trim();
      const amount = parseFloat(catchAllItemMatch[2].replace(/,/g, ''));
      // Skip if it looks like a total/subtotal/tax line
      if (amount > 0 &&
          !lowerLine.includes('total') &&
          !lowerLine.includes('subtotal') &&
          !lowerLine.includes('tax') &&
          !lowerLine.includes('shipping') &&
          !lowerLine.includes('amount due') &&
          desc.length > 2) {
        console.log('[Invoice Parser] Catch-all item:', desc, amount);
        data.items.push({
          itemNumber: '',
          description: desc,
          qty: 1,
          unitPrice: amount,
          total: amount
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
  console.log('[Invoice Parser] Final parsed data:', {
    companyName: data.companyName,
    invoiceNumber: data.invoiceNumber,
    itemCount: data.items.length,
    items: data.items.slice(0, 5),  // First 5 items
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
function generateInvoicePDF(doc: jsPDF, invoiceData: InvoiceData): void {
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
    let shipY = y - (invoiceData.billTo.slice(0, 5).length * 4);
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
      invoiceData.terms || ''
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
    { label: 'TOTAL', width: 25, align: 'right' as const }
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
    itemsToShow.push(
      { itemNumber: '[Item #]', description: '[Product/Service Description]', qty: 1, unitPrice: 0, total: 0 }
    );
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
      doc.text(item.unitPrice > 0 ? item.unitPrice.toFixed(2) : '-', colX + 23, y + 5, { align: 'right' });
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
  doc.text(invoiceData.taxRate > 0 ? invoiceData.taxRate.toFixed(2) + '%' : '-', totalsValueX, y, { align: 'right' });

  y += 6;

  // Tax
  doc.setTextColor(...gray);
  doc.text('TAX', totalsX, y);
  doc.setTextColor(...black);
  doc.text(invoiceData.tax > 0 ? invoiceData.tax.toFixed(2) : '-', totalsValueX, y, { align: 'right' });

  y += 6;

  // S&H
  doc.setTextColor(...gray);
  doc.text('S & H', totalsX, y);
  doc.setTextColor(...black);
  doc.text(invoiceData.shipping > 0 ? invoiceData.shipping.toFixed(2) : '-', totalsValueX, y, { align: 'right' });

  y += 6;

  // Other
  doc.setTextColor(...gray);
  doc.text('OTHER', totalsX, y);
  doc.setTextColor(...black);
  doc.text(invoiceData.other > 0 ? invoiceData.other.toFixed(2) : '-', totalsValueX, y, { align: 'right' });

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
function stripMarkdown(text: string): string {
  return text
    // Remove bold/italic markers
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove headers markers
    .replace(/^#{1,6}\s+/gm, '')
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse business plan content from markdown/text to structured data
 */
function parseBusinessPlanContent(content: string): BusinessPlanData {
  const lines = content.split('\n');

  const data: BusinessPlanData = {
    companyName: '[Company Name]',
    confidentialityNotice: 'This document contains confidential and proprietary information.',
    executiveSummary: {
      missionStatement: '',
      companyOverview: '',
      leadershipTeam: '',
      financialHighlights: [],
      objectives: []
    },
    companyDescription: {
      overview: '',
      competitiveAdvantages: '',
      legalStructure: ''
    },
    marketAnalysis: {
      industryAnalysis: '',
      targetMarket: '',
      competitiveAnalysis: []
    },
    organizationManagement: {
      orgStructure: '',
      managementTeam: '',
      advisoryBoard: ''
    },
    productsServices: {
      description: '',
      intellectualProperty: '',
      researchDevelopment: ''
    },
    marketingSales: {
      marketingStrategy: '',
      salesStrategy: '',
      distributionChannels: ''
    },
    financialProjections: {
      assumptions: [],
      incomeStatement: [],
      cashFlow: [],
      balanceSheet: [],
      breakEvenAnalysis: ''
    },
    fundingRequest: {
      currentFunding: '',
      requirements: '',
      futureFunding: ''
    },
    appendix: []
  };

  let currentSection = '';
  let currentSubsection = '';
  let currentContent: string[] = [];

  const saveCurrentContent = () => {
    // Join content and ensure all markdown is stripped
    const text = currentContent.map(line => stripMarkdown(line)).join('\n').trim();
    if (!text) return;

    switch (currentSection) {
      case 'executive':
        if (currentSubsection.includes('mission')) data.executiveSummary.missionStatement = text;
        else if (currentSubsection.includes('overview') || currentSubsection.includes('company')) data.executiveSummary.companyOverview = text;
        else if (currentSubsection.includes('leadership') || currentSubsection.includes('team')) data.executiveSummary.leadershipTeam = text;
        else if (currentSubsection.includes('objective')) data.executiveSummary.objectives = text.split('\n').filter(l => l.trim());
        break;
      case 'company':
        if (currentSubsection.includes('competitive') || currentSubsection.includes('advantage')) data.companyDescription.competitiveAdvantages = text;
        else if (currentSubsection.includes('legal') || currentSubsection.includes('structure')) data.companyDescription.legalStructure = text;
        else data.companyDescription.overview = text;
        break;
      case 'market':
        if (currentSubsection.includes('industry')) data.marketAnalysis.industryAnalysis = text;
        else if (currentSubsection.includes('target')) data.marketAnalysis.targetMarket = text;
        else if (currentSubsection.includes('competitive')) data.marketAnalysis.industryAnalysis += '\n\n' + text;
        break;
      case 'organization':
        if (currentSubsection.includes('management')) data.organizationManagement.managementTeam = text;
        else if (currentSubsection.includes('advisory')) data.organizationManagement.advisoryBoard = text;
        else data.organizationManagement.orgStructure = text;
        break;
      case 'product':
        if (currentSubsection.includes('intellectual') || currentSubsection.includes('ip')) data.productsServices.intellectualProperty = text;
        else if (currentSubsection.includes('r&d') || currentSubsection.includes('research')) data.productsServices.researchDevelopment = text;
        else data.productsServices.description = text;
        break;
      case 'marketing':
        if (currentSubsection.includes('sales')) data.marketingSales.salesStrategy = text;
        else if (currentSubsection.includes('distribution')) data.marketingSales.distributionChannels = text;
        else data.marketingSales.marketingStrategy = text;
        break;
      case 'financial':
        if (currentSubsection.includes('assumption')) data.financialProjections.assumptions = text.split('\n').filter(l => l.trim());
        else if (currentSubsection.includes('break')) data.financialProjections.breakEvenAnalysis = text;
        break;
      case 'funding':
        if (currentSubsection.includes('current')) data.fundingRequest.currentFunding = text;
        else if (currentSubsection.includes('requirement')) data.fundingRequest.requirements = text;
        else if (currentSubsection.includes('future')) data.fundingRequest.futureFunding = text;
        break;
      case 'appendix':
        data.appendix = text.split('\n').filter(l => l.trim());
        break;
    }
    currentContent = [];
  };

  for (const line of lines) {
    const trimmedLine = line.trim();
    const lowerLine = trimmedLine.toLowerCase();

    // Extract company name from various formats
    if (data.companyName === '[Company Name]') {
      // Pattern 1: "# Company Name" (markdown header)
      if (trimmedLine.startsWith('# ')) {
        const title = stripMarkdown(trimmedLine.slice(2).replace(/business plan/i, ''));
        if (title && title.length > 2) {
          data.companyName = title;
          continue;
        }
      }
      // Pattern 2: "Business Name: Company Name" (common AI format)
      const businessNameMatch = trimmedLine.match(/business\s+name[:\s]+(.+)/i);
      if (businessNameMatch && businessNameMatch[1]) {
        const name = stripMarkdown(businessNameMatch[1]);
        if (name && name.length > 2) {
          data.companyName = name;
          continue;
        }
      }
      // Pattern 3: "Company Name: XYZ" or "Name: XYZ"
      const companyNameMatch = trimmedLine.match(/(?:company\s+)?name[:\s]+(.+)/i);
      if (companyNameMatch && companyNameMatch[1] && !trimmedLine.toLowerCase().includes('founder')) {
        const name = stripMarkdown(companyNameMatch[1]);
        if (name && name.length > 2 && !name.toLowerCase().includes('business plan')) {
          data.companyName = name;
          continue;
        }
      }
      // Pattern 4: "Business Plan for Company Name" or "Company Name Business Plan"
      const bpMatch = trimmedLine.match(/business\s+plan\s+(?:for\s+)?(.+)/i) ||
                      trimmedLine.match(/(.+?)\s+business\s+plan/i);
      if (bpMatch && bpMatch[1]) {
        const name = stripMarkdown(bpMatch[1]);
        if (name && name.length > 2 && !name.toLowerCase().includes('summary')) {
          data.companyName = name;
        }
      }
    }

    // Detect main sections (improved patterns for various AI output formats)
    // Executive Summary
    if (lowerLine.includes('executive summary') || lowerLine.match(/^#+\s*1\.\s/)) {
      saveCurrentContent();
      currentSection = 'executive';
      currentSubsection = '';
      continue;
    }
    // Company Description
    if (lowerLine.includes('company description') || lowerLine.match(/^#+\s*2\.\s/)) {
      saveCurrentContent();
      currentSection = 'company';
      currentSubsection = '';
      continue;
    }
    // Market Analysis (also matches "1. Market Analysis" format)
    if (lowerLine.includes('market analysis') || lowerLine.match(/^\d+\.\s*market/i)) {
      saveCurrentContent();
      currentSection = 'market';
      currentSubsection = '';
      continue;
    }
    // Organization/Management
    if ((lowerLine.includes('organization') && lowerLine.includes('management')) ||
        lowerLine.match(/^\d+\.\s*organization/i) || lowerLine.match(/^#+\s*4\.\s/)) {
      saveCurrentContent();
      currentSection = 'organization';
      currentSubsection = '';
      continue;
    }
    // Operational Plan (common AI format)
    if (lowerLine.includes('operational plan') || lowerLine.match(/^\d+\.\s*operational/i)) {
      saveCurrentContent();
      currentSection = 'organization';
      currentSubsection = '';
      continue;
    }
    // Products/Services
    if ((lowerLine.includes('product') || lowerLine.includes('service')) &&
        (lowerLine.match(/^\d+\./) || lowerLine.match(/^#+/))) {
      saveCurrentContent();
      currentSection = 'product';
      currentSubsection = '';
      continue;
    }
    // Marketing/Sales
    if ((lowerLine.includes('marketing') || lowerLine.includes('sales')) &&
        (lowerLine.match(/^\d+\./) || lowerLine.match(/^#+/))) {
      saveCurrentContent();
      currentSection = 'marketing';
      currentSubsection = '';
      continue;
    }
    // Financial Projections (also matches "3. Financial Projections" format)
    if (lowerLine.includes('financial') || lowerLine.match(/^\d+\.\s*financial/i)) {
      saveCurrentContent();
      currentSection = 'financial';
      currentSubsection = '';
      continue;
    }
    // Initial Investment (treat as funding/financial)
    if (lowerLine.includes('initial investment') || lowerLine.includes('investment breakdown')) {
      saveCurrentContent();
      currentSection = 'funding';
      currentSubsection = 'requirements';
      continue;
    }
    // Funding Request
    if (lowerLine.includes('funding') || lowerLine.match(/^\d+\.\s*funding/i)) {
      saveCurrentContent();
      currentSection = 'funding';
      currentSubsection = '';
      continue;
    }
    if (lowerLine.includes('appendix') || lowerLine.match(/^#*\s*9\./)) {
      saveCurrentContent();
      currentSection = 'appendix';
      currentSubsection = '';
      continue;
    }

    // Detect subsections (##, ###, numbered like 1.1, 2.1, or inline "Label:" format)
    if (trimmedLine.match(/^#{2,3}\s+/) || trimmedLine.match(/^\d+\.\d+/)) {
      saveCurrentContent();
      currentSubsection = lowerLine;
      continue;
    }

    // Handle inline "Label: Content" format (common in AI output)
    const inlineLabelMatch = trimmedLine.match(/^([A-Z][A-Za-z\s]+):\s*(.*)$/);
    if (inlineLabelMatch && currentSection) {
      const label = inlineLabelMatch[1].toLowerCase();
      const value = stripMarkdown(inlineLabelMatch[2]);

      // Save previous content first
      saveCurrentContent();

      // Assign inline values directly to data structure
      if (currentSection === 'executive') {
        if (label.includes('mission')) {
          data.executiveSummary.missionStatement = value;
          continue;
        } else if (label.includes('objective') || label.includes('goal')) {
          if (value) data.executiveSummary.objectives.push(value);
          continue;
        } else if (label.includes('location') || label.includes('launch') || label.includes('date')) {
          // Store as part of overview
          const cleanedLine = stripMarkdown(trimmedLine);
          data.executiveSummary.companyOverview += (data.executiveSummary.companyOverview ? '\n' : '') + cleanedLine;
          continue;
        }
      } else if (currentSection === 'market') {
        if (label.includes('competitive') || label.includes('edge') || label.includes('advantage')) {
          currentSubsection = 'competitive';
          if (value) currentContent.push(value);
          continue;
        } else if (label.includes('pricing') || label.includes('strategy')) {
          currentSubsection = 'pricing';
          if (value) currentContent.push(value);
          continue;
        } else if (label.includes('target')) {
          currentSubsection = 'target';
          if (value) currentContent.push(value);
          continue;
        }
      } else if (currentSection === 'organization') {
        if (label.includes('hours') || label.includes('staffing') || label.includes('inventory')) {
          if (value) currentContent.push(stripMarkdown(trimmedLine));
          continue;
        }
      }

      // If we couldn't match specifically, use label as subsection
      currentSubsection = label;
      if (value) currentContent.push(value);
      continue;
    }

    // Accumulate content
    if (trimmedLine && currentSection) {
      // Clean up bullet points, list markers, and markdown formatting
      let cleanedLine = trimmedLine.replace(/^[-*•]\s*/, '').replace(/^\d+\)\s*/, '');
      cleanedLine = stripMarkdown(cleanedLine);
      if (cleanedLine) {
        currentContent.push(cleanedLine);
      }
    }
  }

  // Save final content
  saveCurrentContent();

  // Fallback: If still no company name, try to extract from content
  if (data.companyName === '[Company Name]') {
    // Look for patterns like "The [Name] Cafe" or "[Name] Coffee"
    const allText = Object.values(data.executiveSummary).join(' ') + ' ' + data.companyDescription.overview;
    const cafeMatch = allText.match(/(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Cafe|Coffee|Restaurant|Bistro|Shop)/i);
    if (cafeMatch) {
      data.companyName = cafeMatch[0].trim();
    }
  }

  return data;
}

/**
 * Generate professional business plan PDF
 */
function generateBusinessPlanPDF(doc: jsPDF, data: BusinessPlanData): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;
  let pageNumber = 1;

  // Colors
  const primaryColor: [number, number, number] = [30, 58, 138]; // Dark blue
  const secondaryColor: [number, number, number] = [59, 130, 246]; // Light blue
  const textColor: [number, number, number] = [31, 41, 55]; // Dark gray
  const lightGray: [number, number, number] = [156, 163, 175];

  // Helper to add page break
  const checkPageBreak = (neededHeight: number): boolean => {
    if (y + neededHeight > pageHeight - margin - 15) {
      // Add page number to current page
      doc.setFontSize(9);
      doc.setTextColor(...lightGray);
      doc.text(`Page ${pageNumber}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

      doc.addPage();
      pageNumber++;
      y = margin;
      return true;
    }
    return false;
  };

  // Helper to add section header
  const addSectionHeader = (title: string) => {
    checkPageBreak(20);
    y += 8;
    doc.setFillColor(...primaryColor);
    doc.rect(margin, y - 5, contentWidth, 10, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(title.toUpperCase(), margin + 5, y + 2);
    y += 12;
  };

  // Helper to add subsection header
  const addSubsectionHeader = (title: string) => {
    checkPageBreak(15);
    y += 5;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(title, margin, y);
    doc.setDrawColor(...secondaryColor);
    doc.setLineWidth(0.5);
    doc.line(margin, y + 2, margin + doc.getTextWidth(title), y + 2);
    y += 8;
  };

  // Helper to add paragraph
  const addParagraph = (text: string) => {
    if (!text || typeof text !== 'string') return;
    const safeText = String(text).trim();
    if (!safeText) return;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);

    // Limit text length to prevent extremely long content
    const truncatedText = safeText.length > 10000 ? safeText.substring(0, 10000) + '...' : safeText;
    const lines = doc.splitTextToSize(truncatedText, contentWidth);

    // Limit to prevent too many lines on one page
    const maxLines = 200;
    const linesToRender = lines.slice(0, maxLines);

    for (const line of linesToRender) {
      checkPageBreak(5);
      doc.text(String(line), margin, y);
      y += 4.5;
    }
    y += 3;
  };

  // Helper to add bullet list
  const addBulletList = (items: string[]) => {
    if (!items || !Array.isArray(items) || items.length === 0) return;

    // Limit to reasonable number of items
    const safeItems = items.filter(i => i && typeof i === 'string').slice(0, 50);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);

    for (const item of safeItems) {
      const safeItem = String(item).trim();
      if (!safeItem) continue;
      checkPageBreak(6);
      doc.setFillColor(...primaryColor);
      doc.circle(margin + 2, y - 1.5, 1, 'F');
      const lines = doc.splitTextToSize(safeItem.substring(0, 500), contentWidth - 10);
      doc.text(lines, margin + 7, y);
      y += lines.length * 4.5 + 2;
    }
    y += 2;
  };

  // Helper to add financial table
  const addFinancialTable = (title: string, rows: Array<{ category: string; year1: string; year2: string; year3: string; year4: string; year5: string }>) => {
    if (!rows || !Array.isArray(rows) || rows.length === 0) return;

    // Filter out invalid rows and limit to reasonable size
    const validRows = rows.filter(r => r && typeof r === 'object').slice(0, 20);
    if (validRows.length === 0) return;

    checkPageBreak(validRows.length * 7 + 20);

    // Table title
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(title || 'Financial Data', margin, y);
    y += 6;

    // Header row
    const colWidths = [contentWidth * 0.3, contentWidth * 0.14, contentWidth * 0.14, contentWidth * 0.14, contentWidth * 0.14, contentWidth * 0.14];
    const headers = ['Category', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'];

    doc.setFillColor(...primaryColor);
    doc.rect(margin, y - 4, contentWidth, 7, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);

    let x = margin;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], x + 2, y);
      x += colWidths[i];
    }
    y += 5;

    // Data rows
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);

    for (let rowIdx = 0; rowIdx < validRows.length; rowIdx++) {
      const row = validRows[rowIdx];
      if (!row) continue;

      if (rowIdx % 2 === 0) {
        doc.setFillColor(245, 247, 250);
        doc.rect(margin, y - 4, contentWidth, 6, 'F');
      }

      x = margin;
      doc.text(String(row.category || '').substring(0, 25), x + 2, y);
      x += colWidths[0];
      doc.text(String(row.year1 || '-'), x + 2, y);
      x += colWidths[1];
      doc.text(String(row.year2 || '-'), x + 2, y);
      x += colWidths[2];
      doc.text(String(row.year3 || '-'), x + 2, y);
      x += colWidths[3];
      doc.text(String(row.year4 || '-'), x + 2, y);
      x += colWidths[4];
      doc.text(String(row.year5 || '-'), x + 2, y);

      y += 6;
    }
    y += 5;
  };

  // === COVER PAGE ===
  y = pageHeight * 0.3;

  // Company name
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  const companyLines = doc.splitTextToSize(data.companyName, contentWidth);
  doc.text(companyLines, pageWidth / 2, y, { align: 'center' });
  y += companyLines.length * 12 + 10;

  // "Business Plan" title
  doc.setFontSize(24);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...secondaryColor);
  doc.text('BUSINESS PLAN', pageWidth / 2, y, { align: 'center' });
  y += 15;

  // Decorative line
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(1);
  doc.line(pageWidth / 2 - 40, y, pageWidth / 2 + 40, y);
  y += 20;

  // Date
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...lightGray);
  doc.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' }), pageWidth / 2, y, { align: 'center' });

  // Confidentiality notice at bottom
  y = pageHeight - 40;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...lightGray);
  const confidentialLines = doc.splitTextToSize(data.confidentialityNotice, contentWidth - 20);
  doc.text(confidentialLines, pageWidth / 2, y, { align: 'center' });

  // === PAGE 2: TABLE OF CONTENTS ===
  doc.addPage();
  pageNumber++;
  y = margin;

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('TABLE OF CONTENTS', pageWidth / 2, y, { align: 'center' });
  y += 15;

  const tocItems = [
    { num: '1', title: 'Executive Summary', page: '3' },
    { num: '2', title: 'Company Description', page: '4' },
    { num: '3', title: 'Market Analysis', page: '5' },
    { num: '4', title: 'Organization and Management', page: '6' },
    { num: '5', title: 'Products or Services', page: '7' },
    { num: '6', title: 'Marketing and Sales Strategy', page: '8' },
    { num: '7', title: 'Financial Projections', page: '9' },
    { num: '8', title: 'Funding Request', page: '11' },
    { num: '9', title: 'Appendix', page: '12' }
  ];

  doc.setFontSize(11);
  for (const item of tocItems) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(`${item.num}.`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);
    doc.text(item.title, margin + 10, y);

    // Dots
    const dotsX = margin + 10 + doc.getTextWidth(item.title) + 2;
    const pageX = pageWidth - margin - 5;
    doc.setTextColor(...lightGray);
    let dotX = dotsX;
    while (dotX < pageX - 10) {
      doc.text('.', dotX, y);
      dotX += 3;
    }
    doc.text(item.page, pageX, y, { align: 'right' });
    y += 8;
  }

  // === CONTENT PAGES ===
  doc.addPage();
  pageNumber++;
  y = margin;

  // 1. EXECUTIVE SUMMARY
  addSectionHeader('1. Executive Summary');

  if (data.executiveSummary.missionStatement) {
    addSubsectionHeader('1.1 Mission Statement');
    addParagraph(data.executiveSummary.missionStatement);
  }

  if (data.executiveSummary.companyOverview) {
    addSubsectionHeader('1.2 Company Overview');
    addParagraph(data.executiveSummary.companyOverview);
  }

  if (data.executiveSummary.leadershipTeam) {
    addSubsectionHeader('1.3 Leadership Team');
    addParagraph(data.executiveSummary.leadershipTeam);
  }

  if (data.executiveSummary.financialHighlights.length > 0) {
    addSubsectionHeader('1.4 Financial Highlights');
    addFinancialTable('5-Year Financial Summary', data.executiveSummary.financialHighlights.map(h => ({
      category: h.metric,
      year1: h.year1,
      year2: h.year2,
      year3: h.year3,
      year4: h.year4,
      year5: h.year5
    })));
  }

  if (data.executiveSummary.objectives.length > 0) {
    addSubsectionHeader('1.5 Objectives');
    addBulletList(data.executiveSummary.objectives);
  }

  // 2. COMPANY DESCRIPTION
  addSectionHeader('2. Company Description');

  if (data.companyDescription.overview) {
    addSubsectionHeader('2.1 Company Overview');
    addParagraph(data.companyDescription.overview);
  }

  if (data.companyDescription.competitiveAdvantages) {
    addSubsectionHeader('2.2 Competitive Advantages');
    addParagraph(data.companyDescription.competitiveAdvantages);
  }

  if (data.companyDescription.legalStructure) {
    addSubsectionHeader('2.3 Legal Structure and Ownership');
    addParagraph(data.companyDescription.legalStructure);
  }

  // 3. MARKET ANALYSIS
  addSectionHeader('3. Market Analysis');

  if (data.marketAnalysis.industryAnalysis) {
    addSubsectionHeader('3.1 Industry Analysis');
    addParagraph(data.marketAnalysis.industryAnalysis);
  }

  if (data.marketAnalysis.targetMarket) {
    addSubsectionHeader('3.2 Target Market');
    addParagraph(data.marketAnalysis.targetMarket);
  }

  // 4. ORGANIZATION AND MANAGEMENT
  addSectionHeader('4. Organization and Management');

  if (data.organizationManagement.orgStructure) {
    addSubsectionHeader('4.1 Organizational Structure');
    addParagraph(data.organizationManagement.orgStructure);
  }

  if (data.organizationManagement.managementTeam) {
    addSubsectionHeader('4.2 Management Team');
    addParagraph(data.organizationManagement.managementTeam);
  }

  if (data.organizationManagement.advisoryBoard) {
    addSubsectionHeader('4.3 Advisory Board');
    addParagraph(data.organizationManagement.advisoryBoard);
  }

  // 5. PRODUCTS OR SERVICES
  addSectionHeader('5. Products or Services');

  if (data.productsServices.description) {
    addSubsectionHeader('5.1 Product or Service Description');
    addParagraph(data.productsServices.description);
  }

  if (data.productsServices.intellectualProperty) {
    addSubsectionHeader('5.2 Intellectual Property');
    addParagraph(data.productsServices.intellectualProperty);
  }

  if (data.productsServices.researchDevelopment) {
    addSubsectionHeader('5.3 Research and Development');
    addParagraph(data.productsServices.researchDevelopment);
  }

  // 6. MARKETING AND SALES STRATEGY
  addSectionHeader('6. Marketing and Sales Strategy');

  if (data.marketingSales.marketingStrategy) {
    addSubsectionHeader('6.1 Marketing Strategy');
    addParagraph(data.marketingSales.marketingStrategy);
  }

  if (data.marketingSales.salesStrategy) {
    addSubsectionHeader('6.2 Sales Strategy');
    addParagraph(data.marketingSales.salesStrategy);
  }

  if (data.marketingSales.distributionChannels) {
    addSubsectionHeader('6.3 Distribution Channels');
    addParagraph(data.marketingSales.distributionChannels);
  }

  // 7. FINANCIAL PROJECTIONS
  addSectionHeader('7. Financial Projections');

  if (data.financialProjections.assumptions.length > 0) {
    addSubsectionHeader('7.1 Key Assumptions');
    addBulletList(data.financialProjections.assumptions);
  }

  if (data.financialProjections.incomeStatement.length > 0) {
    addSubsectionHeader('7.2 Projected Income Statement');
    addFinancialTable('Income Statement', data.financialProjections.incomeStatement);
  }

  if (data.financialProjections.cashFlow.length > 0) {
    addSubsectionHeader('7.3 Projected Cash Flow');
    addFinancialTable('Cash Flow Statement', data.financialProjections.cashFlow);
  }

  if (data.financialProjections.balanceSheet.length > 0) {
    addSubsectionHeader('7.4 Projected Balance Sheet');
    addFinancialTable('Balance Sheet', data.financialProjections.balanceSheet);
  }

  if (data.financialProjections.breakEvenAnalysis) {
    addSubsectionHeader('7.5 Break-Even Analysis');
    addParagraph(data.financialProjections.breakEvenAnalysis);
  }

  // 8. FUNDING REQUEST
  addSectionHeader('8. Funding Request');

  if (data.fundingRequest.currentFunding) {
    addSubsectionHeader('8.1 Current Funding');
    addParagraph(data.fundingRequest.currentFunding);
  }

  if (data.fundingRequest.requirements) {
    addSubsectionHeader('8.2 Funding Requirements');
    addParagraph(data.fundingRequest.requirements);
  }

  if (data.fundingRequest.futureFunding) {
    addSubsectionHeader('8.3 Future Funding Plans');
    addParagraph(data.fundingRequest.futureFunding);
  }

  // 9. APPENDIX
  if (data.appendix.length > 0) {
    addSectionHeader('9. Appendix');
    addBulletList(data.appendix);
  }

  // Add final page number
  doc.setFontSize(9);
  doc.setTextColor(...lightGray);
  doc.text(`Page ${pageNumber}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
}

// Get authenticated user ID from session (more secure than trusting request body)
async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Cookie operations may fail
            }
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}

// Get Supabase admin client for storage operations
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Parse markdown to structured content for PDF
 * Supports special QR code syntax: {{QR:url}} or {{QR:url:count}} for multiple QR codes
 */
function parseMarkdown(markdown: string): Array<{
  type: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'table' | 'blockquote' | 'qr' | 'hr';
  text: string;
  items?: string[];
  rows?: string[][];
  qrData?: string;
  qrCount?: number;
}> {
  const lines = markdown.split('\n');
  const elements: Array<{
    type: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'table' | 'blockquote' | 'qr' | 'hr';
    text: string;
    items?: string[];
    rows?: string[][];
    qrData?: string;
    qrCount?: number;
  }> = [];

  let currentList: string[] = [];
  let currentTable: string[][] = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines but flush lists
    if (!line) {
      if (currentList.length > 0) {
        elements.push({ type: 'li', text: '', items: [...currentList] });
        currentList = [];
      }
      if (inTable && currentTable.length > 0) {
        elements.push({ type: 'table', text: '', rows: [...currentTable] });
        currentTable = [];
        inTable = false;
      }
      continue;
    }

    // Headers
    if (line.startsWith('# ')) {
      elements.push({ type: 'h1', text: line.slice(2) });
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push({ type: 'h2', text: line.slice(3) });
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push({ type: 'h3', text: line.slice(4) });
      continue;
    }

    // Detect resume section headers (all-caps or bold section names without ## prefix)
    // These commonly appear when AI doesn't use markdown headers
    const resumeSectionHeaders = [
      'PROFESSIONAL SUMMARY', 'SUMMARY', 'PROFILE', 'OBJECTIVE',
      'EXPERIENCE', 'PROFESSIONAL EXPERIENCE', 'WORK EXPERIENCE', 'EMPLOYMENT HISTORY', 'WORK HISTORY',
      'EDUCATION', 'ACADEMIC BACKGROUND', 'ACADEMIC HISTORY',
      'SKILLS', 'TECHNICAL SKILLS', 'CORE COMPETENCIES', 'KEY SKILLS', 'AREAS OF EXPERTISE',
      'CERTIFICATIONS', 'CERTIFICATES', 'LICENSES', 'CREDENTIALS', 'LICENSES & CERTIFICATIONS',
      'AWARDS', 'HONORS', 'ACHIEVEMENTS', 'ACCOMPLISHMENTS', 'AWARDS & HONORS',
      'PUBLICATIONS', 'RESEARCH', 'PROJECTS', 'PORTFOLIO',
      'LANGUAGES', 'VOLUNTEER', 'VOLUNTEER EXPERIENCE', 'COMMUNITY SERVICE',
      'REFERENCES', 'PROFESSIONAL AFFILIATIONS', 'MEMBERSHIPS', 'ASSOCIATIONS',
      'INTERESTS', 'ACTIVITIES', 'ADDITIONAL INFORMATION',
    ];

    // Business plan and general business document section headers
    const businessSectionHeaders = [
      'EXECUTIVE SUMMARY', 'COMPANY DESCRIPTION', 'COMPANY OVERVIEW', 'BUSINESS OVERVIEW',
      'MARKET ANALYSIS', 'MARKET RESEARCH', 'INDUSTRY ANALYSIS', 'COMPETITIVE ANALYSIS',
      'ORGANIZATION AND MANAGEMENT', 'MANAGEMENT TEAM', 'ORGANIZATIONAL STRUCTURE',
      'PRODUCTS AND SERVICES', 'PRODUCTS OR SERVICES', 'SERVICE OFFERING', 'PRODUCT LINE',
      'MARKETING AND SALES', 'MARKETING STRATEGY', 'SALES STRATEGY', 'GO-TO-MARKET STRATEGY',
      'FINANCIAL PROJECTIONS', 'FINANCIAL PLAN', 'FINANCIAL SUMMARY', 'REVENUE MODEL',
      'FUNDING REQUEST', 'FUNDING REQUIREMENTS', 'INVESTMENT OPPORTUNITY',
      'APPENDIX', 'SUPPORTING DOCUMENTS', 'ATTACHMENTS',
      'MISSION STATEMENT', 'VISION STATEMENT', 'COMPANY MISSION', 'OUR MISSION',
      'TARGET MARKET', 'CUSTOMER SEGMENTS', 'IDEAL CUSTOMER',
      'VALUE PROPOSITION', 'UNIQUE SELLING PROPOSITION', 'COMPETITIVE ADVANTAGE',
      'OPERATIONS PLAN', 'OPERATIONAL PLAN', 'BUSINESS OPERATIONS',
      'MILESTONES', 'TIMELINE', 'ROADMAP', 'KEY MILESTONES',
      'RISK ANALYSIS', 'RISK ASSESSMENT', 'SWOT ANALYSIS',
      'CONCLUSION', 'NEXT STEPS', 'CALL TO ACTION',
      'INTRODUCTION', 'BACKGROUND', 'OVERVIEW', 'ABOUT US', 'WHO WE ARE',
      'PROBLEM', 'THE PROBLEM', 'PROBLEM STATEMENT',
      'SOLUTION', 'THE SOLUTION', 'OUR SOLUTION', 'PROPOSED SOLUTION',
      'BUSINESS MODEL', 'REVENUE STREAMS', 'MONETIZATION',
      'TEAM', 'THE TEAM', 'OUR TEAM', 'LEADERSHIP', 'KEY PERSONNEL',
      'TRACTION', 'ACHIEVEMENTS TO DATE', 'PROGRESS',
      'TERMS AND CONDITIONS', 'LEGAL CONSIDERATIONS',
    ];

    // Check if line is a resume section header (exact match or with ** markers)
    const cleanedLine = line.replace(/^\*\*/, '').replace(/\*\*$/, '').trim();
    const isResumeSectionHeader = resumeSectionHeaders.some(header =>
      cleanedLine.toUpperCase() === header ||
      cleanedLine.toUpperCase() === header + ':' ||
      line.toUpperCase() === header ||
      line.toUpperCase() === header + ':'
    );

    if (isResumeSectionHeader) {
      elements.push({ type: 'h2', text: cleanedLine.replace(/:$/, '') });
      continue;
    }

    // Check if line is a business document section header
    const isBusinessSectionHeader = businessSectionHeaders.some(header =>
      cleanedLine.toUpperCase() === header ||
      cleanedLine.toUpperCase() === header + ':' ||
      line.toUpperCase() === header ||
      line.toUpperCase() === header + ':'
    );

    if (isBusinessSectionHeader) {
      elements.push({ type: 'h2', text: cleanedLine.replace(/:$/, '') });
      continue;
    }

    // Horizontal rule (---, ***, ___)
    if (line.match(/^[-*_]{3,}$/)) {
      elements.push({ type: 'hr', text: '' });
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push({ type: 'blockquote', text: line.slice(2) });
      continue;
    }

    // QR Code syntax: {{QR:url}} or {{QR:url:count}}
    const qrMatch = line.match(/\{\{QR:(.+?)(?::(\d+))?\}\}/i);
    if (qrMatch) {
      elements.push({
        type: 'qr',
        text: '',
        qrData: qrMatch[1].trim(),
        qrCount: qrMatch[2] ? parseInt(qrMatch[2], 10) : 1
      });
      continue;
    }

    // List items
    if (line.match(/^[-*•]\s+/) || line.match(/^\d+\.\s+/)) {
      const text = line.replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, '');
      currentList.push(text);
      continue;
    }

    // Table rows
    if (line.startsWith('|') && line.endsWith('|')) {
      // Skip separator rows (|---|---|)
      if (line.match(/^\|[\s-:|]+\|$/)) {
        continue;
      }
      const cells = line.slice(1, -1).split('|').map(c => c.trim());
      currentTable.push(cells);
      inTable = true;
      continue;
    }

    // Flush any pending list before paragraph
    if (currentList.length > 0) {
      elements.push({ type: 'li', text: '', items: [...currentList] });
      currentList = [];
    }

    // Regular paragraph
    elements.push({ type: 'p', text: line });
  }

  // Flush remaining list or table
  if (currentList.length > 0) {
    elements.push({ type: 'li', text: '', items: [...currentList] });
  }
  if (currentTable.length > 0) {
    elements.push({ type: 'table', text: '', rows: [...currentTable] });
  }

  return elements;
}

/**
 * Normalize special characters for PDF compatibility
 * Fixes em dashes, smart quotes, and other problematic characters
 */
function normalizeText(text: string): string {
  return text
    // Em dashes and en dashes to regular dashes
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    // Smart quotes to regular quotes
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    // Ellipsis
    .replace(/…/g, '...')
    // Non-breaking spaces
    .replace(/\u00A0/g, ' ')
    // Other common problematic characters
    .replace(/•/g, '-')
    .replace(/·/g, '-')
    .trim();
}

/**
 * Clean markdown formatting from text
 */
function cleanMarkdown(text: string): { text: string; bold: boolean; italic: boolean } {
  let normalizedText = normalizeText(text);
  let bold = false;
  let italic = false;

  // Check for bold markers **text**
  if (normalizedText.match(/\*\*(.+?)\*\*/)) {
    normalizedText = normalizedText.replace(/\*\*(.+?)\*\*/g, '$1');
    bold = true;
  }

  // Check for italic markers *text* (single asterisk)
  if (normalizedText.match(/\*(.+?)\*/)) {
    normalizedText = normalizedText.replace(/\*(.+?)\*/g, '$1');
    italic = true;
  }

  // Also handle _italic_ and __bold__
  if (normalizedText.match(/__(.+?)__/)) {
    normalizedText = normalizedText.replace(/__(.+?)__/g, '$1');
    bold = true;
  }
  if (normalizedText.match(/_(.+?)_/)) {
    normalizedText = normalizedText.replace(/_(.+?)_/g, '$1');
    italic = true;
  }

  return { text: normalizedText, bold, italic };
}

export async function POST(request: NextRequest) {
  try {
    const body: DocumentRequest = await request.json();
    const { content, title = 'Document' } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    // Get authenticated user ID from session (secure - not from request body)
    const userId = await getAuthenticatedUserId();

    // Get Supabase client for storage
    const supabase = getSupabaseAdmin();

    // Detect document type for special formatting
    const lowerTitle = title.toLowerCase();
    const lowerContent = content.toLowerCase();

    const isResume = lowerTitle.includes('resume') ||
                     lowerTitle.includes('résumé') ||
                     lowerTitle.includes('cv') ||
                     lowerTitle.includes('curriculum vitae') ||
                     lowerContent.includes('work experience') ||
                     lowerContent.includes('professional experience') ||
                     lowerContent.includes('employment history') ||
                     lowerContent.includes('career summary') ||
                     lowerContent.includes('professional summary') ||
                     (lowerContent.includes('education') && lowerContent.includes('skills')) ||
                     (lowerContent.includes('certifications') && lowerContent.includes('experience'));

    const isInvoice = lowerTitle.includes('invoice') ||
                      lowerTitle.includes('receipt') ||
                      lowerTitle.includes('bill') ||
                      lowerContent.includes('invoice #') ||
                      lowerContent.includes('invoice:') ||
                      lowerContent.includes('bill to') ||
                      lowerContent.includes('total due') ||
                      lowerContent.includes('amount due');

    const isBusinessPlan = lowerTitle.includes('business plan') ||
                           lowerTitle.includes('business proposal') ||
                           lowerContent.includes('executive summary') ||
                           lowerContent.includes('market analysis') ||
                           lowerContent.includes('financial projections') ||
                           (lowerContent.includes('business') && lowerContent.includes('strategy'));

    // Log detected document type for debugging
    console.log('[Documents API] Document type detection:', {
      title,
      isResume,
      isInvoice,
      isBusinessPlan,
      effectiveType: isInvoice ? 'invoice' : (isResume ? 'resume' : (isBusinessPlan ? 'business_plan' : 'generic'))
    });

    // Create PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // === INVOICE: Use dedicated professional template ===
    if (isInvoice) {
      console.log('[Documents API] Generating professional invoice PDF');

      let invoiceData: InvoiceData;
      try {
        invoiceData = parseInvoiceContent(content);
        console.log('[Documents API] Invoice parsed:', {
          companyName: invoiceData.companyName,
          invoiceNumber: invoiceData.invoiceNumber,
          itemCount: invoiceData.items.length
        });
      } catch (parseError) {
        console.error('[Documents API] Invoice parse error:', parseError);
        return NextResponse.json(
          { error: 'Failed to parse invoice content', details: parseError instanceof Error ? parseError.message : 'Unknown parse error' },
          { status: 500 }
        );
      }

      try {
        generateInvoicePDF(doc, invoiceData);
        console.log('[Documents API] Invoice PDF generated successfully');
      } catch (pdfError) {
        console.error('[Documents API] Invoice PDF generation error:', pdfError);
        return NextResponse.json(
          { error: 'Failed to generate invoice PDF', details: pdfError instanceof Error ? pdfError.message : 'Unknown PDF error' },
          { status: 500 }
        );
      }

      // Skip to file upload (bypass markdown rendering)
      // Generate filename
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const pdfFilename = `${safeTitle}_${timestamp}_${randomStr}.pdf`;

      // Generate PDF buffer
      const pdfBuffer = doc.output('arraybuffer');

      // If Supabase is available and userId provided, upload for secure download
      if (supabase && userId) {
        try {
          await supabase.storage.createBucket('documents', {
            public: false,
            fileSizeLimit: 10 * 1024 * 1024,
          });
        } catch {
          // Bucket might already exist
        }

        const pdfPath = `${userId}/${pdfFilename}`;
        const { error: pdfUploadError } = await supabase.storage
          .from('documents')
          .upload(pdfPath, pdfBuffer, {
            contentType: 'application/pdf',
            cacheControl: '3600',
            upsert: false,
          });

        if (pdfUploadError) {
          console.error('[Documents API] Invoice PDF upload error:', pdfUploadError);
          const pdfBase64 = doc.output('datauristring');
          return NextResponse.json({
            success: true,
            format: 'pdf',
            title,
            dataUrl: pdfBase64,
            filename: pdfFilename,
            storage: 'fallback',
          });
        }

        console.log('[Documents API] Invoice PDF uploaded:', pdfPath);

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
                        request.headers.get('origin') ||
                        'https://jcil.ai';

        const pdfToken = Buffer.from(JSON.stringify({ u: userId, f: pdfFilename, t: 'pdf' })).toString('base64url');
        const pdfProxyUrl = `${baseUrl}/api/documents/download?token=${pdfToken}`;

        return NextResponse.json({
          success: true,
          format: 'pdf',
          title,
          filename: pdfFilename,
          downloadUrl: pdfProxyUrl,
          expiresIn: '1 hour',
          storage: 'supabase',
        });
      }

      // Fallback: Return data URL
      const pdfBase64 = doc.output('datauristring');
      return NextResponse.json({
        success: true,
        format: 'pdf',
        title,
        dataUrl: pdfBase64,
        filename: pdfFilename,
        storage: 'local',
      });
    }

    // === BUSINESS PLAN: Use dedicated professional template ===
    // IMPORTANT: Only if NOT a resume (resumes often contain business/strategy keywords)
    if (isBusinessPlan && !isResume) {
      console.log('[Documents API] Generating professional business plan PDF');

      let businessPlanData: BusinessPlanData;
      try {
        businessPlanData = parseBusinessPlanContent(content);
        console.log('[Documents API] Business plan parsed:', {
          companyName: businessPlanData.companyName,
          hasSummary: !!businessPlanData.executiveSummary.missionStatement,
          hasDescription: !!businessPlanData.companyDescription.overview
        });
      } catch (parseError) {
        console.error('[Documents API] Business plan parse error:', parseError);
        return NextResponse.json(
          { error: 'Failed to parse business plan content', details: parseError instanceof Error ? parseError.message : 'Unknown parse error' },
          { status: 500 }
        );
      }

      try {
        generateBusinessPlanPDF(doc, businessPlanData);
        console.log('[Documents API] Business plan PDF generated successfully');
      } catch (pdfError) {
        console.error('[Documents API] Business plan PDF generation error:', pdfError);
        return NextResponse.json(
          { error: 'Failed to generate business plan PDF', details: pdfError instanceof Error ? pdfError.message : 'Unknown PDF error' },
          { status: 500 }
        );
      }

      // Generate filename
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const pdfFilename = `${safeTitle}_${timestamp}_${randomStr}.pdf`;

      // Generate PDF buffer
      const pdfBuffer = doc.output('arraybuffer');

      // If Supabase is available and userId provided, upload for secure download
      if (supabase && userId) {
        try {
          await supabase.storage.createBucket('documents', {
            public: false,
            fileSizeLimit: 10 * 1024 * 1024,
          });
        } catch {
          // Bucket might already exist
        }

        const pdfPath = `${userId}/${pdfFilename}`;
        const { error: pdfUploadError } = await supabase.storage
          .from('documents')
          .upload(pdfPath, pdfBuffer, {
            contentType: 'application/pdf',
            cacheControl: '3600',
            upsert: false,
          });

        if (pdfUploadError) {
          console.error('[Documents API] Business plan PDF upload error:', pdfUploadError);
          const pdfBase64 = doc.output('datauristring');
          return NextResponse.json({
            success: true,
            format: 'pdf',
            title,
            dataUrl: pdfBase64,
            filename: pdfFilename,
            storage: 'fallback',
          });
        }

        console.log('[Documents API] Business plan PDF uploaded:', pdfPath);

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
                        request.headers.get('origin') ||
                        'https://jcil.ai';

        const pdfToken = Buffer.from(JSON.stringify({ u: userId, f: pdfFilename, t: 'pdf' })).toString('base64url');
        const pdfProxyUrl = `${baseUrl}/api/documents/download?token=${pdfToken}`;

        return NextResponse.json({
          success: true,
          format: 'pdf',
          title,
          filename: pdfFilename,
          downloadUrl: pdfProxyUrl,
          expiresIn: '1 hour',
          storage: 'supabase',
        });
      }

      // Fallback: Return data URL
      const pdfBase64 = doc.output('datauristring');
      return NextResponse.json({
        success: true,
        format: 'pdf',
        title,
        dataUrl: pdfBase64,
        filename: pdfFilename,
        storage: 'local',
      });
    }

    // Page settings - tighter margins for resumes, professional for business docs
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = isResume ? 15 : (isBusinessPlan ? 20 : 20);
    const contentWidth = pageWidth - (margin * 2);
    let y = margin;
    let isFirstElement = true;
    let resumeHeaderDone = false;

    // Helper to add new page if needed
    const checkPageBreak = (neededHeight: number) => {
      if (y + neededHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
        return true;
      }
      return false;
    };

    // Parse markdown content
    let elements = parseMarkdown(content);

    // RESUME FIX: Filter out generic document titles at the start
    // Users don't want "Resume Template ATS Friendly" printed - just their actual resume
    if (isResume && elements.length > 0) {
      const genericTitlePatterns = [
        /^resume\s*(template)?/i,
        /^(ats|applicant tracking)/i,
        /^cv\s*(template)?/i,
        /^curriculum vitae/i,
        /^professional resume/i,
        /^modern resume/i,
      ];

      // Check if first element is a generic title (H1 with generic text)
      while (elements.length > 0 && elements[0].type === 'h1') {
        const firstText = elements[0].text.toLowerCase().trim();
        const isGenericTitle = genericTitlePatterns.some(p => p.test(firstText));

        if (isGenericTitle) {
          console.log('[Documents API] Filtering out generic resume title:', elements[0].text);
          elements = elements.slice(1); // Remove the generic title
        } else {
          break; // Found the real name, stop filtering
        }
      }

      // Also filter if the first H1 doesn't look like a name (too long or has keywords)
      if (elements.length > 0 && elements[0].type === 'h1') {
        const firstH1 = elements[0].text.toLowerCase();
        if (firstH1.includes('template') || firstH1.includes('ats') || firstH1.includes('friendly') || firstH1.length > 50) {
          console.log('[Documents API] Filtering out likely template title:', elements[0].text);
          elements = elements.slice(1);
        }
      }
    }

    // Render each element
    for (const element of elements) {
      switch (element.type) {
        case 'h1':
          checkPageBreak(20);
          if (isResume && isFirstElement) {
            // RESUME: Centered name at top, larger and bold
            doc.setFontSize(24);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            const resumeNameText = cleanMarkdown(element.text).text;
            const resumeNameWrapped = doc.splitTextToSize(resumeNameText, contentWidth);
            doc.text(resumeNameWrapped, pageWidth / 2, y, { align: 'center' });
            y += resumeNameWrapped.length * 8 + 2;
            resumeHeaderDone = false;
          } else if (isInvoice && isFirstElement) {
            // INVOICE: Large bold title, right-aligned
            doc.setFontSize(28);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 64, 175);
            doc.text(cleanMarkdown(element.text).text.toUpperCase(), pageWidth - margin, y, { align: 'right' });
            y += 12;
            doc.setDrawColor(30, 64, 175);
            doc.setLineWidth(0.8);
            doc.line(pageWidth - 80, y - 3, pageWidth - margin, y - 3);
            y += 8;
          } else if (isBusinessPlan && isFirstElement) {
            // BUSINESS PLAN: Centered title, professional look
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 58, 138); // Dark blue
            const bpTitleText = cleanMarkdown(element.text).text;
            const bpTitleWrapped = doc.splitTextToSize(bpTitleText, contentWidth);
            doc.text(bpTitleWrapped, pageWidth / 2, y, { align: 'center' });
            y += bpTitleWrapped.length * 8 + 5;
            // Add decorative line
            doc.setDrawColor(30, 58, 138);
            doc.setLineWidth(1);
            doc.line(margin + 30, y, pageWidth - margin - 30, y);
            y += 10;
          } else {
            // GENERIC DOCUMENTS: Professional centered title with decorative styling
            y += 5; // Extra space before title
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 58, 138); // Professional dark blue
            const h1Text = cleanMarkdown(element.text).text;
            const h1Wrapped = doc.splitTextToSize(h1Text, contentWidth);
            const h1Height = h1Wrapped.length * 8;
            checkPageBreak(h1Height + 15);
            // Center the title
            doc.text(h1Wrapped, pageWidth / 2, y, { align: 'center' });
            y += h1Height + 5;
            // Professional underline
            doc.setDrawColor(30, 58, 138);
            doc.setLineWidth(0.8);
            const lineWidth = Math.min(doc.getTextWidth(h1Text), contentWidth * 0.6);
            doc.line(pageWidth / 2 - lineWidth / 2, y, pageWidth / 2 + lineWidth / 2, y);
            y += 10;
          }
          isFirstElement = false;
          break;

        case 'h2':
          checkPageBreak(15);
          if (isResume) {
            // RESUME: Section headers - bold, with subtle line
            // Add extra space before new sections (except first)
            if (!isFirstElement) {
              y += 6; // Space before section header
            }
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            const resumeH2Text = cleanMarkdown(element.text).text.toUpperCase();
            const resumeH2Wrapped = doc.splitTextToSize(resumeH2Text, contentWidth);
            doc.text(resumeH2Wrapped, margin, y);
            y += resumeH2Wrapped.length * 4.5;
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.4);
            doc.line(margin, y, pageWidth - margin, y);
            y += 4;
          } else if (isInvoice) {
            // INVOICE: Section headers
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 64, 175);
            const invoiceH2Text = cleanMarkdown(element.text).text.toUpperCase();
            const invoiceH2Wrapped = doc.splitTextToSize(invoiceH2Text, contentWidth);
            doc.text(invoiceH2Wrapped, margin, y);
            y += invoiceH2Wrapped.length * 5 + 3;
          } else if (isBusinessPlan) {
            // BUSINESS PLAN: Section headers - prominent with background
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            const bpH2Text = cleanMarkdown(element.text).text;
            const bpH2Wrapped = doc.splitTextToSize(bpH2Text, contentWidth - 10);
            const bpH2Height = bpH2Wrapped.length * 6 + 4;
            checkPageBreak(bpH2Height + 5);
            // Light background
            doc.setFillColor(240, 244, 248);
            doc.rect(margin, y - 4, contentWidth, bpH2Height, 'F');
            doc.setTextColor(30, 58, 138);
            doc.text(bpH2Wrapped, margin + 5, y);
            y += bpH2Height + 4;
          } else {
            // GENERIC DOCUMENTS: Professional section headers with accent styling
            y += 8; // Extra space before section
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            const h2Text = cleanMarkdown(element.text).text;
            const h2Wrapped = doc.splitTextToSize(h2Text, contentWidth - 8);
            const h2Height = h2Wrapped.length * 5.5 + 6;
            checkPageBreak(h2Height + 5);
            // Light background with left accent
            doc.setFillColor(245, 247, 250);
            doc.rect(margin, y - 4, contentWidth, h2Height, 'F');
            doc.setFillColor(30, 58, 138);
            doc.rect(margin, y - 4, 3, h2Height, 'F'); // Left accent bar
            doc.setTextColor(30, 58, 138);
            doc.text(h2Wrapped, margin + 8, y);
            y += h2Height + 5;
          }
          resumeHeaderDone = true;
          break;

        case 'h3':
          checkPageBreak(12);
          if (isResume) {
            // RESUME: Job title / subsection - bold
            y += 3; // Small space before job title/subsection
            doc.setFontSize(10.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            const resumeH3Text = cleanMarkdown(element.text).text;
            const resumeH3Wrapped = doc.splitTextToSize(resumeH3Text, contentWidth);
            doc.text(resumeH3Wrapped, margin, y);
            y += resumeH3Wrapped.length * 4.5 + 1;
          } else if (isBusinessPlan) {
            // BUSINESS PLAN: Subsection headers
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(55, 65, 81);
            const bpH3Text = cleanMarkdown(element.text).text;
            const bpH3Wrapped = doc.splitTextToSize(bpH3Text, contentWidth);
            const bpH3Height = bpH3Wrapped.length * 5;
            checkPageBreak(bpH3Height + 4);
            doc.text(bpH3Wrapped, margin, y);
            y += bpH3Height + 4;
          } else {
            // GENERIC DOCUMENTS: Subsection headers with subtle styling
            y += 5; // Space before subsection
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(55, 65, 81); // Dark gray
            const h3Text = cleanMarkdown(element.text).text;
            const h3Wrapped = doc.splitTextToSize(h3Text, contentWidth);
            const h3Height = h3Wrapped.length * 4.5;
            checkPageBreak(h3Height + 6);
            doc.text(h3Wrapped, margin, y);
            y += h3Height + 1;
            // Subtle underline
            doc.setDrawColor(180, 190, 200);
            doc.setLineWidth(0.3);
            doc.line(margin, y, margin + Math.min(doc.getTextWidth(h3Text), contentWidth * 0.4), y);
            y += 5;
          }
          break;

        case 'p':
          const cleaned = cleanMarkdown(element.text);
          const lowerText = cleaned.text.toLowerCase();

          if (isResume && !resumeHeaderDone) {
            // RESUME: Contact info - centered, smaller
            // BUT: if the text is long (>100 chars), it's likely a summary, not contact info
            // Force left-align for long paragraphs even if we haven't seen a header yet
            const isLikelyContactInfo = cleaned.text.length < 100 &&
              !cleaned.text.toLowerCase().includes('experience') &&
              !cleaned.text.toLowerCase().includes('professional') &&
              !cleaned.text.toLowerCase().includes('proven track record') &&
              !cleaned.text.toLowerCase().includes('skilled in') &&
              !cleaned.text.toLowerCase().includes('expertise in');

            if (isLikelyContactInfo) {
              doc.setFontSize(9.5);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(60, 60, 60);
              doc.text(cleaned.text, pageWidth / 2, y, { align: 'center' });
              y += 5;
            } else {
              // Long text or summary-like content - left align and mark header as done
              resumeHeaderDone = true;
              doc.setFontSize(9.5);
              let fontStyle: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal';
              if (cleaned.bold && cleaned.italic) fontStyle = 'bolditalic';
              else if (cleaned.bold) fontStyle = 'bold';
              else if (cleaned.italic) fontStyle = 'italic';
              doc.setFont('helvetica', fontStyle);
              doc.setTextColor(51, 51, 51);

              const splitText = doc.splitTextToSize(cleaned.text, contentWidth);
              const textHeight = splitText.length * 3.8;
              checkPageBreak(textHeight + 2);

              doc.text(splitText, margin, y);
              y += textHeight + 1.5;
            }
          } else if (isInvoice && (lowerText.includes('total due') || lowerText.includes('amount due') || lowerText.includes('balance due'))) {
            // INVOICE: Total Due - Large, bold, right-aligned, with background
            checkPageBreak(15);
            doc.setFillColor(30, 64, 175);
            doc.rect(pageWidth - margin - 80, y - 5, 80, 12, 'F');
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(255, 255, 255);
            doc.text(cleaned.text, pageWidth - margin - 4, y + 2, { align: 'right' });
            y += 15;
          } else if (isInvoice && (lowerText.includes('subtotal') || lowerText.includes('tax'))) {
            // INVOICE: Subtotal/Tax - Right-aligned, bold
            checkPageBreak(8);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(51, 51, 51);
            doc.text(cleaned.text, pageWidth - margin, y, { align: 'right' });
            y += 7;
          } else if (isInvoice && (
            lowerText.startsWith('from:') ||
            lowerText.startsWith('bill to:') ||
            lowerText.includes('invoice #') ||
            lowerText.includes('invoice:') ||
            lowerText.startsWith('date:') ||
            lowerText.startsWith('due date:') ||
            lowerText.startsWith('payment terms:') ||
            lowerText.startsWith('accepted payment') ||
            lowerText.includes('thank you')
          )) {
            // INVOICE: Header labels (From:, Bill To:, Invoice #, etc.) - Bold, tight spacing
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 64, 175);
            doc.text(cleaned.text, margin, y);
            y += 5; // Tight spacing for labels
          } else if (isInvoice && (
            // Detect address/contact lines: contains phone, email, city/state patterns, or is short text after From:/Bill To:
            lowerText.includes('phone:') ||
            lowerText.includes('email:') ||
            lowerText.match(/[a-z]+,\s*[a-z]{2}\s*\d{5}/i) || // City, ST ZIP pattern
            lowerText.match(/^\d+\s+\w+/) || // Street address pattern (123 Main St)
            (cleaned.text.length < 50 && !lowerText.includes(':') && y < 120) // Short lines in header area
          )) {
            // INVOICE: Address/contact lines - Normal weight, single-spaced
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(51, 51, 51);
            doc.text(cleaned.text, margin, y);
            y += 4; // Single-spaced for address lines
          } else if (isResume) {
            // RESUME PARAGRAPH - Force left-align everything
            // Detect if this looks like a job title
            const jobTitlePatterns = /(vice president|director|manager|supervisor|coordinator|specialist|analyst|engineer|developer|consultant|associate|assistant|executive|officer|lead|senior|junior|head of|chief|fellow|resident|attending|surgeon|physician|professor|technician|nurse|therapist)/i;
            const skillsPattern = /^(\*\*)?[A-Za-z]+(\s+[A-Za-z]+)?:(\*\*)?\s/; // Pattern like "Technical: " or "**Surgical Specialties:**"

            // Date pattern to extract dates from company lines
            // Matches: "June 2019 - Present", "2019 - 2023", "January 2020 - December 2022", "2019", etc.
            const dateExtractPattern = /\s+((?:(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+)?\d{4}\s*[-–]\s*(?:(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+)?(?:\d{4}|Present|Current)|(?:(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+)?\d{4})$/i;

            const isLikelyJobTitle = jobTitlePatterns.test(cleaned.text) && cleaned.text.length < 80 && !dateExtractPattern.test(cleaned.text);
            const dateMatch = cleaned.text.match(dateExtractPattern);
            const isLikelyCompanyLine = dateMatch !== null;
            const isLikelySkillLine = skillsPattern.test(cleaned.text);

            if (isLikelyJobTitle) {
              // Job title - bold, left-aligned
              y += 2; // Small space before job title
              checkPageBreak(6);
              doc.setFontSize(10);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(0, 0, 0);
              const titleWrapped = doc.splitTextToSize(cleaned.text, contentWidth);
              doc.text(titleWrapped, margin, y);
              y += titleWrapped.length * 4 + 1;
            } else if (isLikelyCompanyLine && dateMatch) {
              // Company with dates - company LEFT, date RIGHT on same line
              checkPageBreak(5);

              // Split the text: company/location on left, date on right
              const dateText = dateMatch[1].trim();
              const companyText = cleaned.text.replace(dateExtractPattern, '').trim();

              // Draw company name (left-aligned, bold)
              doc.setFontSize(10);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(0, 0, 0);

              // Calculate available width for company (leave room for date)
              const dateWidth = doc.getTextWidth(dateText);
              const companyMaxWidth = contentWidth - dateWidth - 10; // 10mm gap
              const companyWrapped = doc.splitTextToSize(companyText, companyMaxWidth);
              doc.text(companyWrapped, margin, y);

              // Draw date (right-aligned on same line)
              doc.setFont('helvetica', 'normal');
              doc.text(dateText, pageWidth - margin, y, { align: 'right' });

              y += companyWrapped.length * 4;
            } else if (isLikelySkillLine) {
              // Skills line - left-aligned with proper wrapping
              y += 1;
              checkPageBreak(5);
              doc.setFontSize(9.5);
              doc.setFont('helvetica', cleaned.bold ? 'bold' : 'normal');
              doc.setTextColor(0, 0, 0);
              const splitText = doc.splitTextToSize(cleaned.text, contentWidth);
              doc.text(splitText, margin, y);
              y += splitText.length * 3.8 + 2;
            } else {
              // Regular resume paragraph - left-aligned
              doc.setFontSize(9.5);
              let fontStyle: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal';
              if (cleaned.bold && cleaned.italic) fontStyle = 'bolditalic';
              else if (cleaned.bold) fontStyle = 'bold';
              else if (cleaned.italic) fontStyle = 'italic';
              doc.setFont('helvetica', fontStyle);
              doc.setTextColor(51, 51, 51);

              const splitText = doc.splitTextToSize(cleaned.text, contentWidth);
              const textHeight = splitText.length * 3.8;
              checkPageBreak(textHeight + 2);

              doc.text(splitText, margin, y);
              y += textHeight + 1.5;
            }
          } else {
            // Non-resume standard paragraph - consistent line height and spacing
            const fontSize = isBusinessPlan ? 11 : (isInvoice ? 10 : 11);
            const paragraphLineHeight = isBusinessPlan ? 5.5 : (isInvoice ? 4 : 5);
            const paragraphSpacing = isBusinessPlan ? 4 : (isInvoice ? 1 : 3);

            doc.setFontSize(fontSize);
            let fontStyle: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal';
            if (cleaned.bold && cleaned.italic) fontStyle = 'bolditalic';
            else if (cleaned.bold) fontStyle = 'bold';
            else if (cleaned.italic) fontStyle = 'italic';
            doc.setFont('helvetica', fontStyle);
            doc.setTextColor(51, 51, 51);

            const splitText = doc.splitTextToSize(cleaned.text, contentWidth);
            const textHeight = splitText.length * paragraphLineHeight;
            checkPageBreak(textHeight + paragraphSpacing);

            doc.text(splitText, margin, y);
            y += textHeight + paragraphSpacing;
          }
          break;

        case 'li':
          // Bullet points indicate we're past the contact info section
          if (isResume) {
            resumeHeaderDone = true;
          }
          if (element.items) {
            for (const item of element.items) {
              const itemCleaned = cleanMarkdown(item);
              checkPageBreak(isResume ? 5 : 7);
              doc.setFontSize(isResume ? 9.5 : 11);
              let itemFontStyle: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal';
              if (itemCleaned.bold && itemCleaned.italic) itemFontStyle = 'bolditalic';
              else if (itemCleaned.bold) itemFontStyle = 'bold';
              else if (itemCleaned.italic) itemFontStyle = 'italic';
              doc.setFont('helvetica', itemFontStyle);
              doc.setTextColor(51, 51, 51);

              // Bullet point - smaller for resumes
              doc.setFillColor(51, 51, 51);
              doc.circle(margin + 2, y - 1.2, isResume ? 0.5 : 0.8, 'F');

              // Item text - tighter line height for resumes
              const bulletIndent = isResume ? 7 : 8;
              const itemText = doc.splitTextToSize(itemCleaned.text, contentWidth - bulletIndent - 2);
              doc.text(itemText, margin + bulletIndent, y);
              y += itemText.length * (isResume ? 3.8 : 5) + (isResume ? 0.5 : 2);
            }
            y += isResume ? 2 : 2; // Small gap after bullet list
          }
          break;

        case 'table':
          if (element.rows && element.rows.length > 0) {
            const colCount = element.rows[0].length;
            const rowHeight = isInvoice ? 9 : 8;

            // For invoices: Use custom column widths (Description wider, numbers narrower)
            let colWidths: number[];
            if (isInvoice && colCount === 4) {
              // Invoice table: Description | Qty | Rate | Amount
              colWidths = [contentWidth * 0.45, contentWidth * 0.15, contentWidth * 0.2, contentWidth * 0.2];
            } else {
              // Equal widths for other tables
              const colWidth = contentWidth / colCount;
              colWidths = Array(colCount).fill(colWidth);
            }

            checkPageBreak(element.rows.length * rowHeight + 5);

            // For invoices: Add top border
            if (isInvoice) {
              doc.setDrawColor(30, 64, 175);
              doc.setLineWidth(0.5);
              doc.line(margin, y - 5, pageWidth - margin, y - 5);
            }

            for (let rowIdx = 0; rowIdx < element.rows.length; rowIdx++) {
              const row = element.rows[rowIdx];
              const isHeader = rowIdx === 0;
              const isLastRow = rowIdx === element.rows.length - 1;

              // Background for header
              if (isHeader) {
                if (isInvoice) {
                  doc.setFillColor(30, 64, 175); // Blue header for invoices
                } else {
                  doc.setFillColor(241, 245, 249);
                }
                doc.rect(margin, y - 5, contentWidth, rowHeight, 'F');
              } else if (isInvoice && rowIdx % 2 === 0) {
                // Alternating row colors for invoices
                doc.setFillColor(248, 250, 252);
                doc.rect(margin, y - 5, contentWidth, rowHeight, 'F');
              }

              // Cell borders
              doc.setDrawColor(isInvoice ? 200 : 203, isInvoice ? 200 : 213, isInvoice ? 200 : 225);
              doc.setLineWidth(0.3);
              doc.line(margin, y + 3, pageWidth - margin, y + 3);

              // Cell content
              let cellX = margin;
              for (let colIdx = 0; colIdx < row.length; colIdx++) {
                const cellCleaned = cleanMarkdown(row[colIdx]);
                doc.setFontSize(isInvoice ? 10 : 10);

                if (isHeader) {
                  doc.setFont('helvetica', 'bold');
                  doc.setTextColor(isInvoice ? 255 : 30, isInvoice ? 255 : 64, isInvoice ? 255 : 175);
                } else {
                  doc.setFont('helvetica', 'normal');
                  doc.setTextColor(51, 51, 51);
                }

                // Right-align numbers (last 3 columns for invoices)
                const isNumberColumn = isInvoice && colIdx > 0;
                const textAlign = isNumberColumn ? 'right' : 'left';
                const textX = isNumberColumn ? cellX + colWidths[colIdx] - 2 : cellX + 2;

                const cellText = cellCleaned.text.slice(0, 35);
                if (textAlign === 'right') {
                  doc.text(cellText, textX, y, { align: 'right' });
                } else {
                  doc.text(cellText, textX, y);
                }

                cellX += colWidths[colIdx];
              }

              y += rowHeight;

              // For invoices: Add bottom border after last row
              if (isInvoice && isLastRow) {
                doc.setDrawColor(30, 64, 175);
                doc.setLineWidth(0.5);
                doc.line(margin, y - 5, pageWidth - margin, y - 5);
              }
            }
            y += 5;
          }
          break;

        case 'blockquote':
          checkPageBreak(10);
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(30, 64, 175);

          const quoteText = doc.splitTextToSize(cleanMarkdown(element.text).text, contentWidth - 15);
          const quoteHeight = quoteText.length * 5 + 6;

          doc.rect(margin, y - 4, contentWidth, quoteHeight, 'F');
          doc.setLineWidth(1);
          doc.line(margin, y - 4, margin, y - 4 + quoteHeight);

          doc.setFontSize(11);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(71, 85, 105);
          doc.text(quoteText, margin + 8, y);
          y += quoteHeight + 3;
          break;

        case 'hr':
          // Horizontal rule - minimal spacing for invoices, normal for others
          if (isInvoice) {
            // For invoices: subtle gray line with minimal spacing
            y += 2;
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.3);
            doc.line(margin, y, pageWidth - margin, y);
            y += 4;
          } else {
            // For other documents: more visible line with spacing
            y += 3;
            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.5);
            doc.line(margin, y, pageWidth - margin, y);
            y += 6;
          }
          break;

        case 'qr':
          if (element.qrData) {
            const qrCount = Math.min(element.qrCount || 1, 20); // Max 20 QR codes

            // Calculate optimal grid layout for easy cutting
            // Use larger gaps (10mm) for cutting guides
            const gap = 10; // 10mm gap between QR codes for cutting

            // Calculate columns based on count for optimal layout
            let cols: number;
            if (qrCount === 1) cols = 1;
            else if (qrCount <= 2) cols = 2;
            else if (qrCount <= 4) cols = 2;
            else if (qrCount <= 6) cols = 3;
            else if (qrCount <= 9) cols = 3;
            else cols = 4; // 10-20 codes use 4 columns

            const rows = Math.ceil(qrCount / cols);

            // Calculate QR size based on available space with proper margins
            const availableWidth = contentWidth - (cols - 1) * gap;
            const availableHeight = pageHeight - margin * 2 - y - 20; // Extra bottom margin

            const qrSize = Math.min(
              availableWidth / cols,
              availableHeight / rows - gap,
              50 // Max size 50mm for good scannability
            );

            // Calculate total grid dimensions for centering
            const gridWidth = cols * qrSize + (cols - 1) * gap;
            const gridHeight = rows * qrSize + (rows - 1) * gap;
            const startX = margin + (contentWidth - gridWidth) / 2; // Center horizontally

            // Generate QR code image with higher quality
            try {
              const qrDataUrl = await QRCode.toDataURL(element.qrData, {
                width: 400, // Higher resolution
                margin: 2,  // Quiet zone
                color: { dark: '#000000', light: '#ffffff' },
                errorCorrectionLevel: 'M',
              });

              // Check if we need a new page for the grid
              checkPageBreak(gridHeight + 10);

              // Draw QR codes in centered grid
              for (let i = 0; i < qrCount; i++) {
                const col = i % cols;
                const row = Math.floor(i / cols);

                const qrX = startX + col * (qrSize + gap);
                const qrY = y + row * (qrSize + gap);

                // Check page break for each row
                if (qrY + qrSize > pageHeight - margin) {
                  doc.addPage();
                  y = margin;
                }

                const finalY = row === 0 ? y : y + row * (qrSize + gap);

                // Add QR code image
                doc.addImage(qrDataUrl, 'PNG', qrX, finalY, qrSize, qrSize);

                // Add subtle cutting guides (light gray dashed lines)
                if (qrCount > 1) {
                  doc.setDrawColor(220, 220, 220);
                  doc.setLineWidth(0.2);
                  // Draw cutting guide rectangle around each QR
                  doc.rect(qrX - 2, finalY - 2, qrSize + 4, qrSize + 4);
                }
              }

              y += gridHeight + 15;
            } catch (qrError) {
              console.error('[Documents API] QR generation error:', qrError);
              // Fallback: show text placeholder
              doc.setFontSize(10);
              doc.setTextColor(150, 150, 150);
              doc.text(`[QR Code: ${element.qrData}]`, margin, y);
              y += 10;
            }
          }
          break;
      }
    }

    // Add simple page numbers only (no branding - just what user asked for)
    const pageCount = doc.getNumberOfPages();
    if (pageCount > 1) {
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(
          `${i} / ${pageCount}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }
    }

    // Generate filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const pdfFilename = `${safeTitle}_${timestamp}_${randomStr}.pdf`;

    // Generate PDF buffer
    const pdfBuffer = doc.output('arraybuffer');

    // If Supabase is available and userId provided, upload for secure download
    if (supabase && userId) {
      // Ensure bucket exists
      try {
        await supabase.storage.createBucket('documents', {
          public: false,
          fileSizeLimit: 10 * 1024 * 1024,
        });
      } catch {
        // Bucket might already exist, that's fine
      }

      // Upload PDF
      const pdfPath = `${userId}/${pdfFilename}`;
      const { error: pdfUploadError } = await supabase.storage
        .from('documents')
        .upload(pdfPath, pdfBuffer, {
          contentType: 'application/pdf',
          cacheControl: '3600',
          upsert: false,
        });

      if (pdfUploadError) {
        console.error('[Documents API] PDF upload error:', pdfUploadError);
        // Fallback to data URL
        const pdfBase64 = doc.output('datauristring');
        return NextResponse.json({
          success: true,
          format: 'pdf',
          title,
          dataUrl: pdfBase64,
          filename: pdfFilename,
          storage: 'fallback',
        });
      }

      console.log('[Documents API] PDF uploaded successfully:', pdfPath);

      // Generate clean proxy URL that hides Supabase details
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
                      request.headers.get('origin') ||
                      'https://jcil.ai';

      const pdfToken = Buffer.from(JSON.stringify({ u: userId, f: pdfFilename, t: 'pdf' })).toString('base64url');
      const pdfProxyUrl = `${baseUrl}/api/documents/download?token=${pdfToken}`;

      return NextResponse.json({
        success: true,
        format: 'pdf',
        title,
        filename: pdfFilename,
        downloadUrl: pdfProxyUrl,
        expiresIn: '1 hour',
        storage: 'supabase',
      });
    }

    // Fallback: Return data URL if no Supabase or no userId
    const pdfBase64 = doc.output('datauristring');
    return NextResponse.json({
      success: true,
      format: 'pdf',
      title,
      dataUrl: pdfBase64,
      filename: pdfFilename,
      storage: 'local',
    });

  } catch (error) {
    console.error('[Documents API] Error generating document:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate document',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
