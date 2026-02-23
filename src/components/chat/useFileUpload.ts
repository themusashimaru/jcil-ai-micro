/** File upload hook — handles file selection, validation, compression, drag-and-drop */

'use client';

import { useState, useCallback, type DragEvent } from 'react';
import type { Attachment } from '@/app/chat/types';
import { compressImage, isImageFile } from '@/lib/utils/imageCompression';
import { readFileContent } from '@/lib/utils/readFileContent';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILE_COUNT = 10;
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export function useFileUpload() {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const showError = useCallback((msg: string) => {
    setFileError(msg);
    setTimeout(() => setFileError(null), 5000);
  }, []);

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files) return;
      setFileError(null);
      const newAttachments: Attachment[] = [];
      const fileArray = Array.from(files);

      if (attachments.length + fileArray.length > MAX_FILE_COUNT) {
        showError(
          `Maximum ${MAX_FILE_COUNT} files allowed. You currently have ${attachments.length} file(s). Remove some files first.`
        );
        return;
      }

      for (const file of fileArray) {
        if (file.size > MAX_FILE_SIZE) {
          showError(
            `"${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum file size is 10MB.`
          );
          return;
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
          showError(
            `"${file.name}" file type not supported. Allowed: images, PDF, TXT, CSV, XLSX.`
          );
          return;
        }

        if (isImageFile(file)) {
          try {
            const compressed = await compressImage(file);
            newAttachments.push({
              id: `${Date.now()}-${file.name}`,
              name: file.name,
              type: 'image/jpeg',
              size: compressed.compressedSize,
              thumbnail: compressed.dataUrl,
              url: compressed.dataUrl,
            });
          } catch (error) {
            console.error('[useFileUpload] Failed to compress image:', file.name, error);
            showError(`Failed to process "${file.name}". Please try a different image.`);
          }
        } else {
          try {
            const { content, rawData } = await readFileContent(file);
            newAttachments.push({
              id: `${Date.now()}-${file.name}`,
              name: file.name,
              type: file.type,
              size: file.size,
              url: content,
              rawData,
            });
          } catch (error) {
            console.error('[useFileUpload] Failed to read file:', file.name, error);
            showError(`Failed to read "${file.name}". Please try again.`);
          }
        }
      }
      if (newAttachments.length > 0) setAttachments((prev) => [...prev, ...newAttachments]);
    },
    [attachments.length, showError]
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  return {
    attachments,
    isDragging,
    fileError,
    handleFileSelect,
    removeAttachment,
    clearAttachments,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
