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

// Default styling
const DEFAULT_FONT = 'Calibri';

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
          children.push(createParagraph(section.content as DocumentParagraph, fontFamily, baseFontSize));
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
              top: wordDoc.format?.margins?.top ?? 1440, // 1 inch default
              right: wordDoc.format?.margins?.right ?? 1440,
              bottom: wordDoc.format?.margins?.bottom ?? 1440,
              left: wordDoc.format?.margins?.left ?? 1440,
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
 * Create a paragraph from document paragraph data
 */
function createParagraph(
  para: DocumentParagraph,
  fontFamily: string,
  baseFontSize: number
): Paragraph {
  // Determine heading level and font size
  let heading: (typeof HeadingLevel)[keyof typeof HeadingLevel] | undefined;
  let fontSize = baseFontSize;
  let isBold = para.bold || false;

  switch (para.style) {
    case 'title':
      fontSize = 48; // 24pt
      isBold = true;
      break;
    case 'subtitle':
      fontSize = 32; // 16pt
      break;
    case 'heading1':
      heading = HeadingLevel.HEADING_1;
      fontSize = 36; // 18pt
      isBold = true;
      break;
    case 'heading2':
      heading = HeadingLevel.HEADING_2;
      fontSize = 30; // 15pt
      isBold = true;
      break;
    case 'heading3':
      heading = HeadingLevel.HEADING_3;
      fontSize = 26; // 13pt
      isBold = true;
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

  // Create paragraph
  return new Paragraph({
    children: [
      new TextRun({
        text: para.text,
        bold: isBold,
        italics: para.italic,
        size: fontSize,
        font: fontFamily,
      }),
    ],
    heading,
    alignment,
    bullet: para.bulletLevel && para.bulletLevel > 0 ? { level: para.bulletLevel - 1 } : undefined,
    spacing: { after: 200 },
  });
}

/**
 * Create a table from document table data
 */
function createTable(
  tableData: DocumentTable,
  fontFamily: string,
  baseFontSize: number
): Table {
  const rows: TableRow[] = [];

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
                    }),
                  ],
                }),
              ],
              shading: tableData.headerStyle?.backgroundColor
                ? {
                    fill: tableData.headerStyle.backgroundColor.replace('#', ''),
                  }
                : { fill: '1e3a5f' },
              margins: {
                top: 100,
                bottom: 100,
                left: 100,
                right: 100,
              },
            })
        ),
        tableHeader: true,
      })
    );
  }

  // Add data rows
  for (const rowData of tableData.rows) {
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
                      size: baseFontSize,
                      font: fontFamily,
                    }),
                  ],
                }),
              ],
              margins: {
                top: 100,
                bottom: 100,
                left: 100,
                right: 100,
              },
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
