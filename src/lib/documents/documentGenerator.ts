/**
 * WORD DOCUMENT GENERATOR
 * Creates Word documents from JSON document data
 *
 * Uses docx library to generate .docx files
 * Supports paragraphs, headings, tables, and formatting
 */

import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  Packer,
  PageBreak,
  Header,
  Footer,
} from 'docx';
import type { WordDocument, DocumentSection, DocumentParagraph, DocumentTable } from './types';

// Default styling - Professional document standards
const DEFAULT_FONT = 'Calibri';
const DEFAULT_LINE_SPACING = 276; // 1.15 line spacing (240 = single, 276 = 1.15)
const DEFAULT_PARAGRAPH_SPACING = 160; // 8pt after paragraphs (in twentieths of a point)

/**
 * Generate a Word document from document JSON
 */
export async function generateWordDocx(wordDoc: WordDocument): Promise<Buffer> {
  const fontFamily = wordDoc.format?.fontFamily || DEFAULT_FONT;
  const baseFontSize = (wordDoc.format?.fontSize || 11) * 2; // Convert pt to half-pt

  const children: (Paragraph | Table)[] = [];

  // Process each section
  for (const section of wordDoc.sections) {
    switch (section.type) {
      case 'paragraph':
        if (section.content) {
          children.push(
            createParagraph(section.content as DocumentParagraph, fontFamily, baseFontSize)
          );
        }
        break;

      case 'table':
        if (section.content) {
          children.push(createTable(section.content as DocumentTable, fontFamily, baseFontSize));
        }
        break;

      case 'pageBreak':
        children.push(
          new Paragraph({
            children: [new PageBreak()],
          })
        );
        break;

      case 'horizontalRule':
        children.push(
          new Paragraph({
            border: {
              bottom: {
                color: 'cccccc',
                space: 1,
                style: BorderStyle.SINGLE,
                size: 6,
              },
            },
            spacing: { after: 200 },
          })
        );
        break;
    }
  }

  // Create document with optional header/footer
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              // In docx, margins are in twentieths of a point (twips)
              // 1 inch = 1440 twips, 0.75 inch = 1080 twips
              top: wordDoc.format?.margins?.top ?? 1440, // 1 inch top
              right: wordDoc.format?.margins?.right ?? 1080, // 0.75 inch right (modern standard)
              bottom: wordDoc.format?.margins?.bottom ?? 1440, // 1 inch bottom
              left: wordDoc.format?.margins?.left ?? 1080, // 0.75 inch left (modern standard)
            },
          },
        },
        headers: wordDoc.format?.headerText
          ? {
              default: new Header({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: wordDoc.format.headerText,
                        size: baseFontSize - 4,
                        font: fontFamily,
                        color: '666666',
                      }),
                    ],
                    alignment: AlignmentType.RIGHT,
                  }),
                ],
              }),
            }
          : undefined,
        footers: wordDoc.format?.footerText
          ? {
              default: new Footer({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: wordDoc.format.footerText,
                        size: baseFontSize - 4,
                        font: fontFamily,
                        color: '666666',
                      }),
                    ],
                    alignment: AlignmentType.CENTER,
                  }),
                ],
              }),
            }
          : undefined,
        children,
      },
    ],
  });

  // Generate buffer
  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

/**
 * Create a paragraph from document paragraph data with professional typography
 */
function createParagraph(
  para: DocumentParagraph,
  fontFamily: string,
  baseFontSize: number
): Paragraph {
  // Determine heading level, font size, and spacing
  let heading: (typeof HeadingLevel)[keyof typeof HeadingLevel] | undefined;
  let fontSize = baseFontSize;
  let isBold = para.bold || false;
  let spacingBefore = 0;
  let spacingAfter = DEFAULT_PARAGRAPH_SPACING;
  let color: string | undefined;

  switch (para.style) {
    case 'title':
      fontSize = 52; // 26pt - prominent but professional
      isBold = true;
      color = '1e3a5f'; // Navy blue
      spacingBefore = 0;
      spacingAfter = 80; // Tight spacing to subtitle
      break;
    case 'subtitle':
      fontSize = 28; // 14pt
      color = '666666';
      spacingBefore = 0;
      spacingAfter = 320; // More space after subtitle before content
      break;
    case 'heading1':
      heading = HeadingLevel.HEADING_1;
      fontSize = 36; // 18pt
      isBold = true;
      color = '1e3a5f';
      spacingBefore = 400; // Good separation from previous content
      spacingAfter = 160;
      break;
    case 'heading2':
      heading = HeadingLevel.HEADING_2;
      fontSize = 30; // 15pt
      isBold = true;
      color = '1e3a5f';
      spacingBefore = 320;
      spacingAfter = 120;
      break;
    case 'heading3':
      heading = HeadingLevel.HEADING_3;
      fontSize = 26; // 13pt
      isBold = true;
      color = '333333';
      spacingBefore = 240;
      spacingAfter = 100;
      break;
    default:
      // Normal body text
      spacingBefore = 0;
      spacingAfter = DEFAULT_PARAGRAPH_SPACING;
      break;
  }

  // Determine alignment
  let alignment: (typeof AlignmentType)[keyof typeof AlignmentType] | undefined;
  switch (para.alignment) {
    case 'center':
      alignment = AlignmentType.CENTER;
      break;
    case 'right':
      alignment = AlignmentType.RIGHT;
      break;
    case 'justify':
      alignment = AlignmentType.JUSTIFIED;
      break;
    default:
      alignment = AlignmentType.LEFT;
  }

  // Create paragraph with professional spacing
  return new Paragraph({
    children: [
      new TextRun({
        text: para.text,
        bold: isBold,
        italics: para.italic,
        size: fontSize,
        font: fontFamily,
        color: color,
      }),
    ],
    heading,
    alignment,
    bullet: para.bulletLevel && para.bulletLevel > 0 ? { level: para.bulletLevel - 1 } : undefined,
    spacing: {
      before: spacingBefore,
      after: spacingAfter,
      line: DEFAULT_LINE_SPACING,
    },
  });
}

/**
 * Create a table from document table data with professional styling
 */
function createTable(tableData: DocumentTable, fontFamily: string, baseFontSize: number): Table {
  const rows: TableRow[] = [];
  const cellMargins = {
    top: 120, // More generous vertical padding
    bottom: 120,
    left: 140, // Comfortable horizontal padding
    right: 140,
  };

  // Calculate column count and width
  const columnCount = tableData.headers?.length || tableData.rows[0]?.length || 1;
  // Use percentage-based widths - distribute evenly across columns
  const columnWidthPercent = Math.floor(100 / columnCount);

  // Add header row if present
  if (tableData.headers && tableData.headers.length > 0) {
    rows.push(
      new TableRow({
        children: tableData.headers.map(
          (header) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: header,
                      bold: tableData.headerStyle?.bold !== false,
                      size: baseFontSize,
                      font: fontFamily,
                      color: 'ffffff', // White text on header
                    }),
                  ],
                  spacing: { before: 0, after: 0 },
                }),
              ],
              width: {
                size: columnWidthPercent,
                type: WidthType.PERCENTAGE,
              },
              shading: tableData.headerStyle?.backgroundColor
                ? {
                    fill: tableData.headerStyle.backgroundColor.replace('#', ''),
                  }
                : { fill: '1e3a5f' }, // Navy blue default
              margins: cellMargins,
              verticalAlign: 'center' as const,
            })
        ),
        tableHeader: true,
      })
    );
  }

  // Add data rows with alternating colors
  for (let rowIndex = 0; rowIndex < tableData.rows.length; rowIndex++) {
    const rowData = tableData.rows[rowIndex];
    const isAlternate = rowIndex % 2 === 1;

    rows.push(
      new TableRow({
        children: rowData.map(
          (cellText) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: cellText,
                      size: baseFontSize - 2, // Slightly smaller for data
                      font: fontFamily,
                      color: '333333',
                    }),
                  ],
                  spacing: { before: 0, after: 0 },
                }),
              ],
              width: {
                size: columnWidthPercent,
                type: WidthType.PERCENTAGE,
              },
              shading: isAlternate ? { fill: 'f8f9fa' } : { fill: 'ffffff' },
              margins: cellMargins,
              verticalAlign: 'center' as const,
            })
        ),
      })
    );
  }

  return new Table({
    rows,
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
  });
}

/**
 * Create a simple letter document
 * Helper for common letter use case
 */
export function createLetterTemplate(
  senderName: string,
  senderAddress: string[],
  recipientName: string,
  recipientAddress: string[],
  date: string,
  subject: string,
  bodyParagraphs: string[],
  closing: string = 'Sincerely'
): WordDocument {
  const sections: DocumentSection[] = [];

  // Sender address
  for (const line of senderAddress) {
    sections.push({
      type: 'paragraph',
      content: { text: line, alignment: 'left' },
    });
  }

  // Date
  sections.push({
    type: 'paragraph',
    content: { text: date, alignment: 'left' },
  });

  // Spacing
  sections.push({
    type: 'paragraph',
    content: { text: '' },
  });

  // Recipient address
  sections.push({
    type: 'paragraph',
    content: { text: recipientName, alignment: 'left' },
  });
  for (const line of recipientAddress) {
    sections.push({
      type: 'paragraph',
      content: { text: line, alignment: 'left' },
    });
  }

  // Spacing
  sections.push({
    type: 'paragraph',
    content: { text: '' },
  });

  // Subject
  sections.push({
    type: 'paragraph',
    content: { text: `Re: ${subject}`, bold: true },
  });

  // Spacing
  sections.push({
    type: 'paragraph',
    content: { text: '' },
  });

  // Body paragraphs
  for (const para of bodyParagraphs) {
    sections.push({
      type: 'paragraph',
      content: { text: para, alignment: 'justify' },
    });
  }

  // Closing
  sections.push({
    type: 'paragraph',
    content: { text: '' },
  });
  sections.push({
    type: 'paragraph',
    content: { text: closing + ',' },
  });
  sections.push({
    type: 'paragraph',
    content: { text: '' },
  });
  sections.push({
    type: 'paragraph',
    content: { text: '' },
  });
  sections.push({
    type: 'paragraph',
    content: { text: senderName },
  });

  return {
    type: 'document',
    title: `Letter - ${subject}`,
    sections,
    format: {
      fontFamily: 'Times New Roman',
      fontSize: 12,
    },
  };
}
