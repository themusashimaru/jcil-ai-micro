/**
 * Document Generation API
 *
 * Generates downloadable PDF documents from markdown content.
 * Returns a data URL that can be downloaded directly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { jsPDF } from 'jspdf';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface DocumentRequest {
  content: string;
  title?: string;
  format?: 'pdf';
}

/**
 * Parse markdown to structured content for PDF
 */
function parseMarkdown(markdown: string): Array<{
  type: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'table' | 'blockquote';
  text: string;
  items?: string[];
  rows?: string[][];
}> {
  const lines = markdown.split('\n');
  const elements: Array<{
    type: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'table' | 'blockquote';
    text: string;
    items?: string[];
    rows?: string[][];
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
 * Clean markdown formatting from text
 */
function cleanMarkdown(text: string): { text: string; bold: boolean } {
  // Check for bold markers
  const boldMatch = text.match(/\*\*(.+?)\*\*/);
  if (boldMatch) {
    return { text: text.replace(/\*\*(.+?)\*\*/g, '$1'), bold: true };
  }
  return { text: text.replace(/\*(.+?)\*/g, '$1'), bold: false };
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

    // Create PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Page settings
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let y = margin;

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
          doc.setFontSize(20);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(30, 64, 175); // Blue color
          doc.text(cleanMarkdown(element.text).text, margin, y);
          y += 12;
          // Underline
          doc.setDrawColor(30, 64, 175);
          doc.setLineWidth(0.5);
          doc.line(margin, y - 3, pageWidth - margin, y - 3);
          y += 5;
          break;

        case 'h2':
          checkPageBreak(12);
          doc.setFontSize(16);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(30, 64, 175);
          doc.text(cleanMarkdown(element.text).text, margin, y);
          y += 10;
          break;

        case 'h3':
          checkPageBreak(10);
          doc.setFontSize(13);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(71, 85, 105); // Gray color
          doc.text(cleanMarkdown(element.text).text, margin, y);
          y += 8;
          break;

        case 'p':
          const cleaned = cleanMarkdown(element.text);
          doc.setFontSize(11);
          doc.setFont('helvetica', cleaned.bold ? 'bold' : 'normal');
          doc.setTextColor(51, 51, 51);

          // Split text to fit width
          const splitText = doc.splitTextToSize(cleaned.text, contentWidth);
          const textHeight = splitText.length * 5;
          checkPageBreak(textHeight);

          doc.text(splitText, margin, y);
          y += textHeight + 3;
          break;

        case 'li':
          if (element.items) {
            for (const item of element.items) {
              const itemCleaned = cleanMarkdown(item);
              checkPageBreak(7);
              doc.setFontSize(11);
              doc.setFont('helvetica', itemCleaned.bold ? 'bold' : 'normal');
              doc.setTextColor(51, 51, 51);

              // Bullet point
              doc.setFillColor(30, 64, 175);
              doc.circle(margin + 2, y - 1.5, 1, 'F');

              // Item text
              const itemText = doc.splitTextToSize(itemCleaned.text, contentWidth - 10);
              doc.text(itemText, margin + 8, y);
              y += itemText.length * 5 + 2;
            }
            y += 3;
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
      }
    }

    // Add footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${i} of ${pageCount} | Generated by JCIL.ai`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    // Generate PDF as base64
    const pdfBase64 = doc.output('datauristring');

    return NextResponse.json({
      success: true,
      format: 'pdf',
      title,
      dataUrl: pdfBase64,
      filename: `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`,
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
