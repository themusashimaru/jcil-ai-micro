/**
 * INVOICE GENERATOR TOOL
 *
 * Professional invoice generator with line items, tax calculation,
 * discounts, and payment terms. No external dependencies.
 *
 * Created: 2026-03-19
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface LineItem { description: string; quantity: number; unit_price: number; tax_rate?: number }
interface CalcItem extends LineItem { lineTotal: number; taxAmount: number }
interface Totals { subtotal: number; discountAmount: number; taxTotal: number; grandTotal: number }

type InvoiceArgs = {
  invoice_number: string; date?: string; due_date?: string;
  business_name: string; business_address?: string; business_email?: string;
  client_name: string; client_address?: string; client_email?: string;
  line_items: LineItem[]; tax_rate?: number; discount_percent?: number;
  currency?: string; payment_terms?: string; notes?: string; format?: string;
};

const SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: 'CA$', AUD: 'A$', INR: '₹', BRL: 'R$', CHF: 'CHF ', MXN: 'MX$', CNY: '¥', KRW: '₩',
};
const sym = (c: string) => SYMBOLS[c.toUpperCase()] || `${c.toUpperCase()} `;
const fmtC = (n: number, c: string) => {
  const s = sym(c), nd = ['JPY', 'KRW'].includes(c.toUpperCase());
  return `${s}${nd ? Math.round(n).toLocaleString('en-US') : n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};
const todayISO = () => new Date().toISOString().split('T')[0];
const fmtDate = (d: string) => { const dt = new Date(d); return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); };
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const invoiceTool: UnifiedTool = {
  name: 'generate_invoice',
  description: `Generate professional invoices with line items, tax calculation, discounts, and payment terms.

Use this when:
- User needs to create an invoice for a client
- User wants to calculate costs with tax and discounts
- User is a freelancer or small business owner billing clients

Returns a formatted invoice ready to print or send, with all calculations done automatically.`,
  parameters: {
    type: 'object',
    properties: {
      invoice_number: { type: 'string', description: 'Invoice number (e.g., "INV-2026-001")' },
      date: { type: 'string', description: 'Invoice date ISO format. Default: today' },
      due_date: { type: 'string', description: 'Payment due date ISO format' },
      business_name: { type: 'string', description: 'Your business/company name' },
      business_address: { type: 'string', description: 'Your business address' },
      business_email: { type: 'string', description: 'Your business email' },
      client_name: { type: 'string', description: "Client's name or company" },
      client_address: { type: 'string', description: "Client's address" },
      client_email: { type: 'string', description: "Client's email" },
      line_items: { type: 'array', description: 'Items: description, quantity, unit_price, optional tax_rate', items: { type: 'object' } },
      tax_rate: { type: 'string', description: 'Global tax rate percentage' },
      discount_percent: { type: 'string', description: 'Discount percentage on subtotal' },
      currency: { type: 'string', description: 'Currency code. Default: USD' },
      payment_terms: { type: 'string', description: 'Payment terms (e.g., "Net 30")' },
      notes: { type: 'string', description: 'Additional notes' },
      format: { type: 'string', enum: ['html', 'markdown', 'plain_text'], description: 'Output format. Default: html' },
    },
    required: ['invoice_number', 'business_name', 'client_name', 'line_items'],
  },
};

export function isInvoiceAvailable(): boolean { return true; }

function calculate(items: LineItem[], globalTax: number, discPct: number): { calc: CalcItem[]; totals: Totals } {
  const calc: CalcItem[] = [];
  let sub = 0, tax = 0;
  for (const it of items) {
    const lt = it.quantity * it.unit_price, tr = it.tax_rate ?? globalTax, ta = lt * (tr / 100);
    sub += lt; tax += ta;
    calc.push({ ...it, lineTotal: lt, taxAmount: ta });
  }
  if (discPct > 0) {
    const da = sub * (discPct / 100), ds = sub - da, r = sub > 0 ? ds / sub : 0;
    return { calc, totals: { subtotal: sub, discountAmount: da, taxTotal: tax * r, grandTotal: ds + tax * r } };
  }
  return { calc, totals: { subtotal: sub, discountAmount: 0, taxTotal: tax, grandTotal: sub + tax } };
}

function invoiceHtml(a: InvoiceArgs, items: CalcItem[], t: Totals): string {
  const c = a.currency || 'USD', d = fmtDate(a.date || todayISO());
  const extra = (v: string | undefined) => v ? `<p style="margin:0;color:#555;font-size:13px;">${esc(v)}</p>` : '';
  const rows = items.map(i => `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:10px 4px;">${esc(i.description)}</td><td style="padding:10px 4px;text-align:right;">${i.quantity}</td><td style="padding:10px 4px;text-align:right;">${fmtC(i.unit_price, c)}</td><td style="padding:10px 4px;text-align:right;">${fmtC(i.lineTotal, c)}</td></tr>`).join('\n');
  const tl = (lbl: string, val: string, st = '') => `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px;${st}"><span>${lbl}</span><span>${val}</span></div>`;
  let tots = tl('Subtotal', fmtC(t.subtotal, c));
  if (t.discountAmount > 0) tots += tl(`Discount (${a.discount_percent ?? 0}%)`, `-${fmtC(t.discountAmount, c)}`, 'color:#16a34a;');
  if (t.taxTotal > 0) tots += tl('Tax', fmtC(t.taxTotal, c));
  tots += tl('Total', fmtC(t.grandTotal, c), 'font-size:18px;font-weight:700;border-top:2px solid #1a1a1a;margin-top:4px;padding:8px 0;');
  const ft = [a.payment_terms ? `<p style="margin:0 0 8px 0;font-size:14px;"><strong>Payment Terms:</strong> ${esc(a.payment_terms)}</p>` : '', a.notes ? `<p style="margin:0;font-size:13px;color:#555;">${esc(a.notes)}</p>` : ''].filter(Boolean).join('');
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;color:#1a1a1a;max-width:700px;padding:32px;">
<div style="display:flex;justify-content:space-between;margin-bottom:24px;"><div><h1 style="margin:0 0 4px 0;font-size:28px;">${esc(a.business_name)}</h1>${extra(a.business_address)}${extra(a.business_email)}</div>
<div style="text-align:right;"><h2 style="margin:0 0 8px 0;font-size:24px;color:#2563eb;text-transform:uppercase;letter-spacing:2px;">Invoice</h2>
<p style="margin:0;font-size:14px;"><strong>${esc(a.invoice_number)}</strong></p><p style="margin:0;font-size:13px;color:#555;">Date: ${esc(d)}</p>${a.due_date ? `<p style="margin:0;font-size:13px;color:#555;">Due: ${esc(fmtDate(a.due_date))}</p>` : ''}</div></div>
<div style="margin-bottom:24px;padding:12px;background:#f8f9fa;border-radius:4px;"><p style="margin:0 0 4px 0;font-size:12px;text-transform:uppercase;color:#888;">Bill To</p><p style="margin:0;font-weight:600;">${esc(a.client_name)}</p>${extra(a.client_address)}${extra(a.client_email)}</div>
<table style="width:100%;border-collapse:collapse;margin-bottom:24px;"><thead><tr style="border-bottom:2px solid #1a1a1a;"><th style="text-align:left;padding:8px 4px;font-size:13px;text-transform:uppercase;">Description</th><th style="text-align:right;padding:8px 4px;font-size:13px;text-transform:uppercase;">Qty</th><th style="text-align:right;padding:8px 4px;font-size:13px;text-transform:uppercase;">Price</th><th style="text-align:right;padding:8px 4px;font-size:13px;text-transform:uppercase;">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<div style="display:flex;justify-content:flex-end;"><div style="width:280px;">${tots}</div></div>${ft ? `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;">${ft}</div>` : ''}</div>`;
}

function invoicePlainText(a: InvoiceArgs, items: CalcItem[], t: Totals): string {
  const c = a.currency || 'USD', d = fmtDate(a.date || todayISO());
  const sep = '='.repeat(60), dW = 30, qW = 6, pW = 12, aW = 12;
  const l: string[] = [a.business_name.toUpperCase()];
  if (a.business_address) l.push(a.business_address);
  if (a.business_email) l.push(a.business_email);
  l.push(sep, '', `INVOICE: ${a.invoice_number}`, `Date:    ${d}`);
  if (a.due_date) l.push(`Due:     ${fmtDate(a.due_date)}`);
  l.push('', `Bill To: ${a.client_name}`);
  if (a.client_address) l.push(`         ${a.client_address}`);
  if (a.client_email) l.push(`         ${a.client_email}`);
  l.push('', '-'.repeat(60));
  l.push('Description'.padEnd(dW) + 'Qty'.padStart(qW) + 'Unit Price'.padStart(pW) + 'Amount'.padStart(aW));
  l.push('-'.repeat(60));
  for (const i of items) {
    const desc = i.description.length > dW - 1 ? i.description.substring(0, dW - 2) + '.' : i.description;
    l.push(desc.padEnd(dW) + String(i.quantity).padStart(qW) + fmtC(i.unit_price, c).padStart(pW) + fmtC(i.lineTotal, c).padStart(aW));
  }
  l.push('-'.repeat(60));
  l.push('Subtotal'.padEnd(dW + qW + pW) + fmtC(t.subtotal, c).padStart(aW));
  if (t.discountAmount > 0) l.push(`Discount (${a.discount_percent ?? 0}%)`.padEnd(dW + qW + pW) + ('-' + fmtC(t.discountAmount, c)).padStart(aW));
  if (t.taxTotal > 0) l.push('Tax'.padEnd(dW + qW + pW) + fmtC(t.taxTotal, c).padStart(aW));
  l.push(sep, 'TOTAL'.padEnd(dW + qW + pW) + fmtC(t.grandTotal, c).padStart(aW), sep);
  if (a.payment_terms) l.push('', `Payment Terms: ${a.payment_terms}`);
  if (a.notes) l.push('', `Notes: ${a.notes}`);
  return l.join('\n');
}

function invoiceMarkdown(a: InvoiceArgs, items: CalcItem[], t: Totals): string {
  const c = a.currency || 'USD', d = fmtDate(a.date || todayISO());
  const l: string[] = [`# ${a.business_name}`];
  if (a.business_address) l.push(a.business_address);
  if (a.business_email) l.push(a.business_email);
  l.push('', '---', '', `## Invoice ${a.invoice_number}`, `**Date:** ${d}`);
  if (a.due_date) l.push(`**Due:** ${fmtDate(a.due_date)}`);
  l.push('', `**Bill To:** ${a.client_name}`);
  if (a.client_address) l.push(a.client_address);
  l.push('', '| Description | Qty | Unit Price | Amount |', '|---|---:|---:|---:|');
  for (const i of items) l.push(`| ${i.description} | ${i.quantity} | ${fmtC(i.unit_price, c)} | ${fmtC(i.lineTotal, c)} |`);
  l.push('', `| | | **Subtotal** | **${fmtC(t.subtotal, c)}** |`);
  if (t.discountAmount > 0) l.push(`| | | Discount | -${fmtC(t.discountAmount, c)} |`);
  if (t.taxTotal > 0) l.push(`| | | Tax | ${fmtC(t.taxTotal, c)} |`);
  l.push(`| | | **Total** | **${fmtC(t.grandTotal, c)}** |`, '');
  if (a.payment_terms) l.push(`**Payment Terms:** ${a.payment_terms}`, '');
  if (a.notes) l.push(`*${a.notes}*`);
  return l.join('\n');
}

export async function executeInvoice(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as InvoiceArgs;
  if (!args.invoice_number || !args.business_name || !args.client_name)
    return { toolCallId: toolCall.id, content: 'Error: invoice_number, business_name, and client_name are required', isError: true };
  if (!args.line_items?.length)
    return { toolCallId: toolCall.id, content: 'Error: line_items array required with at least one item', isError: true };
  for (let i = 0; i < args.line_items.length; i++) {
    const it = args.line_items[i];
    if (!it.description || typeof it.quantity !== 'number' || typeof it.unit_price !== 'number')
      return { toolCallId: toolCall.id, content: `Error: line_items[${i}] needs description, quantity, unit_price`, isError: true };
  }
  try {
    const format = args.format || 'html', c = args.currency || 'USD';
    const { calc, totals } = calculate(args.line_items, args.tax_rate ?? 0, args.discount_percent ?? 0);
    const document = format === 'markdown' ? invoiceMarkdown(args, calc, totals)
      : format === 'plain_text' ? invoicePlainText(args, calc, totals)
      : invoiceHtml(args, calc, totals);
    return { toolCallId: toolCall.id, content: JSON.stringify({
      success: true, invoiceNumber: args.invoice_number, format, document,
      totals: { subtotal: fmtC(totals.subtotal, c), discount: totals.discountAmount > 0 ? fmtC(totals.discountAmount, c) : null,
        tax: totals.taxTotal > 0 ? fmtC(totals.taxTotal, c) : null, grandTotal: fmtC(totals.grandTotal, c), currency: c },
      metadata: { lineItemCount: calc.length, businessName: args.business_name, clientName: args.client_name },
    })};
  } catch (error) {
    return { toolCallId: toolCall.id, content: `Error: ${(error as Error).message}`, isError: true };
  }
}
