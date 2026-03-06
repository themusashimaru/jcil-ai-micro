'use client';

import { useState, useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';
import type { Folder, Document, UserStats } from './my-files-types';
import { FOLDER_COLORS } from './my-files-types';

const log = logger('MyFilesPanel');

export function useMyFiles() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Folder management state
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [folderName, setFolderName] = useState('');
  const [folderColor, setFolderColor] = useState(FOLDER_COLORS[0]);
  const [isSavingFolder, setIsSavingFolder] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'folder' | 'file';
    item: Folder | Document;
  } | null>(null);

  // Move menu state (for mobile-friendly file moving)
  const [showMoveMenu, setShowMoveMenu] = useState<string | null>(null);

  // Load data when panel expands
  useEffect(() => {
    if (isExpanded) {
      loadData();
    }
  }, [isExpanded]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => {
      setContextMenu(null);
      setShowMoveMenu(null);
    };
    if (contextMenu || showMoveMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu, showMoveMenu]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [foldersRes, filesRes] = await Promise.all([
        fetch('/api/documents/user/folders'),
        fetch('/api/documents/user/files'),
      ]);

      if (foldersRes.ok) {
        const data = await foldersRes.json();
        setFolders(data.folders || []);
      } else {
        const errData = await foldersRes.json();
        log.error('Folders error', { error: errData });
      }

      if (filesRes.ok) {
        const data = await filesRes.json();
        setDocuments(data.documents || []);
        setStats(data.stats || null);
      } else {
        const errData = await filesRes.json();
        log.error('Files error', { error: errData });
      }
    } catch (err) {
      log.error('Error loading data', { error: err instanceof Error ? err : { error: err } });
      setError('Failed to load files');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    targetFolderId?: string
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setError(null);

    for (const file of Array.from(files)) {
      try {
        setUploadProgress(`Uploading ${file.name}...`);

        // Create FormData
        const formData = new FormData();
        formData.append('file', file);
        if (targetFolderId) {
          formData.append('folderId', targetFolderId);
        }

        // Upload file
        const uploadRes = await fetch('/api/documents/user/files', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          log.error('Upload failed', { error: err });
          throw new Error(err.error || 'Upload failed');
        }

        const { document } = await uploadRes.json();
        log.info('Upload successful', { document });

        // Trigger processing
        setUploadProgress(`Processing ${file.name}...`);
        const processRes = await fetch('/api/documents/user/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: document.id }),
        });

        if (!processRes.ok) {
          log.error('Processing failed');
        }
      } catch (err) {
        log.error('Upload error', { error: err instanceof Error ? err : { error: err } });
        setError(err instanceof Error ? err.message : 'Upload failed');
      }
    }

    setIsUploading(false);
    setUploadProgress('');

    // Clear input and reload
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    loadData();
  };

  const handleDeleteFile = async (docId: string) => {
    if (!confirm('Delete this file? This cannot be undone.')) return;

    try {
      const res = await fetch(`/api/documents/user/files?id=${docId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete');
      }

      loadData();
    } catch (err) {
      log.error('Delete error', { error: err instanceof Error ? err : { error: err } });
      setError('Failed to delete file');
    }
  };

  // Folder CRUD
  const handleCreateFolder = () => {
    setEditingFolder(null);
    setFolderName('');
    setFolderColor(FOLDER_COLORS[0]);
    setShowFolderModal(true);
  };

  const handleEditFolder = (folder: Folder) => {
    setEditingFolder(folder);
    setFolderName(folder.name);
    setFolderColor(folder.color);
    setShowFolderModal(true);
    setContextMenu(null);
  };

  const handleSaveFolder = async () => {
    if (!folderName.trim()) return;

    setIsSavingFolder(true);
    try {
      if (editingFolder) {
        // Update existing folder
        const res = await fetch('/api/documents/user/folders', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingFolder.id,
            name: folderName.trim(),
            color: folderColor,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to update folder');
        }
      } else {
        // Create new folder
        const res = await fetch('/api/documents/user/folders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: folderName.trim(),
            color: folderColor,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to create folder');
        }
      }

      setShowFolderModal(false);
      loadData();
    } catch (err) {
      log.error('Folder save error', { error: err instanceof Error ? err : { error: err } });
      setError(err instanceof Error ? err.message : 'Failed to save folder');
    } finally {
      setIsSavingFolder(false);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('Delete this folder? Files inside will be moved to root.')) return;

    try {
      const res = await fetch(`/api/documents/user/folders?id=${folderId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete folder');
      }

      setContextMenu(null);
      loadData();
    } catch (err) {
      log.error('Folder delete error', { error: err instanceof Error ? err : { error: err } });
      setError('Failed to delete folder');
    }
  };

  const handleMoveFile = async (docId: string, folderId: string | null) => {
    try {
      const res = await fetch('/api/documents/user/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: docId,
          folderId: folderId,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to move file');
      }

      setContextMenu(null);
      loadData();
    } catch (err) {
      log.error('Move error', { error: err instanceof Error ? err : { error: err } });
      setError('Failed to move file');
    }
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleContextMenu = (
    e: React.MouseEvent,
    type: 'folder' | 'file',
    item: Folder | Document
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type, item });
  };

  // Group documents by folder
  const rootDocs = documents.filter((d) => !d.folder_id);
  const folderDocs = (folderId: string) => documents.filter((d) => d.folder_id === folderId);

  return {
    isExpanded,
    setIsExpanded,
    showInfoTooltip,
    setShowInfoTooltip,
    folders,
    documents,
    stats,
    isLoading,
    isUploading,
    uploadProgress,
    error,
    setError,
    expandedFolders,
    fileInputRef,
    showFolderModal,
    setShowFolderModal,
    editingFolder,
    folderName,
    setFolderName,
    folderColor,
    setFolderColor,
    isSavingFolder,
    contextMenu,
    setContextMenu,
    showMoveMenu,
    setShowMoveMenu,
    handleFileSelect,
    handleDeleteFile,
    handleCreateFolder,
    handleEditFolder,
    handleSaveFolder,
    handleDeleteFolder,
    handleMoveFile,
    toggleFolder,
    handleContextMenu,
    rootDocs,
    folderDocs,
  };
}
