/**
 * PDF GENERATOR UTILITY
 *
 * PURPOSE:
 * - Generate clean PDF exports of AI responses
 * - Professional document formatting (resumes, cover letters, etc.)
 * - No branding or chat metadata - just the content
 */

import { jsPDF } from 'jspdf';
import type { Message } from '@/app/chat/types';

/**
 * Remove AI helper text that shouldn't be in the document
 * (instructions, follow-up questions, tips, etc.)
 */
function removeHelperText(text: string): string {
  // Common patterns that indicate the start of helper/instructional text
  const cutoffPatterns = [
    /\n+This is a customizable template[\s\S]*/i,
    /\n+To create a PDF[\s\S]*/i,
    /\n+To save this[\s\S]*/i,
    /\n+Related:\s*\n[\s\S]*/i,
    /\n+If you (?:provide|need|want|have)[\s\S]*$/i,
    /\n+Let me know if[\s\S]*/i,
    /\n+Feel free to[\s\S]*/i,
    /\n+I hope this helps[\s\S]*/i,
    /\n+Is there anything else[\s\S]*/i,
    /\n+Would you like me to[\s\S]*/i,
    /\n+Here are some (?:tips|suggestions)[\s\S]*/i,
    /\n+Tips?:\s*\n[\s\S]*/i,
    /\n+Note:\s*\n[\s\S]*/i,
    /\n+\*\*Note:\*\*[\s\S]*/i,
  ];

  let result = text;
  for (const pattern of cutoffPatterns) {
    result = result.replace(pattern, '');
  }

  return result.trim();
}

/**
 * Strip markdown formatting for cleaner PDF text
 * Preserves structure for professional documents
 */
function stripMarkdown(text: string): string {
  // First remove helper text
  let cleaned = removeHelperText(text);

  return cleaned
    // Remove headers but keep the text
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic markers but keep text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove inline code backticks
    .replace(/`([^`]+)`/g, '$1')
    // Handle code blocks - keep content, remove markers
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '$1')
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove blockquote markers
    .replace(/^>\s+/gm, '')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}$/gm, '')
    // Clean bullet points to simple dashes
    .replace(/^[\s]*[-*+]\s+/gm, '• ')
    // Clean numbered lists
    .replace(/^[\s]*\d+\.\s+/gm, (match) => match.trim() + ' ')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Wrap text to fit within page width
 */
function wrapText(doc: jsPDF, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      lines.push('');
      continue;
    }

    const words = paragraph.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const textWidth = doc.getTextWidth(testLine);

      if (textWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

/**
 * Extract a meaningful title from the content
 * Looks for common document patterns
 */
function extractTitle(content: string): string {
  // Look for common document title patterns
  const patterns = [
    /^#\s+(.+)$/m,                           // Markdown header
    /^(Cover Letter|Resume|CV|Business Plan|Proposal|Report)/im,
    /^(Dear|To Whom)/im,                     // Letter opening
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1].substring(0, 40);
    }
  }

  // Default: use first few words
  const firstLine = content.split('\n')[0].substring(0, 40);
  return firstLine || 'Document';
}

/**
 * Generate and download a clean PDF of AI content
 * No branding, no timestamps - just the document
 */
export async function generateMessagePDF(message: Message): Promise<void> {
  const content = stripMarkdown(message.content);

  // Create PDF document (A4 size)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 25; // Professional document margins
  const contentWidth = pageWidth - margin * 2;
  let yPosition = margin;

  // Helper to add new page if needed
  const checkPageBreak = (neededHeight: number) => {
    if (yPosition + neededHeight > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  // Set up professional document styling
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);

  // Process content
  const wrappedLines = wrapText(doc, content, contentWidth);

  for (const line of wrappedLines) {
    checkPageBreak(6);

    // Detect if this might be a header (all caps or short line followed by blank)
    const isHeader = line.length < 50 && line === line.toUpperCase() && line.trim().length > 0;

    if (isHeader) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
    }

    doc.text(line, margin, yPosition);
    yPosition += line === '' ? 4 : 5.5; // Slightly more space for empty lines
  }

  // Generate filename from content
  const title = extractTitle(message.content);
  const dateStr = new Date().toISOString().split('T')[0];
  const safeTitle = title.replace(/[^a-z0-9]/gi, '-').toLowerCase().substring(0, 30);
  const filename = `${safeTitle}-${dateStr}.pdf`;

  // Download the PDF
  doc.save(filename);
}
