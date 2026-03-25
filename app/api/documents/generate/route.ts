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
 *
 * Extracted modules:
 * - invoicePdf.ts       — Invoice parsing and PDF rendering
 * - businessPlanPdf.ts  — Business plan parsing and PDF rendering
 * - pdfHelpers.ts       — Auth, markdown parsing, text utilities
 */

import { NextRequest } from 'next/server';
import { successResponse, errors } from '@/lib/api/utils';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { generateSpreadsheetXlsx } from '@/lib/documents/spreadsheetGenerator';
import { logger } from '@/lib/logger';
import { parseInvoiceContent, generateInvoicePDF } from './invoicePdf';
import type { InvoiceData } from './invoicePdf';
import { parseBusinessPlanContent, generateBusinessPlanPDF } from './businessPlanPdf';
import type { BusinessPlanData } from './businessPlanPdf';
import {
  getAuthenticatedUserId,
  getSupabaseAdmin,
  parseMarkdown,
  cleanMarkdown,
  parseMarkdownToSpreadsheet,
} from './pdfHelpers';
import { createDownloadToken } from '@/lib/security/download-token';
import { documentFromContentSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const maxDuration = 90;

const log = logger('DocumentsGenerate');

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();

    // Validate request body with Zod
    const parseResult = documentFromContentSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0];
      // Return 413 for content size limit exceeded
      if (firstError?.message === 'Content exceeds 1MB limit') {
        return errors.payloadTooLarge(`${(1024 * 1024) / 1024}KB`);
      }
      return errors.badRequest(firstError?.message ?? 'Invalid request body');
    }

    const { content, title, format: _format } = parseResult.data;

    // Get authenticated user ID from session (secure - not from request body)
    const userId = await getAuthenticatedUserId();

    // Get Supabase client for storage
    const supabase = getSupabaseAdmin();

    // === XLSX: Excel spreadsheet generation ===
    if (parseResult.data.format === 'xlsx') {
      log.info('Generating Excel spreadsheet', { title });

      try {
        // Parse markdown tables into spreadsheet format
        const spreadsheetData = parseMarkdownToSpreadsheet(content, title);
        const xlsxBuffer = await generateSpreadsheetXlsx(spreadsheetData);

        if (!xlsxBuffer || xlsxBuffer.length === 0) {
          log.error('Excel generation produced empty buffer', { title });
          return errors.serverError(
            'Generated Excel file was empty. Please try again with different content.'
          );
        }

        // Generate unique filename
        const timestamp = Date.now();
        const sanitizedTitle = title
          .replace(/[^a-zA-Z0-9\s-]/g, '')
          .replace(/\s+/g, '_')
          .slice(0, 50);
        const filename = `${sanitizedTitle}_${timestamp}.xlsx`;

        // If supabase not available, return data URL directly
        if (!supabase) {
          const base64 = xlsxBuffer.toString('base64');
          const dataUrl = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
          return successResponse({
            success: true,
            dataUrl,
            filename,
            format: 'xlsx',
            title,
            storage: 'dataurl',
          });
        }

        // Upload to Supabase Storage
        const storagePath = userId
          ? `documents/${userId}/${filename}`
          : `documents/anonymous/${filename}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(storagePath, xlsxBuffer, {
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            upsert: true,
          });

        if (uploadError) {
          log.error('Excel upload error', { error: uploadError ?? 'Unknown error' });
          // Fallback to data URL
          const base64 = xlsxBuffer.toString('base64');
          const dataUrl = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
          return successResponse({
            success: true,
            dataUrl,
            filename,
            format: 'xlsx',
            title,
            storage: 'dataurl',
          });
        }

        // Get signed URL
        const { data: signedData, error: signedError } = await supabase.storage
          .from('documents')
          .createSignedUrl(storagePath, 3600);

        if (signedError || !signedData?.signedUrl) {
          log.error('Excel signed URL error', { error: signedError ?? 'Unknown error' });
          const base64 = xlsxBuffer.toString('base64');
          const dataUrl = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
          return successResponse({
            success: true,
            dataUrl,
            filename,
            format: 'xlsx',
            title,
            storage: 'dataurl',
          });
        }

        log.info('Excel generated and uploaded successfully');
        return successResponse({
          success: true,
          downloadUrl: signedData.signedUrl,
          filename,
          format: 'xlsx',
          title,
          storage: 'supabase',
        });
      } catch (xlsxError) {
        log.error('Excel generation error', xlsxError instanceof Error ? xlsxError : { xlsxError });
        return errors.serverError('Failed to generate Excel file');
      }
    }

    // Detect document type for special formatting
    const lowerTitle = title.toLowerCase();
    const lowerContent = content.toLowerCase();

    const isResume =
      lowerTitle.includes('resume') ||
      lowerTitle.includes('résumé') ||
      lowerTitle.includes('cv') ||
      lowerTitle.includes('curriculum vitae') ||
      lowerContent.includes('work experience') ||
      lowerContent.includes('professional experience') ||
      lowerContent.includes('employment history') ||
      lowerContent.includes('career summary') ||
      lowerContent.includes('professional summary') ||
      (lowerContent.includes('education') && lowerContent.includes('skills')) ||
      (lowerContent.includes('certifications') && lowerContent.includes('experience'));

    const isInvoice =
      lowerTitle.includes('invoice') ||
      lowerTitle.includes('receipt') ||
      lowerTitle.includes('bill') ||
      lowerContent.includes('invoice #') ||
      lowerContent.includes('invoice:') ||
      lowerContent.includes('bill to') ||
      lowerContent.includes('total due') ||
      lowerContent.includes('amount due');

    const isBusinessPlan =
      lowerTitle.includes('business plan') ||
      lowerTitle.includes('business proposal') ||
      lowerContent.includes('executive summary') ||
      lowerContent.includes('market analysis') ||
      lowerContent.includes('financial projections') ||
      (lowerContent.includes('business') && lowerContent.includes('strategy'));

    // Log detected document type for debugging
    log.info('Document type detection', {
      title,
      isResume,
      isInvoice,
      isBusinessPlan,
      effectiveType: isInvoice
        ? 'invoice'
        : isResume
          ? 'resume'
          : isBusinessPlan
            ? 'business_plan'
            : 'generic',
    });

    // Create PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // === INVOICE: Use dedicated professional template ===
    if (isInvoice) {
      log.info('Generating professional invoice PDF');

      let invoiceData: InvoiceData;
      try {
        invoiceData = parseInvoiceContent(content);
        log.info('Invoice parsed', {
          companyName: invoiceData.companyName,
          invoiceNumber: invoiceData.invoiceNumber,
          itemCount: invoiceData.items.length,
        });
      } catch (parseError) {
        log.error('Invoice parse error', parseError instanceof Error ? parseError : { parseError });
        return errors.serverError('Failed to parse invoice content');
      }

      try {
        generateInvoicePDF(doc, invoiceData);
        log.info('Invoice PDF generated successfully', {
          hasPlaceholders: invoiceData.companyName === '[Your Company Name]',
        });
      } catch (pdfError) {
        log.error(
          'Invoice PDF generation error',
          pdfError instanceof Error ? pdfError : { pdfError }
        );
        return errors.serverError('Failed to generate invoice PDF');
      }

      // Skip to file upload (bypass markdown rendering)
      // Generate filename
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const pdfFilename = `${safeTitle}_${timestamp}_${randomStr}.pdf`;

      // Generate PDF buffer
      const pdfBuffer = doc.output('arraybuffer');

      // If Supabase is available and userId provided, upload for secure download
      if (supabase && userId) {
        try {
          await supabase.storage.createBucket('documents', {
            public: false,
            fileSizeLimit: 10 * 1024 * 1024,
          });
        } catch {
          // Bucket might already exist
        }

        const pdfPath = `${userId}/${pdfFilename}`;
        const { error: pdfUploadError } = await supabase.storage
          .from('documents')
          .upload(pdfPath, pdfBuffer, {
            contentType: 'application/pdf',
            cacheControl: '3600',
            upsert: false,
          });

        if (pdfUploadError) {
          log.error('Invoice PDF upload error', { error: pdfUploadError ?? 'Unknown error' });
          const pdfBase64 = doc.output('datauristring');
          return successResponse({
            success: true,
            format: 'pdf',
            title,
            dataUrl: pdfBase64,
            filename: pdfFilename,
            storage: 'fallback',
          });
        }

        log.info('Invoice PDF uploaded', { pdfPath });

        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'https://jcil.ai';

        const pdfToken = createDownloadToken(userId, pdfFilename, 'pdf');
        const pdfProxyUrl = `${baseUrl}/api/documents/download?token=${pdfToken}`;

        return successResponse({
          success: true,
          format: 'pdf',
          title,
          filename: pdfFilename,
          downloadUrl: pdfProxyUrl,
          expiresIn: '1 hour',
          storage: 'supabase',
        });
      }

      // Fallback: Return data URL
      const pdfBase64 = doc.output('datauristring');
      return successResponse({
        success: true,
        format: 'pdf',
        title,
        dataUrl: pdfBase64,
        filename: pdfFilename,
        storage: 'local',
      });
    }

    // === BUSINESS PLAN: Use dedicated professional template ===
    // IMPORTANT: Only if NOT a resume (resumes often contain business/strategy keywords)
    if (isBusinessPlan && !isResume) {
      log.info('Generating professional business plan PDF');

      let businessPlanData: BusinessPlanData;
      try {
        businessPlanData = parseBusinessPlanContent(content);
        log.info('Business plan parsed', {
          companyName: businessPlanData.companyName,
          hasSummary: !!businessPlanData.executiveSummary.missionStatement,
          hasDescription: !!businessPlanData.companyDescription.overview,
        });
      } catch (parseError) {
        log.error(
          'Business plan parse error',
          parseError instanceof Error ? parseError : { parseError }
        );
        return errors.serverError('Failed to parse business plan content');
      }

      try {
        generateBusinessPlanPDF(doc, businessPlanData);
        log.info('Business plan PDF generated successfully');
      } catch (pdfError) {
        log.error(
          'Business plan PDF generation error',
          pdfError instanceof Error ? pdfError : { pdfError }
        );
        return errors.serverError('Failed to generate business plan PDF');
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
        try {
          await supabase.storage.createBucket('documents', {
            public: false,
            fileSizeLimit: 10 * 1024 * 1024,
          });
        } catch {
          // Bucket might already exist
        }

        const pdfPath = `${userId}/${pdfFilename}`;
        const { error: pdfUploadError } = await supabase.storage
          .from('documents')
          .upload(pdfPath, pdfBuffer, {
            contentType: 'application/pdf',
            cacheControl: '3600',
            upsert: false,
          });

        if (pdfUploadError) {
          log.error('Business plan PDF upload error', { error: pdfUploadError ?? 'Unknown error' });
          const pdfBase64 = doc.output('datauristring');
          return successResponse({
            success: true,
            format: 'pdf',
            title,
            dataUrl: pdfBase64,
            filename: pdfFilename,
            storage: 'fallback',
          });
        }

        log.info('Business plan PDF uploaded', { pdfPath });

        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'https://jcil.ai';

        const pdfToken = createDownloadToken(userId, pdfFilename, 'pdf');
        const pdfProxyUrl = `${baseUrl}/api/documents/download?token=${pdfToken}`;

        return successResponse({
          success: true,
          format: 'pdf',
          title,
          filename: pdfFilename,
          downloadUrl: pdfProxyUrl,
          expiresIn: '1 hour',
          storage: 'supabase',
        });
      }

      // Fallback: Return data URL
      const pdfBase64 = doc.output('datauristring');
      return successResponse({
        success: true,
        format: 'pdf',
        title,
        dataUrl: pdfBase64,
        filename: pdfFilename,
        storage: 'local',
      });
    }

    // Page settings - tighter margins for resumes, professional for business docs
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = isResume ? 15 : isBusinessPlan ? 20 : 20;
    const contentWidth = pageWidth - margin * 2;
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
        const isGenericTitle = genericTitlePatterns.some((p) => p.test(firstText));

        if (isGenericTitle) {
          log.info('Filtering out generic resume title', { title: elements[0].text });
          elements = elements.slice(1); // Remove the generic title
        } else {
          break; // Found the real name, stop filtering
        }
      }

      // Also filter if the first H1 doesn't look like a name (too long or has keywords)
      if (elements.length > 0 && elements[0].type === 'h1') {
        const firstH1 = elements[0].text.toLowerCase();
        if (
          firstH1.includes('template') ||
          firstH1.includes('ats') ||
          firstH1.includes('friendly') ||
          firstH1.length > 50
        ) {
          log.info('Filtering out likely template title', { title: elements[0].text });
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
            doc.text(cleanMarkdown(element.text).text.toUpperCase(), pageWidth - margin, y, {
              align: 'right',
            });
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
            // GENERIC DOCUMENTS: Professional centered title with decorative styling
            y += 5; // Extra space before title
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 58, 138); // Professional dark blue
            const h1Text = cleanMarkdown(element.text).text;
            const h1Wrapped = doc.splitTextToSize(h1Text, contentWidth);
            const h1Height = h1Wrapped.length * 8;
            checkPageBreak(h1Height + 15);
            // Center the title
            doc.text(h1Wrapped, pageWidth / 2, y, { align: 'center' });
            y += h1Height + 5;
            // Professional underline
            doc.setDrawColor(30, 58, 138);
            doc.setLineWidth(0.8);
            const lineWidth = Math.min(doc.getTextWidth(h1Text), contentWidth * 0.6);
            doc.line(pageWidth / 2 - lineWidth / 2, y, pageWidth / 2 + lineWidth / 2, y);
            y += 10;
          }
          isFirstElement = false;
          break;

        case 'h2':
          checkPageBreak(15);
          if (isResume) {
            // RESUME: Section headers - bold, with subtle line
            // Add extra space before new sections (except first)
            if (!isFirstElement) {
              y += 6; // Space before section header
            }
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            const resumeH2Text = cleanMarkdown(element.text).text.toUpperCase();
            const resumeH2Wrapped = doc.splitTextToSize(resumeH2Text, contentWidth);
            doc.text(resumeH2Wrapped, margin, y);
            y += resumeH2Wrapped.length * 4.5;
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.4);
            doc.line(margin, y, pageWidth - margin, y);
            y += 4;
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
            // GENERIC DOCUMENTS: Professional section headers with accent styling
            y += 8; // Extra space before section
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            const h2Text = cleanMarkdown(element.text).text;
            const h2Wrapped = doc.splitTextToSize(h2Text, contentWidth - 8);
            const h2Height = h2Wrapped.length * 5.5 + 6;
            checkPageBreak(h2Height + 5);
            // Light background with left accent
            doc.setFillColor(245, 247, 250);
            doc.rect(margin, y - 4, contentWidth, h2Height, 'F');
            doc.setFillColor(30, 58, 138);
            doc.rect(margin, y - 4, 3, h2Height, 'F'); // Left accent bar
            doc.setTextColor(30, 58, 138);
            doc.text(h2Wrapped, margin + 8, y);
            y += h2Height + 5;
          }
          resumeHeaderDone = true;
          break;

        case 'h3':
          checkPageBreak(12);
          if (isResume) {
            // RESUME: Job title / subsection - bold
            y += 3; // Small space before job title/subsection
            doc.setFontSize(10.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            const resumeH3Text = cleanMarkdown(element.text).text;
            const resumeH3Wrapped = doc.splitTextToSize(resumeH3Text, contentWidth);
            doc.text(resumeH3Wrapped, margin, y);
            y += resumeH3Wrapped.length * 4.5 + 1;
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
            // GENERIC DOCUMENTS: Subsection headers with subtle styling
            y += 5; // Space before subsection
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(55, 65, 81); // Dark gray
            const h3Text = cleanMarkdown(element.text).text;
            const h3Wrapped = doc.splitTextToSize(h3Text, contentWidth);
            const h3Height = h3Wrapped.length * 4.5;
            checkPageBreak(h3Height + 6);
            doc.text(h3Wrapped, margin, y);
            y += h3Height + 1;
            // Subtle underline
            doc.setDrawColor(180, 190, 200);
            doc.setLineWidth(0.3);
            doc.line(margin, y, margin + Math.min(doc.getTextWidth(h3Text), contentWidth * 0.4), y);
            y += 5;
          }
          break;

        case 'p':
          const cleaned = cleanMarkdown(element.text);
          const lowerText = cleaned.text.toLowerCase();

          if (isResume && !resumeHeaderDone) {
            // RESUME: Contact info - centered, smaller
            // BUT: if the text is long (>100 chars), it's likely a summary, not contact info
            // Force left-align for long paragraphs even if we haven't seen a header yet
            const isLikelyContactInfo =
              cleaned.text.length < 100 &&
              !cleaned.text.toLowerCase().includes('experience') &&
              !cleaned.text.toLowerCase().includes('professional') &&
              !cleaned.text.toLowerCase().includes('proven track record') &&
              !cleaned.text.toLowerCase().includes('skilled in') &&
              !cleaned.text.toLowerCase().includes('expertise in');

            if (isLikelyContactInfo) {
              doc.setFontSize(9.5);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(60, 60, 60);
              doc.text(cleaned.text, pageWidth / 2, y, { align: 'center' });
              y += 5;
            } else {
              // Long text or summary-like content - left align and mark header as done
              resumeHeaderDone = true;
              doc.setFontSize(9.5);
              let fontStyle: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal';
              if (cleaned.bold && cleaned.italic) fontStyle = 'bolditalic';
              else if (cleaned.bold) fontStyle = 'bold';
              else if (cleaned.italic) fontStyle = 'italic';
              doc.setFont('helvetica', fontStyle);
              doc.setTextColor(51, 51, 51);

              const splitText = doc.splitTextToSize(cleaned.text, contentWidth);
              const textHeight = splitText.length * 3.8;
              checkPageBreak(textHeight + 2);

              doc.text(splitText, margin, y);
              y += textHeight + 1.5;
            }
          } else if (
            isInvoice &&
            (lowerText.includes('total due') ||
              lowerText.includes('amount due') ||
              lowerText.includes('balance due'))
          ) {
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
          } else if (
            isInvoice &&
            (lowerText.startsWith('from:') ||
              lowerText.startsWith('bill to:') ||
              lowerText.includes('invoice #') ||
              lowerText.includes('invoice:') ||
              lowerText.startsWith('date:') ||
              lowerText.startsWith('due date:') ||
              lowerText.startsWith('payment terms:') ||
              lowerText.startsWith('accepted payment') ||
              lowerText.includes('thank you'))
          ) {
            // INVOICE: Header labels (From:, Bill To:, Invoice #, etc.) - Bold, tight spacing
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 64, 175);
            doc.text(cleaned.text, margin, y);
            y += 5; // Tight spacing for labels
          } else if (
            isInvoice &&
            // Detect address/contact lines: contains phone, email, city/state patterns, or is short text after From:/Bill To:
            (lowerText.includes('phone:') ||
              lowerText.includes('email:') ||
              lowerText.match(/[a-z]+,\s*[a-z]{2}\s*\d{5}/i) || // City, ST ZIP pattern
              lowerText.match(/^\d+\s+\w+/) || // Street address pattern (123 Main St)
              (cleaned.text.length < 50 && !lowerText.includes(':') && y < 120)) // Short lines in header area
          ) {
            // INVOICE: Address/contact lines - Normal weight, single-spaced
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(51, 51, 51);
            doc.text(cleaned.text, margin, y);
            y += 4; // Single-spaced for address lines
          } else if (isResume) {
            // RESUME PARAGRAPH - Force left-align everything
            // Detect if this looks like a job title
            const jobTitlePatterns =
              /(vice president|director|manager|supervisor|coordinator|specialist|analyst|engineer|developer|consultant|associate|assistant|executive|officer|lead|senior|junior|head of|chief|fellow|resident|attending|surgeon|physician|professor|technician|nurse|therapist)/i;
            const skillsPattern = /^(\*\*)?[A-Za-z]+(\s+[A-Za-z]+)?:(\*\*)?\s/; // Pattern like "Technical: " or "**Surgical Specialties:**"

            // Date pattern to extract dates from company lines
            // Matches: "June 2019 - Present", "2019 - 2023", "January 2020 - December 2022", "2019", etc.
            const dateExtractPattern =
              /\s+((?:(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+)?\d{4}\s*[-–]\s*(?:(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+)?(?:\d{4}|Present|Current)|(?:(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+)?\d{4})$/i;

            const isLikelyJobTitle =
              jobTitlePatterns.test(cleaned.text) &&
              cleaned.text.length < 80 &&
              !dateExtractPattern.test(cleaned.text);
            const dateMatch = cleaned.text.match(dateExtractPattern);
            const isLikelyCompanyLine = dateMatch !== null;
            const isLikelySkillLine = skillsPattern.test(cleaned.text);

            if (isLikelyJobTitle) {
              // Job title - bold, left-aligned
              y += 2; // Small space before job title
              checkPageBreak(6);
              doc.setFontSize(10);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(0, 0, 0);
              const titleWrapped = doc.splitTextToSize(cleaned.text, contentWidth);
              doc.text(titleWrapped, margin, y);
              y += titleWrapped.length * 4 + 1;
            } else if (isLikelyCompanyLine && dateMatch) {
              // Company with dates - company LEFT, date RIGHT on same line
              checkPageBreak(5);

              // Split the text: company/location on left, date on right
              const dateText = dateMatch[1].trim();
              const companyText = cleaned.text.replace(dateExtractPattern, '').trim();

              // Draw company name (left-aligned, bold)
              doc.setFontSize(10);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(0, 0, 0);

              // Calculate available width for company (leave room for date)
              const dateWidth = doc.getTextWidth(dateText);
              const companyMaxWidth = contentWidth - dateWidth - 10; // 10mm gap
              const companyWrapped = doc.splitTextToSize(companyText, companyMaxWidth);
              doc.text(companyWrapped, margin, y);

              // Draw date (right-aligned on same line)
              doc.setFont('helvetica', 'normal');
              doc.text(dateText, pageWidth - margin, y, { align: 'right' });

              y += companyWrapped.length * 4;
            } else if (isLikelySkillLine) {
              // Skills line - left-aligned with proper wrapping
              y += 1;
              checkPageBreak(5);
              doc.setFontSize(9.5);
              doc.setFont('helvetica', cleaned.bold ? 'bold' : 'normal');
              doc.setTextColor(0, 0, 0);
              const splitText = doc.splitTextToSize(cleaned.text, contentWidth);
              doc.text(splitText, margin, y);
              y += splitText.length * 3.8 + 2;
            } else {
              // Regular resume paragraph - left-aligned
              doc.setFontSize(9.5);
              let fontStyle: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal';
              if (cleaned.bold && cleaned.italic) fontStyle = 'bolditalic';
              else if (cleaned.bold) fontStyle = 'bold';
              else if (cleaned.italic) fontStyle = 'italic';
              doc.setFont('helvetica', fontStyle);
              doc.setTextColor(51, 51, 51);

              const splitText = doc.splitTextToSize(cleaned.text, contentWidth);
              const textHeight = splitText.length * 3.8;
              checkPageBreak(textHeight + 2);

              doc.text(splitText, margin, y);
              y += textHeight + 1.5;
            }
          } else {
            // Non-resume standard paragraph - consistent line height and spacing
            const fontSize = isBusinessPlan ? 11 : isInvoice ? 10 : 11;
            const paragraphLineHeight = isBusinessPlan ? 5.5 : isInvoice ? 4 : 5;
            const paragraphSpacing = isBusinessPlan ? 4 : isInvoice ? 1 : 3;

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
          // Bullet points indicate we're past the contact info section
          if (isResume) {
            resumeHeaderDone = true;
          }
          if (element.items) {
            for (const item of element.items) {
              const itemCleaned = cleanMarkdown(item);
              checkPageBreak(isResume ? 5 : 7);
              doc.setFontSize(isResume ? 9.5 : 11);
              let itemFontStyle: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal';
              if (itemCleaned.bold && itemCleaned.italic) itemFontStyle = 'bolditalic';
              else if (itemCleaned.bold) itemFontStyle = 'bold';
              else if (itemCleaned.italic) itemFontStyle = 'italic';
              doc.setFont('helvetica', itemFontStyle);
              doc.setTextColor(51, 51, 51);

              // Bullet point - smaller for resumes
              doc.setFillColor(51, 51, 51);
              doc.circle(margin + 2, y - 1.2, isResume ? 0.5 : 0.8, 'F');

              // Item text - tighter line height for resumes
              const bulletIndent = isResume ? 7 : 8;
              const itemText = doc.splitTextToSize(
                itemCleaned.text,
                contentWidth - bulletIndent - 2
              );
              doc.text(itemText, margin + bulletIndent, y);
              y += itemText.length * (isResume ? 3.8 : 5) + (isResume ? 0.5 : 2);
            }
            y += isResume ? 2 : 2; // Small gap after bullet list
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
              colWidths = [
                contentWidth * 0.45,
                contentWidth * 0.15,
                contentWidth * 0.2,
                contentWidth * 0.2,
              ];
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
                  doc.setTextColor(
                    isInvoice ? 255 : 30,
                    isInvoice ? 255 : 64,
                    isInvoice ? 255 : 175
                  );
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

          const quoteText = doc.splitTextToSize(
            cleanMarkdown(element.text).text,
            contentWidth - 15
          );
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

            // Calculate optimal grid layout for easy cutting
            // Use larger gaps (10mm) for cutting guides
            const gap = 10; // 10mm gap between QR codes for cutting

            // Calculate columns based on count for optimal layout
            let cols: number;
            if (qrCount === 1) cols = 1;
            else if (qrCount <= 2) cols = 2;
            else if (qrCount <= 4) cols = 2;
            else if (qrCount <= 6) cols = 3;
            else if (qrCount <= 9) cols = 3;
            else cols = 4; // 10-20 codes use 4 columns

            const rows = Math.ceil(qrCount / cols);

            // Calculate QR size based on available space with proper margins
            const availableWidth = contentWidth - (cols - 1) * gap;
            const availableHeight = pageHeight - margin * 2 - y - 20; // Extra bottom margin

            const qrSize = Math.min(
              availableWidth / cols,
              availableHeight / rows - gap,
              50 // Max size 50mm for good scannability
            );

            // Calculate total grid dimensions for centering
            const gridWidth = cols * qrSize + (cols - 1) * gap;
            const gridHeight = rows * qrSize + (rows - 1) * gap;
            const startX = margin + (contentWidth - gridWidth) / 2; // Center horizontally

            // Generate QR code image with higher quality
            try {
              const qrDataUrl = await QRCode.toDataURL(element.qrData, {
                width: 400, // Higher resolution
                margin: 2, // Quiet zone
                color: { dark: '#000000', light: '#ffffff' },
                errorCorrectionLevel: 'M',
              });

              // Check if we need a new page for the grid
              checkPageBreak(gridHeight + 10);

              // Draw QR codes in centered grid
              for (let i = 0; i < qrCount; i++) {
                const col = i % cols;
                const row = Math.floor(i / cols);

                const qrX = startX + col * (qrSize + gap);
                const qrY = y + row * (qrSize + gap);

                // Check page break for each row
                if (qrY + qrSize > pageHeight - margin) {
                  doc.addPage();
                  y = margin;
                }

                const finalY = row === 0 ? y : y + row * (qrSize + gap);

                // Add QR code image
                doc.addImage(qrDataUrl, 'PNG', qrX, finalY, qrSize, qrSize);

                // Add subtle cutting guides (light gray dashed lines)
                if (qrCount > 1) {
                  doc.setDrawColor(220, 220, 220);
                  doc.setLineWidth(0.2);
                  // Draw cutting guide rectangle around each QR
                  doc.rect(qrX - 2, finalY - 2, qrSize + 4, qrSize + 4);
                }
              }

              y += gridHeight + 15;
            } catch (qrError) {
              log.error('QR generation error', qrError instanceof Error ? qrError : { qrError });
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
        doc.text(`${i} / ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      }
    }

    // Generate filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const pdfFilename = `${safeTitle}_${timestamp}_${randomStr}.pdf`;

    // Generate PDF buffer
    const pdfBuffer = doc.output('arraybuffer');

    if (!pdfBuffer || pdfBuffer.byteLength === 0) {
      log.error('PDF generation produced empty buffer', { title });
      return errors.serverError(
        'Generated PDF was empty. Please try again with different content.'
      );
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
        log.error('PDF upload error', { error: pdfUploadError ?? 'Unknown error' });
        // Fallback to data URL
        const pdfBase64 = doc.output('datauristring');
        return successResponse({
          success: true,
          format: 'pdf',
          title,
          dataUrl: pdfBase64,
          filename: pdfFilename,
          storage: 'fallback',
        });
      }

      log.info('PDF uploaded successfully', { pdfPath });

      // Generate clean proxy URL that hides Supabase details
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'https://jcil.ai';

      const pdfToken = Buffer.from(
        JSON.stringify({ u: userId, f: pdfFilename, t: 'pdf' })
      ).toString('base64url');
      const pdfProxyUrl = `${baseUrl}/api/documents/download?token=${pdfToken}`;

      return successResponse({
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
    return successResponse({
      success: true,
      format: 'pdf',
      title,
      dataUrl: pdfBase64,
      filename: pdfFilename,
      storage: 'local',
    });
  } catch (error) {
    log.error('Error generating document', error instanceof Error ? error : { error });
    return errors.serverError('Failed to generate document');
  }
}
