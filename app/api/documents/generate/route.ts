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
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
} from 'docx';

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
  type: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'table' | 'blockquote' | 'qr';
  text: string;
  items?: string[];
  rows?: string[][];
  qrData?: string;
  qrCount?: number;
}> {
  const lines = markdown.split('\n');
  const elements: Array<{
    type: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'table' | 'blockquote' | 'qr';
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

/**
 * Generate a Word document from parsed markdown elements
 * Formatting matches the PDF output for consistency
 */
async function generateWordDocument(
  elements: Array<{
    type: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'table' | 'blockquote' | 'qr';
    text: string;
    items?: string[];
    rows?: string[][];
    qrData?: string;
    qrCount?: number;
  }>,
  isResume: boolean,
  title: string
): Promise<Buffer> {
  const children: Paragraph[] = [];
  let isFirstElement = true;
  let resumeHeaderDone = false;

  for (const element of elements) {
    switch (element.type) {
      case 'h1':
        if (isResume && isFirstElement) {
          // Resume: Centered name - matches PDF (24pt bold, centered)
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: cleanMarkdown(element.text).text,
                  bold: true,
                  size: 48, // 24pt (Word uses half-points)
                  font: 'Calibri',
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 60 }, // Tight spacing like PDF (6mm equivalent)
            })
          );
        } else {
          // Standard H1 - blue header with underline style
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: cleanMarkdown(element.text).text,
                  bold: true,
                  size: 40, // 20pt
                  color: '1E40AF', // Blue like PDF
                  font: 'Calibri',
                }),
              ],
              border: {
                bottom: { style: BorderStyle.SINGLE, size: 8, color: '1E40AF' },
              },
              spacing: { after: 200 },
            })
          );
        }
        isFirstElement = false;
        break;

      case 'h2':
        if (isResume) {
          // Resume: Section headers - UPPERCASE with gray underline (matches PDF)
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: cleanMarkdown(element.text).text.toUpperCase(),
                  bold: true,
                  size: 24, // 12pt
                  font: 'Calibri',
                }),
              ],
              border: {
                bottom: { style: BorderStyle.SINGLE, size: 6, color: '646464' },
              },
              spacing: { before: 200, after: 100 },
            })
          );
        } else {
          // Standard H2 - blue, slightly smaller
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: cleanMarkdown(element.text).text,
                  bold: true,
                  size: 32, // 16pt
                  color: '1E40AF',
                  font: 'Calibri',
                }),
              ],
              spacing: { before: 160, after: 120 },
            })
          );
        }
        resumeHeaderDone = true;
        break;

      case 'h3':
        // Job titles / subsections - bold
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: cleanMarkdown(element.text).text,
                bold: true,
                size: isResume ? 22 : 26, // 11pt or 13pt
                font: 'Calibri',
              }),
            ],
            spacing: { before: 120, after: 60 },
          })
        );
        break;

      case 'p':
        const cleaned = cleanMarkdown(element.text);
        if (isResume && !resumeHeaderDone) {
          // Resume: Contact info - centered, smaller, gray (matches PDF)
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: cleaned.text,
                  size: 20, // 10pt
                  color: '3C3C3C', // Dark gray
                  font: 'Calibri',
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 160 },
            })
          );
        } else {
          // Standard paragraph
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: cleaned.text,
                  bold: cleaned.bold,
                  italics: cleaned.italic,
                  size: isResume ? 20 : 22, // 10pt or 11pt
                  font: 'Calibri',
                }),
              ],
              spacing: { after: isResume ? 60 : 100 },
            })
          );
        }
        break;

      case 'li':
        if (element.items) {
          for (const item of element.items) {
            const itemCleaned = cleanMarkdown(item);
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `• ${itemCleaned.text}`,
                    bold: itemCleaned.bold,
                    italics: itemCleaned.italic,
                    size: isResume ? 20 : 22,
                    font: 'Calibri',
                  }),
                ],
                indent: { left: 360 }, // 0.25 inch
                spacing: { after: isResume ? 30 : 60 }, // Tighter for resumes
              })
            );
          }
        }
        break;

      case 'table':
        // Tables - render as formatted text rows for now
        // Full table support would require docx Table objects
        if (element.rows && element.rows.length > 0) {
          for (let rowIdx = 0; rowIdx < element.rows.length; rowIdx++) {
            const row = element.rows[rowIdx];
            const isHeader = rowIdx === 0;
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: row.map(cell => cleanMarkdown(cell).text).join('  |  '),
                    bold: isHeader,
                    size: 20,
                    font: 'Calibri',
                  }),
                ],
                spacing: { after: 40 },
              })
            );
          }
          // Add spacing after table
          children.push(new Paragraph({ spacing: { after: 100 } }));
        }
        break;

      case 'blockquote':
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: cleanMarkdown(element.text).text,
                italics: true,
                color: '475569', // Slate gray
                font: 'Calibri',
              }),
            ],
            indent: { left: 720 }, // 0.5 inch
            spacing: { after: 100 },
            shading: { fill: 'F8FAFC' }, // Light background
          })
        );
        break;

      case 'qr':
        // QR codes can't be embedded in Word - add clear instruction
        if (element.qrData) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `📱 QR Code Link: ${element.qrData}`,
                  color: '1E40AF',
                  font: 'Calibri',
                  size: 20,
                }),
              ],
              spacing: { after: 100 },
            })
          );
        }
        break;
    }
  }

  const doc = new Document({
    title: title,
    creator: 'JCIL.AI',
    sections: [
      {
        properties: {
          page: {
            margin: {
              // Match PDF margins: 15mm for resume, 20mm for regular docs
              // Word uses twentieths of a point (1440 = 1 inch)
              top: isResume ? 567 : 1134, // ~10mm or ~20mm
              right: isResume ? 567 : 1134,
              bottom: isResume ? 567 : 1134,
              left: isResume ? 567 : 1134,
            },
          },
        },
        children,
      },
    ],
  });

  return await Packer.toBuffer(doc);
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

    // Create PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Page settings - tighter margins for resumes
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = isResume ? 15 : 20;
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
    const elements = parseMarkdown(content);

    // Render each element
    for (const element of elements) {
      switch (element.type) {
        case 'h1':
          checkPageBreak(15);
          if (isResume && isFirstElement) {
            // RESUME: Centered name at top, larger and bold
            doc.setFontSize(24);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0); // Black for professional look
            doc.text(cleanMarkdown(element.text).text, pageWidth / 2, y, { align: 'center' });
            y += 6; // Tight spacing - contact info goes right below name
            resumeHeaderDone = false; // Next paragraph might be contact info
          } else {
            // Standard H1
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 64, 175);
            doc.text(cleanMarkdown(element.text).text, margin, y);
            y += 12;
            doc.setDrawColor(30, 64, 175);
            doc.setLineWidth(0.5);
            doc.line(margin, y - 3, pageWidth - margin, y - 3);
            y += 5;
          }
          isFirstElement = false;
          break;

        case 'h2':
          checkPageBreak(12);
          if (isResume) {
            // RESUME: Section headers - bold, with subtle line
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text(cleanMarkdown(element.text).text.toUpperCase(), margin, y);
            y += 1;
            doc.setDrawColor(100, 100, 100);
            doc.setLineWidth(0.3);
            doc.line(margin, y, pageWidth - margin, y);
            y += 5;
          } else {
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 64, 175);
            doc.text(cleanMarkdown(element.text).text, margin, y);
            y += 10;
          }
          resumeHeaderDone = true;
          break;

        case 'h3':
          checkPageBreak(10);
          if (isResume) {
            // RESUME: Job title / subsection - bold
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text(cleanMarkdown(element.text).text, margin, y);
            y += 5;
          } else {
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(71, 85, 105);
            doc.text(cleanMarkdown(element.text).text, margin, y);
            y += 8;
          }
          break;

        case 'p':
          const cleaned = cleanMarkdown(element.text);

          if (isResume && !resumeHeaderDone) {
            // RESUME: Contact info - centered, smaller
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(60, 60, 60);
            doc.text(cleaned.text, pageWidth / 2, y, { align: 'center' });
            y += 6;
          } else {
            // Standard paragraph
            doc.setFontSize(isResume ? 10 : 11);
            let fontStyle: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal';
            if (cleaned.bold && cleaned.italic) fontStyle = 'bolditalic';
            else if (cleaned.bold) fontStyle = 'bold';
            else if (cleaned.italic) fontStyle = 'italic';
            doc.setFont('helvetica', fontStyle);
            doc.setTextColor(51, 51, 51);

            const splitText = doc.splitTextToSize(cleaned.text, contentWidth);
            const textHeight = splitText.length * (isResume ? 4 : 5);
            checkPageBreak(textHeight);

            doc.text(splitText, margin, y);
            y += textHeight + (isResume ? 2 : 3);
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
            const colWidth = contentWidth / colCount;
            const rowHeight = 8;

            checkPageBreak(element.rows.length * rowHeight + 5);

            for (let rowIdx = 0; rowIdx < element.rows.length; rowIdx++) {
              const row = element.rows[rowIdx];
              const isHeader = rowIdx === 0;

              // Background for header
              if (isHeader) {
                doc.setFillColor(241, 245, 249);
                doc.rect(margin, y - 5, contentWidth, rowHeight, 'F');
              }

              // Cell borders
              doc.setDrawColor(203, 213, 225);
              doc.setLineWidth(0.3);
              doc.line(margin, y + 3, pageWidth - margin, y + 3);

              // Cell content
              for (let colIdx = 0; colIdx < row.length; colIdx++) {
                const cellCleaned = cleanMarkdown(row[colIdx]);
                doc.setFontSize(10);
                doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
                doc.setTextColor(isHeader ? 30 : 51, isHeader ? 64 : 51, isHeader ? 175 : 51);

                const cellX = margin + (colIdx * colWidth) + 2;
                doc.text(cellCleaned.text.slice(0, 25), cellX, y);
              }

              y += rowHeight;
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

    // Generate filenames
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const pdfFilename = `${safeTitle}_${timestamp}_${randomStr}.pdf`;
    const wordFilename = `${safeTitle}_${timestamp}_${randomStr}.docx`;

    // Generate PDF buffer
    const pdfBuffer = doc.output('arraybuffer');

    // Generate Word document for resumes (or if explicitly requested)
    let wordBuffer: Buffer | null = null;
    if (isResume) {
      try {
        wordBuffer = await generateWordDocument(elements, isResume, title);
        console.log('[Documents API] Word document generated, size:', wordBuffer.length);
      } catch (wordError) {
        console.error('[Documents API] Word generation error:', wordError);
        // Continue without Word doc
      }
    }

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

      // Upload Word doc if generated
      let wordDownloadUrl: string | null = null;
      if (wordBuffer) {
        const wordPath = `${userId}/${wordFilename}`;
        console.log('[Documents API] Uploading Word document:', wordPath, 'size:', wordBuffer.length);

        const { error: wordUploadError } = await supabase.storage
          .from('documents')
          .upload(wordPath, wordBuffer, {
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            cacheControl: '3600',
            upsert: true, // Changed to upsert to allow overwrites
          });

        if (wordUploadError) {
          console.error('[Documents API] Word upload failed:', wordUploadError.message);
        } else {
          const { data: wordSignedData, error: wordSignError } = await supabase.storage
            .from('documents')
            .createSignedUrl(wordPath, 3600);

          if (wordSignError) {
            console.error('[Documents API] Word signed URL failed:', wordSignError.message);
          } else {
            wordDownloadUrl = wordSignedData?.signedUrl || null;
            console.log('[Documents API] Word document uploaded successfully, signed URL generated');
          }
        }
      }

      console.log('[Documents API] PDF uploaded successfully:', pdfPath);

      // Generate clean proxy URLs that hide Supabase details
      // Fall back to request origin if NEXT_PUBLIC_APP_URL is not set
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
                      request.headers.get('origin') ||
                      'https://jcil.ai';

      // Encode tokens for proxy URLs
      const pdfToken = Buffer.from(JSON.stringify({ u: userId, f: pdfFilename, t: 'pdf' })).toString('base64url');
      const pdfProxyUrl = `${baseUrl}/api/documents/download?token=${pdfToken}`;

      let wordProxyUrl: string | undefined;
      // Check if Word document was successfully uploaded (wordDownloadUrl is the signed URL)
      if (wordDownloadUrl && wordBuffer) {
        const wordToken = Buffer.from(JSON.stringify({ u: userId, f: wordFilename, t: 'docx' })).toString('base64url');
        wordProxyUrl = `${baseUrl}/api/documents/download?token=${wordToken}`;
        console.log('[Documents API] Word proxy URL generated:', wordProxyUrl.substring(0, 50) + '...');
      } else if (wordBuffer && !wordDownloadUrl) {
        console.warn('[Documents API] Word buffer exists but upload failed - no URL generated');
      }

      // Return both PDF and Word URLs for resumes (using proxy URLs)
      return NextResponse.json({
        success: true,
        format: isResume ? 'both' : 'pdf',
        title,
        // PDF - use proxy URL
        filename: pdfFilename,
        downloadUrl: pdfProxyUrl,
        // Word (if resume) - use proxy URL
        wordFilename: wordBuffer ? wordFilename : undefined,
        wordDownloadUrl: wordProxyUrl,
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
