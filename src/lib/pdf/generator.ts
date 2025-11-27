/**
 * PDF GENERATOR UTILITY
 *
 * PURPOSE:
 * - Generate PDF exports of chat conversations
 * - Clean formatting with JCIL.AI branding
 * - Handles markdown content conversion
 *
 * USAGE:
 * - generateChatPDF(messages, title) → triggers download
 */

import { jsPDF } from 'jspdf';
import type { Message } from '@/app/chat/types';

interface PDFOptions {
  title?: string;
  includeTimestamps?: boolean;
  includeCitations?: boolean;
}

/**
 * Strip markdown formatting for cleaner PDF text
 */
function stripMarkdown(text: string): string {
  return text
    // Remove headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold/italic
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '[Code Block]')
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove blockquotes
    .replace(/^>\s+/gm, '')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Format timestamp for display
 */
function formatTimestamp(date: Date): string {
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
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
 * Generate and download PDF of chat conversation
 */
export async function generateChatPDF(
  messages: Message[],
  options: PDFOptions = {}
): Promise<void> {
  const {
    title = 'JCIL.AI Conversation',
    includeTimestamps = true,
    includeCitations = true,
  } = options;

  // Create PDF document (A4 size)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
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

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('JCIL.AI', margin, yPosition);

  yPosition += 8;

  // Title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(title, margin, yPosition);

  yPosition += 6;

  // Export date
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(`Exported: ${formatTimestamp(new Date())}`, margin, yPosition);

  yPosition += 10;

  // Divider line
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  // Filter out system messages
  const chatMessages = messages.filter((m) => m.role !== 'system');

  // Process each message
  for (const message of chatMessages) {
    const isUser = message.role === 'user';
    const cleanContent = stripMarkdown(message.content);

    // Role label
    checkPageBreak(20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    // Blue for user (59, 130, 246), green for AI (34, 197, 94)
    if (isUser) {
      doc.setTextColor(59, 130, 246);
    } else {
      doc.setTextColor(34, 197, 94);
    }
    doc.text(isUser ? 'You' : 'JCIL.AI', margin, yPosition);

    // Timestamp (if enabled)
    if (includeTimestamps && message.timestamp) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(8);
      const timestamp = formatTimestamp(message.timestamp);
      const timestampWidth = doc.getTextWidth(timestamp);
      doc.text(timestamp, pageWidth - margin - timestampWidth, yPosition);
    }

    yPosition += 6;

    // Message content
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);

    const wrappedLines = wrapText(doc, cleanContent, contentWidth);

    for (const line of wrappedLines) {
      checkPageBreak(6);
      doc.text(line, margin, yPosition);
      yPosition += 5;
    }

    // Image indicator
    if (message.imageUrl) {
      checkPageBreak(8);
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'italic');
      doc.text('[AI-generated image attached]', margin, yPosition);
      yPosition += 5;
    }

    // Citations (if enabled and present)
    if (includeCitations && message.citations && message.citations.length > 0) {
      checkPageBreak(10);
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'italic');
      doc.text(`Sources: ${message.citations.length} citation(s)`, margin, yPosition);
      yPosition += 5;
    }

    // Spacing between messages
    yPosition += 8;
  }

  // Footer on last page
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.setFont('helvetica', 'normal');
  const footerText = 'Generated by JCIL.AI - Christian Conservative AI Assistant';
  const footerWidth = doc.getTextWidth(footerText);
  doc.text(footerText, (pageWidth - footerWidth) / 2, pageHeight - 10);

  // Generate filename
  const dateStr = new Date().toISOString().split('T')[0];
  const safeTitle = title.replace(/[^a-z0-9]/gi, '-').substring(0, 30);
  const filename = `jcil-ai-${safeTitle}-${dateStr}.pdf`;

  // Download the PDF
  doc.save(filename);
}

/**
 * Generate PDF of a single message (for individual exports)
 */
export async function generateMessagePDF(
  message: Message,
  title?: string
): Promise<void> {
  return generateChatPDF([message], {
    title: title || 'JCIL.AI Response',
    includeTimestamps: true,
    includeCitations: true,
  });
}
