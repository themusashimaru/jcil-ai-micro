/**
 * DOCUMENT MARKER PROCESSING
 *
 * Handles [GENERATE_PDF:], [GENERATE_XLSX:], [GENERATE_QR:], [DOCUMENT_DOWNLOAD:]
 * markers in AI responses and triggers the corresponding generation APIs.
 */

import { logger } from '@/lib/logger';
import type { Message } from './types';

const log = logger('ChatClient');

type SetMessages = React.Dispatch<React.SetStateAction<Message[]>>;

interface MarkerMatch {
  title: string;
  content: string;
  textBefore: string;
}

/**
 * Extract a generation marker from response text
 */
function extractMarker(text: string, markerPrefix: string): MarkerMatch | null {
  const regex = new RegExp(`\\[${markerPrefix}:\\s*(.+?)\\]`, 's');
  const match = text.match(regex);
  if (!match) return null;

  const title = match[1].trim();
  const markerStartIndex = text.indexOf(`[${markerPrefix}:`);
  const markerEnd = text.indexOf(']', markerStartIndex) + 1;
  const content = markerEnd > 0 ? text.slice(markerEnd).trim() : '';
  const textBefore = markerStartIndex > 0 ? text.slice(0, markerStartIndex).trim() : '';

  return { title, content, textBefore };
}

/**
 * Trigger document generation (PDF or XLSX) and handle the response
 */
async function generateDocument(
  format: 'pdf' | 'xlsx',
  title: string,
  content: string,
  textBefore: string,
  messageId: string,
  setMessages: SetMessages
): Promise<string> {
  const icon = format === 'pdf' ? '📄' : '📊';
  const label = format === 'pdf' ? 'PDF' : 'Excel';
  const ext = format === 'pdf' ? 'pdf' : 'xlsx';

  if (!title || !content || content.length < 10) {
    log.warn(`${label} marker found but content is empty or too short`);
    const fallback =
      textBefore ||
      `I tried to generate a ${label.toLowerCase()} but encountered an issue. Please try again with more content.`;
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, content: fallback } : msg))
    );
    return fallback;
  }

  const statusContent = textBefore
    ? `${textBefore}\n\n${icon} **Generating ${label}: ${title}...**`
    : `${icon} **Generating ${label}: ${title}...**`;

  setMessages((prev) =>
    prev.map((msg) => (msg.id === messageId ? { ...msg, content: statusContent } : msg))
  );

  try {
    const response = await fetch('/api/documents/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, title, format }),
    });

    if (response.ok) {
      let data: Record<string, unknown>;
      try {
        data = await response.json();
      } catch (parseError) {
        log.error(`${label} response JSON parse failed (likely truncated):`, parseError as Error);
        const truncatedContent = textBefore
          ? `${textBefore}\n\n⚠️ The ${label.toLowerCase()} generation timed out. Please try again — you can also use the document buttons in the Tools menu for more reliable generation.`
          : `⚠️ The ${label.toLowerCase()} generation timed out. Please try again — you can also use the document buttons in the Tools menu for more reliable generation.`;
        setMessages((prev) =>
          prev.map((msg) => (msg.id === messageId ? { ...msg, content: truncatedContent } : msg))
        );
        return truncatedContent;
      }
      const downloadUrl = (data.downloadUrl || data.dataUrl) as string | undefined;
      const isSupabaseUrl = !!data.downloadUrl;

      if (downloadUrl) {
        log.debug(
          `${label} generated successfully, storage:`,
          data.storage as Record<string, unknown>
        );

        if (isSupabaseUrl) {
          let messageContent = textBefore ? `${textBefore}\n\n` : '';
          messageContent += `✅ **Your ${label} is ready!**\n\n`;
          messageContent += `${icon} **[Download ${label}](${downloadUrl})**`;
          messageContent += `\n\n*Link expires in 1 hour. If you need it later, just ask me to generate again.*`;

          setMessages((prev) =>
            prev.map((msg) => (msg.id === messageId ? { ...msg, content: messageContent } : msg))
          );
          return messageContent;
        } else {
          // Data URL fallback: trigger auto-download
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = (data.filename as string) || `${title}.${ext}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          const successContent = textBefore
            ? `${textBefore}\n\n✅ **${title}.${ext}** has been downloaded!\n\nCheck your downloads folder.`
            : `✅ **${title}.${ext}** has been downloaded!\n\nCheck your downloads folder.`;

          setMessages((prev) =>
            prev.map((msg) => (msg.id === messageId ? { ...msg, content: successContent } : msg))
          );
          return successContent;
        }
      }
    }

    const errorBody = await response.text().catch(() => 'unknown error');
    log.error(`${label} generation failed:`, new Error(errorBody));
    const errorContent = textBefore
      ? `${textBefore}\n\n⚠️ Sorry, I couldn't generate the ${label.toLowerCase()}. Please try again.`
      : `⚠️ Sorry, I couldn't generate the ${label.toLowerCase()}. Please try again.`;

    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, content: errorContent } : msg))
    );
    return errorContent;
  } catch (error) {
    log.error(`Error during ${label} generation:`, error as Error);
    const errorContent = textBefore
      ? `${textBefore}\n\n⚠️ Sorry, there was an error generating your ${label.toLowerCase()}. Please try again.`
      : `⚠️ Sorry, there was an error generating your ${label.toLowerCase()}. Please try again.`;

    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, content: errorContent } : msg))
    );
    return errorContent;
  }
}

/**
 * Process all document generation markers in an AI response.
 * Returns updated finalContent and any document download metadata.
 */
export async function processDocumentMarkers(
  finalContent: string,
  messageId: string,
  setMessages: SetMessages
): Promise<{ content: string; documentDownloadMeta: Record<string, unknown> | null }> {
  let content = finalContent;
  let documentDownloadMeta: Record<string, unknown> | null = null;

  // Process [GENERATE_PDF:] marker
  const pdfMarker = extractMarker(content, 'GENERATE_PDF');
  if (pdfMarker) {
    content = await generateDocument(
      'pdf',
      pdfMarker.title,
      pdfMarker.content,
      pdfMarker.textBefore,
      messageId,
      setMessages
    );
  }

  // Process [GENERATE_XLSX:] marker
  const xlsxMarker = extractMarker(content, 'GENERATE_XLSX');
  if (xlsxMarker) {
    content = await generateDocument(
      'xlsx',
      xlsxMarker.title,
      xlsxMarker.content,
      xlsxMarker.textBefore,
      messageId,
      setMessages
    );
  }

  // Process [GENERATE_QR:] marker
  const qrMatch = content.match(/\[GENERATE_QR:\s*(.+?)\]/s);
  if (qrMatch) {
    const qrData = qrMatch[1].trim();
    log.debug('Detected GENERATE_QR marker, data:', { data: qrData.slice(0, 100) });

    const cleanedContent = content
      .replace(/\[GENERATE_QR:\s*.+?\]/s, '🔲 **Generating QR Code...**\n\n')
      .trim();
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, content: cleanedContent } : msg))
    );
    content = cleanedContent;

    try {
      const qrResponse = await fetch('/api/qrcode/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: qrData, size: 300 }),
      });

      if (qrResponse.ok) {
        const qrResult = await qrResponse.json();
        if (qrResult.dataUrl) {
          log.debug('QR code generated successfully');
          const qrMessage: Message = {
            id: (Date.now() + 4).toString(),
            role: 'assistant',
            content: `📱 **Your QR Code is ready!**\n\nScan this code to access: ${qrData.length > 50 ? qrData.slice(0, 50) + '...' : qrData}`,
            imageUrl: qrResult.dataUrl,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, qrMessage]);
        }
      } else {
        log.error('QR generation failed:', new Error(await qrResponse.text()));
        const errorMsg: Message = {
          id: (Date.now() + 4).toString(),
          role: 'assistant',
          content: `⚠️ Sorry, I couldn't generate the QR code. Here's the data you can use: ${qrData}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (qrError) {
      log.error('Error during QR generation:', qrError as Error);
      const qrErrorMsg: Message = {
        id: (Date.now() + 5).toString(),
        role: 'assistant',
        content: `Sorry, I couldn't generate the QR code due to a network error. Here's the data you can use: ${qrData}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, qrErrorMsg]);
    }
  }

  // Process [DOCUMENT_DOWNLOAD:] marker — match the JSON object explicitly to avoid
  // the non-greedy (.+?) stopping at a `]` inside a URL or other field value.
  const docDownloadMatch = content.match(/\[DOCUMENT_DOWNLOAD:(\{[\s\S]*?\})\]/);
  if (docDownloadMatch) {
    try {
      const docData = JSON.parse(docDownloadMatch[1]);
      log.debug('Detected DOCUMENT_DOWNLOAD marker:', docData.filename);

      const cleanedContent = content.replace(/\[DOCUMENT_DOWNLOAD:\{[\s\S]*?\}\]/g, '').trim();
      const docUrl = docData.downloadUrl || docData.dataUrl;

      if (docUrl) {
        const docDownload = {
          filename: docData.filename || 'document',
          mimeType: docData.mimeType || 'application/octet-stream',
          dataUrl: docUrl,
          canPreview: docData.canPreview || false,
        };
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? { ...msg, content: cleanedContent, documentDownload: docDownload }
              : msg
          )
        );
        content = cleanedContent;
        documentDownloadMeta = { documentDownload: docDownload };
      }
    } catch (docError) {
      log.error('Error parsing DOCUMENT_DOWNLOAD marker:', docError as Error);
      // Strip the malformed marker so the user doesn't see raw JSON
      const cleanedContent = content.replace(/\[DOCUMENT_DOWNLOAD:[^\]]*\]/g, '').trim();
      const fallbackContent = cleanedContent
        ? `${cleanedContent}\n\nYour document was generated but the download link could not be processed. Please try again.`
        : 'Your document was generated but the download link could not be processed. Please try again.';
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, content: fallbackContent } : msg))
      );
      content = fallbackContent;
    }
  }

  return { content, documentDownloadMeta };
}
