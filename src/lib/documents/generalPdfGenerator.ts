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

// Default styling
const DEFAULT_PRIMARY_COLOR = '#1e3a5f'; // Navy blue
const DEFAULT_FONT_SIZE = 12;
const DEFAULT_MARGINS = { top: 50, bottom: 50, left: 50, right: 50 };

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
          top: margins.top || 50,
          bottom: margins.bottom || 50,
          left: margins.left || 50,
          right: margins.right || 50,
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

      // Process each section
      for (const section of doc.sections) {
        renderSection(pdfDoc, section, baseFontSize, primaryColor, fontFamily);
      }

      // Add footer if specified
      if (doc.format?.footerText) {
        const pageHeight = pdfDoc.page.height;
        const footerY = pageHeight - 40;
        pdfDoc
          .fontSize(9)
          .fillColor('#666666')
          .text(doc.format.footerText, margins.left || 50, footerY, {
            align: 'center',
            width: pdfDoc.page.width - (margins.left || 50) - (margins.right || 50),
          });
      }

      pdfDoc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Render a document section
 */
function renderSection(
  pdfDoc: PDFKit.PDFDocument,
  section: PdfSection,
  baseFontSize: number,
  primaryColor: string,
  fontFamily: string
): void {
  switch (section.type) {
    case 'paragraph':
      if (section.content) {
        renderParagraph(
          pdfDoc,
          section.content as PdfParagraph,
          baseFontSize,
          primaryColor,
          fontFamily
        );
      }
      break;

    case 'table':
      if (section.content) {
        renderTable(pdfDoc, section.content as PdfTable, baseFontSize, primaryColor, fontFamily);
      }
      break;

    case 'pageBreak':
      pdfDoc.addPage();
      break;

    case 'horizontalRule':
      const currentY = pdfDoc.y;
      pdfDoc
        .moveTo(50, currentY)
        .lineTo(pdfDoc.page.width - 50, currentY)
        .strokeColor('#cccccc')
        .lineWidth(1)
        .stroke();
      pdfDoc.moveDown(1);
      break;

    case 'spacer':
      pdfDoc.moveDown(1);
      break;
  }
}

/**
 * Render a paragraph
 */
function renderParagraph(
  pdfDoc: PDFKit.PDFDocument,
  para: PdfParagraph,
  baseFontSize: number,
  primaryColor: string,
  fontFamily: string
): void {
  let fontSize = baseFontSize;
  let isBold = para.bold || false;
  let color = para.color || '#333333';

  // Determine font size and style based on style
  switch (para.style) {
    case 'title':
      fontSize = baseFontSize * 2; // 24pt for 12pt base
      isBold = true;
      color = primaryColor;
      break;
    case 'subtitle':
      fontSize = baseFontSize * 1.5; // 18pt for 12pt base
      color = '#666666';
      break;
    case 'heading1':
      fontSize = baseFontSize * 1.5; // 18pt for 12pt base
      isBold = true;
      color = primaryColor;
      break;
    case 'heading2':
      fontSize = baseFontSize * 1.25; // 15pt for 12pt base
      isBold = true;
      color = primaryColor;
      break;
    case 'heading3':
      fontSize = baseFontSize * 1.1; // 13pt for 12pt base
      isBold = true;
      break;
  }

  // Set font (bold or regular)
  const fontName = isBold ? `${fontFamily}-Bold` : fontFamily;
  try {
    pdfDoc.font(fontName);
  } catch {
    // Fallback if bold variant doesn't exist
    pdfDoc.font(fontFamily);
  }

  pdfDoc.fontSize(fontSize).fillColor(color);

  // Determine alignment
  let align: 'left' | 'center' | 'right' | 'justify' = 'left';
  if (para.alignment) {
    align = para.alignment;
  }

  // Handle bullets
  if (para.bulletLevel && para.bulletLevel > 0) {
    const indent = (para.bulletLevel - 1) * 20;
    const bulletChar = para.bulletLevel === 1 ? '•' : para.bulletLevel === 2 ? '◦' : '▪';
    pdfDoc.text(`${bulletChar} ${para.text}`, 50 + indent, pdfDoc.y, {
      align,
      indent: 15,
    });
  } else {
    pdfDoc.text(para.text, { align });
  }

  pdfDoc.moveDown(0.5);
}

/**
 * Render a table
 */
function renderTable(
  pdfDoc: PDFKit.PDFDocument,
  tableData: PdfTable,
  baseFontSize: number,
  primaryColor: string,
  fontFamily: string
): void {
  const tableLeft = 50;
  const tableWidth = pdfDoc.page.width - 100;
  const cellPadding = 8;

  // Calculate column widths
  const numCols = tableData.headers?.length || (tableData.rows[0]?.length ?? 0);
  const colWidth = tableWidth / numCols;

  let currentY = pdfDoc.y;

  // Draw header row if present
  if (tableData.headers && tableData.headers.length > 0) {
    const headerBgColor = tableData.headerStyle?.backgroundColor || primaryColor;
    const headerTextColor = tableData.headerStyle?.textColor || '#ffffff';

    // Header background
    pdfDoc.rect(tableLeft, currentY, tableWidth, 25).fill(headerBgColor);

    // Header text
    pdfDoc.font(`${fontFamily}-Bold`).fontSize(baseFontSize).fillColor(headerTextColor);

    tableData.headers.forEach((header, i) => {
      pdfDoc.text(header, tableLeft + i * colWidth + cellPadding, currentY + cellPadding, {
        width: colWidth - cellPadding * 2,
        align: 'left',
      });
    });

    currentY += 25;
  }

  // Draw data rows
  pdfDoc.font(fontFamily).fontSize(baseFontSize).fillColor('#333333');

  for (let rowIndex = 0; rowIndex < tableData.rows.length; rowIndex++) {
    const row = tableData.rows[rowIndex];
    const rowHeight = 22;

    // Alternating row background
    if (rowIndex % 2 === 1) {
      pdfDoc.rect(tableLeft, currentY, tableWidth, rowHeight).fill('#f5f5f5');
    }

    // Row border
    pdfDoc.rect(tableLeft, currentY, tableWidth, rowHeight).stroke('#cccccc');

    // Cell text
    pdfDoc.fillColor('#333333');
    row.forEach((cell, i) => {
      pdfDoc.text(cell, tableLeft + i * colWidth + cellPadding, currentY + 6, {
        width: colWidth - cellPadding * 2,
        align: 'left',
      });
    });

    currentY += rowHeight;
  }

  pdfDoc.y = currentY;
  pdfDoc.moveDown(1);
}
