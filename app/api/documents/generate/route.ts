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
                     lowerContent.includes('work experience') ||
                     lowerContent.includes('professional experience') ||
                     lowerContent.includes('education') && lowerContent.includes('skills');

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

    // Create PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

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
            // Standard H1 - wrap text to prevent overflow
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 64, 175);
            const h1Text = cleanMarkdown(element.text).text;
            const h1Wrapped = doc.splitTextToSize(h1Text, contentWidth);
            const h1Height = h1Wrapped.length * 7;
            checkPageBreak(h1Height + 8);
            doc.text(h1Wrapped, margin, y);
            y += h1Height + 3;
            doc.setDrawColor(30, 64, 175);
            doc.setLineWidth(0.5);
            doc.line(margin, y, pageWidth - margin, y);
            y += 6;
          }
          isFirstElement = false;
          break;

        case 'h2':
          checkPageBreak(15);
          if (isResume) {
            // RESUME: Section headers - bold, with subtle line
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            const resumeH2Text = cleanMarkdown(element.text).text.toUpperCase();
            const resumeH2Wrapped = doc.splitTextToSize(resumeH2Text, contentWidth);
            doc.text(resumeH2Wrapped, margin, y);
            y += resumeH2Wrapped.length * 5;
            doc.setDrawColor(100, 100, 100);
            doc.setLineWidth(0.3);
            doc.line(margin, y, pageWidth - margin, y);
            y += 5;
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
            // Standard H2 - wrap text
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 64, 175);
            const h2Text = cleanMarkdown(element.text).text;
            const h2Wrapped = doc.splitTextToSize(h2Text, contentWidth);
            const h2Height = h2Wrapped.length * 6;
            checkPageBreak(h2Height + 5);
            doc.text(h2Wrapped, margin, y);
            y += h2Height + 5;
          }
          resumeHeaderDone = true;
          break;

        case 'h3':
          checkPageBreak(12);
          if (isResume) {
            // RESUME: Job title / subsection - bold
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            const resumeH3Text = cleanMarkdown(element.text).text;
            const resumeH3Wrapped = doc.splitTextToSize(resumeH3Text, contentWidth);
            doc.text(resumeH3Wrapped, margin, y);
            y += resumeH3Wrapped.length * 5 + 2;
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
            // Standard H3 - wrap text
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(71, 85, 105);
            const h3Text = cleanMarkdown(element.text).text;
            const h3Wrapped = doc.splitTextToSize(h3Text, contentWidth);
            const h3Height = h3Wrapped.length * 5;
            checkPageBreak(h3Height + 4);
            doc.text(h3Wrapped, margin, y);
            y += h3Height + 4;
          }
          break;

        case 'p':
          const cleaned = cleanMarkdown(element.text);
          const lowerText = cleaned.text.toLowerCase();

          if (isResume && !resumeHeaderDone) {
            // RESUME: Contact info - centered, smaller
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(60, 60, 60);
            doc.text(cleaned.text, pageWidth / 2, y, { align: 'center' });
            y += 6;
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
            const jobTitlePatterns = /(vice president|director|manager|supervisor|coordinator|specialist|analyst|engineer|developer|consultant|associate|assistant|executive|officer|lead|senior|junior|head of|chief)/i;
            const companyLinePattern = /^(\*\*)?[A-Z][a-zA-Z\s&,\.]+(\*\*)?,?\s*([\w\s]+,\s*[A-Z]{2})?/;
            const datePattern = /\d{4}|present|current/i;
            const skillsPattern = /^(\*\*)?[A-Za-z]+:(\*\*)?\s/; // Pattern like "Technical: " or "**Leadership:**"

            const isLikelyJobTitle = jobTitlePatterns.test(cleaned.text) && cleaned.text.length < 60;
            const isLikelyCompanyLine = companyLinePattern.test(cleaned.text) && datePattern.test(cleaned.text);
            const isLikelySkillLine = skillsPattern.test(cleaned.text);

            if (isLikelyJobTitle) {
              // Job title - bold, left-aligned
              checkPageBreak(6);
              doc.setFontSize(11);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(0, 0, 0);
              doc.text(cleaned.text, margin, y);
              y += 5;
            } else if (isLikelyCompanyLine) {
              // Company with dates - normal, left-aligned
              checkPageBreak(5);
              doc.setFontSize(10);
              doc.setFont('helvetica', cleaned.bold ? 'bold' : 'normal');
              doc.setTextColor(51, 51, 51);
              doc.text(cleaned.text, margin, y);
              y += 4;
            } else if (isLikelySkillLine) {
              // Skills line - left-aligned
              checkPageBreak(5);
              doc.setFontSize(10);
              doc.setFont('helvetica', cleaned.bold ? 'bold' : 'normal');
              doc.setTextColor(51, 51, 51);
              const splitText = doc.splitTextToSize(cleaned.text, contentWidth);
              doc.text(splitText, margin, y);
              y += splitText.length * 4 + 2;
            } else {
              // Regular resume paragraph - left-aligned
              doc.setFontSize(10);
              let fontStyle: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal';
              if (cleaned.bold && cleaned.italic) fontStyle = 'bolditalic';
              else if (cleaned.bold) fontStyle = 'bold';
              else if (cleaned.italic) fontStyle = 'italic';
              doc.setFont('helvetica', fontStyle);
              doc.setTextColor(51, 51, 51);

              const splitText = doc.splitTextToSize(cleaned.text, contentWidth);
              const textHeight = splitText.length * 4;
              checkPageBreak(textHeight + 2);

              doc.text(splitText, margin, y);
              y += textHeight + 2;
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
          if (element.items) {
            for (const item of element.items) {
              const itemCleaned = cleanMarkdown(item);
              checkPageBreak(isResume ? 5 : 7);
              doc.setFontSize(isResume ? 10 : 11);
              let itemFontStyle: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal';
              if (itemCleaned.bold && itemCleaned.italic) itemFontStyle = 'bolditalic';
              else if (itemCleaned.bold) itemFontStyle = 'bold';
              else if (itemCleaned.italic) itemFontStyle = 'italic';
              doc.setFont('helvetica', itemFontStyle);
              doc.setTextColor(51, 51, 51);

              // Bullet point
              doc.setFillColor(51, 51, 51);
              doc.circle(margin + 2, y - 1.5, isResume ? 0.6 : 0.8, 'F');

              // Item text - tighter for resumes
              const itemText = doc.splitTextToSize(itemCleaned.text, contentWidth - 10);
              doc.text(itemText, margin + 8, y);
              y += itemText.length * (isResume ? 4 : 5) + (isResume ? 1 : 2);
            }
            y += isResume ? 1 : 2;
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

            // Calculate grid layout
            // For 12 QR codes: 4 columns x 3 rows works well on A4
            // For fewer, adjust columns
            let cols: number;
            if (qrCount <= 2) cols = qrCount;
            else if (qrCount <= 4) cols = 2;
            else if (qrCount <= 6) cols = 3;
            else cols = 4;

            const rows = Math.ceil(qrCount / cols);

            // Calculate QR size based on available space
            const qrSize = Math.min(
              (contentWidth - (cols - 1) * 5) / cols, // Fit width with 5mm gaps
              (pageHeight - margin * 2 - y - 10) / rows, // Fit remaining height
              45 // Max size 45mm
            );

            // Generate QR code image
            try {
              const qrDataUrl = await QRCode.toDataURL(element.qrData, {
                width: 300,
                margin: 1,
                color: { dark: '#000000', light: '#ffffff' },
                errorCorrectionLevel: 'M',
              });

              // Check if we need a new page for the grid
              const gridHeight = rows * (qrSize + 5);
              checkPageBreak(gridHeight);

              // Draw QR codes in grid
              for (let i = 0; i < qrCount; i++) {
                const col = i % cols;
                const row = Math.floor(i / cols);

                const x = margin + col * (qrSize + 5);
                const qrY = y + row * (qrSize + 5);

                // Check page break for each row
                if (qrY + qrSize > pageHeight - margin) {
                  doc.addPage();
                  y = margin;
                }

                const finalY = row === 0 ? y : margin + row * (qrSize + 5);

                // Add QR code image
                doc.addImage(qrDataUrl, 'PNG', x, finalY, qrSize, qrSize);
              }

              y += gridHeight + 5;
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
