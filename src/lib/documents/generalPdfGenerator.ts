/**
 * GENERAL PDF GENERATOR
 * Creates professional PDF documents from JSON document data
 *
 * Uses PDFKit library to generate PDFs for:
 * - Letters
 * - Reports
 * - Certificates
 * - Flyers
 * - General documents
 */

import PDFDocument from 'pdfkit';
import type { GeneralPdfDocument, PdfParagraph, PdfTable, PdfSection } from './types';

// Default styling - Professional document standards
const DEFAULT_PRIMARY_COLOR = '#1e3a5f'; // Navy blue
const DEFAULT_FONT_SIZE = 11; // Standard professional font size
const DEFAULT_MARGINS = { top: 72, bottom: 72, left: 72, right: 72 }; // 1 inch margins (72pt = 1 inch)
const DEFAULT_LINE_HEIGHT = 1.5; // Professional line spacing

/**
 * Generate a PDF document from general document JSON
 */
export async function generateGeneralPdf(doc: GeneralPdfDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const margins = doc.format?.margins || DEFAULT_MARGINS;
      const primaryColor = doc.format?.primaryColor || DEFAULT_PRIMARY_COLOR;
      const baseFontSize = doc.format?.fontSize || DEFAULT_FONT_SIZE;
      const fontFamily = doc.format?.fontFamily || 'Helvetica';

      const pdfDoc = new PDFDocument({
        size: 'LETTER',
        margins: {
          top: margins.top || DEFAULT_MARGINS.top,
          bottom: margins.bottom || DEFAULT_MARGINS.bottom,
          left: margins.left || DEFAULT_MARGINS.left,
          right: margins.right || DEFAULT_MARGINS.right,
        },
        info: {
          Title: doc.title,
          Author: 'JCIL.AI',
        },
      });

      const chunks: Buffer[] = [];
      pdfDoc.on('data', (chunk) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', reject);

      // Set default font
      pdfDoc.font(fontFamily);

      // Process each section with professional spacing
      for (let i = 0; i < doc.sections.length; i++) {
        const section = doc.sections[i];
        const isFirstSection = i === 0;
        renderSection(pdfDoc, section, baseFontSize, primaryColor, fontFamily, isFirstSection);
      }

      // Add footer if specified
      if (doc.format?.footerText) {
        const pageHeight = pdfDoc.page.height;
        const footerY = pageHeight - 50; // Position above bottom margin
        const leftMargin = margins.left ?? DEFAULT_MARGINS.left;
        const rightMargin = margins.right ?? DEFAULT_MARGINS.right;
        pdfDoc
          .font(fontFamily)
          .fontSize(9)
          .fillColor('#888888')
          .text(doc.format.footerText, leftMargin, footerY, {
            align: 'center',
            width: pdfDoc.page.width - leftMargin - rightMargin,
          });
      }

      pdfDoc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Render a document section with professional spacing
 */
function renderSection(
  pdfDoc: PDFKit.PDFDocument,
  section: PdfSection,
  baseFontSize: number,
  primaryColor: string,
  fontFamily: string,
  isFirstSection: boolean = false
): void {
  const margins = { left: 72, right: 72 }; // Match default margins

  switch (section.type) {
    case 'paragraph':
      if (section.content) {
        renderParagraph(
          pdfDoc,
          section.content as PdfParagraph,
          baseFontSize,
          primaryColor,
          fontFamily,
          isFirstSection
        );
      }
      break;

    case 'table':
      if (section.content) {
        // Add spacing before tables
        if (!isFirstSection) {
          pdfDoc.moveDown(0.8);
        }
        renderTable(
          pdfDoc,
          section.content as PdfTable,
          baseFontSize,
          primaryColor,
          fontFamily,
          margins
        );
        pdfDoc.moveDown(1); // Space after table
      }
      break;

    case 'pageBreak':
      pdfDoc.addPage();
      break;

    case 'horizontalRule':
      pdfDoc.moveDown(0.5);
      const currentY = pdfDoc.y;
      pdfDoc
        .moveTo(margins.left, currentY)
        .lineTo(pdfDoc.page.width - margins.right, currentY)
        .strokeColor('#d0d0d0')
        .lineWidth(0.75)
        .stroke();
      pdfDoc.moveDown(1);
      break;

    case 'spacer':
      pdfDoc.moveDown(1.5); // More generous spacing
      break;
  }
}

/**
 * Render a paragraph with professional typography
 */
function renderParagraph(
  pdfDoc: PDFKit.PDFDocument,
  para: PdfParagraph,
  baseFontSize: number,
  primaryColor: string,
  fontFamily: string,
  isFirstSection: boolean = false
): void {
  let fontSize = baseFontSize;
  let isBold = para.bold || false;
  let color = para.color || '#2d2d2d'; // Slightly softer than pure black
  let spacingBefore = 0;
  let spacingAfter = 0.6; // Default paragraph spacing

  // Determine font size, style, and spacing based on style
  switch (para.style) {
    case 'title':
      fontSize = baseFontSize * 2.2; // ~24pt - prominent but not overwhelming
      isBold = true;
      color = primaryColor;
      spacingBefore = isFirstSection ? 0 : 1.5;
      spacingAfter = 0.3; // Tight spacing to subtitle
      break;
    case 'subtitle':
      fontSize = baseFontSize * 1.4; // ~15pt
      color = '#555555';
      spacingBefore = 0;
      spacingAfter = 1.2; // More space after subtitle before content
      break;
    case 'heading1':
      fontSize = baseFontSize * 1.6; // ~18pt
      isBold = true;
      color = primaryColor;
      spacingBefore = isFirstSection ? 0 : 1.8; // Good separation from previous content
      spacingAfter = 0.6;
      break;
    case 'heading2':
      fontSize = baseFontSize * 1.35; // ~15pt
      isBold = true;
      color = primaryColor;
      spacingBefore = isFirstSection ? 0 : 1.4;
      spacingAfter = 0.5;
      break;
    case 'heading3':
      fontSize = baseFontSize * 1.15; // ~13pt
      isBold = true;
      color = '#333333';
      spacingBefore = isFirstSection ? 0 : 1.0;
      spacingAfter = 0.4;
      break;
    default:
      // Normal paragraph - body text
      spacingBefore = 0;
      spacingAfter = 0.7; // Comfortable reading spacing
      break;
  }

  // Add spacing before (for headings after content)
  if (spacingBefore > 0 && !isFirstSection) {
    pdfDoc.moveDown(spacingBefore);
  }

  // Set font (bold or regular)
  const fontName = isBold ? `${fontFamily}-Bold` : fontFamily;
  try {
    pdfDoc.font(fontName);
  } catch {
    // Fallback if bold variant doesn't exist
    pdfDoc.font(fontFamily);
  }

  // Calculate line height for better readability
  const lineHeight = fontSize * DEFAULT_LINE_HEIGHT;

  pdfDoc.fontSize(fontSize).fillColor(color);

  // Determine alignment
  let align: 'left' | 'center' | 'right' | 'justify' = 'left';
  if (para.alignment) {
    align = para.alignment;
  }

  // Text options with proper line height
  const textOptions: PDFKit.Mixins.TextOptions = {
    align,
    lineGap: (lineHeight - fontSize) * 0.6, // Comfortable line spacing
    paragraphGap: 0,
  };

  // Handle bullets with proper indentation
  if (para.bulletLevel && para.bulletLevel > 0) {
    const baseIndent = 18;
    const levelIndent = (para.bulletLevel - 1) * 18;
    const bulletChar = para.bulletLevel === 1 ? '•' : para.bulletLevel === 2 ? '○' : '–';

    // Position bullet
    const bulletX = 72 + levelIndent;
    const textX = bulletX + baseIndent;

    // Draw bullet character
    pdfDoc.text(bulletChar, bulletX, pdfDoc.y, { continued: false, width: baseIndent });

    // Move back up and draw text with proper indentation
    pdfDoc.moveUp();
    pdfDoc.text(para.text, textX, pdfDoc.y, {
      ...textOptions,
      width: pdfDoc.page.width - textX - 72, // Account for right margin
    });
  } else {
    pdfDoc.text(para.text, textOptions);
  }

  pdfDoc.moveDown(spacingAfter);
}

/**
 * Render a table with professional styling
 */
function renderTable(
  pdfDoc: PDFKit.PDFDocument,
  tableData: PdfTable,
  baseFontSize: number,
  primaryColor: string,
  fontFamily: string,
  margins: { left: number; right: number } = { left: 72, right: 72 }
): void {
  const tableLeft = margins.left;
  const tableWidth = pdfDoc.page.width - margins.left - margins.right;
  const cellPadding = 10; // More generous padding
  const headerPadding = 12;

  // Calculate column widths
  const numCols = tableData.headers?.length || (tableData.rows[0]?.length ?? 0);
  const colWidth = tableWidth / numCols;

  let currentY = pdfDoc.y;

  // Draw header row if present
  if (tableData.headers && tableData.headers.length > 0) {
    const headerBgColor = tableData.headerStyle?.backgroundColor || primaryColor;
    const headerTextColor = tableData.headerStyle?.textColor || '#ffffff';
    const headerHeight = 32; // Taller header for better visual hierarchy

    // Header background with slight rounded corners effect (fill first)
    pdfDoc.rect(tableLeft, currentY, tableWidth, headerHeight).fill(headerBgColor);

    // Header text - centered vertically
    pdfDoc.font(`${fontFamily}-Bold`).fontSize(baseFontSize).fillColor(headerTextColor);

    const headerTextY = currentY + (headerHeight - baseFontSize) / 2;
    tableData.headers.forEach((header, i) => {
      pdfDoc.text(header, tableLeft + i * colWidth + headerPadding, headerTextY, {
        width: colWidth - headerPadding * 2,
        align: 'left',
        lineBreak: false,
      });
    });

    currentY += headerHeight;
  }

  // Draw data rows
  pdfDoc.font(fontFamily).fontSize(baseFontSize - 0.5); // Slightly smaller for data
  const rowHeight = 28; // Comfortable row height

  for (let rowIndex = 0; rowIndex < tableData.rows.length; rowIndex++) {
    const row = tableData.rows[rowIndex];

    // Alternating row background - subtle
    if (rowIndex % 2 === 1) {
      pdfDoc.rect(tableLeft, currentY, tableWidth, rowHeight).fill('#f8f9fa');
    } else {
      pdfDoc.rect(tableLeft, currentY, tableWidth, rowHeight).fill('#ffffff');
    }

    // Draw subtle cell borders
    pdfDoc.strokeColor('#e0e0e0').lineWidth(0.5);

    // Bottom border for each row
    pdfDoc
      .moveTo(tableLeft, currentY + rowHeight)
      .lineTo(tableLeft + tableWidth, currentY + rowHeight)
      .stroke();

    // Vertical lines between columns
    for (let i = 1; i < numCols; i++) {
      pdfDoc
        .moveTo(tableLeft + i * colWidth, currentY)
        .lineTo(tableLeft + i * colWidth, currentY + rowHeight)
        .stroke();
    }

    // Cell text - vertically centered
    pdfDoc.fillColor('#333333');
    const textY = currentY + (rowHeight - (baseFontSize - 0.5)) / 2;
    row.forEach((cell, i) => {
      pdfDoc.text(String(cell), tableLeft + i * colWidth + cellPadding, textY, {
        width: colWidth - cellPadding * 2,
        align: 'left',
        lineBreak: false,
      });
    });

    currentY += rowHeight;
  }

  // Draw outer border around the entire table
  const tableStartY = currentY - tableData.rows.length * rowHeight - (tableData.headers ? 32 : 0);
  pdfDoc.strokeColor('#d0d0d0').lineWidth(0.75);
  pdfDoc.rect(tableLeft, tableStartY, tableWidth, currentY - tableStartY).stroke();

  pdfDoc.y = currentY;
}
